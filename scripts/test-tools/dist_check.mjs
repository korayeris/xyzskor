import { launchChromium } from './lib/playwright-loader.mjs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Varsayılan olarak işletim sisteminden boş bir port al. CI veya yerel hata
// ayıklama gerektiğinde XYZSKOR_DIST_PORT ile sabit port seçilebilir.
const REQUESTED_DIST_PORT = Number(process.env.XYZSKOR_DIST_PORT || 0);
let BASE = 'http://127.0.0.1:0';
const DIST_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../dist/client');
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const LEAGUES = {
  'super-lig': { id: '600', label: 'Super Lig', teams: ['Galatasaray', 'Fenerbahce', 'Besiktas', 'Trabzonspor'] },
  'premier-league': { id: '8', label: 'Premier League', teams: ['Arsenal', 'Liverpool', 'Manchester City', 'Chelsea'] },
  'la-liga': { id: '564', label: 'La Liga', teams: ['Barcelona', 'Real Madrid', 'Atletico Madrid', 'Villarreal'] },
  bundesliga: { id: '82', label: 'Bundesliga', teams: ['Bayern Munchen', 'Borussia Dortmund', 'RB Leipzig', 'Bayer Leverkusen'] },
  'serie-a': { id: '384', label: 'Serie A', teams: ['Inter', 'Milan', 'Juventus', 'Napoli'] },
};
const REQUIRED_CANONICAL_FRAGMENT_IDS = [
  'accountOverlay', 'accountClose', 'authOverlay', 'authSubmit',
  'newsOverlay', 'newsDetailClose', 'mcOverlay', 'mcTabs',
  'mobileBottomNav', 'chatLauncher', 'chatPanel', 'chatRoomList',
];
const failures = [];
let assertions = 0;

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

async function resolveDistFile(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl || '/', BASE).pathname);
  const segments = pathname.split('/').filter(Boolean);
  if (segments.includes('..')) return null;
  let target = resolve(DIST_ROOT, ...segments);
  if (!target.toLowerCase().startsWith(DIST_ROOT.toLowerCase())) return null;
  let info = await stat(target).catch(() => null);
  if (info?.isDirectory()) {
    target = resolve(target, 'index.html');
    info = await stat(target).catch(() => null);
  } else if (!info && !extname(target)) {
    target = resolve(target, 'index.html');
    info = await stat(target).catch(() => null);
  }
  return info?.isFile() ? target : null;
}

