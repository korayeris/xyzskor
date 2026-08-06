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
/* ---- Maç verisi tazeleme ----
   Önceden mcCache bir kez doldurulunca bir daha hiç yenilenmiyordu: maç merkezi
   açıkken canlı maçın skoru, olayları ve istatistikleri DONUYORDU. Artık maçın
   fazına göre TTL uygulanır ve canlı maçta arka planda periyodik yenileme yapılır.
   Supabase tarafı (kadro, sakat, model tahmini) daha yavaş değiştiği için ayrı,
   daha uzun bir TTL ile yenilenir; her turda 5 sorgu birden atılmaz. */
const MC_TTL_LIVE_MS = 30000;      // canlı maç: sağlayıcı verisi 30 sn
const MC_TTL_PRE_MS = 300000;      // maç öncesi: 5 dk
const MC_TTL_POST_MS = 900000;     // maç sonrası: 15 dk
const MC_SUPABASE_TTL_MS = 180000; // kadro/sakat/model: 3 dk
let mcRefreshTimer = null;

/* Maçın hangi aşamada olduğunu tek yerden belirler. */
function mcPhase(match){
  if(!match) return 'pre';
  if(match.status === 'canlı' || match.status === 'devre_arasi') return 'live';
  if(match.status === 'bitti' || getResult(match.id)) return 'post';
  const kickoff = match.kickoff ? new Date(match.kickoff).getTime() : 0;
  if(kickoff && Date.now() > kickoff + 3 * 60 * 60 * 1000) return 'post';
  if(kickoff && Date.now() >= kickoff) return 'live';
  return 'pre';
}

function mcTtlFor(match){
  const phase = mcPhase(match);
  return phase === 'live' ? MC_TTL_LIVE_MS : phase === 'post' ? MC_TTL_POST_MS : MC_TTL_PRE_MS;
}

/* Canlı maçta arka plan yenilemesini kurar; diğer fazlarda durdurur. */
function mcScheduleRefresh(){
  if(mcRefreshTimer){ clearInterval(mcRefreshTimer); mcRefreshTimer = null; }
  const match = MATCHES.find(item => item.id === mcMatchId);
  if(!match || mcPhase(match) !== 'live') return;
  mcRefreshTimer = setInterval(async () => {
    // Sekme arka plandaysa boşuna istek atma.
    if(document.hidden) return;
    const current = MATCHES.find(item => item.id === mcMatchId);
    if(!current || mcPhase(current) !== 'live'){ mcScheduleRefresh(); return; }
    try{
      await ensureMcData(mcMatchId);
      renderMcHeader(current);
      renderMcTab();
    }catch(_error){ /* yenileme hatası sessizce yutulur; eldeki veri korunur */ }
  }, MC_TTL_LIVE_MS);
}

