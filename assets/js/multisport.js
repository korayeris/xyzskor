(() => {
  const SPORT_LABELS = {
    basketball: 'Basketbol',
    mma: 'Dovus',
    volleyball: 'Voleybol',
    hockey: 'Buz Hokeyi',
    rugby: 'Rugby'
  };

  let feedPromise = null;
  let activeSport = 'basketball';

  const escapeHTML = (value) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  function closeHub(){
    document.body.classList.remove('multisport-open');
    const hub = document.getElementById('multiSportHub');
    if(hub) hub.hidden = true;
    document.querySelectorAll('.multisport-nav-button').forEach((button) => button.classList.remove('active'));
  }

  function cardHTML(item){
    const first = item.first || item.home || {};
    const second = item.second || item.away || {};
    const score = item.score || '';
    return `<article class="multi-event-card">
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
    if(!available.includes(activeSport)) activeSport = available[0] || 'basketball';
    document.querySelectorAll('[data-multi-sport]').forEach((button) => {
      const key = button.dataset.multiSport;
      button.hidden = !available.includes(key);
      button.classList.toggle('active', key === activeSport);
    });
    const items = sports[activeSport] || [];
    title.textContent = SPORT_LABELS[activeSport] || 'Spor';
    note.textContent = `${payload?.date || ''} programi - ucretsiz API-Sports verisi`;
    grid.innerHTML = items.length
      ? items.slice(0, 12).map(cardHTML).join('')
      : '<div class="multi-event-empty"><strong>Bugun program bulunmuyor.</strong><span>Etkinligi olan diger branslar yukarida gorunur.</span></div>';
  }

  async function load(){
    if(!feedPromise){
      feedPromise = fetch('/api/sports/today', { headers:{ Accept:'application/json' } })
        .then(async (response) => {
          const payload = await response.json().catch(() => ({}));
          if(!response.ok) throw new Error(payload.error || 'sports_unavailable');
          return payload;
        }).catch((error) => { feedPromise = null; throw error; });
    }
    return feedPromise;
  }

  async function openHub(sport){
    activeSport = sport || activeSport;
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

  function init(){
    const primary = document.querySelector('.primary-nav');
    const wrap = document.querySelector('.wrap');
    if(!primary || !wrap || document.getElementById('multiSportHub')) return;
    const buttons = [
      ['basketball','Basketbol'],
      ['mma','Dovus'],
      ['volleyball','Diger Sporlar']
    ];
    buttons.forEach(([key,label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'maintab multisport-nav-button';
      button.dataset.multiSport = key;
      button.textContent = label;
      button.addEventListener('click', () => openHub(key));
      primary.appendChild(button);
    });
    const hub = document.createElement('main');
    hub.id = 'multiSportHub';
    hub.className = 'multisport-hub';
    hub.hidden = true;
    hub.innerHTML = `<header class="multisport-hero"><div><span>XYZSKOR MULTISPORT</span><h1 id="multiSportTitle">Basketbol</h1><p id="multiSportNote">Gunun programi</p></div><b>CANLI VERI</b></header>
      <nav class="multisport-switcher" aria-label="Spor bransi secimi">${Object.entries(SPORT_LABELS).map(([key,label]) => `<button type="button" data-multi-sport="${key}">${label}</button>`).join('')}</nav>
      <section class="multi-event-grid" id="multiSportGrid" aria-live="polite"></section>`;
    wrap.parentNode.insertBefore(hub, wrap);
    hub.querySelectorAll('[data-multi-sport]').forEach((button) => button.addEventListener('click', () => { activeSport = button.dataset.multiSport; load().then(render); }));
    document.getElementById('tabBtnFootball')?.addEventListener('click', closeHub, true);
    document.getElementById('tabBtnPredict')?.addEventListener('click', closeHub, true);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