async function startDistServer() {
  const entry = resolve(DIST_ROOT, 'index.html');
  if (!(await stat(entry).catch(() => null))?.isFile()) {
    throw new Error(`Production dist bulunamadi: ${entry}. Once npm run build calistirin.`);
  }
  const server = createServer(async (request, response) => {
    try {
      const file = await resolveDistFile(request.url);
      if (!file) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
        response.end('Not found');
        return;
      }
      const body = await readFile(file);
      response.writeHead(200, {
        'content-type': CONTENT_TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      response.end(String(error?.message || error));
    }
  });
  await new Promise((resolveListen, rejectListen) => {
    const onError = (error) => rejectListen(new Error(`Dist smoke portu ${REQUESTED_DIST_PORT || 'otomatik'} kullanilamiyor: ${error.message}`));
    server.once('error', onError);
    server.listen(REQUESTED_DIST_PORT, '127.0.0.1', () => {
      server.off('error', onError);
      const address = server.address();
      if (!address || typeof address === 'string') return rejectListen(new Error('Dist smoke dinleme adresi cozumlenemedi.'));
      BASE = `http://127.0.0.1:${address.port}`;
      resolveListen();
    });
  });
  return server;
}

async function stopDistServer(server) {
  if (!server?.listening) return;
  await new Promise((resolveClose, rejectClose) => {
    server.close((error) => error ? rejectClose(error) : resolveClose());
    server.closeAllConnections?.();
  });
}

function check(condition, label, detail = '') {
  assertions += 1;
  if (condition) {
    console.log(`  OK   ${label}`);
    return;
  }
  const message = `${label}${detail ? ` -> ${detail}` : ''}`;
  failures.push(message);
  console.error(`  FAIL ${message}`);
}

function leagueFrom(url, fallback = 'super-lig') {
  const requested = new URL(url).searchParams.get('league') || fallback;
  return Object.hasOwn(LEAGUES, requested) ? requested : fallback;
}

function seasonPayload(league = 'super-lig') {
  const scope = LEAGUES[league] || LEAGUES['super-lig'];
  const now = Date.now();
  const matches = [
    {
      id: `sportmonks:${scope.id}01`, provider_fixture_id: `${scope.id}01`,
      league_key: league, provider_league_id: scope.id, competition: scope.label,
      ev: scope.teams[0], konuk: scope.teams[1], home_name: scope.teams[0], away_name: scope.teams[1],
      kickoff: new Date(now + 3_600_000).toISOString(), status: 'scheduled', verified: true,
    },
    {
      id: `sportmonks:${scope.id}02`, provider_fixture_id: `${scope.id}02`,
      league_key: league, provider_league_id: scope.id, competition: scope.label,
      ev: scope.teams[2], konuk: scope.teams[3], home_name: scope.teams[2], away_name: scope.teams[3],
      kickoff: new Date(now + 86_400_000).toISOString(), status: 'scheduled', verified: true,
    },
  ];
  const standings = scope.teams.map((team, index) => ({
    team, played: 4, won: Math.max(0, 4 - index), drawn: index ? 1 : 0, lost: index,
    goals_for: 10 - index, goals_against: 2 + index, goal_difference: 8 - (index * 2),
    points: 12 - (index * 2), form: index % 2 ? 'WDWW' : 'WWWW',
    league_key: league, provider_league_id: scope.id, competition: scope.label,
  }));
  return {
    source: 'sportmonks-football-api-v3', provider: 'sportmonks', league,
    leagueId: scope.id, seasonId: '2026', seasonName: '2026/2027', competition: scope.label,
    updatedAt: new Date(now).toISOString(), matches, standings, results: [], errors: [],
    coverage: { fixtures: matches.length, standings: standings.length, results: 0 },
  };
}

function homePayload() {
  const bundles = Object.keys(LEAGUES).map(seasonPayload);
  return {
    version: 1, league: 'all', source: 'sportmonks-football-home', updatedAt: new Date().toISOString(),
    matches: bundles.flatMap((bundle) => bundle.matches), results: [], standings: [],
    standingsByLeague: Object.fromEntries(bundles.map((bundle) => [bundle.league, bundle.standings])),
    availability: Object.fromEntries(bundles.map((bundle) => [bundle.league, true])), errors: [],
  };
}

function matchdayPayload(url) {
  const fixtureId = new URL(url).searchParams.get('fixture') || '60001';
  const fixture = {
    ...seasonPayload('super-lig').matches[0],
    id: `sportmonks:${fixtureId}`,
    provider_fixture_id: fixtureId,
    score: { home: null, away: null },
  };
  return {
    source: 'sportmonks', provider: 'sportmonks', updatedAt: new Date().toISOString(),
    nextRefreshInSeconds: 300, degraded: false, fixture,
    details: { events: [], statistics: [], lineups: [], formations: [], xg: [], predictions: [], teamContexts: [] },
  };
}

function apiPayload(url, method) {
  const parsed = new URL(url);
  const path = parsed.pathname;
  if (path === '/api/football/home') return [homePayload(), 200];
  if (path === '/api/football/season') return [seasonPayload(leagueFrom(url)), 200];
  if (path === '/api/football/live' || path === '/api/football') {
    return [{ source: 'sportmonks', league: parsed.searchParams.get('league') || 'all', updatedAt: new Date().toISOString(), matches: [], coverage: {}, degraded: false }, 200];
  }
  if (path === '/api/football/matchday') return [matchdayPayload(url), 200];
  if (path === '/api/football/coverage') {
    return [{
      source: 'sportmonks', updatedAt: new Date().toISOString(),
      selected: Object.entries(LEAGUES).map(([league, item]) => ({
        league, leagueId: item.id, name: item.label, available: true,
        metadataAvailable: true, currentSeasonId: '2026', capabilities: {},
      })),
    }, 200];
  }
  if (path === '/api/football/fixture') return [matchdayPayload(`${BASE}/api/football/matchday?fixture=${parsed.searchParams.get('id') || '60001'}`), 200];
  if (/^\/api\/football\/matches\/[^/]+\/events$/.test(path)) return [{ events: [] }, 200];
  if (/^\/api\/football\/matches\/[^/]+\/statistics$/.test(path)) return [{ statistics: [] }, 200];
  if (path === '/api/football/transfers') return [{ source: 'sportmonks', league: leagueFrom(url), updatedAt: new Date().toISOString(), confirmed: [], rumours: [], errors: [] }, 200];
  if (path === '/api/football/x-media' || path === '/api/football/x-preseason') return [{ source: 'mock', league: leagueFrom(url), updated_at: new Date().toISOString(), status: 'ok', clubs: [], publishers: [], errors: [] }, 200];
  if (path === '/api/media/youtube') return [{ source: 'mock', league: leagueFrom(url), updated_at: new Date().toISOString(), channels: [], items: [] }, 200];
  if (path.startsWith('/api/social/')) return [{ source: 'mock', league: leagueFrom(url), updated_at: new Date().toISOString(), clubs: [], publishers: [], items: [] }, 200];
  if (path === '/api/health') return [{ status: 'ok', checks: { sportmonks: { ok: true } } }, 200];
  if (path === '/api/analytics/event') return [{ ok: true }, 200];
  if (path === '/api/football/prediction') return [{ prediction: null, authenticated: false }, 200];
  if (path.startsWith('/api/predict-game/')) return [{ authenticated: false, reward_eligible: false }, 200];
  return [{ ok: true, method, data: [] }, 200];
}

async function installNetworkHarness(context, requestLog) {
  // Account and chat smoke must not depend on a third-party CDN. The stub keeps
  // the same chainable surface and represents a healthy signed-out session.
  await context.addInitScript(() => {
    const queryResult = { data: [], error: null, count: 0 };
    const builder = new Proxy(function () {}, {
      get(_target, property) {
        if (property === 'then') return (resolve, reject) => Promise.resolve(queryResult).then(resolve, reject);
        if (property === 'catch') return (reject) => Promise.resolve(queryResult).catch(reject);
        if (property === 'finally') return (callback) => Promise.resolve(queryResult).finally(callback);
        return builder;
      },
      apply() { return builder; },
    });
    const auth = {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signUp: async () => ({ data: { user: null, session: null }, error: null }),
      resend: async () => ({ data: {}, error: null }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    };
    const createClient = () => ({
      from: () => builder, rpc: () => builder, auth,
      channel() { return { on() { return this; }, subscribe() { return this; }, unsubscribe: async () => 'ok', send: async () => 'ok' }; },
      removeChannel: async () => 'ok', functions: { invoke: async () => ({ data: null, error: null }) },
    });
    window.supabase = { createClient };
  });

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === BASE && url.pathname.startsWith('/api/')) {
      requestLog.push({ url: url.pathname + url.search, method: request.method() });
      const [payload, status] = apiPayload(request.url(), request.method());
      await route.fulfill({ status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(payload) });
      return;
    }
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      if (url.origin !== BASE) {
        await route.fulfill({ status: 204 });
        return;
      }
    }
    await route.continue();
  });
}

