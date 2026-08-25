// XYZSKOR genel çok sporlu ana sayfa + route-aware branş router sözleşmesi.
//
// Bu test EXTERNAL-REVIEW-HANDOFF-2026-08-25 P1.1 ve P1.2 maddelerinin
// regresyon kapısıdır ve kasıtlı olarak uygulamadan ÖNCE yazılmıştır.
//
// Sözleşme:
//   1. `/` genel spor shell'idir: ilk bootstrap HİÇBİR spor API'sine dokunmaz.
//   2. Futbol beş lig merkezi `/futbol` altındadır ve yalnız bir /football/home
//      isteği başlatır. `/all` geriye dönük uyumluluk için aynı davranır.
//   3. Tek lig rotası yalnız kendi /season isteğini başlatır.
//   4. Branş router'ı tam sayfa navigasyon (location.assign) kullanmaz;
//      eski isteği abort eder ve header'ı yeniden kurmaz.
//   5. Router hiçbir API endpointinin sahibi değildir.

import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const initialRouteSource = await readFile(new URL('../assets/js/initial-route.js', import.meta.url), 'utf8');
const sportBranchesSource = await readFile(new URL('../assets/js/sport-branches.js', import.meta.url), 'utf8');
const generalHomeSource = await readFile(new URL('../assets/js/general-home.js', import.meta.url), 'utf8').catch(() => '');
const branchRouterSource = await readFile(new URL('../assets/js/branch-router.js', import.meta.url), 'utf8').catch(() => '');
const multisportSource = await readFile(new URL('../assets/js/multisport.js', import.meta.url), 'utf8');
const dataSource = await readFile(new URL('../assets/js/data.js', import.meta.url), 'utf8');
const liveSource = await readFile(new URL('../assets/js/live.js', import.meta.url), 'utf8');
const uiSource = await readFile(new URL('../assets/js/ui.js', import.meta.url), 'utf8');
const matchCenterSource = await readFile(new URL('../assets/js/match-center.js', import.meta.url), 'utf8');
const matchdaySource = await readFile(new URL('../assets/js/matchday-live.js', import.meta.url), 'utf8');
const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const appLateCss = await readFile(new URL('../assets/css/app-late.css', import.meta.url), 'utf8');

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

function response(payload, ok = true) {
  return { ok, json: async () => payload };
}

async function initialRequests(pathname, search = '') {
  const requests = [];
  const classes = new Set();
  const context = vm.createContext({
    URLSearchParams,
    AbortController,
    location: { pathname, search },
    localStorage: { getItem: () => null },
    sessionStorage: { getItem: () => null },
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
      return response({ league: 'all', matches: [], standingsByLeague: {}, availability: {} });
    },
  });
  vm.runInContext(initialRouteSource, context, { filename: `initial-route:${pathname}` });
  await flush();
  return { requests, context, classes };
}

function createRouterHarness(fetchImpl = async () => response(''), initialPathname = '/') {
  const assignments = [];
  const reloads = [];
  const pushes = [];
  const listeners = new Map();
  const timers = new Map();
  let nextTimer = 1;
  const classList = () => {
    const values = new Set();
    return {
      add: (...names) => names.forEach((name) => values.add(name)),
      remove: (...names) => names.forEach((name) => values.delete(name)),
      contains: (name) => values.has(name),
    };
  };
  const location = {
    origin: 'https://xyzskor.test',
    href: `https://xyzskor.test${initialPathname}`,
    pathname: initialPathname,
    search: '',
    assign(url) { assignments.push(String(url)); },
    reload() { reloads.push(location.href); },
  };
  const progressLabel = { textContent: '' };
  const document = {
    body: { appendChild(element) { element.isConnected = true; } },
    documentElement: { classList: classList() },
    createElement: () => ({
      className: '',
      classList: classList(),
      isConnected: false,
      innerHTML: '',
      setAttribute() {},
      querySelector: (selector) => selector === '.xyz-route-progress-label' ? progressLabel : null,
    }),
    querySelectorAll: () => [],
  };
  const window = {
    location,
    scrollTo() {},
    addEventListener(type, listener) { listeners.set(type, listener); },
  };
  const history = {
    pushState(state, title, url) {
      pushes.push({ state, title, url });
      const parsed = new URL(url, location.href);
      location.pathname = parsed.pathname;
      location.search = parsed.search;
      location.href = parsed.href;
    },
  };
  const context = vm.createContext({
    AbortController,
    URL,
    Promise,
    document,
    fetch: fetchImpl,
    history,
    location,
    window,
    setTimeout(callback, delay) {
      const id = nextTimer++;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
  });
  vm.runInContext(branchRouterSource, context, { filename: 'branch-router.js' });
  return { assignments, context, listeners, pushes, reloads, timers, window };
}

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `${startMarker} kaynak araligi bulunamadi.`);
  return source.slice(start, end);
}

