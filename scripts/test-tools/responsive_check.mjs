// XYZSKOR responsive/gorsel regresyon harness'i (2026-08-21).
// Devir belgesindeki acik: "Mobil 320, 375, 390, 768 ve desktop 1440 icin
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
const VIEWPORTS = [
  { name: '320-mobil-kucuk', width: 320, height: 720 },
  { name: '375-iphone-se', width: 375, height: 812 },
  { name: '390-iphone-14', width: 390, height: 844 },
  { name: '768-tablet', width: 768, height: 1024 },
  { name: '1440-masaustu', width: 1440, height: 900 },
];
const ROUTES = [
  { name: 'anasayfa', path: '/' },
  { name: 'super-lig-maclar', path: '/super-lig/matches' },
  { name: 'predict', path: '/predict' },
  { name: 'basketbol', path: '/basketbol/' },
];

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

function mockFor(url) {
  if (MODE === 'nodata') {
    if (url.includes('/api/media/youtube')) return [{ error: 'youtube_not_configured', channels: [], items: [] }, 503];
    return [{ error: 'sportmonks_not_configured', provider: 'sportmonks' }, 503];
  }
  if (url.includes('/api/football/season')) return [mockSeason, 200];
  if (url.includes('/api/football/coverage')) return [{ source: 'sportmonks', updatedAt: iso, selected: [{ league: 'super-lig', leagueId: '600', name: 'Süper Lig', available: true, metadataAvailable: true, currentSeasonId: '1' }] }, 200];
  if (url.includes('/api/football/live')) return [{ source: 'sportmonks', league: 'super-lig', updatedAt: iso, matches: [], coverage: {}, degraded: false }, 200];
  if (url.includes('/api/football/matchday')) return [{ source: 'sportmonks', provider: 'sportmonks', updatedAt: iso, degraded: false, fixture: mockSeason.matches[0], details: { events: [], statistics: [], lineups: [] } }, 200];
  if (url.includes('/api/football/transfers')) return [{ source: 'sportmonks', league: 'super-lig', updatedAt: iso, confirmed: [], rumours: [], errors: [] }, 200];
  if (url.includes('/api/media/youtube')) return [{ source: 'youtube-data-api-v3', updated_at: iso, channels: [], items: [] }, 200];
  if (url.includes('/api/social/')) return [{ source: 'mock', league: 'super-lig', updated_at: iso, clubs: [], publishers: [], items: [] }, 200];
  if (url.includes('/api/health')) return [{ status: 'ok', checks: {} }, 200];
  if (url.includes('/api/predict-game/status')) return [{ authenticated: false, reward_eligible: false, training: false }, 200];
  if (url.includes('/api/sports/today')) return [{ source: 'mock', date: iso.slice(0,10), sports: { basketball: [
    { id:'basket-1', sport:'basketball', league:'Basketbol Süper Ligi', status:'scheduled', first:{name:'Anadolu Efes'}, second:{name:'Fenerbahçe Beko'} },
    { id:'kirli-football', sport:'football', league:'Süper Lig', status:'finished', first:{name:'Galatasaray'}, second:{name:'Beşiktaş'} },
  ], volleyball: [] } }, 200];
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
      page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 240)));
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
      // Harici host (CDN, Supabase, gorsel) sandbox'ta yok; bos yanit ver.
      await page.route('**://**', async (r) => {
        const url = r.request().url();
        // Tek route katmani kullan: ikinci bir genel route, API mock'unu
        // `continue()` ile yanlışlıkla atlayıp canlı backend'e kaçırmasın.
        if (url.startsWith(BASE) && new URL(url).pathname.startsWith('/api/')) {
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
              overflowPx: Math.round(rect.right - vw),
            });
          }
        }
        overflowing.sort((a, b) => b.overflowPx - a.overflowPx);
        const smallTargets = [...document.querySelectorAll('a[href],button,[role="button"],input,select')]
          .filter((el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.display !== 'none' && r.height < 32; }).length;
        return {
          docScrollWidth: doc.scrollWidth,
          viewportWidth: vw,
          horizontalOverflowPx: Math.max(0, doc.scrollWidth - vw),
          overflowingElements: overflowing.slice(0, 6),
          overflowingCount: overflowing.length,
          smallTouchTargets: smallTargets,
          activeTabPage: document.querySelector('.tabpage.active')?.id || null,
          visibleTextLength: (document.body.innerText || '').trim().length,
          skeletons: document.querySelectorAll('.skeleton').length,
          multisportText: document.getElementById('multiSportGrid')?.innerText || '',
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
      if(route.name === 'basketbol'){
        ok(!/Galatasaray|Beşiktaş|Futbol/.test(metrics.multisportText), `${tag}: futbol verisi basketbola sizmiyor`, metrics.multisportText.slice(0,240));
        ok(/Anadolu Efes|Fenerbahçe Beko/.test(metrics.multisportText), `${tag}: basketbol verisi gorunuyor`, metrics.multisportText.slice(0,240));
      }
      report.push({ route: route.name, viewport: viewport.name, mode: MODE, pageErrors, consoleErrors, metrics, screenshot: shot });
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