function watchErrors(page, scenario, target) {
  page.on('pageerror', (error) => target.push(`${scenario} pageerror: ${String(error).slice(0, 300)}`));
  page.on('console', (message) => {
    if (message.type() === 'error') target.push(`${scenario} console: ${message.text().slice(0, 300)}`);
  });
}

async function waitForAppBoot(page) {
  await page.waitForFunction(() => window.__XYZ_APP_BOOT_READY__ === true, null, { timeout: 15_000 });
}

async function canonicalFragmentState(page) {
  return page.evaluate((ids) => ({
    marker: window.__XYZ_CANONICAL_FRAGMENTS_READY__ === true,
    missing: ids.filter((id) => !document.getElementById(id)),
  }), REQUIRED_CANONICAL_FRAGMENT_IDS);
}

// `/` genel çok sporlu ana sayfadır ve hiçbir spor API'sini çağırmaz.
// Futbol beş lig merkezi `/futbol/` altındadır.
async function smokeGeneralHome(context, viewportName, requestLog, runtimeErrors) {
  const scenario = `${viewportName} general home`;
  const page = await context.newPage();
  const productRouteRequests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin === BASE && /^\/(?:futbol|predict)(?:\/|$)/.test(url.pathname)) {
      productRouteRequests.push({ path:url.pathname, navigation:request.isNavigationRequest() });
    }
  });
  watchErrors(page, scenario, runtimeErrors);
  const requestStart = requestLog.length;
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#generalHome .gh-card', { state: 'visible', timeout: 12_000 });
  await waitForAppBoot(page);
  const state = await page.evaluate(() => ({
    generalRoute: document.body.classList.contains('general-home-route'),
    cards: document.querySelectorAll('#generalHome [data-branch-link]').length,
    footballCard: Boolean(document.querySelector('#generalHome [data-branch-link="football"]')),
    footballSurfaceVisible: Boolean(document.querySelector('#footballScoreboardHome')?.offsetParent),
    chatLauncherVisible: Boolean(document.querySelector('#chatLauncher')?.offsetParent),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }));
  check(state.generalRoute && state.cards >= 5 && state.footballCard, `${scenario}: static multi-sport branch cards render`, JSON.stringify(state));
  check(!state.footballSurfaceVisible, `${scenario}: football surface is not visible on the general shell`);
  check(!state.chatLauncherVisible, `${scenario}: chat launcher stays clear of general-home branch cards`);
  check(!state.overflow, `${scenario}: no horizontal overflow`);

  // En kritik sözleşme: genel ana sayfa açılışı sıfır spor API isteği yapar.
  const sportRequests = requestLog.slice(requestStart).filter((item) => (
    /^\/api\/(football|sports|ufc|motorsports)/.test(item.url)
  ));
  check(sportRequests.length === 0, `${scenario}: zero sport API requests on first paint`, sportRequests.map((item) => item.url).join(', '));

  const landingResources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => ({
    path:new URL(entry.name, location.href).pathname,
    sameOrigin:new URL(entry.name, location.href).origin === location.origin,
    bytes:entry.transferSize || entry.encodedBodySize || 0,
  })));
  const forbiddenLandingResources = landingResources.filter((entry) => (
    /\/assets\/(?:fragments\/|js\/(?:data|analytics|live|match-center|matchday-live|predict-game|ui(?:-stage|-runtime)?|chat|multisport|sport-branches|motorsports|ufc-hub)\.js)/.test(entry.path)
  ));
  check(
    forbiddenLandingResources.length === 0,
    `${scenario}: landing fast path skips football core and late fragments`,
    forbiddenLandingResources.map((entry) => entry.path).join(', '),
  );
  const landingBytes = landingResources.filter((entry) => entry.sameOrigin).reduce((sum, entry) => sum + entry.bytes, 0);
  check(landingBytes <= 150_000, `${scenario}: same-origin landing transfer stays within 150 KB`, `${landingBytes} bytes`);

  // Genel ana sayfadan basketbola geçiş belge yenilemeden yapılır ve yalnız
  // aktif branşın API ailesi çağrılır.
  const token = `${viewportName}-gh-token`;
  await page.evaluate((value) => { window.__XYZ_DIST_DOCUMENT_TOKEN__ = value; }, token);
  const branchStart = requestLog.length;
  await page.click('#generalHome [data-branch-link="basketball"]');
  await page.waitForFunction(() => location.pathname.replace(/\/+$/, '') === '/basketbol', null, { timeout: 12_000 });
  const branchState = await page.evaluate((value) => ({
    path: location.pathname.replace(/\/+$/, ''),
    sameDocument: window.__XYZ_DIST_DOCUMENT_TOKEN__ === value,
    generalHidden: Boolean(document.getElementById('generalHome')?.hidden),
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content || '',
    canonical: document.querySelector('link[rel="canonical"]')?.href || '',
    ogUrl: document.querySelector('meta[property="og:url"]')?.content || '',
    ogTitle: document.querySelector('meta[property="og:title"]')?.content || '',
    ogDescription: document.querySelector('meta[property="og:description"]')?.content || '',
    twitterTitle: document.querySelector('meta[name="twitter:title"]')?.content || '',
    twitterDescription: document.querySelector('meta[name="twitter:description"]')?.content || '',
    legacyStylesReady: Boolean(document.getElementById('xyzLegacyStylesheet'))
      && !document.documentElement.classList.contains('xyz-branch-css-pending'),
  }), token);
  check(
    branchState.path === '/basketbol' && branchState.sameDocument && branchState.generalHidden,
    `${scenario}: branch transition is client-side (no document reload)`,
    JSON.stringify(branchState),
  );
  check(branchState.title === 'Basketbol — XYZSKOR' && /Basketbol/.test(branchState.description), `${scenario}: client branch metadata follows Basketbol route`, JSON.stringify(branchState));
  check(
    branchState.canonical === `${BASE}/basketbol/`
      && branchState.ogUrl === branchState.canonical
      && branchState.ogTitle === branchState.title
      && branchState.ogDescription === branchState.description
      && branchState.twitterTitle === branchState.title
      && branchState.twitterDescription === branchState.description,
    `${scenario}: client branch canonical and social metadata stay synchronized`,
    JSON.stringify(branchState),
  );
  check(branchState.legacyStylesReady, `${scenario}: branch CSS is ready before the client surface is committed`, JSON.stringify(branchState));
  const branchRequests = requestLog.slice(branchStart).filter((item) => /^\/api\/(football|ufc|motorsports)/.test(item.url));
  check(branchRequests.length === 0, `${scenario}: branch transition leaks no other sport API family`, branchRequests.map((item) => item.url).join(', '));

  // Predict branch handler must own the click. The old handler forwarded the
  // click to the hidden header, which first started /futbol and then /predict.
  await page.waitForFunction(() => window.__XYZ_SPORT_BRANCHES_READY__ === true, null, { timeout:15_000 });
  await page.waitForSelector('.sport-predict-button', { state:'visible', timeout:8_000 });
  const productRequestStart = productRouteRequests.length;
  await Promise.all([
    page.waitForURL((url) => url.pathname.replace(/\/+$/, '') === '/predict', { waitUntil:'domcontentloaded', timeout:12_000 }),
    page.click('.sport-predict-button'),
  ]);
  await waitForAppBoot(page);
  const predictState = await page.evaluate(() => ({
    path:location.pathname.replace(/\/+$/,''),
    title:document.title,
    description:document.querySelector('meta[name="description"]')?.content || '',
  }));
  const productRequests = productRouteRequests.slice(productRequestStart);
  check(productRequests.every((item) => !item.path.startsWith('/futbol')), `${scenario}: Basketbol Predict transition never requests intermediate /futbol`, JSON.stringify(productRequests));
  check(productRequests.filter((item) => item.navigation).length === 1, `${scenario}: Basketbol Predict transition commits one target document`, JSON.stringify(productRequests));
  check(predictState.path === '/predict' && predictState.title === 'Predict — XYZSKOR' && /ücretsiz maç tahminleri/.test(predictState.description), `${scenario}: Predict route metadata is current`, JSON.stringify(predictState));
  await page.close();
}

