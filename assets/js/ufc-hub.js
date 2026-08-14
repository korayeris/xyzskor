(() => {
  if (!location.pathname.startsWith('/ufc')) return;

  document.body.classList.add('ufc-premium-open');

  const main = document.createElement('main');
  main.className = 'ufcx-shell';
  main.innerHTML = `
    <nav class="ufcx-nav">
      <a href="/ufc/">UFC</a>
      <a href="/ufc/live/">Canli</a>
      <a href="/ufc/events/">Etkinlikler</a>
      <a href="/ufc/fighters/">Dövüşçüler</a>
      <a href="/ufc/rankings/">Sıralama</a>
      <a href="/ufc/compare/">Karşılaştır</a>
    </nav>
    <section id="ufcxContent">Octagon hazirlaniyor...</section>
  `;

  const existingFooter = document.querySelector('body > footer.legal-footer-links');
  if (existingFooter?.parentNode) existingFooter.parentNode.insertBefore(main, existingFooter);
  else document.body.append(main);

  const host = main.querySelector('#ufcxContent');
  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

  const val = (value, fallback = '-') => {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'object') return value?.name || value?.value || fallback;
    return fallback;
  };

  const unwrap = payload => {
    let data = payload;
    for (let i = 0; i < 3; i++) {
      if (Array.isArray(data)) break;
      if (!data || typeof data !== 'object') break;
      if (data.data !== undefined) data = data.data;
      else if (data?.event?.data !== undefined) data = data.event.data;
      else break;
    }
    return data;
  };

  const rowsOf = payload => {
    const data = unwrap(payload);
    if (Array.isArray(data)) return data;
    return data?.results ?? data?.events ?? data?.fighters ?? data?.bouts ?? data?.divisions ?? data?.items ?? data?.data ?? [];
  };

  const slugify = text => String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const shortName = item => {
    const raw = val(item?.name ?? item?.fighterName ?? item?.profile?.name ?? item?.fighter?.name, 'DÖVÜŞÇÜ');
    return raw.split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'F';
  };

  const safeImage = raw => {
    const value = String(raw || '').trim();
    if (!/^https?:\/\//i.test(value)) return value;
    if (!/ufc\.com\//i.test(value)) return value;
    try {
      return `https://api.citoapi.com/api/v1/public/images/ufc/${btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}`;
    } catch {
      return value;
    }
  };

  const fighterImage = item => {
    const image = item?.proxiedImageUrl || item?.bodyImageUrl || item?.imageUrl || item?.image_url || item?.headshotUrl || item?.headshot_url || item?.profile?.imageUrl || item?.profile?.image || item?.fighter?.headshotUrl || item?.fighter?.imageUrl || item?.fighter?.image || item?.image;
    const url = safeImage(image);
    if (!url) return fallbackImage(item);
    return url;
  };

  const fallbackImage = item => {
    const initial = shortName(item);
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 300"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#ff405d"/><stop offset="1" stop-color="#090b0f"/></linearGradient></defs><rect width="240" height="300" fill="url(#g)"/><rect x="24" y="24" width="192" height="252" rx="12" fill="rgba(255,255,255,.06)"/><text x="120" y="138" text-anchor="middle" font-family="Arial" font-size="58" font-weight="900" fill="white">${initial}</text><text x="120" y="176" text-anchor="middle" font-family="Arial" font-size="18" fill="rgba(255,255,255,.55)">MMA</text></svg>`)}`;
  };

  const emptyState = title => `<div class="ufcx-empty"><b>${escapeHtml(title)}</b><span>Veri oluştuğunda otomatik güncellenir.</span></div>`;

  const head = (kicker, title, subtitle) => `
    <header class="ufcx-head">
      <span>${escapeHtml(kicker)}</span>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(subtitle)}</p>
    </header>
  `;

  const linkTo = path => `<a href="${escapeHtml(path)}">Görüntüle →</a>`;

  const fighterLink = id => `<a href="/ufc/fighters/${escapeHtml(id)}/">`;

  const fightCard = bout => {
    const fighters = Array.isArray(bout?.fighters) ? bout.fighters : [];
    const red = fighters.find(item => item.corner === 'red') || fighters[0] || {};
    const blue = fighters.find(item => item.corner === 'blue') || fighters[1] || {};
    const redName = val(red.fighterName || red.profile?.name || red.name, 'Red');
    const blueName = val(blue.fighterName || blue.profile?.name || blue.name, 'Blue');
    const mainClass = !bout || !bout.fightIndex ? '' : '';
    return `<a class="ufcx-fight ${mainClass}" href="/ufc/bouts/${escapeHtml(bout?.id || bout?.boutId || '')}/">` +
      `<div class="ufcx-fight-label"><span>BOSSAK / ${val(bout?.weightClass, 'Gecis')}</span><b>${escapeHtml(val(bout?.cardPosition || bout?.title, 'Card'))}</b></div>` +
      `<div class="ufcx-corner red"><img src="${escapeHtml(fighterImage(red))}" data-fallback="${escapeHtml(fallbackImage(red))}" onerror="this.onerror=null;this.src=this.dataset.fallback" alt="${escapeHtml(redName)}"><strong>${escapeHtml(redName)}</strong><small>${escapeHtml(val(red.profile?.recordText || red.recordText, ''))}</small></div>` +
      `<i>VS</i>` +
      `<div class="ufcx-corner blue"><img src="${escapeHtml(fighterImage(blue))}" data-fallback="${escapeHtml(fallbackImage(blue))}" onerror="this.onerror=null;this.src=this.dataset.fallback" alt="${escapeHtml(blueName)}"><strong>${escapeHtml(blueName)}</strong><small>${escapeHtml(val(blue.profile?.recordText || blue.recordText, ''))}</small></div>` +
      `</a>`;
  };

  const fighterCard = fighter => {
    const name = val(fighter.name ?? fighter.fighterName ?? fighter.profile?.name, 'Dövüşçü');
    const image = fighterImage(fighter);
    return `<a class="ufcx-fighter" href="/ufc/fighters/${escapeHtml(fighter.slug || fighter.fighterSlug || fighter.id || slugify(name))}/">
      <img src="${escapeHtml(image)}" data-fallback="${escapeHtml(fallbackImage(fighter))}" onerror="this.onerror=null;this.src=this.dataset.fallback" alt="${escapeHtml(name)}">
      <span><b>${escapeHtml(name)}</b><small>${escapeHtml(val(fighter.weightClass || fighter.division, 'UFC'))} · ${escapeHtml(val(fighter.recordText || fighter.record, 'Kayıt bekleniyor'))}</small></span>
    </a>`;
  };

  const eventCard = item => {
    const slug = item.slug || item.id || '';
    const title = val(item.title || item.name || item.shortTitle, 'UFC etkinligi');
    const date = val(item.eventDateLabel || item.date || item.startsAt, 'Tarih');
    const venue = val(item.locationText || item.venue || item.location, 'Arena');
    return `<a class="ufcx-card" href="/ufc/events/${escapeHtml(slug)}/">` +
      `<small>${escapeHtml(date)}</small>` +
      `<strong>${escapeHtml(title)}</strong>` +
      `<span>${escapeHtml(venue)}</span>` +
      `</a>`;
  };

  const buildStatItem = (label, value) => `<div><small>${escapeHtml(label)}</small><b>${escapeHtml(value)}</b></div>`;

  const api = async path => {
    const response = await fetch(`/api/ufc/${path}`);
    if (!response.ok) throw new Error(`Cito ${response.status}`);
    return response.json();
  };

  const fetchFighters = async (id, extra = '') => {
    const path = id ? `fighters/${encodeURIComponent(id)}${extra}` : 'fighters?page=1&limit=50';
    const payload = await api(path);
    return unwrap(payload);
  };

  const topDivision = 'bantamweight';

  async function renderHome() {
    const [upcoming, rankings, athletes] = await Promise.all([
      api('events/upcoming?limit=8').catch(() => ({ data: [] })),
      api('rankings?limit=10').catch(() => ({ data: [] })),
      api('search?q=islam&limit=4').catch(() => ({ data: [] })),
    ]);

    const nextEvent = rowsOf(upcoming)[0] || {};
    const nextImage = val(nextEvent.imageUrl, '/assets/images/sports/ufc-arena-v1.png');
    const eventTitle = val(nextEvent.title || nextEvent.shortTitle, 'UFC Etkinligi');
    const mainBouts = (nextEvent.bouts || rowsOf(await api(`events/${encodeURIComponent(nextEvent.slug || nextEvent.id || '')}`)));

    const mainFight = Array.isArray(mainBouts) && mainBouts.length ? mainBouts[0] : null;
    const undercard = Array.isArray(mainBouts) ? mainBouts.slice(1, 5) : [];

    const rankingList = rowsOf(rankings).slice(0, 8);

    host.innerHTML = `
      <section class="ufcx-event-hero" style="--event-art:url('${escapeHtml(nextImage)}')">
        <div>
          <span>YAKLASAN BUYUK KART</span>
          <h1>${escapeHtml(eventTitle)}</h1>
          <p>${escapeHtml(val(nextEvent.eventDateLabel || nextEvent.startsAt, 'Tarih'))} · ${escapeHtml(val(nextEvent.locationText || nextEvent.venue, 'UFC'))}</p>
          ${linkTo(`/ufc/events/${escapeHtml(nextEvent.slug || nextEvent.id || '')}/`)}
        </div>
      </section>
      <section class="ufcx-fight-night">
        <header><span>ANA KART</span><h2>Gecenin maci</h2></header>
        ${mainFight ? fightCard(mainFight) : emptyState('Kart hazirlaniyor')}
        <div class="ufcx-undercard">${undercard.map(fightCard).join('') || `<div class="ufcx-empty"><b>Alt kart bekleniyor</b><span>Etkinlik detayi geldiginde goruntulenecek</span></div>`}</div>
      </section>
      <div class="ufcx-grid">
        <article class="ufcx-module">
          <header><span>GUVEN</span><h2>Toplu Dövüşçüler</h2></header>
          ${(Array.isArray(rowsOf(athletes)) ? rowsOf(athletes) : []).filter(item => val(item?.name || item?.fighterName || item?.profile?.name, '')).map(fighterCard).slice(0, 4).join('') || emptyState('Dövüşçü bulunamadi')}
        </article>
        <article class="ufcx-module">
          <header><span>RANKING</span><h2>Gunluk Zirve</h2></header>
          ${rankingList.length ? rankingList.slice(0, 6).map((row, index) => `
            <p><b>${escapeHtml(val(row.rank, index + 1))}</b> ${escapeHtml(val(row.fighterName || row.name || row.fighter?.name, 'Dövüşçü'))} · ${escapeHtml(val(row.division || row.weightClass || topDivision, 'UFC'))}</p>
          `).join('') : emptyState('Sıralama yuklenemedi')}
        </article>
      </div>
    `;
  }

  async function renderEvents(id) {
    if (!id) {
      const upcoming = await api('events/upcoming?limit=50').catch(() => ({ data: [] }));
      const events = rowsOf(upcoming);
      host.innerHTML = `${head('EVENT CALENDAR', 'UFC Etkinlikleri', 'Gelecek kartlar ve son cardlar.')}${events.length ? `<div class="ufcx-grid">${events.map(eventCard).join('')}</div>` : emptyState('Etkinlik bulunamadi.')}`;
      return;
    }

    const eventPayload = await api(`events/${encodeURIComponent(id)}`).catch(() => ({ data: null }));
    const event = unwrap(eventPayload) || {};
    const hero = val(event.imageUrl, '/assets/images/sports/ufc-arena-v1.png');
    const bouts = Array.isArray(event.bouts) ? event.bouts : [];

    host.innerHTML = `
      <section class="ufcx-event-hero" style="--event-art:url('${escapeHtml(hero)}')">
        <div>
          <span>UFC CARD</span>
          <h1>${escapeHtml(val(event.title || event.shortTitle, 'UFC'))}</h1>
          <p>${escapeHtml(val(event.eventDateLabel || event.startsAt, 'Tarih'))} · ${escapeHtml(val(event.locationText || event.venue, 'UFC'))}</p>
        </div>
      </section>
      <section class="ufcx-fight-night">
        <header><span>FULL CARD</span><h2>Gecenin maclari</h2></header>
        ${bouts.length ? bouts.map((bout, index) => fightCard({ ...bout, isMain: index === 0 })).join('') : emptyState('Kart bekleniyor')}
      </section>
    `;
  }

  async function renderFighters(id) {
    if (!id) {
      const searchResult = await api('search?q=a&limit=80').catch(() => ({ data: [] }));
      const fighters = rowsOf(searchResult).filter(item => val(item?.name || item?.fighterName || item?.profile?.name, ''));
      host.innerHTML = `${head('FIGHTER ROSTER', 'UFC Dövüşçüleri', 'Sıklet, ülke, kilo ve kayıt bilgileri.')}
        <div class="ufcx-grid">${fighters.length ? fighters.slice(0, 60).map(fighterCard).join('') : emptyState('Dövüşçü bulunamadi')}
      `;
      return;
    }

    const [fighterPayload, statsPayload, fightsPayload] = await Promise.all([
      api(`fighters/${encodeURIComponent(id)}`).catch(() => ({ data: null })),
      api(`fighters/${encodeURIComponent(id)}/stats`).catch(() => ({ data: {} })),
      api(`fighters/${encodeURIComponent(id)}/fights`).catch(() => ({ data: [] })),
    ]);

    const fighter = unwrap(fighterPayload) || {};
    const stats = unwrap(statsPayload) || {};
    const fights = rowsOf(fightsPayload);
    const record = [val(fighter.recordWins || fighter.wins || (stats?.wins), 0), val(fighter.recordLosses || fighter.losses || (stats?.losses), 0), val(fighter.recordDraws || fighter.draws || (stats?.draws), 0)].join(' - ');

    const facts = [
      ['Ulke', fighter.country],
      ['Yas', fighter.age],
      ['Boy', fighter.heightInches ? `${fighter.heightInches} in` : fighter.height],
      ['Kilo', fighter.weightLbs ? `${fighter.weightLbs} lb` : fighter.weight],
      ['Reach', fighter.reachInches ? `${fighter.reachInches} in` : fighter.reach],
      ['Gard', fighter.stance],
      ['Kamp', fighter.trainsAt || fighter.gym || fighter.association]
    ].filter(([, value]) => value);

    const metricItems = Object.entries(stats || {})
      .filter(([, value]) => typeof value === 'number' || typeof value === 'string')
      .slice(0, 8)
      .map(([label, value]) => buildStatItem(label, val(value)));

    host.innerHTML = `
      <section class="ufcx-profile">
        <img src="${escapeHtml(fighterImage(fighter))}" data-fallback="${escapeHtml(fallbackImage(fighter))}" onerror="this.onerror=null;this.src=this.dataset.fallback">
        <div>
          <span>${escapeHtml(val(fighter.weightClass || fighter.division, 'UFC'))}</span>
          <h1>${escapeHtml(val(fighter.name || fighter.fighterName, 'Dövüşçü'))}</h1>
          <strong>${escapeHtml(record)} (W-L-D)</strong>
          <p>${escapeHtml(val(fighter.nickname, ''))}</p>
        </div>
      </section>
      <div class="ufcx-facts">
        ${facts.map(([label, value]) => `<div><small>${escapeHtml(label)}</small><b>${escapeHtml(val(value))}</b></div>`).join('')}
      </div>
      <section class="ufcx-grid">
        <article class="ufcx-module">
          <header><span>PERFORMANS</span><h2>Meslek Istatistikleri</h2></header>
          <div class="ufcx-metrics">${metricItems.join('') || '<div style="padding:12px;color:#8b9190">Veri bekleniyor.</div>'}</div>
        </article>
        <article class="ufcx-module">
          <header><span>MACLAR</span><h2>Son maclar</h2></header>
          ${fights.length ? fights.slice(0, 8).map(bout => fightCard(bout)).join('') : emptyState('Geçmis bekleniyor')}
        </article>
      </section>
    `;
  }

  async function renderRankings() {
    const rankingsPayload = await api('rankings?limit=120').catch(() => ({ data: [] }));
    const parsed = rowsOf(rankingsPayload);
    const sections = [];

    if (!parsed.length) {
      host.innerHTML = `${head('OFFICIAL BOARD', 'UFC Sıralamalari', 'Branslar ve resmî siralar.')}${emptyState('Sıralama bulunamadi')}`;
      return;
    }

    const grouped = new Map();
    parsed.forEach(item => {
      const division = val(item.division || item.name || 'UFC', 'UFC');
      if (!grouped.has(division)) grouped.set(division, []);
      grouped.get(division).push(item);
    });

    for (const [division, rows] of grouped.entries()) {
      const sorted = rows.sort((a, b) => (Number(a.rank) || 999) - (Number(b.rank) || 999));
      const champion = sorted.find(item => String(item.champion || item.rankText || '').toLowerCase() === 'c' || item.isChampion || item.title === 'champion') || sorted[0] || {};
      sections.push(`
        <article class="ufcx-module">
          <header><span>SIKLET</span><h2>${escapeHtml(division)}</h2></header>
          <h3 style="margin:10px 0">Sampiyon: ${escapeHtml(val(champion.fighterName || champion.name || champion.fighter?.name, 'Vacant'))}</h3>
          ${sorted.map((row, index) => `
            <p><b>${escapeHtml(val(row.rank || row.rankText || index + 1))}</b> ${escapeHtml(val(row.fighterName || row.name || row.fighter?.name, 'Dövüşçü'))} · ${escapeHtml(val(row.recordText || row.record, ''))}</p>
          `).join('')}
        </article>`);
    }

    host.innerHTML = `${head('OFFICIAL BOARD', 'UFC Sıralamalari', 'Sikletler ve resmi adaylar')}${sections.join('')}`;
  }

  async function resolveFighterBySlug(value, fallbackName) {
    const search = await api(`search?q=${encodeURIComponent(value)}&limit=10`).catch(() => ({ data: [] }));
    const list = rowsOf(search);
    return list.find(item => item.slug === value || item.fighterSlug === value || item.id === value) || list[0] || { name: fallbackName || value };
  }

  async function renderCompare() {
    const [_, __, section, rawA, rawB] = location.pathname.split('/').filter(Boolean);
    const query = new URLSearchParams(location.search);
    const aName = query.get('a') || rawA || 'islam machado';
    const bName = query.get('b') || rawB || 'alex poirier';

    const [fightersSeed, maybeA, maybeB] = await Promise.all([
      api('search?q=a&limit=40').catch(() => ({ data: [] })),
      resolveFighterBySlug(aName, aName),
      resolveFighterBySlug(bName, bName),
    ]);

    const options = rowsOf(fightersSeed)
      .filter(item => item?.slug || item?.fighterSlug || item?.id || item?.name)
      .map(item => ({
        id: item.slug || item.fighterSlug || item.id,
        label: val(item.name || item.fighterName, 'Dövüşçü'),
      }));

    const idA = escapeHtml(maybeA.slug || maybeA.fighterSlug || maybeA.id || aName);
    const idB = escapeHtml(maybeB.slug || maybeB.fighterSlug || maybeB.id || bName);

    if (!maybeA?.name && !maybeB?.name) {
      host.innerHTML = `${head('FIGHTER COMPARISON', 'UFC Karşılaştırma', 'Iki dovuscu arasinda teknik karsilastirma.')}
      <div class="ufcx-grid">
        <article class="ufcx-module">
          <header><span>SEÇIM</span><h2>Dövüsçü A seç</h2></header>
          <label for="ufcxCompareA">Dövüsçü A</label>
          <select id="ufcxCompareA" onchange="location.assign('/ufc/compare/?a=' + this.value);">
            <option value="">Seç</option>
            ${options.map(item => `<option value="${escapeHtml(item.id)}" ${item.id===aName?'selected':''}>${escapeHtml(item.label)}</option>`).join('')}
          </select>
          <label for="ufcxCompareB">Dövüsçü B</label>
          <select id="ufcxCompareB" onchange="location.assign('/ufc/compare/?a=${escapeHtml(idA)}&b=' + this.value);">
            <option value="">Seç</option>
            ${options.map(item => `<option value="${escapeHtml(item.id)}" ${item.id===bName?'selected':''}>${escapeHtml(item.label)}</option>`).join('')}
          </select>
        </article>
      </div>`;
      return;
    }

    const [fighterA, fighterB, statsA, statsB, fightsA, fightsB] = await Promise.all([
      api(`fighters/${encodeURIComponent(idA)}`).catch(() => ({ data: {} })),
      api(`fighters/${encodeURIComponent(idB)}`).catch(() => ({ data: {} })),
      api(`fighters/${encodeURIComponent(idA)}/stats`).catch(() => ({ data: {} })),
      api(`fighters/${encodeURIComponent(idB)}/stats`).catch(() => ({ data: {} })),
      api(`fighters/${encodeURIComponent(idA)}/fights`).catch(() => ({ data: [] })),
      api(`fighters/${encodeURIComponent(idB)}/fights`).catch(() => ({ data: [] })),
    ]);

    const left = unwrap(fighterA) || {};
    const right = unwrap(fighterB) || {};
    const stA = unwrap(statsA) || {};
    const stB = unwrap(statsB) || {};

    const leftFights = rowsOf(fightsA);
    const rightFights = rowsOf(fightsB);
    const slugLeft = val(left.slug || left.fighterSlug || left.id);
    const slugRight = val(right.slug || right.fighterSlug || right.id);

    const headToHead = leftFights.filter(fight => {
      const red = fight.red || fight.fighters?.find(x => x.corner === 'red') || {};
      const blue = fight.blue || fight.fighters?.find(x => x.corner === 'blue') || {};
      const opponent = (red.fighterSlug || red.slug || red.fighter?.slug || red.fighterName);
      const opponent2 = (blue.fighterSlug || blue.slug || blue.fighter?.slug || blue.fighterName);
      return (fight.fighterSlug && (fight.fighterSlug === slugLeft || fight.fighterSlug === slugRight) && (opponent === slugRight || opponent === slugLeft)) ||
        (opponent && (opponent === slugRight || opponent === slugLeft)) ||
        (opponent2 && (opponent2 === slugRight || opponent2 === slugLeft));
    });

    const compareMetric = (label, a, b) => {
      const numA = Number(a) || 0;
      const numB = Number(b) || 0;
      const total = Math.max(numA + numB, 1);
      const ratioA = Math.round((numA / total) * 100);
      return `
        <div class="ufcx-module">
          <header><span>KARSILASTIRMA</span><h2>${escapeHtml(label)}</h2></header>
          <div class="ufcx-targets">
            <strong>${escapeHtml(val(left.name || left.fighterName, 'A'))}: ${escapeHtml(val(a))}</strong>
            <i><b style="width:${ratioA}%;background:${ratioA >= 50 ? '#35b37d' : '#c64f3f'}"></b></i>
            <strong>${escapeHtml(val(right.name || right.fighterName, 'B'))}: ${escapeHtml(val(b))}</strong>
          </div>
        </div>
      `;
    };

    const records = [
      ['KAZANAN', val(left.wins ?? stA.wins ?? 0), val(right.wins ?? stB.wins ?? 0)],
      ['KAYIP', val(left.losses ?? stA.losses ?? 0), val(right.losses ?? stB.losses ?? 0)],
      ['KO', val(stA.sigStrikesLandedPerMin ?? stA.kos ?? 0), val(stB.sigStrikesLandedPerMin ?? stB.kos ?? 0)],
      ['Str. isabet', val(stA.strikeAccuracy ?? stA.sigStrikesLandedPerMin ?? 0), val(stB.strikeAccuracy ?? stB.sigStrikesLandedPerMin ?? 0)]
    ].map(([label, aVal, bVal]) => compareMetric(label, aVal, bVal));

    host.innerHTML = `
      ${head('COMPARE', 'Dövüsçü Karşılaştırma', `${val(left.name || left.fighterName)} vs ${val(right.name || right.fighterName)}`)}
      <div class="ufcx-grid">
        <article class="ufcx-module">
          ${fighterCard(left)}
          ${fighterCard(right)}
        </article>
        <article class="ufcx-module">
          <header><span>HAZIRLIK</span><h2>Sonuc</h2></header>
          <p><b>H2H karsilasma:</b> ${escapeHtml(val(headToHead.length))}</p>
          ${records.join('')}
        </article>
      </div>
      <div class="ufcx-grid">
        ${leftFights.slice(0, 4).map(fight => fightCard(fight)).join('') || emptyState('Gecmis goruntulenemedi')}
        ${rightFights.slice(0, 4).map(fight => fightCard(fight)).join('') || emptyState('Gecmis goruntulenemedi')}
      </div>
    `;
  }

  async function renderLive() {
    const payload = await api('live').catch(() => ({ data: [] }));
    const payloadRows = rowsOf(payload);
    host.innerHTML = `${head('LIVE FIGHT NIGHT', 'Canli Oktagon', 'Aktif dovus akisi ve sonuclar.')}` +
      `<div class="ufcx-grid">${payloadRows.length ? payloadRows.map(fightCard).join('') : emptyState('Su anda canli dovus bulunmuyor')}</div>`;
  }

  async function renderBout(id) {
    if (!id) return renderLive();
    const payload = await api(`bouts/${encodeURIComponent(id)}`).catch(() => ({ data: {} }));
    const bout = unwrap(payload) || {};
    const fighters = Array.isArray(bout.fighters) ? bout.fighters : [];
    const red = fighters.find(item => item.corner === 'red') || {};
    const blue = fighters.find(item => item.corner === 'blue') || {};
    const redProfile = red.profile || red || {};
    const blueProfile = blue.profile || blue || {};
    const stPayloadA = await api(`fighters/${encodeURIComponent(red.slug || redProfile.slug || red.fighterSlug || '')}/stats`).catch(() => ({ data: {} }));
    const stPayloadB = await api(`fighters/${encodeURIComponent(blue.slug || blueProfile.slug || blue.fighterSlug || '')}/stats`).catch(() => ({ data: {} }));
    const stA = unwrap(stPayloadA) || {};
    const stB = unwrap(stPayloadB) || {};
    const statLine = (item, st) => `
      <article class="ufcx-module">
        <header><span>${escapeHtml(item.corner || 'Corner').toUpperCase()}</span><h2>${escapeHtml(val(item.fighterName || item.name || item.profile?.name, 'Dövüşçü'))}</h2></header>
        <div class="ufcx-facts">
          <div><small>Vurus/RA</small><b>${escapeHtml(val(st.significantStrikes || st.sigStrikesLanded, '—'))}</b></div>
          <div><small>Yerdeki süre</small><b>${escapeHtml(val(st.totalStrikesLanded || st.sigStrikesAttempted, '—'))}</b></div>
          <div><small>Takla</small><b>${escapeHtml(val(st.takedowns || st.takedownAvgPer15Min, '—'))}</b></div>
          <div><small>Submission</small><b>${escapeHtml(val(st.submissionAttempts || st.submissionAvgPer15Min, '—'))}</b></div>
        </div>
      </article>`;

    host.innerHTML = `${head('FIGHT CENTER', `${val(red.name || red.fighterName, 'Red')} vs ${val(blue.name || blue.fighterName, 'Blue')}`, val(bout.weightClass || bout.division, 'UFC'))}
      <section class="ufcx-fight-night">
        ${fightCard(bout)}
      </section>
      <section class="ufcx-grid">
        ${statLine(red, stA)}
        ${statLine(blue, stB)}
      </section>`;
  }

  async function route() {
    const parts = location.pathname.split('/').filter(Boolean);
    const section = (parts[1] || 'home').toLowerCase();
    const id = parts[2] || '';

    try {
      if (section === 'live') await renderLive();
      else if (section === 'events') await renderEvents(id);
      else if (section === 'fighters') await renderFighters(id);
      else if (section === 'rankings') await renderRankings();
      else if (section === 'bouts') await renderBout(id);
      else if (section === 'compare') await renderCompare();
      else await renderHome();
      if (id) {
        const links = main.querySelectorAll('.ufcx-nav a');
        links.forEach(link => {
          const href = link.getAttribute('href') || '';
          if (href === `/${parts[1]}/` || href === `/${parts[1]}/${section}/` || href === `/${parts[1]}/${section}/${id}/`) {
            link.style.color = 'white';
            link.style.borderColor = 'rgba(255,255,255,.6)';
          }
        });
      } else if (section === 'home' || !section) {
        main.querySelector('.ufcx-nav a[href="/ufc/"]').style.color = 'white';
      }
    } catch (error) {
      host.innerHTML = emptyState(`Veri alinmadi: ${escapeHtml(error.message)}`);
    }
  }

  route();
})();