async function ensureMcData(matchId){
  const cached = mcCache[matchId];
  if(cached && cached.loaded){
    const match = MATCHES.find(item => item.id === matchId);
    const age = Date.now() - (cached.fetchedAt || 0);
    if(age < mcTtlFor(match)) return cached;
    // Suresi dolmus: saglayici verisi mutlaka, Supabase verisi kendi TTL suresine gore
    // yenilenir. Yenileme sırasında eldeki veri ekranda kalmaya devam eder.
    cached.refreshing = true;
  }
  const entry = { lineups:[], absences:[], events:[], statistics:[], provider:null, modelPred:null, consensus:null, errors:{}, loaded:false };
  const providerPromise=String(matchId).startsWith('sportmonks:')?fetch(`/api/football/fixture?id=${encodeURIComponent(matchId)}`,{headers:{Accept:'application/json'}}).then(async response=>{ const payload=await response.json().catch(()=>({})); if(!response.ok) throw new Error(payload.error||'fixture_unavailable'); return payload; }).catch(error=>({error:error.message||'fixture_unavailable'})):Promise.resolve(null);
  // Supabase tarafi kendi TTL suresi dolmadiysa tekrar sorgulanmaz (canli yenilemede
  // 30 saniyede bir 5 sorgu yerine yalnizca saglayici cagrisi yapilir).
  const previous = mcCache[matchId];
  const supabaseFresh = previous && previous.loaded && (Date.now() - (previous.supabaseFetchedAt || 0) < MC_SUPABASE_TTL_MS);
  const skip = () => Promise.resolve({ data:null, error:null, skipped:true });
  const [lineupsRes, absencesRes, modelRes, consensusRes, providerRes] = await Promise.all([
    supabaseFresh ? skip() : mcQuery(sb.from('match_lineups').select('*').eq('match_id', matchId), 'match_lineups'),
    supabaseFresh ? skip() : mcQuery(sb.from('match_absences').select('*').eq('match_id', matchId), 'match_absences'),
    supabaseFresh ? skip() : mcQuery(sb.from('model_predictions').select('*').eq('match_id', matchId).maybeSingle(), 'model_predictions'),
    supabaseFresh ? skip() : mcQuery(sb.rpc('get_match_prediction_consensus', { p_match_id: matchId }), 'prediction_consensus'),
    providerPromise
  ]);
  // Atlanan (skipped) sorgularda önceki değer korunur, sıfırlanmaz.
  entry.lineups = lineupsRes.skipped ? (previous?.lineups || []) : (Array.isArray(lineupsRes.data) ? lineupsRes.data : []);
  entry.absences = absencesRes.skipped ? (previous?.absences || []) : (Array.isArray(absencesRes.data) ? absencesRes.data : []);
  entry.modelPred = modelRes.skipped ? (previous?.modelPred || null) : (modelRes.data || null);
  entry.consensus = consensusRes.skipped ? (previous?.consensus || null) : (Array.isArray(consensusRes.data) ? (consensusRes.data[0] || null) : null);
  entry.supabaseFetchedAt = supabaseFresh ? (previous?.supabaseFetchedAt || Date.now()) : Date.now();
  if(providerRes?.details){
    const details=providerRes.details; entry.provider=providerRes;
    if(!entry.lineups.length) entry.lineups=Array.isArray(details.lineups)?details.lineups:[];
    if(!entry.absences.length) entry.absences=Array.isArray(details.absences)?details.absences:[];
    entry.events=Array.isArray(details.events)?details.events:[];
    entry.statistics=Array.isArray(details.statistics)?details.statistics:[];
    const match=MATCHES.find(item=>item.id===matchId);
    if(match){
      if(details.venue?.name) match.stadyum=details.venue.name;
      if(details.referee?.name) match.referee_name=details.referee.name;
      if(details.weather) match.weather={sicaklik:details.weather.temperature??details.weather.temp??details.weather.temperature_celsius??null,yagis_ihtimali:details.weather.chance_of_rain??details.weather.rain_chance??null};
    }
  }else if(providerRes?.error) entry.errors.provider=providerRes.error;
  if(lineupsRes.error) entry.errors.lineups=lineupsRes.error;
  if(absencesRes.error) entry.errors.absences=absencesRes.error;
  if(modelRes.error) entry.errors.model=modelRes.error;
  if(consensusRes.error) entry.errors.consensus=consensusRes.error;
  // Sağlayıcı çağrısı başarısız olduysa eldeki eski veriyi koru (boş ekran yerine).
  if(providerRes?.error && previous?.provider){
    entry.provider = previous.provider;
    if(!entry.events.length) entry.events = previous.events || [];
    if(!entry.statistics.length) entry.statistics = previous.statistics || [];
    entry.stale = true;
  }
  entry.loaded = true;
  entry.fetchedAt = Date.now();
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
  renderMcHeader(m);
  renderMcTab();
  mcScheduleRefresh();
}
function closeMatchCenter(updateUrl){
  const shouldNavigateBack = updateUrl !== false && !!mcOriginHash && location.hash.startsWith('#match/');
  // Panel kapanınca arka plan yenilemesi durmalı; aksi halde görünmeyen bir maç
  // icin sonsuza kadar 30 saniyede bir istek atilir.
  if(mcRefreshTimer){ clearInterval(mcRefreshTimer); mcRefreshTimer = null; }
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
  const result=getResult(m.id); const tournament=m.competition || m.tournament || m.league_name || 'Seçili lig';
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
  const cached=mcCache[m.id];
  if(cached?.statistics?.length){
    const labels=[...new Set(cached.statistics.map(row=>row.label))].slice(0,14);
    const value=(team,label)=>cached.statistics.find(row=>row.team===team&&row.label===label)?.value ?? '—';
    const compare=(label,home,away)=>`<div class="mc-vs-grid"><div class="val">${escapeHTML(home)}</div><div class="lbl">${escapeHTML(label)}</div><div class="val">${escapeHTML(away)}</div></div>`;
    document.getElementById('mcBody').innerHTML=`<section class="mc-section"><div class="mc-section-title">Canlı maç istatistikleri</div>${labels.map(label=>compare(label,value(m.ev,label),value(m.konuk,label))).join('')}</section><div class="source-line">Kaynak: Sportmonks Football API · Maç sağlayıcı kaydı</div>`;
    return;
  }
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
  ensureMcData(m.id).then(data=>{
    if(mcMatchId!==m.id || mcTab!=='flow') return;
    if(!data.events.length){ document.getElementById('mcBody').innerHTML = `<div class="mc-empty">Maç henüz başlamadıysa olay akışı doğal olarak boştur. Başladıktan sonra gol, kart ve değişiklikler Sportmonks üzerinden burada akar.</div>`; return; }
    const events=[...data.events].sort((a,b)=>Number(a.minute||0)-Number(b.minute||0));
    document.getElementById('mcBody').innerHTML=`<section class="mc-section"><div class="mc-section-title">Maç akışı</div>${events.map(event=>`<div class="mc-lineup-row"><span><b>${escapeHTML(event.minute!=null?event.minute+"'":'—')}</b> · ${escapeHTML(event.type||'Olay')} · ${escapeHTML(event.player||event.team||'')}</span><span class="mono">${escapeHTML(event.result||event.team||'')}</span></div>`).join('')}</section><div class="source-line">Kaynak: Sportmonks Football API</div>`;
  });
  document.getElementById('mcBody').innerHTML = `<div class="mc-empty">Sportmonks maç akışı yükleniyor…</div>`;
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
/* Topluluk tahmin dagilimi.
   get_match_prediction_consensus RPC'si ensureMcData icinde ZATEN cekiliyordu
   ama hicbir yerde render edilmiyordu. RPC bireysel tahminleri degil yalnizca
   toplam ve yuzdeleri dondurur (security definer, kickoff-15dk sonrasi acilir),
   bu yuzden gizlilik davranisi degismeden anonim dagilim gosterilebilir. */
function mcConsensusHTML(entry){
  const consensus = entry && entry.consensus;
  const total = Number(consensus && consensus.total ? consensus.total : 0);
  if(!consensus || !total){
    return '<div class="mc-empty">Toplu tahmin dagilimi, tahmin penceresi kapandiktan sonra ve yeterli katilim olustugunda gosterilir.</div>';
  }
  const rows = [
    { key:'1', label:'Ev sahibi', count:Number(consensus.home_count||0), pct:Number(consensus.home_pct||0) },
    { key:'X', label:'Beraberlik', count:Number(consensus.draw_count||0), pct:Number(consensus.draw_pct||0) },
    { key:'2', label:'Deplasman', count:Number(consensus.away_count||0), pct:Number(consensus.away_pct||0) },
  ];
  const lead = rows.slice().sort((a,b)=>b.pct-a.pct)[0];
  return `<section class="mc-section">
    <div class="mc-section-title">Topluluk dagilimi</div>
    <div class="mc-consensus">
      ${rows.map(row=>`<div class="mc-consensus-row ${row.key===lead.key?'is-lead':''}">
        <span class="mc-consensus-key">${escapeHTML(row.key)}</span>
        <span class="mc-consensus-label">${escapeHTML(row.label)}</span>
        <span class="mc-consensus-bar"><i style="width:${Math.max(0,Math.min(100,row.pct)).toFixed(1)}%"></i></span>
        <b>%${row.pct.toFixed(0)}</b>
        <small>${row.count}</small>
      </div>`).join('')}
    </div>
    <div class="mc-consensus-foot">${total} tahmin</div>
  </section>`;
}
function renderMcCommunity(m){
  const user=getCurrentUser(); const own=user && ALL_PREDICTIONS[m.id] ? ALL_PREDICTIONS[m.id][user.id] : null;
  const entry=mcCache[m.id];
  const privacyNote='<div class="mc-consensus-privacy">Diğer kullanıcıların bireysel tahminleri gösterilmez; yalnızca anonim toplu dağılım yayınlanır.</div>';
  document.getElementById('mcBody').innerHTML=`${own?`<section class="mc-section"><div class="mc-section-title">Senin tahminin</div><div class="mc-result-card"><div class="pts">${escapeHTML(own.pick)}${own.scoreHome!=null?` · ${escapeHTML(own.scoreHome)}–${escapeHTML(own.scoreAway)}`:''}</div></div></section>`:''}${mcConsensusHTML(entry)}${privacyNote}`;
}