async function smokeRoot(context, viewportName, requestLog, runtimeErrors) {
  const scenario = `${viewportName} root`;
  const page = await context.newPage();
  watchErrors(page, scenario, runtimeErrors);
  const requestStart = requestLog.length;
  await page.goto(`${BASE}/futbol/`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => (
      document.querySelectorAll('#footballScoreboardHome .scoreboard-league-group').length === 5
      && document.querySelectorAll('#footballScoreboardHome .scoreboard-match-row').length >= 5
    ), null, { timeout: 12_000 });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      path:location.pathname,
      earlyMarker:window.__XYZ_EARLY_HOME_RENDERED__,
      homeRequest:Boolean(window.__XYZ_FOOTBALL_HOME_REQUEST__),
      hubReady:Boolean(window.__XYZ_FOOTBALL_HUB_READY__),
      rootClass:document.body.className,
      rootExists:Boolean(document.getElementById('footballScoreboardHome')),
      hydrated:document.getElementById('footballScoreboardHome')?.dataset.earlyHydrated || '',
      fullHydrated:document.getElementById('footballScoreboardHome')?.dataset.fullHomeHydrated || '',
      groups:document.querySelectorAll('#footballScoreboardHome .scoreboard-league-group').length,
      matches:document.querySelectorAll('#footballScoreboardHome .scoreboard-match-row').length,
      text:document.getElementById('footballScoreboardHome')?.textContent?.slice(0,160) || '',
    }));
    throw new Error(`${scenario}: early root timeout ${JSON.stringify(diagnostic)}`, { cause:error });
  }
  await waitForAppBoot(page);
  const fragments = await canonicalFragmentState(page);
  const state = await page.evaluate(() => {
    const railSelectors = ['.sport-branch-main', '.agenda-track', '.scoreboard-filters', '.scoreboard-leagues nav'];
    const rails = railSelectors.map((selector) => document.querySelector(selector)).filter(Boolean);
    const overflowingRail = rails.find((rail) => rail.scrollWidth > rail.clientWidth + 1) || null;
    let railStillScrolls = true;
    if (overflowingRail) {
      const previous = overflowingRail.scrollLeft;
      overflowingRail.scrollLeft = overflowingRail.scrollWidth;
      railStillScrolls = overflowingRail.scrollLeft > previous;
      overflowingRail.scrollLeft = previous;
    }
    return {
      rootRoute: document.body.classList.contains('football-root-route'),
      earlyReady: document.getElementById('footballScoreboardHome')?.dataset.earlyHydrated === 'true',
      fullReady: document.getElementById('footballScoreboardHome')?.dataset.fullHomeHydrated === 'true',
      groups: document.querySelectorAll('#footballScoreboardHome .scoreboard-league-group').length,
      matches: document.querySelectorAll('#footballScoreboardHome .scoreboard-match-row').length,
      legacyPredictDom: Boolean(document.getElementById('page-league')),
      matchdayCommand: Boolean(document.getElementById('matchdayCommand')),
      viewportGrid: getComputedStyle(document.body, '::before').backgroundImage,
      horizontalScrollbarChromeHidden: rails.every((rail) => getComputedStyle(rail).scrollbarWidth === 'none'),
      railStillScrolls,
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || '',
    };
  });
  const homeRequests = requestLog.slice(requestStart).filter((item) => item.url === '/api/football/home');
  check(state.rootRoute && state.groups === 5 && state.matches >= 5, `${scenario}: early/canonical football shell ready`, JSON.stringify(state));
  check(homeRequests.length >= 1, `${scenario}: canonical aggregate request observed`, `requests=${homeRequests.length}`);
  check(state.groups === 5, `${scenario}: aggregate home contains five league groups`, `groups=${state.groups}`);
  check(!state.legacyPredictDom, `${scenario}: lean root omits same-DOM Predict surface`);
  check(!state.matchdayCommand, `${scenario}: fixture-less root omits matchday command`);
  check(state.viewportGrid === 'none', `${scenario}: global decorative viewport grid is absent`);
  check(state.horizontalScrollbarChromeHidden, `${scenario}: horizontal control rails hide native scrollbar chrome`);
  check(state.railStillScrolls, `${scenario}: hidden scrollbar chrome does not disable horizontal scrolling`);
  check(state.title === 'Futbol · 5 Lig — XYZSKOR' && /Süper Lig/.test(state.description), `${scenario}: football root metadata is current`, JSON.stringify(state));
  check(fragments.marker && fragments.missing.length === 0, `${scenario}: canonical fragments restored`, fragments.missing.join(', '));

  await page.waitForSelector('#accountBtn', { state: 'visible', timeout: 8_000 });
  await page.click('#accountBtn');
  await page.waitForFunction(() => document.getElementById('accountOverlay')?.classList.contains('show'));
  const accountOpened = await page.getAttribute('#accountOverlay', 'aria-hidden');
  await page.click('#accountClose');
  await page.waitForFunction(() => !document.getElementById('accountOverlay')?.classList.contains('show'));
  const accountClosed = await page.getAttribute('#accountOverlay', 'aria-hidden');
  check(accountOpened === 'false' && accountClosed === 'true', `${scenario}: account opens and closes`);

  await page.waitForFunction(() => window.__XYZ_CHAT_READY__ === true, null, { timeout: 15_000 });
  await page.click('#chatLauncher');
  await page.waitForFunction(() => document.getElementById('chatPanel')?.classList.contains('open'));
  const chatOpened = await page.getAttribute('#chatPanel', 'aria-hidden');
  await page.click('#chatCloseBtn');
  await page.waitForFunction(() => !document.getElementById('chatPanel')?.classList.contains('open'));
  const chatClosed = await page.getAttribute('#chatPanel', 'aria-hidden');
  check(chatOpened === 'false' && chatClosed === 'true', `${scenario}: chat opens and closes after module readiness`);

  const token = `${viewportName}-${Date.now()}-${Math.random()}`;
  await page.evaluate((value) => { window.__XYZ_DIST_DOCUMENT_TOKEN__ = value; }, token);
  await page.waitForFunction(() => window.__XYZ_SPORT_BRANCHES_READY__ === true, null, { timeout: 15_000 });
  await page.waitForSelector('.sport-predict-button', { state:'visible', timeout:8_000 });
  await Promise.all([
    page.waitForURL((url) => url.pathname.replace(/\/+$/, '') === '/predict', { waitUntil: 'domcontentloaded', timeout: 12_000 }),
    page.click('.sport-predict-button'),
  ]);
  const predictState = await page.evaluate((value) => ({
    path: location.pathname.replace(/\/+$/, ''),
    sameDocument: window.__XYZ_DIST_DOCUMENT_TOKEN__ === value,
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content || '',
  }), token);
  check(predictState.path === '/predict' && !predictState.sameDocument, `${scenario}: Predict performs a document navigation`, JSON.stringify(predictState));
  check(predictState.title === 'Predict — XYZSKOR' && /ücretsiz maç tahminleri/.test(predictState.description), `${scenario}: Predict document metadata is current`, JSON.stringify(predictState));

  // `/futbol -> Predict -> Futbol` must return through exactly one managed
  // document commit. The Predict document intentionally has no hydrated
  // football dataset to reuse as an in-document surface.
  await waitForAppBoot(page);
  await page.waitForFunction(() => window.__XYZ_SPORT_BRANCHES_READY__ === true, null, { timeout:15_000 });
  await page.waitForSelector('.sport-branch-button[data-branch="football"]', { state:'visible', timeout:8_000 });
  const returnNavigations = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin === BASE && request.isNavigationRequest()) returnNavigations.push(url.pathname);
  });
  const predictToken = `${token}-predict`;
  await page.evaluate((value) => { window.__XYZ_PREDICT_DOCUMENT_TOKEN__ = value; }, predictToken);
  await Promise.all([
    page.waitForURL((url) => url.pathname.replace(/\/+$/, '') === '/futbol', { waitUntil:'domcontentloaded', timeout:12_000 }),
    page.click('.sport-branch-button[data-branch="football"]'),
  ]);
  const footballReturn = await page.evaluate((value) => ({
    path:location.pathname.replace(/\/+$/,''),
    sameDocument:window.__XYZ_PREDICT_DOCUMENT_TOKEN__===value,
    title:document.title,
    description:document.querySelector('meta[name="description"]')?.content || '',
  }), predictToken);
  check(returnNavigations.length === 1 && returnNavigations[0].replace(/\/+$/,'') === '/futbol', `${scenario}: Predict -> Futbol performs one /futbol document commit`, JSON.stringify(returnNavigations));
  check(footballReturn.path === '/futbol' && !footballReturn.sameDocument && footballReturn.title === 'Futbol · 5 Lig — XYZSKOR' && /Premier League/.test(footballReturn.description), `${scenario}: Football return route and metadata are canonical`, JSON.stringify(footballReturn));

  const fixturelessRequests = requestLog.slice(requestStart).filter((item) => item.url.startsWith('/api/football/matchday'));
  check(fixturelessRequests.length === 0, `${scenario}: no matchday request without fixture`, fixturelessRequests.map((item) => item.url).join(', '));
  await page.close();
}

