(() => {
  const groups = [
    ['FORMULA', [['Formula 1', 'formula-1'], ['Formula E', 'formula-e'], ['IndyCar', 'indycar']]],
    ['MOTOSIKLET', [['MotoGP', 'motogp'], ['Moto2', 'moto2'], ['Moto3', 'moto3']]],
    ['RALLY', [['WRC', 'wrc']]],
    ['ENDURANCE', [['WEC', 'wec'], ['Le Mans', 'le-mans']]],
    ['STOCK CAR', [['NASCAR Cup Series', 'nascar']]]
  ];
  const series = {
    'formula-1': ['Formula 1', '#ef3547', 'formula'],
    'formula-e': ['Formula E', '#38a8ff', 'formula'],
    indycar: ['IndyCar', '#1689d8', 'formula'],
    motogp: ['MotoGP', '#ff6a28', 'moto'],
    moto2: ['Moto2', '#e9853a', 'moto'],
    moto3: ['Moto3', '#efad43', 'moto'],
    wrc: ['WRC', '#3fc77a', 'rally'],
    wec: ['WEC', '#8a6cff', 'endurance'],
    'le-mans': ['Le Mans', '#9c79ff', 'endurance'],
    nascar: ['NASCAR Cup Series', '#f0c83f', 'stock']
  };
  const viewRegistry = {
    formula: [['overview', 'Overview'], ['calendar', 'Calendar'], ['results', 'Results'], ['standings', 'Standings'], ['drivers', 'Drivers'], ['teams', 'Teams'], ['circuits', 'Circuits'], ['live', 'Live']],
    moto: [['overview', 'Overview'], ['calendar', 'Calendar'], ['results', 'Results'], ['standings', 'Standings'], ['riders', 'Riders'], ['teams', 'Teams'], ['live', 'Live']],
    rally: [['overview', 'Overview'], ['calendar', 'Calendar'], ['stages', 'Stages'], ['results', 'Results'], ['drivers', 'Drivers'], ['teams', 'Teams'], ['live', 'Live']],
    endurance: [['overview', 'Overview'], ['calendar', 'Calendar'], ['results', 'Results'], ['standings', 'Standings'], ['drivers', 'Drivers'], ['teams', 'Teams'], ['live', 'Live']],
    stock: [['overview', 'Overview'], ['calendar', 'Calendar'], ['stages', 'Stages'], ['results', 'Results'], ['standings', 'Standings'], ['drivers', 'Drivers'], ['teams', 'Teams'], ['live', 'Live']]
  };
  const resourceMap = {
    calendar: 'events', results: 'events', standings: 'standings-drivers',
    drivers: 'drivers', riders: 'drivers', teams: 'teams', circuits: 'circuits', live: 'live'
  };
  const dynamicResources = new Set(['drivers', 'teams', 'standings-drivers', 'standings-teams', 'standings']);
  const unsupported = {
    stages: ['Etap verisi pakette bulunmuyor.', 'Saglayici ayri etap akisi verdiginde bu alan otomatik aktif olur.']
  };
  const parts = () => location.pathname.split('/').filter(Boolean);
  const isMotor = () => parts()[0] === 'motorsports';
  const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const rows = data => {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];
    for (const key of ['data', 'response', 'items', 'results', 'events', 'drivers', 'teams', 'seasons', 'standings', 'circuits']) {
      if (Array.isArray(data[key])) return data[key];
    }
    for (const value of Object.values(data)) if (Array.isArray(value)) return value;
    return [];
  };
  const scalar = (value, keys = ['name', 'fullName', 'displayName', 'title', 'year', 'season', 'value', 'label', 'code']) => {
    if (value == null) return '';
    if (['string', 'number', 'boolean'].includes(typeof value)) return String(value);
    if (Array.isArray(value)) return value.map(item => scalar(item, keys)).filter(Boolean).join(' / ');
    for (const key of keys) {
      const found = scalar(value?.[key], keys);
      if (found) return found;
    }
    return '';
  };
  const nameOf = item => {
    const personName = [scalar(item?.firstName), scalar(item?.lastName)].filter(Boolean).join(' ');
    const resolved = personName || scalar(item, ['name', 'fullName', 'displayName', 'title', 'eventName', 'year', 'season', 'slug']) || scalar(item?.driver) || scalar(item?.team) || scalar(item?.constructor);
    return resolved && !/^\[?object(?: object)?\]?$/i.test(resolved.trim()) ? resolved : 'Kayit';
  };
  const imageOf = item => scalar(item?.image || item?.logo || item?.photo || item?.avatar || item?.driver?.image || item?.team?.logo, ['url', 'src', 'href']);
  const dateOf = item => scalar(item?.dateStart || item?.startDate || item?.date || item?.scheduledAt || item?.start, ['date', 'value', 'label']);
  const valueOf = item => scalar(item?.points ?? item?.position ?? item?.rank ?? item?.number ?? item?.status, ['long', 'short', 'name', 'value', 'label']);
  const initialsOf = item => nameOf(item).split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const flagOf = item => {
    const code = scalar(item?.country, ['twoCode']).toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map(letter => 127397 + letter.charCodeAt())) : '';
  };
  const menu = () => groups.map(([group, items]) => `<section class="xms-mega-group"><strong>${group}</strong>${items.map(([label, slug]) => `<a href="/motorsports/${slug}">${label}</a>`).join('')}</section>`).join('');
  const viewsFor = slug => viewRegistry[series[slug]?.[2] || 'formula'];
  const classSwitch = slug => {
    if (['motogp', 'moto2', 'moto3'].includes(slug)) return `<nav class="xms-class-switch" aria-label="Motosiklet sinifi">${['motogp', 'moto2', 'moto3'].map(key => `<a class="${key === slug ? 'active' : ''}" href="/motorsports/${key}">${series[key][0]}</a>`).join('')}</nav>`;
    if (['wec', 'le-mans'].includes(slug)) return '<nav class="xms-class-switch" aria-label="Endurance sinifi"><button class="active">Genel</button><button disabled>Hypercar</button><button disabled>LMGT3</button></nav>';
    return '';
  };

  let snapshotPromise;
  let liveTimer = 0;
  async function api(sport, resource) {
    if (resource === 'live') {
      const response = await fetch(`/api/motorsports?sport=${encodeURIComponent(sport)}&resource=live`, { headers: { Accept: 'application/json' } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'live_unavailable');
      return payload;
    }
    if (dynamicResources.has(resource)) {
      const response = await fetch(`/api/motorsports?sport=${encodeURIComponent(sport)}&resource=${encodeURIComponent(resource)}&limit=100&page=1&profile=v2`, { headers: { Accept: 'application/json' } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'motorsport_profile_unavailable');
      return payload;
    }
    snapshotPromise ||= fetch('/assets/data/motorsports-snapshot.json', { cache: 'force-cache' }).then(response => {
      if (!response.ok) throw new Error('snapshot_unavailable');
      return response.json();
    });
    const snapshot = await snapshotPromise;
    return { source: snapshot.source, updatedAt: snapshot.fetchedAt, liveSupported: false, data: snapshot.sports?.[sport]?.[resource] || [] };
  }
  function itemCard(item, index, type) {
    const image = imageOf(item);
    const date = dateOf(item);
    const value = valueOf(item);
    const meta = date || scalar(item?.country) || scalar(item?.nationality) || scalar(item?.location) || scalar(item?.team);
    const flag = flagOf(item);
    const stats = [['wins', 'W'], ['podiums', 'POD'], ['poles', 'POLE'], ['races', 'RACE'], ['starts', 'START'], ['championships', 'TITLE']]
      .map(([key, label]) => item?.[key] != null ? `<span><b>${esc(item[key])}</b><small>${label}</small></span>` : '').filter(Boolean).join('');
    return `<article class="xms-data-card xms-type-${esc(type.toLowerCase())}"><span class="xms-data-index">${String(index + 1).padStart(2, '0')}</span>${image ? `<img src="${esc(image)}" alt="" loading="lazy">` : `<span class="xms-avatar" aria-hidden="true">${flag || esc(initialsOf(item))}</span>`}<div><small>${esc(type)}</small><h3>${esc(nameOf(item))}</h3><p>${flag ? `<span>${flag}</span>` : ''}${esc(meta)}</p>${stats ? `<div class="xms-statline">${stats}</div>` : ''}</div>${value ? `<b>${esc(value)}</b>` : ''}</article>`;
  }
  function emptyState(title, detail) {
    return `<div class="xms-empty"><strong>${esc(title)}</strong><p>${esc(detail)}</p></div>`;
  }
  function renderList(host, payload, type, empty) {
    const list = rows(payload?.data);
    host.innerHTML = list.length ? `<div class="xms-data-list">${list.slice(0, 60).map((item, index) => itemCard(item, index, type)).join('')}</div>` : emptyState(empty, 'Bu seri icin kayit gelmediginde baska bir bransin verisi gosterilmez.');
  }
  async function loadView(slug, view) {
    const host = document.getElementById('xmsData');
    if (!host) return;
    clearTimeout(liveTimer);
    host.innerHTML = '<div class="xms-loading"><i></i><span>Motor sporlari verisi yukleniyor</span></div>';
    if (unsupported[view]) {
      host.innerHTML = emptyState(...unsupported[view]);
      return;
    }
    try {
      if (view === 'overview') {
        const teamResource = ['wec', 'le-mans'].includes(slug) ? 'standings' : 'standings-teams';
        const [events, drivers, teams] = await Promise.all([
          api(slug, 'events'),
          api(slug, 'standings-drivers').catch(() => ({ data: [] })),
          api(slug, teamResource).catch(() => ({ data: [] }))
        ]);
        host.innerHTML = `<section class="xms-overview-block"><header><small>NEXT / RECENT EVENTS</small><h2>Yaris merkezi</h2></header><div class="xms-data-list">${rows(events.data).slice(0, 8).map((item, index) => itemCard(item, index, 'EVENT')).join('') || emptyState('Etkinlik bulunamadi.', 'Saglayicidan yeni takvim kaydi bekleniyor.')}</div></section><section class="xms-overview-split"><div><h2>${series[slug][2] === 'moto' ? 'Surucu siralamasi' : 'Pilot siralamasi'}</h2>${rows(drivers.data).slice(0, 8).map((item, index) => itemCard(item, index, 'DRIVER')).join('') || '<p>Kayit bekleniyor.</p>'}</div><div><h2>Takim / Uretici</h2>${rows(teams.data).slice(0, 8).map((item, index) => itemCard(item, index, 'TEAM')).join('') || '<p>Kayit bekleniyor.</p>'}</div></section>`;
        return;
      }
      const resource = resourceMap[view];
      if (!resource) {
        host.innerHTML = emptyState('Bu veri tipi pakette bulunmuyor.', 'Yanlis veya baska bir spor dalina ait veri gosterilmiyor.');
        return;
      }
      const payload = await api(slug, resource);
      if (view === 'live' && !payload.liveSupported && rows(payload?.data).length === 0) {
        host.innerHTML = emptyState('Canli timing bu seride saglayici tarafindan sunulmuyor.', 'Takvim, sonuclar ve siralamalar statik API snapshotindan gosterilmeye devam eder.');
        return;
      }
      renderList(host, payload, view.toUpperCase(), `${series[slug][0]} icin ${view} kaydi bulunamadi.`);
      if (view === 'live') liveTimer = window.setTimeout(() => loadView(slug, 'live'), 60000);
    } catch (error) {
      host.innerHTML = emptyState('Veri akisi su anda yenileniyor.', error.message);
    }
  }
  function shell(slug) {
    const [label, accent, discipline] = series[slug] || ['Motor Sporlari', '#ef3e4f', 'hub'];
    const detail = Boolean(series[slug]);
    return `<main class="xms-shell xms-${discipline}" style="--xms-accent:${accent}"><header class="xms-hero"><div class="xms-hero-copy"><span>XYZSKOR / SPORTS INTELLIGENCE</span><h1>${detail ? label : 'Hizin veriye donustugu merkez.'}</h1><p>${detail ? 'Seriye ozel takvim, sonuc, siralama ve canli veri deneyimi.' : 'Formula, motosiklet, rally, endurance ve stock car serilerini tek teknik veri mimarisinde takip et.'}</p><b>PROVIDER DATA</b></div><div class="xms-hero-visual" aria-hidden="true"><i></i><strong>${detail ? label : 'MOTORSPORT'}</strong><em>${discipline === 'rally' ? 'STAGE' : discipline === 'endurance' ? '24H' : discipline === 'moto' ? 'RACE' : discipline === 'stock' ? 'STAGE 01' : 'P1'}</em></div></header>${detail ? `${classSwitch(slug)}<nav class="xms-series-nav">${viewsFor(slug).map(([key, text], index) => `<button data-xms-view="${key}" class="${index === 0 ? 'active' : ''}">${text}</button>`).join('')}</nav><section id="xmsData" class="xms-data-stage" aria-live="polite"></section>` : `<section class="xms-catalog">${groups.map(([group, items]) => `<article><small>${group}</small>${items.map(([name, key]) => `<a href="/motorsports/${key}"><strong>${name}</strong><span>Takvim / Sonuc / Siralama</span></a>`).join('')}</article>`).join('')}</section>`}<nav class="xms-mobile"><a href="/motorsports">Home</a><a data-mobile-view="live" href="#live">Live</a><a data-mobile-view="calendar" href="#calendar">Calendar</a><a data-mobile-view="standings" href="#standings">Standings</a><a href="#more">More</a></nav></main>`;
  }
  function init() {
    const header = document.querySelector('.global-header');
    if (!header || document.querySelector('.xms-primary')) return;
    const nav = document.createElement('nav');
    nav.className = 'xms-primary';
    nav.innerHTML = `<div class="xms-primary-inner"><a href="/">FUTBOL</a><a href="/basketbol/">BASKETBOL</a><a href="/voleybol/">VOLEYBOL</a><button class="xms-trigger ${isMotor() ? 'active' : ''}">MOTORSPORLARI</button><a href="/predict/">PREDICT</a><div class="xms-mega" hidden>${menu()}</div></div>`;
    header.after(nav);
    const trigger = nav.querySelector('.xms-trigger');
    const mega = nav.querySelector('.xms-mega');
    trigger.onclick = () => { mega.hidden = !mega.hidden; };
    document.addEventListener('click', event => { if (!nav.contains(event.target)) mega.hidden = true; });
    if (!isMotor()) return;
    const slug = parts()[1] || '';
    document.body.classList.add('motorsport-open');
    document.body.dataset.motorsport = slug || 'hub';
    document.querySelectorAll('body > .wrap, #multiSportHub, .sport-branch-nav').forEach(element => { element.hidden = true; });
    nav.insertAdjacentHTML('afterend', shell(slug));
    if (!series[slug]) return;
    const activate = view => {
      const button = document.querySelector(`[data-xms-view="${view}"]`);
      if (!button) return;
      document.querySelectorAll('[data-xms-view]').forEach(item => item.classList.toggle('active', item === button));
      loadView(slug, view);
    };
    document.querySelectorAll('[data-xms-view]').forEach(button => { button.onclick = () => activate(button.dataset.xmsView); });
    document.querySelectorAll('[data-mobile-view]').forEach(link => { link.onclick = event => { event.preventDefault(); activate(link.dataset.mobileView); }; });
    activate('overview');
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init, { once: true }) : init();
})();
