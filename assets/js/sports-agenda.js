(() => {
  const DATA_URL = '/assets/data/sports-agenda.json';
  let payloadPromise = null;
  let refreshQueued = false;

  const escapeHTML = (value) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const activeSport = () => {
    const root = location.pathname.split('/').filter(Boolean)[0] || '';
    return ({ basketbol: 'basketball', voleybol: 'volleyball', ufc: 'ufc', motorsports: 'motorsports' })[root] || '';
  };

  const mountTarget = (sport) => {
    if (sport === 'basketball' || sport === 'volleyball') return document.getElementById('multiSportGrid');
    if (sport === 'ufc') return document.getElementById('ufcxContent');
    if (sport === 'motorsports') return document.querySelector('.xms-center-stage');
    return null;
  };

  const loadPayload = () => payloadPromise || (payloadPromise = fetch(DATA_URL, {
    headers: { Accept: 'application/json' }, cache: 'force-cache', credentials: 'same-origin',
  }).then((response) => {
    if (!response.ok) throw new Error(`agenda_${response.status}`);
    return response.json();
  }));

  const cardHTML = (item) => `<article class="sports-agenda-card">
    <a class="sports-agenda-photo" href="${escapeHTML(item.sourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(item.title)} kaynağını aç">
      <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.imageAlt)}" loading="lazy" decoding="async">
      <span>${escapeHTML(item.eyebrow)}</span>
    </a>
    <div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.summary)}</p><footer><a href="${escapeHTML(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.sourceName)} ↗</a><a href="${escapeHTML(item.creditUrl)}" target="_blank" rel="noopener noreferrer license">${escapeHTML(item.credit)}</a></footer></div>
  </article>`;

  async function refresh() {
    refreshQueued = false;
    const sport = activeSport();
    const existing = document.querySelector('[data-sports-agenda]');
    if (!sport) { existing?.remove(); return; }
    const target = mountTarget(sport);
    if (!target) return;
    if (existing?.dataset.sportsAgenda === sport && existing.previousElementSibling === target) return;
    try {
      const payload = await loadPayload();
      if (sport !== activeSport()) return;
      const items = Array.isArray(payload?.sports?.[sport]) ? payload.sports[sport] : [];
      if (!items.length) { existing?.remove(); return; }
      const section = document.createElement('section');
      section.className = 'sports-agenda';
      section.dataset.sportsAgenda = sport;
      section.setAttribute('aria-labelledby', `sportsAgendaTitle-${sport}`);
      section.innerHTML = `<header><div><small>MANUEL EDİTORYAL SEÇKİ · ${escapeHTML(payload.checkedAt)}</small><h2 id="sportsAgendaTitle-${sport}">Branş gündemi</h2><p>Resmî kaynaklardan elle doğrulanan içerikler; görseller yerel ve lisans kayıtlıdır.</p></div><a href="/assets/legal/sports-agenda-image-credits.json">Görsel lisansları</a></header><div class="sports-agenda-grid">${items.map(cardHTML).join('')}</div>`;
      existing?.remove();
      target.insertAdjacentElement('afterend', section);
    } catch (_error) {
      existing?.remove();
    }
  }

  const queueRefresh = () => {
    if (refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(refresh);
  };
  new MutationObserver(queueRefresh).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', queueRefresh);
  window.addEventListener('xyz:route-change', queueRefresh);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', queueRefresh, { once: true }) : queueRefresh();
})();