async function smokeLeague(context, viewportName, requestLog, runtimeErrors) {
  const scenario = `${viewportName} /super-lig`;
  const page = await context.newPage();
  watchErrors(page, scenario, runtimeErrors);
  const requestStart = requestLog.length;
  await page.goto(`${BASE}/super-lig`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (
    document.querySelectorAll('#footballLeagueOverview [data-league-overview-team]').length > 0
    && document.querySelectorAll('#footballLeagueOverview [data-league-overview-match]').length > 0
  ), null, { timeout: 12_000 });
  await waitForAppBoot(page);
  const state = await page.evaluate(() => ({
    mode: document.body.classList.contains('football-league-overview-mode'),
    league: document.body.dataset.footballLeague || document.body.dataset.footballLeagueLoading || '',
    heading: document.querySelector('#footballLeagueOverview h1')?.textContent?.trim() || '',
    tableRows: document.querySelectorAll('#footballLeagueOverview [data-league-overview-team]').length,
    fixtures: document.querySelectorAll('#footballLeagueOverview [data-league-overview-match]').length,
    matchdayCommand: Boolean(document.getElementById('matchdayCommand')),
  }));
  check(state.mode && state.tableRows > 0 && state.fixtures > 0, `${scenario}: populated league shell`, JSON.stringify(state));
  check(!state.matchdayCommand, `${scenario}: fixture-less league omits matchday command`);
  const fixturelessRequests = requestLog.slice(requestStart).filter((item) => item.url.startsWith('/api/football/matchday'));
  check(fixturelessRequests.length === 0, `${scenario}: no matchday request without fixture`, fixturelessRequests.map((item) => item.url).join(', '));
  await page.close();
}

