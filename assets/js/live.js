/* ===================== YARDIMCI RENDER ===================== */
function fmtKickoff(iso){ const d = new Date(iso); return d.toLocaleDateString('tr-TR',{day:'2-digit',month:'long'}) + ' · ' + d.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}); }
function fmtTime(iso){ return new Date(iso).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}); }
function fmtDateHeading(iso){ const s = new Date(iso).toLocaleDateString('tr-TR',{weekday:'long',day:'2-digit',month:'long'}); return s.charAt(0).toUpperCase()+s.slice(1); }
function isLocked(iso){ return Date.now() >= (new Date(iso).getTime() - 15*60000); }
function analysisCompleteness(a){ if(!a) return 0; return ANALYSIS_FIELDS.filter(([k])=>a[k]).length; }
function crestInitials(team){ return team ? team.slice(0,2).toUpperCase() : '??'; }
function crestColor(team){ return TEAM_COLORS[team] || 'var(--other)'; }
function crestHTML(team, size='sm'){
  const src = TEAM_CRESTS[team];
  const initials = escapeHTML(crestInitials(team));
  const safeTeam = escapeHTML(team);
  return `<div class="shield ${size}" style="background:${crestColor(team)};"><span>${initials}</span>${src ? `<img src="${src}" alt="${safeTeam} arması" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</div>`;
}
function groupByDate(matches){
  const groups = {};
  matches.forEach(m=>{ const key = fmtDateHeading(m.kickoff); if(!groups[key]) groups[key]=[]; groups[key].push(m); });
  return groups;
}

/* ===================== HAFTA SİSTEMİ ===================== */
function getAvailableWeeks(){ return [...new Set(MATCHES.filter(matchInActiveLeague).map(m=>m.hafta))].sort((a,b)=>a-b); }
function weekMatches(w){ return MATCHES.filter(m=>m.hafta===w && matchInActiveLeague(m)); }
function weekStatus(w){
  const ms = weekMatches(w);
  if(!ms.length) return { key:'none', text:'Bu hafta için fikstür henüz eklenmedi.' };
  const now = Date.now();
  const withResult = ms.filter(m => getResult(m.id));
  const cancelled = ms.filter(m => m.status==='iptal');
  const playable = ms.filter(m => m.status!=='iptal' && m.status!=='ertelendi');
  const started = playable.filter(m => now >= new Date(m.kickoff).getTime());
  const live = playable.filter(m => (m.status==='canlı' || m.status==='devre_arasi') && !getResult(m.id));
  if(withResult.length + cancelled.length === ms.length){
    return { key:'completed', text: cancelled.length ? `Hafta tamamlandı (${cancelled.length} maç iptal).` : 'Hafta tamamlandı.' };
  }
  if(!playable.length) return { key:'pending', text:'Bu haftadaki maçların yeni programı bekleniyor.' };
  if(started.length === 0){
    const firstKickoff = Math.min(...playable.map(m=>new Date(m.kickoff).getTime()));
    const days = Math.ceil((firstKickoff-now)/86400000);
    return { key:'upcoming', text: days>0 ? `Bu haftanın ilk maçına ${days} gün kaldı.` : 'Bu haftanın ilk maçı bugün.' };
  }
  let text = `${ms.length} maçın ${withResult.length}'i tamamlandı`;
  if(live.length>0) text += `, ${live.length} maç canlı`;
  text += '.';
  return { key:'ongoing', text };
}
function parseHash(){
  const h = (location.hash || '').replace('#','');
  if(h.startsWith('week/')) return { type:'week', value: parseInt(h.split('/')[1],10) };
  if(h.startsWith('match/')) return { type:'match', value: h.split('/')[1] };
  if(h==='matches') return { type:'football-section', value:'matches' };
  if(h==='agenda') return { type:'football-section', value:'news' };
  if(h==='clubs') return { type:'football-section', value:'clubs' };
  if(h==='standings') return { type:'football-section', value:'standings' };
  if(h==='transfers' || h.startsWith('transfers/')) return { type:'football-section', value:'transfers', sub:h.split('/')[1] || 'confirmed' };
  if(['football','story','stories','live'].includes(h)) return { type:'product', value:'football' };
  if(['predict','league','leader','rewards','profile'].includes(h)) return { type:'product', value:'predict' };
  return null;
}
function updateHash(newHash){ if(location.hash !== '#'+newHash) history.pushState(null,'','#'+newHash); }
function goToWeek(w, updateUrl){
  const weeks = getAvailableWeeks(); if(!weeks.length) return;
  if(w < weeks[0]) w = weeks[0]; if(w > weeks[weeks.length-1]) w = weeks[weeks.length-1];
  activeWeek = w;
  if(updateUrl !== false) updateHash('week/'+w);
  renderAll();
  if(serverLeaderboardMode==='server'){
    primeServerLeaderboards(w).then(ready=>{
      if(!ready || activeWeek!==w) return;
      renderProgress();
      renderLeaderTable();
      renderTeamBanner();
    });
  }
}
function prevWeek(){ goToWeek(activeWeek-1); }
function nextWeek(){ goToWeek(activeWeek+1); }
function onWeekPickerChange(sel){ goToWeek(parseInt(sel.value,10)); }
window.addEventListener('hashchange', ()=>{
  const parsed = parseHash();
  if(parsed && parsed.type==='match'){ openMatchCenter(parsed.value, false); }
  else if(parsed && parsed.type==='week'){ if(mcMatchId) closeMatchCenter(false); goToWeek(parsed.value, false); }
  else if(parsed && parsed.type==='football-section'){ if(mcMatchId) closeMatchCenter(false); switchMainTab('football',false); if(parsed.value==='transfers') setTransferCenterTab(parsed.sub||'confirmed',null,false); openFootballSection(parsed.value,null,false); }
  else if(parsed && parsed.type==='product'){ if(mcMatchId) closeMatchCenter(false); switchMainTab(parsed.value, false); }
  else { if(mcMatchId) closeMatchCenter(false); }
});
function renderWeekSelector(){
  const weeks = getAvailableWeeks();
  const el = document.getElementById('weekSelector'); if(!el) return;
  if(!weeks.length){ el.innerHTML = ''; return; }
  const st = weekStatus(activeWeek);
  el.innerHTML = `
    <div class="week-nav">
      <button class="btn ghost week-arrow" ${activeWeek<=weeks[0]?'disabled':''} onclick="prevWeek()" aria-label="Önceki hafta">←</button>
      <select class="week-picker" onchange="onWeekPickerChange(this)" aria-label="Hafta seç">
        ${weeks.map(w=>`<option value="${w}" ${w===activeWeek?'selected':''}>${w}. Hafta</option>`).join('')}
      </select>
      <button class="btn ghost week-arrow" ${activeWeek>=weeks[weeks.length-1]?'disabled':''} onclick="nextWeek()" aria-label="Sonraki hafta">→</button>
    </div>
    <div class="week-status mono">${st.text}</div>
  `;
  const statusLine = document.getElementById('dataStatusLine');
  if(statusLine){
    if(DATA_ERRORS.matches) statusLine.textContent = 'Fikstür verisi şu anda alınamıyor; diğer modüller bağımsız çalışmaya devam ediyor.';
    else if(MATCHES.length) statusLine.textContent = `Yayınlanmış fikstür verisi · Son kontrol: ${VERIFIED.kontrol}`;
    else statusLine.textContent = 'Yayınlanmış fikstür kaydı bulunmuyor.';
  }
}

