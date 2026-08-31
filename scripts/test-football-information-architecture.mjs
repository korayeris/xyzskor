import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const dataSource = await readFile(new URL('../assets/js/data.js', import.meta.url), 'utf8');
const uiSource = await readFile(new URL('../assets/js/ui.js', import.meta.url), 'utf8');
const footballEarlySource = await readFile(new URL('../assets/js/football-early.js', import.meta.url), 'utf8');
const liveSource = await readFile(new URL('../assets/js/live.js', import.meta.url), 'utf8');
const matchdaySource = await readFile(new URL('../assets/js/matchday-live.js', import.meta.url), 'utf8');
const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const buildSource = await readFile(new URL('./build.mjs', import.meta.url), 'utf8');
const workerSource = await readFile(new URL('../worker/index.js', import.meta.url), 'utf8');

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `${startMarker} başlangıcı bulunmalı.`);
  assert.notEqual(end, -1, `${endMarker} sınırı bulunmalı.`);
  return source.slice(start, end);
}

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

const expectedLeagues = ['super-lig', 'premier-league', 'la-liga', 'bundesliga', 'serie-a'];
const homeLeagueLiteral = dataSource.match(/const FOOTBALL_HOME_LEAGUES\s*=\s*(\[[^;]+\])/);
assert.ok(homeLeagueLiteral, 'Beş liglik futbol ana sayfası sabiti bulunmalı.');
const homeLeagues = Array.from(vm.runInNewContext(homeLeagueLiteral[1]));
assert.deepEqual(homeLeagues, expectedLeagues, 'Ana futbol sayfası lig sırası sabit kalmalı.');

const selectedCompetitionRegion = sourceBetween(dataSource, 'const SELECTED_COMPETITIONS = [', 'const FOOTBALL_COVERAGE_CACHE_MS');
const selectedKeys = [...selectedCompetitionRegion.matchAll(/key:'([^']+)'/g)].map((match) => match[1]);
assert.deepEqual(selectedKeys.slice(0, 5), expectedLeagues, 'Görünür lig seçici ana sayfayla aynı beş lig sırasını kullanmalı.');
assert.equal(selectedKeys[5], 'all', 'Beş ulusal ligin ardından yalnızca Tüm ligler seçeneği gelmeli.');

