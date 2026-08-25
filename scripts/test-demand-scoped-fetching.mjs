import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const initialRouteSource = await readFile(new URL('../assets/js/initial-route.js', import.meta.url), 'utf8');
const dataSource = await readFile(new URL('../assets/js/data.js', import.meta.url), 'utf8');
const liveSource = await readFile(new URL('../assets/js/live.js', import.meta.url), 'utf8');
const multisportSource = await readFile(new URL('../assets/js/multisport.js', import.meta.url), 'utf8');
const sportBranchesSource = await readFile(new URL('../assets/js/sport-branches.js', import.meta.url), 'utf8');

const flush = () => new Promise((resolve) => setImmediate(resolve));
const failures = [];

function check(assertion, label) {
  try {
    assertion();
    console.log(`  OK   ${label}`);
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
    console.error(`  FAIL ${label}: ${error.message}`);
  }
}

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `${startMarker} baslangici bulunmali.`);
  assert.notEqual(end, -1, `${endMarker} siniri bulunmali.`);
  return source.slice(start, end);
}

function response(payload, ok = true) {
  return { ok, json: async () => payload };
}

async function initialRequests(pathname, search = '', { homeCache = null, seasonCache = null } = {}) {
  const requests = [];
  const classes = new Set();
  const context = vm.createContext({
    URLSearchParams,
    AbortController,
    location: { pathname, search },
    localStorage: { getItem: (key) => key === 'xyzskor:football-home:v3' && homeCache ? JSON.stringify(homeCache) : null },
    sessionStorage: { getItem: (key) => seasonCache && key === `xyzskor:provider-season:${seasonCache.payload?.league}` ? JSON.stringify(seasonCache) : null },
    document: {
      title: '',
      body: {
        dataset: {},
        classList: { add: (...names) => names.forEach((name) => classes.add(name)) },
      },
    },
    window: {},
    fetch: async (url) => {
      requests.push(String(url));
      if (String(url) === '/api/football/home') {
        return response({ league: 'all', matches: [], standingsByLeague: {}, availability: {} });
      }
      const league = new URL(String(url), 'https://xyzskor.test').searchParams.get('league');
      return response({ league, matches: [], standings: [] });
    },
  });
  vm.runInContext(initialRouteSource, context, { filename: `initial-route:${pathname}` });
  await flush();
  return { requests, context, classes };
}

console.log('\n=== Initial route demand scope ===');
{
  // `/` artik bagimsiz genel cok sporlu ana sayfadir ve hicbir spor API'sini
  // cagirmaz. Futbol bes lig merkezi `/futbol` altindadir.
  const generalHome = await initialRequests('/');
  assert.deepEqual(generalHome.requests, [], 'Genel ana sayfa hicbir spor API istegi baslatmamali.');
  assert.equal(generalHome.context.window.__XYZ_FOOTBALL_HOME_REQUEST__, undefined, 'Genel ana sayfa erken futbol home promise\'i kurmamali.');

  const root = await initialRequests('/futbol');
  assert.deepEqual(root.requests, ['/api/football/home'], 'Futbol koku yalniz tek kompakt /home istegi baslatmali.');
  assert.ok(root.context.window.__XYZ_FOOTBALL_HOME_REQUEST__, 'Kok istek promise\'i tam runtime tarafindan yeniden kullanilabilmeli.');
  assert.ok(root.context.window.__XYZ_FOOTBALL_HOME_ABORT_CONTROLLER__?.signal, 'Cold root erken istegi runtime route degisiminde abort edilebilmeli.');

  const cachedPayload = { league:'all', matches:[], standingsByLeague:{}, availability:{} };
  const cachedRoot = await initialRequests('/futbol', '', { homeCache:{ savedAt:Date.now(), payload:cachedPayload } });
  assert.deepEqual(cachedRoot.requests, [], 'Taze futbol home cache varken erken bootstrap /home istegini hic baslatmamali.');
  assert.equal(JSON.stringify(await cachedRoot.context.window.__XYZ_FOOTBALL_HOME_REQUEST__), JSON.stringify(cachedPayload), 'Taze home payload tam runtime tarafindan Promise handoff ile kullanilmali.');

  const legacyRoot = await initialRequests('/all');
  assert.deepEqual(legacyRoot.requests, ['/api/football/home'], 'Geriye donuk `/all` rotasi ayni tek kompakt /home kapsamini korumali.');
}