async function smokeExplicitFixture(context, viewportName, requestLog, runtimeErrors) {
  const scenario = `${viewportName} explicit fixture`;
  const page = await context.newPage();
  watchErrors(page, scenario, runtimeErrors);
  const requestStart = requestLog.length;
  await page.goto(`${BASE}/?fixture=60001`, { waitUntil: 'domcontentloaded' });
  await waitForAppBoot(page);
  await page.waitForFunction(() => (
    document.getElementById('matchdayCommand')
    && document.getElementById('matchdayLiveRoot')
    && document.body.classList.contains('matchday-detail-open')
  ), null, { timeout: 12_000 });
  const state = await page.evaluate(() => ({
    command: Boolean(document.getElementById('matchdayCommand')),
    liveRoot: Boolean(document.getElementById('matchdayLiveRoot')),
    title: document.getElementById('matchdayTitle')?.textContent?.trim() || '',
  }));
  check(state.command && state.liveRoot, `${scenario}: matchday fragment command exists`, JSON.stringify(state));
  const matchdayRequests = requestLog.slice(requestStart).filter((item) => item.url.startsWith('/api/football/matchday'));
  check(matchdayRequests.some((item) => item.url.includes('fixture=60001')), `${scenario}: fixture-scoped matchday request issued`, matchdayRequests.map((item) => item.url).join(', '));
  await page.close();
}

const distServer = await startDistServer();
let browser = null;
try {
  browser = await launchChromium();
  for (const viewport of VIEWPORTS) {
    console.log(`\n=== PRODUCTION DIST SMOKE - ${viewport.name} ===`);
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const requestLog = [];
    const runtimeErrors = [];
    await installNetworkHarness(context, requestLog);
    try {
      await smokeGeneralHome(context, viewport.name, requestLog, runtimeErrors);
      await smokeRoot(context, viewport.name, requestLog, runtimeErrors);
      await smokeLeague(context, viewport.name, requestLog, runtimeErrors);
      await smokeExplicitFixture(context, viewport.name, requestLog, runtimeErrors);
      check(runtimeErrors.length === 0, `${viewport.name}: no page or console errors`, runtimeErrors.join(' | '));
    } finally {
      await context.close();
    }
  }
} finally {
  if (browser) await browser.close();
  await stopDistServer(distServer);
}

if (failures.length) {
  throw new Error(`Production dist smoke failed (${failures.length}/${assertions}):\n- ${failures.join('\n- ')}`);
}
console.log(`\nProduction dist smoke passed: ${assertions} assertions.`);