const earlyScopeContext = vm.createContext({ Boolean, String });
vm.runInContext(
  sourceBetween(footballEarlySource, 'function itemInLeague', 'function seasonText'),
  earlyScopeContext,
  { filename: 'football-early-scope.js' },
);
assert.equal(
  vm.runInContext("validSeasonPayload({league:'super-lig',matches:[],standings:[]},'super-lig')", earlyScopeContext),
  true,
  'Erken lig renderer yalnız rota ile aynı kapsamı taşıyan season paketini kabul etmeli.',
);
assert.equal(
  vm.runInContext("validSeasonPayload({league:'premier-league',matches:[],standings:[]},'super-lig')", earlyScopeContext),
  false,
  'Başka lig etiketi taşıyan season paketi erken Süper Lig DOM’una uygulanmamalı.',
);
assert.equal(
  vm.runInContext("itemInLeague({league_key:'premier-league'},'super-lig','600')", earlyScopeContext),
  false,
  'Paket içindeki başka lige ait fixture erken renderer tarafından filtrelenmeli.',
);
assert.equal(
  vm.runInContext("itemInLeague({league_key:'super-lig',provider_league_id:'8'},'super-lig','600')", earlyScopeContext),
  false,
  'Slug doğru görünse bile provider league kimliği farklı kayıt çizilmemeli.',
);
const earlyLeagueRenderer = sourceBetween(footballEarlySource, 'function renderLeague', 'function readyHome');
assert.match(footballEarlySource, /window\.__XYZ_FOOTBALL_SEASON_REQUEST__/, 'Doğrudan lig açılışı initial-route season promise\'ını yeniden kullanmalı.');
assert.match(earlyLeagueRenderer, /root\.replaceChildren\(hero\)[\s\S]*setTimeout\(function \(\) \{[\s\S]*root\.append\(tabs\)/, 'Erken lig renderer hero ve lig sekmelerini ayrı macrotasklarda kurmalı.');
assert.match(earlyLeagueRenderer, /root\.append\(tabs\)[\s\S]*setTimeout\(function \(\) \{[\s\S]*root\.append\(layout,[\s\S]*league-overview-metrics/, 'Erken lig renderer tablo ve fixture panellerini sekmelerden sonraki ayrı görevde kademeli kurmalı.');
assert.match(earlyLeagueRenderer, /root\.dataset\.earlyLeagueHydrated\s*=\s*leagueKey/, 'Erken DOM sonraki tam renderer için lig kapsamıyla işaretlenmeli.');
assert.doesNotMatch(earlyLeagueRenderer, /\.innerHTML\s*=/, 'Provider metinleri erken renderer içinde HTML dizesine enjekte edilmemeli.');
assert.doesNotMatch(earlyLeagueRenderer, /!rows\.length\s*\|\|\s*!matches\.length/, 'Geçerli pakette eksik tablo veya fikstür diğer erken lig panelini engellememeli.');
assert.match(sourceBetween(footballEarlySource, 'function node', 'function label'), /textContent\s*=\s*String\(text\)/, 'Erken renderer provider metinlerini textContent ile escape etmeli.');
const earlyHomeRenderer = sourceBetween(footballEarlySource, 'function render(payload)', 'function panelHeader');
assert.match(earlyHomeRenderer, /var shell = root\.querySelector\("\.scoreboard-shell"\)/, 'Kök erken renderer statik ilk-boyama shell’ini yeniden kullanmalı.');
assert.match(earlyHomeRenderer, /function renderHeaderStage\(\)[\s\S]*renderHeader\(\);[\s\S]*setTimeout\(renderRailStage, 0\)/, 'Skor başlığı ile lig rayı farklı macrotasklarda çizilmelidir.');
assert.match(earlyHomeRenderer, /function renderRailStage\(\)[\s\S]*renderRail\(\);[\s\S]*setTimeout\(appendLeagueBatch, 0\)/, 'Lig rayı tamamlanmadan lig grupları aynı taskta oluşturulmamalıdır.');
assert.match(earlyHomeRenderer, /nextLeague \+ 1/, 'Kök skor tablosu canonical yükseltmeden önce bir macrotaskta yalnız bir lig çizmelidir.');
assert.match(earlyHomeRenderer, /populateFeature\(\);[\s\S]*root\.dataset\.earlyHydrated = "true"/, 'Öne çıkan kart ayrı taskta tamamlandıktan sonra erken-hydrated işareti verilmelidir.');
assert.match(earlyHomeRenderer, /window\.__XYZ_EARLY_HOME_RENDERED__ = true;[\s\S]*xyz:football-home-early-ready/, 'Erken root tamamlandığında tam UI handoff olayı yayınlanmalıdır.');
assert.match(earlyHomeRenderer, /bindEarlyLeagueButton\(button, key\)/, 'Erken kök lig seçici tam UI geldiğinde SPA lig geçişine bağlanabilmelidir.');
assert.match(earlyHomeRenderer, /button\.dataset\.scoreboardFilter\s*=\s*entry\[0\]/, 'Erken filtreler canonical renderer tarafından yeniden bağlanabilecek kapsam işaretini taşımalıdır.');
const fullOverviewRenderer = sourceBetween(uiSource, 'function syncEarlyLeagueOverview', 'function renderFootballHome');
assert.match(fullOverviewRenderer, /root\.dataset\.earlyLeagueHydrated===leagueKey/, 'Tam renderer yalnız aynı lig için erken DOM’u yeniden kullanmalı.');
assert.match(fullOverviewRenderer, /syncEarlyLeagueOverview\(root,\{leagueKey,label,country,seasonLabel,logo,initialRows,initialMatches\}\)/, 'Tam renderer erken DOM’u bağlayıp veriyle senkronlamalı.');
assert.match(fullOverviewRenderer, /tablePanel\.insertAdjacentHTML\('beforeend',leagueOverviewTableHTML\(initialRows\)\)/, 'Tam renderer root’u korurken erken tablo gövdesini canonical crest, form ve arşiv işaretleriyle yükseltmeli.');
assert.match(fullOverviewRenderer, /fixtureBody\.innerHTML=leagueOverviewFixturesHTML\(initialMatches\)/, 'Tam renderer erken fixture gövdesini canonical maç semantiğiyle eşitlemeli.');
assert.match(fullOverviewRenderer, /tablePanel\.insertAdjacentHTML[\s\S]*setTimeout\(\(\)=>\{[\s\S]*fixtureBody\.innerHTML/, 'Erken lig tablosu ve fixture canonical yükseltmeleri iki ayrı macrotaskta yapılmalı.');
assert.match(fullOverviewRenderer, /if\(!reusedEarly\)\{[\s\S]*root\.innerHTML=/, 'Tüm root innerHTML değişimi yalnız erken DOM yeniden kullanılamadığında yapılmalı.');
const fullHomeRenderer = sourceBetween(uiSource, 'function footballHomeLeagueGroupContent', 'function leagueOverviewCountry');
assert.match(fullHomeRenderer, /syncEarlyFootballScoreboard\(root,\{grouped,featured,featuredState,tableLeague\}\)/, 'Tam kök renderer dolu erken skor tablosunu yeniden kullanmalı.');
assert.match(fullHomeRenderer, /root\.dataset\.earlyRendering==='true'[\s\S]*waitForEarlyFootballHomeHandoff\(root\);[\s\S]*return;/, 'Tam UI devam eden erken root çizimini yarıda kesmemeli.');
assert.match(fullHomeRenderer, /addEventListener\('xyz:football-home-early-ready',resume,[\s\S]*fallbackTimer=setTimeout\(resume,1500\)/, 'Handoff erken-ready olayıyla sürmeli ve takılan renderer için sınırlı fallback taşımalı.');
assert.match(fullHomeRenderer, /existingGroups\[nextLeague\][\s\S]*setTimeout\(upgradeLeague,0\)/, 'Canonical kök yükseltmesi bir taskta yalnız bir lig grubunu değiştirmeli.');
assert.match(fullHomeRenderer, /setTimeout\(\(\)=>\{[\s\S]*feature\.innerHTML=footballHomeFeatureContent/, 'Öne çıkan maç ve mini puan tablosu lig gruplarından ayrı taskta yükseltilmeli.');
assert.match(buildSource, /let canonicalLeanHtml[\s\S]*weekSelector[\s\S]*page-league[\s\S]*removeMarkedBlock[\s\S]*fragmentContracts[\s\S]*fragmentDirectory/, 'Bare canonical production rotaları yalnız erken futbol shell’ini taşımalı; etkileşim DOM’u açık sözleşmeli fragmentlere ayrılmalı.');
assert.match(buildSource, /leagues\.includes\(route\) \|\| route === "futbol" \? canonicalLeanHtml : routeReadyHtml/, 'Yalnız çıplak lig rotaları ve futbol kökü lean olmalı; section ve Predict belgeleri tam DOM’u korumalı.');

const sectionFallbacks = [];
const leanSectionContext = vm.createContext({
  activeFootballSection: 'home',
  activeFootballLeague: 'premier-league',
  activeTransferCenterTab: 'confirmed',
  document: { getElementById: () => null },
  location: { assign: (path) => sectionFallbacks.push(path) },
  buildFootballPath: (league, section) => `/${league}/${section}`,
  abortLeagueTransferRequestsExcept() {},
});
vm.runInContext(sourceBetween(uiSource, 'function openFootballSection', 'function scrollFootballSection'), leanSectionContext, { filename:'lean-section-fallback.js' });
vm.runInContext("openFootballSection('matches')", leanSectionContext);
assert.deepEqual(sectionFallbacks, ['/premier-league/matches'], 'Lean lig shell’inde çıkarılmış section hedefi güvenli tam navigasyona dönmeli.');

const productFallbacks = [];
const leanProductContext = vm.createContext({
  document: { getElementById: () => null },
  location: { assign: (path) => productFallbacks.push(path) },
  rememberFootballReturnPath() {},
});
vm.runInContext(sourceBetween(liveSource, 'function switchMainTab', 'function openStories'), leanProductContext, { filename:'lean-product-fallback.js' });
vm.runInContext("switchMainTab('predict')", leanProductContext);
assert.deepEqual(productFallbacks, ['/predict'], 'Lean canonical belgede çıkarılmış Predict hedefi güvenli tam navigasyona dönmeli.');

// Bundle seçimini sabit bir İstanbul günüyle çalıştırarak gece yarısı ve makine
// saat diliminden bağımsız, tekrarlanabilir fikstür semantiği doğruluyoruz.
const fixedNow = Date.parse('2026-08-24T09:00:00.000Z'); // İstanbul 12.00
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [fixedNow])); }
  static now() { return fixedNow; }
  static parse(value) { return Date.parse(value); }
  static UTC(...args) { return Date.UTC(...args); }
}

const bundleContext = vm.createContext({
  Date: FixedDate,
  Intl,
  String,
  Boolean,
  Number,
  Set,
  Array,
  FOOTBALL_HOME_LEAGUES: expectedLeagues,
});
vm.runInContext(
  sourceBetween(dataSource, 'function normalizeClientFootballStatus', 'function matchInActiveTeam'),
  bundleContext,
  { filename: 'data-status-contract.js' },
);
vm.runInContext(
  sourceBetween(dataSource, 'function compactFootballHomeBundle', 'async function fetchFootballHomeBundle'),
  bundleContext,
  { filename: 'data-football-home-bundle.js' },
);

const bundles = [
  {
    league: 'super-lig',
    standings: [],
    matches: [
      { id: 'live-now', kickoff: '2026-08-24T08:30:00.000Z', status: 'live', minute: 31, ev: 'Canlı Ev', konuk: 'Canlı Konuk' },
      { id: 'super-upcoming', kickoff: '2026-08-25T10:00:00.000Z', status: 'scheduled', ev: 'Yaklaşan Ev', konuk: 'Yaklaşan Konuk' },
      { id: 'past-without-status', kickoff: '2026-08-23T12:00:00.000Z', ev: 'Eski Ev', konuk: 'Eski Konuk' },
      { id: 'today-past-without-status', kickoff: '2026-08-24T08:00:00.000Z', ev: 'Bugün Eski Ev', konuk: 'Bugün Eski Konuk' },
      { id: 'zero-draw', kickoff: '2026-08-22T12:00:00.000Z', ev: 'Sıfır Ev', konuk: 'Sıfır Konuk' },
    ],
    results: [{ match_id: 'zero-draw', home: 0, away: 0 }],
  },
  {
    league: 'premier-league',
    standings: [],
    matches: [
      { id: 'tomorrow', kickoff: '2026-08-25T12:00:00.000Z', status: 'scheduled', ev: 'Yarın Ev', konuk: 'Yarın Konuk' },
      { id: 'cancelled-future', kickoff: '2026-08-26T12:00:00.000Z', status: 'iptal', ev: 'İptal Ev', konuk: 'İptal Konuk' },
      { id: 'postponed-future', kickoff: '2026-08-27T12:00:00.000Z', status: 'ertelendi', ev: 'Erteleme Ev', konuk: 'Erteleme Konuk' },
    ],
    results: [],
  },
  { league: 'la-liga', standings: [], matches: [], results: [] },
  { league: 'bundesliga', standings: [], matches: [], results: [] },
  { league: 'serie-a', standings: [], matches: [], results: [] },
];

bundleContext.__bundles = bundles;
const compact = vm.runInContext('compactFootballHomeBundle(__bundles)', bundleContext);
const compactIds = Array.from(compact.matches, (match) => match.id);
assert.ok(!compactIds.includes('past-without-status'), 'Geçmiş ama sonuç/durum doğrulaması olmayan maç recent sayılmamalı.');
assert.ok(!compactIds.includes('today-past-without-status'), 'Bugün başlamış ama canlı/bitti doğrulaması gelmemiş kayıt ana vitrinde beklemede kalmamalı.');
assert.ok(!compactIds.includes('cancelled-future'), 'İptal edilmiş gelecek maç upcoming sayılmamalı.');
assert.ok(!compactIds.includes('postponed-future'), 'Ertelenmiş gelecek maç upcoming sayılmamalı.');
assert.ok(compactIds.includes('tomorrow'), 'Yarın oynanacak doğrulanmış fikstür kompakt bundle içinde korunmalı.');
assert.ok(compactIds.includes('super-upcoming'), 'Aynı ligde yaklaşan maç varken geçmiş sonuç arşivden düşmemeli.');
assert.ok(compactIds.includes('zero-draw'), 'Ayrı sonuç kaydıyla doğrulanan geçmiş 0-0 maç recent içinde korunmalı.');
assert.equal(compactIds[0], 'live-now', 'Doğrulanmış canlı maç tüm ligler paketinde ilk sırada olmalı.');
assert.ok(compactIds.indexOf('super-upcoming') < compactIds.indexOf('zero-draw'), 'Lig sırası canlı, yaklaşan ve geçmiş şeklinde olmalı.');
assert.match(workerSource, /const liveRows = rows\.filter[\s\S]*\.\.\.liveRows, \.\.\.todays, \.\.\.upcoming, \.\.\.recent[\s\S]*rightLive - leftLive/, 'Edge ana sayfa paketi de canlıyı öne alıp geçmiş sonuçları yaklaşanlarla birlikte taşımalı.');
assert.match(uiSource, /function footballHomeDisplayOrder[\s\S]*const priority=\{live:0,upcoming:1,finished:2,unavailable:3\}/, 'Tam arayüz canlı maçları lig satırlarında da ilk sıraya koymalı.');
const zeroResult = Array.from(compact.results).find((result) => result.match_id === 'zero-draw');
assert.ok(zeroResult, 'Seçilen 0-0 maçın sonuç kaydı bundle içinde taşınmalı.');
assert.equal(zeroResult.home, 0, '0-0 sonucun ev sahibi sıfırı falsy kabul edilip kaybolmamalı.');
assert.equal(zeroResult.away, 0, '0-0 sonucun deplasman sıfırı falsy kabul edilip kaybolmamalı.');

const uiElements = new Map();
const element = (id) => {
  if (!uiElements.has(id)) uiElements.set(id, { id, hidden: false, innerHTML: '', dataset: {}, querySelector: () => null, querySelectorAll: () => [] });
  return uiElements.get(id);
};
const bodyClasses = new Set();
const assignedUrls = [];
const labels = new Map([
  ['super-lig', 'Süper Lig'],
  ['premier-league', 'Premier League'],
  ['la-liga', 'La Liga'],
  ['bundesliga', 'Bundesliga'],
  ['serie-a', 'Serie A'],
]);
const tomorrowKickoff = '2026-08-25T12:00:00.000Z';
const uiMatches = expectedLeagues.map((league, index) => ({
  id: `fixture-${index + 1}`,
  league_key: league,
  ev: `${labels.get(league)} Ev`,
  konuk: `${labels.get(league)} Konuk`,
  kickoff: tomorrowKickoff,
  status: 'scheduled',
}));
const uiContext = vm.createContext({
  Date: FixedDate,
  Intl,
  URL,
  String,
  Number,
  Boolean,
  Array,
  Set,
  MATCHES: uiMatches,
  FOOTBALL_HOME_AVAILABILITY: Object.fromEntries(expectedLeagues.map((league) => [league, true])),
  FOOTBALL_HOME_STANDINGS: {},
  document: {
    body: {
      classList: {
        add: (...names) => names.forEach((name) => bodyClasses.add(name)),
        remove: (...names) => names.forEach((name) => bodyClasses.delete(name)),
      },
    },
    getElementById: element,
  },
  location: {
    origin: 'https://xyzskor.test',
    assign: (url) => assignedUrls.push(String(url)),
  },
  setFootballOverviewChromeHidden() {},
  competitionLabelBySlug: (key) => labels.get(key) || key,
  competitionSlug: (value) => value,
  competitionName: (match) => match.league_key,
  crestHTML: (team) => `<i>${team}</i>`,
  escapeHTML: (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
  fmtTime: () => '15:00',
  getResult: () => null,
});
vm.runInContext(
  sourceBetween(dataSource, 'function normalizeClientFootballStatus', 'function matchInActiveTeam'),
  uiContext,
  { filename: 'ui-status-contract.js' },
);
vm.runInContext(
  sourceBetween(uiSource, 'function footballHomeMatchState', 'function leagueOverviewCountry'),
  uiContext,
  { filename: 'ui-football-scoreboard.js' },
);
vm.runInContext('renderFootballScoreboardHome()', uiContext);
const scoreboardHtml = element('footballScoreboardHome').innerHTML;
assert.equal(count(scoreboardHtml, /<section class="scoreboard-league-group"/g), 5, 'Ana futbol rendererı beş ayrı lig grubu üretmeli.');
assert.equal(count(scoreboardHtml, /class="scoreboard-predict"/g), 5, 'Her ligdeki maç doğrudan Predict eylemi taşımalı.');
assert.match(scoreboardHtml, /class="scoreboard-picks"[\s\S]*>1<\/button>[\s\S]*>X<\/button>[\s\S]*>2<\/button>/, 'Öne çıkan maç 1-X-2 Predict girişini göstermeli.');
let previousIndex = -1;
for (const league of expectedLeagues) {
  const currentIndex = scoreboardHtml.indexOf(labels.get(league));
  assert.ok(currentIndex > previousIndex, `${labels.get(league)} ana sayfada doğru sırada görünmeli.`);
  previousIndex = currentIndex;
}

vm.runInContext("openFootballPredict('fixture-1','X')", uiContext);
assert.equal(assignedUrls.length, 1, 'Predict eylemi tek bir rota geçişi üretmeli.');
const predictUrl = new URL(assignedUrls[0]);
assert.equal(predictUrl.pathname, '/', 'Predict maçı kök maç merkezinde açılmalı.');
assert.equal(predictUrl.searchParams.get('fixture'), 'fixture-1', 'Predict rotası seçilen fixture kimliğini korumalı.');
assert.equal(predictUrl.searchParams.get('pick'), 'X', '1-X-2 hızlı seçimi Predict rotasına taşınmalı.');

assert.match(indexSource, /id="footballScoreboardHome"/, 'Kök beş-lig vitrini için ayrı DOM hedefi bulunmalı.');
assert.match(indexSource, /id="footballLeagueOverview"/, 'Lig genel bakışı için kök vitrinden ayrı DOM hedefi bulunmalı.');
const routeCalls = [];
const routeContext = vm.createContext({
  activeFootballLeague: 'all',
  renderFootballScoreboardHome: () => routeCalls.push('scoreboard'),
  renderFootballLeagueOverview: () => routeCalls.push('overview'),
});
vm.runInContext(sourceBetween(uiSource, 'function renderFootballHome', 'function scrollToLiveCenter'), routeContext);
vm.runInContext('renderFootballHome()', routeContext);
assert.deepEqual(routeCalls, ['scoreboard'], 'Tüm ligler rotası yalnızca beş-lig ana vitrini render etmeli.');
vm.runInContext("activeFootballLeague='super-lig'; renderFootballHome()", routeContext);
assert.deepEqual(routeCalls, ['scoreboard', 'overview'], 'Tek lig rotası aggregate vitrin yerine lig genel bakışını render etmeli.');

// Mevcut matchday testinden bağımsız en küçük çalışma zamanı smoke'u: `/`
// açılışında guard, herhangi bir season resolver veya zamanlayıcı kurulmadan döner.
// A live poll must update the currently visible football home surface as well as
// the dedicated live center. Otherwise the same fixture can show two scores.
let scoreboardRenders = 0;
let exitedLiveVerifications = 0;
let livePollPayload = {
  updatedAt: '2026-08-24T12:00:00.000Z',
  nextRefreshInSeconds: 6,
  matches: [{ id: 'sportmonks:42', status: 'live', minute: 38, addedTime: null, home: { score: 2 }, away: { score: 1 } }],
};
const storedLiveMatch = { id: 'sportmonks:42', status: 'scheduled', minute: null, ev: 'Home', konuk: 'Away' };
const liveContext = vm.createContext({
  activeFootballLeague: 'all',
  activeFootballSection: 'home',
  liveFeedAbortController: null,
  liveFeedRequestSeq: 0,
  liveFeedRequestScope: null,
  liveFeedLoading: false,
  liveFeedNextRefreshMs: 0,
  LIVE_FEED: { matches: [], loaded: false, stale: false, error: null },
  LIVE_FEED_CONFIG: { functionName: 'football-live', scope: 'all', refreshMs: 30000 },
  MATCHES: [storedLiveMatch],
  ALL_RESULTS: {},
  AbortController,
  CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
  document: {
    hidden: false,
    body: { classList: { contains: () => false } },
    getElementById: (id) => id === 'page-story' ? { classList: { contains: (name) => name === 'active' } } : null,
  },
  window: { dispatchEvent() {} },
  footballLeagueRequestKey: () => 'all',
  footballLiveDemandActive: () => true,
  stopLiveFeed() {},
  refreshLiveProviderLabel() {},
  renderLiveFeed() {},
  renderFootballQuickMatches() {},
  renderFootballScoreboardHome: () => { scoreboardRenders += 1; },
  renderFootballLeagueOverview() {},
  footballStatusIsLive: (match) => ['live', 'canlı', 'halftime', 'devre_arasi'].includes(String(match?.status || match)),
  verifyExitedLiveFixture: () => { exitedLiveVerifications += 1; },
  normalizedLiveMatch: (match) => ({ id:String(match.id), ev:match.home.name, konuk:match.away.name, kickoff:match.startedAt, status:'canlı', minute:match.minute, competition:'Premier League', league_key:'premier-league', result:{ home:Number(match.home.score), away:Number(match.away.score) } }),
  scheduleNextLivePoll() {},
  clampLiveRefreshMs: () => 6000,
  fetch: async () => ({
    ok: true,
    json: async () => livePollPayload,
  }),
  sb: { functions: { invoke: async () => ({ error: new Error('Fallback must not be used.'), data: null }) } },
  console,
});
vm.runInContext(sourceBetween(liveSource, 'async function loadLiveFeed', 'function clampLiveRefreshMs'), liveContext, { filename: 'live-home-sync.js' });
await vm.runInContext('loadLiveFeed(false)', liveContext);
assert.equal(storedLiveMatch.status, 'canlı', 'Live status must be merged into the season fixture.');
assert.equal(storedLiveMatch.minute, 38, 'Live minute must be merged into the season fixture.');
assert.equal(storedLiveMatch.result.home, 2, 'Live home score must be visible to aggregate cards.');
assert.equal(storedLiveMatch.result.away, 1, 'Live away score must be visible to aggregate cards.');
assert.equal(scoreboardRenders, 1, 'A changed live score must rerender the open five-league scoreboard once.');

livePollPayload = { updatedAt:'2026-08-24T12:01:00.000Z', nextRefreshInSeconds:60, reason:'no_live_matches', stale:false, matches:[] };
await vm.runInContext('loadLiveFeed(false)', liveContext);
assert.equal(storedLiveMatch.livePendingVerification, true, 'A fixture leaving authoritative in-play must exit the CANLI state immediately.');
assert.equal(exitedLiveVerifications, 1, 'A fixture leaving in-play must trigger one authoritative fixture verification.');
assert.equal(scoreboardRenders, 2, 'The live-to-empty transition must refresh the canonical scoreboard.');

liveContext.MATCHES = [];
livePollPayload = { updatedAt:'2026-08-24T12:02:00.000Z', nextRefreshInSeconds:6, stale:false, matches:[{ id:'sportmonks:99', status:'live', minute:4, startedAt:'2026-08-24T11:58:00.000Z', competition:'Premier League', home:{name:'Arsenal',score:1}, away:{name:'Chelsea',score:0} }] };
await vm.runInContext('loadLiveFeed(false)', liveContext);
assert.equal(liveContext.MATCHES.length, 1, 'A live fixture missing from the compact season subset must be upserted.');
assert.equal(liveContext.MATCHES[0].league_key, 'premier-league', 'An upserted live fixture must retain its league scope.');
assert.equal(scoreboardRenders, 3, 'A newly discovered live fixture must refresh the canonical scoreboard.');

let matchdayFetches = 0;
const matchdayElements = new Map([
  ['matchdayLiveRoot', { hidden: false, style: {} }],
  ['matchdaySync', { hidden: false, style: {} }],
  ['matchdayCommand', { hidden: false, style: {} }],
]);
const matchdayContext = vm.createContext({
  URLSearchParams,
  location: { pathname: '/', search: '' },
  window: { location: { hash: '' }, addEventListener() {} },
  document: {
    readyState: 'complete',
    body: { classList: { toggle() {} } },
    getElementById: (id) => matchdayElements.get(id) || null,
    addEventListener() {},
  },
  fetch: async () => { matchdayFetches += 1; throw new Error('Aggregate home must not fetch matchday data.'); },
});
vm.runInContext(matchdaySource, matchdayContext, { filename: 'matchday-root-smoke.js' });
await new Promise((resolve) => setImmediate(resolve));
assert.equal(matchdayFetches, 0, 'Kök futbol ana sayfası ikinci bir /season matchday isteği başlatmamalı.');
assert.equal(matchdayElements.get('matchdayCommand').hidden, true, 'Aggregate ana sayfada eski tek-lig matchday komutu gizli kalmalı.');

console.log('Football information architecture checks passed (5 leagues, bundle semantics, Predict routing, league split, root request guard).');