/* ===================== CANLI ŞERİT (sıradaki maç sayacı) ===================== */
function nextUpcomingMatch(){
  const now = Date.now();
  return MATCHES.filter(m => matchInActiveLeague(m) && m.status!=='iptal' && m.status!=='ertelendi' && new Date(m.kickoff).getTime() > now).sort((a,b)=> new Date(a.kickoff)-new Date(b.kickoff))[0] || null;
}
function updateTickerCountdown(m){
  const el = document.getElementById('tickerCountdown'); if(!el) return;
  const diff = new Date(m.kickoff).getTime() - Date.now();
  if(diff<=0){ el.textContent = 'Başladı'; return; }
  const h = Math.floor(diff/3600000), mnt = Math.floor((diff%3600000)/60000);
  el.textContent = h>0 ? `${h} sa ${mnt} dk kaldı` : `${mnt} dk kaldı`;
}
function renderTicker(){
  const el = document.getElementById('liveTicker'); const m = nextUpcomingMatch();
  if(lastLoadError || DATA_ERRORS.matches){ el.innerHTML = `<span class="ticker-dot" style="background:var(--danger);"></span><span class="ticker-label" style="color:var(--danger);">HATA</span><span class="ticker-match">Fikstür verileri şu anda alınamıyor</span>`; return; }
  if(!MATCHES.length){ el.innerHTML = `<span class="ticker-dot"></span><span class="ticker-label">FİKSTÜR</span><span class="ticker-match">Henüz fikstür eklenmedi</span>`; return; }
  if(!m){ const lastW = getAvailableWeeks().slice(-1)[0]; el.innerHTML = `<span class="ticker-dot"></span><span class="ticker-label">FİKSTÜR</span><span class="ticker-match">${lastW}. haftaya kadar tüm maçlar tamamlandı</span>`; return; }
  el.innerHTML = `<span class="ticker-dot"></span><span class="ticker-label">SIRADAKİ MAÇ</span><span class="ticker-match">${escapeHTML(m.ev)} — ${escapeHTML(m.konuk)}</span><span class="ticker-time mono" id="tickerCountdown"></span>`;
  updateTickerCountdown(m);
  if(!tickerHandle){ tickerHandle = setInterval(()=>{ const nm = nextUpcomingMatch(); if(nm) updateTickerCountdown(nm); }, 30000); }
}