console.log('\n=== 1) Genel ana sayfa hiçbir spor API çağırmaz ===');
{
  const root = await initialRequests('/');
  check(() => assert.deepEqual(root.requests, []), 'Genel ana sayfa `/` ilk bootstrap\'te sıfır spor API isteği yapar.');
  check(() => assert.ok(root.classes.has('general-home-route')), '`/` genel ana sayfa route sınıfını işaretler.');
  check(() => assert.equal(root.classes.has('football-root-route'), false), '`/` artık futbol kökü gibi davranmaz.');
  check(() => assert.equal(root.context.window.__XYZ_FOOTBALL_HOME_REQUEST__, undefined), '`/` erken futbol home promise\'i kurmaz.');
}

console.log('\n=== 2) Futbol merkezi /futbol altında ve tek /home isteği yapar ===');
for (const path of ['/futbol', '/futbol/', '/all']) {
  const run = await initialRequests(path);
  check(() => assert.deepEqual(run.requests, ['/api/football/home']), `${path} yalnız tek kompakt /football/home isteği başlatır.`);
  check(() => assert.ok(run.classes.has('football-root-route')), `${path} futbol kökü olarak işaretlenir.`);
  check(() => assert.ok(run.context.window.__XYZ_FOOTBALL_HOME_ABORT_CONTROLLER__?.signal), `${path} erken isteği route değişiminde abort edilebilir.`);
}

console.log('\n=== 3) Tek lig kapsamı korunur ===');
for (const league of ['super-lig', 'premier-league', 'la-liga', 'bundesliga', 'serie-a']) {
  const run = await initialRequests(`/${league}`);
  check(
    () => assert.deepEqual(run.requests, [`/api/football/season?league=${league}`]),
    `/${league} yalnız kendi season kapsamını ister.`,
  );
}

console.log('\n=== 4) Branş rotaları futbol API ailesine dokunmaz ===');
for (const product of ['/predict', '/basketbol/', '/voleybol/', '/motorsports/formula-1', '/ufc/']) {
  const run = await initialRequests(product);
  check(() => assert.deepEqual(run.requests, []), `${product} ilk bootstrap'i futbol API ailesine dokunmaz.`);
}

