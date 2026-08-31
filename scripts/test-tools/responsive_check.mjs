// XYZSKOR responsive/gorsel regresyon harness'i (2026-08-21).
// Mobil 320, 360, 375, 390, 430, tablet 768 ve desktop 1440 icin
// gorsel regresyon seti olusturulmali".
//
// Ne yapar:
//  - dev-server'i kendisi ayaga kaldirir (harici baglanti gerekmez)
//  - /api/* isteklerini mock'lar (nodata + withdata iki mod)
//  - her genislikte: pageerror, console error, yatay tasma (document ve eleman
//    bazinda), 44px altinda dokunma hedefi, gorunmeyen/kirik yerlesim olcumu
//  - reports/screenshots/responsive/ altina ekran goruntusu yazar
//
// Kullanim: node scripts/test-tools/responsive_check.mjs [nodata|withdata]
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { launchChromium } from './lib/playwright-loader.mjs';

const MODE = process.argv[2] || 'withdata';
const PORT = Number(process.env.XYZSKOR_TEST_PORT || 4291);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = new URL('../../reports/screenshots/responsive/', import.meta.url);
const ALL_VIEWPORTS = [
  { name: '320-mobil-kucuk', width: 320, height: 720 },
  { name: '360-mobil', width: 360, height: 800 },
  { name: '375-iphone-se', width: 375, height: 812 },
  { name: '390-iphone-14', width: 390, height: 844 },
  { name: '430-mobil-genis', width: 430, height: 932 },
  { name: '768-tablet', width: 768, height: 1024 },
  { name: '1440-masaustu', width: 1440, height: 900 },
];
const ALL_ROUTES = [
  // `/` dogrudan bes ligli futbol merkezidir. `/futbol/` ve `/all` takma
  // rotalari kaynak seviyesindeki route sozlesmesi tarafindan ayrica korunur.
  { name: 'anasayfa', path: '/' },
  { name: 'super-lig-overview', path: '/super-lig' },
  { name: 'premier-league-overview', path: '/premier-league' },
  { name: 'la-liga-overview', path: '/la-liga' },
  { name: 'bundesliga-overview', path: '/bundesliga' },
  { name: 'serie-a-overview', path: '/serie-a' },
  { name: 'super-lig-maclar', path: '/super-lig/matches' },
  { name: 'predict', path: '/predict' },
  { name: 'basketbol', path: '/basketbol/' },
  { name: 'voleybol', path: '/voleybol/' },
  { name: 'ufc', path: '/ufc/' },
  { name: 'formula-1', path: '/motorsports/formula-1' },
];
const FOOTBALL_OVERVIEW_ROUTES = new Map([
  ['super-lig-overview', 'super-lig'],
  ['premier-league-overview', 'premier-league'],
  ['la-liga-overview', 'la-liga'],
  ['bundesliga-overview', 'bundesliga'],
  ['serie-a-overview', 'serie-a'],
]);
const TOUCH_TARGET_ROUTES = new Set(['anasayfa', ...FOOTBALL_OVERVIEW_ROUTES.keys()]);
const selectedViewportNames = new Set((process.env.XYZSKOR_TEST_VIEWPORT || '').split(',').map((item) => item.trim()).filter(Boolean));
const selectedRouteNames = new Set((process.env.XYZSKOR_TEST_ROUTE || '').split(',').map((item) => item.trim()).filter(Boolean));
const VIEWPORTS = process.env.XYZSKOR_TEST_VIEWPORT
  ? ALL_VIEWPORTS.filter(({ width, name }) => selectedViewportNames.has(String(width)) || selectedViewportNames.has(name))
  : ALL_VIEWPORTS;
const ROUTES = process.env.XYZSKOR_TEST_ROUTE
  ? ALL_ROUTES.filter(({ name }) => selectedRouteNames.has(name))
  : ALL_ROUTES;

