(() => {
  const SPORT_LABELS = {
    basketball: 'Basketbol',
    mma: 'UFC / MMA',
    volleyball: 'Voleybol',
    hockey: 'Buz Hokeyi',
    rugby: 'Rugby',
    baseball: 'Beyzbol',
    handball: 'Hentbol',
    americanFootball: 'Amerikan Futbolu',
    australianFootball: 'Avustralya Futbolu'
  };

  let feedPromise = null;
  let activeSport = 'basketball';
  let activeView = 'home';

  const escapeHTML = (value) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const sportSlug = (sport) => ({basketball:'basketbol',mma:'ufc',volleyball:'voleybol',hockey:'buz-hokeyi',rugby:'rugby',baseball:'beyzbol',handball:'hentbol',americanFootball:'amerikan-futbolu',australianFootball:'avustralya-futbolu'}[sport] || 'basketbol');
  const viewSlug = (view) => ({games:'maclar',leagues:'ligler',teams:'takimlar',predict:'predict'}[view] || '');

  function hubPath(sport, view){
    const suffix = viewSlug(view);
    return `/${sportSlug(sport)}/${suffix ? `${suffix}/` : ''}`;
  }

  function routeState(){
    const parts = location.pathname.split('/').filter(Boolean);
    const sport = ({basketbol:'basketball',ufc:'mma',voleybol:'volleyball','buz-hokeyi':'hockey',rugby:'rugby',beyzbol:'baseball',hentbol:'handball','amerikan-futbolu':'americanFootball','avustralya-futbolu':'australianFootball'})[parts[0]];
    const view = ({maclar:'games',ligler:'leagues',takimlar:'teams',predict:'predict'})[parts[1]] || 'home';
    return sport ? {sport,view} : null;
  }

  function closeHub(){
    document.body.classList.remove('multisport-open');
    const hub = document.getElementById('multiSportHub');
    if(hub) hub.hidden = true;
    document.querySelectorAll('.multisport-nav-button').forEach((button) => button.classList.remove('active'));
  }

  function teamCardHTML(team){
    return `<article class="multi-team-card"><span>${team.logo ? `<img src="${escapeHTML(team.logo)}" alt="" loading="lazy">` : ''}</span><strong>${escapeHTML(team.name || 'Takım')}</strong><small>Günün programında</small></article>`;
  }

  function predictCardHTML(item){
    const key = `xyzskor_multi_pick_${activeSport}_${item.id}`;
    let selected = '';
    try{ selected = localStorage.getItem(key) || ''; }catch(_error){}
    const first = item.first || {};
    const second = item.second || {};
    return `<article class="multi-predict-card" data-predict-key="${escapeHTML(key)}"><header><span>${escapeHTML(item.league || item.category || '')}</span><time>${escapeHTML(item.time || '')}</time></header><strong>${escapeHTML(first.name || 'TBA')} <i>vs</i> ${escapeHTML(second.name || 'TBA')}</strong><p>Ücretsiz Predict beta seçimi</p><div><button type="button" data-pick="first" class="${selected==='first'?'active':''}">1 · ${escapeHTML(first.name || 'İlk taraf')}</button><button type="button" data-pick="second" class="${selected==='second'?'active':''}">2 · ${escapeHTML(second.name || 'İkinci taraf')}</button></div></article>`;
  }

  function cardHTML(item){
    const first = item.first || item.home || {};
    const second = item.second || item.away || {};
    const score = item.score || '';
    return `<article class="multi-event-card sport-${activeSport}">
      <header><span>${escapeHTML(item.league || item.category || SPORT_LABELS[activeSport])}</span><time>${escapeHTML(item.time || '')}</time></header>
      <div class="multi-event-side"><span>${first.logo ? `<img src="${escapeHTML(first.logo)}" alt="" loading="lazy">` : ''}</span><strong>${escapeHTML(first.name || 'TBA')}</strong></div>
      <div class="multi-event-score"><b>${escapeHTML(score || 'VS')}</b><small>${escapeHTML(item.status || 'Yaklasan')}</small></div>
      <div class="multi-event-side away"><strong>${escapeHTML(second.name || 'TBA')}</strong><span>${second.logo ? `<img src="${escapeHTML(second.logo)}" alt="" loading="lazy">` : ''}</span></div>
    </article>`;
  }

  function render(payload){
    const hub = document.getElementById('multiSportHub');
    const grid = document.getElementById('multiSportGrid');
    const title = document.getElementById('multiSportTitle');
    const note = document.getElementById('multiSportNote');
    if(!hub || !grid) return;
    const sports = payload?.sports || {};
    const available = Object.keys(SPORT_LABELS).filter((key) => Array.isArray(sports[key]) && sports[key].length);
    // Never replace the requested branch with another sport's feed.
    // An empty branch must render its own honest empty state.
    document.querySelectorAll('[data-multi-sport]').forEach((button) => {
      const key = button.dataset.multiSport;
      button.hidden = false;
      button.classList.toggle('active', key === activeSport);
    });
    const items = sports[activeSport] || [];
    hub.dataset.sport = activeSport;
    grid.dataset.sport = activeSport;
    title.textContent = SPORT_LABELS[activeSport] || 'Spor';
    note.textContent = `${payload?.date || ''} programı · ücretsiz API-Sports verisi`;
    const viewNav = document.getElementById('multiSportViews');
    const views = activeSport === 'basketball' ? [['home','Genel'],['games','Ma&#231;lar'],['leagues','Ligler'],['teams','Tak&#305;mlar'],['predict','Predict']] : activeSport === 'mma' ? [['home','Genel'],['games','Son ma&#231;lar'],['leagues','Organizasyonlar'],['predict','Predict']] : [['home','Genel'],['games','Ma&#231;lar'],['leagues','Ligler']];
    viewNav.innerHTML = views.map(([key,label]) => `<button type="button" data-multi-view="${key}" class="${key===activeView?'active':''}">${label}</button>`).join('');
    viewNav.querySelectorAll('[data-multi-view]').forEach((button) => button.addEventListener('click', () => openHub(activeSport, button.dataset.multiView, true)));
    if(activeView === 'leagues'){
      const groups = new Map();
      items.forEach((item) => {
        const name = item.league || item.category || 'Diger organizasyon';
        if(!groups.has(name)) groups.set(name, []);
        groups.get(name).push(item);
      });
      grid.innerHTML = groups.size ? [...groups.entries()].map(([name, events]) => {
        const live = events.filter((item) => /live|quarter|period|halftime|in progress/i.test(item.status || '')).length;
        return '<article class="multi-league-card"><span>LIG / ORGANIZASYON</span><h3>'+escapeHTML(name)+'</h3><div><b>'+events.length+'</b><small>gunluk etkinlik</small></div><em class="'+(live ? 'is-live' : '')+'">'+(live ? live+' canli' : 'program aktif')+'</em></article>';
      }).join('') : '<div class="multi-event-empty"><strong>Bugunun lig programi hazirlaniyor.</strong></div>';
      return;
    }    if(activeView === 'teams'){
      const unique = new Map();
      items.forEach((item) => [item.first,item.second].forEach((team) => { if(team?.name) unique.set(team.name,team); }));
      grid.innerHTML = unique.size ? [...unique.values()].map(teamCardHTML).join('') : '<div class="multi-event-empty"><strong>Bugünün takım listesi hazırlanıyor.</strong></div>';
      return;
    }
    if(activeView === 'predict'){
      grid.innerHTML = items.length ? items.slice(0,10).map(predictCardHTML).join('') : '<div class="multi-event-empty"><strong>Bugün tahmine açık etkinlik yok.</strong></div>';
      grid.querySelectorAll('[data-predict-key] button').forEach((button) => button.addEventListener('click', () => {
        const card = button.closest('[data-predict-key]');
        try{ localStorage.setItem(card.dataset.predictKey, button.dataset.pick); }catch(_error){}
        card.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
      }));
      return;
    }
    grid.innerHTML = items.length ? items.slice(0, activeView === 'games' ? 24 : 12).map(cardHTML).join('') : '<div class="multi-event-empty"><strong>Bugün program bulunmuyor.</strong><span>Etkinliği olan diğer branşlar yukarıda görünür.</span></div>';
  }

  async function load(){
    if(!feedPromise){
      feedPromise = fetch('/api/sports/today?client=v5', { cache:'no-store', headers:{ Accept:'application/json', 'Cache-Control':'no-cache' } })
        .then(async (response) => {
          const payload = await response.json().catch(() => ({}));
          if(!response.ok) throw new Error(payload.error || 'sports_unavailable');
          return payload;
        }).catch((error) => { feedPromise = null; throw error; });
    }
    return feedPromise;
  }

  async function openHub(sport, view = 'home', updateUrl = true){
    activeSport = sport || activeSport;
    activeView = view;
    if(updateUrl && location.pathname !== hubPath(activeSport,activeView)) history.pushState({multisport:true},'',hubPath(activeSport,activeView));
    document.body.classList.add('multisport-open');
    const hub = document.getElementById('multiSportHub');
    const grid = document.getElementById('multiSportGrid');
    if(!hub || !grid) return;
    hub.hidden = false;
    grid.innerHTML = '<div class="multi-event-loading"><i></i><i></i><i></i><span>Canli program hazirlaniyor</span></div>';
    document.querySelectorAll('.multisport-nav-button').forEach((button) => button.classList.toggle('active', button.dataset.multiSport === activeSport));
    try{ render(await load()); }
    catch(_error){ grid.innerHTML = '<div class="multi-event-empty"><strong>Spor akisi su anda yenileniyor.</strong><span>Futbol ve Predict kullanilmaya devam edebilir.</span></div>'; }
    window.scrollTo({top:0,behavior:'smooth'});
  }

  window.openMultiSportHub = openHub;

  function init(){
    const primary = document.querySelector('.primary-nav');
    const wrap = document.querySelector('.wrap');
    if(!primary || !wrap || document.getElementById('multiSportHub')) return;
    const buttons = [
      ['basketball','Basketbol'],
      ['mma','UFC'],
      ['volleyball','Diğer Sporlar']
    ];
    buttons.forEach(([key,label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'maintab multisport-nav-button';
      button.dataset.multiSport = key;
      button.textContent = label;
      button.addEventListener('click', () => openHub(key,'home',true));
      primary.appendChild(button);
    });
    const hub = document.createElement('main');
    hub.id = 'multiSportHub';
    hub.className = 'multisport-hub';
    hub.hidden = true;
    hub.innerHTML = `<header class="multisport-hero"><div><span>XYZSKOR MULTISPORT</span><h1 id="multiSportTitle">Basketbol</h1><p id="multiSportNote">Gunun programi</p></div><b>CANLI VERI</b></header>
      <nav class="multisport-switcher" aria-label="Spor branşı seçimi">${Object.entries(SPORT_LABELS).map(([key,label]) => `<button type="button" data-multi-sport="${key}">${label}</button>`).join('')}</nav>
      <nav class="multisport-view-nav" id="multiSportViews" aria-label="Branş bölümleri"></nav>
      <section class="multi-event-grid" id="multiSportGrid" aria-live="polite"></section>`;
    wrap.parentNode.insertBefore(hub, wrap);
    hub.querySelectorAll('[data-multi-sport]').forEach((button) => button.addEventListener('click', () => openHub(button.dataset.multiSport,'home',true)));
    document.getElementById('tabBtnFootball')?.addEventListener('click', closeHub, true);
    document.getElementById('tabBtnPredict')?.addEventListener('click', closeHub, true);
    const initial = routeState();
    if(initial) openHub(initial.sport,initial.view,false);
    window.addEventListener('popstate', () => { const state=routeState(); if(state) openHub(state.sport,state.view,false); else closeHub(); });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
