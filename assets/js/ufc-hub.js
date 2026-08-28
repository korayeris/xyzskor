(() => {
  if (!/^\/ufc(?:\/|$)/.test(location.pathname)) return;

  document.body.classList.add('ufc-premium-open', 'ufc-center-open');

  const routeParts = location.pathname.split('/').filter(Boolean);
  const routeName = routeParts[1] || 'home';
  const routeId = routeParts[2] || '';
  const navItems = [
    ['home', '/ufc/', 'Merkez'],
    ['live', '/ufc/live/', 'Canlı'],
    ['events', '/ufc/events/', 'Etkinlikler'],
    ['fighters', '/ufc/fighters/', 'Dövüşçüler'],
    ['rankings', '/ufc/rankings/', 'Sıralamalar'],
  ];
  const activeNav = routeName === 'home'
    ? 'home'
    : routeName === 'bouts' || routeName === 'maclar'
      ? 'events'
      : routeName === 'ligler'
        ? 'rankings'
        : routeName;

  const shell = document.createElement('main');
  shell.className = 'ufcx-shell ufc-center-shell';
  shell.innerHTML = `<nav class="ufcx-nav ufc-center-nav" aria-label="UFC bölümleri">
    ${navItems.map(([key, href, label]) => `<a href="${href}"${activeNav === key ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
  </nav>
  <section id="ufcxContent" class="ufc-center-content" aria-live="polite" aria-busy="true"></section>`;
  const footer = document.querySelector('body > footer.legal-footer-links');
  if (footer?.parentNode) footer.parentNode.insertBefore(shell, footer);
  else document.body.append(shell);

  const content = shell.querySelector('#ufcxContent');
  const escapeHTML = (input = '') => String(input ?? '').replace(/[&<>\"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[character]));
  const value = (input, fallback = '') => {
    if (input == null || input === '') return fallback;
    if (typeof input === 'object') return input.name ?? input.value ?? fallback;
    return input;
  };
  const unwrap = (payload) => {
    let data = payload;
    for (let depth = 0; depth < 4 && data && !Array.isArray(data) && typeof data === 'object' && Object.hasOwn(data, 'data'); depth += 1) {
      data = data.data;
    }
    return data ?? [];
  };
  const list = (payload) => {
    const data = unwrap(payload);
    if (Array.isArray(data)) return data;
    return data?.results ?? data?.events ?? data?.fighters ?? data?.bouts ?? data?.divisions ?? data?.items ?? [];
  };
  const numberValue = (input) => {
    if (input == null || input === '') return null;
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const pathSegment = (input) => encodeURIComponent(String(input ?? '').trim());
  const fetchUfc = async (path) => {
    const response = await fetch(`/api/ufc/${path}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error || 'UFC sağlayıcısına ulaşılamadı.');
      error.status = response.status;
      throw error;
    }
    return payload;
  };

  const fallbackImage = (entity = {}) => {
    const name = value(entity.fighterName ?? entity.profile?.name ?? entity.fighter?.name ?? entity.name, 'UFC');
    const initials = String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 300"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#e8415b"/><stop offset="1" stop-color="#11171b"/></linearGradient></defs><rect width="240" height="300" rx="22" fill="url(#g)"/><circle cx="120" cy="105" r="58" fill="rgba(255,255,255,.12)"/><path d="M24 300c8-92 47-134 96-134s88 42 96 134" fill="rgba(255,255,255,.1)"/><text x="120" y="125" text-anchor="middle" font-family="Arial" font-size="52" font-weight="900" fill="white">${escapeHTML(initials)}</text></svg>`)}`;
  };
  const proxiedUfcImage = (raw) => {
    const source = String(raw || '');
    if (!source) return '';
    if (/^data:image\/svg\+xml,/i.test(source)) return source;
    try {
      const parsed = new URL(source, location.origin);
      if (parsed.hostname === 'ufc.com' || parsed.hostname === 'www.ufc.com') {
        return `https://api.citoapi.com/api/v1/public/images/ufc/${btoa(source).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}`;
      }
      if (parsed.protocol === 'https:' && parsed.hostname === 'api.citoapi.com') return parsed.href;
    } catch (_error) {
      return '';
    }
    return '';
  };
  const imageSource = (entity = {}) => proxiedUfcImage(
    entity.proxiedImageUrl
      ?? entity.profile?.proxiedImageUrl
      ?? entity.fighter?.proxiedImageUrl
      ?? entity.bodyImageUrl
      ?? entity.imageUrl
      ?? entity.image_url
      ?? entity.headshotUrl
      ?? entity.headshot_url
      ?? entity.profile?.imageUrl
      ?? entity.profile?.image
      ?? entity.fighter?.headshotUrl
      ?? entity.fighter?.imageUrl
      ?? entity.image,
  ) || fallbackImage(entity);
  const imageHTML = (entity, label, className = '') => {
    const fallback = fallbackImage({ ...entity, name: label });
    return `<img${className ? ` class="${className}"` : ''} src="${escapeHTML(imageSource(entity))}" data-ufc-image-fallback="${escapeHTML(fallback)}" alt="${escapeHTML(label)}" loading="lazy" decoding="async">`;
  };
  const wireImageFallbacks = (root) => {
    root.querySelectorAll('img[data-ufc-image-fallback]').forEach((image) => {
      image.addEventListener('error', () => {
        if (image.src !== image.dataset.ufcImageFallback) image.src = image.dataset.ufcImageFallback;
      }, { once: true });
    });
  };

  const recordText = (fighter = {}) => {
    const explicit = fighter.recordText ?? fighter.record?.text ?? fighter.profile?.recordText;
    if (explicit) return String(explicit);
    const wins = numberValue(fighter.recordWins ?? fighter.record?.wins ?? fighter.wins);
    const losses = numberValue(fighter.recordLosses ?? fighter.record?.losses ?? fighter.losses);
    const draws = numberValue(fighter.recordDraws ?? fighter.record?.draws ?? fighter.draws);
    if ([wins, losses, draws].every((item) => item == null)) return '';
    return `${wins ?? '—'}-${losses ?? '—'}-${draws ?? '—'}`;
  };
  const fighterName = (fighter = {}, fallback = 'Sporcu açıklanmadı') => value(
    fighter.fighterName ?? fighter.name ?? fighter.profile?.name ?? fighter.fighter?.name,
    fallback,
  );
  const boutCorners = (bout = {}) => {
    const fighters = Array.isArray(bout.fighters) ? bout.fighters : [];
    return {
      red: bout.red ?? fighters.find((fighter) => String(fighter.corner).toLowerCase() === 'red') ?? fighters[0] ?? {},
      blue: bout.blue ?? fighters.find((fighter) => String(fighter.corner).toLowerCase() === 'blue') ?? fighters[1] ?? {},
    };
  };
  const statusLabel = (item = {}) => {
    const status = String(item.status ?? item.state ?? '').toLowerCase();
    if (item.isLive || ['live', 'in_progress', 'in-progress'].includes(status)) return 'CANLI';
    if (['completed', 'finished', 'final'].includes(status)) return 'TAMAMLANDI';
    if (['cancelled', 'canceled'].includes(status)) return 'İPTAL';
    if (['postponed'].includes(status)) return 'ERTELENDİ';
    return 'YAKLAŞAN';
  };
  const dateLabel = (input, fallback = 'Tarih açıklanmadı') => {
    if (!input) return fallback;
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) return String(input);
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul',
    }).format(date);
  };
  const updatedLabel = (payloads) => {
    const timestamps = payloads
      .map((payload) => payload?.updatedAt)
      .filter(Boolean)
      .map((timestamp) => new Date(timestamp))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((first, second) => second - first);
    if (!timestamps.length) return 'Güncelleme zamanı sağlayıcıdan bekleniyor';
    return `Son güncelleme: ${new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul',
    }).format(timestamps[0])}`;
  };

  const identityHTML = ({
    title = 'UFC',
    description = 'Etkinlikler, resmi sıralamalar ve sporcu profilleri.',
    meta = 'CitoAPI · doğrulanmış UFC verisi',
    state = 'GÜNCEL VERİ AKIŞI',
  } = {}) => `<header class="ufc-center-identity">
    <span class="ufc-center-mark" aria-hidden="true">UFC</span>
    <div><small>XYZSKOR · UFC DÖVÜŞ MERKEZİ</small><h1>${escapeHTML(title)}</h1><p>${escapeHTML(description)}</p><span>${escapeHTML(meta)}</span></div>
    <b class="ufc-center-data-state">${escapeHTML(state)}</b>
  </header>`;

  const metricCardsHTML = (items) => `<section class="ufc-center-metrics" aria-label="UFC veri özeti">
    ${items.map(([label, metric, note, tone = '']) => `<article${tone ? ` class="${tone}"` : ''}><span>${escapeHTML(label)}</span><b>${escapeHTML(metric ?? '—')}</b><small>${escapeHTML(note)}</small></article>`).join('')}
  </section>`;

  const emptyHTML = (title, text, { error = false, retry = false } = {}) => `<div class="ufcx-empty ufc-center-empty${error ? ' is-error' : ''}"${error ? ' role="alert"' : ' role="status"'}>
    <span class="ufc-center-empty-icon" aria-hidden="true">${error ? '!' : '○'}</span>
    <div><b>${escapeHTML(title)}</b><p>${escapeHTML(text)}</p>${retry ? '<button type="button" data-ufc-retry>Yeniden dene</button>' : ''}</div>
  </div>`;

  const render = (html) => {
    content.innerHTML = html;
    content.setAttribute('aria-busy', 'false');
    wireImageFallbacks(content);
    content.querySelectorAll('[data-ufc-retry]').forEach((button) => button.addEventListener('click', () => loadRoute()));
  };

  const rankingsSkeletonHTML = () => Array.from({ length: 8 }, (_, index) => `<div class="ufc-center-rank-row ufc-center-skeleton-row" aria-hidden="true" style="--ufc-row-index:${index}"><i></i><i></i><i></i><i></i></div>`).join('');
  const loadingHTML = (title = 'UFC') => `<section class="ufc-center is-loading" data-state="loading" aria-busy="true">
    ${identityHTML({ title, description: 'Gerçek etkinlik, sıralama ve sporcu verileri hazırlanıyor.', state: 'VERİLER HAZIRLANIYOR' })}
    <div class="ufc-center-overview">
      <section class="ufc-center-panel"><header><div><small>RESMİ SIRALAMA</small><h2>Siklet görünümü</h2></div></header><div class="ufc-center-rank-list">${rankingsSkeletonHTML()}</div></section>
      <aside class="ufc-center-panel"><header><div><small>ETKİNLİK AKIŞI</small><h2>Yaklaşan kartlar</h2></div></header><div class="ufc-center-card-skeleton">${Array.from({ length: 5 }, () => '<i aria-hidden="true"></i>').join('')}</div></aside>
    </div>
    <p class="ufc-center-loading-label" role="status">UFC merkezi hazırlanıyor</p>
  </section>`;

  const errorHTML = (title, message) => `<section class="ufc-center" data-state="error">
    ${identityHTML({ title, description: 'Veri bağlantısı yeniden kurulacak.', state: 'SAĞLAYICI BAĞLANTISI' })}
    ${emptyHTML('UFC verisi şu anda alınamadı.', message || 'Bu doğrulanmış boş sonuç değildir. Bağlantı düzeldiğinde gerçek veriler yeniden yüklenecek.', { error: true, retry: true })}
  </section>`;

  const groupRankings = (rows) => {
    const groups = new Map();
    rows.forEach((row) => {
      const division = value(row.division ?? row.normalizedDivision, 'Siklet açıklanmadı');
      if (!groups.has(division)) groups.set(division, { division, champion: null, rankings: [] });
      const fighter = {
        ...(row.fighter || {}),
        ...row,
        name: row.fighterName ?? row.fighter?.name ?? row.name,
        slug: row.fighterSlug ?? row.fighter?.slug ?? row.slug,
        imageUrl: row.imageUrl ?? row.fighter?.imageUrl,
        headshotUrl: row.headshotUrl ?? row.fighter?.headshotUrl,
        proxiedImageUrl: row.proxiedImageUrl ?? row.fighter?.proxiedImageUrl,
        recordText: row.recordText ?? row.fighter?.recordText,
      };
      const isChampion = row.isChampion || row.rankText === 'C' || row.championStatus === 'champion';
      if (isChampion) groups.get(division).champion = fighter;
      else groups.get(division).rankings.push(fighter);
    });
    return [...groups.values()].map((group) => ({
      ...group,
      rankings: group.rankings.sort((first, second) => (numberValue(first.rank) ?? 999) - (numberValue(second.rank) ?? 999)),
    }));
  };
  const divisionKey = (division, index) => `${String(division || 'division').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]+/g, '-')}-${index}`;

  const rankingRowHTML = (fighter, index, champion = false) => {
    const name = fighterName(fighter);
    const slug = fighter.slug ?? fighter.fighterSlug;
    const tag = slug ? 'a' : 'div';
    const link = slug ? ` href="/ufc/fighters/${pathSegment(slug)}/"` : '';
    return `<${tag} class="ufc-center-rank-row${champion ? ' is-champion' : ''}"${link} style="--ufc-row-index:${index}">
      <b>${champion ? 'C' : escapeHTML(value(fighter.rank ?? fighter.rankText, index + 1))}</b>
      ${imageHTML(fighter, `${name} profil görseli`)}
      <span><strong>${escapeHTML(name)}</strong><small>${escapeHTML(value(fighter.division, champion ? 'Şampiyon' : 'UFC'))}</small></span>
      <em>${escapeHTML(recordText(fighter) || (champion ? 'Şampiyon' : 'Kayıt açıklanmadı'))}</em>
    </${tag}>`;
  };

  const rankingPanelsHTML = (groups, limit = 10) => {
    if (!groups.length) return emptyHTML('Sıralama verisi bekleniyor.', 'Sağlayıcı resmi siklet tablosunu yayımladığında bu alan otomatik güncellenecek.');
    return groups.map((group, groupIndex) => {
      const key = divisionKey(group.division, groupIndex);
      const rows = [
        group.champion ? rankingRowHTML(group.champion, 0, true) : '',
        ...group.rankings.slice(0, limit).map((fighter, index) => rankingRowHTML(fighter, index + 1)),
      ].join('');
      return `<section class="ufc-center-division" data-ufc-division="${escapeHTML(key)}"${groupIndex ? ' hidden' : ''} aria-label="${escapeHTML(group.division)} sıralaması">
        ${rows || emptyHTML('Bu siklette kayıt yok.', 'Doğrulanmış sıralama kaydı sağlayıcıdan bekleniyor.')}
      </section>`;
    }).join('');
  };

  const rankingControlHTML = (groups, id = 'ufcCenterDivision') => {
    if (groups.length < 2) return '';
    return `<label class="ufc-center-select-label" for="${id}">Siklet seç</label><select id="${id}" data-ufc-division-select>
      ${groups.map((group, index) => `<option value="${escapeHTML(divisionKey(group.division, index))}">${escapeHTML(group.division)}</option>`).join('')}
    </select>`;
  };

  const bindDivisionSelect = () => {
    const select = content.querySelector('[data-ufc-division-select]');
    if (!select) return;
    select.addEventListener('change', () => {
      content.querySelectorAll('[data-ufc-division]').forEach((panel) => {
        panel.hidden = panel.dataset.ufcDivision !== select.value;
      });
    });
  };

  const eventRowHTML = (event, index = 0) => {
    const slug = event.slug ?? event.id;
    const title = value(event.title ?? event.shortTitle ?? event.name, 'Etkinlik adı açıklanmadı');
    const tag = slug ? 'a' : 'article';
    return `<${tag} class="ufc-center-event-row${event.isLive ? ' is-live' : ''}"${slug ? ` href="/ufc/events/${pathSegment(slug)}/"` : ''} style="--ufc-row-index:${index}">
      <time datetime="${escapeHTML(event.startsAt ?? event.date ?? '')}"><b>${escapeHTML(statusLabel(event))}</b><span>${escapeHTML(dateLabel(event.startsAt ?? event.date ?? event.startDate))}</span></time>
      <span><strong>${escapeHTML(title)}</strong><small>${escapeHTML(value(event.locationText ?? event.venue ?? event.location, 'Konum açıklanmadı'))}</small></span>
      <i aria-hidden="true">→</i>
    </${tag}>`;
  };

  const fighterCardHTML = (fighter) => {
    const name = fighterName(fighter);
    const slug = fighter.slug ?? fighter.fighterSlug ?? fighter.id;
    const tag = slug ? 'a' : 'article';
    return `<${tag} class="ufc-center-fighter-card"${slug ? ` href="/ufc/fighters/${pathSegment(slug)}/"` : ''}>
      ${imageHTML(fighter, `${name} profil görseli`)}
      <span><strong>${escapeHTML(name)}</strong><small>${escapeHTML(value(fighter.division ?? fighter.weightClass, 'Siklet açıklanmadı'))}</small><em>${escapeHTML(recordText(fighter) || 'Kayıt açıklanmadı')}</em></span>
    </${tag}>`;
  };

  const boutFeatureHTML = (bout, eventTitle = '') => {
    if (!bout) return emptyHTML('Dövüş kartı hazırlanıyor.', 'Sağlayıcı müsabaka eşleşmelerini doğruladığında ana kart burada görünecek.');
    const { red, blue } = boutCorners(bout);
    const redName = fighterName(red);
    const blueName = fighterName(blue);
    const boutId = bout.id ?? bout.boutId;
    const href = boutId ? `/ufc/bouts/${pathSegment(boutId)}/` : '';
    const tag = href ? 'a' : 'div';
    return `<${tag} class="ufc-center-feature-bout"${href ? ` href="${href}"` : ''}>
      <figure>${imageHTML(red, `${redName} profil görseli`)}<figcaption><strong>${escapeHTML(redName)}</strong><small>${escapeHTML(recordText(red) || 'Kayıt açıklanmadı')}</small></figcaption></figure>
      <div><small>${escapeHTML(value(bout.cardPosition ?? bout.cardSection, 'ANA KART'))}</small><b>VS</b><span>${escapeHTML(value(bout.weightClass, 'Siklet açıklanmadı'))}</span></div>
      <figure>${imageHTML(blue, `${blueName} profil görseli`)}<figcaption><strong>${escapeHTML(blueName)}</strong><small>${escapeHTML(recordText(blue) || 'Kayıt açıklanmadı')}</small></figcaption></figure>
      ${eventTitle ? `<em>${escapeHTML(eventTitle)}</em>` : ''}
    </${tag}>`;
  };

  const sourceNoteHTML = (payloads, partial = false) => `<article class="ufc-center-source-note">
    <small>VERİ KAPSAMI</small><h2>${partial ? 'Kısmi fakat doğrulanmış görünüm' : 'Şeffaf, sağlayıcı bazlı görünüm'}</h2>
    <p>Etkinlikler, dövüş kartları, sporcu profilleri ve sıralamalar yalnız CitoAPI tarafından döndürülen UFC kayıtlarından oluşturulur. Eksik veri için tahmini sıralama veya istatistik üretilmez.</p>
    <span>${escapeHTML(updatedLabel(payloads))}</span>
  </article>`;

  async function home() {
    const results = await Promise.allSettled([
      fetchUfc('events/upcoming'),
      fetchUfc('rankings'),
      fetchUfc('fighters?page=1&limit=12'),
    ]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    if (!fulfilled.length) throw results[0]?.reason || new Error('UFC veri kaynaklarına ulaşılamadı.');

    const eventsPayload = results[0].status === 'fulfilled' ? results[0].value : null;
    const rankingsPayload = results[1].status === 'fulfilled' ? results[1].value : null;
    const fightersPayload = results[2].status === 'fulfilled' ? results[2].value : null;
    const events = list(eventsPayload);
    const groups = groupRankings(list(rankingsPayload));
    const fighters = list(fightersPayload);
    const featuredEvent = events[0] ?? null;
    let eventDetailPayload = null;
    let eventDetail = featuredEvent;
    if (featuredEvent?.slug && featuredEvent?.dataAvailability?.bouts !== 'missing') {
      try {
        eventDetailPayload = await fetchUfc(`events/${pathSegment(featuredEvent.slug)}`);
        eventDetail = unwrap(eventDetailPayload) || featuredEvent;
      } catch (_error) {
        eventDetail = featuredEvent;
      }
    }
    const bouts = Array.isArray(eventDetail?.bouts) ? eventDetail.bouts : [];
    const champions = groups.filter((group) => group.champion).length;
    const partial = results.some((result) => result.status === 'rejected');
    const payloads = [...fulfilled, ...(eventDetailPayload ? [eventDetailPayload] : [])];

    render(`<section class="ufc-center" data-state="ready">
      ${identityHTML({
        description: featuredEvent ? `${value(featuredEvent.shortTitle ?? featuredEvent.title, 'Yaklaşan kart')} · ${dateLabel(featuredEvent.startsAt)}` : 'Etkinlikler, resmi sıralamalar ve sporcu profilleri.',
        meta: 'CitoAPI · UFC etkinlik ve sıralama akışı',
        state: partial ? 'KISMİ DOĞRULANMIŞ VERİ' : 'GÜNCEL VERİ AKIŞI',
      })}
      <div class="ufc-center-overview">
        <section class="ufc-center-panel ufc-center-rankings-panel" aria-labelledby="ufcCenterRankingsTitle">
          <header><div><small>RESMİ SIRALAMA</small><h2 id="ufcCenterRankingsTitle">Siklet görünümü</h2></div>${rankingControlHTML(groups)}</header>
          <div class="ufc-center-rank-list" tabindex="0" role="region" aria-labelledby="ufcCenterRankingsTitle">${rankingPanelsHTML(groups, 8)}</div>
        </section>
        <aside class="ufc-center-panel ufc-center-events-panel" aria-labelledby="ufcCenterEventsTitle">
          <header><div><small>ETKİNLİK AKIŞI</small><h2 id="ufcCenterEventsTitle">Yaklaşan kartlar</h2></div><span>${events.length} etkinlik</span></header>
          <div class="ufc-center-event-list">${events.length ? events.slice(0, 7).map(eventRowHTML).join('') : emptyHTML('Yaklaşan kart bulunmuyor.', 'Yeni etkinlikler sağlayıcıda doğrulandığında burada listelenecek.')}</div>
        </aside>
      </div>
      ${metricCardsHTML([
        ['YAKLAŞAN KART', eventsPayload ? events.length : '—', 'listelenen etkinlik'],
        ['SIKLET', rankingsPayload ? groups.length : '—', 'resmi sıralama grubu'],
        ['ŞAMPİYON', rankingsPayload ? champions : '—', 'doğrulanmış kemer sahibi', 'is-accent'],
        ['İLK KART', eventDetail ? bouts.length : '—', 'açıklanan müsabaka'],
      ])}
      <section class="ufc-center-lower">
        <article class="ufc-center-feature"><header><small>GECENİN VİTRİNİ</small><h2>${escapeHTML(value(featuredEvent?.title, 'Ana kart'))}</h2></header>${boutFeatureHTML(bouts[0], value(featuredEvent?.title))}</article>
        ${sourceNoteHTML(payloads, partial)}
      </section>
      ${fighters.length ? `<section class="ufc-center-roster-strip"><header><small>SPORCU PROFİLLERİ</small><h2>Öne çıkan dövüşçüler</h2><a href="/ufc/fighters/">Tümünü aç →</a></header><div>${fighters.slice(0, 4).map(fighterCardHTML).join('')}</div></section>` : ''}
    </section>`);
    bindDivisionSelect();
  }

  async function eventsPage(id) {
    if (!id) {
      const payload = await fetchUfc('events/upcoming');
      const events = list(payload);
      const locations = new Set(events.map((event) => value(event.country ?? event.locationText, '')).filter(Boolean));
      render(`<section class="ufc-center" data-state="ready">
        ${identityHTML({ title: 'UFC Etkinlikleri', description: 'Numaralı UFC kartları ve Fight Night programı.', meta: 'CitoAPI · yaklaşan etkinlik takvimi' })}
        ${metricCardsHTML([
          ['YAKLAŞAN', events.length, 'doğrulanmış etkinlik'],
          ['CANLI', events.filter((event) => event.isLive).length, 'aktif kart', 'is-live'],
          ['LOKASYON', locations.size, 'takvim kapsamı'],
          ['KART VERİSİ', events.filter((event) => event.dataAvailability?.bouts === 'available').length, 'müsabakası açıklanan'],
        ])}
        <div class="ufc-center-overview ufc-center-overview-events">
          <section class="ufc-center-panel"><header><div><small>FIGHT CALENDAR</small><h2>Etkinlik takvimi</h2></div><span>${events.length} kart</span></header><div class="ufc-center-event-list">${events.length ? events.map(eventRowHTML).join('') : emptyHTML('Etkinlik bulunamadı.', 'Yeni kartlar sağlayıcıda yayımlandığında otomatik listelenecek.')}</div></section>
          ${sourceNoteHTML([payload])}
        </div>
      </section>`);
      return;
    }

    const payload = await fetchUfc(`events/${pathSegment(id)}`);
    const event = unwrap(payload) || {};
    const bouts = Array.isArray(event.bouts) ? event.bouts : [];
    const weightClasses = new Set(bouts.map((bout) => value(bout.weightClass, '')).filter(Boolean));
    render(`<section class="ufc-center" data-state="ready">
      ${identityHTML({
        title: value(event.title ?? event.shortTitle, 'UFC Etkinliği'),
        description: `${dateLabel(event.startsAt)} · ${value(event.locationText ?? event.venue, 'Konum açıklanmadı')}`,
        meta: 'CitoAPI · doğrulanmış etkinlik kartı',
        state: statusLabel(event),
      })}
      ${metricCardsHTML([
        ['MÜSABAKA', bouts.length, 'açıklanan eşleşme'],
        ['SIKLET', weightClasses.size, 'kart kapsamı'],
        ['CANLI', event.isLive ? 1 : 0, 'aktif etkinlik', event.isLive ? 'is-live' : ''],
        ['DURUM', statusLabel(event), 'sağlayıcı durumu'],
      ])}
      <section class="ufc-center-feature ufc-center-event-feature"><header><small>ANA KART</small><h2>Gecenin eşleşmeleri</h2></header>${boutFeatureHTML(bouts[0], value(event.title))}</section>
      <section class="ufc-center-bout-grid" aria-label="Etkinlik müsabakaları">${bouts.length ? bouts.map((bout, index) => boutCardHTML(bout, index)).join('') : emptyHTML('Dövüş kartı bekleniyor.', 'Sağlayıcı eşleşmeleri doğruladığında kart otomatik dolacak.')}</section>
      ${sourceNoteHTML([payload])}
    </section>`);
  }

  const boutCardHTML = (bout, index = 0) => {
    const { red, blue } = boutCorners(bout);
    const redName = fighterName(red);
    const blueName = fighterName(blue);
    const boutId = bout.id ?? bout.boutId;
    const tag = boutId ? 'a' : 'article';
    return `<${tag} class="ufc-center-bout-card"${boutId ? ` href="/ufc/bouts/${pathSegment(boutId)}/"` : ''} style="--ufc-row-index:${index}">
      <small>${escapeHTML(value(bout.cardPosition ?? bout.cardSection, 'FIGHT CARD'))} · ${escapeHTML(value(bout.weightClass, 'Siklet açıklanmadı'))}</small>
      <div><span>${imageHTML(red, `${redName} profil görseli`)}<strong>${escapeHTML(redName)}</strong></span><b>VS</b><span>${imageHTML(blue, `${blueName} profil görseli`)}<strong>${escapeHTML(blueName)}</strong></span></div>
      <em>${escapeHTML(statusLabel(bout))}</em>
    </${tag}>`;
  };

  async function rankingsPage() {
    const payload = await fetchUfc('rankings');
    const groups = groupRankings(list(payload));
    const champions = groups.filter((group) => group.champion).length;
    const ranked = groups.reduce((total, group) => total + group.rankings.length, 0);
    render(`<section class="ufc-center" data-state="ready">
      ${identityHTML({ title: 'UFC Sıralamaları', description: 'Siklet şampiyonları ve resmi aday listeleri.', meta: 'CitoAPI · resmi sıralama akışı' })}
      ${metricCardsHTML([
        ['SIKLET', groups.length, 'sıralama grubu'],
        ['ŞAMPİYON', champions, 'doğrulanmış kemer sahibi', 'is-accent'],
        ['SIRALI SPORCU', ranked, 'sağlayıcı kaydı'],
        ['KAYNAK', 'CITO', 'UFC veri sağlayıcısı'],
      ])}
      <section class="ufc-center-panel ufc-center-rankings-full" aria-labelledby="ufcRankingsPageTitle">
        <header><div><small>OFFICIAL BOARD</small><h2 id="ufcRankingsPageTitle">Siklet tablosu</h2></div>${rankingControlHTML(groups, 'ufcRankingsDivision')}</header>
        <div class="ufc-center-rank-list" tabindex="0" role="region" aria-labelledby="ufcRankingsPageTitle">${rankingPanelsHTML(groups, 15)}</div>
      </section>
      ${sourceNoteHTML([payload])}
    </section>`);
    bindDivisionSelect();
  }

  async function fightersPage(id) {
    if (!id) {
      const payload = await fetchUfc('fighters?page=1&limit=50');
      const fighters = list(payload);
      const divisions = new Set(fighters.map((fighter) => value(fighter.division ?? fighter.weightClass, '')).filter(Boolean));
      const champions = fighters.filter((fighter) => fighter.championStatus === 'champion').length;
      render(`<section class="ufc-center" data-state="ready">
        ${identityHTML({ title: 'UFC Dövüşçüleri', description: 'Siklet, kariyer kaydı ve doğrulanmış sporcu profilleri.', meta: 'CitoAPI · UFC sporcu dizini' })}
        ${metricCardsHTML([
          ['LİSTELENEN', fighters.length, 'bu sayfadaki sporcu'],
          ['SIKLET', divisions.size, 'liste kapsamı'],
          ['ŞAMPİYON', champions, 'listede doğrulanan', 'is-accent'],
          ['PROFİL', fighters.filter((fighter) => fighter.slug).length, 'açılabilir kayıt'],
        ])}
        <section class="ufc-center-roster"><header><small>ROSTER</small><h2>Sporcu profilleri</h2></header><div>${fighters.length ? fighters.map(fighterCardHTML).join('') : emptyHTML('Dövüşçü bulunamadı.', 'Sporcu profilleri sağlayıcıdan bekleniyor.')}</div></section>
        ${sourceNoteHTML([payload])}
      </section>`);
      return;
    }

    const results = await Promise.allSettled([
      fetchUfc(`fighters/${pathSegment(id)}`),
      fetchUfc(`fighters/${pathSegment(id)}/stats`),
      fetchUfc(`fighters/${pathSegment(id)}/fights`),
    ]);
    if (results[0].status === 'rejected') throw results[0].reason;
    const profilePayload = results[0].value;
    const statsPayload = results[1].status === 'fulfilled' ? results[1].value : null;
    const fightsPayload = results[2].status === 'fulfilled' ? results[2].value : null;
    const fighter = unwrap(profilePayload) || {};
    const stats = statsPayload ? unwrap(statsPayload) : {};
    const fights = fightsPayload ? list(fightsPayload) : [];
    const name = fighterName(fighter, id);
    const facts = [
      ['Ülke', fighter.country ?? fighter.placeOfBirth],
      ['Yaş', fighter.age],
      ['Boy', fighter.heightInches ? `${fighter.heightInches} in` : fighter.height],
      ['Kilo', fighter.weightLbs ? `${fighter.weightLbs} lb` : fighter.weight],
      ['Reach', fighter.reachInches ? `${fighter.reachInches} in` : fighter.reach],
      ['Gard', fighter.stance],
      ['Stil', fighter.fightingStyle],
      ['Kamp', fighter.trainsAt],
    ].filter(([, fact]) => fact != null && fact !== '');
    const statItems = [
      ['Önemli vuruş isabeti', stats?.strikingAccuracy],
      ['Vuruş savunması', stats?.sigStrikeDefense],
      ['Takedown isabeti', stats?.takedownAccuracy],
      ['Dakikada vuruş', stats?.sigStrikesLandedPerMin],
      ['Yenen vuruş', stats?.sigStrikesAbsorbedPerMin],
      ['15 dk takedown', stats?.takedownAvgPer15Min],
      ['15 dk submission', stats?.submissionAvgPer15Min],
    ].filter(([, stat]) => stat != null && stat !== '');
    const wins = numberValue(fighter.recordWins ?? fighter.record?.wins);
    const losses = numberValue(fighter.recordLosses ?? fighter.record?.losses);

    render(`<section class="ufc-center" data-state="ready">
      ${identityHTML({ title: name, description: [value(fighter.nickname), value(fighter.division ?? fighter.weightClass)].filter(Boolean).join(' · ') || 'UFC sporcu profili', meta: 'CitoAPI · doğrulanmış sporcu profili' })}
      <section class="ufc-center-athlete">
        ${imageHTML(fighter, `${name} profil görseli`)}
        <div><small>${escapeHTML(value(fighter.division ?? fighter.weightClass, 'Siklet açıklanmadı'))}</small><h2>${escapeHTML(name)}</h2><b>${escapeHTML(recordText(fighter) || 'Kariyer kaydı açıklanmadı')}</b></div>
      </section>
      ${metricCardsHTML([
        ['GALİBİYET', wins, 'kariyer kaydı', 'is-live'],
        ['MAĞLUBİYET', losses, 'kariyer kaydı'],
        ['YAŞ', numberValue(fighter.age), 'profil bilgisi'],
        ['REACH', fighter.reachInches ? `${fighter.reachInches} in` : value(fighter.reach, '—'), 'profil ölçümü'],
      ])}
      ${fighterTabsHTML()}
      <section id="ufcFighterDetails" data-ufc-tab-panel="details" role="tabpanel" aria-labelledby="ufcFighterTabDetails"><div class="ufc-center-facts">${facts.length ? facts.map(([label, fact]) => `<article><small>${escapeHTML(label)}</small><b>${escapeHTML(fact)}</b></article>`).join('') : emptyHTML('Profil ayrıntısı bekleniyor.', 'Eksik bilgiler sağlayıcıda doğrulandığında burada gösterilecek.')}</div></section>
      <section id="ufcFighterStats" data-ufc-tab-panel="stats" role="tabpanel" aria-labelledby="ufcFighterTabStats" hidden><div class="ufc-center-stat-grid">${statItems.length ? statItems.map(([label, stat]) => `<article><small>${escapeHTML(label)}</small><b>${escapeHTML(stat)}</b></article>`).join('') : emptyHTML('İstatistik verisi bekleniyor.', 'Doğrulanmış performans istatistikleri dışında değer üretilmez.')}</div></section>
      <section id="ufcFighterFights" data-ufc-tab-panel="fights" role="tabpanel" aria-labelledby="ufcFighterTabFights" hidden><div class="ufc-center-bout-grid">${fights.length ? fights.slice(0, 12).map((fight, index) => fightHistoryHTML(fight, name, index)).join('') : emptyHTML('Dövüş geçmişi bekleniyor.', 'Sağlayıcı geçmiş müsabakaları döndürdüğünde liste güncellenecek.')}</div></section>
      ${sourceNoteHTML([profilePayload, statsPayload, fightsPayload].filter(Boolean), results.some((result) => result.status === 'rejected'))}
    </section>`);
    bindFighterTabs();
  }

  const fighterTabsHTML = () => `<nav class="ufc-center-tabs" role="tablist" aria-label="Sporcu profili bölümleri">
    <button id="ufcFighterTabDetails" type="button" role="tab" aria-selected="true" aria-controls="ufcFighterDetails" data-ufc-tab="details">Detaylar</button>
    <button id="ufcFighterTabStats" type="button" role="tab" aria-selected="false" aria-controls="ufcFighterStats" data-ufc-tab="stats" tabindex="-1">İstatistikler</button>
    <button id="ufcFighterTabFights" type="button" role="tab" aria-selected="false" aria-controls="ufcFighterFights" data-ufc-tab="fights" tabindex="-1">Dövüşler</button>
  </nav>`;
  const bindFighterTabs = () => {
    const tabs = [...content.querySelectorAll('[data-ufc-tab]')];
    const activate = (selected) => {
      tabs.forEach((tab) => {
        const active = tab === selected;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      });
      content.querySelectorAll('[data-ufc-tab-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.ufcTabPanel !== selected.dataset.ufcTab;
      });
      selected.focus();
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(tab));
      tab.addEventListener('keydown', (event) => {
        if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        activate(tabs[nextIndex]);
      });
    });
  };

  const fightHistoryHTML = (fight, name, index) => {
    const opponent = value(fight.opponent?.name ?? fight.opponentName ?? fight.blueFighter ?? fight.redFighter, 'Rakip açıklanmadı');
    const result = value(fight.result ?? fight.outcome, 'Sonuç açıklanmadı');
    const boutId = fight.boutId ?? fight.id;
    const tag = boutId ? 'a' : 'article';
    return `<${tag} class="ufc-center-history-card"${boutId ? ` href="/ufc/bouts/${pathSegment(boutId)}/"` : ''} style="--ufc-row-index:${index}"><small>${escapeHTML(value(fight.eventName ?? fight.event?.name ?? fight.event, 'UFC'))}</small><strong>${escapeHTML(name)} <i>VS</i> ${escapeHTML(opponent)}</strong><span>${escapeHTML(result)} · ${escapeHTML(dateLabel(fight.eventDate ?? fight.date ?? fight.startsAt, 'Tarih açıklanmadı'))}</span></${tag}>`;
  };

  async function livePage() {
    const payload = await fetchUfc('live');
    const items = list(payload);
    render(`<section class="ufc-center" data-state="ready">
      ${identityHTML({ title: 'Canlı Octagon', description: 'Aktif etkinlik ve müsabaka akışı.', meta: 'CitoAPI · canlı UFC durumu', state: items.length ? 'CANLI AKIŞ' : 'ŞU ANDA CANLI KART YOK' })}
      ${metricCardsHTML([
        ['CANLI KAYIT', items.length, 'sağlayıcı kaydı', items.length ? 'is-live' : ''],
        ['KAYNAK', 'CITO', 'UFC canlı verisi'],
        ['TAHMİN', 'YOK', 'eksik veri üretilmez'],
        ['DURUM', items.length ? 'AKTİF' : 'BEKLİYOR', 'anlık sağlayıcı yanıtı'],
      ])}
      <div class="ufc-center-overview ufc-center-overview-live">
        <section class="ufc-center-panel"><header><div><small>LIVE FIGHT NIGHT</small><h2>Canlı akış</h2></div></header><div class="ufc-center-bout-grid">${items.length ? items.map((item, index) => boutCardHTML(item, index)).join('') : emptyHTML('Şu anda canlı dövüş yok.', 'Bir etkinlik canlı duruma geçtiğinde bu alan otomatik güncellenecek.')}</div></section>
        ${sourceNoteHTML([payload])}
      </div>
    </section>`);
  }

  const readableStatLabel = (key) => String(key)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();

  async function boutPage(id) {
    if (!id) return eventsPage('');
    const results = await Promise.allSettled([
      fetchUfc(`bouts/${pathSegment(id)}`),
      fetchUfc(`bouts/${pathSegment(id)}/stats`),
      fetchUfc(`bouts/${pathSegment(id)}/rounds`),
    ]);
    if (results[0].status === 'rejected') throw results[0].reason;
    const boutPayload = results[0].value;
    const statsPayload = results[1].status === 'fulfilled' ? results[1].value : null;
    const roundsPayload = results[2].status === 'fulfilled' ? results[2].value : null;
    const bout = unwrap(boutPayload) || {};
    const stats = statsPayload ? unwrap(statsPayload) : {};
    const rounds = roundsPayload ? list(roundsPayload) : [];
    const { red, blue } = boutCorners(bout);
    const redName = fighterName(red);
    const blueName = fighterName(blue);
    const statEntries = Object.entries(stats && !Array.isArray(stats) ? stats : {}).filter(([, stat]) => typeof stat === 'string' || typeof stat === 'number').slice(0, 12);
    render(`<section class="ufc-center" data-state="ready">
      ${identityHTML({ title: `${redName} vs ${blueName}`, description: [value(bout.eventName ?? bout.event), value(bout.weightClass), value(bout.status ?? bout.result)].filter(Boolean).join(' · '), meta: 'CitoAPI · müsabaka merkezi', state: statusLabel(bout) })}
      <section class="ufc-center-feature ufc-center-bout-feature"><header><small>FIGHT CENTER</small><h2>Müsabaka kartı</h2></header>${boutFeatureHTML(bout, value(bout.eventName ?? bout.event))}</section>
      <div class="ufc-center-overview">
        <section class="ufc-center-panel"><header><div><small>FIGHT STATS</small><h2>Maç istatistikleri</h2></div></header><div class="ufc-center-stat-grid">${statEntries.length ? statEntries.map(([label, stat]) => `<article><small>${escapeHTML(readableStatLabel(label))}</small><b>${escapeHTML(stat)}</b></article>`).join('') : emptyHTML('İstatistik verisi bekleniyor.', 'Doğrulanmış müsabaka istatistikleri sağlayıcıdan bekleniyor.')}</div></section>
        <aside class="ufc-center-panel"><header><div><small>ROUND BY ROUND</small><h2>Rauntlar</h2></div></header><div class="ufc-center-rounds">${rounds.length ? rounds.map((round, index) => `<article><b>R${escapeHTML(value(round.round, index + 1))}</b><span>${escapeHTML(value(round.summary ?? round.status ?? round.time, 'Raunt verisi'))}</span></article>`).join('') : emptyHTML('Raunt verisi bekleniyor.', 'Raunt ayrıntıları sağlayıcıda yayımlandığında gösterilecek.')}</div></aside>
      </div>
      ${sourceNoteHTML([boutPayload, statsPayload, roundsPayload].filter(Boolean), results.some((result) => result.status === 'rejected'))}
    </section>`);
  }

  const routeTitle = {
    home: 'UFC', live: 'Canlı Octagon', events: 'UFC Etkinlikleri', fighters: 'UFC Dövüşçüleri', rankings: 'UFC Sıralamaları', bouts: 'UFC Maç Merkezi',
  };
  let loadSequence = 0;
  async function loadRoute() {
    const sequence = ++loadSequence;
    content.setAttribute('aria-busy', 'true');
    content.innerHTML = loadingHTML(routeTitle[routeName] || 'UFC');
    try {
      if (routeName === 'fighters') await fightersPage(routeId);
      else if (routeName === 'events') await eventsPage(routeId);
      else if (routeName === 'rankings' || routeName === 'ligler') await rankingsPage();
      else if (routeName === 'live') await livePage();
      else if (routeName === 'bouts' || routeName === 'maclar') await boutPage(routeId);
      else await home();
    } catch (error) {
      if (sequence !== loadSequence) return;
      render(errorHTML(routeTitle[routeName] || 'UFC', error?.status === 503
        ? 'Bu doğrulanmış boş sonuç değildir. Sağlayıcı güncellemesi sürüyor; birkaç saniye sonra yeniden deneyin.'
        : 'Bu doğrulanmış boş sonuç değildir. Bağlantı düzeldiğinde gerçek veriler yeniden yüklenecek.'));
    }
  }

  loadRoute();
})();