let PASS = 0, FAIL = 0;
const failures = [];
const ok = (cond, label, detail) => {
  if (cond) { PASS++; }
  else { FAIL++; failures.push(`${label}${detail ? ' -> ' + detail : ''}`); }
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${cond ? '' : ' -> ' + (detail || '')}`);
};

const iso = new Date().toISOString();
const mockSeason = {
  source: 'sportmonks-football-api-v3', provider: 'sportmonks', league: 'super-lig', leagueId: '600',
  seasonId: '1', competition: 'Süper Lig', updatedAt: iso,
  matches: [
    { id: 'sportmonks:1', hafta: 1, ev: 'Galatasaray', konuk: 'Fenerbahçe', kickoff: new Date(Date.now() + 864e5).toISOString(), stadyum: 'RAMS Park', status: null, verified: true, competition: 'Süper Lig', provider_league_id: '600' },
    { id: 'sportmonks:2', hafta: 1, ev: 'Beşiktaş', konuk: 'Trabzonspor', kickoff: new Date(Date.now() + 1728e5).toISOString(), stadyum: 'Tüpraş Stadyumu', status: null, verified: true, competition: 'Süper Lig', provider_league_id: '600' },
    { id: 'sportmonks:3', hafta: 1, ev: 'Başakşehir', konuk: 'Samsunspor', kickoff: new Date(Date.now() - 3600e3).toISOString(), stadyum: 'Fatih Terim', status: 'canlı', verified: true, competition: 'Süper Lig', provider_league_id: '600' },
  ],
  results: [], standings: [], coverage: { fixtures: 3, results: 0, standings: 0 }, errors: [],
};
const MOCK_FOOTBALL_LEAGUES = {
  'super-lig':{ label:'Süper Lig', id:'600', teams:['Galatasaray','Fenerbahçe','Beşiktaş','Trabzonspor'] },
  'premier-league':{ label:'Premier League', id:'8', teams:['Arsenal','Liverpool','Manchester City','Chelsea'] },
  'la-liga':{ label:'La Liga', id:'564', teams:['Barcelona','Real Madrid','Atlético Madrid','Villarreal'] },
  bundesliga:{ label:'Bundesliga', id:'82', teams:['Bayern München','Borussia Dortmund','RB Leipzig','Bayer Leverkusen'] },
  'serie-a':{ label:'Serie A', id:'384', teams:['Inter','Milan','Juventus','Napoli'] },
};
function mockSeasonFor(league){
  const scoped=MOCK_FOOTBALL_LEAGUES[league]||MOCK_FOOTBALL_LEAGUES['super-lig'];
  const [first,second,third,fourth]=scoped.teams;
  return {
    ...mockSeason, league, leagueId:scoped.id, competition:scoped.label,
    matches:[
      { ...mockSeason.matches[0], id:`sportmonks:${scoped.id}01`, ev:first, konuk:second, competition:scoped.label, provider_league_id:scoped.id },
      { ...mockSeason.matches[1], id:`sportmonks:${scoped.id}02`, ev:third, konuk:fourth, competition:scoped.label, provider_league_id:scoped.id },
      { ...mockSeason.matches[2], id:`sportmonks:${scoped.id}03`, ev:second, konuk:third, competition:scoped.label, provider_league_id:scoped.id },
    ],
    standings:scoped.teams.map((team,index)=>({team,played:3,won:Math.max(0,3-index),drawn:index?1:0,lost:index,goals_for:8-index,goals_against:2+index,goal_difference:6-index*2,points:9-index*2,form:index%2?'WDW':'WWW',competition:scoped.label,provider_league_id:scoped.id})),
    coverage:{fixtures:3,results:0,standings:4},
  };
}

function requestedLeague(url, fallback = 'super-lig') {
  const requested = new URL(url).searchParams.get('league') || fallback;
  return requested === 'all' || Object.hasOwn(MOCK_FOOTBALL_LEAGUES, requested) ? requested : fallback;
}

function mockFor(url) {
  if (MODE === 'nodata') {
    if (url.includes('/api/media/youtube')) return [{ error: 'youtube_not_configured', channels: [], items: [] }, 503];
    return [{ error: 'sportmonks_not_configured', provider: 'sportmonks' }, 503];
  }
  if (url.includes('/api/football/home')) {
    const bundles=Object.keys(MOCK_FOOTBALL_LEAGUES).map(mockSeasonFor);
    return [{
      version:1, league:'all', source:'sportmonks-football-home', updatedAt:iso,
      matches:bundles.flatMap(bundle=>bundle.matches.map(match=>({...match,league_key:bundle.league}))),
      results:[], standings:[],
      standingsByLeague:Object.fromEntries(bundles.map(bundle=>[bundle.league,bundle.standings.slice(0,5)])),
      availability:Object.fromEntries(bundles.map(bundle=>[bundle.league,true])),
      errors:[],
    }, 200];
  }
  if (url.includes('/api/football/season')) return [mockSeasonFor(requestedLeague(url)), 200];
  if (url.includes('/api/football/leaders')) return [{ league:requestedLeague(url), seasonId:'28203', goals:[], assists:[], yellowCards:[], redCards:[], source:'sportmonks', cacheStatus:'verified-empty', isStale:false, scopeValidated:true }, 200];
  if (url.includes('/api/football/weekly-awards')) return [{ league:requestedLeague(url), seasonId:'28203', roundId:'3', status:'provisional', algorithmVersion:'v1', star:null, teamOfWeek:null, playerScores:[], isStale:false }, 200];
  if (url.includes('/api/football/coverage')) return [{
    source: 'sportmonks', updatedAt: iso,
    selected: Object.entries(MOCK_FOOTBALL_LEAGUES).map(([league, item]) => ({
      league, leagueId: item.id, name: item.label, available: true, metadataAvailable: true, currentSeasonId: '1',
    })),
  }, 200];
  if (url.includes('/api/football/live')) return [{ source: 'sportmonks', league: requestedLeague(url, 'all'), updatedAt: iso, matches: [], coverage: {}, degraded: false }, 200];
  if (url.includes('/api/football/matchday')) return [{ source: 'sportmonks', provider: 'sportmonks', updatedAt: iso, degraded: false, fixture: mockSeason.matches[0], details: { events: [], statistics: [], lineups: [] } }, 200];
  if (url.includes('/api/football/transfers')) return [{ source: 'sportmonks', league: requestedLeague(url), updatedAt: iso, confirmed: [], rumours: [], errors: [] }, 200];
  if (url.includes('/api/football/x-media')) return [{ source: 'x-api', league: requestedLeague(url), status: 'ok', updated_at: iso, clubs: [], publishers: [], errors: [] }, 200];
  if (url.includes('/api/football/x-preseason')) return [{ source: 'x-api', league: requestedLeague(url), status: 'ok', updated_at: iso, clubs: [], errors: [] }, 200];
  if (url.includes('/api/media/youtube')) return [{ source: 'youtube-data-api-v3', league: requestedLeague(url), updated_at: iso, channels: [], items: [] }, 200];
  if (url.includes('/api/social/')) return [{ source: 'mock', league: requestedLeague(url), updated_at: iso, clubs: [], publishers: [], items: [] }, 200];
  if (url.includes('/api/health')) return [{ status: 'ok', checks: {} }, 200];
  if (url.includes('/api/predict-game/session')) return [{ session: { id: '00000000-0000-4000-8000-000000000001', nonce: 'responsive-mock-nonce', reward_eligible: false } }, 200];
  if (url.includes('/api/predict-game/status')) return [{ authenticated: false, reward_eligible: false, training: false }, 200];
  if (url.includes('/api/sports/basketball/standings')) return [{
    source:'api-sports-basketball', provider:'api-sports', sport:'basketball', leagueId:'12', season:'2026-2027', updatedAt:iso,
    standings:['Anadolu Efes','Fenerbahçe Beko','Beşiktaş','Türk Telekom'].map((name,index)=>({
      position:index+1, group:'Normal Sezon', team:{id:index+1,name}, played:4, won:4-index, lost:index,
      pointsFor:360-index*8, pointsAgainst:310+index*7, pointDifference:50-index*15, percentage:(4-index)/4,
    })),
    coverage:{standings:4,groups:1},
  }, 200];
  if (url.includes('/api/sports/today')) {
    const sport = new URL(url).searchParams.get('sport');
    if(sport === 'basketball') return [{ source:'mock', date:iso.slice(0,10), sports:{ basketball:[
      { id:'basket-1', sport:'basketball', league:'Basketbol Süper Ligi', leagueId:12, season:'2026-2027', country:'Türkiye', status:'scheduled', first:{name:'Anadolu Efes'}, second:{name:'Fenerbahçe Beko'} },
    ] } }, 200];
    if(sport === 'volleyball') return [{ source:'mock', date:iso.slice(0,10), sports:{ volleyball:[
      { id:'volley-1', sport:'volleyball', league:'Sultanlar Ligi', status:'scheduled', first:{name:'Eczacıbaşı'}, second:{name:'VakıfBank'} },
    ] } }, 200];
    return [{ error:'invalid_sport' },400];
  }
  if (url.includes('/api/ufc/')) {
    const path = new URL(url).pathname.replace(/^\/api\/ufc\//, '');
    const fighters = [
      { slug:'petr-yan', fighterName:'Petr Yan', division:'Bantamweight', recordText:'20-5-0', championStatus:'champion' },
      { slug:'umar-nurmagomedov', fighterName:'Umar Nurmagomedov', division:'Bantamweight', recordText:'20-1-0' },
      { slug:'song-yadong', fighterName:'Song Yadong', division:'Bantamweight', recordText:'23-9-1' },
    ];
    const event = { id:'ufc-responsive', slug:'ufc-responsive', title:'UFC Fight Night', startsAt:new Date(Date.now()+864e5).toISOString(), locationText:'Shanghai, China', dataAvailability:{bouts:'available'} };
    const bouts = [{ id:'bout-responsive', weightClass:'Bantamweight', fighters:[{...fighters[1],corner:'red'},{...fighters[2],corner:'blue'}] }];
    let data = [];
    if (MODE === 'withdata' && path === 'events/upcoming') data = [event];
    else if (MODE === 'withdata' && path === 'events/ufc-responsive') data = {...event,bouts};
    else if (MODE === 'withdata' && path === 'rankings') data = [{...fighters[0],rankText:'C',isChampion:true},{...fighters[1],rank:1,rankText:'1'},{...fighters[2],rank:2,rankText:'2'}];
    else if (MODE === 'withdata' && path === 'fighters') data = fighters;
    return [{ source:'citoapi', route:path, updatedAt:iso, data:{ success:true, data } }, 200];
  }
  if (url.includes('/api/motorsports')) {
    const parsed = new URL(url);
    const sport = parsed.searchParams.get('sport') || 'formula-1';
    const resource = parsed.searchParams.get('resource') || 'events';
    const data = MODE !== 'withdata' ? []
      : resource === 'standings-drivers' ? [
        { position:1, name:'Lando Norris', number:4, team:'McLaren', points:275 },
        { position:2, name:'Oscar Piastri', number:81, team:'McLaren', points:266 },
        { position:3, name:'Max Verstappen', number:1, team:'Red Bull Racing', points:241 },
      ]
      : resource === 'teams' ? [{ position:1, name:'McLaren', points:541 },{ position:2, name:'Ferrari', points:312 }]
      : [];
    return [{ source:'mock', sport, resource, updatedAt:iso, liveSupported:false, data }, 200];
  }
  return [{ error: 'not_mocked' }, 503];
}

async function waitForServer(retries = 60) {
  for (let i = 0; i < retries; i += 1) {
    try { const res = await fetch(BASE + '/index.html'); if (res.ok) return true; } catch { /* devam */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const server = spawn(process.execPath, ['scripts/dev-server.mjs'], {
    env: { ...process.env, PORT: String(PORT), XYZSKOR_DEV_PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', () => {});
  server.stderr.on('data', () => {});
  if (!await waitForServer()) { server.kill(); throw new Error(`dev-server ${BASE} adresinde ayaga kalkmadi`); }

  const browser = await launchChromium();
  const report = [];
  for (const viewport of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    for (const route of ROUTES) {
      const page = await ctx.newPage();
      const pageErrors = [], consoleErrors = [];
      const requestedApiPaths = [];
      const requestedResourcePaths = [];
      page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 240)));
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const message = m.text();
        // Harici scriptler asagidaki route harness'inda kasitli olarak bos
        // yanitlanir. Chromium bu bos govdenin SRI hash'i gercek Supabase
        // paketine uymadigi icin konsola browser-seviyesinde bir hata yazar;
        // bu uygulama runtime hatasi degildir ve yalniz bu bilinen URL+mesaj
        // ikilisi icin filtrelenir.
        if (/Failed to find a valid digest in the 'integrity' attribute/.test(message)
          && /(?:cdn\.jsdelivr\.net\/npm|unpkg\.com)\/@supabase\/supabase-js@2\.112\.4/.test(message)) return;
        consoleErrors.push(message.slice(0, 200));
      });
      // Harici host (CDN, Supabase, gorsel) sandbox'ta yok; bos yanit ver.
      await page.route('**://**', async (r) => {
        const url = r.request().url();
        if (url.startsWith(BASE)) requestedResourcePaths.push(new URL(url).pathname + new URL(url).search);
        // Tek route katmani kullan: ikinci bir genel route, API mock'unu
        // `continue()` ile yanlışlıkla atlayıp canlı backend'e kaçırmasın.
        if (url.startsWith(BASE) && new URL(url).pathname.startsWith('/api/')) {
          requestedApiPaths.push(new URL(url).pathname + new URL(url).search);
          const [body, status] = mockFor(url);
          return r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        }
        if (url.startsWith(BASE)) return r.continue();
        if (/\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(url)) return r.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') });
        return r.fulfill({ status: 204, body: '' });
      });

      await page.goto(BASE + route.path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      await page.waitForFunction(() => document.querySelectorAll('.skeleton').length === 0, null, { timeout: 5000 }).catch(() => {});

      const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const vw = window.innerWidth;
        const overflowing = [];
        // Yatay kaydirilabilir seride (overflow-x: auto/scroll) tasma tasarim
        // geregidir; yalnizca kaydirilamayan bir kap icinde tasan elemanlar hatadir.
        const inScrollStrip = (node) => {
          for (let p = node.parentElement; p && p !== document.body; p = p.parentElement) {
            const s = getComputedStyle(p);
            if (['auto', 'scroll'].includes(s.overflowX) || ['auto', 'scroll'].includes(s.overflow)) return true;
          }
          return false;
        };
        for (const el of document.querySelectorAll('body *')) {
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          // position:fixed drawer/modal kapali durumda ekran disinda olabilir; onlari sayma.
          if (style.position === 'fixed' && (rect.right <= 0 || rect.left >= vw)) continue;
          if (rect.right > vw + 1 && !inScrollStrip(el)) {
            overflowing.push({
              tag: el.tagName.toLowerCase(),
              cls: String(el.className || '').split(/\s+/).slice(0, 3).join('.'),
              href: el.getAttribute('href') || '',
              text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60),
              parentCls: String(el.parentElement?.className || '').split(/\s+/).slice(0, 3).join('.'),
              overflowPx: Math.round(rect.right - vw),
            });
          }
        }
        overflowing.sort((a, b) => b.overflowPx - a.overflowPx);
        const touchTargetCandidates = [...document.querySelectorAll('a[href],button,[role="button"],input,select,textarea,summary')];
        const isInlineTextLink = (el, style) => {
          if (!el.matches('a[href]') || style.display !== 'inline' || el.closest('nav')) return false;
          return Boolean(el.closest('p,small,figcaption,.legal-copy,.source-transparency,.live-data-note,.section-copy'));
        };
        const isNativeInlineNav = (el, style) => {
          const semanticInlineNav = el.matches('nav a[href]') && style.display === 'inline';
          // Flex layout, footer linklerini computed-style'da blocklastirir; yine de
          // bunlar semantik olarak tek satirlik yasal navigasyon linkleridir.
          const legalFooterNav = el.matches('.legal-footer-links > a[href]');
          if (!semanticInlineNav && !legalFooterNav) return false;
          // Yalniz sinifsiz ve yalniz metinden olusan gercek inline nav linkleri.
          // Semantik nav ve yasal footer disindaki sekme/pill/button kontrolleri
          // bu istisnaya giremez.
          return !el.getAttribute('class') && el.children.length === 0;
        };
        const touchTargetExceptions = [];
        const smallTouchTargetSamples = [];
        for (const el of touchTargetCandidates) {
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (rect.width <= 0 || rect.height <= 0 || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0 || el.hidden || el.matches(':disabled,[aria-hidden="true"]')) continue;
          let exception = '';
          if (isInlineTextLink(el, style)) exception = 'inline-text-link';
          else if (isNativeInlineNav(el, style)) exception = 'native-inline-nav';
          if (exception) {
            touchTargetExceptions.push(exception);
            continue;
          }
          if (rect.width < 44 || rect.height < 44) {
            smallTouchTargetSamples.push({
              tag: el.tagName.toLowerCase(),
              id: el.id || '',
              cls: String(el.className || '').trim().replace(/\s+/g, '.').slice(0, 100),
              text: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
              width: Math.round(rect.width * 10) / 10,
              height: Math.round(rect.height * 10) / 10,
            });
          }
        }
        return {
          docScrollWidth: doc.scrollWidth,
          viewportWidth: vw,
          horizontalOverflowPx: Math.max(0, doc.scrollWidth - vw),
          overflowingElements: overflowing.slice(0, 6),
          overflowingCount: overflowing.length,
          smallTouchTargets: smallTouchTargetSamples.length,
          smallTouchTargetSamples: smallTouchTargetSamples.slice(0, 16),
          touchTargetExceptionCounts: touchTargetExceptions.reduce((counts, reason) => ({ ...counts, [reason]: (counts[reason] || 0) + 1 }), {}),
          activeTabPage: document.querySelector('.tabpage.active')?.id || null,
          visibleTextLength: (document.body.innerText || '').trim().length,
          skeletons: [...document.querySelectorAll('.skeleton')].filter((el)=>el.offsetWidth||el.offsetHeight).length,
          visibleLegacyLiveCenter: (()=>{ const el=document.getElementById('page-live'); return Boolean(el&&(el.offsetWidth||el.offsetHeight)&&getComputedStyle(el).display!=='none'); })(),
          visibleLeagueOverviewTablists: [...document.querySelectorAll('#footballLeagueOverview > .league-overview-tabs')].filter((el)=>el.offsetWidth||el.offsetHeight).length,
          tickerText: document.getElementById('liveTicker')?.innerText?.trim() || '',
          multisportText: document.getElementById('multiSportGrid')?.innerText || '',
          multisportMetricsText: document.querySelector('.basketball-overview-metrics')?.innerText || document.getElementById('multiSportMetrics')?.innerText || '',
          branchCenterText: document.querySelector('#ufcxContent, [data-xms-center]')?.innerText || '',
          canonicalRuntime: {
            hubReady: document.getElementById('xyzFootballHubStyle')?.media === 'all',
            legacyStylesPresent: Boolean(document.getElementById('xyzLegacyStylesheet')),
            uiExtrasPresent: Boolean(document.getElementById('xyzUiExtrasScript')),
            footballRootRoute: document.body.classList.contains('football-root-route'),
            removedGeneralHomePresent: Boolean(document.getElementById('generalHome'))
              || document.body.classList.contains('general-home-route'),
            xmsVisible: (()=>{ const el=document.querySelector('body > .xms-primary'); return Boolean(el&&(el.offsetWidth||el.offsetHeight)&&getComputedStyle(el).display!=='none'); })(),
            sideChatVisible: (()=>{ const el=document.getElementById('sideChatPrototype'); return Boolean(el&&(el.offsetWidth||el.offsetHeight)&&getComputedStyle(el).display!=='none'); })(),
            miniGameVisible: (()=>{ const el=document.getElementById('miniGoalGame'); return Boolean(el&&(el.offsetWidth||el.offsetHeight)&&getComputedStyle(el).display!=='none'); })(),
          },
        };
      });

      const shot = `${route.name}-${viewport.name}-${MODE}.png`;
      await page.screenshot({ path: fileURLToPath(new URL(shot, OUT)), fullPage: false });

      const tag = `${route.name} @ ${viewport.width}px`;
      ok(pageErrors.length === 0, `${tag}: JS sayfa hatasi yok`, pageErrors.join(' | '));
      ok(metrics.horizontalOverflowPx <= 1, `${tag}: yatay tasma yok`, `${metrics.horizontalOverflowPx}px tasma`);
      ok(metrics.overflowingCount === 0, `${tag}: viewport disina cikan eleman yok`, JSON.stringify(metrics.overflowingElements));
      ok(metrics.visibleTextLength > 200, `${tag}: sayfa icerik uretti`, `metin uzunlugu=${metrics.visibleTextLength}`);
      ok(metrics.skeletons === 0, `${tag}: yukleme iskeleti kalmadi`, `iskelet=${metrics.skeletons}`);
      if(MODE === 'withdata'){
        ok(consoleErrors.length === 0, `${tag}: console error yok`, consoleErrors.join(' | '));
      }
      if(TOUCH_TARGET_ROUTES.has(route.name)){
        ok(metrics.smallTouchTargets === 0, `${tag}: etkilesimli hedefler gercek 44x44`, JSON.stringify(metrics.smallTouchTargetSamples));
      }
      if(route.name === 'anasayfa' || FOOTBALL_OVERVIEW_ROUTES.has(route.name)){
        ok(metrics.canonicalRuntime.hubReady, `${tag}: kanonik futbol stili boyamadan once hazir`);
        ok(!metrics.canonicalRuntime.legacyStylesPresent, `${tag}: agir legacy stil ilk acilista yuklenmiyor`);
        ok(!metrics.canonicalRuntime.uiExtrasPresent, `${tag}: istege bagli arayuz modulleri ilk acilista yuklenmiyor`);
        ok(!metrics.canonicalRuntime.xmsVisible&&!metrics.canonicalRuntime.sideChatVisible&&!metrics.canonicalRuntime.miniGameVisible, `${tag}: ilgisiz prototip yuzeyleri futbol merkezine sizmiyor`, JSON.stringify(metrics.canonicalRuntime));
      }
      if(route.name === 'anasayfa'){
        ok(metrics.canonicalRuntime.footballRootRoute, `${tag}: marka koku futbol ana rota sinifini tasiyor`);
        ok(!metrics.canonicalRuntime.removedGeneralHomePresent, `${tag}: kaldirilan genel kart ana sayfasi DOM veya route sinifi olarak yok`);
      }
      if(route.name === 'anasayfa' || FOOTBALL_OVERVIEW_ROUTES.has(route.name) || ['super-lig-maclar','predict'].includes(route.name)){
        ok(requestedApiPaths.every((path)=>!path.startsWith('/api/sports/')&&!path.startsWith('/api/ufc/')&&!path.startsWith('/api/motorsports')), `${tag}: futbol/Predict akisi diger spor API ailelerine dokunmuyor`, requestedApiPaths.join(' | '));
      }
      if(MODE==='withdata'&&route.name==='anasayfa'){
        const rootFootballPaths=requestedApiPaths.filter((path)=>path.startsWith('/api/football/'));
        ok(JSON.stringify([...rootFootballPaths].sort())===JSON.stringify(['/api/football/home','/api/football/live?league=all'].sort()), `${tag}: aggregate futbol acilisi tam olarak home + all live istiyor`, rootFootballPaths.join(' | '));
        ok(requestedApiPaths.filter((path)=>path==='/api/football/home').length===1, `${tag}: bes lig tek kompakt home istegiyle geliyor`, requestedApiPaths.join(' | '));
        ok(!requestedApiPaths.some((path)=>path.startsWith('/api/football/season')||path.startsWith('/api/football/matchday')), `${tag}: aggregate kokte season/matchday tekrari yok`, requestedApiPaths.join(' | '));
        const rootLivePaths=requestedApiPaths.filter((path)=>path.startsWith('/api/football/live'));
        ok(rootLivePaths.length===1&&rootLivePaths[0]==='/api/football/live?league=all', `${tag}: aggregate canli poll ilk acilista tek ve all kapsamli`, requestedApiPaths.join(' | '));
        ok(requestedApiPaths.filter((path)=>path==='/api/football/coverage').length===0, `${tag}: aggregate acilis otomatik coverage istemiyor`, requestedApiPaths.join(' | '));
        ok(requestedApiPaths.filter((path)=>path==='/api/health').length===0, `${tag}: gorunur skor verisi disinda health istegi yok`, requestedApiPaths.join(' | '));
        ok(!metrics.visibleLegacyLiveCenter, `${tag}: kanonik vitrin disinda ikinci canli merkez yok`);
      }
      if(MODE==='withdata'&&FOOTBALL_OVERVIEW_ROUTES.has(route.name)){
        const league=FOOTBALL_OVERVIEW_ROUTES.get(route.name);
        const seasonPaths=requestedApiPaths.filter((path)=>path.startsWith('/api/football/season'));
        const homePaths=requestedApiPaths.filter((path)=>path.startsWith('/api/football/home'));
        const matchdayPaths=requestedApiPaths.filter((path)=>path.startsWith('/api/football/matchday'));
        const livePaths=requestedApiPaths.filter((path)=>path.startsWith('/api/football/live'));
        const leagueFootballPaths=requestedApiPaths.filter((path)=>path.startsWith('/api/football/'));
        ok(JSON.stringify([...leagueFootballPaths].sort())===JSON.stringify([`/api/football/season?league=${league}`,`/api/football/live?league=${league}`,`/api/football/leaders?league=${league}`,`/api/football/weekly-awards?league=${league}`].sort()), `${tag}: lig acilisi kendi season/live ve gorunur haftalik kapsaminda`, leagueFootballPaths.join(' | '));
        ok(seasonPaths.length===1&&seasonPaths[0]===`/api/football/season?league=${league}`, `${tag}: lig genel bakisi yalniz kendi sezonunu bir kez istiyor`, requestedApiPaths.join(' | '));
        ok(homePaths.length===0, `${tag}: lig genel bakisi aggregate home istemiyor`, requestedApiPaths.join(' | '));
        ok(matchdayPaths.length===0, `${tag}: fixture secilmeden matchday istegi yok`, requestedApiPaths.join(' | '));
        ok(livePaths.length===1&&livePaths[0]===`/api/football/live?league=${league}`, `${tag}: lig canli poll ilk acilista yalniz kendi ligini bir kez istiyor`, requestedApiPaths.join(' | '));
        ok(requestedApiPaths.filter(path=>path===`/api/football/leaders?league=${league}`).length===1, `${tag}: gorunur liderlik tek ve secili lig kapsamli`, requestedApiPaths.join(' | '));
        ok(requestedApiPaths.filter(path=>path===`/api/football/weekly-awards?league=${league}`).length===1, `${tag}: gorunur haftalik odul tek ve secili lig kapsamli`, requestedApiPaths.join(' | '));
        ok(requestedApiPaths.filter((path)=>path==='/api/football/coverage').length===0, `${tag}: lig acilisi otomatik coverage istemiyor`, requestedApiPaths.join(' | '));
        ok(requestedApiPaths.filter((path)=>path==='/api/health').length===0, `${tag}: gorunur lig verisi disinda health istegi yok`, requestedApiPaths.join(' | '));
        ok(!metrics.visibleLegacyLiveCenter, `${tag}: lig genel bakisinda ikinci canli merkez yok`);
        ok(metrics.visibleLeagueOverviewTablists===1, `${tag}: lig genel bakisinda tek bolum sekmesi var`, `gorunen sekme=${metrics.visibleLeagueOverviewTablists}`);
        ok(!/Fikstür yükleniyor/i.test(metrics.tickerText), `${tag}: veri geldikten sonra yukleniyor mesaji kalmiyor`, metrics.tickerText);
      }
      if(route.name === 'basketbol'){
        ok(!/Trabzonspor|Futbol/.test(metrics.multisportText), `${tag}: futbol verisi basketbola sizmiyor`, metrics.multisportText.slice(0,240));
        if(MODE==='withdata') ok(/Anadolu Efes|Fenerbahçe Beko/.test(metrics.multisportText), `${tag}: basketbol verisi gorunuyor`, metrics.multisportText.slice(0,240));
        ok(!requestedApiPaths.some((path)=>path.startsWith('/api/football/')), `${tag}: arka planda futbol API'leri yuklenmiyor`, requestedApiPaths.join(' | '));
        const basketballPaths=requestedApiPaths.filter((path)=>path.startsWith('/api/sports/today'));
        ok(basketballPaths.length===1&&basketballPaths[0].startsWith('/api/sports/today?sport=basketball'), `${tag}: basketbol verisi yalniz bir kez ve kendi scope'unda isteniyor`, requestedApiPaths.join(' | '));
        if(MODE==='withdata') ok(/GÜNLÜK PROGRAM[\s\S]*1/i.test(metrics.multisportMetricsText), `${tag}: basketbol metrikleri günlük payload ile doluyor`, metrics.multisportMetricsText);
      }
      if(route.name === 'voleybol'){
        ok(!/Anadolu Efes|Fenerbahçe Beko|Galatasaray|Beşiktaş/.test(metrics.multisportText), `${tag}: futbol ve basketbol verisi voleybola sizmiyor`, metrics.multisportText.slice(0,240));
        if(MODE==='withdata') ok(/Eczacıbaşı|VakıfBank/.test(metrics.multisportText), `${tag}: voleybol verisi gorunuyor`, metrics.multisportText.slice(0,240));
        ok(requestedApiPaths.every((path)=>!path.startsWith('/api/football/')&&!path.startsWith('/api/ufc/')&&!path.startsWith('/api/motorsports')), `${tag}: yalniz voleybol API ailesi kullaniliyor`, requestedApiPaths.join(' | '));
        const volleyballPaths=requestedApiPaths.filter((path)=>path.startsWith('/api/sports/today'));
        ok(volleyballPaths.length===1&&volleyballPaths[0].startsWith('/api/sports/today?sport=volleyball'), `${tag}: voleybol verisi yalniz bir kez ve kendi scope'unda isteniyor`, requestedApiPaths.join(' | '));
        if(MODE==='withdata') ok(/1\s*Gunluk etkinlik/i.test(metrics.multisportMetricsText), `${tag}: voleybol metrikleri ikinci fetch olmadan ortak payload ile doluyor`, metrics.multisportMetricsText);
      }
      if(route.name === 'ufc'){
        ok(requestedApiPaths.every((path)=>path.startsWith('/api/ufc/')), `${tag}: UFC sayfasi baska spor API ailesine dokunmuyor`, requestedApiPaths.join(' | '));
        const duplicateUfcPaths=[...new Set(requestedApiPaths.filter((path,index)=>requestedApiPaths.indexOf(path)!==index))];
        ok(duplicateUfcPaths.length===0, `${tag}: UFC ayni provider endpointini iki kez istemiyor`, duplicateUfcPaths.join(' | '));
        if(MODE==='withdata') ok(/UFC Fight Night|Brandon Moreno|Bantamweight/i.test(metrics.branchCenterText), `${tag}: UFC etkinlik ve siralama verisi gorunur`, metrics.branchCenterText.slice(0,240));
      }
      if(route.name === 'formula-1'){
        ok(requestedApiPaths.every((path)=>path.startsWith('/api/motorsports')), `${tag}: Motor Sporlari baska spor API ailesine dokunmuyor`, requestedApiPaths.join(' | '));
        if(MODE==='withdata') ok(/Lando Norris|McLaren/i.test(metrics.branchCenterText), `${tag}: Motor Sporlari siralama verisi gorunur`, metrics.branchCenterText.slice(0,240));
      }
      let chatSmoke = null;
      if(MODE === 'withdata' && route.name === 'anasayfa' && viewport.width === 390){
        await page.click('#chatLauncher');
        await page.waitForFunction(() => {
          const panel=document.getElementById('chatPanel');
          return Boolean(document.getElementById('xyzLegacyStylesheet')&&panel?.classList.contains('open')&&getComputedStyle(panel).display!=='none');
        }, null, { timeout:5000 }).catch(()=>{});
        chatSmoke = await page.evaluate(() => {
          const panel=document.getElementById('chatPanel');
          return {
            legacyStylesPresent:Boolean(document.getElementById('xyzLegacyStylesheet')),
            panelOpen:Boolean(panel?.classList.contains('open')),
            panelVisible:Boolean(panel&&(panel.offsetWidth||panel.offsetHeight)&&getComputedStyle(panel).display!=='none'),
            ariaHidden:panel?.getAttribute('aria-hidden')||null,
          };
        });
        ok(chatSmoke.legacyStylesPresent&&chatSmoke.panelOpen&&chatSmoke.panelVisible&&chatSmoke.ariaHidden==='false', `${tag}: sohbet ilk tiklamada stilini yukleyip aciliyor`, JSON.stringify(chatSmoke));
      }
      report.push({ route: route.name, viewport: viewport.name, mode: MODE, pageErrors, consoleErrors, requestedApiPaths, requestedResourcePaths, metrics, chatSmoke, screenshot: shot });
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  server.kill();
  await writeFile(new URL(`responsive-report-${MODE}.json`, OUT), JSON.stringify(report, null, 2), 'utf8');

  console.log(`\n=== OZET (${MODE}) === PASS: ${PASS}  FAIL: ${FAIL}`);
  console.log(`Ekran goruntuleri: reports/screenshots/responsive/`);
  if (FAIL) { console.log(failures.map((f) => ' - ' + f).join('\n')); process.exit(1); }
}

main().catch((error) => { console.error('HARNESS HATASI:', error); process.exit(1); });
