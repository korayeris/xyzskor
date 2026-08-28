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
function weekMatches(w){
  const predictOpen=document.getElementById('page-league')?.classList.contains('active');
  if(predictOpen && PREDICT_CHALLENGE_MATCHES.length) return PREDICT_CHALLENGE_MATCHES.filter(m=>m.hafta===w);
  return MATCHES.filter(m=>m.hafta===w && matchInActiveLeague(m));
}
function weekStatus(w){
  const ms = weekMatches(w);
  if(!ms.length) return { key:'none', text:'Bu hafta için fikstür henüz eklenmedi.' };
  const now = Date.now();
  const withResult = ms.filter(m => getResult(m.id));
  const cancelled = ms.filter(m => normalizeClientFootballStatus(m.status)==='cancelled');
  const playable = ms.filter(m => !footballStatusIsUnavailable(m));
  const started = playable.filter(m => now >= new Date(m.kickoff).getTime());
  const live = playable.filter(m => footballStatusIsLive(m) && !getResult(m.id));
  if(withResult.length + cancelled.length === ms.length){
    return { key:'completed', text: cancelled.length ? `Hafta tamamlandı (${cancelled.length} maç iptal).` : 'Hafta tamamlandı.' };
  }
  if(!playable.length) return { key:'pending', text:'Bu haftadaki maçların resmî program güncellemesi bekleniyor.' };
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
function normalizeTransferRouteTab(value){
  return ['confirmed','talks','rumours'].includes(value) ? value : 'confirmed';
}
function normalizeFootballSectionSegment(value){
  if(value==='matches') return 'matches';
  if(value==='agenda' || value==='news') return 'news';
  if(value==='clubs') return 'clubs';
  if(value==='transfers') return 'transfers';
  if(value==='standings' || value==='puan-durumu') return 'standings';
  return 'home';
}
function validFootballLeagueKey(value){
  return SELECTED_COMPETITIONS.some(item=>item.key===value) ? value : 'super-lig';
}
function buildFootballPath(league, section, transferTab, clubSlug){
  const safeLeague = validFootballLeagueKey(league);
  const safeSection = ['home','matches','news','clubs','transfers','standings'].includes(section) ? section : 'home';
  const base = safeLeague==='all' ? '/all' : `/${safeLeague}`;
  if(safeSection==='home') return safeLeague==='all' ? '/' : base;
  if(safeSection==='transfers'){
    const safeTransferTab = normalizeTransferRouteTab(transferTab);
    return safeTransferTab==='confirmed' ? `${base}/transfers` : `${base}/transfers/${safeTransferTab}`;
  }
  if(safeSection==='clubs' && clubSlug) return `${base}/clubs/${encodeURIComponent(clubSlug)}`;
  const segmentMap = { matches:'matches', news:'agenda', clubs:'clubs', standings:'standings' };
  return `${base}/${segmentMap[safeSection] || ''}`.replace(/\/+$/,'');
}
const FOOTBALL_RETURN_PATH_KEY='xyzskor:football-return-path:v1';
function rememberFootballReturnPath(){
  const current=(location.pathname||'/').replace(/\/+$/,'')||'/';
  let target='';
  if(current==='/'||current==='/index.html'||current==='/futbol'||current==='/all') target='/';
  else if(/^\/(super-lig|premier-league|la-liga|bundesliga|serie-a)(?:\/|$)/.test(current)) target=current;
  else if(current.startsWith('/football')) target=current;
  if(!target) return '';
  try{ sessionStorage.setItem(FOOTBALL_RETURN_PATH_KEY,target); }catch(_error){}
  return target;
}
function storedFootballReturnPath(){
  let stored='';
  try{ stored=sessionStorage.getItem(FOOTBALL_RETURN_PATH_KEY)||''; }catch(_error){}
  if(stored==='/') return '/';
  if(!/^\/(?:futbol(?:\/|$)|all(?:\/|$)|football(?:\/|$)|super-lig(?:\/|$)|premier-league(?:\/|$)|la-liga(?:\/|$)|bundesliga(?:\/|$)|serie-a(?:\/|$))/.test(stored)) return '';
  return /^\/(?:futbol|all)\/?$/.test(stored) ? '/' : stored;
}
if(typeof window!=='undefined') window.rememberXYZFootballReturnPath=rememberFootballReturnPath;
function buildProductPath(name){
  const product = ['league','predict'].includes(name) ? 'predict' : 'football';
  if(product==='predict'){
    const section=typeof activeLeagueSection!=='undefined' ? activeLeagueSection : 'predict';
    return section==='predict' ? '/predict' : `/predict/${section}`;
  }
  if(/^\/predict(?:\/|$)/.test(location.pathname||'')){
    const remembered=storedFootballReturnPath();
    if(remembered) return remembered;
  }
  return buildFootballPath(activeFootballLeague, typeof activeFootballSection!=='undefined' ? activeFootballSection : 'home', typeof activeTransferCenterTab!=='undefined' ? activeTransferCenterTab : 'confirmed');
}
function updatePath(pathname, replace){
  const targetPath = pathname && pathname.startsWith('/') ? pathname : `/${String(pathname || '').replace(/^\/+/,'')}`;
  if(location.pathname===targetPath && !location.hash) return;
  history[replace ? 'replaceState' : 'pushState'](null,'',targetPath);
  if(window.XYZBranchRouter?.syncMetadata) window.XYZBranchRouter.syncMetadata(location.pathname,location.search);
}
function parseLegacyHash(){
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
function parseAppLocation(){
  const legacy = parseLegacyHash();
  if(legacy && ['week','match'].includes(legacy.type)) return legacy;
  const pathname = (location.pathname || '/').replace(/\/+$/,'') || '/';
  const segments = pathname.split('/').filter(Boolean);
  // `/`, `/futbol` ve geriye donuk `/all` ayni bes ligli futbol merkezidir.
  if(!segments.length || segments[0]==='index.html'){
    if(legacy?.type==='football-section'){
      return { type:'football-route', league:'super-lig', section:legacy.value, transferTab:legacy.sub || 'confirmed' };
    }
    if(legacy?.type==='product') return legacy;
    return { type:'football-route', league:'all', section:'home', transferTab:'confirmed' };
  }
  if(segments[0]==='futbol' || segments[0]==='all'){
    return { type:'football-route', league:'all', section:'home', transferTab:'confirmed' };
  }
  // Bu rotalar kendi branch router yuzeylerinin sahibidir. Onlari asagidaki
  // football fallback'ine dusurmek, Back/Forward sirasinda multisport mount'unun
  // hemen ardindan futbol sekmesini yeniden etkinlestiriyordu.
  if(['basketbol','voleybol','ufc','motorsports'].includes(segments[0])){
    return { type:'branch-route', value:segments[0] };
  }
  if(segments[0]==='predict'){
    const section=['predict','standings','leader','rewards','profile'].includes(segments[1]) ? segments[1] : 'predict';
    return { type:'product', value:'predict', section };
  }
  if(segments[0]==='football'){
    const section = normalizeFootballSectionSegment(segments[1]);
    return { type:'football-route', league:'super-lig', section, transferTab: section==='transfers' ? normalizeTransferRouteTab(segments[2]) : 'confirmed' };
  }
  if(SELECTED_COMPETITIONS.some(item=>item.key===segments[0])){
    const league = validFootballLeagueKey(segments[0]);
    const section = normalizeFootballSectionSegment(segments[1]);
    return { type:'football-route', league, section, clubSlug:section==='clubs' ? decodeURIComponent(segments[2]||'') : '', transferTab: section==='transfers' ? normalizeTransferRouteTab(segments[2]) : 'confirmed' };
  }
  if(legacy?.type==='football-section'){
    return { type:'football-route', league:'super-lig', section:legacy.value, transferTab:legacy.sub || 'confirmed' };
  }
  if(legacy?.type==='product') return legacy;
  return { type:'football-route', league:'super-lig', section:'home', transferTab:'confirmed' };
}
function updateHash(newHash){ if(location.hash !== '#'+newHash) history.pushState(null,'','#'+newHash); }
function goToWeek(w, updateUrl){
  const weeks = getAvailableWeeks(); if(!weeks.length) return;
  if(w < weeks[0]) w = weeks[0]; if(w > weeks[weeks.length-1]) w = weeks[weeks.length-1];
  activeWeek = w;
  if(updateUrl !== false) updateHash('week/'+w);
  renderAll();
  if(document.getElementById('page-league')?.classList.contains('active')) loadVisibleLeaderboards();
}
function prevWeek(){ goToWeek(activeWeek-1); }
function nextWeek(){ goToWeek(activeWeek+1); }
function onWeekPickerChange(sel){ goToWeek(parseInt(sel.value,10)); }
let visibleLeaderboardLoadToken=0;
async function loadVisibleLeaderboards(){
  const token=++visibleLeaderboardLoadToken;
  const requestedWeek=activeWeek;
  const userTeam=typeof getCurrentUser==='function' ? getCurrentUser()?.team : null;
  const scopes=['Genel', typeof activeTab==='string' ? activeTab : null, userTeam].filter(Boolean);
  const serverReady=await primeServerLeaderboards(requestedWeek,scopes);
  if(!serverReady) await loadLegacyLeaderboardData();
  if(token!==visibleLeaderboardLoadToken || activeWeek!==requestedWeek) return false;
  if(typeof renderProgress==='function') renderProgress();
  if(typeof renderLeaderTable==='function') renderLeaderTable();
  if(typeof renderTeamBanner==='function') renderTeamBanner();
  return true;
}
async function loadFootballLeagueSelection(leagueKey){
  const requestedLeague=SELECTED_COMPETITIONS.some(item=>item.key===leagueKey) ? leagueKey : 'super-lig';
  if(typeof document!=='undefined' && document.body) document.body.dataset.footballLeagueLoading=requestedLeague;
  activeFootballLeague=requestedLeague;
  if(typeof window!=='undefined' && typeof CustomEvent!=='undefined') window.dispatchEvent(new CustomEvent('xyz:football-league-change',{detail:{league:requestedLeague}}));
  activeFootballTeam='Tümü';
  DATA_ERRORS={};
  if(typeof document!=='undefined'&&document.body?.classList?.contains('predict-product-open')){
    try{
      await loadPredictChallengeSelection();
      if(activeFootballLeague!==requestedLeague) return false;
      if(document.body?.dataset.footballLeagueLoading===requestedLeague) delete document.body.dataset.footballLeagueLoading;
      if(typeof renderMatchesLeagueFilters==='function') renderMatchesLeagueFilters();
      return true;
    }catch(error){
      if(document.body?.dataset.footballLeagueLoading===requestedLeague) delete document.body.dataset.footballLeagueLoading;
      DATA_ERRORS.provider=error?.message||'Tahmin fiksturu yenilenemedi.';
      return false;
    }
  }
  // Yeni lig yaniti gelene kadar mevcut DOM korunur. Onceki akis tum veriyi
  // sifirlayip bos ekran render ettigi icin ag gecikmesini kullaniciya yansitiyordu.
  if(typeof renderTicker==='function') renderTicker();
  // Coverage yardımcı kontrolü ile gerçek lig verisi birbirinden bağımsızdır.
  // İkisini seri bekletmek yerine aynı anda başlatırız.
  try{
    const dataPromise=typeof loadFootballCriticalData==='function' ? loadFootballCriticalData() : loadAllData();
    await dataPromise;
    if(activeFootballLeague!==requestedLeague) return false;
    if(footballCoverageUnavailable(requestedLeague) && !MATCHES.length){
      DATA_ERRORS.coverage=footballCoverageMessage(requestedLeague);
      if(typeof document!=='undefined' && document.body?.dataset.footballLeagueLoading===requestedLeague) delete document.body.dataset.footballLeagueLoading;
      if(typeof renderAll==='function') renderAll();
      return false;
    }
    const weeks=getAvailableWeeks();
    if(weeks.length && !weeks.includes(activeWeek)) activeWeek=weeks[0];
    if(typeof document!=='undefined' && document.body?.dataset.footballLeagueLoading===requestedLeague) delete document.body.dataset.footballLeagueLoading;
    if(typeof renderFootballLeagueScope==='function') renderFootballLeagueScope();
    else if(typeof renderAll==='function') renderAll();
    return true;
  }catch(error){
    if(activeFootballLeague!==requestedLeague) return false;
    DATA_ERRORS.provider=error&&error.message?error.message:'Lig verisi yenilenemedi.';
    if(typeof document!=='undefined' && document.body?.dataset.footballLeagueLoading===requestedLeague) delete document.body.dataset.footballLeagueLoading;
    if(typeof renderAll==='function') renderAll();
    return false;
  }
}
async function applyParsedLocation(parsed){
  if(parsed && parsed.type==='branch-route'){
    if(mcMatchId) closeMatchCenter(false);
    if(typeof stopLiveFeed==='function') stopLiveFeed();
    return;
  }
  if(parsed && parsed.type==='match'){ openMatchCenter(parsed.value, false); }
  else if(parsed && parsed.type==='week'){ if(mcMatchId) closeMatchCenter(false); goToWeek(parsed.value, false); }
  else if(parsed && parsed.type==='football-route'){
    if(mcMatchId) closeMatchCenter(false);
    const leagueChanged = activeFootballLeague !== parsed.league;
    if(leagueChanged){
      await loadFootballLeagueSelection(parsed.league);
    }
    switchMainTab('football',false);
    if(parsed.section==='transfers') setTransferCenterTab(parsed.transferTab || 'confirmed',null,false);
    openFootballSection(parsed.section || 'home',null,false);
    if(parsed.section==='clubs' && parsed.clubSlug && typeof openClubProfileBySlug==='function') openClubProfileBySlug(parsed.clubSlug,false);
  }
  else if(parsed && parsed.type==='football-section'){ if(mcMatchId) closeMatchCenter(false); switchMainTab('football',false); if(parsed.value==='transfers') setTransferCenterTab(parsed.sub||'confirmed',null,false); openFootballSection(parsed.value,null,false); }
  else if(parsed && parsed.type==='product'){ if(mcMatchId) closeMatchCenter(false); switchMainTab(parsed.value, false); if(parsed.value==='predict') switchLeagueSection(parsed.section||'predict',false); }
  else { if(mcMatchId) closeMatchCenter(false); }
}
window.addEventListener('hashchange', ()=>{ applyParsedLocation(parseAppLocation()); });
window.addEventListener('popstate', ()=>{ applyParsedLocation(parseAppLocation()); });
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
    else if(MATCHES.length){
      const freshness = fixtureFreshness();
      statusLine.textContent = freshness.text;
      statusLine.classList.toggle('is-stale', freshness.stale);
    }
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
  const el = document.getElementById('liveTicker');
  const loadingLeague=document.body.dataset.footballLeagueLoading;
  if(loadingLeague){ const label=competitionLabelBySlug(loadingLeague); el.innerHTML=`<span class="ticker-dot"></span><span class="ticker-label">${escapeHTML(label)}</span><span class="ticker-match">Fikstür yükleniyor</span>`; return; }
  if(lastLoadError || DATA_ERRORS.matches){ el.innerHTML = `<span class="ticker-dot" style="background:var(--danger);"></span><span class="ticker-label" style="color:var(--danger);">HATA</span><span class="ticker-match">Fikstür verileri şu anda alınamıyor</span>`; return; }
  if(!MATCHES.length){ el.innerHTML = `<span class="ticker-dot"></span><span class="ticker-label">FİKSTÜR</span><span class="ticker-match">Henüz fikstür eklenmedi</span>`; return; }
  const now=Date.now();
  const scoped=MATCHES.filter(matchInActiveLeague).filter(m=>!footballStatusIsUnavailable(m));
  const completed=scoped.filter(m=>m.result||getResult(m.id)||footballStatusIsFinished(m)).sort((a,b)=>new Date(b.kickoff)-new Date(a.kickoff)).slice(0,3).reverse();
  const upcoming=scoped.filter(m=>!m.result&&!getResult(m.id)&&!footballStatusIsLive(m)&&new Date(m.kickoff).getTime()>now).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff)).slice(0,6);
  const agenda=[...completed,...upcoming];
  if(!agenda.length){ el.innerHTML = `<span class="ticker-match">Seçili ligde yayınlanmış maç bulunmuyor</span>`; return; }
  const logo=(src,name)=>safeLiveImage(src)?`<img src="${escapeHTML(src)}" alt="${escapeHTML(name)}" loading="lazy" onerror="this.remove()">`:'';
  const card=m=>{
    const result=m.result||getResult(m.id), finished=Boolean(result||footballStatusIsFinished(m));
    const fixtureId=String(m.provider_fixture_id||m.fixture_id||m.provider_id||m.id||'').replace(/^sportmonks:/,'');
    const when=new Date(m.kickoff);
    const date=when.toLocaleDateString('tr-TR',{day:'2-digit',month:'short'});
    const time=when.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
    return `<button class="agenda-match ${finished?'is-result':'is-upcoming'}" type="button" data-fixture-id="${escapeHTML(fixtureId)}" aria-label="${escapeHTML(m.ev)} ${escapeHTML(m.konuk)} maç merkezini aç"><span class="agenda-state">${finished?'MS':date}</span><span class="agenda-team">${logo(m.home_logo,m.ev)}<b>${escapeHTML(m.ev)}</b></span><strong class="agenda-score">${finished&&result?`${escapeHTML(result.home)}<i>–</i>${escapeHTML(result.away)}`:time}</strong><span class="agenda-team away">${logo(m.away_logo,m.konuk)}<b>${escapeHTML(m.konuk)}</b></span></button>`;
  };
  el.innerHTML=`<div class="agenda-track" aria-label="Sonuçlanan ve yaklaşan maçlar">${agenda.map(card).join('')}</div>`;
  // Lig değişiminde önceki şeridin yatay konumu yeni lige taşınmamalı.
  // Her lig aynı başlangıç noktasından açılır; kullanıcı isterse sonrasında kaydırır.
  const agendaTrack=el.querySelector('.agenda-track');
  if(agendaTrack) agendaTrack.scrollLeft=0;
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
function liveDetailRows(value){
  return Array.isArray(value) ? value : (Array.isArray(value && value.data) ? value.data : []);
}
function liveEventView(event){
  const type = String(event && event.type || '').toLocaleLowerCase('tr-TR');
  if(/goal|gol/.test(type)) return { label:'GOL', tone:'goal' };
  if(/yellow|sarı/.test(type)) return { label:'SARI KART', tone:'yellow' };
  if(/red|kırmızı/.test(type)) return { label:'KIRMIZI KART', tone:'red' };
  if(/substitution|substitute|değişiklik/.test(type)) return { label:'OYUNCU DEĞİŞİKLİĞİ', tone:'substitution' };
  return null;
}
function renderLiveEvents(details){
  const events = liveDetailRows(details && details.events).map(event=>({ event, view:liveEventView(event) })).filter(item=>item.view);
  if(!events.length) return '<div class="matchday-empty">Gol, kart ve oyuncu değişikliği akışı yayınlanmadı.</div>';
  return `<ol class="matchday-timeline">${events.slice(-12).map(({event,view})=>{
    const minute = event.minute===null || event.minute===undefined || event.minute==='' ? '—' : `${escapeLiveHTML(event.minute)}'`;
    const player = event.player || event.player_name || '';
    const related = event.relatedPlayer || event.related_player || event.related_player_name || '';
    const team = event.team || '';
    return `<li class="is-${view.tone}"><time>${minute}</time><div><b>${view.label}</b><span>${player?escapeLiveHTML(player):'Oyuncu bilgisi yayınlanmadı'}${related?` · ${escapeLiveHTML(related)}`:''}${team?` · ${escapeLiveHTML(team)}`:''}</span></div></li>`;
  }).join('')}</ol>`;
}
function renderLiveStats(details, homeName, awayName){
  const stats = liveDetailRows(details && details.statistics);
  if(!stats.length) return '<div class="matchday-empty">Temel maç istatistikleri yayınlanmadı.</div>';
  const grouped = new Map();
  stats.forEach(stat=>{
    const label = String(stat && (stat.label || stat.name) || '').trim();
    if(!label) return;
    if(!grouped.has(label)) grouped.set(label, { home:'—', away:'—', loose:[] });
    const row = grouped.get(label), team = String(stat.team || '');
    const value = stat.value===null || stat.value===undefined || stat.value==='' ? '—' : stat.value;
    if(homeName && team.toLocaleLowerCase('tr-TR')===String(homeName).toLocaleLowerCase('tr-TR')) row.home=value;
    else if(awayName && team.toLocaleLowerCase('tr-TR')===String(awayName).toLocaleLowerCase('tr-TR')) row.away=value;
    else row.loose.push(value);
  });
  const statRows = Array.from(grouped.entries()).slice(0,8);
  if(!statRows.length) return '<div class="matchday-empty">Temel maç istatistikleri yayınlanmadı.</div>';
  return `<div class="matchday-stats">${statRows.map(([label,row])=>{
    const home = row.home==='—' && row.loose.length ? row.loose.shift() : row.home;
    const away = row.away==='—' && row.loose.length ? row.loose.shift() : row.away;
    return `<div><span>${escapeLiveHTML(home)}</span><b>${escapeLiveHTML(label)}</b><span>${escapeLiveHTML(away)}</span></div>`;
  }).join('')}</div>`;
}
function renderLiveDetails(match){
  const providedDetails = match && match.details;
  const cached = typeof LIVE_MATCH_DETAIL_CACHE !== 'undefined' ? LIVE_MATCH_DETAIL_CACHE.get(match?.id) : null;
  const details = providedDetails || cached || {};
  const homeName = match && match.home && match.home.name || '';
  const awayName = match && match.away && match.away.name || '';
  // match.details dogrudan saglanmissa (ör. eski cagiran veya test harness)
  // agdan tekrar cekmeye gerek yok. Production canli akisinda (bkz.
  // handleFootballLive) details artik minimal ucta HIC gelmiyor; bu durumda
  // ayri /events ve /statistics uclarindan lazy olarak doldurulur.
  if(!providedDetails && typeof fetchLiveMatchDetailIfNeeded === 'function') fetchLiveMatchDetailIfNeeded(match?.id);
  return `<div class="matchday-grid live-details"><section class="matchday-card"><header><span>OLAY AKIŞI</span><h3>Gol, kart ve değişiklikler</h3></header>${renderLiveEvents(details)}</section><section class="matchday-card"><header><span>MAÇ İSTATİSTİKLERİ</span><h3>Sahanın sayıları</h3></header>${renderLiveStats(details,homeName,awayName)}</section></div>`;
}
// Canlı kartın gol/kart/istatistik bölümü artık ana 5 saniyelik canlı uçtan
// değil ayrı /events ve /statistics uçlarından (kendi cache TTL degerleriyle)
// beslenir (bkz handoff madde 3, pahalı include zinciri hot path disina
// tasindi). Sonuç
// gelene kadar bir önceki bilinen değer (varsa) gösterilmeye devam eder;
// hiçbir zaman uydurma veri gösterilmez, yalnızca "henüz yayınlanmadı" boş
// durumu ile gerçek veri arasında geçiş yapılır.
async function fetchLiveMatchDetailIfNeeded(fixtureId){
  if(!fixtureId) return;
  const cached = LIVE_MATCH_DETAIL_CACHE.get(fixtureId);
  if(cached && Date.now()-cached.fetchedAt < LIVE_MATCH_DETAIL_TTL_MS) return;
  if(LIVE_MATCH_DETAIL_PENDING.has(fixtureId)) return;
  LIVE_MATCH_DETAIL_PENDING.add(fixtureId);
  const controller=typeof AbortController!=='undefined'?new AbortController():null;
  if(controller) LIVE_MATCH_DETAIL_CONTROLLERS.set(fixtureId,controller);
  try{
    const [eventsRes, statsRes] = await Promise.all([
      fetch(`/api/football/matches/${encodeURIComponent(fixtureId)}/events`,{headers:{Accept:'application/json'},cache:'no-store',signal:controller?.signal}).then(r=>r.ok?r.json():null).catch(error=>{if(error?.name==='AbortError') throw error; return null;}),
      fetch(`/api/football/matches/${encodeURIComponent(fixtureId)}/statistics`,{headers:{Accept:'application/json'},cache:'no-store',signal:controller?.signal}).then(r=>r.ok?r.json():null).catch(error=>{if(error?.name==='AbortError') throw error; return null;}),
    ]);
    if(controller?.signal.aborted) return;
    LIVE_MATCH_DETAIL_CACHE.set(fixtureId, {
      events: Array.isArray(eventsRes?.events) ? eventsRes.events : (cached?.events || []),
      statistics: Array.isArray(statsRes?.statistics) ? statsRes.statistics : (cached?.statistics || []),
      fetchedAt: Date.now(),
    });
    // Sadece bu fixture su an ekranda goruntuleniyorsa yeniden ciz (gereksiz
    // tam sayfa yenilemesini onler).
    if(document.getElementById('page-story')?.classList.contains('active')) renderLiveFeed();
  }catch(_error){ /* iyilestirici katman; ana canli akisi engellemez */ }
  finally{
    LIVE_MATCH_DETAIL_PENDING.delete(fixtureId);
    if(LIVE_MATCH_DETAIL_CONTROLLERS.get(fixtureId)===controller) LIVE_MATCH_DETAIL_CONTROLLERS.delete(fixtureId);
  }
}
function renderLiveFeed(){
  const list = document.getElementById('liveScoreList');
  const shell = document.getElementById('page-live');
  const freshness = document.getElementById('liveFreshness');
  const providerState = document.getElementById('liveProviderState');
  const refreshBtn = document.getElementById('liveRefreshBtn');
  if(!list) return;
  if(refreshBtn) refreshBtn.disabled = liveFeedLoading;
  if(shell) shell.classList.remove('has-live','live-empty');
  if(liveFeedLoading && !LIVE_FEED.loaded){
    list.innerHTML = `<div class="live-notice"><strong>Canlı maçlar kontrol ediliyor</strong><p>Seçili liglerdeki en güncel maç verisi alınıyor…</p></div>`;
    if(freshness) freshness.textContent='Güncelleniyor…';
    return;
  }
  if(LIVE_FEED.error && !LIVE_FEED.matches.length){
    list.innerHTML = `<div class="live-notice"><strong>Canlı veri şu anda alınamıyor</strong><p>Bağlantı güvenli sunucu katmanında kuruluyor. Biraz sonra yeniden deneyin; eski veya tahmini skor gösterilmeyecek.</p></div>`;
    if(shell) shell.classList.add('live-empty');
    if(freshness) freshness.textContent='Bağlantı kurulamadı';
    if(providerState) providerState.textContent='Canlı kaynak doğrulanıyor';
    return;
  }
  const visibleMatches = LIVE_FEED.matches.filter(match=>activeFootballLeague==='all' || competitionSlug(match.competition)===activeFootballLeague);
  if(shell) shell.classList.toggle('has-live', visibleMatches.length>0);
  if(!visibleMatches.length){
    list.innerHTML = `<div class="live-notice"><strong>Şu anda seçili liglerde canlı maç yok</strong><p>Canlı karşılaşma başladığında skor, dakika ve maç durumu bu ekrana otomatik olarak düşecek.</p></div>`;
    if(shell) shell.classList.add('live-empty');
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
          ${(match.details?.events?.length || match.details?.statistics?.length) ? renderLiveDetails(match) : ''}
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
  liveProviderHealthAbortController?.abort?.();
  const controller=typeof AbortController!=='undefined'?new AbortController():null;
  liveProviderHealthAbortController=controller;
  try{
    const response = await fetch('/api/health',{headers:{Accept:'application/json'},cache:'no-store',signal:controller?.signal});
    const payload = await response.json().catch(()=>null);
    if(controller?.signal.aborted) return;
    const status = payload?.checks?.sportmonks_live;
    state.textContent = status === 'configured' ? 'Sportmonks · canlı bağlantı hazır' : 'Sportmonks · bağlantı yapılandırması eksik';
  }catch(_error){ if(_error?.name!=='AbortError') state.textContent = 'Canlı sağlayıcı durumu doğrulanamadı'; }
  finally{ if(liveProviderHealthAbortController===controller) liveProviderHealthAbortController=null; }
}
async function verifyExitedLiveFixture(liveMatch){
  const id=String(liveMatch?.id||'');
  if(!id||LIVE_EXIT_VERIFICATION_PENDING.has(id)) return;
  LIVE_EXIT_VERIFICATION_PENDING.add(id);
  const controller=typeof AbortController!=='undefined'?new AbortController():null;
  if(controller) LIVE_EXIT_VERIFICATION_CONTROLLERS.set(id,controller);
  try{
    const response=await fetch(`/api/football/fixture?id=${encodeURIComponent(id)}`,{headers:{Accept:'application/json'},cache:'no-store',signal:controller?.signal});
    const payload=await response.json().catch(()=>null);
    if(controller?.signal.aborted) return;
    const fixture=payload?.fixture;
    if(!response.ok||!fixture) return;
    const stored=MATCHES.find(match=>String(match.id)===id); if(!stored) return;
    Object.assign(stored,fixture,{livePendingVerification:false});
    if(fixture.result&&Number.isFinite(Number(fixture.result.home))&&Number.isFinite(Number(fixture.result.away))){
      stored.result={home:Number(fixture.result.home),away:Number(fixture.result.away)};
      ALL_RESULTS[id]={...stored.result,scoredAt:Date.now()};
    }
    if(typeof activeFootballSection!=='undefined'&&activeFootballSection==='home'){
      if(activeFootballLeague==='all'&&typeof renderFootballScoreboardHome==='function') renderFootballScoreboardHome();
      else if(activeFootballLeague!=='all'&&typeof renderFootballLeagueOverview==='function') renderFootballLeagueOverview();
    }
  }catch(_error){}
  finally{
    LIVE_EXIT_VERIFICATION_PENDING.delete(id);
    if(LIVE_EXIT_VERIFICATION_CONTROLLERS.get(id)===controller) LIVE_EXIT_VERIFICATION_CONTROLLERS.delete(id);
  }
}
async function loadLiveFeed(force){
  if(!footballLiveDemandActive()){
    stopLiveFeed();
    return false;
  }
  const league = typeof footballLeagueRequestKey === 'function' ? footballLeagueRequestKey() : activeFootballLeague;
  if(liveFeedLoading && liveFeedRequestScope===league && !force) return false;
  liveFeedActiveScope = league;
  refreshLiveProviderLabel();
  liveFeedLoading = true;
  liveFeedRequestScope = league;
  renderLiveFeed();
  // Onceki istek hala devam ediyorsa iptal et (lig degisimi/hizli ardisik
  // cagrilar); AbortController olmadan yaninda calisan eski bir istek daha
  // gec donup daha yeni veriyi ezebilirdi.
  if(liveFeedAbortController) liveFeedAbortController.abort();
  liveFeedAbortController = typeof AbortController!=='undefined' ? new AbortController() : null;
  const mySeq = ++liveFeedRequestSeq;
  let footballHomeSurfaceChanged = false;
  try{
    let data = null;
    let error = null;
    let workerResponded = false;
    try{
      const response = await fetch(`/api/football/live?league=${encodeURIComponent(league)}`,{headers:{Accept:'application/json'},cache:'no-store',signal:liveFeedAbortController?.signal});
      const providerData = await response.json().catch(()=>null);
      workerResponded=Boolean(providerData&&typeof providerData==='object'&&(Array.isArray(providerData.matches)||providerData.error||providerData.reason));
      // 503/429/vb. artik acikca hata; ancak 200 disi bir yanit da (stale
      // snapshot donen basarili yanitlar haric) gecerli matches iceriyorsa degerlendirilir.
      if(!providerData || !Array.isArray(providerData.matches)) throw new Error(providerData?.error || providerData?.reason || 'Sportmonks canlı veri yanıtı geçersiz.');
      if(!response.ok && !providerData.stale) throw Object.assign(new Error(providerData?.error || providerData?.reason || `HTTP ${response.status}`), { payload:providerData });
      data = providerData;
    }catch(providerError){
      if(providerError?.name === 'AbortError') throw providerError; // iptal edilen istek: eski cevabi hic isleme
      error = providerError;
    }
    if(!workerResponded&&((error && (!data || !Array.isArray(data.matches) || data.matches.length===0)) || !data || !Array.isArray(data.matches))){
      // Worker uzerinden hic ulasilamadiginda (ag hatasi, DNS, vb) son care olarak
      // Supabase Edge Function uzerine dus (bkz supabase/functions/football-live).
      if(typeof ensureXYZSupabaseClient==='function') await ensureXYZSupabaseClient();
      const result = await sb.functions.invoke(LIVE_FEED_CONFIG.functionName, { body:{ scope:LIVE_FEED_CONFIG.scope, league, force:!!force } });
      if(result.error || !result.data || !Array.isArray(result.data.matches)) throw error || result.error || new Error('Canlı veri yanıtı geçersiz.');
      data = result.data;
    }
    // Bu isteğin cevabı gelene kadar daha yeni bir poll başlamışsa (sıra
    // numarası ilerlemişse) bu cevap ARTIK ESKİdir; durumu güncelleme.
    if(mySeq !== liveFeedRequestSeq) return;
    if(!data || !Array.isArray(data.matches)) throw error || new Error('Canlı veri yanıtı geçersiz.');
    const previousLiveMatches=Array.isArray(LIVE_FEED.matches)?LIVE_FEED.matches.slice():[];
    LIVE_FEED = {
      matches:data.matches, updatedAt:data.updatedAt || new Date().toISOString(),
      stale:!!data.stale, staleAgeSeconds:Number.isFinite(data.staleAgeSeconds) ? data.staleAgeSeconds : 0,
      degraded:!!data.degraded, reason:data.reason || null, error:null, loaded:true,
    };
    window.dispatchEvent(new CustomEvent('xyz:live-feed-updated',{detail:{league,matches:data.matches,updatedAt:LIVE_FEED.updatedAt,stale:LIVE_FEED.stale}}));
    liveFeedNextRefreshMs = clampLiveRefreshMs(Number(data.nextRefreshInSeconds) * 1000);
    data.matches.forEach(liveMatch=>{
      let stored=MATCHES.find(match=>String(match.id)===String(liveMatch.id));
      if(!stored&&typeof normalizedLiveMatch==='function'){
        const normalized=normalizedLiveMatch(liveMatch);
        if(normalized&&(league==='all'||normalized.league_key===league)){
          MATCHES.push(normalized); stored=normalized; footballHomeSurfaceChanged=true;
        }
      }
      if(!stored) return;
      const nextStatus=liveMatch.status==='halftime'?'devre_arasi':(liveMatch.status==='live'?'canlı':(liveMatch.status==='finished'?'bitti':stored.status));
      const nextMinute=Number.isFinite(Number(liveMatch.minute)) ? Math.max(0,Math.round(Number(liveMatch.minute))) : null;
      if(stored.status!==nextStatus || (nextMinute!==null && Number(stored.minute)!==nextMinute)) footballHomeSurfaceChanged=true;
      stored.status=nextStatus;
      stored.livePendingVerification=false;
      if(nextMinute!==null) stored.minute=nextMinute;
      if(liveMatch.addedTime!=null && Number.isFinite(Number(liveMatch.addedTime))) stored.addedTime=Math.max(0,Math.round(Number(liveMatch.addedTime)));
      if(liveMatch.home && liveMatch.away && liveMatch.home.score!=null && liveMatch.away.score!=null){
        const nextResult={ home:Number(liveMatch.home.score), away:Number(liveMatch.away.score) };
        const previousResult=stored.result || ALL_RESULTS[liveMatch.id];
        if(!previousResult || Number(previousResult.home)!==nextResult.home || Number(previousResult.away)!==nextResult.away) footballHomeSurfaceChanged=true;
        stored.result=nextResult;
        if(liveMatch.status==='finished') ALL_RESULTS[liveMatch.id]={ ...nextResult, scoredAt:Date.now() };
      }
    });
    if(!LIVE_FEED.stale){
      const incomingIds=new Set(data.matches.map(match=>String(match.id)));
      previousLiveMatches.filter(match=>!incomingIds.has(String(match.id))).forEach(previous=>{
        const stored=MATCHES.find(match=>String(match.id)===String(previous.id));
        if(!stored||!footballStatusIsLive(stored)) return;
        stored.status='durum_guncelleniyor';
        stored.livePendingVerification=true;
        footballHomeSurfaceChanged=true;
        verifyExitedLiveFixture(previous);
      });
    }
  }catch(error){
    if(error?.name === 'AbortError') return; // eski (iptal edilmis) istek: state veya render dokunulmaz, finally sira kontrolunu yapar
    if(mySeq !== liveFeedRequestSeq) return; // eski/iptal edilmis istegin hatasi da gormezden gelinir
    console.warn('[XYZSkor canlı veri]', error);
    LIVE_FEED = { ...LIVE_FEED, error:error && error.message ? error.message : 'Bağlantı hatası', loaded:true, stale:LIVE_FEED.matches.length>0 };
    liveFeedNextRefreshMs = clampLiveRefreshMs(LIVE_FEED_CONFIG.refreshMs * 2); // hata sonrasi biraz yavaslat
  }finally{
    if(mySeq === liveFeedRequestSeq){
      liveFeedLoading = false;
      liveFeedRequestScope = null;
      renderLiveFeed();
      if(typeof activeFootballSection==='undefined'||activeFootballSection!=='home') renderFootballQuickMatches();
      if(footballHomeSurfaceChanged && typeof activeFootballSection!=='undefined' && activeFootballSection==='home'){
        if(activeFootballLeague==='all' && typeof renderFootballScoreboardHome==='function') renderFootballScoreboardHome();
        else if(activeFootballLeague!=='all' && typeof renderFootballLeagueOverview==='function') renderFootballLeagueOverview();
      }
      scheduleNextLivePoll();
    }
  }
}
function footballLiveDemandActive(){
  if(typeof document==='undefined'||document.hidden===true) return false;
  if(typeof navigator!=='undefined'&&navigator.onLine===false) return false;
  if(document.body?.classList?.contains('predict-product-open')) return false;
  if(typeof location!=='undefined'){
    const root=(location.pathname||'/').split('/').filter(Boolean)[0]?.toLowerCase()||'';
    if(['predict','basketbol','voleybol','motorsports','ufc'].includes(root)) return false;
    if(/(?:^|[?&])fixture=/.test(location.search||'')) return false;
  }
  const story=document.getElementById('page-story');
  if(!story?.classList?.contains('active')) return false;
  if(typeof activeFootballSection!=='undefined'&&!['home','matches'].includes(activeFootballSection)) return false;
  return true;
}
function clampLiveRefreshMs(value){
  if(!Number.isFinite(value) || value<=0) return LIVE_FEED_CONFIG.refreshMs;
  return Math.min(LIVE_FEED_MAX_REFRESH_MS, Math.max(LIVE_FEED_MIN_REFRESH_MS, value));
}
// setInterval yerine cakismayan recursive setTimeout: onceki istek bitmeden
// (ve sunucunun bildirdigi adaptif nextRefreshInSeconds degerine gore) yenisi
// baslamaz. Sekme gizliyken veya cihaz cevrimdisiyken hic zamanlayici kurmaz.
function scheduleNextLivePoll(){
  if(liveFeedHandle) clearTimeout(liveFeedHandle);
  if(!footballLiveDemandActive()){ liveFeedHandle=null; return; }
  liveFeedHandle = setTimeout(()=>loadLiveFeed(false), liveFeedNextRefreshMs);
}
function handleLiveVisibilityChange(){
  if(typeof document==='undefined') return;
  if(document.hidden){
    stopLiveFeed();
    return;
  }
  // Sekme tekrar gorunur oldu: hemen tazele (bekletilen adaptif sureyi bekleme).
  if(footballLiveDemandActive()) startLiveFeed();
}
function handleLiveOnlineChange(){
  if(typeof navigator==='undefined') return;
  if(navigator.onLine === false){
    stopLiveFeed();
    return;
  }
  if(footballLiveDemandActive()) startLiveFeed();
}
function bindLiveFeedLifecycleListeners(){
  if(liveFeedVisibilityBound || typeof window==='undefined') return;
  liveFeedVisibilityBound = true;
  document.addEventListener('visibilitychange', handleLiveVisibilityChange);
  window.addEventListener('online', handleLiveOnlineChange);
  window.addEventListener('offline', handleLiveOnlineChange);
  // Lig degisince eski lig icin bekleyen isteği iptal edip yeni lig icin
  // hemen tazele; aksi halde eski ligin gec gelen cevabi kisa sure yeni
  // liginmis gibi gorunebilirdi (bkz. loadFootballLeagueSelection).
  window.addEventListener('xyz:football-league-change', ()=>{
    stopLiveFeed();
    if(footballLiveDemandActive()) startLiveFeed();
  });
}
function startLiveFeed(){
  bindLiveFeedLifecycleListeners();
  if(!footballLiveDemandActive()){
    stopLiveFeed();
    return;
  }
  refreshLiveProviderLabel();
  const scope=typeof footballLeagueRequestKey==='function'?footballLeagueRequestKey():activeFootballLeague;
  if(liveFeedActiveScope===scope&&(liveFeedLoading||liveFeedHandle)) return;
  liveFeedActiveScope=scope;
  loadLiveFeed(false);
}
function stopLiveFeed(){
  if(liveFeedHandle){ clearTimeout(liveFeedHandle); liveFeedHandle=null; }
  if(liveFeedAbortController){ liveFeedAbortController.abort(); liveFeedAbortController=null; }
  liveFeedRequestSeq+=1;
  liveFeedLoading=false;
  liveFeedActiveScope=null;
  liveFeedRequestScope=null;
}
function abortFootballLiveRequests(){
  stopLiveFeed();
  LIVE_MATCH_DETAIL_CONTROLLERS.forEach(controller=>controller.abort());
  LIVE_MATCH_DETAIL_CONTROLLERS.clear();
  LIVE_EXIT_VERIFICATION_CONTROLLERS.forEach(controller=>controller.abort());
  LIVE_EXIT_VERIFICATION_CONTROLLERS.clear();
  liveProviderHealthAbortController?.abort?.();
  liveProviderHealthAbortController=null;
}
// Football owns several independently lazy or polling GET flows. Register one
// consolidated router hook so every client-side branch transition invalidates
// the complete football request scope before the destination surface mounts.
function abortFootballBranchWork(){
  abortFootballLiveRequests();
  if(typeof abortFootballCriticalData==='function') abortFootballCriticalData();
  if(typeof abortFootballWeeklyFeatures==='function') abortFootballWeeklyFeatures();
  if(typeof abortFootballCoverage==='function') abortFootballCoverage();
  if(typeof abortFootballUiRequests==='function') abortFootballUiRequests();
  if(typeof abortMatchCenterNetwork==='function') abortMatchCenterNetwork();
}
if(typeof window!=='undefined'&&window.XYZBranchRouter&&!window.__XYZ_FOOTBALL_BRANCH_ABORT_REGISTERED__){
  window.__XYZ_FOOTBALL_BRANCH_ABORT_REGISTERED__=true;
  window.XYZBranchRouter.registerAbortHook(abortFootballBranchWork);
}

/* ===================== MAIN TAB SWITCH ===================== */
function switchMainTab(name, updateUrl){
  const product = ['league','predict'].includes(name) ? 'predict' : 'football';
  const storyPage=document.getElementById('page-story');
  const leaguePage=document.getElementById('page-league');
  const livePage=document.getElementById('page-live');
  if(product==='football'&&updateUrl!==false&&/^\/predict(?:\/|$)/.test(location.pathname||'')){
    const returnPath=storedFootballReturnPath()||'/';
    if(window.XYZBranchRouter) window.XYZBranchRouter.navigate(returnPath,{label:'Futbol'});
    else location.assign(returnPath);
    return;
  }
  if(product==='predict') rememberFootballReturnPath();
  if(product==='predict'&&!leaguePage){ location.assign('/predict'); return; }
  if(product==='predict'&&typeof ensureXYZLegacyStyles==='function') ensureXYZLegacyStyles();
  if(product==='predict'&&typeof ensureXYZUiExtras==='function') ensureXYZUiExtras();
  if(product==='predict'&&typeof ensureXYZSupabaseClient==='function') ensureXYZSupabaseClient().catch(()=>{});
  document.body.classList.toggle('predict-product-open', product==='predict');
  storyPage?.classList.toggle('active', product==='football');
  leaguePage?.classList.toggle('active', product==='predict');
  livePage?.classList.toggle('active', product==='football');
  document.getElementById('tabBtnFootball').classList.toggle('active', product==='football');
  document.getElementById('tabBtnPredict').classList.toggle('active', product==='predict');
  const footballContextNav=document.getElementById('footballContextNav');
  if(footballContextNav) footballContextNav.hidden=product!=='football';
  const footballLeagueCommand=document.getElementById('footballLeagueCommand');
  if(footballLeagueCommand) footballLeagueCommand.hidden=product!=='football';
  const matchdayCommand=document.getElementById('matchdayCommand');
  if(matchdayCommand) matchdayCommand.hidden=product!=='football';
  if(product==='football' && name==='football' && activeFootballSection!=='home' && typeof openFootballSection==='function') openFootballSection('home',null,false);
  if(product==='football'){
    if(typeof abortPredictChallengeSelection==='function') abortPredictChallengeSelection();
    if(typeof abortPredictOwnedContext==='function') abortPredictOwnedContext();
    startLiveFeed();
  }else{
    stopLiveFeed();
    if(typeof abortFootballCriticalData==='function') abortFootballCriticalData();
  }
  if(product==='predict'){
    if(typeof loadPredictChallengeSelection==='function') loadPredictChallengeSelection();
    if(typeof loadPredictOwnedContext==='function') loadPredictOwnedContext().catch(error=>console.warn('[XYZSkor Predict baglami]',error));
    if(typeof activeLeagueSection!=='undefined'&&activeLeagueSection==='leader') loadVisibleLeaderboards();
    if(updateUrl !== false) window.scrollTo({top:0,behavior:'smooth'});
  }
  if(updateUrl !== false) updatePath(buildProductPath(name));
  if(product==='football'&&updateUrl!==false) startLiveFeed();
  updateMobileNavActive();
}
function openStories(){
  switchMainTab('football');
  const target=document.getElementById('weeklyStoryArea');
  if(target) target.scrollIntoView({behavior:'smooth',block:'start'});
}

/* ===================== LİG İÇİ SEKMELER ===================== */
let activeLeagueSection = 'predict';
function switchLeagueSection(name, updateUrl){
  // Defense-in-depth: nihai yetki kontrolü Supabase RLS'te (results_admin_all,
  // rewards_admin_all) yapılıyor, ama admin olmayan bir kullanıcı devtools'tan
  // veya doğrudan çağrıyla buraya gelirse bölümü client tarafında da açmayalım.
  if(name === 'admin' && !getCurrentUser()?.is_admin) return;
  if(!document.getElementById('page-league')){ location.assign('/predict'); return; }
  activeLeagueSection = name;
  ['predict','standings','leader','rewards','profile','admin'].forEach(n=>{
    const section = document.getElementById('lsec-'+n); if(section) section.classList.toggle('active', n===name);
    const btn = document.getElementById('lst-'+n); if(btn) btn.classList.toggle('active', n===name);
  });
  updateMobileNavActive();
  if(['predict','rewards','profile'].includes(name)&&typeof loadPredictOwnedContext==='function') loadPredictOwnedContext().catch(()=>{});
  if(name==='leader') loadVisibleLeaderboards();
  if(updateUrl!==false) updatePath(buildProductPath('predict'));
}

/* ===================== MOBİL ALT NAVİGASYON ===================== */
function mbnGo(key){
  if(['football','story','live'].includes(key)){ switchMainTab('football'); }
  else if(['predict','leader'].includes(key)){ switchMainTab('predict'); switchLeagueSection(key==='leader'?'leader':'predict'); }
  else if(key==='profile'){ openAccount(); }
  window.scrollTo({top:0, behavior:'smooth'});
}
function updateMobileNavActive(){
  const footballActive = Boolean(document.getElementById('page-story')?.classList.contains('active'));
  const leagueActive = Boolean(document.getElementById('page-league')?.classList.contains('active'));
  const map = {
    'mbn-football': footballActive,
    'mbn-predict': leagueActive
  };
  Object.entries(map).forEach(([id, active])=>{
    const el = document.getElementById(id); if(el) el.classList.toggle('active', !!active);
  });
}
