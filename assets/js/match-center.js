/* ===================== MAÇ MERKEZİ ===================== */
let mcMatchId = null;
let mcTab = 'overview';
let mcCache = {}; // matchId -> {lineups, absences, modelPred, consensus, errors, loaded}
let mcReturnFocus = null;
let mcOriginHash = '';
let mcOriginScroll = 0;
let mcScrollRestoration = 'auto';

function matchStatusLabel(m){
  if(m.status==='ertelendi') return 'Ertelendi';
  if(m.status==='iptal') return 'İptal edildi';
  if(m.status==='canlı') return 'Canlı';
  if(m.status==='devre_arasi') return 'Devre arası';
  const result = getResult(m.id);
  if(result) return 'Bitti';
  const now = Date.now(); const kt = new Date(m.kickoff).getTime();
  if(now < kt - 15*60000) return 'Tahminlere açık';
  if(now < kt) return 'Tahminler kapandı';
  if(now < kt + 130*60000) return 'Durum doğrulanıyor';
  return 'Sonuç bekleniyor';
}
async function mcQuery(promise, label){
  try{
    const { data, error } = await promise;
    if(error) throw error;
    return { data, error:null };
  }catch(error){
    console.warn('[XYZSkor maç detayı]', label, error);
    return { data:null, error:error && (error.message || error.code) ? (error.message || error.code) : 'bilinmeyen hata' };
  }
}
async function ensureMcData(matchId){
  if(mcCache[matchId] && mcCache[matchId].loaded) return mcCache[matchId];
  const entry = { lineups:[], absences:[], modelPred:null, consensus:null, errors:{}, loaded:false };
  const [lineupsRes, absencesRes, modelRes, consensusRes] = await Promise.all([
    mcQuery(sb.from('match_lineups').select('*').eq('match_id', matchId), 'match_lineups'),
    mcQuery(sb.from('match_absences').select('*').eq('match_id', matchId), 'match_absences'),
    mcQuery(sb.from('model_predictions').select('*').eq('match_id', matchId).maybeSingle(), 'model_predictions'),
    mcQuery(sb.rpc('get_match_prediction_consensus', { p_match_id: matchId }), 'prediction_consensus')
  ]);
  entry.lineups = Array.isArray(lineupsRes.data) ? lineupsRes.data : [];
  entry.absences = Array.isArray(absencesRes.data) ? absencesRes.data : [];
  entry.modelPred = modelRes.data || null;
  entry.consensus = Array.isArray(consensusRes.data) ? (consensusRes.data[0] || null) : null;
  if(lineupsRes.error) entry.errors.lineups=lineupsRes.error;
  if(absencesRes.error) entry.errors.absences=absencesRes.error;
  if(modelRes.error) entry.errors.model=modelRes.error;
  if(consensusRes.error) entry.errors.consensus=consensusRes.error;
  entry.loaded = true;
  mcCache[matchId] = entry;
  return entry;
}
async function openMatchCenter(matchId, updateUrl){
  const m = MATCHES.find(x=>x.id===matchId); if(!m) return;
  if(!mcMatchId){
    mcReturnFocus = document.activeElement;
    mcOriginHash = location.hash || '#football';
    mcOriginScroll = window.scrollY;
    mcScrollRestoration = history.scrollRestoration;
    history.scrollRestoration = 'manual';
  }
  mcMatchId = matchId; mcTab = 'overview';
  if(updateUrl !== false) updateHash('match/'+matchId);
  document.body.classList.add('modal-open');
  const overlay=document.getElementById('mcOverlay'); overlay.classList.add('show'); overlay.setAttribute('aria-hidden','false');
  setMcTabState('overview');
  renderMcHeader(m);
  document.getElementById('mcBody').innerHTML = `<div class="mc-empty">Yükleniyor…</div>`;
  document.querySelector('.mc-close').focus();
  await ensureMcData(matchId);
  renderMcTab();
}
function closeMatchCenter(updateUrl){
  const shouldNavigateBack = updateUrl !== false && !!mcOriginHash && location.hash.startsWith('#match/');
  mcMatchId = null;
  const overlay=document.getElementById('mcOverlay'); overlay.classList.remove('show'); overlay.setAttribute('aria-hidden','true');
  document.body.classList.remove('modal-open');
  const restoreFocus=mcReturnFocus, restoreScroll=mcOriginScroll;
  if(shouldNavigateBack) history.back();
  else if(updateUrl !== false) history.replaceState(null,'','#week/'+activeWeek);
  setTimeout(()=>{ window.scrollTo(0,restoreScroll); if(restoreFocus && restoreFocus.focus) restoreFocus.focus(); history.scrollRestoration=mcScrollRestoration; },200);
  mcReturnFocus=null; mcOriginHash='';
}
document.getElementById('mcOverlay').addEventListener('click', e=>{ if(e.target.id==='mcOverlay') closeMatchCenter(); });
document.getElementById('mcOverlay').addEventListener('keydown', e=>{
  if(e.key==='Escape' && mcMatchId){ e.preventDefault(); closeMatchCenter(); return; }
  if(e.key!=='Tab' || !mcMatchId) return;
  const focusable=[...e.currentTarget.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>el.offsetParent!==null);
  if(!focusable.length) return;
  const first=focusable[0], last=focusable[focusable.length-1];
  if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
});
function setMcTabState(tab){
  document.querySelectorAll('#mcTabs [role="tab"]').forEach(button=>{
    const active=button.dataset.mcTab===tab;
    button.classList.toggle('active',active); button.setAttribute('aria-selected',String(active)); button.tabIndex=active?0:-1;
  });
  const body=document.getElementById('mcBody'); body.setAttribute('aria-labelledby','mc-tab-'+tab);
}
function switchMcTab(tab){
  mcTab = tab;
  setMcTabState(tab);
  renderMcTab();
}
document.getElementById('mcTabs').addEventListener('keydown', event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  const tabs=[...event.currentTarget.querySelectorAll('[role="tab"]')]; const current=tabs.indexOf(document.activeElement); if(current<0) return;
  event.preventDefault();
  let next=current;
  if(event.key==='ArrowRight') next=(current+1)%tabs.length;
  if(event.key==='ArrowLeft') next=(current-1+tabs.length)%tabs.length;
  if(event.key==='Home') next=0; if(event.key==='End') next=tabs.length-1;
  tabs[next].focus(); switchMcTab(tabs[next].dataset.mcTab);
});
function renderMcHeader(m){
  const result=getResult(m.id); const tournament=m.competition || m.tournament || m.league_name || 'Süper Lig';
  const centerValue=result ? `${escapeHTML(result.home)}–${escapeHTML(result.away)}` : escapeHTML(fmtTime(m.kickoff));
  const centerCaption=result ? 'Maç sonucu' : 'Başlangıç';
  const meta=[fmtKickoff(m.kickoff),m.stadyum,m.referee_name?`Hakem: ${m.referee_name}`:''].filter(Boolean);
  const deadline=new Date(new Date(m.kickoff).getTime()-15*60000);
  const user=getCurrentUser(); const ownPrediction=user && ALL_PREDICTIONS[m.id] ? ALL_PREDICTIONS[m.id][user.id] : null;
  document.getElementById('mcCompetition').textContent=String(tournament);
  document.getElementById('mcTeamsRow').innerHTML = `
    <div class="mc-team home">${crestHTML(m.ev,'md')}<span class="mc-team-name">${escapeHTML(m.ev)}</span></div>
    <div class="mc-score-block"><div class="mc-score">${centerValue}</div><div class="mc-score-caption">${centerCaption}</div></div>
    <div class="mc-team away">${crestHTML(m.konuk,'md')}<span class="mc-team-name">${escapeHTML(m.konuk)}</span></div>`;
  document.getElementById('mcMetaRow').innerHTML = meta.map(value=>`<span>${escapeHTML(value)}</span>`).join('');
  document.getElementById('mcStatusBadge').textContent = matchStatusLabel(m);
  const predictionText=ownPrediction ? `Tahminin: ${ownPrediction.pick}${ownPrediction.scoreHome!=null?` · ${ownPrediction.scoreHome}–${ownPrediction.scoreAway}`:''}` : (isLocked(m.kickoff)?'Tahmin süresi kapandı':`Tahmin son zamanı: ${deadline.toLocaleString('tr-TR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}`);
  document.getElementById('mcPredictionStrip').innerHTML=`<span>${escapeHTML(predictionText)}</span><button class="btn ghost" type="button" onclick="goToPredictionFromMatch()">${ownPrediction?'Tahminini gör':'Predict’e git'}</button>`;
}
function goToPredictionFromMatch(){
  closeMatchCenter(false); switchMainTab('predict'); switchLeagueSection('predict');
  requestAnimationFrame(()=>{ const target=document.getElementById('leagueMatchList'); if(target) target.scrollIntoView({behavior:'smooth',block:'start'}); });
}
function renderMcTab(){
  const m = MATCHES.find(x=>x.id===mcMatchId); if(!m) return;
  const fns = { overview:renderMcOverview, flow:renderMcFlow, lineups:renderMcLineups, stats:renderMcStats, absences:renderMcAbsences, prematch:renderMcPrematch, news:renderMcNews, community:renderMcCommunity };
  (fns[mcTab] || renderMcOverview)(m);
}
function renderMcOverview(m){
  const result = getResult(m.id);
  const weather = m.weather || null;
  ensureMcData(m.id).then(data=>{
    if(mcMatchId!==m.id || mcTab!=='overview') return;
    const hasLineups = data.lineups.length>0;
    const infoRows = [
      { label:'Hakem', value: m.referee_name ? `${m.referee_name}${m.referee_stats && m.referee_stats.mac_sayisi ? ' · Bu sezon '+m.referee_stats.mac_sayisi+' maç yönetti' : ''}` : 'Henüz açıklanmadı' },
      { label:'Stadyum', value:m.stadyum || 'Stadyum bilgisi yayınlanmadı' },
      { label:'Kadrolar', value: data.errors.lineups ? 'Kadro verisi alınamadı' : (hasLineups ? (data.lineups.some(l=>l.is_official)?'Resmî kadro açıklandı':'Muhtemel kadro eklendi') : 'Kadrolar henüz açıklanmadı') },
      { label:'Hava', value: weather ? [weather.sicaklik!=null?weather.sicaklik+'°C':'',weather.yagis_ihtimali!=null?'Yağış %'+weather.yagis_ihtimali:''].filter(Boolean).join(' · ') || 'Hava verisi eksik' : 'Hava verisi henüz yayınlanmadı' }
    ];
    document.getElementById('mcBody').innerHTML = `
      ${result ? `<div class="mc-result-card" style="text-align:center;"><div class="pts">${result.home} - ${result.away}</div><div style="font-size:13px;color:var(--ink-dim);margin-top:4px;">Maç sonucu doğrulandı</div></div>` : ''}
      <section class="mc-section"><div class="mc-section-title">Maç bilgileri</div><dl class="mc-info-list">${infoRows.map(row=>`<div class="mc-info-row"><dt>${escapeHTML(row.label)}</dt><dd>${escapeHTML(row.value)}</dd></div>`).join('')}</dl></section>
      ${m.verified ? `<div class="source-line">${m.source||m.source_name?'Kaynak: '+escapeHTML(m.source||m.source_name)+' · ':''}Doğrulama kaydı mevcut · Son kontrol: ${escapeHTML(VERIFIED.kontrol)}</div>` : '<div class="mc-empty">Fikstür kaynağı için doğrulama bilgisi bulunmuyor.</div>'}
    `;
  });
}
function renderMcAnalysis(m){
  const a = ANALYSIS[m.id] || {};
  const why = Array.isArray(a.story_summary) ? a.story_summary : [];
  document.getElementById('mcBody').innerHTML = `
    ${why.length ? `<div class="panel" style="padding:14px;margin-bottom:14px;"><div class="section-title" style="font-size:14px;">Bu Maç Neden Önemli?</div><ul class="watch-list">${why.slice(0,5).map(w=>`<li>${escapeHTML(w)}</li>`).join('')}</ul></div>` : `<div class="mc-empty" style="margin-bottom:14px;">Maç önü editoryal özeti henüz yayınlanmadı.</div>`}
    ${analysisBlockHTML(m)}
  `;
}
function renderMcLineups(m){
  ensureMcData(m.id).then(data=>{
    if(mcMatchId!==m.id || mcTab!=='lineups') return;
    if(data.errors.lineups){ document.getElementById('mcBody').innerHTML='<div class="mc-empty">Kadro verisi şu anda alınamıyor. Diğer maç detayları kullanılabilir.</div>'; return; }
    const evLineup = data.lineups.filter(l=>l.team===m.ev);
    const konukLineup = data.lineups.filter(l=>l.team===m.konuk);
    function teamBlock(team, list){
      if(!list.length) return `<div class="mc-empty">${escapeHTML(team)} kadrosu henüz açıklanmadı.</div>`;
      const official = list.some(l=>l.is_official);
      return `<div style="margin-bottom:6px;"><span class="mc-status-badge" style="background:${official?'var(--okbg)':'var(--bg-elev-3)'};color:${official?'var(--ok)':'var(--gold)'};">${official?'RESMÎ':'MUHTEMEL'}</span></div>` +
        list.map(l=>`<div class="mc-lineup-row"><span>${l.number!=null?escapeHTML(l.number)+'. ':''}${escapeHTML(l.player_name)}${l.is_captain?' (K)':''}${l.is_keeper?' · Kaleci':''}</span><span class="mono" style="color:var(--ink-faint);">${escapeHTML(l.position||'')}</span></div>`).join('');
    }
    document.getElementById('mcBody').innerHTML = `
      <div class="section-title" style="font-size:14px;">${escapeHTML(m.ev)}</div>
      ${teamBlock(m.ev, evLineup)}
      <div class="section-title" style="font-size:14px;margin-top:16px;">${escapeHTML(m.konuk)}</div>
      ${teamBlock(m.konuk, konukLineup)}
    `;
  });
  document.getElementById('mcBody').innerHTML = `<div class="mc-empty">Yükleniyor…</div>`;
}
function absencePresentation(a){
  const raw = String(a.availability_status || a.status || '').trim().toLocaleLowerCase('tr-TR');
  const labels = {
    official_injury:['Resmî sakatlık','official'], resmi_sakatlik:['Resmî sakatlık','official'],
    probable_absence:['Muhtemel eksik','probable'], muhtemel_eksik:['Muhtemel eksik','probable'],
    suspended:['Cezalı','suspended'], cezali:['Cezalı','suspended'], cezalı:['Cezalı','suspended'],
    not_in_squad:['Maç kadrosunda yok','neutral'], kadroda_yok:['Maç kadrosunda yok','neutral'],
    technical_decision:['Teknik tercih','neutral'], teknik_tercih:['Teknik tercih','neutral'],
    personal_reason:['Kişisel neden','neutral'], other:['Diğer','neutral']
  };
  if(labels[raw]) return { label:labels[raw][0], tone:labels[raw][1] };
  // Eski ve belirsiz "sakat" kayıtlarını resmî bilgi gibi yükseltme.
  if(raw==='sakat' || raw==='injured' || raw==='injury') return { label:'Doğrulama bekliyor', tone:'probable' };
  return { label:raw ? String(a.availability_status || a.status) : 'Durum belirtilmedi', tone:'neutral' };
}
function renderMcStats(m){
  const evRow=STANDINGS.find(row=>row.team===m.ev), awayRow=STANDINGS.find(row=>row.team===m.konuk);
  if(!evRow || !awayRow){ document.getElementById('mcBody').innerHTML='<div class="mc-empty">Maç istatistikleri henüz oluşmadı. Puan durumu karşılaştırması için sağlayıcı güncellemesi bekleniyor.</div>'; return; }
  const sorted=[...STANDINGS].sort((a,b)=>(b.points??-Infinity)-(a.points??-Infinity));
  const display=value=>value==null?'—':escapeHTML(value);
  const compare=(label,home,away)=>`<div class="mc-vs-grid"><div class="val">${display(home)}</div><div class="lbl">${escapeHTML(label)}</div><div class="val">${display(away)}</div></div>`;
  document.getElementById('mcBody').innerHTML=`<section class="mc-section"><div class="mc-section-title">Takım karşılaştırması</div>${[
    compare('LİG SIRASI',sorted.findIndex(row=>row.team===m.ev)+1,sorted.findIndex(row=>row.team===m.konuk)+1),
    compare('PUAN',evRow.points,awayRow.points),compare('ATTIĞI GOL',evRow.goals_for,awayRow.goals_for),compare('YEDİĞİ GOL',evRow.goals_against,awayRow.goals_against),compare('SON 5',evRow.form,awayRow.form)
  ].join('')}</section><div class="source-line">Karşılaştırma, yayınlanmış lig tablosundaki mevcut değerlerden üretilir.</div>`;
}
function renderMcAbsences(m){
  document.getElementById('mcBody').innerHTML='<div class="mc-empty">Oyuncu uygunluk verisi kontrol ediliyor…</div>';
  ensureMcData(m.id).then(data=>{
    if(mcMatchId!==m.id || mcTab!=='absences') return;
    if(data.errors.absences){ document.getElementById('mcBody').innerHTML='<div class="mc-empty">Eksik oyuncu verisi şu anda alınamıyor. Doğrulanmamış sakatlık veya ceza gösterilmeyecek.</div>'; return; }
    const home=data.absences.filter(item=>item.team===m.ev), away=data.absences.filter(item=>item.team===m.konuk);
    function absenceBlock(team,list){
      if(!list.length) return `<div class="mc-empty">${escapeHTML(team)} için doğrulanmış oyuncu uygunluk kaydı yok.</div>`;
      return list.map(item=>{
        const view=absencePresentation(item);
        const verification=item.verification_status==='official'?'Resmî kaynak':(item.verification_status==='press_report'?'Basın kaydı':'Sağlayıcı kaydı');
        return `<div class="mc-absence-row"><span>${escapeHTML(item.player_name)}${item.reason?' — '+escapeHTML(item.reason):''}</span><span class="mc-absence-status ${view.tone}">${escapeHTML(view.label)}</span><span class="mc-absence-meta">${escapeHTML(verification)}${item.source?' · '+escapeHTML(item.source):''}</span></div>`;
      }).join('');
    }
    document.getElementById('mcBody').innerHTML=`<div class="section-desc">Resmî sakatlık, muhtemel eksik, ceza ve kadro tercihi ayrı gösterilir.</div><div class="mc-section-title">${escapeHTML(m.ev)}</div>${absenceBlock(m.ev,home)}<div class="mc-section-title" style="margin-top:18px;">${escapeHTML(m.konuk)}</div>${absenceBlock(m.konuk,away)}`;
  });
}
function renderMcFlow(m){
  document.getElementById('mcBody').innerHTML = `<div class="mc-empty">Bu maç için doğrulanmış olay akışı bulunmuyor. Gol, kart veya oyuncu değişikliği tahmin edilerek gösterilmeyecek.</div>`;
}
function mcModelHTML(m){
  const mm=matchMathMetrics(m);
  return mm ? `
    <div class="section-title" style="font-size:14px;">Matematiksel Karşılaştırma</div>
    <div class="math-grid">
      <div class="math-cell"><div class="math-n">${mm.powerHome.toFixed(1)}</div><div class="math-l">${escapeHTML(m.ev)} güç endeksi</div></div>
      <div class="math-cell"><div class="math-n">${mm.powerAway.toFixed(1)}</div><div class="math-l">${escapeHTML(m.konuk)} güç endeksi</div></div>
      <div class="math-cell"><div class="math-n">${mm.xgHome.toFixed(2)}</div><div class="math-l">${escapeHTML(m.ev)} beklenen gol</div></div>
      <div class="math-cell"><div class="math-n">${mm.xgAway.toFixed(2)}</div><div class="math-l">${escapeHTML(m.konuk)} beklenen gol</div></div>
    </div>
    <div class="section-title" style="font-size:14px;margin-top:18px;">Olasılık Dağılımı</div>
    <div class="mc-consensus-bar"><div style="width:${mm.home}%;background:var(--home);"></div><div style="width:${mm.draw}%;background:var(--draw);"></div><div style="width:${mm.away}%;background:var(--away);"></div></div>
    <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-family:var(--font-mono);font-size:12px;color:var(--ink-dim);"><span>${escapeHTML(m.ev)}: %${mm.home.toFixed(1)}</span><span>Beraberlik: %${mm.draw.toFixed(1)}</span><span>${escapeHTML(m.konuk)}: %${mm.away.toFixed(1)}</span></div>
    <div class="formula-note" style="padding:16px 0 0;">Bu değerler maç başı puan, gol farkı, atılan/yenen gol ortalaması ve iç saha katsayısının lojistik dağılıma dönüştürülmesiyle hesaplanır. Örneklem: ${mm.sample} maç.</div>` : `<div class="mc-empty">Matematiksel model için yeterli sezon verisi oluşmadı.</div>`;
}
function renderMcPrematch(m){
  const analysis=ANALYSIS[m.id] || {}; const why=Array.isArray(analysis.story_summary)?analysis.story_summary:[];
  document.getElementById('mcBody').innerHTML=`${why.length?`<section class="mc-section"><div class="mc-section-title">Bu maç neden önemli?</div><ul class="watch-list">${why.slice(0,5).map(item=>`<li>${escapeHTML(item)}</li>`).join('')}</ul></section>`:'<div class="mc-empty" style="margin-bottom:14px;">Maç önü editoryal özeti henüz yayınlanmadı.</div>'}${analysisBlockHTML(m)}<section class="mc-section" style="margin-top:18px;">${mcModelHTML(m)}</section>`;
}
function relatedNewsForMatch(matchId){
  return Object.values(WEEKLY_STORIES).filter(story=>story && story.is_published).flatMap(story=>Array.isArray(story.cards)?story.cards:[]).filter(card=>card && card.related_match_id===matchId && !/tahmin|kupon|oran|bahis/i.test(`${card.title||''} ${card.text||''}`));
}
function renderMcNews(m){
  if(DATA_ERRORS.weekly_stories){ document.getElementById('mcBody').innerHTML='<div class="mc-empty">İlgili haberler şu anda alınamıyor. Diğer maç detayları kullanılabilir.</div>'; return; }
  const cards=relatedNewsForMatch(m.id);
  if(!cards.length){ document.getElementById('mcBody').innerHTML='<div class="mc-empty">Bu maçla ilişkilendirilmiş yayınlanmış haber bulunmuyor.</div>'; return; }
  document.getElementById('mcBody').innerHTML=`<div class="mc-related-list">${cards.map(card=>`<article class="mc-related-item"><h3>${escapeHTML(card.title||'İlgili gelişme')}</h3>${card.text?`<p>${escapeHTML(card.text)}</p>`:''}<div class="mc-related-meta">${card.source?'Kaynak: '+escapeHTML(card.source):'Kaynak bilgisi yayınlanmadı'}${card.verified_at?' · '+escapeHTML(fmtEditorialDate(card.verified_at)):''}</div></article>`).join('')}</div>`;
}
function renderMcCommunity(m){
  const user=getCurrentUser(); const own=user && ALL_PREDICTIONS[m.id] ? ALL_PREDICTIONS[m.id][user.id] : null;
  document.getElementById('mcBody').innerHTML=`${own?`<section class="mc-section"><div class="mc-section-title">Senin tahminin</div><div class="mc-result-card"><div class="pts">${escapeHTML(own.pick)}${own.scoreHome!=null?` · ${escapeHTML(own.scoreHome)}–${escapeHTML(own.scoreAway)}`:''}</div></div></section>`:''}<div class="mc-empty">Diğer kullanıcıların bireysel tahminleri gösterilmez. Anonim toplu dağılım için mevcut RLS ve gizlilik davranışı değiştirilmedi.</div>`;
}