console.log('\n=== 5) Router tam sayfa navigasyon yapmaz ===');
{
  const routerSource = `${sportBranchesSource}\n${generalHomeSource}\n${branchRouterSource}`;
  check(() => assert.ok(branchRouterSource, 'assets/js/branch-router.js mevcut olmalı.'), 'Branş router modülü mevcut.');
  check(
    () => assert.equal(/location\.assign\(/.test(sportBranchesSource), false),
    'Branş router\'ı location.assign ile tam sayfa navigasyon yapmaz.',
  );
  check(
    () => assert.equal(/location\.href\s*=/.test(sportBranchesSource), false),
    'Branş router\'ı location.href atamasıyla belge yenilemez.',
  );
  check(
    () => assert.ok(/history\.pushState/.test(routerSource)),
    'Router geçişi history.pushState ile yapılır (belge yenilenmez).',
  );
  check(
    () => assert.ok(/abort\(/.test(routerSource)),
    'Router geçişte devam eden isteği abort eder.',
  );
  check(
    () => assert.ok(/popstate/.test(routerSource)),
    'Router geri/ileri düğmesini popstate ile karşılar.',
  );
  check(
    () => assert.equal(/\/api\//.test(routerSource), false),
    'Router hiçbir API endpointinin sahibi değildir.',
  );
  // Bazı branş modülleri (futbol kökü, UFC, motor sporları) yüklenme anında
  // location.pathname'e bağlıdır; onlar için belge değişimi zorunludur.
  // Bu MANAGED yol yalnız abort + prefetch sonrası commit edilebilir ve
  // tüm sayfayı skeleton'a çeviremez.
  check(
    () => assert.ok(/abortPendingBranchWork\(\)[\s\S]{0,4000}?prefetch\([\s\S]{0,600}?commitNavigation\(/.test(branchRouterSource)),
    'MANAGED geçiş sırası abort → prefetch → commit olarak korunur.',
  );
  check(
    () => assert.equal((branchRouterSource.match(/location\.assign\(/g) || []).length, 1),
    'Belge değişimi tek bir denetimli commitNavigation noktasından geçer.',
  );
  check(
    () => assert.ok(/xyz-route-progress/.test(branchRouterSource)),
    'Geçişte tüm sayfa skeleton\'ı yerine ince progress göstergesi kullanılır.',
  );
}

console.log('\n=== 5b) Branş izolasyonu geçişte korunur ===');
{
  check(
    () => assert.equal(/\.remove\(\)/.test(multisportSource.slice(
      multisportSource.indexOf('function pruneFootballSurface'),
      multisportSource.indexOf('function restoreFootballSurface'),
    )), false),
    'Futbol yüzeyi geçişte DOM\'dan silinmez, gizlenir (geri dönüş mümkün).',
  );
  check(
    () => assert.ok(/registerAbortHook/.test(multisportSource)),
    'Multisport devam eden isteklerini router abort hook\'una kaydeder.',
  );
  check(
    () => assert.ok(/restoreFootballSurface/.test(multisportSource)),
    'Branştan çıkışta futbol yüzeyi geri getirilir.',
  );
}

console.log('\n=== 5c) Belge navigasyonu tarayıcı transition reddine düşmez ===');
{
  check(
    () => assert.doesNotMatch(appLateCss, /@view-transition\s*\{[^}]*navigation\s*:\s*auto/i),
    'Cross-document navigasyon otomatik View Transition opt-in kullanmaz.',
  );
}

console.log('\n=== 5c) İstemci geçişi önce eski branş işini iptal eder ===');
{
  const harness = createRouterHarness();
  const order = [];
  const homeController = new AbortController();
  const seasonController = new AbortController();
  harness.window.__XYZ_FOOTBALL_HOME_ABORT_CONTROLLER__ = homeController;
  harness.window.__XYZ_FOOTBALL_SEASON_ABORT_CONTROLLER__ = seasonController;
  harness.window.XYZBranchRouter.registerAbortHook(() => order.push('abort'));
  harness.window.XYZBranchRouter.register({
    key: 'multisport-test',
    matches: (pathname) => pathname === '/basketbol/',
    mount: () => order.push('mount'),
  });
  let navigationError = null;
  let navigationResult = false;
  try { navigationResult = await harness.window.XYZBranchRouter.navigate('/basketbol/'); }
  catch (error) { navigationError = error; }
  check(() => assert.ifError(navigationError), 'İstemci branş geçişi hatasız tamamlanır.');
  check(() => assert.equal(navigationResult, true), 'Kayıtlı istemci yüzeyi başarıyla mount edilir.');
  check(() => assert.deepEqual(order, ['abort', 'mount']), 'Abort hook\'ları hedef mount işleminden önce çalışır.');
  check(() => assert.equal(homeController.signal.aborted, true), 'Erken futbol home isteği istemci geçişinde abort edilir.');
  check(() => assert.equal(seasonController.signal.aborted, true), 'Erken futbol season isteği istemci geçişinde abort edilir.');
  check(() => assert.equal(harness.assignments.length, 0), 'İstemci yüzeyi geçişi belge navigasyonuna düşmez.');
}

console.log('\n=== 5d) MANAGED prefetch sonlu sürede normal navigasyona düşer ===');
{
  let prefetchSignal = null;
  const harness = createRouterHarness((_url, options) => {
    prefetchSignal = options?.signal || null;
    return new Promise(() => {});
  });
  const navigation = harness.window.XYZBranchRouter.navigate('/ufc/');
  const deadline = [...harness.timers.values()].find((timer) => timer.delay > 0);
  check(() => assert.ok(deadline), 'MANAGED prefetch için bir son tarih zamanlayıcısı kurulur.');
  check(
    () => assert.ok(deadline.delay <= 5000, `prefetch son tarihi ${deadline.delay} ms ile sınırlı olmalı.`),
    'MANAGED prefetch bekleme süresi beş saniyenin altındadır.',
  );
  if (deadline) deadline.callback();
  const navigationResult = deadline ? await navigation : false;
  check(() => assert.equal(prefetchSignal?.aborted, true), 'Süre aşımında takılan prefetch ağ isteği abort edilir.');
  check(() => assert.equal(navigationResult, true), 'Prefetch süre aşımı navigasyonu başarısız saymaz.');
  check(
    () => assert.deepEqual(harness.assignments, ['https://xyzskor.test/ufc/']),
    'Prefetch takılsa bile hedef belge tek kontrollü fallback noktasından açılır.',
  );
}

console.log('\n=== 5d.1) Branş paket yükleyicisi takılırsa belge fallback yolu açılır ===');
{
  const harness = createRouterHarness();
  harness.window.ensureXYZBranchModule = () => new Promise(() => {});
  const navigation = harness.window.XYZBranchRouter.navigate('/ufc/');
  const moduleDeadline = [...harness.timers.values()].find((timer) => timer.delay > 0);
  check(() => assert.ok(moduleDeadline), 'Branş paket yükleyicisi için bir son tarih zamanlayıcısı kurulur.');
  check(
    () => assert.ok(moduleDeadline.delay <= 5000, `paket yükleme son tarihi ${moduleDeadline.delay} ms ile sınırlı olmalı.`),
    'Branş paket yükleyicisi beş saniyeden uzun bekletmez.',
  );
  if (moduleDeadline) moduleDeadline.callback();
  const navigationResult = moduleDeadline ? await navigation : false;
  check(() => assert.equal(navigationResult, true), 'Paket yükleme süresi aşılırsa managed fallback tamamlanır.');
  check(
    () => assert.deepEqual(harness.assignments, ['https://xyzskor.test/ufc/']),
    'Takılan paket yükleyicisi hedef belge navigasyonunu engellemez.',
  );
}

console.log('\n=== 5d.2) Back, istemci branşından yönetilen futbol belgesine döner ===');
{
  const harness = createRouterHarness(async () => response(''), '/futbol');
  const order = [];
  harness.window.XYZBranchRouter.register({
    key: 'multisport-test',
    matches: (pathname) => pathname === '/basketbol/',
    mount: () => order.push('basketbol-mount'),
    unmount: () => order.push('basketbol-unmount'),
  });
  await harness.window.XYZBranchRouter.navigate('/basketbol/');
  harness.window.location.pathname = '/futbol';
  harness.window.location.href = 'https://xyzskor.test/futbol';
  let propagationStopped = false;
  harness.listeners.get('popstate')?.({ stopImmediatePropagation() { propagationStopped = true; } });
  check(
    () => assert.deepEqual(harness.reloads, ['https://xyzskor.test/futbol']),
    'Back ile kayitsiz managed futbol rotasina donus hedef belgeyi yeniden yukler.',
  );
  check(() => assert.equal(propagationStopped, true), 'Managed Back fallback eski popstate dinleyicilerinin state bozmasini engeller.');
  check(() => assert.equal(order.includes('basketbol-unmount'), false), 'Belge yuklenirken mevcut brans DOM uzerinde tutulur.');
}

console.log('\n=== 5d.3) Back, istemci branşından kayıtlı genel ana sayfaya döner ===');
{
  const harness = createRouterHarness();
  const order = [];
  harness.window.XYZBranchRouter.register({
    key: 'general-test',
    matches: (pathname) => pathname === '/',
    mount: () => order.push('general-mount'),
  });
  harness.window.XYZBranchRouter.register({
    key: 'multisport-test',
    matches: (pathname) => pathname === '/basketbol/',
    mount: () => order.push('basketbol-mount'),
    unmount: () => order.push('basketbol-unmount'),
  });
  await harness.window.XYZBranchRouter.navigate('/basketbol/');
  harness.window.location.pathname = '/';
  harness.window.location.href = 'https://xyzskor.test/';
  harness.listeners.get('popstate')?.({});
  check(
    () => assert.deepEqual(order, ['basketbol-mount', 'basketbol-unmount', 'general-mount']),
    'Back ile genel ana sayfaya donus multisport yuzeyini unmount edip genel yuzeyi mount eder.',
  );
  check(() => assert.deepEqual(harness.reloads, []), 'Kayitli genel ana sayfa Back gecisinde belge yenilenmez.');
}

console.log('\n=== 5d.4) Futbol popstate işleyicisi bağımsız branşları sahiplenmez ===');
{
  const parseSource = sourceBetween(liveSource, 'function parseAppLocation()', 'function updateHash');
  for (const pathname of ['/basketbol/', '/voleybol/', '/ufc/', '/motorsports/formula-1']) {
    const context = vm.createContext({
      location: { pathname, hash: '' },
      parseLegacyHash: () => null,
      SELECTED_COMPETITIONS: [],
      normalizeFootballSectionSegment: (value) => value || 'home',
      normalizeTransferRouteTab: (value) => value || 'confirmed',
      validFootballLeagueKey: (value) => value,
      decodeURIComponent,
    });
    vm.runInContext(parseSource, context, { filename: `parseAppLocation:${pathname}` });
    const parsed = context.parseAppLocation();
    check(() => assert.equal(parsed.type, 'branch-route'), `${pathname} futbol fallback'i yerine branch-route olarak ayrilir.`);
  }

  const applySource = sourceBetween(liveSource, 'async function applyParsedLocation(parsed)', "window.addEventListener('hashchange'");
  const calls = [];
  const applyContext = vm.createContext({
    mcMatchId: null,
    stopLiveFeed: () => calls.push('stop-live'),
    switchMainTab: () => calls.push('switch-football'),
    window: {},
  });
  vm.runInContext(applySource, applyContext, { filename: 'applyParsedLocation:branch-route' });
  await applyContext.applyParsedLocation({ type: 'branch-route', value: 'basketbol' });
  check(() => assert.deepEqual(calls, ['stop-live']), 'Branch popstate canli futbolu durdurur ancak futbol UI moduna gecmez.');
}

console.log('\n=== 5e) Futbolun kalıcı ve tembel GET akışları tek hook ile kapanır ===');
{
  const abortBlock = liveSource.slice(
    liveSource.indexOf('function abortFootballBranchWork'),
    liveSource.indexOf('/* ===================== MAIN TAB SWITCH'),
  );
  for (const owner of [
    'abortFootballLiveRequests',
    'abortFootballCriticalData',
    'abortFootballWeeklyFeatures',
    'abortFootballCoverage',
    'abortFootballUiRequests',
    'abortMatchCenterNetwork',
  ]) {
    check(() => assert.ok(abortBlock.includes(`${owner}(`)), `Merkezi futbol abort hook'u ${owner} sahibini kapatır.`);
  }
  check(
    () => assert.ok(/registerAbortHook\(abortFootballBranchWork\)/.test(liveSource)),
    'Merkezi futbol abort işi branch router\'a kaydedilir.',
  );
  check(
    () => assert.ok(/LIVE_MATCH_DETAIL_CONTROLLERS\.forEach\([\s\S]*LIVE_EXIT_VERIFICATION_CONTROLLERS\.forEach/.test(liveSource)),
    'Canlı olay/istatistik ve bitiş doğrulama GET istekleri birlikte abort edilir.',
  );
  check(
    () => assert.ok(/function abortFootballCoverage\([\s\S]*footballCoverageAbortController\?\.abort/.test(dataSource)),
    'Kapsam GET isteğinin controller sahibi ve abort yolu vardır.',
  );
  const uiAbortBlock = uiSource.slice(
    uiSource.indexOf('function abortFootballUiRequests'),
    uiSource.indexOf('function scheduleLeagueOverviewTransferFeed'),
  );
  for (const owner of [
    'clubProfileAbortController',
    'abortLeagueTransferRequestsExcept',
    'xClubPostsRequest',
    'preseasonPostsRequest',
    'youtubeMediaControllers',
    'instagramFeedAbortController',
    'footballLazyModuleObservers',
  ]) {
    check(() => assert.ok(uiAbortBlock.includes(owner)), `Futbol UI abort kapsamı ${owner} işini içerir.`);
  }
  check(
    () => assert.ok(/function abortMatchCenterNetwork\([\s\S]*mcProviderControllers\.forEach/.test(matchCenterSource)),
    'Eski maç merkezi yenilemesi ve sağlayıcı fixture GET isteği abort edilir.',
  );
  check(
    () => assert.ok(/registerAbortHook\(abortMatchdayBranchWork\)/.test(matchdaySource)
      && /ownPredictionControllers\.forEach/.test(matchdaySource)),
    'Matchday poll ve kullanıcı tahmini GET okuması branch geçişinde abort edilir.',
  );
  check(
    () => assert.equal(/method\s*:\s*['"]POST['"][^\n]*signal\s*:/.test(`${dataSource}\n${matchdaySource}`), false),
    'Kullanıcı tarafından başlatılan tahmin POST yazıları branch abort signal\'ına bağlanmaz.',
  );
}

console.log('\n=== 6) Genel ana sayfa iskeleti statik ve API sahibi değil ===');
{
  check(() => assert.ok(generalHomeSource, 'assets/js/general-home.js mevcut olmalı.'), 'Genel ana sayfa modülü mevcut.');
  check(
    () => assert.ok(/id="generalHome"/.test(indexHtml)),
    'index.html genel ana sayfa konteynerini barındırır.',
  );
  check(
    () => assert.equal(/fetch\(/.test(generalHomeSource), false),
    'Genel ana sayfa modülü kendi başına fetch yapmaz (statik branş kartları).',
  );
}

console.log('\n=== 7) Logo genel ana sayfaya, Futbol sekmesi /futbol\'a gider ===');
{
  check(
    () => assert.ok(/class="brand-lockup"\s+href="\/"/.test(indexHtml)),
    'Marka logosu genel ana sayfaya (`/`) gider.',
  );
  check(
    () => assert.ok(/\["football",\s*"Futbol",\s*"\/futbol\/"\]/.test(sportBranchesSource)),
    'Futbol branş girişi ayrı `/futbol/` rotasını gösterir.',
  );
}

if (failures.length) {
  console.error(`\n${failures.length} başarısız kontrol:`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('\nGenel ana sayfa ve branş router sözleşmesi doğrulandı.');
