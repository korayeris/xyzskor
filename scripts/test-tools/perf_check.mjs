// Deterministic mobile release performance gate.
//
// The harness owns its dev-server and API fixtures, uses a fresh browser
// context for every run, and measures the three user-visible football surfaces:
//   1. `/` five-league populated scoreboard
//   2. `/` -> `/premier-league` populated league overview transition
//   3. direct cold `/super-lig` populated league overview
//
// Usage: node scripts/test-tools/perf_check.mjs
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { launchChromium } from './lib/playwright-loader.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT_DIR = new URL('../../reports/performance/', import.meta.url);
const REPORT_FILE = new URL('release-performance-report.json', OUT_DIR);
const VIEWPORT = { width: 390, height: 844 };
const COLD_RUNS = Math.max(3, Number(process.env.XYZSKOR_PERF_RUNS || 3));
const CPU_THROTTLE = 4;
const FAST_3G = {
  latencyMs: 150,
  downloadBitsPerSecond: 1_600_000,
  uploadBitsPerSecond: 750_000,
};
const BUDGETS = Object.freeze({
  medianFirstContentfulPaintMs: 1000,
  medianPopulatedScoreboardMs: 2500,
  medianPremierLeagueTransitionMs: 1500,
  medianDirectSuperLigShellMs: 1000,
  medianDirectSuperLigPopulatedOverviewMs: 2500,
  maximumLongTaskMs: 250,
  duplicateApiRequests: 0,
  consoleErrors: 0,
  pageErrors: 0,
});

const CRITICAL_RESOURCE_PATHS = Object.freeze([
  '/assets/css/football-hub.css',
  '/assets/js/style-loader.js',
  '/assets/js/initial-route.js',
  '/assets/js/football-early.js',
  '/assets/js/data.js',
  '/assets/js/analytics.js',
  '/assets/js/live.js',
  '/assets/js/match-center.js',
  '/assets/js/matchday-live.js',
  '/assets/js/predict-game.js',
  '/assets/js/ui.js',
  '/assets/js/ui-stage.js',
  '/assets/js/ui-runtime.js',
  '/assets/js/app-boot.js',
  '/assets/js/ui-extras.js',
  '/assets/fragments/account-auth.html',
  '/assets/fragments/news-match.html',
  '/assets/fragments/mobile.html',
  '/assets/fragments/chat.html',
]);
// app.css is intentionally deferred on canonical football routes. Track it for
// diagnostics, but do not make the early canonical resource-coverage gate wait
// for it; football-hub.css owns that visible first-paint contract.
const DEFERRED_DIAGNOSTIC_RESOURCE_PATHS = Object.freeze([
  '/assets/css/app.css',
]);
const TRACKED_RESOURCE_PATHS = Object.freeze([
  ...CRITICAL_RESOURCE_PATHS,
  ...DEFERRED_DIAGNOSTIC_RESOURCE_PATHS,
]);
const TRACKED_RESOURCE_PATTERN = String.raw`^/(?:assets/css/(?:app|football-hub)\.css|assets/js/(?:style-loader|initial-route|football-early|data|analytics|live|match-center|matchday-live|predict-game|ui|ui-stage|ui-runtime|app-boot|ui-extras)\.js|assets/fragments/(?:account-auth|news-match|mobile|chat)\.html)$`;

const LEAGUES = Object.freeze({
  'super-lig': { id: '600', label: 'Süper Lig', teams: ['Galatasaray', 'Fenerbahçe', 'Beşiktaş', 'Trabzonspor'] },
  'premier-league': { id: '8', label: 'Premier League', teams: ['Arsenal', 'Liverpool', 'Manchester City', 'Chelsea'] },
  'la-liga': { id: '564', label: 'La Liga', teams: ['Barcelona', 'Real Madrid', 'Atlético Madrid', 'Villarreal'] },
  bundesliga: { id: '82', label: 'Bundesliga', teams: ['Bayern München', 'Borussia Dortmund', 'RB Leipzig', 'Bayer Leverkusen'] },
  'serie-a': { id: '384', label: 'Serie A', teams: ['Inter', 'Milan', 'Juventus', 'Napoli'] },
});

const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function median(values) {
  const rows = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!rows.length) return null;
  const middle = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[middle] : Math.round((rows[middle - 1] + rows[middle]) / 2);
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value) : null;
}

function summarizeLongTasks(tasks) {
  return {
    count: tasks.length,
    totalDurationMs: tasks.reduce((sum, task) => sum + task.duration, 0),
    maximumDurationMs: tasks.length ? Math.max(...tasks.map((task) => task.duration)) : 0,
    entries: tasks,
  };
}

function apiKey(method, path) {
  return `${method.toUpperCase()} ${path}`;
}

function requestSummary(requests) {
  const counts = {};
  const phaseCounts = { root: {}, transition: {} };
  for (const request of requests) {
    const key = apiKey(request.method, request.path);
    counts[key] = (counts[key] || 0) + 1;
    const phase = phaseCounts[request.phase] || (phaseCounts[request.phase] = {});
    phase[key] = (phase[key] || 0) + 1;
  }
  const duplicates = Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));
  return { total: requests.length, counts, phaseCounts, duplicates, requests };
}

function criticalRequestViolations(summary) {
  const root = summary.phaseCounts.root || {};
  const transition = summary.phaseCounts.transition || {};
  const checks = [
    ['root home', root['GET /api/football/home'] || 0, 1],
    ['root live all', root['GET /api/football/live?league=all'] || 0, 1],
    // Canonical football pages no longer mount the legacy live-provider panel;
    // an extra health request on the critical path would be pure overhead.
    ['root health', root['GET /api/health'] || 0, 0],
    ['root season', Object.entries(root).filter(([key]) => key.startsWith('GET /api/football/season')).reduce((sum, [, count]) => sum + count, 0), 0],
    ['transition home', transition['GET /api/football/home'] || 0, 0],
    ['transition Premier League season', transition['GET /api/football/season?league=premier-league'] || 0, 1],
    ['transition Premier League live', transition['GET /api/football/live?league=premier-league'] || 0, 1],
  ];
  return checks
    .filter(([, actual, expected]) => actual !== expected)
    .map(([label, actual, expected]) => ({ label, actual, expected }));
}