for (const league of ['super-lig', 'premier-league', 'la-liga', 'bundesliga', 'serie-a']) {
  const run = await initialRequests(`/${league}`);
  assert.deepEqual(
    run.requests,
    [`/api/football/season?league=${league}`],
    `${league} acilisi yalniz kendi season kapsaminda olmali.`,
  );
  // initial-route canonical runtime'dan once calisir; kendi controller'ini ve
  // scoped promise kaydini runtime'a devrederek hem reuse hem route abort saglar.
  assert.equal(run.context.window.__XYZ_FOOTBALL_SEASON_REQUEST__?.league, league, `${league} erken istegi kendi scope kaydini tasimali.`);
  assert.ok(run.context.window.__XYZ_FOOTBALL_SEASON_REQUEST__?.promise, `${league} erken istek promise'i runtime reuse icin korunmali.`);
  assert.ok(run.context.window.__XYZ_FOOTBALL_SEASON_ABORT_CONTROLLER__?.signal, `${league} cold erken istegi route degisiminde abort edilebilmeli.`);
}

for (const product of ['/predict', '/basketbol/', '/voleybol/', '/motorsports/formula-1', '/ufc/']) {
  const run = await initialRequests(product);
  assert.deepEqual(run.requests, [], `${product} ilk bootstrap'i futbol API ailesine dokunmamali.`);
}

{
  const fixture = await initialRequests('/super-lig', '?fixture=60001');
  assert.deepEqual(fixture.requests, [], 'Acik fixture rotasi season/home istegi baslatmamali; yalniz matchday modulu fixture istegini yapmali.');

  const fixtureOverview = await initialRequests('/super-lig', '?fixture=60001&view=home');
  assert.deepEqual(fixtureOverview.requests, [], 'Fixture overview rotasi da season/home baslatmamali; gorunen veri yalniz ayni fixture kapsaminda kalmali.');
}

