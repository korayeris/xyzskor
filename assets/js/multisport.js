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
  let activeLeague = 'all';

  const escapeHTML = (value) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const sportSlug = (sport) => ({basketball:'basketbol',mma:'ufc',volleyball:'voleybol',hockey:'buz-hokeyi',rugby:'rugby',baseball:'beyzbol',handball:'hentbol',americanFootball:'amerikan-futbolu',australianFootball:'avustralya-futbolu'}[sport] || 'basketbol');
  const visualFallback = (name, sport = activeSport) => {
    const colors = {basketball:'#ff9d24',mma:'#ff405d',volleyball:'#20c997',hockey:'#55b8ff',rugby:'#d5b44c',baseball:'#ef5b5b',handball:'#ff7b3d',americanFootball:'#8fb3ff',australianFootball:'#e6c45b'};
    const initials = String(name || SPORT_LABELS[sport] || 'XYZ').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${colors[sport] || '#ef4058'}"/><stop offset="1" stop-color="#091118"/></linearGradient></defs><rect width="160" height="160" rx="32" fill="url(#g)"/><circle cx="80" cy="68" r="34" fill="rgba(255,255,255,.14)"/><path d="M30 150c5-36 24-54 50-54s45 18 50 54" fill="rgba(255,255,255,.12)"/><text x="80" y="88" text-anchor="middle" font-family="Arial" font-size="40" font-weight="800" fill="white">${initials}</text></svg>`)}`;
  };
  const visual = (name, src) => `<img src="${escapeHTML(src || visualFallback(name))}" data-fallback="${escapeHTML(visualFallback(name))}" onerror="this.onerror=null;this.src=this.dataset.fallback" alt="${escapeHTML(name || '')}" loading="lazy">`;  const viewSlug = (view) => ({games:'maclar',leagues:'ligler',teams:'takimlar',predict:'predict'}[view] || '');
  const scoreText = (score) => {
    if(score == null || score === '') return 'VS';
    if(typeof score !== 'object') return String(score);
    const first = score.first ?? score.home ?? score.local ?? score.team1 ?? score.current?.home ?? score.total?.home;
    const second = score.second ?? score.away ?? score.visitor ?? score.team2 ?? score.current?.away ?? score.total?.away;
    if(first != null || second != null) return String(first ?? '-') + ' - ' + String(second ?? '-');
    return score.display ?? score.text ?? score.value ?? 'VS';
  };

  function hubPath(sport, view){
    const suffix = viewSlug(view);
    return `/${sportSlug(sport)}/${suffix ? `${suffix}/` : ''}`;
  }

  function routeState(){
    const parts = location.pathname.split('/').filter(Boolean);
    const sport = ({basketbol:'basketball',voleybol:'volleyball','buz-hokeyi':'hockey',rugby:'rugby',beyzbol:'baseball',hentbol:'handball','amerikan-futbolu':'americanFootball','avustralya-futbolu':'australianFootball'})[parts[0]];
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
    return `<article class="multi-team-card"><span>${visual(team.name, team.logo)}</span><strong>${escapeHTML(team.name || 'Takim')}</strong><small>Gunun programinda</small></article>`;
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
    const score = scoreText(item.score);
    return `<article class="multi-event-card sport-${activeSport}">
      <header><span>${item.leagueLogo ? `<img class="multi-league-logo" src="${escapeHTML(item.leagueLogo)}" alt="">` : ''}${escapeHTML(item.league || item.category || SPORT_LABELS[activeSport])}</span><time>${escapeHTML(item.feedDate || item.date || item.time || '')}</time></header>
      <div class="multi-event-side"><span>${visual(first.name, first.logo)}</span><strong>${escapeHTML(first.name || 'TBA')}</strong></div>
      <div class="multi-event-score"><b>${escapeHTML(score)}</b><small>${escapeHTML(item.status || 'Yaklasan') + (item.archived ? ' · Son gerceklesen' : '')}</small></div>
      <div class="multi-event-side away"><strong>${escapeHTML(second.name || 'TBA')}</strong><span>${visual(second.name, second.logo)}</span></div>
    </article>`;
  }

  function basketballPortalHTML(items, leagueNames){
    const featured = items[0];
    const teams = new Map();
    items.forEach((item) => [item.first || item.home, item.second || item.away].forEach((team) => {
      if(team?.name && !teams.has(team.name)) teams.set(team.name, team);
    }));
    const teamStrip = [...teams.values()].slice(0,10).map((team) => `<button type="button" class="basket-team-chip">${visual(team.name, team.logo)}<span>${escapeHTML(team.name)}</span></button>`).join('');
    const schedule = items.slice(0,8).map((item) => {
      const first = item.first || item.home || {};
      const second = item.second || item.away || {};
      return `<article class="basket-schedule-row"><time>${escapeHTML(item.time || item.feedDate || '--:--')}</time><strong>${escapeHTML(first.name || 'TBA')}</strong><b>${escapeHTML(scoreText(item.score))}</b><strong>${escapeHTML(second.name || 'TBA')}</strong></article>`;
    }).join('');
    const featuredHTML = featured ? (() => {
      const first = featured.first || featured.home || {};
      const second = featured.second || featured.away || {};
      return `<article class="basket-feature-card">
        <span>GUNUN VITRINI</span><h2>${escapeHTML(featured.league || 'Basketbol')}</h2>
        <div class="basket-feature-match"><figure>${visual(first.name, first.logo)}<figcaption>${escapeHTML(first.name || 'TBA')}</figcaption></figure><strong>${escapeHTML(scoreText(featured.score))}</strong><figure>${visual(second.name, second.logo)}<figcaption>${escapeHTML(second.name || 'TBA')}</figcaption></figure></div>
        <p>${escapeHTML(featured.status || 'Programda')} · ${escapeHTML(featured.feedDate || featured.date || featured.time || '')}</p>
      </article>`;
    })() : '<article class="basket-feature-card"><h2>Basketbol vitrini hazırlanıyor</h2></article>';
    const leagueList = leagueNames.slice(0,8).map((name, index) => `<button type="button" data-basket-league="${escapeHTML(name)}"><i>${index + 1}</i><span>${escapeHTML(name)}</span><b>${items.filter((item) => (item.league || item.category) === name).length}</b></button>`).join('');
    return `<section class="basket-team-command"><strong>TAKIM GUNDEMI</strong><div>${teamStrip || '<span>Takimlar programla birlikte güncellenir.</span>'}</div></section>
      <section class="basket-football-layout">
        <aside class="basket-schedule-panel"><header><span>MAC MERKEZI</span><h3>Canli ve yaklasan maclar</h3></header>${schedule || '<p>Program güncelleniyor.</p>'}</aside>
        ${featuredHTML}
        <aside class="basket-league-panel"><header><span>LIGLER</span><h3>Basketbol vitrini</h3></header>${leagueList || '<p>Ligler güncelleniyor.</p>'}</aside>
      </section>`;
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
    const allItems = sports[activeSport] || [];
    hub.dataset.sport = activeSport;
    grid.dataset.sport = activeSport;
    title.textContent = SPORT_LABELS[activeSport] || 'Spor';
    note.textContent = `${payload?.date || ''} programı · ücretsiz API-Sports verisi`;
    const viewNav = document.getElementById('multiSportViews');
    const views = activeSport === 'basketball' ? [['home','Genel'],['games','Ma&#231;lar'],['leagues','Ligler'],['teams','Tak&#305;mlar'],['predict','Predict']] : activeSport === 'mma' ? [['home','Genel'],['games','Son ma&#231;lar'],['leagues','Organizasyonlar'],['predict','Predict']] : [['home','Genel'],['games','Ma&#231;lar'],['leagues','Ligler']];
    viewNav.innerHTML = views.map(([key,label]) => `<button type="button" data-multi-view="${key}" class="${key===activeView?'active':''}">${label}</button>`).join('');
    viewNav.querySelectorAll('[data-multi-view]').forEach((button) => button.addEventListener('click', () => openHub(activeSport, button.dataset.multiView, true)));
    let leagueStrip = document.getElementById('multiLeagueStrip');
    if(!leagueStrip){
      leagueStrip = document.createElement('nav');
      leagueStrip.id = 'multiLeagueStrip';
      leagueStrip.className = 'multi-league-strip';
      viewNav.after(leagueStrip);
    }
    const leagueNames = [...new Set(allItems.map(item => item.league || item.category).filter(Boolean))];
    leagueStrip.hidden = !leagueNames.length;
    leagueStrip.innerHTML = leagueNames.length ? [['all','Tumu'],...leagueNames.slice(0,14).map(name=>[name,name])].map(([key,label])=>`<button type="button" data-league="${escapeHTML(key)}" class="${key===activeLeague?'active':''}">${escapeHTML(label)}</button>`).join('') : '';
    leagueStrip.querySelectorAll('[data-league]').forEach(button=>button.addEventListener('click',()=>{activeLeague=button.dataset.league;render(payload)}));
    const items = activeLeague === 'all' ? allItems : allItems.filter(item => (item.league || item.category) === activeLeague);
    if(activeSport === 'basketball' && activeView === 'home'){
      grid.innerHTML = basketballPortalHTML(items, leagueNames);
      grid.querySelectorAll('[data-basket-league]').forEach((button) => button.addEventListener('click', () => {
        activeLeague = button.dataset.basketLeague;
        render(payload);
      }));
      return;
    }
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
    grid.innerHTML = items.length ? items.slice(0, activeView === 'games' ? 24 : 12).map(cardHTML).join('') : '<div class="multi-event-empty"><strong>Bu branşın son verileri hazırlanıyor.</strong><span>Yasal API kaynağı veri sunduğunda son gerçekleşen karşılaşmalar otomatik gösterilir.</span></div>';
  }

  async function load(){
    if(!feedPromise){
      feedPromise = fetch('/api/sports/today?client=v8', { cache:'no-store', headers:{ Accept:'application/json', 'Cache-Control':'no-cache' } })
        .then(async (response) => {
          const payload = await response.json().catch(() => ({}));
          if(!response.ok) throw new Error(payload.error || 'sports_unavailable');
          return payload;
        }).catch((error) => { feedPromise = null; throw error; });
    }
    return feedPromise;
  }

  async function openHub(sport, view = 'home', updateUrl = true){
    if(sport === 'mma'){
      location.assign('/ufc/');
      return;
    }
    if(sport && sport !== activeSport) activeLeague = 'all';
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