/* ===================== CANLI VERİ SAĞLAYICI KATMANI ===================== */
function escapeLiveHTML(value){
  return String(value ?? '').replace(/[&<>'"]/g, char=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}
function safeLiveImage(value){
  try{
    const url = new URL(String(value || ''));
    return url.protocol==='https:' ? url.href : '';
  }catch(_){ return ''; }
}
function liveTeamMark(team){
  const logo = safeLiveImage(team && team.logo);
  const name = escapeLiveHTML(team && team.name ? team.name : 'Takım adı alınamadı');
  if(logo) return `<img src="${logo}" alt="${name} arması" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`;
  return `<span class="fallback-crest">${name.slice(0,2).toLocaleUpperCase('tr-TR')}</span>`;
}
function liveStatusView(match){
  const minute = Number.isFinite(Number(match.minute)) ? Math.max(0, Math.round(Number(match.minute))) : null;
  if(match.status==='halftime') return { badge:'DEVRE', detail:'Devre arası', live:true };
  if(match.status==='live') return { badge:minute!==null ? `${minute}'` : 'CANLI', detail:'Maç oynanıyor', live:true };
  if(match.status==='finished') return { badge:'MS', detail:'Maç sona erdi', live:false };
  const kickoff = match.startedAt ? new Date(match.startedAt) : null;
  return { badge:kickoff && !Number.isNaN(kickoff.getTime()) ? kickoff.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}) : '—', detail:'Başlamadı', live:false };
}
function renderLiveFeed(){
  const list = document.getElementById('liveScoreList');
  const freshness = document.getElementById('liveFreshness');
  const providerState = document.getElementById('liveProviderState');
  const refreshBtn = document.getElementById('liveRefreshBtn');
  if(!list) return;
  if(refreshBtn) refreshBtn.disabled = liveFeedLoading;
  if(liveFeedLoading && !LIVE_FEED.loaded){
    list.innerHTML = `<div class="live-notice"><strong>Canlı maçlar kontrol ediliyor</strong><p>Seçili liglerdeki en güncel maç verisi alınıyor…</p></div>`;
    if(freshness) freshness.textContent='Güncelleniyor…';
    return;
  }
  if(LIVE_FEED.error && !LIVE_FEED.matches.length){
    list.innerHTML = `<div class="live-notice"><strong>Canlı veri şu anda alınamıyor</strong><p>Bağlantı güvenli sunucu katmanında kuruluyor. Biraz sonra yeniden deneyin; eski veya tahmini skor gösterilmeyecek.</p></div>`;
    if(freshness) freshness.textContent='Bağlantı kurulamadı';
    if(providerState) providerState.textContent='Canlı kaynak bekleniyor';
    return;
  }
  const visibleMatches = LIVE_FEED.matches.filter(match=>activeFootballLeague==='all' || competitionSlug(match.competition)===activeFootballLeague);
  if(!visibleMatches.length){
    list.innerHTML = `<div class="live-notice"><strong>Şu anda seçili liglerde canlı maç yok</strong><p>Canlı karşılaşma başladığında skor, dakika ve maç durumu bu ekrana otomatik olarak düşecek.</p></div>`;
  }else{
    list.innerHTML = visibleMatches.map(match=>{
      const view = liveStatusView(match);
      const home = match.home || {}, away = match.away || {};
      const homeScore = home.score===null || home.score===undefined ? '—' : escapeLiveHTML(home.score);
      const awayScore = away.score===null || away.score===undefined ? '—' : escapeLiveHTML(away.score);
      return `<article class="live-card ${view.live?'is-live':''}">
        <div class="live-competition">${safeLiveImage(match.competitionLogo)?`<img src="${safeLiveImage(match.competitionLogo)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}<span>${escapeLiveHTML(match.competition || 'Seçili lig')}</span></div>
        <div class="live-teams">
          <div class="live-team">${liveTeamMark(home)}<span>${escapeLiveHTML(home.name || 'Takım adı alınamadı')}</span><span class="live-score">${homeScore}</span></div>
          <div class="live-team">${liveTeamMark(away)}<span>${escapeLiveHTML(away.name || 'Takım adı alınamadı')}</span><span class="live-score">${awayScore}</span></div>
        </div>
        <div class="live-state"><span class="live-minute">${view.live?'<span class="live-dot"></span>':''}${view.badge}</span><span class="live-state-label">${view.detail}</span></div>
      </article>`;
    }).join('');
  }
  if(freshness){
    const updated = LIVE_FEED.updatedAt ? new Date(LIVE_FEED.updatedAt) : null;
    freshness.textContent = updated && !Number.isNaN(updated.getTime()) ? `Son kontrol ${updated.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}` : 'Canlı bağlantı etkin';
  }
  if(providerState) providerState.textContent = LIVE_FEED.stale ? 'Son doğrulanmış veri gösteriliyor' : 'Canlı bağlantı etkin';
}
function refreshLiveProviderLabel(){
  const key = typeof footballLeagueRequestKey === 'function' ? footballLeagueRequestKey() : activeFootballLeague;
  const label = typeof competitionLabelBySlug === 'function' ? competitionLabelBySlug(key) : 'Seçili lig';
  const eyebrow = document.getElementById('liveCompetitionLabel');
  const title = document.querySelector('#page-live .live-head h2');
  if(eyebrow) eyebrow.textContent = `${label.toLocaleUpperCase('tr-TR')} · GERÇEK ZAMANLI`;
  if(title) title.textContent = `${label} Maç Merkezi`;
}
async function refreshLiveProviderHealth(){
  const state = document.getElementById('liveProviderState');
  if(!state) return;
  try{
    const response = await fetch('/api/health',{headers:{Accept:'application/json'},cache:'no-store'});
    const payload = await response.json().catch(()=>null);
    const status = payload?.checks?.sportmonks_live;
    state.textContent = status === 'configured' ? 'Sportmonks · canlı bağlantı hazır' : 'Sportmonks · bağlantı anahtarı bekleniyor';
  }catch(_error){ state.textContent = 'Canlı sağlayıcı durumu kontrol edilemedi'; }
}
async function loadLiveFeed(force){
  if(liveFeedLoading) return;
  refreshLiveProviderLabel();
  liveFeedLoading = true;
  renderLiveFeed();
  try{
    const league = typeof footballLeagueRequestKey === 'function' ? footballLeagueRequestKey() : activeFootballLeague;
    let data = null;
    let error = null;
    try{
      const result = await sb.functions.invoke(LIVE_FEED_CONFIG.functionName, { body:{ scope:LIVE_FEED_CONFIG.scope, league, force:!!force } });
      data = result.data; error = result.error;
    }catch(functionError){ error = functionError; }
    if(error || !data || !Array.isArray(data.matches)){
      const response = await fetch(`/api/football/live?league=${encodeURIComponent(league)}`,{headers:{Accept:'application/json'},cache:'no-store'});
      const providerData = await response.json().catch(()=>null);
      if(!response.ok || !providerData || !Array.isArray(providerData.matches)) throw error || new Error(providerData?.error || 'Canlı veri yanıtı geçersiz.');
      data = providerData;
    }
    if(!data || !Array.isArray(data.matches)) throw new Error('Canlı veri yanıtı geçersiz.');
    LIVE_FEED = { matches:data.matches, updatedAt:data.updatedAt || new Date().toISOString(), stale:!!data.stale, error:null, loaded:true };
    data.matches.forEach(liveMatch=>{
      const stored=MATCHES.find(match=>match.id===liveMatch.id); if(!stored) return;
      stored.status=liveMatch.status==='halftime'?'devre_arasi':(liveMatch.status==='live'?'canlı':(liveMatch.status==='finished'?'bitti':stored.status));
      if(liveMatch.status==='finished' && liveMatch.home && liveMatch.away && liveMatch.home.score!=null && liveMatch.away.score!=null){
        ALL_RESULTS[liveMatch.id]={ home:Number(liveMatch.home.score), away:Number(liveMatch.away.score), scoredAt:Date.now() };
      }
    });
  }catch(error){
    console.warn('[XYZSkor canlı veri]', error);
    LIVE_FEED = { ...LIVE_FEED, error:error && error.message ? error.message : 'Bağlantı hatası', loaded:true, stale:LIVE_FEED.matches.length>0 };
  }finally{
    liveFeedLoading = false;
    renderLiveFeed();
    renderFootballQuickMatches();
  }
}
function startLiveFeed(){
  refreshLiveProviderLabel();
  refreshLiveProviderHealth();
  loadLiveFeed(false);
  if(!liveFeedHandle) liveFeedHandle = setInterval(()=>loadLiveFeed(false), LIVE_FEED_CONFIG.refreshMs);
}
function stopLiveFeed(){
  if(liveFeedHandle){ clearInterval(liveFeedHandle); liveFeedHandle=null; }
}

/* ===================== MAIN TAB SWITCH ===================== */
function switchMainTab(name, updateUrl){
  const product = ['league','predict'].includes(name) ? 'predict' : 'football';
  document.getElementById('page-story').classList.toggle('active', product==='football');
  document.getElementById('page-league').classList.toggle('active', product==='predict');
  document.getElementById('page-live').classList.toggle('active', product==='football');
  document.getElementById('tabBtnFootball').classList.toggle('active', product==='football');
  document.getElementById('tabBtnPredict').classList.toggle('active', product==='predict');
  const footballContextNav=document.getElementById('footballContextNav');
  if(footballContextNav) footballContextNav.hidden=product!=='football';
  const footballLeagueCommand=document.getElementById('footballLeagueCommand');
  if(footballLeagueCommand) footballLeagueCommand.hidden=product!=='football';
  if(product==='football' && name==='football' && typeof openFootballSection==='function') openFootballSection('home',null,false);
  if(product==='football') startLiveFeed(); else stopLiveFeed();
  if(updateUrl !== false && ['football','predict'].includes(name)) updateHash(product);
  updateMobileNavActive();
}
function openStories(){
  switchMainTab('football');
  const target=document.getElementById('weeklyStoryArea');
  if(target) target.scrollIntoView({behavior:'smooth',block:'start'});
}

/* ===================== LİG İÇİ SEKMELER ===================== */
let activeLeagueSection = 'predict';
function switchLeagueSection(name){
  activeLeagueSection = name;
  ['predict','standings','leader','rewards','profile','admin'].forEach(n=>{
    const section = document.getElementById('lsec-'+n); if(section) section.classList.toggle('active', n===name);
    const btn = document.getElementById('lst-'+n); if(btn) btn.classList.toggle('active', n===name);
  });
  updateMobileNavActive();
}

/* ===================== MOBİL ALT NAVİGASYON ===================== */
function mbnGo(key){
  if(['football','story','live'].includes(key)){ switchMainTab('football'); }
  else if(['predict','leader'].includes(key)){ switchMainTab('predict'); switchLeagueSection(key==='leader'?'leader':'predict'); }
  else if(key==='profile'){ openAccount(); }
  window.scrollTo({top:0, behavior:'smooth'});
}
function updateMobileNavActive(){
  const footballActive = document.getElementById('page-story').classList.contains('active');
  const leagueActive = document.getElementById('page-league').classList.contains('active');
  const map = {
    'mbn-football': footballActive,
    'mbn-predict': leagueActive
  };
  Object.entries(map).forEach(([id, active])=>{
    const el = document.getElementById(id); if(el) el.classList.toggle('active', !!active);
  });
}