console.log('\n=== No automatic diagnostic API ===');
{
  const leagueSwitchSource = sourceBetween(liveSource, 'async function loadFootballLeagueSelection', 'async function applyParsedLocation');
  const liveStartSource = sourceBetween(liveSource, 'function startLiveFeed', 'function stopLiveFeed');
  check(() => assert.equal(/\bloadFootballCoverage\s*\(/.test(leagueSwitchSource), false), 'Lig secimi otomatik /coverage kontrolu baslatmamali.');
  check(() => assert.equal(/\brefreshLiveProviderHealth\s*\(/.test(liveStartSource), false), 'Canli akis acilisi otomatik /health kontrolu baslatmamali.');
  check(() => assert.equal(/\/api\//.test(sportBranchesSource), false), 'Sport-branches hicbir API endpointinin sahibi olmamali.');
  check(() => assert.equal((multisportSource.match(/\/api\/sports\/today/g) || []).length, 1), 'Multisport modulu scoped today endpointinin tek sahibi olmali.');
}

console.log('\n=== Predict selected-league scope ===');
async function predictRequests(activeLeague) {
  const requested = [];
  const context = vm.createContext({
    Promise,
    Date,
    activeFootballLeague: activeLeague,
    activeWeek: 1,
    footballLeagueRequestKey: () => activeLeague,
    fetchProviderSeasonBundle: async (league) => {
      requested.push(league);
      return { league, matches: [] };
    },
    footballStatusIsUnavailable: () => false,
    footballStatusIsFinished: () => false,
    footballStatusIsLive: () => false,
    safeExternalURL: () => false,
    TEAM_CRESTS: {},
    renderProgress() {},
    renderLeagueMatches() {},
    renderWeeklyChallenge() {},
  });
  vm.runInContext(
    sourceBetween(dataSource, 'let PREDICT_CHALLENGE_MATCHES', 'function selectCurrentWeek'),
    context,
    { filename: `predict-demand-scope:${activeLeague}` },
  );
  await vm.runInContext('loadPredictChallengeSelection()', context);
  return requested;
}
const premierLeaguePredictRequests = await predictRequests('premier-league');
const aggregatePredictRequests = await predictRequests('all');
check(() => assert.deepEqual(premierLeaguePredictRequests, ['premier-league']), 'Predict yalniz secili ligin season paketini istemeli.');
check(() => assert.deepEqual(aggregatePredictRequests, ['super-lig']), 'Predict aggregate all kapsaminda guvenli varsayilan olarak yalniz super-lig istemeli.');

console.log('\n=== Predict current-user owned hydrate ===');
{
  const calls = [];
  let currentUser = { id:'user-a', team:'Fenerbahce' };
  let renderCount = 0;
  let authGate = null;
  const tableRows = {
    rewards: [
      { team:'Fenerbahce', sira:1, aciklama:'Haftalik paket', updated_at:'2026-08-24T08:00:00Z' },
    ],
    predictions: [
      { match_id:'sportmonks:101', user_id:'user-a', pick:'1', score_home:2, score_away:1, submitted_at:'2026-08-24T09:00:00Z' },
      { match_id:'sportmonks:202', user_id:'user-b', pick:'X', score_home:1, score_away:1, submitted_at:'2026-08-24T10:00:00Z' },
    ],
    results: [
      { match_id:'sportmonks:101', home:2, away:1, scored_at:'2026-08-24T11:00:00Z' },
      { match_id:'sportmonks:202', home:0, away:0, scored_at:'2026-08-24T12:00:00Z' },
    ],
  };
  function query(table){
    const state={ table, select:null, eq:[], in:[], order:[], limit:null, signal:null };
    const builder={
      select(value){ state.select=value; return builder; },
      eq(column,value){ state.eq.push([column,value]); return builder; },
      in(column,values){ state.in.push([column,[...values]]); return builder; },
      order(column,options){ state.order.push([column,options||null]); return builder; },
      limit(value){ state.limit=value; return builder; },
      abortSignal(signal){ state.signal=signal; return builder; },
      then(resolve,reject){
        calls.push({ ...state, eq:state.eq.map(entry=>[...entry]), in:state.in.map(entry=>[entry[0],[...entry[1]]]) });
        let rows=[...(tableRows[table]||[])];
        state.eq.forEach(([column,value])=>{ rows=rows.filter(row=>row[column]===value); });
        state.in.forEach(([column,values])=>{ rows=rows.filter(row=>values.includes(String(row[column]))); });
        if(Number.isFinite(state.limit)) rows=rows.slice(0,state.limit);
        return Promise.resolve({data:rows,error:null}).then(resolve,reject);
      },
    };
    return builder;
  }
  const listeners = new Map();
  const globals = {
    Promise,
    Date,
    Set,
    AbortController,
    console,
    AUTH_CONTEXT_READY:true,
    DATA_ERRORS:{},
    TEAMS:['Fenerbahce'],
    REWARDS:{},
    ALL_PREDICTIONS:{},
    ALL_RESULTS:{},
    document:{
      hidden:false,
      body:{ classList:{ contains:(name)=>name==='predict-product-open' } },
      addEventListener:(name,handler)=>listeners.set(name,handler),
    },
    window:{ addEventListener:(name,handler)=>listeners.set(`window:${name}`,handler) },
    sb:{ from:query },
    ensureXYZSupabaseClient:async()=>true,
    getCurrentUser:()=>currentUser,
    loadAccountContext:async()=>{
      if(authGate) await authGate.promise;
      globals.AUTH_CONTEXT_READY=true;
      return true;
    },
    refreshVisibleAccountViews:()=>{ renderCount+=1; },
    renderLeagueMatches:()=>{ renderCount+=1; },
    renderTeamBanner:()=>{ renderCount+=1; },
  };
  const ownedContext=vm.createContext(globals);
  globals.cachePredictions=(rows)=>{
    const next={};
    rows.forEach(row=>{
      if(!next[row.match_id]) next[row.match_id]={};
      next[row.match_id][row.user_id]={pick:row.pick,scoreHome:row.score_home,scoreAway:row.score_away,submittedAt:new Date(row.submitted_at).getTime()};
    });
    ownedContext.ALL_PREDICTIONS=next;
  };
  vm.runInContext(
    sourceBetween(dataSource, 'let predictOwnedContextRequest', 'function leaderboardCacheKey'),
    ownedContext,
    { filename:'predict-owned-demand-scope.js' },
  );

  await vm.runInContext('loadPredictOwnedContext()',ownedContext);
  check(() => assert.deepEqual(calls.map(call=>call.table),['rewards','predictions','results']), 'Predict hydrate yalniz rewards, current-user predictions ve bu tahminlerin results tablolarina dokunmali.');
  check(() => assert.deepEqual(calls[1].eq,[['user_id','user-a']]), 'Tahmin sorgusu auth sahibinin user_id kapsamiyla sinirlanmali.');
  check(() => assert.deepEqual(calls[2].in,[['match_id',['sportmonks:101']]]), 'Sonuc sorgusu yalniz current-user tahmin fixture IDleriyle sinirlanmali.');
  check(() => assert.equal(ownedContext.ALL_PREDICTIONS['sportmonks:101']['user-a'].pick,'1'), 'Dar hydrate ALL_PREDICTIONS render stateini doldurmali.');
  check(() => assert.equal(ownedContext.ALL_RESULTS['sportmonks:101'].home,2), 'Dar hydrate kullanicinin tahmin sonucunu render stateine baglamali.');
  check(() => assert.equal(ownedContext.REWARDS.Fenerbahce[0].aciklama,'Haftalik paket'), 'Dar hydrate gorunur Predict odul baglamini doldurmali.');
  check(() => assert.ok(renderCount>=3), 'Dar hydrate tamamlaninca Predict gorunumleri guvenli bicimde yeniden cizilmeli.');

  const firstCallCount=calls.length;
  await vm.runInContext('loadPredictOwnedContext()',ownedContext);
  check(() => assert.equal(calls.length,firstCallCount), 'Ayni auth scope icin tekrar render provider veya Supabase istegi uretmemeli.');

  let releaseAuth;
  authGate={};
  authGate.promise=new Promise(resolve=>{ releaseAuth=()=>{ currentUser={id:'user-b',team:'Fenerbahce'}; resolve(); }; });
  ownedContext.AUTH_CONTEXT_READY=false;
  const raced=vm.runInContext('loadPredictOwnedContext({force:true})',ownedContext);
  await flush();
  check(() => assert.equal(calls.length,firstCallCount), 'Auth hazir olmadan Predict uye sorgusu baslatilmamali.');
  releaseAuth();
  await raced;
  check(() => assert.deepEqual(calls.at(-2).eq,[['user_id','user-b']]), 'Auth-ready sonrasi sorgu gecici misafir scope yerine gercek kullaniciyla calismali.');
  check(() => assert.equal(ownedContext.ALL_PREDICTIONS['sportmonks:101'],undefined), 'Hesap degisince onceki kullanicinin tahmini render stateinde kalmamali.');
  check(() => assert.equal(ownedContext.ALL_PREDICTIONS['sportmonks:202']['user-b'].pick,'X'), 'Yeni auth scope yalniz kendi tahminini uygulamali.');

  authGate=null;
  const visibleCallCount=calls.length;
  ownedContext.document.hidden=true;
  await vm.runInContext('loadPredictOwnedContext({force:true})',ownedContext);
  check(() => assert.equal(calls.length,visibleCallCount), 'Predict gorunur degilken owned hydrate hic sorgu baslatmamali.');
}

console.log('\n=== Multisport SPA switch abort ===');
{
  const pending = [];
  const renders = [];
  const elements = {
    multiSportHub: { hidden: true },
    multiSportGrid: { innerHTML: '' },
  };
  const windowObject = { scrollTo() {}, dispatchEvent() {}, __XYZ_TEST_RENDERS__: renders };
  const context = vm.createContext({
    Promise,
    Map,
    Set,
    AbortController,
    DOMException,
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    URL,
    encodeURIComponent,
    console,
    location: { pathname: '/basketbol/', assign() {} },
    history: { pushState() {} },
    localStorage: { setItem() {} },
    document: {
      body: { classList: { add() {}, remove() {} } },
      getElementById: (id) => elements[id] || null,
      querySelectorAll: () => [],
    },
    window: windowObject,
    updateBranchTicker() {},
    fetch: (url, init = {}) => new Promise((resolve, reject) => {
      const item = { url: String(url), init, resolve, reject };
      pending.push(item);
      const signal = init.signal;
      if (!signal) return;
      if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }),
  });
  const withoutAutoInit = multisportSource.replace(
    /if\(document\.readyState === 'loading'\) document\.addEventListener\('DOMContentLoaded', init, \{once:true\}\);\s*else init\(\);\s*\}\)\(\);\s*$/,
    'window.__XYZ_TEST_OPEN_HUB__=openHub;})();',
  );
  assert.notEqual(withoutAutoInit, multisportSource, 'Multisport VM auto-init siniri bulunmali.');
  const instrumented = withoutAutoInit.replace(
    'function render(payload){',
    'function render(payload){ window.__XYZ_TEST_RENDERS__.push(payload); return;',
  );
  assert.notEqual(instrumented, withoutAutoInit, 'Multisport render davranisi izlenebilir olmali.');
  vm.runInContext(instrumented, context, { filename: 'multisport-demand-scope.js' });

  const basketball = vm.runInContext("window.__XYZ_TEST_OPEN_HUB__('basketball','home',false)", context);
  await flush();
  const volleyball = vm.runInContext("window.__XYZ_TEST_OPEN_HUB__('volleyball','home',false)", context);
  await flush();
  check(() => assert.deepEqual(
    pending.map((item) => item.url),
    [
      '/api/sports/today?sport=basketball&client=v10',
      '/api/sports/today?sport=volleyball&client=v10',
    ],
  ), 'Basketbol-volleyball gecisi yalniz iki gorunur scope istegi baslatmali.');
  check(() => assert.ok(pending[0].init.signal instanceof AbortSignal), 'Multisport istegi iptal edilebilir bir signal tasimali.');
  check(() => assert.equal(pending[0].init.signal?.aborted, true), 'Volleyball secilince pending basketbol istegi iptal edilmeli.');

  pending[1].resolve(response({ sports: { volleyball: [{ id: 'v1', sport: 'volleyball' }] } }));
  if (!pending[0].init.signal?.aborted) {
    pending[0].resolve(response({ sports: { basketball: [{ id: 'b1', sport: 'basketball' }] } }));
  }
  await Promise.allSettled([basketball, volleyball]);
  check(() => assert.deepEqual(renders.map((payload) => Object.keys(payload.sports)[0]), ['volleyball']), 'Eski basketbol cevabi volleyball DOMuna uygulanmamali.');
}

console.log('\n=== Root failure must not fan out ===');
{
  let seasonFanout = 0;
  const requests = [];
  const context = vm.createContext({
    Promise,
    Date,
    DOMException,
    setTimeout: (handler) => { handler(); return 1; },
    clearTimeout() {},
    footballHomeNetworkRequest: null,
    FOOTBALL_HOME_LEAGUES: ['super-lig', 'premier-league', 'la-liga', 'bundesliga', 'serie-a'],
    window: { __XYZ_FOOTBALL_HOME_REQUEST__: null },
    document: { hidden: false },
    localStorage: { setItem() {} },
    footballLeagueRequestKey: () => 'all',
    fetch: async (url) => {
      requests.push(String(url));
      return { ok:false, status:503, headers:{ get:() => '0' }, json:async () => ({ error:'provider_unavailable' }) };
    },
    fetchProviderSeasonBundle: async () => { seasonFanout += 1; return null; },
    compactFootballHomeBundle: () => ({ league: 'all', matches: [], standingsByLeague: {}, availability: {} }),
  });
  vm.runInContext(
    sourceBetween(dataSource, 'function validFootballHomePayload', 'async function fetchFootballHomeBundle'),
    context,
    { filename: 'football-home-demand-scope.js' },
  );
  const payload = await vm.runInContext('fetchFootballHomeNetwork()', context);
  check(() => assert.deepEqual(requests, ['/api/football/home']), 'Basarisiz /home cevabi da tek ag istegi olarak kalmali.');
  check(() => assert.equal(seasonFanout, 0), '/home hatasi bes ayri season istegine fan-out yapmamali.');
  check(() => assert.equal(payload, null), 'Dogrulanmamis aggregate fallback uretilmemeli.');
  context.window.__XYZ_FOOTBALL_HOME_REQUEST__=Promise.resolve(null);
  const beforeEarlyHandoff=requests.length;
  await vm.runInContext('fetchFootballHomeNetwork()', context);
  check(() => assert.equal(requests.length, beforeEarlyHandoff), '503 veren early /home handoff ikinci browser istegi baslatmamali.');
}

console.log('\n=== Real HTTP 503 cardinality ===');
{
  const requests = [];
  const context = vm.createContext({
    Promise,
    Date,
    Map,
    DOMException,
    encodeURIComponent,
    setTimeout: (handler) => { handler(); return 1; },
    clearTimeout() {},
    DATA_ERRORS: {},
    PROVIDER_LIVE_FALLBACK: '/api/football',
    PROVIDER_SEASON_CACHE_MS: 60_000,
    providerSeasonRequests: new Map(),
    document: { hidden:false },
    window: { __XYZ_FOOTBALL_SEASON_REQUEST__: null },
    sessionStorage: { getItem: () => null, setItem() {} },
    footballLeagueRequestKey: () => 'super-lig',
    fetch: async (url) => {
      requests.push(String(url));
      return { ok:false, status:503, headers:{ get:() => '0' }, json:async () => ({ error:'provider_unavailable' }) };
    },
  });
  vm.runInContext(
    sourceBetween(dataSource, 'async function fetchProviderSeasonBundleOnce', 'const FOOTBALL_HOME_LEAGUES'),
    context,
    { filename:'season-503-cardinality.js' },
  );
  const payload = await vm.runInContext("fetchProviderSeasonBundle('super-lig',{isActive:()=>true})", context);
  check(() => assert.deepEqual(requests, ['/api/football/season?league=super-lig']), 'Gercek season HTTP 503 ayni gorunur scope icin retry uretmemeli.');
  check(() => assert.equal(payload, null), 'Season 503 dogrulanmamis payload uygulamamali.');
  context.window.__XYZ_FOOTBALL_SEASON_REQUEST__={league:'super-lig',promise:Promise.resolve(null)};
  const beforeEarlyHandoff=requests.length;
  await vm.runInContext("fetchProviderSeasonBundle('super-lig',{isActive:()=>true})", context);
  check(() => assert.equal(requests.length, beforeEarlyHandoff), '503 veren early season handoff ikinci browser istegi baslatmamali.');
}

console.log('\n=== Stale root SWR ownership and abort ===');
{
  let activeLeague = 'all';
  const stalePayload = { league:'all', matches:[{id:'old-root'}], standingsByLeague:{}, availability:{} };
  const freshPayload = { league:'all', matches:[{id:'late-root'}], standingsByLeague:{}, availability:{} };
  const pending = [];
  const applies = [];
  const events = [];
  const cacheWrites = [];
  const context = vm.createContext({
    Promise,
    Date,
    AbortController,
    DOMException,
    CustomEvent: class CustomEvent { constructor(type, init) { this.type=type; this.detail=init?.detail; } },
    footballHomeNetworkRequest: null,
    footballCriticalRequest: null,
    footballDataLoadSequence: 0,
    FOOTBALL_HOME_CACHE_KEY: 'xyzskor:football-home:v3',
    FOOTBALL_HOME_CACHE_MS: 10 * 60 * 1000,
    DATA_ERRORS: {},
    document: { hidden:false, body:{ dataset:{} } },
    window: {
      __XYZ_FOOTBALL_HOME_REQUEST__: null,
      __XYZ_FOOTBALL_HOME_ABORT_CONTROLLER__: null,
      dispatchEvent: (event) => events.push(event),
    },
    localStorage: {
      getItem: () => JSON.stringify({ savedAt:Date.now() - 11 * 60 * 1000, payload:stalePayload }),
      setItem: (...args) => cacheWrites.push(args),
    },
    footballLeagueRequestKey: () => activeLeague,
    fetchProviderSeasonBundle: async (league) => ({ league, matches:[{id:`${league}-current`}], standings:[] }),
    applyFootballCriticalBundle: (payload, league) => { applies.push({payload,league}); return true; },
    fetch: (url, init={}) => new Promise((resolve) => pending.push({url:String(url),init,resolve})),
  });
  vm.runInContext(
    sourceBetween(dataSource, 'function validFootballHomePayload', 'let PREDICT_CHALLENGE_MATCHES')
      + '\n'
      + sourceBetween(dataSource, 'async function loadFootballCriticalData', 'async function loadAllData'),
    context,
    { filename:'stale-home-route-abort.js' },
  );

  const rootVisible = vm.runInContext('loadFootballCriticalData()', context);
  await rootVisible;
  const rootOwner = context.footballCriticalRequest;
  check(() => assert.equal(applies[0]?.league, 'all'), 'Stale root cache ilk boyamada hemen uygulanmali.');
  check(() => assert.ok(rootOwner?.ownerPromise), 'SWR sahibi gorunur cache promise bittikten sonra da ag promise bitene kadar korunmali.');
  check(() => assert.equal(pending.length, 1), 'Stale root yalniz tek arka plan /home istegi baslatmali.');

  activeLeague = 'premier-league';
  const leagueVisible = vm.runInContext('loadFootballCriticalData()', context);
  await leagueVisible;
  check(() => assert.equal(pending[0].init.signal?.aborted, true), 'Root-lig gecisi stale /home SWR signalini gercekten abort etmeli.');
  pending[0].resolve(response(freshPayload));
  await rootOwner.ownerPromise;
  await flush();
  check(() => assert.deepEqual(applies.map((entry) => entry.league), ['all','premier-league']), 'Gec kalan root cevabi yeni lig stateine uygulanmamali.');
  check(() => assert.equal(events.filter((event) => event.type==='xyz:football-home-refreshed').length, 0), 'Abort edilen root SWR refresh olayi yaymamali.');
  check(() => assert.equal(cacheWrites.length, 0), 'Abort edilen gec root cevabi browser cacheini de ezmemeli.');

  activeLeague = 'all';
  const predictRootVisible = vm.runInContext('loadFootballCriticalData()', context);
  await predictRootVisible;
  const predictRootOwner = context.footballCriticalRequest;
  const predictPending = pending[1];
  vm.runInContext('abortFootballCriticalData()', context);
  check(() => assert.equal(predictPending.init.signal?.aborted, true), 'Predict urunune gecis stale root SWR signalini abort etmeli.');
  predictPending.resolve(response(freshPayload));
  await predictRootOwner.ownerPromise;
  await flush();
  check(() => assert.equal(events.filter((event) => event.type==='xyz:football-home-refreshed').length, 0), 'Predict gecisi sonrasi gec root refresh olayi yayilmamali.');
  check(() => assert.equal(cacheWrites.length, 0), 'Predict gecisi sonrasi gec root cevabi cache yazmamali.');
}

console.log('\n=== Season route switch abort ===');
{
  let activeFootballLeague = 'super-lig';
  const pending = [];
  const context = vm.createContext({
    Promise,
    Date,
    Map,
    AbortController,
    DOMException,
    encodeURIComponent,
    console,
    activeFootballLeague,
    footballDataLoadSequence: 0,
    footballSeasonAbortController: null,
    providerSeasonAbortController: null,
    footballCriticalAbortController: null,
    footballCriticalRequest: null,
    providerSeasonRequests: new Map(),
    DATA_ERRORS: {},
    PROVIDER_LIVE_FALLBACK: '/api/football',
    PROVIDER_SEASON_CACHE_MS: 60_000,
    document: { body: { dataset: {} } },
    window: { __XYZ_FOOTBALL_SEASON_REQUEST__: null },
    sessionStorage: { getItem: () => null, setItem() {} },
    footballLeagueRequestKey: () => activeFootballLeague,
    applyFootballCriticalBundle: () => true,
    fetch: (url, init = {}) => new Promise((resolve, reject) => {
      const item = { url: String(url), init, resolve, reject };
      pending.push(item);
      const signal = init.signal;
      if (!signal) return;
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }),
  });
  vm.runInContext(
    sourceBetween(dataSource, 'async function fetchProviderSeasonBundle', 'const FOOTBALL_HOME_LEAGUES')
      + '\n'
      + sourceBetween(dataSource, 'async function loadFootballCriticalData', 'async function loadAllData'),
    context,
    { filename: 'football-season-demand-scope.js' },
  );

  const first = vm.runInContext('loadFootballCriticalData()', context);
  await flush();
  activeFootballLeague = 'premier-league';
  context.activeFootballLeague = activeFootballLeague;
  const second = vm.runInContext('loadFootballCriticalData()', context);
  await flush();

  check(() => assert.deepEqual(
    pending.map((item) => item.url),
    ['/api/football/season?league=super-lig', '/api/football/season?league=premier-league'],
  ), 'Hizli lig gecisi yalniz eski ve yeni gorunur scope isteklerini baslatmali.');
  check(() => assert.ok(pending[0].init.signal instanceof AbortSignal), 'Season istegi iptal edilebilir bir signal tasimali.');
  check(() => assert.equal(pending[0].init.signal?.aborted, true), 'Yeni lig secilince eski scope season istegi ag seviyesinde iptal edilmeli.');

  for (const item of pending) {
    if (!item.init.signal?.aborted) {
      const league = new URL(item.url, 'https://xyzskor.test').searchParams.get('league');
      item.resolve(response({ league, matches: [], standings: [] }));
    }
  }
  await Promise.allSettled([first, second]);
}

console.log('\n=== Live visibility and scope lifecycle ===');
{
  let activeFootballLeague = 'all';
  const fetches = [];
  const timers = [];
  const cleared = [];
  const listeners = new Map();
  let supabaseFallbackCalls = 0;
  const storyPage = { classList: { contains: (name) => name === 'active' } };
  const context = vm.createContext({
    Promise,
    Date,
    Math,
    Number,
    String,
    Set,
    AbortController,
    DOMException,
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    encodeURIComponent,
    console,
    activeFootballLeague,
    activeFootballSection: 'home',
    liveFeedHandle: null,
    liveFeedAbortController: null,
    liveFeedRequestSeq: 0,
    liveFeedRequestScope: null,
    liveFeedActiveScope: null,
    liveFeedLoading: false,
    liveFeedNextRefreshMs: 5000,
    liveFeedVisibilityBound: false,
    liveProviderHealthCheckedAt: Date.now(),
    LIVE_FEED: { matches: [], loaded: false, stale: false, error: null },
    LIVE_FEED_CONFIG: { functionName: 'football-live', scope: 'all', refreshMs: 30000 },
    LIVE_FEED_MIN_REFRESH_MS: 5000,
    LIVE_FEED_MAX_REFRESH_MS: 300000,
    LIVE_EXIT_VERIFICATION_PENDING: new Set(),
    MATCHES: [],
    ALL_RESULTS: {},
    navigator: { onLine: true },
    document: {
      hidden: false,
      getElementById: (id) => id === 'page-story' ? storyPage : null,
      addEventListener: (name, handler) => listeners.set(name, handler),
    },
    window: {
      dispatchEvent() {},
      addEventListener: (name, handler) => listeners.set(`window:${name}`, handler),
    },
    setTimeout: (handler, delay) => { timers.push({ handler, delay }); return timers.length; },
    clearTimeout: (handle) => { cleared.push(handle); },
    footballLeagueRequestKey: () => activeFootballLeague,
    refreshLiveProviderLabel() {},
    renderLiveFeed() {},
    renderFootballQuickMatches() {},
    renderFootballScoreboardHome() {},
    renderFootballLeagueOverview() {},
    footballStatusIsLive: () => false,
    normalizedLiveMatch: () => null,
    verifyExitedLiveFixture() {},
    sb: { functions: { invoke: async () => { supabaseFallbackCalls += 1; return { data:null, error:new Error('Fallback kullanilmamali.') }; } } },
    fetch: (url, init = {}) => new Promise((resolve, reject) => {
      const item = { url: String(url), init, resolve, reject };
      fetches.push(item);
      const signal = init.signal;
      if (!signal) return;
      if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }),
  });
  vm.runInContext(
    sourceBetween(liveSource, 'async function loadLiveFeed', '/* ===================== MAIN TAB SWITCH'),
    context,
    { filename: 'live-demand-scope.js' },
  );

  context.document.hidden = true;
  context.liveFeedHandle = 77;
  vm.runInContext('scheduleNextLivePoll()', context);
  assert.deepEqual(cleared, [77], 'Sekme gizlenince bekleyen live poll zamanlayicisi temizlenmeli.');
  assert.equal(timers.length, 0, 'Sekme gizliyken yeni poll zamanlayicisi kurulmamalı.');

  context.document.hidden = false;
  vm.runInContext('scheduleNextLivePoll()', context);
  assert.equal(timers.length, 1, 'Gorunur futbol yuzeyi yalniz bir sonraki pollu planlamali.');
  context.document.hidden = true;
  vm.runInContext('handleLiveVisibilityChange()', context);
  assert.equal(timers.length, 1, 'Gizlilik olayi yeni poll uretmemeli.');

  context.document.hidden = false;
  const hiddenRequest = vm.runInContext('loadLiveFeed(false)', context);
  await flush();
  context.document.hidden = true;
  vm.runInContext('handleLiveVisibilityChange()', context);
  check(() => assert.equal(fetches[0].init.signal.aborted, true), 'Sekme gizlenince devam eden live istegi de iptal edilmeli.');
  await flush();

  context.document.hidden = false;
  const first = vm.runInContext('loadLiveFeed(true)', context);
  await flush();
  activeFootballLeague = 'super-lig';
  context.activeFootballLeague = activeFootballLeague;
  const second = vm.runInContext('loadLiveFeed(false)', context);
  await flush();
  assert.deepEqual(
    fetches.map((item) => item.url),
    ['/api/football/live?league=all', '/api/football/live?league=all', '/api/football/live?league=super-lig'],
    'Root ve lig gecisi yalniz o anda gorunen live scope\'larini istemeli.',
  );
  assert.equal(fetches[1].init.signal.aborted, true, 'Lig degisince eski live scope istegi iptal edilmeli.');
  fetches[2].resolve(response({ matches: [], updatedAt: new Date().toISOString(), nextRefreshInSeconds: 60 }));
  await Promise.allSettled([hiddenRequest, first, second]);

  const priorLiveMatch = { id:'live-1', status:'live', home:{ score:1 }, away:{ score:0 } };
  context.LIVE_FEED = { matches:[priorLiveMatch], loaded:true, stale:false, error:null };
  const structuredFailure = vm.runInContext('loadLiveFeed(true)', context);
  await flush();
  fetches[3].resolve(response({ matches:[], error:'sync_in_progress', reason:'provider_lock_busy' }, false));
  await structuredFailure;
  check(() => assert.equal(supabaseFallbackCalls, 0), 'Yapilandirilmis Worker 503 yaniti Supabase Edge fallback baslatmamali.');
  check(() => assert.deepEqual(context.LIVE_FEED.matches, [priorLiveMatch]), 'Worker 503 mevcut canli snapshotini bosaltmamali.');
}

if (failures.length) {
  throw new Error(`Demand-scoped fetching checks failed (${failures.length}):\n- ${failures.join('\n- ')}`);
}
console.log('\nDemand-scoped fetching checks passed.');