function standingsFor(league) {
  const scoped = LEAGUES[league];
  return scoped.teams.map((team, index) => ({
    team,
    played: 8,
    won: 7 - index,
    drawn: index % 2,
    lost: index,
    goals_for: 20 - index * 2,
    goals_against: 5 + index,
    goal_difference: 15 - index * 3,
    points: 22 - index * 3,
    form: index % 2 ? 'WDWWW' : 'WWDWW',
    competition: scoped.label,
    provider_league_id: scoped.id,
    season_name: '2026/2027',
  }));
}

function seasonFor(league, now = Date.now()) {
  const scoped = LEAGUES[league] || LEAGUES['super-lig'];
  const [first, second, third, fourth] = scoped.teams;
  const make = (suffix, home, away, kickoffOffset, extra = {}) => ({
    id: `sportmonks:${scoped.id}${suffix}`,
    provider_fixture_id: `${scoped.id}${suffix}`,
    hafta: 9,
    ev: home,
    konuk: away,
    kickoff: new Date(now + kickoffOffset).toISOString(),
    status: 'scheduled',
    verified: true,
    competition: scoped.label,
    league_key: league,
    provider_league_id: scoped.id,
    season_name: '2026/2027',
    ...extra,
  });
  const finished = make('01', first, second, -86_400_000, {
    status: 'finished',
    result: { home: 2, away: 1 },
  });
  const upcoming = make('02', third, fourth, 86_400_000);
  const later = make('03', second, third, 172_800_000);
  return {
    source: 'sportmonks-football-api-v3',
    provider: 'sportmonks',
    league,
    leagueId: scoped.id,
    seasonId: `season-${scoped.id}`,
    competition: scoped.label,
    updatedAt: new Date(now).toISOString(),
    matches: [finished, upcoming, later],
    results: [{ match_id: finished.id, home: 2, away: 1, scored_at: new Date(now - 86_000_000).toISOString() }],
    standings: standingsFor(league),
    coverage: { fixtures: 3, results: 1, standings: scoped.teams.length },
    errors: [],
  };
}

function footballHome(now = Date.now()) {
  const bundles = Object.keys(LEAGUES).map((league) => seasonFor(league, now));
  return {
    version: 1,
    source: 'sportmonks-football-home-cache',
    league: 'all',
    updatedAt: new Date(now).toISOString(),
    matches: bundles.flatMap((bundle) => bundle.matches.slice(1, 2)),
    results: [],
    standings: [],
    standingsByLeague: Object.fromEntries(bundles.map((bundle) => [bundle.league, bundle.standings.slice(0, 5)])),
    availability: Object.fromEntries(bundles.map((bundle) => [bundle.league, true])),
    errors: [],
  };
}

