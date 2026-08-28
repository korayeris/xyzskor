(() => {
  const SPORT_LABELS = {
    basketball: 'Basketbol',
    mma: 'UFC / MMA',
    volleyball: 'Voleybol'
  };

  const feedPromises = new Map();
  const feedControllers = new Map();
  const sharedPayloads = window.__XYZ_MULTISPORT_PAYLOADS__ instanceof Map
    ? window.__XYZ_MULTISPORT_PAYLOADS__
    : (window.__XYZ_MULTISPORT_PAYLOADS__ = new Map());
  const payloadReceivedAt = new Map();
  const basketballStandingsPayloads = new Map();
  const basketballStandingsPromises = new Map();
  const basketballStandingsControllers = new Map();
  let activeSport = 'basketball';
  let activeView = 'home';
  let activeLeague = 'all';
  let hubRequestEpoch = 0;
  let basketballStandingsEpoch = 0;
  let pendingViewFocus = '';
  let pendingBasketballHubFocus = false;
  let pendingVolleyballHubFocus = false;
  const MULTISPORT_PAYLOAD_TTL_MS = 15 * 60 * 1000;
  const BASKETBALL_STANDINGS_TTL_MS = 30 * 60 * 1000;
  const SPORT_LEAGUE_CATALOG = {
    volleyball: ['Sultanlar Ligi', 'Efeler Ligi', 'CEV Şampiyonlar Ligi', 'Voleybol Milletler Ligi']
  };

  const escapeHTML = (value) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const sportSlug = (sport) => ({basketball:'basketbol',mma:'ufc',volleyball:'voleybol'}[sport] || 'basketbol');
  const visualFallback = (name, sport = activeSport) => {
    const colors = {basketball:'#ff9d24',mma:'#ff405d',volleyball:'#20c997'};
    const initials = String(name || SPORT_LABELS[sport] || 'XYZ').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${colors[sport] || '#ef4058'}"/><stop offset="1" stop-color="#091118"/></linearGradient></defs><rect width="160" height="160" rx="32" fill="url(#g)"/><circle cx="80" cy="68" r="34" fill="rgba(255,255,255,.14)"/><path d="M30 150c5-36 24-54 50-54s45 18 50 54" fill="rgba(255,255,255,.12)"/><text x="80" y="88" text-anchor="middle" font-family="Arial" font-size="40" font-weight="800" fill="white">${initials}</text></svg>`)}`;
  };
  const imageOf = (item = {}) => {
    const candidate = item.proxiedImageUrl || item.logo || item.logoUrl || item.logo_url || item.image || item.imageUrl || item.image_url || item.photo || item.photoUrl || item.avatar || item.headshot || item.headshotUrl || item.badge || item.crest;
    if(typeof candidate === 'string') return candidate;
    if(candidate && typeof candidate === 'object') return candidate.url || candidate.src || candidate.href || '';
    return '';
  };
  const visual = (name, src, alt = name) => `<img src="${escapeHTML(src || visualFallback(name))}" data-fallback="${escapeHTML(visualFallback(name))}" onerror="this.onerror=null;this.src=this.dataset.fallback" alt="${escapeHTML(alt || '')}" loading="lazy">`;
  const viewSlug = (view) => ({games:'maclar',leagues:'ligler',teams:'takimlar',predict:'predict'}[view] || '');
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
    const sport = ({basketbol:'basketball',voleybol:'volleyball'})[parts[0]];
    const view = ({maclar:'games',ligler:'leagues',takimlar:'teams',predict:'predict'})[parts[1]] || 'home';
    return sport ? {sport,view} : null;
  }

  function abortBasketballStandings(exceptScope = ''){
    basketballStandingsEpoch += 1;
    basketballStandingsControllers.forEach((controller, scope) => {
      if(scope === exceptScope) return;
      controller.abort();
      basketballStandingsControllers.delete(scope);
      basketballStandingsPromises.delete(scope);
    });
  }

  function closeHub(){
    hubRequestEpoch += 1;
    pendingViewFocus='';
    pendingBasketballHubFocus=false;
    pendingVolleyballHubFocus=false;
    feedControllers.forEach((controller,scope)=>{ controller.abort(); feedPromises.delete(scope); });
    feedControllers.clear();
    abortBasketballStandings();
    // Futbol merkezi marka kökündedir; branştan çıkış doğrudan ana sayfaya döner.
    if(routeState()) {
      if(window.XYZBranchRouter) window.XYZBranchRouter.navigate('/', {label:'Futbol'});
      else location.assign('/');
      return;
    }
    document.body.classList.remove('multisport-open');
    const hub = document.getElementById('multiSportHub');
    if(hub) hub.hidden = true;
    document.querySelectorAll('.multisport-nav-button').forEach((button) => button.classList.remove('active'));
  }

  // Futbol yüzeyi DOM'dan silinmez, yalnız gizlenir. Silmek route-aware
  // geçişi tek yönlü hale getiriyordu; gizlemek geri dönüşü mümkün kılar ve
  // branş izolasyonunu (görünür DOM sızıntısı yok) aynı şekilde korur.
  const FOOTBALL_SURFACE_IDS = ['page-story','page-live','footballContextNav','footballLeagueCommand','matchdayCommand'];

  function pruneFootballSurface(){
    if(!routeState()) return;
    FOOTBALL_SURFACE_IDS.forEach((id)=>{
      const element = document.getElementById(id);
      if(element){ element.hidden = true; element.classList.add('xyz-branch-hidden'); }
    });
    document.querySelectorAll('.next-match-ticker,.live-ticker').forEach((element)=>{
      element.hidden = true; element.classList.add('xyz-branch-hidden');
    });
  }

  function restoreFootballSurface(){
    document.querySelectorAll('.xyz-branch-hidden').forEach((element)=>{
      element.hidden = false; element.classList.remove('xyz-branch-hidden');
    });
  }

  // Branş ekranlarında veri az olduğunda büyük boş alan bırakılmaz (P1.5/P1.6):
  // doğrulanmış boş sonuç, kapsam ve son güncelleme zamanı kompakt biçimde
  // gösterilir. Boş sonuç asla "veri yok" diye sessizce geçilmez.
  function lastUpdatedLabel(payload){
    const raw=payload?.updated_at||payload?.updatedAt||payload?.generated_at||null;
    if(!raw) return '';
    const parsed=new Date(raw);
    if(Number.isNaN(parsed.getTime())) return '';
    try{
      return new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Istanbul'}).format(parsed);
    }catch(_error){ return ''; }
  }

  function compactEmptyHTML(title, detail, payload, scopeLabel){
    const updated=lastUpdatedLabel(payload);
    const meta=[
      scopeLabel ? `Kapsam: ${scopeLabel}` : '',
      updated ? `Son güncelleme: ${updated}` : 'Son güncelleme: sağlayıcıdan bekleniyor'
    ].filter(Boolean);
    return `<div class="multi-event-empty is-compact" role="status">`
      + `<strong>${escapeHTML(title)}</strong>`
      + (detail ? `<span>${escapeHTML(detail)}</span>` : '')
      + `<em>${meta.map(escapeHTML).join(' · ')}</em>`
      + `</div>`;
  }

  function updateBranchIdentity(sport, statusText){
    const label = SPORT_LABELS[sport] || 'Spor';
    const title = document.getElementById('multiSportTitle');
    const note = document.getElementById('multiSportNote');
    if(title) title.textContent = label;
    if(note) note.textContent = statusText || 'Günün programı hazırlanıyor';
  }

  function teamCardHTML(team){
    return `<article class="multi-team-card"><span>${visual(team.name, imageOf(team))}</span><strong>${escapeHTML(team.name || 'Takim')}</strong><small>Gunun programinda</small></article>`;
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
      <div class="multi-event-side"><span>${visual(first.name, imageOf(first))}</span><strong>${escapeHTML(first.name || 'TBA')}</strong></div>
      <div class="multi-event-score"><b>${escapeHTML(score)}</b><small>${escapeHTML(item.status || 'Yaklasan') + (item.archived ? ' · Son gerceklesen' : '')}</small></div>
      <div class="multi-event-side away"><strong>${escapeHTML(second.name || 'TBA')}</strong><span>${visual(second.name, imageOf(second))}</span></div>
    </article>`;
  }

  function updateBranchTicker(items){
    const ticker = document.getElementById('liveTicker');
    if(!ticker || !activeSport || activeSport === 'football') return;
    const labels = {basketball:'SIRADAKI BASKETBOL MACI',volleyball:'SIRADAKI VOLEYBOL MACI',mma:'SIRADAKI UFC ETKINLIGI'};
    const next = items.find((item) => !/finished|ended|after|ft/i.test(item.status || '')) || items[0];
    if(!next){ ticker.innerHTML = `<span class="ticker-dot"></span><span class="ticker-label">${labels[activeSport] || 'SIRADAKI ETKINLIK'}</span><span class="ticker-match">Program verisi bekleniyor</span>`; return; }
    const first = next.first || next.home || {};
    const second = next.second || next.away || {};
    ticker.innerHTML = `<span class="ticker-dot"></span><span class="ticker-label">${labels[activeSport] || 'SIRADAKI ETKINLIK'}</span><span class="ticker-match">${escapeHTML(first.name || 'TBA')} — ${escapeHTML(second.name || 'TBA')}</span><span class="ticker-time mono">${escapeHTML(next.time || next.feedDate || next.date || '')}</span>`;
  }

  const basketballStatusText = (item) => String(item?.status || '').trim().toLowerCase();
  const basketballIsLive = (item) => {
    const status=basketballStatusText(item);
    if(!status || /\bnot started\b|\bscheduled\b|\bpostponed\b|\bcancelled\b|\b(?:game\s+)?finished\b/.test(status)) return false;
    return /\blive\b|\bin progress\b|\bhalf(?: |-)?time\b|\bbreak time\b|\bover ?time\b|\bquarter\s*[1-4]\b|\bq[1-4]\b|\bperiod\s*\d+\b/.test(status);
  };
  const basketballIsFinished = (item) => /\b(?:game\s+)?finished\b|\bended\b|\bafter\b|^(?:ft|aet)$/i.test(basketballStatusText(item));
  const basketballEventTime = (item) => {
    const timestamp = Number(item?.timestamp);
    if(Number.isFinite(timestamp) && timestamp > 0) return timestamp * 1000;
    const parsed = Date.parse(item?.date || item?.feedDate || '');
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  };

  function basketballLeagueDescriptors(items){
    const leagues = new Map();
    items.forEach((item) => {
      const name = item?.league || item?.category;
      if(!name) return;
      const id=item?.leagueId != null ? String(item.leagueId) : '';
      const season=item?.season != null ? String(item.season) : '';
      const key=id&&season?`scope:${id}:${season}`:`name:${name}`;
      if(!leagues.has(key)) leagues.set(key, {
        key,
        name,
        id,
        season,
        logo:item?.leagueLogo || '',
        country:item?.country || '',
        events:[],
      });
      const league = leagues.get(key);
      if(!league.id && item?.leagueId != null) league.id=String(item.leagueId);
      if(!league.season && item?.season != null) league.season=String(item.season);
      if(!league.logo && item?.leagueLogo) league.logo=item.leagueLogo;
      if(!league.country && item?.country) league.country=item.country;
      league.events.push(item);
    });
    return [...leagues.values()];
  }

  function basketballSortEvents(items){
    return [...items].sort((first, second) => {
      const phase = (item) => basketballIsLive(item) ? 0 : basketballIsFinished(item) ? 2 : 1;
      const phaseDiff = phase(first) - phase(second);
      if(phaseDiff) return phaseDiff;
      const timeDiff = basketballEventTime(first) - basketballEventTime(second);
      return basketballIsFinished(first) ? -timeDiff : timeDiff;
    });
  }

  function basketballStatusLabel(item){
    if(basketballIsLive(item)) return 'CANLI';
    if(basketballIsFinished(item)) return 'BİTTİ';
    return item?.time || 'YAKLAŞAN';
  }

  function basketballScheduleHTML(items){
    const rows=basketballSortEvents(items).slice(0,9);
    if(!rows.length) return '<p class="basketball-panel-empty">Seçili lig için doğrulanmış günlük maç programı bulunmuyor.</p>';
    return rows.map((item) => {
      const first=item.first||item.home||{},second=item.second||item.away||{};
      const live=basketballIsLive(item),finished=basketballIsFinished(item);
      return `<article class="basketball-fixture-row ${live?'is-live':finished?'is-finished':'is-upcoming'}">
        <span class="basketball-fixture-state">${escapeHTML(basketballStatusLabel(item))}</span>
        <span class="basketball-fixture-team home"><strong>${escapeHTML(first.name||'TBA')}</strong>${visual(first.name,imageOf(first),'')}</span>
        <b>${escapeHTML(scoreText(item.score))}</b>
        <span class="basketball-fixture-team away">${visual(second.name,imageOf(second),'')}<strong>${escapeHTML(second.name||'TBA')}</strong></span>
      </article>`;
    }).join('');
  }

  function basketballStandingsSkeletonHTML(){
    return Array.from({length:8},(_,index)=>`<tr class="basketball-standing-skeleton" aria-hidden="true" style="--basket-skeleton-index:${index}">
      <td><i></i></td><th scope="row"><i></i></th><td><i></i></td><td><i></i></td><td><i></i></td><td><i></i></td><td><i></i></td>
    </tr>`).join('');
  }

  function basketballStandingsScope(league){
    return league?.id && league?.season ? `${league.id}:${league.season}` : '';
  }

  function basketballStandingRowHTML(row){
    const rawPercentage=Number(row?.percentage);
    const percentage=Number.isFinite(rawPercentage) ? (rawPercentage>1 ? rawPercentage : rawPercentage*100) : null;
    const difference=Number(row?.pointDifference||0);
    const team=row?.team||{};
    return `<tr class="basketball-standing-row">
      <td class="rank">${escapeHTML(row?.position||'—')}</td>
      <th scope="row"><span class="basketball-standing-team">${visual(team.name,imageOf(team),'')}<span><strong>${escapeHTML(team.name||'Takım')}</strong>${row?.group?`<small>${escapeHTML(row.group)}</small>`:''}</span></span></th>
      <td>${escapeHTML(row?.played??0)}</td>
      <td>${escapeHTML(row?.won??0)}</td>
      <td>${escapeHTML(row?.lost??0)}</td>
      <td>${percentage==null?'—':escapeHTML(percentage.toFixed(1))}</td>
      <td class="difference">${difference>0?'+':''}${escapeHTML(difference)}</td>
    </tr>`;
  }

  function basketballFeaturedHTML(featured){
    if(!featured) return '<div class="basketball-panel-empty">Günün vitrini için doğrulanmış karşılaşma bekleniyor.</div>';
    const first=featured.first||featured.home||{},second=featured.second||featured.away||{};
    return `<div class="basketball-feature-match">
      <figure>${visual(first.name,imageOf(first),'')}<figcaption>${escapeHTML(first.name||'TBA')}</figcaption></figure>
      <div><small>${escapeHTML(basketballStatusLabel(featured))}</small><strong>${escapeHTML(scoreText(featured.score))}</strong><span>${escapeHTML(featured.time||featured.feedDate||'')}</span></div>
      <figure>${visual(second.name,imageOf(second),'')}<figcaption>${escapeHTML(second.name||'TBA')}</figcaption></figure>
    </div>`;
  }

  function basketballLeaguePortalHTML(items, league, payload){
    const sorted=basketballSortEvents(items);
    const featured=sorted[0]||null;
    const teams=new Map();
    items.forEach((item)=>[item.first||item.home,item.second||item.away].forEach((team)=>{if(team?.name&&!teams.has(team.name))teams.set(team.name,team);}));
    const live=items.filter(basketballIsLive).length;
    const finished=items.filter(basketballIsFinished).length;
    const season=league?.season||'Güncel sezon';
    const scope=basketballStandingsScope(league);
    const updated=lastUpdatedLabel(payload);
    return `<section class="basketball-league-center" data-basketball-league-center data-basketball-standings-scope="${escapeHTML(scope)}">
      <header class="basketball-league-identity">
        <span class="basketball-league-logo">${league?visual(league.name,league.logo,''):'<b aria-hidden="true">B</b>'}</span>
        <div><small>XYZSKOR · BASKETBOL LİG MERKEZİ</small><h2>${escapeHTML(league?.name||'Basketbol')}</h2><p>${escapeHTML([league?.country,season].filter(Boolean).join(' · '))}</p></div>
        <span class="basketball-data-state">${payload?.degraded||payload?.stale?'SON DOĞRULANMIŞ VERİ':'GÜNLÜK CANLI PROGRAM'}</span>
      </header>
      <div class="basketball-overview-layout">
        <section class="basketball-overview-panel basketball-standings-panel" aria-labelledby="basketballStandingsTitle">
          <header><div><small>GÜNCEL SEZON</small><h3 id="basketballStandingsTitle">Puan durumu</h3></div><span>${escapeHTML(season)}</span></header>
          <div class="basketball-standings-scroll" tabindex="0" role="region" aria-labelledby="basketballStandingsTitle">
            <table class="basketball-standings-table" aria-busy="true">
              <caption>${escapeHTML(league?.name||'Basketbol')} puan durumu</caption>
              <thead><tr><th scope="col">#</th><th scope="col">TAKIM</th><th scope="col">O</th><th scope="col">G</th><th scope="col">M</th><th scope="col">%</th><th scope="col">AV</th></tr></thead>
              <tbody>${basketballStandingsSkeletonHTML()}</tbody>
            </table>
          </div>
          <footer class="basketball-standings-status" role="status" aria-live="polite">${scope?'Resmî sıralama hazırlanıyor…':'Lig ve sezon kimliği program verisinden bekleniyor.'}</footer>
        </section>
        <aside class="basketball-overview-panel basketball-fixtures-panel">
          <header><div><small>MAÇ AKIŞI</small><h3>Sonuçlar ve fikstür</h3></div><span>${items.length} maç</span></header>
          <div class="basketball-fixtures-body">${basketballScheduleHTML(items)}</div>
        </aside>
      </div>
      <section class="basketball-overview-metrics" aria-label="Seçili lig özeti">
        <article><span>GÜNLÜK PROGRAM</span><b>${items.length}</b><small>doğrulanmış maç</small></article>
        <article><span>CANLI</span><b class="is-live">${live}</b><small>devam eden</small></article>
        <article><span>TAMAMLANAN</span><b>${finished}</b><small>sonuçlanan</small></article>
        <article><span>TAKIM</span><b>${teams.size}</b><small>günlük kapsam</small></article>
      </section>
      <section class="basketball-lower">
        <article class="basketball-feature">
          <header><div><small>GÜNÜN VİTRİNİ</small><h3>${escapeHTML(featured?.league||league?.name||'Basketbol')}</h3></div></header>
          ${basketballFeaturedHTML(featured)}
        </article>
        <article class="basketball-source-note">
          <small>VERİ KAPSAMI</small><h3>Şeffaf, lig bazlı görünüm</h3>
          <p>Maç programı ve puan tablosu yalnız sağlayıcının seçili lig ile sezon için doğruladığı kayıtlardan oluşur.</p>
          <span>${escapeHTML(updated?'Son güncelleme: '+updated:'Güncelleme zamanı sağlayıcıdan bekleniyor')}</span>
        </article>
      </section>
    </section>`;
  }

  function basketballLoadingHTML(){
    return `<section class="basketball-league-center basketball-loading-shell" aria-busy="true">
      <header class="basketball-league-identity"><span class="basketball-league-logo"><b aria-hidden="true">B</b></span><div><small>XYZSKOR · BASKETBOL LİG MERKEZİ</small><h2>Lig merkezi hazırlanıyor</h2><p>Günlük program ve sezon sıralaması</p></div></header>
      <div class="basketball-overview-layout">
        <section class="basketball-overview-panel basketball-standings-panel"><header><div><small>GÜNCEL SEZON</small><h3>Puan durumu</h3></div></header><div class="basketball-standings-scroll"><table class="basketball-standings-table"><tbody>${basketballStandingsSkeletonHTML()}</tbody></table></div></section>
        <aside class="basketball-overview-panel basketball-fixtures-panel"><header><div><small>MAÇ AKIŞI</small><h3>Sonuçlar ve fikstür</h3></div></header><div class="basketball-fixture-skeleton">${Array.from({length:6},()=>'<i></i>').join('')}</div></aside>
      </div>
      <p class="basketball-loading-label" role="status">Basketbol merkezi hazırlanıyor</p>
    </section>`;
  }

  function basketballErrorHTML(){
    return `<section class="basketball-league-center">
      <header class="basketball-league-identity"><span class="basketball-league-logo"><b aria-hidden="true">B</b></span><div><small>XYZSKOR · BASKETBOL LİG MERKEZİ</small><h2>Basketbol</h2><p>Veri bağlantısı yeniden kurulacak</p></div></header>
      <div class="basketball-error-state" role="alert"><small>SAĞLAYICI DURUMU</small><h3>Basketbol verisi şu anda alınamadı.</h3><p>Bu doğrulanmış boş sonuç değil. Bağlantı düzeldiğinde günlük program ve puan tablosu yeniden yüklenecek.</p><button type="button" data-basketball-hub-retry>Yeniden dene</button></div>
    </section>`;
  }

  async function loadBasketballStandings(league, force = false){
    const scope=basketballStandingsScope(league);
    if(!scope) throw new Error('basketball_standings_scope_missing');
    const cached=basketballStandingsPayloads.get(scope);
    if(!force && cached && Date.now()-cached.receivedAt<BASKETBALL_STANDINGS_TTL_MS) return cached.payload;
    if(force) basketballStandingsPayloads.delete(scope);
    if(basketballStandingsPromises.has(scope)) return basketballStandingsPromises.get(scope);
    const controller=typeof AbortController!=='undefined'?new AbortController():null;
    if(controller) basketballStandingsControllers.set(scope,controller);
    const request=fetch(`/api/sports/basketball/standings?league=${encodeURIComponent(league.id)}&season=${encodeURIComponent(league.season)}`,{
      cache:'no-store',
      headers:{Accept:'application/json','Cache-Control':'no-cache'},
      signal:controller?.signal,
    }).then(async(response)=>{
      const payload=await response.json().catch(()=>({}));
      if(!response.ok){
        const error=new Error(payload?.error||'basketball_standings_unavailable');
        error.status=response.status;
        throw error;
      }
      if(payload?.sport!=='basketball'||String(payload?.leagueId)!==String(league.id)||String(payload?.season)!==String(league.season)||!Array.isArray(payload?.standings)){
        throw new Error('basketball_standings_scope_mismatch');
      }
      payload.stale=response.headers.get('x-data-stale')==='true'||Boolean(payload.stale);
      basketballStandingsPayloads.set(scope,{payload,receivedAt:Date.now()});
      return payload;
    }).finally(()=>{
      if(basketballStandingsPromises.get(scope)===request) basketballStandingsPromises.delete(scope);
      if(basketballStandingsControllers.get(scope)===controller) basketballStandingsControllers.delete(scope);
    });
    basketballStandingsPromises.set(scope,request);
    return request;
  }

  function basketballStandingsEmptyRow(message, kind = 'empty'){
    return `<tr class="basketball-standings-message is-${escapeHTML(kind)}"><td colspan="7">${escapeHTML(message)}${kind==='error'?'<button type="button" data-basketball-standings-retry>Yeniden dene</button>':''}</td></tr>`;
  }

  function renderBasketballStandingsUnavailable(root, message, kind = 'empty', league = null){
    const table=root?.querySelector('.basketball-standings-table');
    const body=table?.querySelector('tbody');
    const status=root?.querySelector('.basketball-standings-status');
    if(!table||!body||!status) return;
    body.innerHTML=basketballStandingsEmptyRow(message,kind);
    table.setAttribute('aria-busy','false');
    status.textContent=message;
    status.setAttribute('role',kind==='error'?'alert':'status');
    body.querySelector('[data-basketball-standings-retry]')?.addEventListener('click',(event)=>{
      event.currentTarget.disabled=true;
      const region=table.closest('.basketball-standings-scroll');
      body.innerHTML=basketballStandingsSkeletonHTML();
      table.setAttribute('aria-busy','true');
      status.setAttribute('role','status');
      status.textContent='Resmî sıralama yeniden hazırlanıyor…';
      region?.focus();
      hydrateBasketballStandings(root,league,true);
    });
  }

  async function hydrateBasketballStandings(root, league, force = false){
    const scope=basketballStandingsScope(league);
    if(!root||!scope){
      renderBasketballStandingsUnavailable(root,'Lig ve sezon kimliği program verisinden bekleniyor.','empty',league);
      return;
    }
    abortBasketballStandings(scope);
    const hydrationEpoch=basketballStandingsEpoch;
    const stillCurrent=()=>hydrationEpoch===basketballStandingsEpoch
      && root.isConnected
      && root.dataset.basketballStandingsScope===scope
      && activeSport==='basketball'
      && activeView==='home';
    try{
      const payload=await loadBasketballStandings(league,force);
      if(!stillCurrent()) return;
      const table=root.querySelector('.basketball-standings-table');
      const body=table?.querySelector('tbody');
      const status=root.querySelector('.basketball-standings-status');
      if(!table||!body||!status) return;
      const rows=payload.standings.filter((row)=>row?.team?.name).slice(0,32);
      if(!rows.length){
        renderBasketballStandingsUnavailable(root,'Sağlayıcı bu lig ve sezon için doğrulanmış sıralama yayımlamadı.','empty',league);
        return;
      }
      body.innerHTML='';
      status.setAttribute('role','status');
      status.textContent=payload.stale?'Son doğrulanmış puan tablosu yükleniyor…':'Takımlar sıralamaya yerleştiriliyor…';
      const reduced=Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      if(reduced){
        body.innerHTML=rows.map(basketballStandingRowHTML).join('');
        table.setAttribute('aria-busy','false');
        status.textContent=`${rows.length} takım · ${payload.stale?'Son doğrulanmış tablo':'API-Sports resmî sıralaması'}`;
        return;
      }
      let index=0;
      const appendNext=()=>{
        if(!stillCurrent()) return;
        body.insertAdjacentHTML('beforeend',basketballStandingRowHTML(rows[index]));
        index+=1;
        if(index<rows.length){ setTimeout(appendNext,55); return; }
        table.setAttribute('aria-busy','false');
        status.textContent=`${rows.length} takım · ${payload.stale?'Son doğrulanmış tablo':'API-Sports resmî sıralaması'}`;
      };
      appendNext();
    }catch(error){
      if(error?.name==='AbortError'||!stillCurrent()) return;
      const message=error?.status===429
        ? 'Puan tablosu sağlayıcı kotası nedeniyle kısa süreliğine bekliyor.'
        : 'Puan tablosu şu anda sağlayıcıdan alınamadı; günlük fikstür gösterilmeye devam ediyor.';
      renderBasketballStandingsUnavailable(root,message,'error',league);
    }
  }

  const volleyballStatusText = (item) => String(item?.status || '').trim().toLowerCase();
  const volleyballIsLive = (item) => {
    const status=volleyballStatusText(item);
    if(!status || /\bnot started\b|\bscheduled\b|\bpostponed\b|\bcancell?ed\b|\bfinished\b|\bended\b/.test(status)) return false;
    return /\blive\b|\bin progress\b|\bin play\b|\bset\s*[1-5]\b|\b(?:1st|2nd|3rd|4th|5th) set\b|\bperiod\s*\d+\b|\bbreak time\b|\bhalf(?: |-)?time\b/.test(status);
  };
  const volleyballIsFinished = (item) => /\bfinished\b|\bended\b|\bafter\b|^(?:ft|aet)$/i.test(volleyballStatusText(item));

  function volleyballLeagueDescriptors(items){
    const leagues=new Map();
    items.forEach((item)=>{
      const name=item?.league||item?.category;
      if(!name) return;
      const id=item?.leagueId??item?.league_id??item?.league?.id??'';
      const season=item?.season!=null?String(item.season):'';
      const country=item?.country||'';
      const identity=id!==''?`id:${id}:${season}`:`name:${name}:${country}:${season}`;
      if(!leagues.has(identity)) leagues.set(identity,{
        identity,
        key:name,
        name,
        id:id!==''?String(id):'',
        logo:item?.leagueLogo||'',
        country,
        season,
        events:[],
      });
      const league=leagues.get(identity);
      if(!league.logo&&item?.leagueLogo) league.logo=item.leagueLogo;
      if(!league.country&&item?.country) league.country=item.country;
      if(!league.season&&item?.season!=null) league.season=String(item.season);
      league.events.push(item);
    });
    const list=[...leagues.values()];
    const nameCounts=new Map();
    list.forEach((league)=>nameCounts.set(league.name,(nameCounts.get(league.name)||0)+1));
    list.forEach((league)=>{
      if((nameCounts.get(league.name)||0)>1) league.key=`scope:${league.identity}`;
    });
    return list;
  }

  function volleyballSortEvents(items){
    return [...items].sort((first,second)=>{
      const phase=(item)=>volleyballIsLive(item)?0:volleyballIsFinished(item)?2:1;
      const phaseDiff=phase(first)-phase(second);
      if(phaseDiff) return phaseDiff;
      const timeDiff=basketballEventTime(first)-basketballEventTime(second);
      return volleyballIsFinished(first)?-timeDiff:timeDiff;
    });
  }

  function volleyballStatusLabel(item){
    const status=volleyballStatusText(item);
    if(volleyballIsLive(item)) return 'CANLI';
    if(volleyballIsFinished(item)) return 'BİTTİ';
    if(/postponed/.test(status)) return 'ERTELENDİ';
    if(/cancell?ed/.test(status)) return 'İPTAL';
    return item?.time||'YAKLAŞAN';
  }

  function volleyballVerifiedEmptyHTML(payload, scopeLabel){
    const updated=lastUpdatedLabel(payload);
    return `<div class="volleyball-verified-empty" role="status">
      <small>DOĞRULANMIŞ BOŞ SONUÇ</small>
      <h4>Seçili kapsamda güncel maç programı yok.</h4>
      <p>API-Sports bu lig ve tarih için karşılaşma yayımlamadı. Yeni veri geldiğinde bu alan otomatik dolar.</p>
      <span>${escapeHTML([scopeLabel?`Kapsam: ${scopeLabel}`:'',updated?`Son güncelleme: ${updated}`:'Güncelleme saati sağlayıcıdan bekleniyor'].filter(Boolean).join(' · '))}</span>
    </div>`;
  }

  function volleyballScheduleHTML(items, payload, scopeLabel){
    const rows=volleyballSortEvents(items).slice(0,10);
    if(!rows.length) return volleyballVerifiedEmptyHTML(payload,scopeLabel);
    return `<div class="volleyball-fixture-list" role="list">${rows.map((item)=>{
      const first=item.first||item.home||{},second=item.second||item.away||{};
      const live=volleyballIsLive(item),finished=volleyballIsFinished(item);
      return `<article class="volleyball-fixture-row ${live?'is-live':finished?'is-finished':'is-upcoming'}" role="listitem">
        <span class="volleyball-fixture-state">${escapeHTML(volleyballStatusLabel(item))}</span>
        <span class="volleyball-fixture-team home"><strong>${escapeHTML(first.name||'TBA')}</strong>${visual(first.name,imageOf(first),'')}</span>
        <b>${escapeHTML(scoreText(item.score))}</b>
        <span class="volleyball-fixture-team away">${visual(second.name,imageOf(second),'')}<strong>${escapeHTML(second.name||'TBA')}</strong></span>
        ${item?.venue?`<small class="volleyball-fixture-venue">${escapeHTML(item.venue)}</small>`:''}
      </article>`;
    }).join('')}</div>`;
  }

  function volleyballTeamPoolHTML(items, payload, scopeLabel){
    const teams=new Map();
    items.forEach((item)=>[item.first||item.home,item.second||item.away].forEach((team)=>{
      if(!team?.name) return;
      const current=teams.get(team.name)||{team,count:0};
      current.count+=1;
      if(!imageOf(current.team)&&imageOf(team)) current.team=team;
      teams.set(team.name,current);
    }));
    if(!teams.size) return volleyballVerifiedEmptyHTML(payload,scopeLabel);
    return `<ul class="volleyball-team-pool">${[...teams.values()].slice(0,16).map(({team,count})=>`<li>
      ${visual(team.name,imageOf(team),'')}
      <span><strong>${escapeHTML(team.name)}</strong><small>${count} doğrulanmış maç kapsamı</small></span>
    </li>`).join('')}</ul>`;
  }

  function volleyballFeaturedHTML(item){
    if(!item) return '<div class="volleyball-feature-empty">Günün vitrini için doğrulanmış karşılaşma bekleniyor.</div>';
    const first=item.first||item.home||{},second=item.second||item.away||{};
    return `<div class="volleyball-feature-match">
      <figure>${visual(first.name,imageOf(first),'')}<figcaption>${escapeHTML(first.name||'TBA')}</figcaption></figure>
      <div><small>${escapeHTML(volleyballStatusLabel(item))}</small><strong>${escapeHTML(scoreText(item.score))}</strong><span>${escapeHTML(item.time||item.feedDate||item.date||'')}</span></div>
      <figure>${visual(second.name,imageOf(second),'')}<figcaption>${escapeHTML(second.name||'TBA')}</figcaption></figure>
    </div>`;
  }

  function volleyballPortalHTML(items, league, payload){
    const sorted=volleyballSortEvents(items);
    const featured=sorted[0]||null;
    const teams=new Map();
    items.forEach((item)=>[item.first||item.home,item.second||item.away].forEach((team)=>{if(team?.name&&!teams.has(team.name))teams.set(team.name,team);}));
    const live=items.filter(volleyballIsLive).length;
    const finished=items.filter(volleyballIsFinished).length;
    const scopeLabel=league?.name||'Tüm ligler';
    const updated=lastUpdatedLabel(payload);
    const identityMeta=[league?.country,league?.season||'Güncel günlük program'].filter(Boolean).join(' · ');
    return `<section class="volleyball-league-center" data-volleyball-league-center data-volleyball-scope="${escapeHTML(scopeLabel)}">
      <header class="volleyball-league-identity">
        <span class="volleyball-league-logo">${league?.logo?visual(league.name,league.logo,''):'<b aria-hidden="true">V</b>'}</span>
        <div><small>XYZSKOR · VOLEYBOL LİG MERKEZİ</small><h2>${escapeHTML(league?.name||'Voleybol')}</h2><p>${escapeHTML(identityMeta)}</p></div>
        <span class="volleyball-data-state">${payload?.degraded||payload?.stale?'SON DOĞRULANMIŞ VERİ':'GÜNLÜK CANLI PROGRAM'}</span>
      </header>
      <div class="volleyball-overview-layout">
        <section class="volleyball-overview-panel volleyball-program-panel" aria-labelledby="volleyballProgramTitle">
          <header><div><small>MAÇ AKIŞI</small><h3 id="volleyballProgramTitle">Sonuçlar ve fikstür</h3></div><span>${items.length} maç</span></header>
          <div class="volleyball-program-scroll" tabindex="0" role="region" aria-labelledby="volleyballProgramTitle">${volleyballScheduleHTML(items,payload,scopeLabel)}</div>
        </section>
        <aside class="volleyball-overview-panel volleyball-teams-panel" aria-labelledby="volleyballTeamsTitle">
          <header><div><small>GÜNLÜK KAPSAM</small><h3 id="volleyballTeamsTitle">Programdaki takımlar</h3></div><span>${teams.size} takım</span></header>
          <div class="volleyball-teams-body">${volleyballTeamPoolHTML(items,payload,scopeLabel)}</div>
        </aside>
      </div>
      <section class="volleyball-overview-metrics" aria-label="Seçili lig özeti">
        <article><span>GÜNLÜK PROGRAM</span><b>${items.length}</b><small>doğrulanmış maç</small></article>
        <article><span>CANLI</span><b class="is-live">${live}</b><small>devam eden</small></article>
        <article><span>TAMAMLANAN</span><b>${finished}</b><small>sonuçlanan</small></article>
        <article><span>TAKIM</span><b>${teams.size}</b><small>günlük kapsam</small></article>
      </section>
      <section class="volleyball-lower">
        <article class="volleyball-feature">
          <header><div><small>GÜNÜN VİTRİNİ</small><h3>${escapeHTML(featured?.league||league?.name||'Voleybol')}</h3></div></header>
          ${volleyballFeaturedHTML(featured)}
        </article>
        <article class="volleyball-source-note">
          <small>VERİ KAPSAMI</small><h3>Doğrulanmış günlük kapsam</h3>
          <p>Bu görünüm puan tablosu üretmez; program, sonuç ve takım kapsamı yalnız API-Sports günlük karşılaşmalarından oluşur.</p>
          <span>${escapeHTML(updated?'Son güncelleme: '+updated:'Güncelleme zamanı sağlayıcıdan bekleniyor')}</span>
        </article>
      </section>
    </section>`;
  }

  function volleyballLoadingHTML(){
    const fixtureSkeleton=Array.from({length:7},(_,index)=>`<i style="--volleyball-skeleton-index:${index}"></i>`).join('');
    const teamSkeleton=Array.from({length:8},(_,index)=>`<i style="--volleyball-skeleton-index:${index}"></i>`).join('');
    return `<section class="volleyball-league-center volleyball-loading-shell" aria-busy="true">
      <header class="volleyball-league-identity"><span class="volleyball-league-logo"><b aria-hidden="true">V</b></span><div><small>XYZSKOR · VOLEYBOL LİG MERKEZİ</small><h2>Lig merkezi hazırlanıyor</h2><p>Günlük program ve takım kapsamı</p></div></header>
      <div class="volleyball-overview-layout">
        <section class="volleyball-overview-panel volleyball-program-panel"><header><div><small>MAÇ AKIŞI</small><h3>Sonuçlar ve fikstür</h3></div></header><div class="volleyball-fixture-skeleton">${fixtureSkeleton}</div></section>
        <aside class="volleyball-overview-panel volleyball-teams-panel"><header><div><small>GÜNLÜK KAPSAM</small><h3>Programdaki takımlar</h3></div></header><div class="volleyball-team-skeleton">${teamSkeleton}</div></aside>
      </div>
      <p class="volleyball-loading-label" role="status">Voleybol merkezi hazırlanıyor</p>
    </section>`;
  }

  function volleyballErrorHTML(){
    return `<section class="volleyball-league-center">
      <header class="volleyball-league-identity"><span class="volleyball-league-logo"><b aria-hidden="true">V</b></span><div><small>XYZSKOR · VOLEYBOL LİG MERKEZİ</small><h2>Voleybol</h2><p>Veri bağlantısı yeniden kurulacak</p></div></header>
      <div class="volleyball-error-state" role="alert"><small>SAĞLAYICI DURUMU</small><h3>Voleybol verisi şu anda alınamadı.</h3><p>Bu doğrulanmış boş sonuç değil. Bağlantı düzeldiğinde günlük program ve takım kapsamı yeniden yüklenecek.</p><button type="button" data-volleyball-hub-retry>Yeniden dene</button></div>
    </section>`;
  }

  function render(payload){
    const hub = document.getElementById('multiSportHub');
    const grid = document.getElementById('multiSportGrid');
    if(!hub || !grid) return;
    grid.setAttribute('aria-busy','false');
    const sports = payload?.sports || {};
    // Never replace the requested branch with another sport's feed.
    // An empty branch must render its own honest empty state.
    document.querySelectorAll('[data-multi-sport]').forEach((button) => {
      const key = button.dataset.multiSport;
      button.hidden = false;
      button.classList.toggle('active', key === activeSport);
    });
    const branchItems = Array.isArray(sports[activeSport]) ? sports[activeSport] : [];
    const allItems = branchItems.filter((item) => item && (!item.sport || item.sport === activeSport));
    updateBranchTicker(allItems);
    hub.dataset.sport = activeSport;
    grid.dataset.sport = activeSport;
    updateBranchIdentity(activeSport, payload?.degraded||payload?.stale
      ? 'Son doğrulanmış program · API-Sports'
      : `${payload?.date || ''} programı · API-Sports verisi`);
    const viewNav = document.getElementById('multiSportViews');
    const views = activeSport === 'basketball' ? [['home','Genel'],['games','Ma&#231;lar'],['leagues','Ligler'],['teams','Tak&#305;mlar'],['predict','Predict']] : activeSport === 'mma' ? [['home','Genel'],['games','Son ma&#231;lar'],['leagues','Organizasyonlar'],['teams','Dovusculer'],['predict','Predict']] : [['home','Genel'],['games','Ma&#231;lar'],['leagues','Ligler'],['teams','Tak&#305;mlar'],['predict','Predict']];
    viewNav.innerHTML = views.map(([key,label]) => `<button type="button" data-multi-view="${key}" class="${key===activeView?'active':''}" ${key===activeView?'aria-current="page"':''}>${label}</button>`).join('');
    viewNav.querySelectorAll('[data-multi-view]').forEach((button) => button.addEventListener('click', () => {
      pendingViewFocus=button.dataset.multiView;
      openHub(activeSport,button.dataset.multiView,true);
    }));
    if(pendingViewFocus===activeView){
      const focusTarget=viewNav.querySelector(`[data-multi-view="${activeView}"]`);
      pendingViewFocus='';
      requestAnimationFrame(()=>focusTarget?.focus());
    }
    let leagueStrip = document.getElementById('multiLeagueStrip');
    if(!leagueStrip){
      leagueStrip = document.createElement('nav');
      leagueStrip.id = 'multiLeagueStrip';
      leagueStrip.className = 'multi-league-strip';
      viewNav.after(leagueStrip);
    }
    const basketballLeagues=activeSport==='basketball'?basketballLeagueDescriptors(allItems):[];
    const volleyballLeagues=activeSport==='volleyball'?volleyballLeagueDescriptors(allItems):[];
    const leagueNames = [...new Set([...(SPORT_LEAGUE_CATALOG[activeSport]||[]),...allItems.map(item => item.league || item.category).filter(Boolean)])];
    if(activeSport==='basketball'&&activeLeague!=='all'&&!basketballLeagues.some((league)=>league.key===activeLeague)){
      activeLeague=activeView==='home'&&basketballLeagues.length?basketballLeagues[0].key:'all';
    }
    if(activeSport==='basketball'&&activeView==='home'&&activeLeague==='all'&&basketballLeagues.length){
      activeLeague=basketballLeagues[0].key;
    }
    if(activeSport==='volleyball'&&activeLeague!=='all'&&!volleyballLeagues.some((league)=>league.key===activeLeague)&&!leagueNames.includes(activeLeague)){
      activeLeague=activeView==='home'&&volleyballLeagues.length?volleyballLeagues[0].key:'all';
    }
    if(activeSport==='volleyball'&&activeView==='home'&&activeLeague==='all'&&volleyballLeagues.length){
      activeLeague=volleyballLeagues[0].key;
    }
    if((activeSport==='basketball'||activeSport==='volleyball')&&activeView==='home') viewNav.before(leagueStrip);
    else viewNav.after(leagueStrip);
    const basketballChoices=basketballLeagues.slice(0,14).map((league)=>{
      const duplicate=basketballLeagues.some((candidate)=>candidate!==league&&candidate.name===league.name);
      const qualifier=league.country||league.season||league.id;
      return [league.key,duplicate&&qualifier?`${league.name} · ${qualifier}`:league.name,[league.name,league.country,league.season].filter(Boolean).join(', ')];
    });
    const volleyballChoices=volleyballLeagues.slice(0,14).map((league)=>{
      const duplicate=volleyballLeagues.some((candidate)=>candidate!==league&&candidate.name===league.name);
      const qualifier=league.country||league.season||league.id;
      return [league.key,duplicate&&qualifier?`${league.name} · ${qualifier}`:league.name,[league.name,league.country,league.season].filter(Boolean).join(', ')];
    });
    for(const name of (SPORT_LEAGUE_CATALOG.volleyball||[])){
      if(!volleyballLeagues.some((league)=>league.name===name)) volleyballChoices.push([name,name,name]);
    }
    const leagueChoices=activeSport==='basketball'
      ? (activeView==='home'?basketballChoices:[['all','Tümü','Tüm ligler'],...basketballChoices])
      : activeSport==='volleyball'
        ? (activeView==='home'?volleyballChoices:[['all','Tümü','Tüm ligler'],...volleyballChoices])
        : [['all','Tümü','Tüm ligler'],...leagueNames.slice(0,14).map((name)=>[name,name,name])];
    leagueStrip.hidden = !leagueChoices.length;
    leagueStrip.innerHTML = leagueChoices.map(([key,label,accessibleLabel])=>`<button type="button" data-league="${escapeHTML(key)}" class="${key===activeLeague?'active':''}" aria-label="${escapeHTML(accessibleLabel)}" aria-pressed="${key===activeLeague?'true':'false'}">${escapeHTML(label)}</button>`).join('');
    leagueStrip.querySelectorAll('[data-league]').forEach(button=>button.addEventListener('click',()=>{
      activeLeague=button.dataset.league;
      render(payload);
      requestAnimationFrame(()=>[...document.querySelectorAll('#multiLeagueStrip [data-league]')]
        .find((candidate)=>candidate.dataset.league===activeLeague)?.focus());
    }));
    const selectedBasketballLeague=activeSport==='basketball'?basketballLeagues.find((item)=>item.key===activeLeague)||null:null;
    const selectedVolleyballLeague=activeSport==='volleyball'
      ? volleyballLeagues.find((item)=>item.key===activeLeague)||(activeLeague!=='all'?{key:activeLeague,name:activeLeague,logo:'',country:'',season:'',events:[]}:null)
      : null;
    const items = activeLeague === 'all'
      ? allItems
      : selectedBasketballLeague
        ? selectedBasketballLeague.events
        : selectedVolleyballLeague
          ? selectedVolleyballLeague.events
          : allItems.filter(item => (item.league || item.category) === activeLeague);
    if(activeSport === 'basketball' && activeView === 'home'){
      const league=selectedBasketballLeague||basketballLeagues[0]||null;
      grid.innerHTML = basketballLeaguePortalHTML(items,league,payload);
      if(pendingBasketballHubFocus){
        const heading=grid.querySelector('.basketball-league-identity h2');
        if(heading){ heading.tabIndex=-1; requestAnimationFrame(()=>heading.focus()); }
        pendingBasketballHubFocus=false;
      }
      hydrateBasketballStandings(grid.querySelector('[data-basketball-league-center]'),league);
      return;
    }
    if(activeSport === 'volleyball' && activeView === 'home'){
      grid.innerHTML=volleyballPortalHTML(items,selectedVolleyballLeague,payload);
      if(pendingVolleyballHubFocus){
        const heading=grid.querySelector('.volleyball-league-identity h2');
        if(heading){heading.tabIndex=-1;requestAnimationFrame(()=>heading.focus());}
        pendingVolleyballHubFocus=false;
      }
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
      }).join('') : compactEmptyHTML('Doğrulanmış lig programı bulunmuyor.','Sağlayıcı bugün için bu branşta organizasyon programı döndürmedi.',payload,activeLeague==='all'?'Tüm ligler':activeLeague);
      return;
    }    if(activeView === 'teams'){
      const unique = new Map();
      items.forEach((item) => [item.first,item.second].forEach((team) => { if(team?.name) unique.set(team.name,team); }));
      grid.innerHTML = unique.size ? [...unique.values()].map(teamCardHTML).join('') : compactEmptyHTML('Doğrulanmış takım kaydı bulunmuyor.','Günlük programda takım eşleşmesi yayınlandığında liste otomatik dolar.',payload,activeLeague==='all'?'Tüm ligler':activeLeague);
      return;
    }
    if(activeView === 'predict'){
      grid.innerHTML = items.length ? items.slice(0,10).map(predictCardHTML).join('') : compactEmptyHTML('Bugün tahmine açık etkinlik yok.','Bu doğrulanmış boş bir sonuçtur; yeni program geldiğinde tahmin kartları açılır.',payload,activeLeague==='all'?'Tüm ligler':activeLeague);
      grid.querySelectorAll('[data-predict-key] button').forEach((button) => button.addEventListener('click', () => {
        const card = button.closest('[data-predict-key]');
        try{ localStorage.setItem(card.dataset.predictKey, button.dataset.pick); }catch(_error){}
        card.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
      }));
      return;
    }
    grid.innerHTML = items.length ? items.slice(0, activeView === 'games' ? 24 : 12).map(cardHTML).join('') : compactEmptyHTML('Doğrulanmış karşılaşma bulunmuyor.','Lisanslı sağlayıcı bu kapsam için boş sonuç döndürdü; yeni veri geldiğinde liste otomatik güncellenir.',payload,activeLeague==='all'?'Tüm ligler':activeLeague);
  }

  async function load(sport){
    const requestedSport=sport || activeSport;
    const cached=sharedPayloads.get(requestedSport);
    const receivedAt=payloadReceivedAt.get(requestedSport)||0;
    let today='';
    try{ today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }catch(_error){}
    if(cached&&Date.now()-receivedAt<MULTISPORT_PAYLOAD_TTL_MS&&(!today||cached.date===today)){
      if(typeof CustomEvent!=='undefined') window.dispatchEvent(new CustomEvent('xyz:multisport-payload',{detail:{sport:requestedSport,payload:cached}}));
      return cached;
    }
    if(cached){ sharedPayloads.delete(requestedSport); payloadReceivedAt.delete(requestedSport); }
    if(!feedPromises.has(requestedSport)){
      const controller=typeof AbortController!=='undefined'?new AbortController():null;
      if(controller) feedControllers.set(requestedSport,controller);
      const request = fetch(`/api/sports/today?sport=${encodeURIComponent(requestedSport)}&client=v11`, { cache:'no-store', headers:{ Accept:'application/json', 'Cache-Control':'no-cache' }, signal:controller?.signal })
        .then(async (response) => {
          const payload = await response.json().catch(() => ({}));
          if(!response.ok){
            const error=new Error(payload.error || 'sports_unavailable');
            error.status=response.status;
            throw error;
          }
          const branchKeys=Object.keys(payload?.sports||{});
          if(branchKeys.length!==1 || branchKeys[0]!==requestedSport) throw new Error('sports_branch_mismatch');
          payload.sports[requestedSport]=(Array.isArray(payload.sports[requestedSport])?payload.sports[requestedSport]:[])
            .filter((item)=>!item?.sport || item.sport===requestedSport);
          payload.stale=response.headers.get('x-data-stale')==='true'||Boolean(payload.stale);
          sharedPayloads.set(requestedSport,payload);
          payloadReceivedAt.set(requestedSport,Date.now());
          if(typeof CustomEvent!=='undefined') window.dispatchEvent(new CustomEvent('xyz:multisport-payload',{detail:{sport:requestedSport,payload}}));
          return payload;
        }).finally(()=>{
          if(feedPromises.get(requestedSport)===request) feedPromises.delete(requestedSport);
          if(feedControllers.get(requestedSport)===controller) feedControllers.delete(requestedSport);
        });
      feedPromises.set(requestedSport,request);
    }
    return feedPromises.get(requestedSport);
  }

  async function openHub(sport, view = 'home', updateUrl = true){
    if(sport === 'mma'){
      location.assign('/ufc/');
      return;
    }
    if(sport && sport !== activeSport) activeLeague = 'all';
    activeSport = sport || activeSport;
    activeView = view;
    const requestedSport = activeSport;
    const requestedView = activeView;
    if(requestedSport!=='basketball') pendingBasketballHubFocus=false;
    if(requestedSport!=='volleyball') pendingVolleyballHubFocus=false;
    const requestEpoch = ++hubRequestEpoch;
    if(requestedSport!=='basketball'||requestedView!=='home') abortBasketballStandings();
    feedControllers.forEach((controller,scope)=>{
      if(scope===requestedSport) return;
      controller.abort();
      feedControllers.delete(scope);
      feedPromises.delete(scope);
    });
    if(updateUrl && location.pathname !== hubPath(activeSport,activeView)) history.pushState({multisport:true},'',hubPath(activeSport,activeView));
    if(window.XYZBranchRouter?.syncMetadata) window.XYZBranchRouter.syncMetadata(location.pathname,location.search);
    document.body.classList.add('multisport-open');
    updateBranchTicker([]);
    const hub = document.getElementById('multiSportHub');
    const grid = document.getElementById('multiSportGrid');
    if(!hub || !grid) return;
    hub.hidden = false;
    if(hub.dataset) hub.dataset.sport = requestedSport;
    if(grid.dataset) grid.dataset.sport = requestedSport;
    updateBranchIdentity(requestedSport, 'Günün programı hazırlanıyor');
    const cachedPayload=sharedPayloads.get(requestedSport);
    const cachedAt=payloadReceivedAt.get(requestedSport)||0;
    const warm=Boolean(cachedPayload&&Date.now()-cachedAt<MULTISPORT_PAYLOAD_TTL_MS);
    grid.setAttribute('aria-busy','true');
    if(!warm) grid.innerHTML = requestedSport==='basketball'&&requestedView==='home'
      ? basketballLoadingHTML()
      : requestedSport==='volleyball'&&requestedView==='home'
        ? volleyballLoadingHTML()
        : '<div class="multi-event-loading"><i></i><i></i><i></i><span>Canlı program hazırlanıyor</span></div>';
    document.querySelectorAll('.multisport-nav-button').forEach((button) => button.classList.toggle('active', button.dataset.multiSport === activeSport));
    try{
      const payload = await load(requestedSport);
      if(requestEpoch !== hubRequestEpoch || activeSport !== requestedSport || activeView !== requestedView) return;
      render(payload);
    }
    catch(_error){
      if(requestEpoch !== hubRequestEpoch || activeSport !== requestedSport || activeView !== requestedView) return;
      const branchLabel = SPORT_LABELS[requestedSport] || 'Spor';
      updateBranchIdentity(requestedSport, 'Veri bağlantısı yeniden denenecek');
      grid.setAttribute('aria-busy','false');
      if(requestedSport==='basketball'&&requestedView==='home'){
        grid.innerHTML=basketballErrorHTML();
        grid.querySelector('[data-basketball-hub-retry]')?.addEventListener('click',()=>{
          pendingBasketballHubFocus=true;
          sharedPayloads.delete(requestedSport);
          payloadReceivedAt.delete(requestedSport);
          openHub(requestedSport,requestedView,false);
        });
        if(pendingBasketballHubFocus){
          requestAnimationFrame(()=>grid.querySelector('[data-basketball-hub-retry]')?.focus());
          pendingBasketballHubFocus=false;
        }
      }else if(requestedSport==='volleyball'&&requestedView==='home'){
        grid.innerHTML=volleyballErrorHTML();
        grid.querySelector('[data-volleyball-hub-retry]')?.addEventListener('click',()=>{
          pendingVolleyballHubFocus=true;
          sharedPayloads.delete(requestedSport);
          payloadReceivedAt.delete(requestedSport);
          openHub(requestedSport,requestedView,false);
        });
        if(pendingVolleyballHubFocus){
          requestAnimationFrame(()=>grid.querySelector('[data-volleyball-hub-retry]')?.focus());
          pendingVolleyballHubFocus=false;
        }
      }else{
        grid.innerHTML = compactEmptyHTML(`${branchLabel} verisi şu anda alınamadı.`,'Bu bir sağlayıcı hatasıdır, doğrulanmış boş sonuç değildir. Bağlantı düzeldiğinde program otomatik yenilenir.',null,branchLabel);
      }
    }
    window.scrollTo({top:0,behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }

  window.openMultiSportHub = openHub;

  function init(){
    const primary = document.querySelector('.primary-nav');
    const wrap = document.querySelector('.wrap');
    if(!primary || !wrap || document.getElementById('multiSportHub')) return;
    const buttons = [
      ['basketball','Basketbol'],
      ['mma','UFC'],
      ['volleyball','Voleybol']
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
    hub.innerHTML = `<header class="multisport-hero"><div><span>XYZSKOR MULTISPORT</span><h1 id="multiSportTitle">${escapeHTML(SPORT_LABELS[routeState()?.sport || activeSport] || 'Spor')}</h1><p id="multiSportNote">Günün programı hazırlanıyor</p></div><b>CANLI VERİ</b></header>
      <nav class="multisport-switcher" aria-label="Spor branşı seçimi">${Object.entries(SPORT_LABELS).map(([key,label]) => `<button type="button" data-multi-sport="${key}">${label}</button>`).join('')}</nav>
      <nav class="multisport-view-nav" id="multiSportViews" aria-label="Branş bölümleri"></nav>
      <section class="multi-event-grid" id="multiSportGrid" aria-label="Branş içeriği"></section>`;
    wrap.parentNode.insertBefore(hub, wrap);
    pruneFootballSurface();
    hub.querySelectorAll('[data-multi-sport]').forEach((button) => button.addEventListener('click', () => openHub(button.dataset.multiSport,'home',true)));
    const bindProductRoute = (id, url, label) => {
      document.getElementById(id)?.addEventListener('click', (event) => {
        // Bu capture handler yalnız aktif Basketbol/Voleybol yüzeyinin ürün
        // geçişini sahiplenir. Inline legacy handler'a da izin verilirse önce
        // Futbol, hemen ardından `/predict` çalışıp iki navigasyon yarışır.
        if(!routeState() && !document.body.classList.contains('multisport-open')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if(window.XYZBranchRouter) window.XYZBranchRouter.navigate(url,{label});
        else location.assign(url);
      }, true);
    };
    bindProductRoute('tabBtnFootball','/','Futbol');
    bindProductRoute('tabBtnPredict','/predict/','Predict');
    const initial = routeState();
    if(initial) openHub(initial.sport,initial.view,false);
    window.addEventListener('popstate', () => { const state=routeState(); if(state) openHub(state.sport,state.view,false); else closeHub(); });

    // Route-aware router entegrasyonu: basketbol ve voleybol yüzeyleri belge
    // yenilenmeden mount/unmount edilebilir. Router geçişte önce abort hook'u
    // çağırır, böylece eski branşın isteği yeni branşın üstüne veri yazamaz.
    if(window.XYZBranchRouter){
      window.XYZBranchRouter.registerAbortHook(() => {
        hubRequestEpoch += 1;
        pendingViewFocus='';
        pendingBasketballHubFocus=false;
        pendingVolleyballHubFocus=false;
        feedControllers.forEach((controller,scope)=>{ controller.abort(); feedPromises.delete(scope); });
        feedControllers.clear();
        abortBasketballStandings();
      });
      window.XYZBranchRouter.register({
        key:'multisport',
        matches:(pathname)=>{
          const segment = String(pathname||'').split('/').filter(Boolean)[0];
          return segment === 'basketbol' || segment === 'voleybol';
        },
        mount:(context)=>{
          const parts = String(context?.pathname||location.pathname).split('/').filter(Boolean);
          const sport = ({basketbol:'basketball',voleybol:'volleyball'})[parts[0]];
          const view = ({maclar:'games',ligler:'leagues',takimlar:'teams',predict:'predict'})[parts[1]] || 'home';
          if(sport) openHub(sport,view,false);
        },
        unmount:()=>{
          hubRequestEpoch += 1;
          pendingViewFocus='';
          pendingBasketballHubFocus=false;
          pendingVolleyballHubFocus=false;
          feedControllers.forEach((controller,scope)=>{ controller.abort(); feedPromises.delete(scope); });
          feedControllers.clear();
          abortBasketballStandings();
          document.body.classList.remove('multisport-open');
          const hub = document.getElementById('multiSportHub');
          if(hub) hub.hidden = true;
          document.querySelectorAll('.multisport-nav-button').forEach((button) => button.classList.remove('active'));
          restoreFootballSurface();
        }
      });
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
