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
  const branchAutoRetryTimers = new Map();
  const branchAutoRetryUsed = new Set();
  const branchRetryCooldowns = new Map();
  const trustedBranchPayloads = new WeakSet();
  let activeSport = 'basketball';
  let activeView = 'home';
  let activeLeague = 'all';
  let activeLeagueRoute = '';
  let hubRequestEpoch = 0;
  let basketballStandingsEpoch = 0;
  let pendingViewFocus = '';
  let pendingLeagueFocus = '';
  let pendingBasketballHubFocus = false;
  let pendingVolleyballHubFocus = false;
  let observedMultisportDate = '';
  const MULTISPORT_PAYLOAD_TTL_MS = 15 * 60 * 1000;
  const BASKETBALL_STANDINGS_TTL_MS = 30 * 60 * 1000;
  const LAST_VERIFIED_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  const LAST_VERIFIED_BRANCH_MAX_BYTES = 128 * 1024;
  const LAST_VERIFIED_STANDINGS_MAX_BYTES = 64 * 1024;
  const LAST_VERIFIED_STANDINGS_MAX_SCOPES = 12;
  const LAST_VERIFIED_BRANCH_PREFIX = 'xyzskor:last-verified:multisport:v1:';
  const LAST_VERIFIED_STANDINGS_PREFIX = 'xyzskor:last-verified:basketball-standings:v1:';
  const LAST_VERIFIED_STANDINGS_INDEX = `${LAST_VERIFIED_STANDINGS_PREFIX}index`;
  const AUTO_RETRY_DEFAULT_SECONDS = 30;
  const SPORT_LEAGUE_CATALOG = {
    volleyball: ['Sultanlar Ligi', 'Efeler Ligi', 'CEV Şampiyonlar Ligi', 'Voleybol Milletler Ligi']
  };

  const escapeHTML = (value) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const boundedText = (value, max = 240) => value == null ? '' : String(value).slice(0, max);
  const multisportDate = (value = new Date()) => {
    try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);}
    catch(_error){return new Date(value.getTime()+3*60*60*1000).toISOString().slice(0,10);}
  };
  const storageByteLength = (value) => {
    const text=String(value||'');
    if(typeof TextEncoder!=='undefined') return new TextEncoder().encode(text).byteLength;
    let bytes=0;
    for(let index=0;index<text.length;index+=1){
      const code=text.charCodeAt(index);
      if(code<0x80) bytes+=1;
      else if(code<0x800) bytes+=2;
      else if(code>=0xd800&&code<=0xdbff&&index+1<text.length&&text.charCodeAt(index+1)>=0xdc00&&text.charCodeAt(index+1)<=0xdfff){bytes+=4;index+=1;}
      else bytes+=3;
    }
    return bytes;
  };
  const boundedNumber = (value) => {
    const number=Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const validStoredAt = (value) => {
    const savedAt=Number(value);
    return Number.isFinite(savedAt)
      && savedAt <= Date.now() + 5 * 60 * 1000
      && Date.now() - savedAt <= LAST_VERIFIED_MAX_AGE_MS;
  };
  const validPayloadDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  const retryableProviderError = (error) => error?.name !== 'AbortError'
    && (error?.networkFailure === true || error?.status === 429 || Number(error?.status) >= 500
      || (error?.status===409&&error?.code==='basketball_standings_scope_not_discovered'));
  const retryAfterSeconds = (raw) => {
    let seconds=raw==null||String(raw).trim()===''?Number.NaN:Number(raw);
    if(!Number.isFinite(seconds)){
      const timestamp=Date.parse(String(raw || ''));
      seconds=Number.isFinite(timestamp) ? Math.ceil((timestamp-Date.now())/1000) : AUTO_RETRY_DEFAULT_SECONDS;
    }
    if(!Number.isFinite(seconds)) seconds=AUTO_RETRY_DEFAULT_SECONDS;
    return Math.max(15,Math.min(120,Math.ceil(seconds)));
  };

  function safeStorageGet(key){
    try{return localStorage.getItem(key);}catch(_error){return null;}
  }

  function safeStorageRemove(key){
    try{localStorage.removeItem(key);}catch(_error){}
  }

  function safeStorageSet(key, value, maxBytes){
    if(typeof value!=='string'||storageByteLength(value)>maxBytes) return false;
    try{localStorage.setItem(key,value);return true;}catch(_error){return false;}
  }

  function trustedCachedBranchPayload(sport){
    const payload=sharedPayloads.get(sport);
    if(!payload) return null;
    if(typeof payload!=='object'||!trustedBranchPayloads.has(payload)){
      sharedPayloads.delete(sport);
      payloadReceivedAt.delete(sport);
      return null;
    }
    return payload;
  }

  function cacheTrustedBranchPayload(sport, payload){
    if(!payload||typeof payload!=='object') return false;
    trustedBranchPayloads.add(payload);
    sharedPayloads.set(sport,payload);
    payloadReceivedAt.set(sport,Date.now());
    return true;
  }

  function storedSide(side){
    if(!side||typeof side!=='object') return {name:null,logo:null,winner:null};
    return {
      name:boundedText(side.name,160)||null,
      logo:boundedText(imageOf(side),2048)||null,
      winner:typeof side.winner==='boolean'?side.winner:null,
    };
  }

  function storedBranchItem(item, sport){
    if(!item||typeof item!=='object'||item.sport!==sport||item.id==null||item.id==='') return null;
    const timestamp=boundedNumber(item.timestamp);
    const score=['string','number'].includes(typeof item.score)?boundedText(item.score,80):null;
    return {
      sport,
      provider:boundedText(item.provider,80)||null,
      id:boundedText(item.id,120),
      league:boundedText(item.league,180)||null,
      leagueLogo:boundedText(item.leagueLogo,2048)||null,
      leagueId:item.leagueId==null?null:boundedText(item.leagueId,40),
      season:item.season==null?null:boundedText(item.season,40),
      standingsProof:boundedText(item.standingsProof,512)||null,
      country:boundedText(item.country,120)||null,
      venue:boundedText(item.venue,240)||null,
      date:boundedText(item.date,80)||null,
      category:boundedText(item.category,160)||null,
      time:boundedText(item.time,40)||null,
      timestamp,
      status:boundedText(item.status,120)||null,
      score,
      first:storedSide(item.first||item.home),
      second:storedSide(item.second||item.away),
      feedDate:boundedText(item.feedDate||item.date,80)||null,
      archived:Boolean(item.archived),
    };
  }

  function branchPayloadForStorage(payload, sport){
    if(!['basketball','volleyball'].includes(sport)||!payload||typeof payload!=='object'||!validPayloadDate(payload.date)) return null;
    const branchKeys=Object.keys(payload.sports||{});
    if(branchKeys.length!==1||branchKeys[0]!==sport||!Array.isArray(payload.sports[sport])) return null;
    const items=payload.sports[sport].slice(0,60).map((item)=>storedBranchItem(item,sport));
    if(items.some((item)=>!item)) return null;
    return {
      source:boundedText(payload.source,120)||'api-sports',
      date:String(payload.date),
      updatedAt:boundedText(payload.updatedAt||payload.updated_at,80)||null,
      sports:{[sport]:items},
      coverage:{[sport]:items.length},
    };
  }

  function normalizedNetworkBranchPayload(payload, sport, serverStale, retrySeconds){
    const clean={...payload};
    delete clean.browser_last_verified;
    delete clean.lastVerifiedSavedAt;
    delete clean.reason;
    delete clean.retryAfterSeconds;
    clean.sports={
      [sport]:payload.sports[sport].slice(0,60).map((item)=>{
        const normalized={...item};
        delete normalized.browser_last_verified;
        delete normalized.lastVerifiedSavedAt;
        delete normalized.reason;
        delete normalized.retryAfterSeconds;
        normalized.archived=Boolean(serverStale||item?.archived);
        return normalized;
      }),
    };
    clean.stale=Boolean(serverStale);
    clean.degraded=Boolean(serverStale);
    clean.archived=Boolean(serverStale);
    if(serverStale) clean.retryAfterSeconds=retryAfterSeconds(retrySeconds);
    return clean;
  }

  function persistLastVerifiedBranch(payload, sport){
    if(payload?.browser_last_verified) return false;
    const storedPayload=branchPayloadForStorage(payload,sport);
    if(!storedPayload) return false;
    const serialized=JSON.stringify({version:1,sport,savedAt:Date.now(),payload:storedPayload});
    return safeStorageSet(`${LAST_VERIFIED_BRANCH_PREFIX}${sport}`,serialized,LAST_VERIFIED_BRANCH_MAX_BYTES);
  }

  function readLastVerifiedBranch(sport){
    const key=`${LAST_VERIFIED_BRANCH_PREFIX}${sport}`;
    const raw=safeStorageGet(key);
    if(!raw) return null;
    if(storageByteLength(raw)>LAST_VERIFIED_BRANCH_MAX_BYTES){safeStorageRemove(key);return null;}
    try{
      const stored=JSON.parse(raw);
      if(stored?.version!==1||stored?.sport!==sport||!validStoredAt(stored?.savedAt)) throw new Error('invalid_last_verified');
      const payload=branchPayloadForStorage(stored.payload,sport);
      if(!payload) throw new Error('invalid_last_verified_payload');
      payload.sports[sport]=payload.sports[sport].map((item)=>({...item,feedDate:item.feedDate||payload.date,archived:true}));
      return {
        ...payload,
        stale:true,
        degraded:true,
        archived:true,
        browser_last_verified:true,
        lastVerifiedSavedAt:new Date(stored.savedAt).toISOString(),
      };
    }catch(_error){
      safeStorageRemove(key);
      return null;
    }
  }

  function storedStandingRow(row){
    const position=boundedNumber(row?.position);
    const teamName=boundedText(row?.team?.name,160);
    if(!Number.isFinite(position)||!teamName) return null;
    return {
      position,
      group:boundedText(row.group,160)||null,
      team:{id:row?.team?.id==null?null:boundedText(row.team.id,80),name:teamName,logo:boundedText(imageOf(row.team),2048)||null},
      played:boundedNumber(row.played)??0,
      won:boundedNumber(row.won)??0,
      lost:boundedNumber(row.lost)??0,
      pointsFor:boundedNumber(row.pointsFor)??0,
      pointsAgainst:boundedNumber(row.pointsAgainst)??0,
      pointDifference:boundedNumber(row.pointDifference)??0,
      percentage:boundedNumber(row.percentage),
      form:boundedText(row.form,20)||null,
    };
  }

  function standingsPayloadForStorage(payload, leagueId, season){
    if(!payload||payload.sport!=='basketball'||String(payload.leagueId)!==String(leagueId)
      ||String(payload.season)!==String(season)||!Array.isArray(payload.standings)) return null;
    const standings=payload.standings.slice(0,40).map(storedStandingRow);
    if(standings.some((row)=>!row)) return null;
    return {
      source:boundedText(payload.source,120)||'api-sports-basketball',
      provider:boundedText(payload.provider,80)||'api-sports',
      sport:'basketball',
      leagueId:String(leagueId),
      season:String(season),
      updatedAt:boundedText(payload.updatedAt||payload.updated_at,80)||null,
      standings,
      coverage:{standings:standings.length,groups:new Set(standings.map((row)=>row.group).filter(Boolean)).size},
    };
  }

  function standingsStorageKey(scope){
    return `${LAST_VERIFIED_STANDINGS_PREFIX}${encodeURIComponent(scope)}`;
  }

  function updateStandingsStorageIndex(key, savedAt){
    let entries=[];
    try{
      const raw=safeStorageGet(LAST_VERIFIED_STANDINGS_INDEX)||'[]';
      if(storageByteLength(raw)>16*1024){safeStorageRemove(LAST_VERIFIED_STANDINGS_INDEX);throw new Error('standings_index_too_large');}
      const parsed=JSON.parse(raw);
      if(Array.isArray(parsed)) entries=parsed.filter((entry)=>entry&&typeof entry.key==='string'
        &&entry.key.startsWith(LAST_VERIFIED_STANDINGS_PREFIX)&&entry.key!==LAST_VERIFIED_STANDINGS_INDEX&&Number.isFinite(Number(entry.savedAt)));
    }catch(_error){}
    entries=entries.filter((entry)=>entry.key!==key);
    entries.push({key,savedAt});
    entries.sort((first,second)=>Number(second.savedAt)-Number(first.savedAt));
    const removed=entries.splice(LAST_VERIFIED_STANDINGS_MAX_SCOPES);
    removed.forEach((entry)=>safeStorageRemove(entry.key));
    safeStorageSet(LAST_VERIFIED_STANDINGS_INDEX,JSON.stringify(entries),16*1024);
  }

  function persistLastVerifiedStandings(payload, leagueId, season){
    if(payload?.browser_last_verified) return false;
    const storedPayload=standingsPayloadForStorage(payload,leagueId,season);
    if(!storedPayload) return false;
    const scope=`${leagueId}:${season}`;
    const key=standingsStorageKey(scope);
    const savedAt=Date.now();
    const stored=safeStorageSet(key,JSON.stringify({version:1,scope,savedAt,payload:storedPayload}),LAST_VERIFIED_STANDINGS_MAX_BYTES);
    if(stored) updateStandingsStorageIndex(key,savedAt);
    return stored;
  }

  function readLastVerifiedStandings(leagueId, season){
    const scope=`${leagueId}:${season}`;
    const key=standingsStorageKey(scope);
    const raw=safeStorageGet(key);
    if(!raw) return null;
    if(storageByteLength(raw)>LAST_VERIFIED_STANDINGS_MAX_BYTES){safeStorageRemove(key);return null;}
    try{
      const stored=JSON.parse(raw);
      if(stored?.version!==1||stored?.scope!==scope||!validStoredAt(stored?.savedAt)) throw new Error('invalid_standings_snapshot');
      const payload=standingsPayloadForStorage(stored.payload,leagueId,season);
      if(!payload) throw new Error('invalid_standings_payload');
      return {
        ...payload,
        stale:true,
        degraded:true,
        archived:true,
        browser_last_verified:true,
        lastVerifiedSavedAt:new Date(stored.savedAt).toISOString(),
      };
    }catch(_error){
      safeStorageRemove(key);
      return null;
    }
  }

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
  const basketballVisual = (name, src) => {
    const initials=String(name||'Takım').split(/\s+/).filter(Boolean).slice(0,2).map((part)=>part[0]).join('').toLocaleUpperCase('tr-TR');
    const image=src ? `<img src="${escapeHTML(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.nextElementSibling.hidden=false">` : '';
    return `<span class="basketball-team-mark">${image}<span class="basketball-team-monogram"${src?' hidden':''} aria-hidden="true">${escapeHTML(initials||'B')}</span></span>`;
  };
  const viewSlug = (view) => ({games:'maclar',leagues:'ligler',teams:'takimlar',predict:'predict'}[view] || '');
  const leagueSlug = (value) => String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/ı/g,'i').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'') || 'lig';

  function leagueRouteKey(league){
    if(!league) return '';
    const parts=[leagueSlug(league.name)];
    const id=String(league.id ?? '').trim();
    const season=String(league.season ?? '').trim().replace(/[^a-zA-Z0-9-]+/g,'-').replace(/^-+|-+$/g,'');
    if(id) parts.push(`id-${id.replace(/[^0-9a-zA-Z-]+/g,'-')}`);
    if(season) parts.push(`sezon-${season}`);
    return parts.join('--');
  }

  function parsedLeagueRoute(routeKey){
    const parts=String(routeKey || '').split('--').filter(Boolean);
    const slug=parts.find((part)=>!part.startsWith('id-')&&!part.startsWith('sezon-'))||'seçili-lig';
    const idPart=parts.find((part)=>part.startsWith('id-'))||'';
    const seasonPart=parts.find((part)=>part.startsWith('sezon-'))||'';
    const name=slug.split('-').filter(Boolean).map((part)=>part.charAt(0).toLocaleUpperCase('tr-TR')+part.slice(1)).join(' ');
    return {slug,id:idPart.slice(3),season:seasonPart.slice(6),name:name||'Seçili lig'};
  }

  function leagueForRoute(leagues, routeKey){
    if(!routeKey) return null;
    const exact=leagues.find((league)=>league.routeKey===routeKey);
    if(exact) return exact;
    const requested=parsedLeagueRoute(routeKey);
    if(requested.id){
      return leagues.find((league)=>String(league.id||'')===requested.id&&(!requested.season||String(league.season||'')===requested.season))||null;
    }
    return leagues.find((league)=>leagueSlug(league.name)===requested.slug)||null;
  }

  function unresolvedLeagueForRoute(routeKey){
    const requested=parsedLeagueRoute(routeKey);
    return {
      key:`route:${routeKey}`,
      routeKey,
      name:requested.name,
      id:requested.id,
      season:requested.season,
      logo:'',
      country:'',
      events:[],
      unresolved:true,
    };
  }
  const scoreText = (score) => {
    if(score == null || score === '') return 'VS';
    if(typeof score !== 'object') return String(score);
    const first = score.first ?? score.home ?? score.local ?? score.team1 ?? score.current?.home ?? score.total?.home;
    const second = score.second ?? score.away ?? score.visitor ?? score.team2 ?? score.current?.away ?? score.total?.away;
    if(first != null || second != null) return String(first ?? '-') + ' - ' + String(second ?? '-');
    return score.display ?? score.text ?? score.value ?? 'VS';
  };

  function hubPath(sport, view, routeKey = activeLeagueRoute){
    const suffix = viewSlug(view);
    const leagueSegment=routeKey?`lig/${encodeURIComponent(routeKey)}/`:'';
    return `/${sportSlug(sport)}/${leagueSegment}${suffix ? `${suffix}/` : ''}`;
  }

  function routeState(){
    const parts = location.pathname.split('/').filter(Boolean);
    const sport = ({basketbol:'basketball',voleybol:'volleyball'})[parts[0]];
    const hasLeagueRoute=parts[1]==='lig'&&Boolean(parts[2]);
    const viewPart=hasLeagueRoute?parts[3]:parts[1];
    const view = ({maclar:'games',ligler:'leagues',takimlar:'teams',predict:'predict'})[viewPart] || 'home';
    let leagueRoute='';
    if(hasLeagueRoute){
      try{leagueRoute=decodeURIComponent(parts[2]);}catch(_error){leagueRoute=parts[2];}
    }
    return sport ? {sport,view,leagueRoute} : null;
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

  function cancelBranchAutoRetries(sport = '', clearCooldown = false){
    branchAutoRetryTimers.forEach((timer,scope)=>{
      if(sport&&scope!==sport) return;
      clearTimeout(timer);
      branchAutoRetryTimers.delete(scope);
    });
    if(clearCooldown){
      if(sport) branchRetryCooldowns.delete(sport);
      else branchRetryCooldowns.clear();
    }
  }

  function activeBranchCooldown(sport){
    const cooldown=branchRetryCooldowns.get(sport);
    if(!cooldown) return null;
    if(Number(cooldown.until)>Date.now()) return cooldown;
    branchRetryCooldowns.delete(sport);
    return null;
  }

  function scheduleBranchAutoRetry(sport, seconds, error = null){
    if(!['basketball','volleyball'].includes(sport)) return false;
    const requestedDelay=retryAfterSeconds(seconds);
    let cooldown=activeBranchCooldown(sport);
    if(error&&retryableProviderError(error)&&!cooldown){
      cooldown={error,until:Date.now()+requestedDelay*1000};
      branchRetryCooldowns.set(sport,cooldown);
    }
    if(branchAutoRetryUsed.has(sport)||branchAutoRetryTimers.has(sport)) return false;
    const delayMs=cooldown?Math.max(0,cooldown.until-Date.now()):requestedDelay*1000;
    const timer=window.setTimeout(()=>{
      branchAutoRetryTimers.delete(sport);
      branchRetryCooldowns.delete(sport);
      if(activeSport!==sport||!document.body.classList.contains('multisport-open')) return;
      branchAutoRetryUsed.add(sport);
      sharedPayloads.delete(sport);
      payloadReceivedAt.delete(sport);
      openHub(sport,activeView,false,activeLeagueRoute);
    },delayMs);
    branchAutoRetryTimers.set(sport,timer);
    return true;
  }

  function refreshVisibleRollover(){
    if(document.visibilityState!=='visible') return;
    const today=multisportDate();
    const dateChanged=Boolean(observedMultisportDate&&today&&observedMultisportDate!==today);
    observedMultisportDate=today;
    if(!document.body.classList.contains('multisport-open')||!['basketball','volleyball'].includes(activeSport)) return;
    const sport=activeSport;
    const cached=trustedCachedBranchPayload(sport);
    const cachedDateChanged=Boolean(cached&&!cached.browser_last_verified&&today&&cached.date!==today);
    if(!dateChanged&&!cachedDateChanged) return;
    cancelBranchAutoRetries(sport,true);
    feedControllers.get(sport)?.abort();
    feedControllers.delete(sport);
    feedPromises.delete(sport);
    sharedPayloads.delete(sport);
    payloadReceivedAt.delete(sport);
    openHub(sport,activeView,false,activeLeagueRoute);
  }

  function closeHub(){
    hubRequestEpoch += 1;
    cancelBranchAutoRetries();
    pendingViewFocus='';
    pendingLeagueFocus='';
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

  function syncLeagueIdentityMetadata(sport, league){
    if(!league||!activeLeagueRoute) return;
    const sportLabel=SPORT_LABELS[sport]||'Spor';
    const title=`${league.name} · ${sportLabel} — XYZSKOR`;
    const description=sport==='basketball'
      ? `${league.name} basketbol ligi için doğrulanmış maç programı, sonuçlar ve sağlayıcı destekliyorsa puan durumu.`
      : `${league.name} voleybol ligi için doğrulanmış günlük maç programı, sonuçlar ve takım kapsamı.`;
    document.title=title;
    const setContent=(selector,value)=>document.querySelector(selector)?.setAttribute('content',value);
    setContent('meta[name="description"]',description);
    setContent('meta[property="og:title"]',title);
    setContent('meta[property="og:description"]',description);
    setContent('meta[name="twitter:title"]',title);
    setContent('meta[name="twitter:description"]',description);
  }

  function replaceLeagueRoute(routeKey){
    const path=hubPath(activeSport,activeView,routeKey);
    if(location.pathname!==path) history.replaceState({multisport:true,league:routeKey||'all'},'',path);
    if(window.XYZBranchRouter?.syncMetadata) window.XYZBranchRouter.syncMetadata(location.pathname,location.search);
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
    const stateLabel=item?.archived?`ARŞİV · ${item.feedDate||item.date||'SON KAYIT'}`:(item.status||'Yaklaşan');
    return `<article class="multi-event-card sport-${activeSport}${item?.archived?' is-archived':''}">
      <header><span>${item.leagueLogo ? `<img class="multi-league-logo" src="${escapeHTML(item.leagueLogo)}" alt="">` : ''}${escapeHTML(item.league || item.category || SPORT_LABELS[activeSport])}</span><time>${escapeHTML(item.feedDate || item.date || item.time || '')}</time></header>
      <div class="multi-event-side"><span>${visual(first.name, imageOf(first))}</span><strong>${escapeHTML(first.name || 'TBA')}</strong></div>
      <div class="multi-event-score"><b>${escapeHTML(score)}</b><small>${escapeHTML(stateLabel)}</small></div>
      <div class="multi-event-side away"><strong>${escapeHTML(second.name || 'TBA')}</strong><span>${visual(second.name, imageOf(second))}</span></div>
    </article>`;
  }

  function updateBranchTicker(items){
    const ticker = document.getElementById('liveTicker');
    if(!ticker || !activeSport || activeSport === 'football') return;
    const labels = {basketball:'SIRADAKI BASKETBOL MACI',volleyball:'SIRADAKI VOLEYBOL MACI',mma:'SIRADAKI UFC ETKINLIGI'};
    const archived=Boolean(items.length&&items.every((item)=>item?.archived));
    const next = archived ? items[0] : items.find((item) => !/finished|ended|after|ft/i.test(item.status || '')) || items[0];
    if(!next){ ticker.innerHTML = `<span class="ticker-dot"></span><span class="ticker-label">${labels[activeSport] || 'SIRADAKI ETKINLIK'}</span><span class="ticker-match">Program verisi bekleniyor</span>`; return; }
    const first = next.first || next.home || {};
    const second = next.second || next.away || {};
    ticker.innerHTML = `<span class="ticker-dot"></span><span class="ticker-label">${archived?'SON DOĞRULANMIŞ KAYIT':labels[activeSport] || 'SIRADAKI ETKINLIK'}</span><span class="ticker-match">${escapeHTML(first.name || 'TBA')} — ${escapeHTML(second.name || 'TBA')}</span><span class="ticker-time mono">${escapeHTML(next.feedDate || next.date || next.time || '')}</span>`;
  }

  const basketballStatusText = (item) => String(item?.status || '').trim().toLowerCase();
  const basketballIsLive = (item) => {
    if(item?.archived) return false;
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
        standingsProof:item?.standingsProof||'',
        routeKey:'',
        logo:item?.leagueLogo || '',
        country:item?.country || '',
        events:[],
      });
      const league = leagues.get(key);
      if(!league.id && item?.leagueId != null) league.id=String(item.leagueId);
      if(!league.season && item?.season != null) league.season=String(item.season);
      if(!league.standingsProof && item?.standingsProof) league.standingsProof=String(item.standingsProof);
      if(!league.logo && item?.leagueLogo) league.logo=item.leagueLogo;
      if(!league.country && item?.country) league.country=item.country;
      league.events.push(item);
    });
    const list=[...leagues.values()];
    list.forEach((league)=>{league.routeKey=leagueRouteKey(league);});
    return list;
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
    if(item?.archived) return `ARŞİV · ${item?.feedDate||item?.time||'SON KAYIT'}`;
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
      return `<article class="basketball-fixture-row ${item?.archived?'is-archived':live?'is-live':finished?'is-finished':'is-upcoming'}">
        <span class="basketball-fixture-state"><b>${escapeHTML(basketballStatusLabel(item))}</b><small>${escapeHTML(item?.league||'Basketbol')}</small></span>
        <span class="basketball-fixture-team home"><strong>${escapeHTML(first.name||'TBA')}</strong>${basketballVisual(first.name,imageOf(first))}</span>
        <b>${escapeHTML(scoreText(item.score))}</b>
        <span class="basketball-fixture-team away">${basketballVisual(second.name,imageOf(second))}<strong>${escapeHTML(second.name||'TBA')}</strong></span>
      </article>`;
    }).join('');
  }

  function basketballStandingsSkeletonHTML(){
    return Array.from({length:8},(_,index)=>`<tr class="basketball-standing-skeleton" aria-hidden="true" style="--basket-skeleton-index:${index}">
      <td><i></i></td><th scope="row"><i></i></th><td><i></i></td><td><i></i></td><td><i></i></td><td><i></i></td><td><i></i></td>
    </tr>`).join('');
  }

  function basketballStandingsScope(league){
    return !league?.unresolved&&league?.id&&league?.season ? `${league.id}:${league.season}` : '';
  }

  function basketballStandingRowHTML(row){
    const rawPercentage=Number(row?.percentage);
    const percentage=Number.isFinite(rawPercentage) ? (rawPercentage>1 ? rawPercentage : rawPercentage*100) : null;
    const difference=Number(row?.pointDifference||0);
    const team=row?.team||{};
    return `<tr class="basketball-standing-row">
      <td class="rank">${escapeHTML(row?.position||'—')}</td>
      <th scope="row"><span class="basketball-standing-team">${basketballVisual(team.name,imageOf(team))}<span><strong>${escapeHTML(team.name||'Takım')}</strong>${row?.group?`<small>${escapeHTML(row.group)}</small>`:''}</span></span></th>
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
      <figure>${basketballVisual(first.name,imageOf(first))}<figcaption>${escapeHTML(first.name||'TBA')}</figcaption></figure>
      <div><small>${escapeHTML(basketballStatusLabel(featured))}</small><strong>${escapeHTML(scoreText(featured.score))}</strong><span>${escapeHTML(featured.time||featured.feedDate||'')}</span></div>
      <figure>${basketballVisual(second.name,imageOf(second))}<figcaption>${escapeHTML(second.name||'TBA')}</figcaption></figure>
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
    const title=league?.name||(activeLeagueRoute?'Seçili basketbol ligi':'Tüm ligler');
    const coverageMissing=Boolean(league?.unresolved);
    const standingsMessage=coverageMissing
      ? 'Seçili lig bugünkü sağlayıcı kapsamında doğrulanmadığı için puan tablosu istenmedi.'
      : 'Ligleri karıştırmamak için toplu görünümde puan tablosu gösterilmez. Bir lig seçin.';
    return `<section class="basketball-league-center${league?'':' is-aggregate'}" data-basketball-league-center data-basketball-standings-scope="${escapeHTML(scope)}" data-league-route="${escapeHTML(activeLeagueRoute)}">
      <header class="basketball-league-identity">
        ${league?`<span class="basketball-league-logo">${basketballVisual(league.name,league.logo)}</span>`:''}
        <div><small>XYZSKOR · BASKETBOL LİG MERKEZİ</small><h2 data-classification-title>${escapeHTML(title)}</h2><p>${escapeHTML(coverageMissing?'Bugünkü sağlayıcı programında bu lig için doğrulanmış karşılaşma yok.':[league?.country,league?.season||(!league?`${basketballLeagueDescriptors(payload?.sports?.basketball||[]).length} lig · Günlük program`:season)].filter(Boolean).join(' · '))}</p></div>
        <span class="basketball-data-state">${coverageMissing?'DOĞRULANMIŞ BOŞ KAPSAM':payload?.degraded||payload?.stale?'SON DOĞRULANMIŞ VERİ':'GÜNLÜK CANLI PROGRAM'}</span>
      </header>
      <div class="basketball-overview-layout">
        <section class="basketball-overview-panel basketball-standings-panel" aria-labelledby="basketballStandingsTitle">
          <header><div><small>GÜNCEL SEZON</small><h3 id="basketballStandingsTitle">Puan durumu</h3></div><span>${escapeHTML(season)}</span></header>
          <div class="basketball-standings-scroll" tabindex="0" role="region" aria-labelledby="basketballStandingsTitle">
            <table class="basketball-standings-table" aria-busy="${scope?'true':'false'}">
              <caption>${escapeHTML(title)} puan durumu</caption>
              <thead><tr><th scope="col">#</th><th scope="col">TAKIM</th><th scope="col">O</th><th scope="col">G</th><th scope="col">M</th><th scope="col">%</th><th scope="col">AV</th></tr></thead>
              <tbody>${scope?basketballStandingsSkeletonHTML():basketballStandingsEmptyRow(standingsMessage,'empty')}</tbody>
            </table>
          </div>
          <footer class="basketball-standings-status" role="status" aria-live="polite">${scope?'Resmî sıralama hazırlanıyor…':standingsMessage}</footer>
        </section>
        <aside class="basketball-overview-panel basketball-fixtures-panel${league?'':' is-wide'}">
          <header><div><small>MAÇ AKIŞI</small><h3>Sonuçlar ve fikstür</h3></div><span>${items.length} maç</span></header>
          <div class="basketball-fixtures-body">${basketballScheduleHTML(items)}</div>
        </aside>
      </div>
      <section class="basketball-overview-metrics" aria-label="${league?'Seçili lig özeti':'Tüm ligler özeti'}">
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
          <small>VERİ KAPSAMI</small><h3>${league?'Şeffaf, lig bazlı görünüm':'Günlük toplu kapsam'}</h3>
          <p>${coverageMissing
            ? 'Sağlayıcı bu sınıflandırmayı bugünkü programında döndürmedi; maç, takım veya puan satırı üretilmedi.'
            : league
              ? 'Maç programı ve puan tablosu yalnız sağlayıcının seçili lig ile sezon için doğruladığı kayıtlardan oluşur.'
              : 'Günlük program doğrulanmış liglerin maçlarını birlikte gösterir. Lig puan tabloları karıştırılmaz; bir lig seçilmeden sıralama gösterilmez.'}</p>
          <span>${escapeHTML(updated?'Son güncelleme: '+updated:'Güncelleme zamanı sağlayıcıdan bekleniyor')}</span>
        </article>
      </section>
    </section>`;
  }

  function basketballLoadingHTML(){
    return `<section class="basketball-league-center basketball-loading-shell" aria-busy="true">
      <header class="basketball-league-identity"><span class="basketball-league-logo"><b aria-hidden="true">B</b></span><div><small>XYZSKOR · BASKETBOL LİG MERKEZİ</small><h2 data-classification-title>Lig merkezi hazırlanıyor</h2><p>Günlük program ve sezon sıralaması</p></div></header>
      <div class="basketball-overview-layout">
        <section class="basketball-overview-panel basketball-standings-panel"><header><div><small>GÜNCEL SEZON</small><h3>Puan durumu</h3></div></header><div class="basketball-standings-scroll"><table class="basketball-standings-table"><tbody>${basketballStandingsSkeletonHTML()}</tbody></table></div></section>
        <aside class="basketball-overview-panel basketball-fixtures-panel"><header><div><small>MAÇ AKIŞI</small><h3>Sonuçlar ve fikstür</h3></div></header><div class="basketball-fixture-skeleton">${Array.from({length:6},()=>'<i></i>').join('')}</div></aside>
      </div>
      <p class="basketball-loading-label" role="status">Basketbol merkezi hazırlanıyor</p>
    </section>`;
  }

  function basketballErrorHTML(rateLimited = false, autoRetryAvailable = true){
    return `<section class="basketball-league-center">
      <header class="basketball-league-identity"><span class="basketball-league-logo"><b aria-hidden="true">B</b></span><div><small>XYZSKOR · BASKETBOL LİG MERKEZİ</small><h2 data-classification-title>Basketbol</h2><p>Veri bağlantısı yeniden kurulacak</p></div></header>
      <div class="basketball-error-state" role="alert"><small>SAĞLAYICI DURUMU</small><h3>${rateLimited?'Basketbol sağlayıcısı geçici kota beklemesinde.':'Basketbol verisi şu anda alınamadı.'}</h3><p>${rateLimited?(autoRetryAvailable?'Bu doğrulanmış boş sonuç değil. Sağlayıcının bildirdiği bekleme süresi dolunca bir kez otomatik yeniden denenecek.':'Otomatik deneme kullanıldı. Sağlayıcının bekleme süresi dolduktan sonra yeniden deneyebilirsiniz.'):'Bu doğrulanmış boş sonuç değil. Bağlantı düzeldiğinde günlük program ve puan tablosu yeniden yüklenecek.'}</p><button type="button" data-basketball-hub-retry>Yeniden dene</button></div>
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
    const endpoint=`/api/sports/basketball/standings?league=${encodeURIComponent(league.id)}&season=${encodeURIComponent(league.season)}&proof=${encodeURIComponent(league.standingsProof||'')}`;
    const request=(async()=>{
      let response;
      try{
        response=await fetch(endpoint,{headers:{Accept:'application/json'},signal:controller?.signal});
      }catch(error){
        if(error?.name!=='AbortError') error.networkFailure=true;
        throw error;
      }
      const payload=await response.json().catch(()=>({}));
      if(!response.ok){
        const error=new Error(payload?.error||'basketball_standings_unavailable');
        error.code=payload?.error||'basketball_standings_unavailable';
        error.status=response.status;
        error.retryable=response.status===429||response.status>=500;
        error.retryAfterSeconds=retryAfterSeconds(response.headers.get('retry-after'));
        throw error;
      }
      if(payload?.sport!=='basketball'||String(payload?.leagueId)!==String(league.id)||String(payload?.season)!==String(league.season)||!Array.isArray(payload?.standings)){
        throw new Error('basketball_standings_scope_mismatch');
      }
      payload.stale=response.headers.get('x-data-stale')==='true'||Boolean(payload.stale);
      basketballStandingsPayloads.set(scope,{payload,receivedAt:Date.now()});
      persistLastVerifiedStandings(payload,league.id,league.season);
      return payload;
    })().catch((error)=>{
      if(!retryableProviderError(error)) throw error;
      const fallback=readLastVerifiedStandings(league.id,league.season);
      if(!fallback) throw error;
      return {
        ...fallback,
        reason:error?.status===429?'provider_rate_limited':'provider_unavailable',
        retryAfterSeconds:retryAfterSeconds(error?.retryAfterSeconds),
      };
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
      abortBasketballStandings();
      const message=league?.unresolved
        ? 'Seçili lig bugünkü sağlayıcı kapsamında doğrulanmadığı için puan tablosu istenmedi.'
        : 'Ligleri karıştırmamak için toplu görünümde puan tablosu gösterilmez. Bir lig seçin.';
      renderBasketballStandingsUnavailable(root,message,'empty',league);
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
      const archivedLabel=payload.browser_last_verified?'Tarayıcıda saklanan son doğrulanmış puan tablosu':'Son doğrulanmış puan tablosu';
      status.textContent=payload.stale?`${archivedLabel} yükleniyor…`:'Takımlar sıralamaya yerleştiriliyor…';
      const reduced=Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      if(reduced){
        body.innerHTML=rows.map(basketballStandingRowHTML).join('');
        table.setAttribute('aria-busy','false');
        status.textContent=`${rows.length} takım · ${payload.stale?archivedLabel:'API-Sports resmî sıralaması'}`;
        return;
      }
      let index=0;
      const appendNext=()=>{
        if(!stillCurrent()) return;
        body.insertAdjacentHTML('beforeend',basketballStandingRowHTML(rows[index]));
        index+=1;
        if(index<rows.length){ setTimeout(appendNext,55); return; }
        table.setAttribute('aria-busy','false');
        status.textContent=`${rows.length} takım · ${payload.stale?archivedLabel:'API-Sports resmî sıralaması'}`;
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
    if(item?.archived) return false;
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
        routeKey:'',
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
      league.routeKey=leagueRouteKey(league);
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
    if(item?.archived) return `ARŞİV · ${item?.feedDate||item?.time||'SON KAYIT'}`;
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
      return `<article class="volleyball-fixture-row ${item?.archived?'is-archived':live?'is-live':finished?'is-finished':'is-upcoming'}" role="listitem">
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
    const coverageMissing=Boolean(league?.unresolved);
    const identityMeta=coverageMissing
      ? 'Bugünkü sağlayıcı programında bu lig için doğrulanmış karşılaşma yok.'
      : [league?.country,league?.season||(!league?'Toplu günlük program':'Güncel günlük program')].filter(Boolean).join(' · ');
    return `<section class="volleyball-league-center" data-volleyball-league-center data-volleyball-scope="${escapeHTML(scopeLabel)}" data-league-route="${escapeHTML(activeLeagueRoute)}">
      <header class="volleyball-league-identity">
        <span class="volleyball-league-logo">${league?.logo?visual(league.name,league.logo,''):'<b aria-hidden="true">V</b>'}</span>
        <div><small>XYZSKOR · VOLEYBOL LİG MERKEZİ</small><h2 data-classification-title>${escapeHTML(scopeLabel)}</h2><p>${escapeHTML(identityMeta)}</p></div>
        <span class="volleyball-data-state">${coverageMissing?'DOĞRULANMIŞ BOŞ KAPSAM':payload?.degraded||payload?.stale?'SON DOĞRULANMIŞ VERİ':'GÜNLÜK CANLI PROGRAM'}</span>
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
      <section class="volleyball-overview-metrics" aria-label="${league?'Seçili lig özeti':'Tüm ligler özeti'}">
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
          <p>${coverageMissing?'Sağlayıcı bu sınıflandırmayı bugünkü programında döndürmedi; maç, takım veya sıralama satırı üretilmedi.':'Bu görünüm puan tablosu üretmez; program, sonuç ve takım kapsamı yalnız API-Sports günlük karşılaşmalarından oluşur.'}</p>
          <span>${escapeHTML(updated?'Son güncelleme: '+updated:'Güncelleme zamanı sağlayıcıdan bekleniyor')}</span>
        </article>
      </section>
    </section>`;
  }

  function volleyballLoadingHTML(){
    const fixtureSkeleton=Array.from({length:7},(_,index)=>`<i style="--volleyball-skeleton-index:${index}"></i>`).join('');
    const teamSkeleton=Array.from({length:8},(_,index)=>`<i style="--volleyball-skeleton-index:${index}"></i>`).join('');
    return `<section class="volleyball-league-center volleyball-loading-shell" aria-busy="true">
      <header class="volleyball-league-identity"><span class="volleyball-league-logo"><b aria-hidden="true">V</b></span><div><small>XYZSKOR · VOLEYBOL LİG MERKEZİ</small><h2 data-classification-title>Lig merkezi hazırlanıyor</h2><p>Günlük program ve takım kapsamı</p></div></header>
      <div class="volleyball-overview-layout">
        <section class="volleyball-overview-panel volleyball-program-panel"><header><div><small>MAÇ AKIŞI</small><h3>Sonuçlar ve fikstür</h3></div></header><div class="volleyball-fixture-skeleton">${fixtureSkeleton}</div></section>
        <aside class="volleyball-overview-panel volleyball-teams-panel"><header><div><small>GÜNLÜK KAPSAM</small><h3>Programdaki takımlar</h3></div></header><div class="volleyball-team-skeleton">${teamSkeleton}</div></aside>
      </div>
      <p class="volleyball-loading-label" role="status">Voleybol merkezi hazırlanıyor</p>
    </section>`;
  }

  function volleyballErrorHTML(rateLimited = false, autoRetryAvailable = true){
    return `<section class="volleyball-league-center">
      <header class="volleyball-league-identity"><span class="volleyball-league-logo"><b aria-hidden="true">V</b></span><div><small>XYZSKOR · VOLEYBOL LİG MERKEZİ</small><h2 data-classification-title>Voleybol</h2><p>Veri bağlantısı yeniden kurulacak</p></div></header>
      <div class="volleyball-error-state" role="alert"><small>SAĞLAYICI DURUMU</small><h3>${rateLimited?'Voleybol sağlayıcısı geçici kota beklemesinde.':'Voleybol verisi şu anda alınamadı.'}</h3><p>${rateLimited?(autoRetryAvailable?'Bu doğrulanmış boş sonuç değil. Sağlayıcının bildirdiği bekleme süresi dolunca bir kez otomatik yeniden denenecek.':'Otomatik deneme kullanıldı. Sağlayıcının bekleme süresi dolduktan sonra yeniden deneyebilirsiniz.'):'Bu doğrulanmış boş sonuç değil. Bağlantı düzeldiğinde günlük program ve takım kapsamı yeniden yüklenecek.'}</p><button type="button" data-volleyball-hub-retry>Yeniden dene</button></div>
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
    updateBranchIdentity(activeSport, payload?.browser_last_verified
      ? `Tarayıcıdaki son doğrulanmış program · ${payload.date} · güncel veri değil`
      : payload?.degraded||payload?.stale
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
    const catalogLeagues=activeSport==='volleyball'?(SPORT_LEAGUE_CATALOG.volleyball||[])
      .filter((name)=>!volleyballLeagues.some((league)=>league.name===name))
      .map((name)=>({key:name,routeKey:leagueRouteKey({name}),name,id:'',season:'',logo:'',country:'',events:[],unresolved:true})):[];
    const scopedLeagues=activeSport==='basketball'?basketballLeagues:[...volleyballLeagues,...catalogLeagues];
    let selectedLeague=activeLeagueRoute?leagueForRoute(scopedLeagues,activeLeagueRoute):null;
    if(!selectedLeague&&activeLeague!=='all') selectedLeague=scopedLeagues.find((league)=>league.key===activeLeague)||null;
    if(!selectedLeague&&activeLeagueRoute) selectedLeague=unresolvedLeagueForRoute(activeLeagueRoute);
    if(selectedLeague){
      activeLeague=selectedLeague.key;
      if(!selectedLeague.unresolved&&selectedLeague.routeKey!==activeLeagueRoute){
        activeLeagueRoute=selectedLeague.routeKey;
        replaceLeagueRoute(activeLeagueRoute);
      }
    }else{
      activeLeague='all';
      activeLeagueRoute='';
    }

    // Futboldaki lig sınıflandırması gibi bu ray her bölümde sekmelerden önce
    // kalır. Linkler doğrudan açılabilir; istemci yalnız belge yenilenmesini
    // önleyip aynı URL/durum sözleşmesini history üzerinde sürdürür.
    viewNav.before(leagueStrip);
    leagueStrip.hidden=false;
    leagueStrip.dataset.sportClassification='leagues';
    leagueStrip.setAttribute('aria-label',`${SPORT_LABELS[activeSport]||'Spor'} lig sınıflandırması`);
    const choiceLeagues=[...scopedLeagues];
    if(selectedLeague?.unresolved&&!choiceLeagues.some((league)=>league.routeKey===selectedLeague.routeKey)) choiceLeagues.push(selectedLeague);
    const visibleLeagueChoices=choiceLeagues.slice(0,24);
    if(selectedLeague&&!visibleLeagueChoices.some((league)=>league.routeKey===selectedLeague.routeKey)) visibleLeagueChoices.push(selectedLeague);
    const leagueChoices=[{
      key:'all',routeKey:'',name:'Tümü',accessibleLabel:`Tüm ${SPORT_LABELS[activeSport]||'spor'} ligleri`,events:allItems,
    },...visibleLeagueChoices];
    const choiceHTML=leagueChoices.map((league)=>{
      const duplicate=league.routeKey&&choiceLeagues.some((candidate)=>candidate!==league&&candidate.name===league.name);
      const qualifier=league.country||league.season||league.id;
      const label=duplicate&&qualifier?`${league.name} · ${qualifier}`:league.name;
      const accessibleLabel=league.accessibleLabel||[league.name,league.country,league.season].filter(Boolean).join(', ');
      const selected=league.routeKey===activeLeagueRoute;
      const classificationKey=league.routeKey||'all';
      return `<a href="${escapeHTML(hubPath(activeSport,activeView,league.routeKey))}" data-league="${escapeHTML(league.key)}" data-league-route="${escapeHTML(league.routeKey)}" data-classification-key="${escapeHTML(classificationKey)}" class="${selected?'active':''}" aria-label="${escapeHTML(accessibleLabel)}" ${selected?'aria-current="page"':''}>${escapeHTML(label)}</a>`;
    }).join('');
    leagueStrip.innerHTML=`<span class="multi-league-strip-label">LİGLER</span><div class="multi-league-strip-items">${choiceHTML}</div>`;
    leagueStrip.querySelectorAll('[data-league]').forEach((link)=>link.addEventListener('click',(event)=>{
      event.preventDefault();
      activeLeague=link.dataset.league;
      activeLeagueRoute=link.dataset.leagueRoute||'';
      pendingLeagueFocus=link.dataset.classificationKey||'all';
      const path=hubPath(activeSport,activeView,activeLeagueRoute);
      if(location.pathname!==path) history.pushState({multisport:true,league:activeLeagueRoute||'all'},'',path);
      if(window.XYZBranchRouter?.syncMetadata) window.XYZBranchRouter.syncMetadata(location.pathname,location.search);
      render(payload);
    }));
    if(pendingLeagueFocus){
      const focusKey=pendingLeagueFocus;
      pendingLeagueFocus='';
      requestAnimationFrame(()=>[...leagueStrip.querySelectorAll('[data-classification-key]')]
        .find((candidate)=>candidate.dataset.classificationKey===focusKey)?.focus());
    }
    const selectedBasketballLeague=activeSport==='basketball'?selectedLeague:null;
    const selectedVolleyballLeague=activeSport==='volleyball'?selectedLeague:null;
    const items=selectedLeague?selectedLeague.events:allItems;
    if(selectedLeague) syncLeagueIdentityMetadata(activeSport,selectedLeague);
    if(activeSport === 'basketball' && activeView === 'home'){
      const league=selectedBasketballLeague||null;
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
        const live = events.filter((item) => !item?.archived&&/live|quarter|period|halftime|in progress/i.test(item.status || '')).length;
        const archivedOnly=events.length>0&&events.every((item)=>item?.archived);
        return '<article class="multi-league-card"><span>LIG / ORGANIZASYON</span><h3>'+escapeHTML(name)+'</h3><div><b>'+events.length+'</b><small>'+(archivedOnly?'arşiv kaydı':'günlük etkinlik')+'</small></div><em class="'+(live ? 'is-live' : '')+'">'+(live ? live+' canlı' : archivedOnly?'son doğrulanmış kayıt':'program aktif')+'</em></article>';
      }).join('') : compactEmptyHTML('Doğrulanmış lig programı bulunmuyor.','Sağlayıcı bugün için bu branşta organizasyon programı döndürmedi.',payload,activeLeague==='all'?'Tüm ligler':activeLeague);
      return;
    }    if(activeView === 'teams'){
      const unique = new Map();
      items.forEach((item) => [item.first,item.second].forEach((team) => { if(team?.name) unique.set(team.name,team); }));
      grid.innerHTML = unique.size ? [...unique.values()].map(teamCardHTML).join('') : compactEmptyHTML('Doğrulanmış takım kaydı bulunmuyor.','Günlük programda takım eşleşmesi yayınlandığında liste otomatik dolar.',payload,activeLeague==='all'?'Tüm ligler':activeLeague);
      return;
    }
    if(activeView === 'predict'){
      const predictableItems=items.filter((item)=>!item?.archived);
      const archivedOnly=items.length>0&&predictableItems.length===0&&items.every((item)=>item?.archived);
      grid.innerHTML = predictableItems.length ? predictableItems.slice(0,10).map(predictCardHTML).join('') : compactEmptyHTML(archivedOnly?'Son doğrulanmış arşiv tahmine açılmaz.':'Bugün tahmine açık etkinlik yok.',archivedOnly?'Güncel sağlayıcı bağlantısı kurulunca yeni programdaki karşılaşmalar tahmine açılır.':'Bu doğrulanmış boş bir sonuçtur; yeni program geldiğinde tahmin kartları açılır.',payload,activeLeague==='all'?'Tüm ligler':activeLeague);
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
    const cached=trustedCachedBranchPayload(requestedSport);
    const receivedAt=payloadReceivedAt.get(requestedSport)||0;
    const today=multisportDate();
    if(cached&&(cached.browser_last_verified||(Date.now()-receivedAt<MULTISPORT_PAYLOAD_TTL_MS&&cached.date===today))){
      if(typeof CustomEvent!=='undefined') window.dispatchEvent(new CustomEvent('xyz:multisport-payload',{detail:{sport:requestedSport,payload:cached}}));
      return cached;
    }
    if(cached){ sharedPayloads.delete(requestedSport); payloadReceivedAt.delete(requestedSport); }
    const cooldown=activeBranchCooldown(requestedSport);
    if(cooldown) throw cooldown.error;
    if(!feedPromises.has(requestedSport)){
      const controller=typeof AbortController!=='undefined'?new AbortController():null;
      if(controller) feedControllers.set(requestedSport,controller);
      const request = (async()=>{
        let response;
        try{
          const dateNamespace=`&date=${encodeURIComponent(today)}`;
          response=await fetch(`/api/sports/today?sport=${encodeURIComponent(requestedSport)}&client=v11${dateNamespace}`, { headers:{Accept:'application/json'}, signal:controller?.signal });
        }catch(error){
          if(error?.name!=='AbortError') error.networkFailure=true;
          throw error;
        }
          const payload = await response.json().catch(() => ({}));
          if(!response.ok){
            const error=new Error(payload.error || 'sports_unavailable');
            error.status=response.status;
            error.retryable=response.status===429||response.status>=500;
            error.retryAfterSeconds=retryAfterSeconds(response.headers.get('retry-after'));
            throw error;
          }
          if(!branchPayloadForStorage(payload,requestedSport)) throw new Error('sports_branch_mismatch');
          const responseToday=multisportDate();
          if(payload.date!==responseToday){
            const error=new Error('sports_payload_date_mismatch');
            error.code='sports_payload_date_mismatch';
            error.status=502;
            error.retryable=true;
            error.retryAfterSeconds=retryAfterSeconds(response.headers.get('retry-after'));
            throw error;
          }
          const serverStale=response.headers.get('x-data-stale')==='true'||payload.stale===true||payload.degraded===true;
          const normalizedPayload=normalizedNetworkBranchPayload(payload,requestedSport,serverStale,response.headers.get('retry-after'));
          branchRetryCooldowns.delete(requestedSport);
          if(!serverStale){
            cancelBranchAutoRetries(requestedSport,true);
            branchAutoRetryUsed.delete(requestedSport);
          }
          cacheTrustedBranchPayload(requestedSport,normalizedPayload);
          persistLastVerifiedBranch(normalizedPayload,requestedSport);
          if(typeof CustomEvent!=='undefined') window.dispatchEvent(new CustomEvent('xyz:multisport-payload',{detail:{sport:requestedSport,payload:normalizedPayload}}));
          return normalizedPayload;
        })().catch((error)=>{
          if(!retryableProviderError(error)) throw error;
          const fallback=readLastVerifiedBranch(requestedSport);
          if(!fallback) throw error;
          const payload={
            ...fallback,
            reason:error?.status===429?'provider_rate_limited':'provider_unavailable',
            retryAfterSeconds:retryAfterSeconds(error?.retryAfterSeconds),
          };
          cacheTrustedBranchPayload(requestedSport,payload);
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

  async function openHub(sport, view = 'home', updateUrl = true, requestedLeagueRoute){
    if(sport === 'mma'){
      location.assign('/ufc/');
      return;
    }
    const sportChanged=Boolean(sport&&sport!==activeSport);
    if(sportChanged){
      cancelBranchAutoRetries();
      activeLeague='all';
      activeLeagueRoute='';
      pendingLeagueFocus='';
    }
    activeSport = sport || activeSport;
    activeView = view;
    if(requestedLeagueRoute!==undefined){
      activeLeagueRoute=String(requestedLeagueRoute||'');
      activeLeague='all';
    }else if(!updateUrl){
      const state=routeState();
      if(state?.sport===activeSport){
        activeLeagueRoute=String(state.leagueRoute||'');
        activeLeague='all';
      }
    }
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
    if(updateUrl && location.pathname !== hubPath(activeSport,activeView,activeLeagueRoute)) history.pushState({multisport:true,league:activeLeagueRoute||'all'},'',hubPath(activeSport,activeView,activeLeagueRoute));
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
    const cachedPayload=trustedCachedBranchPayload(requestedSport);
    const cachedAt=payloadReceivedAt.get(requestedSport)||0;
    const warm=Boolean(cachedPayload&&(cachedPayload.browser_last_verified||Date.now()-cachedAt<MULTISPORT_PAYLOAD_TTL_MS));
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
      if(payload?.browser_last_verified||payload?.stale||payload?.degraded){
        scheduleBranchAutoRetry(requestedSport,payload.retryAfterSeconds);
      }
    }
    catch(error){
      if(requestEpoch !== hubRequestEpoch || activeSport !== requestedSport || activeView !== requestedView) return;
      const branchLabel = SPORT_LABELS[requestedSport] || 'Spor';
      const rateLimited=error?.status===429;
      const autoRetryAvailable=!branchAutoRetryUsed.has(requestedSport);
      updateBranchIdentity(requestedSport, rateLimited?(autoRetryAvailable?'Sağlayıcı kotası bekleniyor · otomatik olarak bir kez yeniden denenecek':'Sağlayıcı kotası bekleniyor · otomatik deneme kullanıldı'):'Veri bağlantısı yeniden denenecek');
      grid.setAttribute('aria-busy','false');
      if(requestedSport==='basketball'&&requestedView==='home'){
        grid.innerHTML=basketballErrorHTML(rateLimited,autoRetryAvailable);
        grid.querySelector('[data-basketball-hub-retry]')?.addEventListener('click',(event)=>{
          if(activeBranchCooldown(requestedSport)||branchAutoRetryTimers.has(requestedSport)){
            event.currentTarget.textContent='Bekleme süresi dolunca yeniden denenecek';
            updateBranchIdentity(requestedSport,'Sağlayıcının Retry-After süresi korunuyor');
            return;
          }
          cancelBranchAutoRetries(requestedSport,true);
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
        grid.innerHTML=volleyballErrorHTML(rateLimited,autoRetryAvailable);
        grid.querySelector('[data-volleyball-hub-retry]')?.addEventListener('click',(event)=>{
          if(activeBranchCooldown(requestedSport)||branchAutoRetryTimers.has(requestedSport)){
            event.currentTarget.textContent='Bekleme süresi dolunca yeniden denenecek';
            updateBranchIdentity(requestedSport,'Sağlayıcının Retry-After süresi korunuyor');
            return;
          }
          cancelBranchAutoRetries(requestedSport,true);
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
        grid.innerHTML = compactEmptyHTML(rateLimited?`${branchLabel} sağlayıcısı geçici kota beklemesinde.`:`${branchLabel} verisi şu anda alınamadı.`,rateLimited?(autoRetryAvailable?'Bu doğrulanmış boş sonuç değildir. Sağlayıcının bekleme süresi dolunca yalnız bir otomatik deneme yapılır.':'Otomatik deneme kullanıldı; bekleme süresi dolduktan sonra yeniden deneyebilirsiniz.'):'Bu bir sağlayıcı hatasıdır, doğrulanmış boş sonuç değildir. Bağlantı düzeldiğinde program yeniden denenir.',null,branchLabel);
      }
      if(retryableProviderError(error)) scheduleBranchAutoRetry(requestedSport,error?.retryAfterSeconds,error);
    }
    window.scrollTo({top:0,behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }

  window.openMultiSportHub = openHub;

  function init(){
    const primary = document.querySelector('.primary-nav');
    const wrap = document.querySelector('.wrap');
    if(!primary || !wrap || document.getElementById('multiSportHub')) return;
    observedMultisportDate=multisportDate();
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
    if(initial) openHub(initial.sport,initial.view,false,initial.leagueRoute);
    window.addEventListener('popstate', () => { const state=routeState(); if(state) openHub(state.sport,state.view,false,state.leagueRoute); else closeHub(); });
    document.addEventListener('visibilitychange',refreshVisibleRollover);

    // Route-aware router entegrasyonu: basketbol ve voleybol yüzeyleri belge
    // yenilenmeden mount/unmount edilebilir. Router geçişte önce abort hook'u
    // çağırır, böylece eski branşın isteği yeni branşın üstüne veri yazamaz.
    if(window.XYZBranchRouter){
      window.XYZBranchRouter.registerAbortHook(() => {
        hubRequestEpoch += 1;
        cancelBranchAutoRetries();
        pendingViewFocus='';
        pendingLeagueFocus='';
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
          const hasLeagueRoute=parts[1]==='lig'&&Boolean(parts[2]);
          const view = ({maclar:'games',ligler:'leagues',takimlar:'teams',predict:'predict'})[hasLeagueRoute?parts[3]:parts[1]] || 'home';
          let leagueRoute='';
          if(hasLeagueRoute){try{leagueRoute=decodeURIComponent(parts[2]);}catch(_error){leagueRoute=parts[2];}}
          if(sport) openHub(sport,view,false,leagueRoute);
        },
        unmount:()=>{
          hubRequestEpoch += 1;
          cancelBranchAutoRetries();
          pendingViewFocus='';
          pendingLeagueFocus='';
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