function healthyMock(url) {
  const now = Date.now();
  const pathname = url.pathname;
  const league = url.searchParams.get('league') || 'super-lig';
  if (pathname === '/api/football/home') return [footballHome(now), 200, 90];
  if (pathname === '/api/football/season') {
    if (!LEAGUES[league]) return [{ error: 'invalid_league' }, 400, 35];
    return [seasonFor(league, now), 200, 100];
  }
  if (pathname === '/api/football/live') {
    return [{
      source: 'sportmonks',
      league,
      updatedAt: new Date(now).toISOString(),
      nextRefreshInSeconds: 60,
      reason: 'no_live_matches',
      stale: false,
      degraded: false,
      matches: [],
    }, 200, 60];
  }
  if (pathname === '/api/football/leaders') {
    if (!LEAGUES[league]) return [{ error: 'invalid_league' }, 400, 35];
    const scoped = LEAGUES[league];
    const leader = (metric, index) => ({
      metric,
      playerId: `${scoped.id}-${metric}-${index}`,
      playerName: `${scoped.teams[index % scoped.teams.length].name} Oyuncusu`,
      teamName: scoped.teams[index % scoped.teams.length].name,
      teamImage: scoped.teams[index % scoped.teams.length].logo,
      total: 8 - index,
      position: index + 1,
    });
    return [{ source: 'sportmonks', league, seasonId: `season-${scoped.id}`, updatedAt: new Date(now).toISOString(), goals: [leader('goals', 0)], assists: [leader('assists', 1)], yellowCards: [], redCards: [] }, 200, 65];
  }
  if (pathname === '/api/football/weekly-awards') {
    if (!LEAGUES[league]) return [{ error: 'invalid_league' }, 400, 35];
    return [{ source: 'xyzskor-performance', league, algorithmVersion: 'v1', status: 'published', updatedAt: new Date(now).toISOString(), star: null, teamOfWeek: null }, 200, 70];
  }
  if (pathname === '/api/health') {
    return [{ status: 'ok', checks: { sportmonks_live: 'configured', sportmonks: 'configured' } }, 200, 30];
  }
  if (pathname === '/api/football/coverage') {
    return [{
      source: 'sportmonks',
      updatedAt: new Date(now).toISOString(),
      selected: Object.entries(LEAGUES).map(([key, value]) => ({
        league: key,
        leagueId: value.id,
        name: value.label,
        available: true,
        metadataAvailable: true,
        currentSeasonId: `season-${value.id}`,
        capabilities: { fixtures: true, standings: true, live: true },
      })),
    }, 200, 50];
  }
  if (pathname === '/api/football/transfers') {
    return [{ source: 'sportmonks', league, updatedAt: new Date(now).toISOString(), confirmed: [], rumours: [], errors: [] }, 200, 70];
  }
  if (pathname === '/api/football/x-media') {
    return [{ source: 'x-api', league, status: 'ok', updated_at: new Date(now).toISOString(), clubs: [], publishers: [] }, 200, 50];
  }
  if (pathname === '/api/media/youtube') {
    return [{ source: 'youtube-data-api-v3', league, updated_at: new Date(now).toISOString(), channels: [], items: [] }, 200, 50];
  }
  if (pathname.startsWith('/api/social/')) {
    return [{ source: 'mock', league, updated_at: new Date(now).toISOString(), clubs: [], publishers: [], items: [] }, 200, 50];
  }
  if (pathname === '/api/predict-game/status') {
    return [{ authenticated: false, reward_eligible: false, training: false }, 200, 30];
  }
  if (pathname === '/api/predict-game/session') {
    return [{ session: { id: 'perf-session', nonce: 'perf-nonce', reward_eligible: false } }, 200, 30];
  }
  return [{ error: 'not_mocked_in_performance_gate', path: pathname }, 404, 20];
}

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForServer(base, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${base}/index.html`, { method: 'HEAD' });
      if (response.ok) return true;
    } catch { /* server is still starting */ }
    await sleep(100);
  }
  return false;
}

async function waitFor(predicate, timeoutMs = 5000) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (predicate()) return true;
    await sleep(25);
  }
  return predicate();
}

async function waitForAppBootReady(page, timeoutMs = 10_000) {
  await page.waitForFunction(async () => {
    const ready = window.__XYZ_APP_BOOT_READY__;
    if (ready && typeof ready.then === 'function') {
      try {
        await ready;
        return true;
      } catch (_) {
        return false;
      }
    }
    return ready === true;
  }, null, { timeout: timeoutMs });
}

async function stopServer(server) {
  if (!server || server.exitCode !== null) return;
  const exited = new Promise((resolve) => server.once('exit', resolve));
  server.kill();
  await Promise.race([exited, sleep(2000)]);
  if (server.exitCode === null) server.kill('SIGKILL');
}

async function buildProductionArtifact() {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`production build failed (${code}): ${stderr.trim()}`)));
  });
}

const browserProbe = `(() => {
  const state = window.__xyzReleasePerf = {
    marks: { scoreboardPopulatedAt: null, transitionStartedAt: null, overviewPopulatedAt: null, directShellVisibleAt: null, directOverviewPopulatedAt: null },
    longTasks: []
  };
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        state.longTasks.push({ startTime: entry.startTime, duration: entry.duration, name: entry.name || 'longtask' });
      }
    });
    observer.observe({ type: 'longtask', buffered: true });
  } catch (_) {}
  const visible = (element) => Boolean(element && !element.hidden && element.getClientRects().length && getComputedStyle(element).display !== 'none');
  const inspect = () => {
    const scoreboard = document.getElementById('footballScoreboardHome');
    const groups = scoreboard ? [...scoreboard.querySelectorAll('.scoreboard-league-group')] : [];
    if (state.marks.scoreboardPopulatedAt === null && visible(scoreboard) && groups.length === 5 && groups.every((group) => group.querySelector('.scoreboard-match-row'))) {
      state.marks.scoreboardPopulatedAt = performance.now();
    }
    const overview = document.getElementById('footballLeagueOverview');
    const overviewTitle = overview && overview.querySelector('.league-overview-identity h1')?.textContent?.trim();
    const overviewPopulated = visible(overview) && overview.querySelectorAll('.league-overview-table tbody tr').length > 0 && overview.querySelectorAll('.league-overview-fixture').length > 0;
    if (state.marks.directShellVisibleAt === null && location.pathname === '/super-lig' && visible(overview)) {
      state.marks.directShellVisibleAt = performance.now();
    }
    if (state.marks.transitionStartedAt !== null && state.marks.overviewPopulatedAt === null && location.pathname === '/premier-league' && overviewTitle === 'Premier League' && overviewPopulated) {
      state.marks.overviewPopulatedAt = performance.now();
    }
    if (state.marks.transitionStartedAt === null && state.marks.directOverviewPopulatedAt === null && location.pathname === '/super-lig' && overviewTitle === 'Süper Lig' && overviewPopulated) {
      state.marks.directOverviewPopulatedAt = performance.now();
    }
  };
  // Init script parserdan once calisir. DOMContentLoaded'i beklemek erken
  // progressive scoreboard boyamasini yanlislikla defer zinciri kadar gec
  // olcmek demekti; document dugumunu en bastan izleyerek gercek ani yakala.
  inspect();
  new MutationObserver(inspect).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden'] });
})();`;

async function runColdScenario(browser, base, runNumber) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: FAST_3G.latencyMs,
    downloadThroughput: FAST_3G.downloadBitsPerSecond / 8,
    uploadThroughput: FAST_3G.uploadBitsPerSecond / 8,
    connectionType: 'cellular3g',
  });
  await page.addInitScript({ content: browserProbe });

  let phase = 'root';
  const apiRequests = [];
  const apiResponses = [];
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const runStartedAt = performance.now();

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin === base && url.pathname.startsWith('/api/')) {
      apiRequests.push({ phase, method: request.method(), path: `${url.pathname}${url.search}`, atMs: round(performance.now() - runStartedAt) });
    }
  });
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin === base && url.pathname.startsWith('/api/')) {
      apiResponses.push({ phase, status: response.status(), path: `${url.pathname}${url.search}`, atMs: round(performance.now() - runStartedAt) });
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500));
  });
  page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 500)));
  page.on('requestfailed', (request) => {
    failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'request_failed' });
  });

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === base && url.pathname.startsWith('/api/')) {
      const [body, status, delayMs] = healthyMock(url);
      await sleep(delayMs);
      return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=300',
          'X-XYZSkor-Perf-Mock': 'healthy-cache-hit',
        },
        body: JSON.stringify(body),
      });
    }
    if (url.origin === base) return route.continue();
    if (/\.(?:png|jpe?g|webp|gif|svg|avif|ico)(?:\?|$)/i.test(url.pathname)) {
      return route.fulfill({ status: 200, contentType: 'image/gif', body: transparentGif });
    }
    if (/\.js(?:\?|$)/i.test(url.pathname)) {
      return route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '' });
    }
    if (/\.css(?:\?|$)/i.test(url.pathname)) {
      return route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '' });
    }
    return route.fulfill({ status: 204, body: '' });
  });

  let navigationError = null;
  try {
    // Bes ligli futbol vitrini `/futbol/` altindadir; `/` genel cok sporlu
    // ana sayfadir ve hicbir spor API'sini cagirmaz.
    await page.goto(`${base}/futbol/`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  } catch (error) {
    navigationError = String(error);
  }

  await page.waitForFunction(() => Number.isFinite(window.__xyzReleasePerf?.marks?.scoreboardPopulatedAt), null, { timeout: 10_000 }).catch(() => {});
  await page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0, null, { timeout: 3000 }).catch(() => {});
  const rootMetrics = await page.evaluate((trackedResourcePattern) => {
    const trackedResourceRE = new RegExp(trackedResourcePattern);
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null;
    const mark = window.__xyzReleasePerf?.marks?.scoreboardPopulatedAt ?? null;
    const groups = [...document.querySelectorAll('#footballScoreboardHome .scoreboard-league-group')];
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource').map((entry) => ({
      name: new URL(entry.name).pathname,
      initiatorType: entry.initiatorType,
      startTimeMs: Math.round(entry.startTime),
      durationMs: Math.round(entry.duration),
      responseEndMs: Math.round(entry.responseEnd),
      transferBytes: entry.transferSize || 0,
      encodedBytes: entry.encodedBodySize || 0,
      decodedBytes: entry.decodedBodySize || 0,
    }));
    return {
      firstContentfulPaintMs: Number.isFinite(fcp) ? Math.round(fcp) : null,
      populatedScoreboardMs: Number.isFinite(mark) ? Math.round(mark) : null,
      domContentLoadedMs: Number.isFinite(navigation?.domContentLoadedEventEnd) ? Math.round(navigation.domContentLoadedEventEnd) : null,
      loadEventMs: Number.isFinite(navigation?.loadEventEnd) ? Math.round(navigation.loadEventEnd) : null,
      leagueGroups: groups.length,
      populatedLeagueGroups: groups.filter((group) => group.querySelector('.scoreboard-match-row')).length,
      matchRows: document.querySelectorAll('#footballScoreboardHome .scoreboard-match-row').length,
      predictActions: document.querySelectorAll('#footballScoreboardHome .scoreboard-predict').length,
      path: location.pathname,
      resources: {
        count: resources.length,
        transferBytes: resources.reduce((sum, entry) => sum + entry.transferBytes, 0),
        encodedBytes: resources.reduce((sum, entry) => sum + entry.encodedBytes, 0),
        decodedBytes: resources.reduce((sum, entry) => sum + entry.decodedBytes, 0),
        critical: resources.filter((entry) => trackedResourceRE.test(entry.name)),
        criticalCapturedAt: 'root-ready',
        slowest: resources.slice().sort((a, b) => b.responseEndMs - a.responseEndMs).slice(0, 15),
      },
    };
  }, TRACKED_RESOURCE_PATTERN);

  // Preserve the early FCP/scoreboard marks above, then let the complete app
  // boot finish before taking request-cardinality and final resource snapshots.
  await waitForAppBootReady(page);
  await waitFor(() => {
    const paths = new Set(apiResponses.filter((response) => response.phase === 'root' && response.status === 200).map((response) => response.path));
    return paths.has('/api/football/home') && paths.has('/api/football/live?league=all');
  }, 3500);

  phase = 'transition';
  const transitionTriggered = await page.evaluate(() => {
    const state = window.__xyzReleasePerf;
    const button = [...document.querySelectorAll('#footballScoreboardHome .scoreboard-leagues button')]
      .find((candidate) => candidate.textContent?.includes('Premier League'));
    if (!state || !button) return false;
    state.marks.transitionStartedAt = performance.now();
    button.click();
    return true;
  });
  await page.waitForFunction(() => Number.isFinite(window.__xyzReleasePerf?.marks?.overviewPopulatedAt), null, { timeout: 8000 }).catch(() => {});
  await waitFor(() => apiResponses.some((response) => response.phase === 'transition' && response.status === 200 && response.path === '/api/football/live?league=premier-league'), 2500);
  await sleep(100);

  const finalMetrics = await page.evaluate((trackedResourcePattern) => {
    const trackedResourceRE = new RegExp(trackedResourcePattern);
    const state = window.__xyzReleasePerf || { marks: {}, longTasks: [] };
    const transitionStart = state.marks.transitionStartedAt;
    const overviewAt = state.marks.overviewPopulatedAt;
    const longTasks = (state.longTasks || []).map((task) => ({
      startTime: Math.round(task.startTime),
      duration: Math.round(task.duration),
      name: task.name,
    }));
    const criticalResources = performance.getEntriesByType('resource')
      .map((entry) => ({
        name: new URL(entry.name).pathname,
        initiatorType: entry.initiatorType,
        startTimeMs: Math.round(entry.startTime),
        durationMs: Math.round(entry.duration),
        responseEndMs: Math.round(entry.responseEnd),
        transferBytes: entry.transferSize || 0,
        encodedBytes: entry.encodedBodySize || 0,
        decodedBytes: entry.decodedBodySize || 0,
      }))
      .filter((entry) => trackedResourceRE.test(entry.name));
    return {
      path: location.pathname,
      transitionStartedAt: Number.isFinite(transitionStart) ? Math.round(transitionStart) : null,
      overviewPopulatedAt: Number.isFinite(overviewAt) ? Math.round(overviewAt) : null,
      transitionMs: Number.isFinite(transitionStart) && Number.isFinite(overviewAt) ? Math.round(overviewAt - transitionStart) : null,
      overviewVisible: Boolean(document.querySelector('#footballLeagueOverview')?.getClientRects().length),
      overviewTitle: document.querySelector('#footballLeagueOverview .league-overview-identity h1')?.textContent?.trim() || null,
      standingsRows: document.querySelectorAll('#footballLeagueOverview .league-overview-table tbody tr').length,
      fixtureRows: document.querySelectorAll('#footballLeagueOverview .league-overview-fixture').length,
      longTasks,
      criticalResources,
    };
  }, TRACKED_RESOURCE_PATTERN);

  // Some non-blocking styles can still be in flight when the root DOM contract
  // first becomes ready. Use the post-transition Resource Timing snapshot for
  // the static critical-resource inventory so reporting does not omit them.
  rootMetrics.resources.critical = finalMetrics.criticalResources;
  rootMetrics.resources.criticalCapturedAt = 'post-app-boot-transition';

  const rootLongTasks = finalMetrics.longTasks.filter((task) => finalMetrics.transitionStartedAt === null || task.startTime < finalMetrics.transitionStartedAt);
  const transitionLongTasks = finalMetrics.longTasks.filter((task) => finalMetrics.transitionStartedAt !== null && task.startTime >= finalMetrics.transitionStartedAt && (finalMetrics.overviewPopulatedAt === null || task.startTime <= finalMetrics.overviewPopulatedAt));
  const requests = requestSummary(apiRequests);
  const criticalViolations = criticalRequestViolations(requests);
  const result = {
    run: runNumber,
    coldContext: true,
    navigationError,
    root: rootMetrics,
    transition: {
      triggered: transitionTriggered,
      path: finalMetrics.path,
      populatedOverviewMs: finalMetrics.transitionMs,
      overviewVisible: finalMetrics.overviewVisible,
      overviewTitle: finalMetrics.overviewTitle,
      standingsRows: finalMetrics.standingsRows,
      fixtureRows: finalMetrics.fixtureRows,
    },
    errors: { console: consoleErrors, page: pageErrors, failedRequests },
    api: { ...requests, responses: apiResponses, criticalViolations },
    longTasks: {
      root: summarizeLongTasks(rootLongTasks),
      transition: summarizeLongTasks(transitionLongTasks),
      all: summarizeLongTasks(finalMetrics.longTasks),
    },
  };

  await context.close();
  return result;
}

async function runDirectLeagueScenario(browser, base, runNumber) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: FAST_3G.latencyMs,
    downloadThroughput: FAST_3G.downloadBitsPerSecond / 8,
    uploadThroughput: FAST_3G.uploadBitsPerSecond / 8,
    connectionType: 'cellular3g',
  });
  await page.addInitScript({ content: browserProbe });

  const phase = 'direct-super-lig';
  const apiRequests = [];
  const apiResponses = [];
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const runStartedAt = performance.now();

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin === base && url.pathname.startsWith('/api/')) {
      apiRequests.push({ phase, method: request.method(), path: `${url.pathname}${url.search}`, atMs: round(performance.now() - runStartedAt) });
    }
  });
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin === base && url.pathname.startsWith('/api/')) {
      apiResponses.push({ phase, status: response.status(), path: `${url.pathname}${url.search}`, atMs: round(performance.now() - runStartedAt) });
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500));
  });
  page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 500)));
  page.on('requestfailed', (request) => {
    failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'request_failed' });
  });

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === base && url.pathname.startsWith('/api/')) {
      const [body, status, delayMs] = healthyMock(url);
      await sleep(delayMs);
      return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=300',
          'X-XYZSkor-Perf-Mock': 'healthy-cache-hit',
        },
        body: JSON.stringify(body),
      });
    }
    if (url.origin === base) return route.continue();
    if (/\.(?:png|jpe?g|webp|gif|svg|avif|ico)(?:\?|$)/i.test(url.pathname)) {
      return route.fulfill({ status: 200, contentType: 'image/gif', body: transparentGif });
    }
    if (/\.js(?:\?|$)/i.test(url.pathname)) {
      return route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '' });
    }
    if (/\.css(?:\?|$)/i.test(url.pathname)) {
      return route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '' });
    }
    return route.fulfill({ status: 204, body: '' });
  });

  let navigationError = null;
  try {
    await page.goto(`${base}/super-lig`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  } catch (error) {
    navigationError = String(error);
  }

  await page.waitForFunction(() => Number.isFinite(window.__xyzReleasePerf?.marks?.directShellVisibleAt), null, { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(() => Number.isFinite(window.__xyzReleasePerf?.marks?.directOverviewPopulatedAt), null, { timeout: 10_000 }).catch(() => {});
  await page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0, null, { timeout: 3000 }).catch(() => {});
  const earlyMetrics = await page.evaluate(() => {
    const state = window.__xyzReleasePerf || { marks:{} };
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null;
    const navigation = performance.getEntriesByType('navigation')[0];
    const overview = document.getElementById('footballLeagueOverview');
    return {
      path: location.pathname,
      firstContentfulPaintMs: Number.isFinite(fcp) ? Math.round(fcp) : null,
      shellVisibleMs: Number.isFinite(state.marks.directShellVisibleAt) ? Math.round(state.marks.directShellVisibleAt) : null,
      populatedOverviewMs: Number.isFinite(state.marks.directOverviewPopulatedAt) ? Math.round(state.marks.directOverviewPopulatedAt) : null,
      domContentLoadedMs: Number.isFinite(navigation?.domContentLoadedEventEnd) ? Math.round(navigation.domContentLoadedEventEnd) : null,
      overviewVisible: Boolean(overview?.getClientRects().length),
      overviewTitle: overview?.querySelector('.league-overview-identity h1')?.textContent?.trim() || null,
      standingsRows: overview?.querySelectorAll('.league-overview-table tbody tr').length || 0,
      fixtureRows: overview?.querySelectorAll('.league-overview-fixture').length || 0,
    };
  });
  await waitForAppBootReady(page);
  await waitFor(() => {
    const paths = new Set(apiResponses.filter((response) => response.phase === phase && response.status === 200).map((response) => response.path));
    return paths.has('/api/football/season?league=super-lig') && paths.has('/api/football/live?league=super-lig');
  }, 3500);
  await page.waitForLoadState('load', { timeout: 3000 }).catch(() => {});
  await sleep(100);

  const finalMetrics = await page.evaluate((trackedResourcePattern) => {
    const trackedResourceRE = new RegExp(trackedResourcePattern);
    const state = window.__xyzReleasePerf || { marks: {}, longTasks: [] };
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null;
    const navigation = performance.getEntriesByType('navigation')[0];
    const longTasks = (state.longTasks || []).map((task) => ({
      startTime: Math.round(task.startTime),
      duration: Math.round(task.duration),
      name: task.name,
    }));
    const criticalResources = performance.getEntriesByType('resource')
      .map((entry) => ({
        name: new URL(entry.name).pathname,
        initiatorType: entry.initiatorType,
        startTimeMs: Math.round(entry.startTime),
        durationMs: Math.round(entry.duration),
        responseEndMs: Math.round(entry.responseEnd),
        transferBytes: entry.transferSize || 0,
        encodedBytes: entry.encodedBodySize || 0,
        decodedBytes: entry.decodedBodySize || 0,
      }))
      .filter((entry) => trackedResourceRE.test(entry.name));
    const overview = document.getElementById('footballLeagueOverview');
    return {
      path: location.pathname,
      firstContentfulPaintMs: Number.isFinite(fcp) ? Math.round(fcp) : null,
      shellVisibleMs: Number.isFinite(state.marks.directShellVisibleAt) ? Math.round(state.marks.directShellVisibleAt) : null,
      populatedOverviewMs: Number.isFinite(state.marks.directOverviewPopulatedAt) ? Math.round(state.marks.directOverviewPopulatedAt) : null,
      domContentLoadedMs: Number.isFinite(navigation?.domContentLoadedEventEnd) ? Math.round(navigation.domContentLoadedEventEnd) : null,
      loadEventMs: Number.isFinite(navigation?.loadEventEnd) ? Math.round(navigation.loadEventEnd) : null,
      overviewVisible: Boolean(overview?.getClientRects().length),
      overviewTitle: overview?.querySelector('.league-overview-identity h1')?.textContent?.trim() || null,
      standingsRows: overview?.querySelectorAll('.league-overview-table tbody tr').length || 0,
      fixtureRows: overview?.querySelectorAll('.league-overview-fixture').length || 0,
      longTasks,
      criticalResources,
    };
  }, TRACKED_RESOURCE_PATTERN);
  const metrics = {
    ...finalMetrics,
    ...earlyMetrics,
    loadEventMs: finalMetrics.loadEventMs,
  };

  const requests = requestSummary(apiRequests);
  const directCounts = requests.phaseCounts[phase] || {};
  const seasonRequests = Object.entries(directCounts)
    .filter(([key]) => key.startsWith('GET /api/football/season'))
    .reduce((sum, [, count]) => sum + count, 0);
  const criticalViolations = [
    ['direct home', directCounts['GET /api/football/home'] || 0, 0],
    ['direct Super Lig season', directCounts['GET /api/football/season?league=super-lig'] || 0, 1],
    ['direct other season', seasonRequests - (directCounts['GET /api/football/season?league=super-lig'] || 0), 0],
    ['direct Super Lig live', directCounts['GET /api/football/live?league=super-lig'] || 0, 1],
    ['direct all-league live', directCounts['GET /api/football/live?league=all'] || 0, 0],
    ['direct health', directCounts['GET /api/health'] || 0, 0],
  ].filter(([, actual, expected]) => actual !== expected)
    .map(([label, actual, expected]) => ({ label, actual, expected }));

  const result = {
    run: runNumber,
    coldContext: true,
    navigationError,
    direct: {
      path: metrics.path,
      firstContentfulPaintMs: metrics.firstContentfulPaintMs,
      shellVisibleMs: metrics.shellVisibleMs,
      populatedOverviewMs: metrics.populatedOverviewMs,
      domContentLoadedMs: metrics.domContentLoadedMs,
      loadEventMs: metrics.loadEventMs,
      overviewVisible: metrics.overviewVisible,
      overviewTitle: metrics.overviewTitle,
      standingsRows: metrics.standingsRows,
      fixtureRows: metrics.fixtureRows,
      resources: {
        critical: metrics.criticalResources,
        criticalCapturedAt: 'post-app-boot',
      },
    },
    errors: { console: consoleErrors, page: pageErrors, failedRequests },
    api: { ...requests, responses: apiResponses, criticalViolations },
    longTasks: { all: summarizeLongTasks(metrics.longTasks) },
  };

  await context.close();
  return result;
}

function releaseChecks(runs, directRuns, aggregate) {
  const taggedRuns = [
    ...runs.map((run) => ({ scenario: 'root-transition', run })),
    ...directRuns.map((run) => ({ scenario: 'direct-super-lig', run })),
  ];
  const consoleErrors = taggedRuns.reduce((sum, entry) => sum + entry.run.errors.console.length, 0);
  const pageErrors = taggedRuns.reduce((sum, entry) => sum + entry.run.errors.page.length, 0);
  const duplicates = taggedRuns.flatMap((entry) => entry.run.api.duplicates.map((duplicate) => ({ scenario: entry.scenario, run: entry.run.run, ...duplicate })));
  const cardinalityViolations = taggedRuns.flatMap((entry) => entry.run.api.criticalViolations.map((violation) => ({ scenario: entry.scenario, run: entry.run.run, ...violation })));
  const maximumLongTaskMs = Math.max(0, ...taggedRuns.map((entry) => entry.run.longTasks.all.maximumDurationMs));
  const rootStructuralViolations = runs.flatMap((run) => {
    const problems = [];
    if (run.navigationError) problems.push(`root-transition run ${run.run}: navigation failed`);
    if (run.root.leagueGroups !== 5 || run.root.populatedLeagueGroups !== 5 || run.root.matchRows < 5) problems.push(`root-transition run ${run.run}: root scoreboard was not populated for five leagues`);
    if (!run.transition.triggered || run.transition.path !== '/premier-league' || !run.transition.overviewVisible || run.transition.overviewTitle !== 'Premier League' || run.transition.standingsRows < 1 || run.transition.fixtureRows < 1) problems.push(`root-transition run ${run.run}: Premier League overview was not populated`);
    return problems;
  });
  const directStructuralViolations = directRuns.flatMap((run) => {
    const problems = [];
    if (run.navigationError) problems.push(`direct-super-lig run ${run.run}: navigation failed`);
    if (run.direct.path !== '/super-lig' || !run.direct.overviewVisible || run.direct.overviewTitle !== 'Süper Lig' || run.direct.standingsRows < 1 || run.direct.fixtureRows < 1) problems.push(`direct-super-lig run ${run.run}: Super Lig overview was not populated`);
    return problems;
  });
  const structuralViolations = [...rootStructuralViolations, ...directStructuralViolations];
  const checks = [
    { name: 'median first-contentful-paint', actual: aggregate.medianFirstContentfulPaintMs, limit: BUDGETS.medianFirstContentfulPaintMs, unit: 'ms', passed: Number.isFinite(aggregate.medianFirstContentfulPaintMs) && aggregate.medianFirstContentfulPaintMs <= BUDGETS.medianFirstContentfulPaintMs },
    { name: 'median populated five-league scoreboard', actual: aggregate.medianPopulatedScoreboardMs, limit: BUDGETS.medianPopulatedScoreboardMs, unit: 'ms', passed: Number.isFinite(aggregate.medianPopulatedScoreboardMs) && aggregate.medianPopulatedScoreboardMs <= BUDGETS.medianPopulatedScoreboardMs },
    { name: 'median Premier League transition', actual: aggregate.medianPremierLeagueTransitionMs, limit: BUDGETS.medianPremierLeagueTransitionMs, unit: 'ms', passed: Number.isFinite(aggregate.medianPremierLeagueTransitionMs) && aggregate.medianPremierLeagueTransitionMs <= BUDGETS.medianPremierLeagueTransitionMs },
    { name: 'median direct Super Lig shell', actual: aggregate.medianDirectSuperLigShellMs, limit: BUDGETS.medianDirectSuperLigShellMs, unit: 'ms', passed: Number.isFinite(aggregate.medianDirectSuperLigShellMs) && aggregate.medianDirectSuperLigShellMs <= BUDGETS.medianDirectSuperLigShellMs },
    { name: 'median direct Super Lig populated overview', actual: aggregate.medianDirectSuperLigPopulatedOverviewMs, limit: BUDGETS.medianDirectSuperLigPopulatedOverviewMs, unit: 'ms', passed: Number.isFinite(aggregate.medianDirectSuperLigPopulatedOverviewMs) && aggregate.medianDirectSuperLigPopulatedOverviewMs <= BUDGETS.medianDirectSuperLigPopulatedOverviewMs },
    { name: 'maximum long task', actual: maximumLongTaskMs, limit: BUDGETS.maximumLongTaskMs, unit: 'ms', passed: maximumLongTaskMs <= BUDGETS.maximumLongTaskMs },
    { name: 'duplicate API requests', actual: duplicates.length, limit: BUDGETS.duplicateApiRequests, unit: 'duplicates', passed: duplicates.length === BUDGETS.duplicateApiRequests, details: duplicates },
    { name: 'critical request cardinality violations', actual: cardinalityViolations.length, limit: 0, unit: 'violations', passed: cardinalityViolations.length === 0, details: cardinalityViolations },
    { name: 'console errors', actual: consoleErrors, limit: BUDGETS.consoleErrors, unit: 'errors', passed: consoleErrors === BUDGETS.consoleErrors },
    { name: 'page errors', actual: pageErrors, limit: BUDGETS.pageErrors, unit: 'errors', passed: pageErrors === BUDGETS.pageErrors },
    { name: 'populated DOM contracts', actual: structuralViolations.length, limit: 0, unit: 'violations', passed: structuralViolations.length === 0, details: structuralViolations },
  ];
  return { checks, passed: checks.every((check) => check.passed) };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await buildProductionArtifact();
  const port = Number(process.env.XYZSKOR_TEST_PORT || await findFreePort());
  const base = `http://127.0.0.1:${port}`;
  const serverOutput = [];
  const server = spawn(process.execPath, ['scripts/dev-server.mjs'], {
    cwd: ROOT,
    env: { ...process.env, XYZSKOR_DEV_PORT: String(port), XYZSKOR_STATIC_ROOT: 'dist/client' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) => serverOutput.push(String(chunk).trim()));
  server.stderr.on('data', (chunk) => serverOutput.push(String(chunk).trim()));

  let browser = null;
  try {
    if (!await waitForServer(base)) throw new Error(`dev-server ${base} adresinde başlamadı: ${serverOutput.join(' | ')}`);
    browser = await launchChromium();
    const runs = [];
    const directLeagueRuns = [];
    for (let run = 1; run <= COLD_RUNS; run += 1) {
      const result = await runColdScenario(browser, base, run);
      runs.push(result);
      console.log(`[run ${run}/${COLD_RUNS}] FCP=${result.root.firstContentfulPaintMs}ms scoreboard=${result.root.populatedScoreboardMs}ms transition=${result.transition.populatedOverviewMs}ms API=${result.api.total} long-max=${result.longTasks.all.maximumDurationMs}ms`);
      const directResult = await runDirectLeagueScenario(browser, base, run);
      directLeagueRuns.push(directResult);
      console.log(`[direct ${run}/${COLD_RUNS}] FCP=${directResult.direct.firstContentfulPaintMs}ms shell=${directResult.direct.shellVisibleMs}ms overview=${directResult.direct.populatedOverviewMs}ms API=${directResult.api.total} long-max=${directResult.longTasks.all.maximumDurationMs}ms`);
    }

    const aggregate = {
      medianFirstContentfulPaintMs: median(runs.map((run) => run.root.firstContentfulPaintMs)),
      medianPopulatedScoreboardMs: median(runs.map((run) => run.root.populatedScoreboardMs)),
      medianPremierLeagueTransitionMs: median(runs.map((run) => run.transition.populatedOverviewMs)),
      medianDirectSuperLigFirstContentfulPaintMs: median(directLeagueRuns.map((run) => run.direct.firstContentfulPaintMs)),
      medianDirectSuperLigShellMs: median(directLeagueRuns.map((run) => run.direct.shellVisibleMs)),
      medianDirectSuperLigPopulatedOverviewMs: median(directLeagueRuns.map((run) => run.direct.populatedOverviewMs)),
    };
    const release = releaseChecks(runs, directLeagueRuns, aggregate);
    const allCanonicalRuns = [
      ...runs.map((run) => run.root.resources.critical),
      ...directLeagueRuns.map((run) => run.direct.resources.critical),
    ];
    const trackedResources = Object.fromEntries(TRACKED_RESOURCE_PATHS.map((path) => {
      const entries = allCanonicalRuns
        .map((resources) => resources.find((resource) => resource.name === path))
        .filter(Boolean);
      const deferredDiagnostic = DEFERRED_DIAGNOSTIC_RESOURCE_PATHS.includes(path);
      return [path, {
        loadedRuns: entries.length,
        role: deferredDiagnostic ? 'deferred-diagnostic' : (path === '/assets/js/ui-extras.js' ? 'conditional' : 'canonical-required'),
        expectedRuns: deferredDiagnostic ? 'diagnostic' : (path === '/assets/js/ui-extras.js' ? 'conditional' : allCanonicalRuns.length),
        medianStartTimeMs: median(entries.map((entry) => entry.startTimeMs)),
        medianResponseEndMs: median(entries.map((entry) => entry.responseEndMs)),
        medianDurationMs: median(entries.map((entry) => entry.durationMs)),
      }];
    }));
    const criticalResources = Object.fromEntries(CRITICAL_RESOURCE_PATHS.map((path) => [path, trackedResources[path]]));
    const deferredResources = Object.fromEntries(DEFERRED_DIAGNOSTIC_RESOURCE_PATHS.map((path) => [path, trackedResources[path]]));
    const criticalCoverageViolations = Object.entries(criticalResources)
      .filter(([, resource]) => Number.isFinite(resource.expectedRuns) && resource.loadedRuns !== resource.expectedRuns)
      .map(([path, resource]) => ({ path, loadedRuns: resource.loadedRuns, expectedRuns: resource.expectedRuns }));
    release.checks.push({
      name: 'required critical resource coverage',
      actual: criticalCoverageViolations.length,
      limit: 0,
      unit: 'violations',
      passed: criticalCoverageViolations.length === 0,
      details: criticalCoverageViolations,
    });
    release.checks.push({
      name: 'canonical routes skip conditional ui-extras',
      actual: criticalResources['/assets/js/ui-extras.js'].loadedRuns,
      limit: 0,
      unit: 'loads',
      passed: criticalResources['/assets/js/ui-extras.js'].loadedRuns === 0,
    });
    release.passed = release.checks.every((check) => check.passed);
    const medianUiScriptResponseEndMs = Math.max(
      criticalResources['/assets/js/ui.js'].medianResponseEndMs || 0,
      criticalResources['/assets/js/ui-stage.js'].medianResponseEndMs || 0,
      criticalResources['/assets/js/ui-runtime.js'].medianResponseEndMs || 0,
    );
    const medianHomeRequestStartMs = median(runs.map((run) => run.api.requests.find((request) => request.path === '/api/football/home')?.atMs));
    const medianHomeResponseMs = median(runs.map((run) => run.api.responses.find((response) => response.path === '/api/football/home')?.atMs));
    const medianDirectUiScriptResponseEndMs = median(directLeagueRuns.map((run) => Math.max(
      run.direct.resources.critical.find((resource) => resource.name === '/assets/js/ui.js')?.responseEndMs || 0,
      run.direct.resources.critical.find((resource) => resource.name === '/assets/js/ui-stage.js')?.responseEndMs || 0,
      run.direct.resources.critical.find((resource) => resource.name === '/assets/js/ui-runtime.js')?.responseEndMs || 0,
    )));
    const medianDirectAppCssResponseEndMs = median(directLeagueRuns.map((run) => run.direct.resources.critical.find((resource) => resource.name === '/assets/css/app.css')?.responseEndMs));
    const medianDirectSeasonResponseMs = median(directLeagueRuns.map((run) => run.api.responses.find((response) => response.path === '/api/football/season?league=super-lig')?.atMs));
    const maximumLongTaskMs = Math.max(
      0,
      ...runs.map((run) => run.longTasks.all.maximumDurationMs),
      ...directLeagueRuns.map((run) => run.longTasks.all.maximumDurationMs),
    );
    const transitionRequestsAreSingle = runs.every((run) => (
      run.api.phaseCounts.transition['GET /api/football/season?league=premier-league'] === 1
      && run.api.phaseCounts.transition['GET /api/football/live?league=premier-league'] === 1
    ));
    const directRequestsAreSingle = directLeagueRuns.every((run) => (
      run.api.phaseCounts['direct-super-lig']['GET /api/football/season?league=super-lig'] === 1
      && run.api.phaseCounts['direct-super-lig']['GET /api/football/live?league=super-lig'] === 1
    ));
    const uiExtrasLoadedRuns = criticalResources['/assets/js/ui-extras.js'].loadedRuns;
    const diagnostics = {
      medianUiScriptResponseEndMs,
      medianHomeRequestStartMs,
      medianHomeResponseMs,
      medianDirectUiScriptResponseEndMs,
      medianDirectAppCssResponseEndMs,
      medianDirectSeasonResponseMs,
      criticalResources,
      deferredResources,
      duplicateKeys: [...new Set([
        ...runs.flatMap((run) => run.api.duplicates.map((duplicate) => duplicate.key)),
        ...directLeagueRuns.flatMap((run) => run.api.duplicates.map((duplicate) => duplicate.key)),
      ])],
      observations: [
        `The initial /api/football/home request starts at a median ${medianHomeRequestStartMs}ms, ${Math.max(0, medianUiScriptResponseEndMs - medianHomeRequestStartMs)}ms before ui.js finishes, through the early route bootstrap.`,
        `The progressive five-league scoreboard is populated at a median ${aggregate.medianPopulatedScoreboardMs}ms; the full app shell remains outside that first-data critical path.`,
        transitionRequestsAreSingle
          ? 'Each Premier League transition issued exactly one scoped season request and one scoped live request; no duplicate transition fetch was observed.'
          : 'The Premier League transition request shape differed from the expected single season plus single live request.',
        `A direct cold /super-lig navigation paints its league shell at a median ${aggregate.medianDirectSuperLigShellMs}ms and populates the overview at a median ${aggregate.medianDirectSuperLigPopulatedOverviewMs}ms.`,
        `The direct Super Lig season payload is ready at a median ${medianDirectSeasonResponseMs}ms; the split ui.js/ui-stage.js/ui-runtime.js chain finishes at ${medianDirectUiScriptResponseEndMs}ms while the early populated overview is already visible at ${aggregate.medianDirectSuperLigPopulatedOverviewMs}ms.`,
        `The deferred app.css response completes at a median ${medianDirectAppCssResponseEndMs}ms on direct Super Lig cold loads; football-hub.css remains the early canonical visual stylesheet.`,
        directRequestsAreSingle
          ? 'Each direct Super Lig navigation issued exactly one scoped season request and one scoped live request.'
          : 'The direct Super Lig request shape differed from the expected single season plus single live request.',
        `The maximum observed long task was ${maximumLongTaskMs}ms, ${maximumLongTaskMs <= BUDGETS.maximumLongTaskMs ? 'within' : 'above'} the ${BUDGETS.maximumLongTaskMs}ms release budget.`,
        `ui-extras.js is conditional and loaded in ${uiExtrasLoadedRuns}/${allCanonicalRuns.length} canonical-route cold contexts.`,
      ],
    };
    const report = {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      scenario: 'mobile football root, Premier League transition, and direct Super Lig release gate',
      environment: {
        viewport: VIEWPORT,
        coldRunsPerScenario: COLD_RUNS,
        totalColdContexts: allCanonicalRuns.length,
        cpuThrottlingRate: CPU_THROTTLE,
        network: FAST_3G,
        apiProfile: 'healthy cached provider responses (30-100ms mock origin latency)',
        browserCacheDisabled: true,
      },
      budgets: BUDGETS,
      aggregate,
      diagnostics,
      release,
      runs,
      directLeagueRuns,
    };
    await writeFile(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');

    console.log('\n=== XYZSKOR MOBILE RELEASE PERFORMANCE ===');
    for (const check of release.checks) {
      console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.name}: ${check.actual}${check.unit === 'ms' ? 'ms' : ` ${check.unit}`} (limit ${check.limit}${check.unit === 'ms' ? 'ms' : ''})`);
    }
    console.log(`JSON: ${fileURLToPath(REPORT_FILE)}`);
    if (!release.passed) process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stopServer(server);
  }
}

main().catch(async (error) => {
  console.error('PERFORMANCE HARNESS ERROR:', error);
  process.exitCode = 1;
});
