(() => {
  const categories = [
    { id: 'single-seater', label: 'Tek koltuklu', menuLabel: 'TEK KOLTUKLU', kind: 'Seri', series: ['formula-1', 'formula-e', 'indycar'] },
    { id: 'motorcycle', label: 'Pist motosikleti', menuLabel: 'MOTOSİKLET', kind: 'Sınıf', series: ['motogp', 'moto2', 'moto3'] },
    { id: 'rally', label: 'Ralli', menuLabel: 'RALLİ', kind: 'Seri', series: ['wrc'] },
    { id: 'endurance', label: 'Dayanıklılık', menuLabel: 'DAYANIKLILIK', kind: 'Seri / yarış', series: ['wec', 'le-mans'] },
    { id: 'stock-car', label: 'Stock car', menuLabel: 'STOCK CAR', kind: 'Seri', series: ['nascar'] },
  ];
  const series = {
    'formula-1': { label: 'Formula 1', accent: '#ef4557', discipline: 'Formula', category: 'single-seater', classification: 'Şampiyona serisi', mark: 'F1' },
    'formula-e': { label: 'Formula E', accent: '#42b7ff', discipline: 'Elektrik', category: 'single-seater', classification: 'Elektrikli şampiyona serisi', mark: 'FE' },
    indycar: { label: 'IndyCar', accent: '#229bdd', discipline: 'Formula', category: 'single-seater', classification: 'Şampiyona serisi', mark: 'INDY' },
    motogp: { label: 'MotoGP', accent: '#ff793d', discipline: 'Motosiklet', category: 'motorcycle', classification: 'Premier sınıf', mark: 'GP' },
    moto2: { label: 'Moto2', accent: '#ef914a', discipline: 'Motosiklet', category: 'motorcycle', classification: 'Orta sınıf', mark: 'M2' },
    moto3: { label: 'Moto3', accent: '#efb04a', discipline: 'Motosiklet', category: 'motorcycle', classification: 'Hafif sınıf', mark: 'M3' },
    wrc: { label: 'WRC', accent: '#6bd690', discipline: 'Ralli', category: 'rally', classification: 'Dünya ralli serisi', mark: 'WRC' },
    wec: { label: 'WEC', accent: '#947cff', discipline: 'Dayanıklılık', category: 'endurance', classification: 'Dayanıklılık serisi', mark: 'WEC' },
    'le-mans': { label: 'Le Mans', accent: '#a58bff', discipline: 'Dayanıklılık', category: 'endurance', classification: 'Dayanıklılık yarışı', mark: 'LM' },
    nascar: { label: 'NASCAR Cup Series', accent: '#e9c94f', discipline: 'Stock car', category: 'stock-car', classification: 'Cup serisi', mark: 'NASCAR' },
  };
  const groups = categories.map((category) => [category.menuLabel, category.series.map((slug) => [series[slug].label, slug])]);
  const categoryById = Object.fromEntries(categories.map((category) => [category.id, category]));
  const viewRegistry = {
    Formula: [['overview', 'Genel'], ['calendar', 'Takvim'], ['results', 'Sonuçlar'], ['standings', 'Sıralama'], ['drivers', 'Pilotlar'], ['teams', 'Takımlar'], ['circuits', 'Pistler'], ['live', 'Canlı']],
    Elektrik: [['overview', 'Genel'], ['calendar', 'Takvim'], ['results', 'Sonuçlar'], ['standings', 'Sıralama'], ['drivers', 'Pilotlar'], ['teams', 'Takımlar'], ['live', 'Canlı']],
    Motosiklet: [['overview', 'Genel'], ['calendar', 'Takvim'], ['results', 'Sonuçlar'], ['standings', 'Sıralama'], ['riders', 'Sürücüler'], ['teams', 'Takımlar'], ['live', 'Canlı']],
    Ralli: [['overview', 'Genel'], ['calendar', 'Takvim'], ['stages', 'Etaplar'], ['results', 'Sonuçlar'], ['standings', 'Sıralama'], ['drivers', 'Pilotlar'], ['teams', 'Takımlar'], ['live', 'Canlı']],
    Dayanıklılık: [['overview', 'Genel'], ['calendar', 'Takvim'], ['results', 'Sonuçlar'], ['standings', 'Sıralama'], ['drivers', 'Pilotlar'], ['teams', 'Takımlar'], ['live', 'Canlı']],
    'Stock car': [['overview', 'Genel'], ['calendar', 'Takvim'], ['results', 'Sonuçlar'], ['standings', 'Sıralama'], ['drivers', 'Pilotlar'], ['teams', 'Takımlar'], ['live', 'Canlı']],
  };
  const resourceMap = {
    calendar: 'events',
    results: 'events',
    standings: 'standings-drivers',
    drivers: 'drivers',
    riders: 'drivers',
    teams: 'teams',
    circuits: 'circuits',
    live: 'live',
  };
  const dynamicResources = new Set(['drivers', 'teams', 'standings-drivers', 'standings-teams', 'standings']);
  const rowKeys = ['data', 'response', 'items', 'results', 'events', 'drivers', 'teams', 'seasons', 'standings', 'circuits', 'value', 'rows'];
  const MOTORSPORT_TAGLINE = 'Hızın veriye dönüştüğü merkez.';
  const parts = () => location.pathname.split('/').filter(Boolean);
  const isMotor = () => parts()[0] === 'motorsports';
  const currentQuery = () => new URLSearchParams(location.search);
  const escapeHTML = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function viewFromLocation(slug) {
    const requested = currentQuery().get('view') || 'overview';
    return viewsFor(slug).some(([view]) => view === requested) ? requested : 'overview';
  }

  function rankingClassFromLocation() {
    return currentQuery().get('class') || '';
  }

  function seriesHref(slug, view = 'overview') {
    const targetView = viewsFor(slug).some(([supportedView]) => supportedView === view) ? view : 'overview';
    const query = new URLSearchParams();
    if (targetView !== 'overview') query.set('view', targetView);
    return `/motorsports/${slug}${query.size ? `?${query}` : ''}`;
  }

  function updateRouteQuery(view, rankingClass = '', replace = false) {
    const url = new URL(location.href);
    if (view && view !== 'overview') url.searchParams.set('view', view);
    else url.searchParams.delete('view');
    if (rankingClass && (view === 'overview' || view === 'standings')) url.searchParams.set('class', rankingClass);
    else url.searchParams.delete('class');
    const target = `${url.pathname}${url.search}${url.hash}`;
    if (target === `${location.pathname}${location.search}${location.hash}`) return;
    history[replace ? 'replaceState' : 'pushState']({ xyzProduct: 'motorsports', view, rankingClass }, '', target);
    window.XYZBranchRouter?.syncMetadata?.(location.pathname, location.search);
  }

  function rows(value) {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return [];
    for (const key of rowKeys) if (Array.isArray(value[key])) return value[key];
    for (const nested of Object.values(value)) if (Array.isArray(nested)) return nested;
    return [];
  }

  function scalar(value, keys = ['name', 'fullName', 'displayName', 'title', 'eventName', 'year', 'season', 'value', 'label', 'code']) {
    if (value == null) return '';
    if (['string', 'number', 'boolean'].includes(typeof value)) return String(value);
    if (Array.isArray(value)) return value.map((item) => scalar(item, keys)).filter(Boolean).join(' / ');
    for (const key of keys) {
      const resolved = scalar(value?.[key], keys);
      if (resolved) return resolved;
    }
    return '';
  }

  function nameOf(item) {
    const person = [scalar(item?.firstName), scalar(item?.lastName)].filter(Boolean).join(' ');
    const resolved = person || scalar(item, ['name', 'fullName', 'displayName', 'title', 'eventName', 'slug']) || scalar(item?.driver) || scalar(item?.team) || scalar(item?.constructor);
    return resolved && !/^\[?object(?: object)?\]?$/i.test(resolved.trim()) ? resolved : 'Kayıt';
  }

  const imageOf = (item) => scalar(item?.image || item?.logo || item?.photo || item?.avatar || item?.driver?.image || item?.team?.logo, ['url', 'src', 'href']);
  const teamOf = (item) => scalar(item?.team || item?.teams?.[0] || item?.constructor, ['name', 'shortName', 'fullName', 'displayName']);
  const dateOf = (item) => scalar(item?.dateStart || item?.startDate || item?.date || item?.scheduledAt || item?.start, ['date', 'value', 'label']);
  const countryOf = (item) => scalar(item?.country || item?.nationality || item?.location?.country, ['name', 'label', 'twoCode']);
  const locationOf = (item) => scalar(item?.location, ['name', 'city', 'title']) || countryOf(item);
  const statusOf = (item) => scalar(item?.status, ['name', 'long', 'short', 'label', 'value']).toLowerCase();
  const pointsOf = (item) => item?.points ?? item?.score ?? item?.totalPoints ?? '';
  const positionOf = (item) => item?.position ?? item?.rank ?? item?.place ?? '';
  const initialsOf = (item) => nameOf(item).split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'MS';
  const rankingResource = (slug) => ['wec', 'le-mans'].includes(slug) ? 'standings' : 'standings-drivers';

  function parseDate(value) {
    const date = value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime()) ? date : null;
  }

  function dateLabel(value, compact = false) {
    const date = parseDate(value);
    if (!date) return 'Tarih bekleniyor';
    return new Intl.DateTimeFormat('tr-TR', compact
      ? { day: '2-digit', month: 'short', timeZone: 'Europe/Istanbul' }
      : { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(date);
  }

  function eventIsComplete(event) {
    return /completed|finished|ended|final|done/.test(statusOf(event));
  }

  function eventIsLive(event) {
    return /live|running|in.progress|active/.test(statusOf(event));
  }

  function sortEvents(items) {
    const now = Date.now();
    return [...items].sort((left, right) => {
      const leftTime = parseDate(dateOf(left))?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightTime = parseDate(dateOf(right))?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const leftPast = eventIsComplete(left) || leftTime < now;
      const rightPast = eventIsComplete(right) || rightTime < now;
      if (leftPast !== rightPast) return leftPast ? 1 : -1;
      return leftPast ? rightTime - leftTime : leftTime - rightTime;
    });
  }

  function eventStatusLabel(event) {
    if (eventIsLive(event)) return 'CANLI';
    if (eventIsComplete(event)) return 'TAMAMLANDI';
    const date = parseDate(dateOf(event));
    return date && date.getTime() < Date.now() ? 'PROGRAM GEÇTİ' : 'YAKLAŞAN';
  }

  let snapshotPromise = null;
  async function snapshotResource(sport, resource) {
    if (!snapshotPromise) {
      snapshotPromise = fetch('/assets/data/motorsports-snapshot.json', { cache: 'no-cache' })
        .then((response) => {
          if (!response.ok) throw new Error('snapshot_unavailable');
          return response.json();
        })
        .catch((error) => {
          snapshotPromise = null;
          throw error;
        });
    }
    const snapshot = await snapshotPromise;
    return {
      source: snapshot.source || 'orange-cat-blacktop',
      updatedAt: snapshot.fetchedAt || '',
      snapshot: true,
      stale: true,
      liveSupported: false,
      data: snapshot.sports?.[sport]?.[resource] || [],
    };
  }

  async function api(sport, resource, options = {}) {
    if (!dynamicResources.has(resource) && resource !== 'live') return snapshotResource(sport, resource);
    try {
      const response = await fetch(`/api/motorsports?sport=${encodeURIComponent(sport)}&resource=${encodeURIComponent(resource)}&limit=100&page=1&profile=v2`, {
        headers: { Accept: 'application/json' },
        signal: options.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'motorsport_profile_unavailable');
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError' || resource === 'live') throw error;
      const fallback = await snapshotResource(sport, resource);
      if (rows(fallback.data).length) return { ...fallback, degraded: true };
      throw error;
    }
  }

  function menuHTML() {
    return groups.map(([group, items]) => `<section class="xms-mega-group"><strong>${escapeHTML(group)}</strong>${items.map(([label, slug]) => `<a data-classification-key="${escapeHTML(slug)}" href="/motorsports/${slug}">${escapeHTML(label)}</a>`).join('')}</section>`).join('');
  }

  function fallbackNavigation() {
    const nav = document.createElement('nav');
    nav.className = 'xms-primary xms-fallback-primary';
    nav.setAttribute('aria-label', 'Spor branşları');
    nav.innerHTML = `<div class="xms-primary-inner"><a href="/">ANA SAYFA</a><a href="/basketbol/">BASKETBOL</a><a href="/voleybol/">VOLEYBOL</a><a href="/ufc/">UFC</a><button type="button" class="xms-trigger active" aria-expanded="false" aria-controls="xmsFallbackMega">MOTORSPORLARI</button><a href="/predict/">PREDICT</a><div class="xms-mega" id="xmsFallbackMega" hidden>${menuHTML()}</div></div>`;
    const trigger = nav.querySelector('.xms-trigger');
    const mega = nav.querySelector('.xms-mega');
    const close = () => { mega.hidden = true; trigger.setAttribute('aria-expanded', 'false'); };
    trigger.addEventListener('click', () => {
      mega.hidden = !mega.hidden;
      trigger.setAttribute('aria-expanded', String(!mega.hidden));
    });
    document.addEventListener('click', (event) => { if (!nav.contains(event.target)) close(); });
    nav.addEventListener('keydown', (event) => { if (event.key === 'Escape') { close(); trigger.focus(); } });
    return nav;
  }

  function seriesPickerHTML(slug) {
    const selectedView = slug ? viewFromLocation(slug) : 'overview';
    return `<strong>SERİLER</strong><div><a data-classification-key="all" class="${!slug ? 'active' : ''}" href="/motorsports/" ${!slug ? 'aria-current="page"' : ''}><b>Tümü</b><small>Tüm kategoriler</small></a>${Object.entries(series).map(([key, config]) => `<a data-classification-key="${escapeHTML(key)}" class="${key === slug ? 'active' : ''}" href="${seriesHref(key, selectedView)}" ${key === slug ? 'aria-current="page"' : ''}><b>${escapeHTML(config.label)}</b><small>${escapeHTML(categoryById[config.category].label)}</small></a>`).join('')}</div>`;
  }

  function viewsFor(slug) {
    return viewRegistry[series[slug]?.discipline] || viewRegistry.Formula;
  }

  function shellHTML(slug) {
    const config = series[slug] || { label: 'Motor Sporları', accent: '#ef4557', discipline: 'Tüm seriler', mark: 'MS' };
    const category = categoryById[config.category] || null;
    const detail = Boolean(series[slug]);
    return `<main class="xms-shell xms-center-shell" style="--xms-accent:${config.accent}">
      <section class="xms-center" data-xms-center>
        <header class="xms-center-identity">
          <span class="xms-center-mark" aria-hidden="true"><b>${escapeHTML(config.mark)}</b></span>
          <div><small>XYZSKOR · MOTOR SPORLARI ${detail ? 'SERİ' : 'LİG'} MERKEZİ</small><h1 data-classification-title>${escapeHTML(config.label)}</h1><p data-xms-center-meta>${detail ? `${escapeHTML(category.label)} · ${escapeHTML(config.classification)} · güncel sezon` : `${MOTORSPORT_TAGLINE} Formula, motosiklet, ralli, dayanıklılık ve stock car.`}</p></div>
          <span class="xms-center-data-state" data-xms-data-state>VERİ KAPSAMI HAZIRLANIYOR</span>
        </header>
        ${detail ? `<nav class="xms-center-tabs" role="tablist" aria-label="${escapeHTML(config.label)} görünümü">${viewsFor(slug).map(([key, label], index) => `<button type="button" role="tab" id="xmsTab-${key}" aria-controls="xmsData" aria-selected="${index === 0}" tabindex="${index === 0 ? '0' : '-1'}" data-xms-view="${key}" class="${index === 0 ? 'active' : ''}">${escapeHTML(label)}</button>`).join('')}</nav><section id="xmsData" class="xms-center-stage" role="tabpanel" aria-labelledby="xmsTab-overview" aria-live="polite"></section>` : `<section id="xmsHubData" class="xms-center-stage" aria-live="polite">${hubLoadingHTML()}</section>`}
      </section>
    </main>`;
  }

  function skeletonRowsHTML(count = 8) {
    return Array.from({ length: count }, (_, index) => `<div class="xms-center-skeleton-row" style="--xms-skeleton-index:${index}"><i></i><i></i><i></i></div>`).join('');
  }

  function overviewLoadingHTML() {
    return `<div class="xms-center-layout" aria-busy="true"><section class="xms-center-panel"><header><div><small>GÜNCEL SEZON</small><h2>Sıralama</h2></div></header><div class="xms-center-skeleton">${skeletonRowsHTML(9)}</div></section><aside class="xms-center-panel"><header><div><small>YARIŞ AKIŞI</small><h2>Takvim</h2></div></header><div class="xms-center-skeleton">${skeletonRowsHTML(6)}</div></aside></div><p class="xms-sr-status" role="status">Motor sporları merkezi hazırlanıyor</p>`;
  }

  function hubLoadingHTML() {
    return `<div class="xms-center-layout" aria-busy="true"><section class="xms-center-panel"><header><div><small>GÜNCEL PROGRAM</small><h2>Yaklaşan yarışlar</h2></div></header><div class="xms-center-skeleton">${skeletonRowsHTML(8)}</div></section><aside class="xms-center-panel"><header><div><small>SERİLER</small><h2>Merkezler</h2></div></header><div class="xms-center-skeleton">${skeletonRowsHTML(5)}</div></aside></div>`;
  }

  function emptyState(title, detail) {
    return `<div class="xms-center-empty" role="status"><span aria-hidden="true">—</span><strong>${escapeHTML(title)}</strong><p>${escapeHTML(detail)}</p></div>`;
  }

  function errorState(title, detail) {
    return `<div class="xms-center-error" role="alert"><small>SAĞLAYICI DURUMU</small><h2>${escapeHTML(title)}</h2><p>${escapeHTML(detail)}</p><button type="button" data-xms-retry>Yeniden dene</button></div>`;
  }

  function unknownSeriesState(slug) {
    return `<div class="xms-center-error" role="alert"><small>SERİ ROTASI</small><h2>Motor sporları serisi bulunamadı.</h2><p>${escapeHTML(slug)} için doğrulanmış bir seri merkezi tanımlı değil. Başka bir serinin verisi bu adrese yerleştirilmedi.</p><a href="/motorsports/">Tüm serilere dön</a></div>`;
  }

  function eventRowsHTML(items, limit = 10) {
    const sorted = sortEvents(items).slice(0, limit);
    if (!sorted.length) return emptyState('Doğrulanmış yarış kaydı bulunamadı.', 'Başka bir serinin takvimi bu alana taşınmaz; sağlayıcının bu seri için yeni kayıt yayınlaması beklenir.');
    return `<ol class="xms-event-list">${sorted.map((event, index) => {
      const rawDate = dateOf(event);
      const state = eventIsLive(event) ? ' is-live' : eventIsComplete(event) ? ' is-complete' : '';
      return `<li class="xms-event-row${state}" style="--xms-row-index:${index}"><time datetime="${escapeHTML(rawDate)}"><b>${escapeHTML(dateLabel(rawDate, true))}</b><small>${escapeHTML(eventStatusLabel(event))}</small></time><div><strong>${escapeHTML(nameOf(event))}</strong><span>${escapeHTML(locationOf(event) || 'Konum bilgisi bekleniyor')}</span></div><em aria-label="Durum">${escapeHTML(eventStatusLabel(event))}</em></li>`;
    }).join('')}</ol>`;
  }

  function normalizeRanking(payload) {
    const values = rows(payload?.data);
    if (!values.length) return [];
    if (values.some((item) => Array.isArray(item?.rows))) {
      return values.filter((item) => Array.isArray(item?.rows) && item.rows.length).map((item, index) => ({
        id: scalar(item?.code) || `class-${index}`,
        label: scalar(item?.classLabel || item?.name) || `Sınıf ${index + 1}`,
        rows: item.rows,
      }));
    }
    return [{ id: 'overall', label: 'Genel', rows: values }];
  }

  function rankingRowHTML(item, index) {
    const team = teamOf(item);
    const points = pointsOf(item);
    return `<tr class="xms-ranking-row" style="--xms-row-index:${index}"><td class="rank">${escapeHTML(positionOf(item) || '—')}</td><th scope="row"><span class="xms-ranking-person"><span aria-hidden="true">${escapeHTML(initialsOf(item))}</span><span><strong>${escapeHTML(nameOf(item))}</strong>${team ? `<small>${escapeHTML(team)}</small>` : ''}</span></span></th><td>${escapeHTML(item?.number ?? '—')}</td><td class="points">${points === '' || points == null ? '—' : escapeHTML(points)}</td></tr>`;
  }

  function rankingGroupsHTML(groups, label) {
    if (!groups.length) return emptyState('Doğrulanmış sıralama henüz yok.', 'Puan veya pozisyon bulunmadığında katılımcılar sıralamaymış gibi gösterilmez.');
    const requestedClass = rankingClassFromLocation();
    const requestedIndex = groups.findIndex((group) => group.id === requestedClass);
    const activeIndex = requestedIndex >= 0 ? requestedIndex : 0;
    const controls = groups.length > 1 ? `<nav class="xms-ranking-classes" role="tablist" aria-label="Sağlayıcının şampiyona sınıfları" data-sport-classification="championship-class">${groups.map((group, index) => `<button type="button" role="tab" id="xmsRankingClass-${index}" aria-controls="xmsRankingGroup-${index}" aria-selected="${index === activeIndex}" tabindex="${index === activeIndex ? '0' : '-1'}" data-xms-ranking-class="${index}" data-classification-key="${escapeHTML(group.id)}" class="${index === activeIndex ? 'active' : ''}">${escapeHTML(group.label)}</button>`).join('')}</nav>` : '';
    const tabpanelAttributes = (groupIndex) => groups.length > 1 ? `role="tabpanel" aria-labelledby="xmsRankingClass-${groupIndex}"` : '';
    return `${controls}${groups.map((group, groupIndex) => `<div id="xmsRankingGroup-${groupIndex}" class="xms-ranking-group" ${tabpanelAttributes(groupIndex)} data-xms-ranking-group="${groupIndex}" ${groupIndex !== activeIndex ? 'hidden' : ''}><div class="xms-ranking-scroll" tabindex="0" role="region" aria-label="${escapeHTML(group.label)} sıralaması"><table class="xms-ranking-table"><caption>${escapeHTML(label)} · ${escapeHTML(group.label)} sıralaması</caption><thead><tr><th scope="col">#</th><th scope="col">PİLOT / EKİP</th><th scope="col">NO</th><th scope="col">PUAN</th></tr></thead><tbody>${group.rows.map(rankingRowHTML).join('')}</tbody></table></div></div>`).join('')}`;
  }

  function participantCardsHTML(items, type) {
    if (!items.length) return emptyState(`${type} kaydı bulunamadı.`, 'Bu seri için doğrulanmış katılımcı geldiğinde liste otomatik güncellenir.');
    return `<div class="xms-participant-grid">${items.slice(0, 60).map((item, index) => {
      const image = imageOf(item);
      const meta = teamOf(item) || countryOf(item) || scalar(item?.location);
      return `<article class="xms-participant-card" style="--xms-row-index:${index}">${image ? `<img src="${escapeHTML(image)}" alt="" loading="lazy">` : `<span class="xms-participant-avatar" aria-hidden="true">${escapeHTML(initialsOf(item))}</span>`}<div><small>${escapeHTML(type)}</small><h3>${escapeHTML(nameOf(item))}</h3><p>${escapeHTML(meta || 'Ayrıntı bekleniyor')}</p></div>${positionOf(item) ? `<b>${escapeHTML(positionOf(item))}</b>` : ''}</article>`;
    }).join('')}</div>`;
  }

  function seasonFrom(payload) {
    const seasons = rows(payload?.data).map((item) => Number(scalar(item, ['year', 'season', 'value']))).filter(Number.isFinite);
    return seasons.length ? Math.max(...seasons) : '';
  }

  function sourceDate(payloads) {
    const dates = payloads.map((payload) => parseDate(payload?.updatedAt)).filter(Boolean).sort((a, b) => b - a);
    return dates[0] ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(dates[0]) : '';
  }

  function bindRankingClasses(host, view) {
    const buttons = [...host.querySelectorAll('[data-xms-ranking-class]')];
    if (!buttons.length) {
      if (rankingClassFromLocation()) updateRouteQuery(view, '', true);
      return;
    }
    const activate = (button, focus = false, persist = true) => {
      const selected = button.dataset.xmsRankingClass;
      buttons.forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
        item.tabIndex = active ? 0 : -1;
      });
      host.querySelectorAll('[data-xms-ranking-group]').forEach((group) => { group.hidden = group.dataset.xmsRankingGroup !== selected; });
      if (focus) button.focus();
      if (persist) updateRouteQuery(view, button.dataset.classificationKey || '');
    };
    buttons.forEach((button, index) => {
      button.addEventListener('click', () => activate(button));
      button.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
        activate(buttons[nextIndex], true);
      });
    });
    if (rankingClassFromLocation() && !buttons.some((button) => button.dataset.classificationKey === rankingClassFromLocation())) {
      updateRouteQuery(view, '', true);
    }
  }

  function updateIdentity(slug, season, payloads) {
    const meta = document.querySelector('[data-xms-center-meta]');
    const state = document.querySelector('[data-xms-data-state]');
    const config = series[slug];
    const category = categoryById[config?.category];
    if (meta && config) meta.textContent = [category?.label, config.classification, season ? `${season} sezonu` : 'güncel sezon'].filter(Boolean).join(' · ');
    if (!state) return;
    const snapshot = payloads.some((payload) => payload?.snapshot || payload?.stale || payload?.degraded);
    state.textContent = snapshot ? 'SON DOĞRULANMIŞ KAYIT' : 'GÜNCEL SAĞLAYICI VERİSİ';
    state.classList.toggle('is-snapshot', snapshot);
  }

  function overviewHTML(slug, payloads) {
    const [eventsPayload, rankingPayload, teamsPayload, seasonsPayload] = payloads;
    const events = rows(eventsPayload?.data);
    const rankings = normalizeRanking(rankingPayload);
    const rankingCount = rankings.reduce((total, group) => total + group.rows.length, 0);
    const teams = rows(teamsPayload?.data);
    const season = seasonFrom(seasonsPayload);
    const sorted = sortEvents(events);
    const upcoming = events.filter((event) => !eventIsComplete(event) && (parseDate(dateOf(event))?.getTime() ?? Infinity) >= Date.now()).length;
    const completed = events.filter((event) => eventIsComplete(event)).length;
    const next = sorted.find((event) => !eventIsComplete(event)) || null;
    const updated = sourceDate(payloads);
    updateIdentity(slug, season, payloads);
    return `<div class="xms-center-layout"><section class="xms-center-panel xms-ranking-panel" aria-labelledby="xmsRankingTitle"><header><div><small>GÜNCEL SEZON</small><h2 id="xmsRankingTitle">${series[slug].discipline === 'Motosiklet' ? 'Sürücü sıralaması' : 'Pilot sıralaması'}</h2></div><span>${season ? escapeHTML(season) : 'SEZON'}</span></header>${rankingGroupsHTML(rankings, series[slug].label)}</section><aside class="xms-center-panel xms-calendar-panel" aria-labelledby="xmsCalendarTitle"><header><div><small>YARIŞ AKIŞI</small><h2 id="xmsCalendarTitle">Sonuçlar ve takvim</h2></div><span>${events.length} YARIŞ</span></header>${eventRowsHTML(events, 8)}</aside></div><section class="xms-center-metrics" aria-label="Seçili seri özeti"><article><span>SEZON PROGRAMI</span><b>${events.length}</b><small>doğrulanmış yarış</small></article><article><span>YAKLAŞAN</span><b class="is-live">${upcoming}</b><small>programda</small></article><article><span>TAMAMLANAN</span><b>${completed}</b><small>sonuç kaydı</small></article><article><span>SIRALAMA</span><b>${rankingCount}</b><small>${teams.length ? `${teams.length} takım · ` : ''}kayıt</small></article></section><section class="xms-center-lower"><article class="xms-next-event"><header><small>SIRADAKİ YARIŞ</small><h2>${escapeHTML(next ? nameOf(next) : 'Program bekleniyor')}</h2></header>${next ? `<div><time datetime="${escapeHTML(dateOf(next))}">${escapeHTML(dateLabel(dateOf(next)))}</time><strong>${escapeHTML(locationOf(next) || 'Konum bilgisi bekleniyor')}</strong><span>${escapeHTML(eventStatusLabel(next))}</span></div>` : emptyState('Yaklaşan yarış bulunamadı.', 'Takvimde doğrulanmış yeni yarış yayınlandığında burada görünür.')}</article><article class="xms-source-note"><small>VERİ KAPSAMI</small><h2>Seriye bağlı, şeffaf görünüm</h2><p>Takvim ve sıralama yalnızca seçili serinin sağlayıcı kayıtlarından oluşur. Eksik puan veya sonuçlar başka bir seriyle tamamlanmaz.</p><span>${escapeHTML(updated ? `Son kayıt: ${updated}` : 'Güncelleme zamanı sağlayıcıdan bekleniyor')}</span></article></section>`;
  }

  function bindRetry(host, slug, view) {
    host.querySelector('[data-xms-retry]')?.addEventListener('click', () => loadView(slug, view, true));
  }

  let activeMotorSelection = null;
  let activeMotorRequest = null;
  let requestEpoch = 0;
  let liveTimer = 0;

  async function loadViewOnce(slug, view, request) {
    const host = document.getElementById('xmsData');
    if (!host) return;
    const current = () => activeMotorRequest === request && !request.controller?.signal.aborted && isMotor() && parts()[1] === slug && activeMotorSelection?.scope === request.scope;
    host.setAttribute('aria-labelledby', `xmsTab-${view}`);
    host.innerHTML = view === 'overview' ? overviewLoadingHTML() : `<div class="xms-center-panel xms-view-loading" aria-busy="true"><div class="xms-center-skeleton">${skeletonRowsHTML(10)}</div><p class="xms-sr-status" role="status">${escapeHTML(series[slug].label)} verisi hazırlanıyor</p></div>`;
    if (view === 'stages') {
      host.innerHTML = emptyState('Etap verisi sağlayıcı paketinde bulunmuyor.', 'Ayrı ve doğrulanmış etap akışı sunulmadan başka bir yarış türünün sonucu gösterilmez.');
      return;
    }
    try {
      if (view === 'overview') {
        const payloads = await Promise.all([
          api(slug, 'events', { signal: request.controller?.signal }),
          api(slug, rankingResource(slug), { signal: request.controller?.signal }).catch(() => ({ data: [] })),
          api(slug, 'teams', { signal: request.controller?.signal }).catch(() => ({ data: [] })),
          api(slug, 'seasons', { signal: request.controller?.signal }).catch(() => ({ data: [] })),
        ]);
        if (!current()) return;
        host.innerHTML = overviewHTML(slug, payloads);
        bindRankingClasses(host, view);
        return;
      }
      const resource = view === 'standings' ? rankingResource(slug) : resourceMap[view];
      if (!resource) {
        host.innerHTML = emptyState('Bu veri türü sağlayıcı paketinde bulunmuyor.', 'Yanlış veya başka bir spor dalına ait kayıt gösterilmez.');
        return;
      }
      const payload = await api(slug, resource, { signal: request.controller?.signal });
      if (!current()) return;
      updateIdentity(slug, '', [payload]);
      const list = rows(payload?.data);
      if (view === 'calendar' || view === 'results') {
        const filtered = view === 'results' ? list.filter(eventIsComplete) : list;
        host.innerHTML = `<section class="xms-center-panel xms-single-panel"><header><div><small>${view === 'results' ? 'TAMAMLANAN' : 'SEZON PROGRAMI'}</small><h2>${view === 'results' ? 'Yarış sonuçları' : 'Yarış takvimi'}</h2></div><span>${filtered.length} KAYIT</span></header>${eventRowsHTML(filtered, 60)}</section>`;
      } else if (view === 'standings') {
        host.innerHTML = `<section class="xms-center-panel xms-single-panel"><header><div><small>GÜNCEL SEZON</small><h2>Şampiyona sıralaması</h2></div></header>${rankingGroupsHTML(normalizeRanking(payload), series[slug].label)}</section>`;
        bindRankingClasses(host, view);
      } else if (view === 'live') {
        host.innerHTML = payload.liveSupported && list.length
          ? `<section class="xms-center-panel xms-single-panel"><header><div><small>CANLI AKIŞ</small><h2>Timing</h2></div></header>${participantCardsHTML(list, 'CANLI')}</section>`
          : emptyState('Canlı timing bu seride sunulmuyor.', 'Takvim ve doğrulanmış sezon verileri kullanılabilir; canlı kayıt yokken simülasyon gösterilmez.');
        if (payload.liveSupported && list.length && current()) liveTimer = window.setTimeout(() => loadView(slug, 'live', true), 60000);
      } else {
        const type = view === 'teams' ? 'TAKIM' : view === 'circuits' ? 'PİST' : series[slug].discipline === 'Motosiklet' ? 'SÜRÜCÜ' : 'PİLOT';
        host.innerHTML = `<section class="xms-center-panel xms-single-panel"><header><div><small>DOĞRULANMIŞ KAYITLAR</small><h2>${view === 'teams' ? 'Takımlar' : view === 'circuits' ? 'Pistler' : type === 'SÜRÜCÜ' ? 'Sürücüler' : 'Pilotlar'}</h2></div><span>${list.length} KAYIT</span></header>${participantCardsHTML(list, type)}</section>`;
      }
    } catch (error) {
      if (error?.name === 'AbortError' || !current()) return;
      host.innerHTML = errorState('Veri bağlantısı şu anda kurulamadı.', 'Bu boş bir spor sonucu değildir. Bağlantı düzeldiğinde seçili serinin gerçek kayıtları yeniden yüklenecek.');
      bindRetry(host, slug, view);
    }
  }

  function loadView(slug, view, force = false) {
    const scope = `${slug}:${view}`;
    activeMotorSelection = { slug, view, scope };
    clearTimeout(liveTimer);
    liveTimer = 0;
    if (!force && activeMotorRequest?.scope === scope && !activeMotorRequest.controller?.signal.aborted) return activeMotorRequest.promise;
    activeMotorRequest?.controller?.abort();
    const request = {
      scope,
      controller: typeof AbortController !== 'undefined' ? new AbortController() : null,
      epoch: ++requestEpoch,
      promise: null,
    };
    request.promise = loadViewOnce(slug, view, request).finally(() => { if (activeMotorRequest === request) activeMotorRequest = null; });
    activeMotorRequest = request;
    return request.promise;
  }

  function stopMotorDemand() {
    clearTimeout(liveTimer);
    liveTimer = 0;
    requestEpoch += 1;
    activeMotorRequest?.controller?.abort();
    activeMotorRequest = null;
  }

  function hubCatalogHTML() {
    return `<div class="xms-hub-catalog">${groups.map(([group, items]) => `<section><small>${escapeHTML(group)}</small>${items.map(([label, slug]) => `<a data-classification-key="${escapeHTML(slug)}" href="/motorsports/${slug}"><span aria-hidden="true">${escapeHTML(series[slug].mark)}</span><strong>${escapeHTML(label)}</strong><em>Merkezi aç</em></a>`).join('')}</section>`).join('')}</div>`;
  }

  async function loadHub() {
    const host = document.getElementById('xmsHubData');
    if (!host) return;
    try {
      const entries = await Promise.all(Object.keys(series).map(async (slug) => [slug, await api(slug, 'events')]));
      if (!isMotor() || parts()[1]) return;
      const allEvents = entries.flatMap(([slug, payload]) => rows(payload?.data).map((event) => ({ ...event, __series: slug })));
      const uniqueEvents = [...new Map(allEvents.map((event) => [`${event.__series}:${event.id || nameOf(event)}:${dateOf(event)}`, event])).values()];
      const sorted = sortEvents(uniqueEvents);
      const upcoming = sorted.filter((event) => !eventIsComplete(event)).length;
      const updated = sourceDate(entries.map(([, payload]) => payload));
      document.querySelector('[data-xms-data-state]').textContent = 'SON DOĞRULANMIŞ KAYIT';
      host.innerHTML = `<div class="xms-center-layout"><section class="xms-center-panel"><header><div><small>GÜNCEL PROGRAM</small><h2>Yaklaşan yarışlar</h2></div><span>${uniqueEvents.length} KAYIT</span></header>${sorted.length ? `<ol class="xms-event-list">${sorted.slice(0, 12).map((event, index) => `<li class="xms-event-row" style="--xms-row-index:${index}"><time datetime="${escapeHTML(dateOf(event))}"><b>${escapeHTML(dateLabel(dateOf(event), true))}</b><small>${escapeHTML(series[event.__series].mark)}</small></time><div><strong>${escapeHTML(nameOf(event))}</strong><span>${escapeHTML(series[event.__series].label)} · ${escapeHTML(locationOf(event) || 'Konum bekleniyor')}</span></div><a href="/motorsports/${event.__series}" aria-label="${escapeHTML(series[event.__series].label)} merkezini aç">Aç</a></li>`).join('')}</ol>` : emptyState('Yaklaşan yarış bulunamadı.', 'Seri takvimleri sağlayıcıdan bekleniyor.')}</section><aside class="xms-center-panel"><header><div><small>SERİ MERKEZLERİ</small><h2>Tüm kategoriler</h2></div><span>${Object.keys(series).length} SERİ</span></header>${hubCatalogHTML()}</aside></div><section class="xms-center-metrics" aria-label="Motor sporları kapsamı"><article><span>SERİ</span><b>${Object.keys(series).length}</b><small>aktif merkez</small></article><article><span>KATEGORİ</span><b>${groups.length}</b><small>yarış ailesi</small></article><article><span>PROGRAM</span><b>${uniqueEvents.length}</b><small>doğrulanmış yarış</small></article><article><span>YAKLAŞAN</span><b class="is-live">${upcoming}</b><small>takvim kaydı</small></article></section><article class="xms-source-note xms-hub-source"><small>VERİ KAPSAMI</small><h2>Her seri kendi kaynağında</h2><p>Takvimler seri kimliğine göre ayrılır; boş bir kategori başka bir serinin verisiyle doldurulmaz.</p><span>${escapeHTML(updated ? `Son kayıt: ${updated}` : 'Güncelleme zamanı sağlayıcıdan bekleniyor')}</span></article>`;
    } catch (error) {
      if (!isMotor() || parts()[1]) return;
      host.innerHTML = errorState('Motor sporları programı alınamadı.', 'Bu boş sonuç değildir. Sağlayıcı bağlantısı düzeldiğinde seri takvimleri yeniden yüklenecek.');
      host.querySelector('[data-xms-retry]')?.addEventListener('click', () => { host.innerHTML = hubLoadingHTML(); loadHub(); });
    }
  }

  function init() {
    if (!isMotor() || document.querySelector('[data-xms-center]')) return;
    const header = document.querySelector('.global-header');
    if (!header) return;
    let branchNav = document.querySelector('.sport-branch-nav-compact');
    if (!branchNav) {
      branchNav = fallbackNavigation();
      header.after(branchNav);
    }
    const slug = parts()[1] || '';
    const picker = document.createElement('nav');
    picker.className = 'xms-series-picker xms-center-series-picker';
    picker.setAttribute('aria-label', 'Motor sporları seri seçimi');
    picker.setAttribute('data-sport-classification', 'series');
    picker.style.setProperty('--xms-accent', series[slug]?.accent || '#ef4557');
    picker.innerHTML = seriesPickerHTML(slug);
    branchNav.after(picker);
    document.body.classList.add('motorsport-open');
    document.body.dataset.motorsport = slug || 'hub';
    document.getElementById('miniGoalGame')?.remove();
    document.querySelectorAll('body > .wrap, #multiSportHub, .next-match-ticker, .predict-promo-banner').forEach((element) => { element.hidden = true; });
    picker.insertAdjacentHTML('afterend', shellHTML(slug));
    if (!slug) {
      loadHub();
      return;
    }
    if (!series[slug]) {
      const host = document.getElementById('xmsHubData');
      if (host) host.innerHTML = unknownSeriesState(slug);
      return;
    }
    const buttons = [...document.querySelectorAll('[data-xms-view]')];
    const activate = (view, focus = false, persist = true) => {
      const button = buttons.find((item) => item.dataset.xmsView === view);
      if (!button) return;
      buttons.forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
        item.tabIndex = active ? 0 : -1;
      });
      if (focus) button.focus();
      if (persist) updateRouteQuery(view, rankingClassFromLocation());
      loadView(slug, view);
    };
    buttons.forEach((button, index) => {
      button.addEventListener('click', () => activate(button.dataset.xmsView));
      button.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
        activate(buttons[nextIndex].dataset.xmsView, true);
      });
    });
    const requestedView = currentQuery().get('view');
    const initialView = viewFromLocation(slug);
    if (requestedView && requestedView !== initialView) updateRouteQuery(initialView, '', true);
    activate(initialView, false, false);
    window.addEventListener('popstate', () => {
      if (isMotor() && parts()[1] === slug) activate(viewFromLocation(slug), false, false);
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopMotorDemand(); return; }
    if (activeMotorSelection && isMotor()) loadView(activeMotorSelection.slug, activeMotorSelection.view, true);
  });
  window.addEventListener('pagehide', stopMotorDemand);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init, { once: true }) : init();
})();
