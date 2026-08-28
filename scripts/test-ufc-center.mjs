import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { launchChromium } from './test-tools/lib/playwright-loader.mjs';

const PORT = Number(process.env.XYZSKOR_UFC_TEST_PORT || 4407);
const BASE = `http://127.0.0.1:${PORT}`;
const now = new Date('2026-08-28T12:00:00.000Z').toISOString();
const event = {
  id:'event-1', slug:'ufc-fight-night-test', title:'UFC Fight Night: Nurmagomedov vs Song',
  shortTitle:'Nurmagomedov vs Song', status:'scheduled', startsAt:'2026-08-29T10:00:00.000Z',
  venue:'Oriental Sports Center', country:'China', locationText:'Oriental Sports Center, China',
  dataAvailability:{ bouts:'available' },
};
const fighters = [
  { slug:'umar-nurmagomedov', fighterName:'Umar Nurmagomedov', name:'Umar Nurmagomedov', division:'Bantamweight', recordText:'20-1-0', proxiedImageUrl:'https://api.citoapi.com/fighter-a.png' },
  { slug:'song-yadong', fighterName:'Song Yadong', name:'Song Yadong', division:'Bantamweight', recordText:'23-9-1', proxiedImageUrl:'https://api.citoapi.com/fighter-b.png' },
  { slug:'petr-yan', fighterName:'Petr Yan', name:'Petr Yan', division:'Bantamweight', recordText:'20-5-0', proxiedImageUrl:'https://api.citoapi.com/fighter-c.png', championStatus:'champion' },
  { slug:'islam-makhachev', fighterName:'Islam Makhachev', name:'Islam Makhachev', division:'Welterweight', recordText:'29-1-0', proxiedImageUrl:'https://api.citoapi.com/fighter-d.png', championStatus:'champion' },
];
const rankings = [
  { ...fighters[2], rankText:'C', isChampion:true },
  { ...fighters[0], rank:1, rankText:'1' },
  { ...fighters[1], rank:2, rankText:'2' },
  { ...fighters[3], rankText:'C', isChampion:true },
  { slug:'jack-della', fighterName:'Jack Della Maddalena', division:'Welterweight', rank:1, rankText:'1', recordText:'19-3-0' },
];
const bouts = [
  { id:'bout-1', cardPosition:'Main Card 1', cardSection:'Main Card', weightClass:'Bantamweight', status:'confirmed', fighters:[{ ...fighters[1], corner:'red' }, { ...fighters[0], corner:'blue' }] },
  { id:'bout-2', cardPosition:'Main Card 2', cardSection:'Main Card', weightClass:"Women's Strawweight", status:'confirmed', fighters:[{ fighterName:'Denise Gomes', corner:'red' }, { fighterName:'Yan Xiaonan', corner:'blue' }] },
];

const wrapped = (route, data) => ({ source:'citoapi', route, updatedAt:now, data:{ success:true, data } });
const apiBody = (url) => {
  const parsed = new URL(url);
  if (parsed.pathname === '/api/ufc/events/upcoming') return wrapped('events/upcoming', [event]);
  if (parsed.pathname === '/api/ufc/events/ufc-fight-night-test') return wrapped('events/ufc-fight-night-test', { ...event, bouts });
  if (parsed.pathname === '/api/ufc/rankings') return wrapped('rankings', rankings);
  if (parsed.pathname === '/api/ufc/fighters') return wrapped('fighters', fighters);
  return { error:'not_mocked' };
};

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/ufc/`, { method:'HEAD' });
      if (response.ok) return;
    } catch (_error) {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('UFC test sunucusu başlamadı.');
}

const server = spawn(process.execPath, ['scripts/dev-server.mjs'], {
  cwd:new URL('..', import.meta.url),
  env:{ ...process.env, XYZSKOR_DEV_PORT:String(PORT), PORT:String(PORT) },
  stdio:['ignore', 'pipe', 'pipe'],
});
let serverError = '';
server.stderr.on('data', (chunk) => { serverError += String(chunk); });

let browser;
try {
  await waitForServer();
  browser = await launchChromium({ headless:true });
  const context = await browser.newContext({ viewport:{ width:1440, height:900 }, deviceScaleFactor:1 });
  const page = await context.newPage();
  const apiRequests = [];
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.route('**://**', async (route) => {
    const url = route.request().url();
    if (url.startsWith(BASE) && new URL(url).pathname.startsWith('/api/')) {
      apiRequests.push(new URL(url).pathname + new URL(url).search);
      await new Promise((resolve) => setTimeout(resolve, 180));
      const body = apiBody(url);
      return route.fulfill({ status:body.error ? 404 : 200, contentType:'application/json; charset=utf-8', body:JSON.stringify(body) });
    }
    if (url.startsWith(BASE)) return route.continue();
    if (/\.(?:png|webp|jpe?g|gif|svg)(?:\?|$)/i.test(url)) {
      return route.fulfill({ status:200, contentType:'image/gif', body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') });
    }
    return route.fulfill({ status:204, body:'' });
  });

  await page.goto(`${BASE}/ufc/`, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => Boolean(document.getElementById('xyzUfcCenterStylesheet')?.sheet));
  assert.equal(await page.locator('.ufc-center.is-loading').count(), 1, 'UFC ilk yüklemede shimmer kabuğu göstermeli.');
  assert.ok(await page.locator('.ufc-center-skeleton-row').count() >= 6, 'Sıralama yüklenirken satır shimmerları görünmeli.');
  await page.waitForSelector('.ufc-center[data-state="ready"]');

  const desktop = await page.evaluate(() => {
    const shell = document.querySelector('.ufc-center-shell');
    const contentImages = [...document.querySelectorAll('#ufcxContent img')];
    const metricLabels = [...document.querySelectorAll('.ufc-center-metrics article>span')].map((item) => item.textContent.trim());
    return {
      headingCount:document.querySelectorAll('#ufcxContent h1').length,
      heading:document.querySelector('#ufcxContent h1')?.textContent.trim(),
      activeNav:document.querySelector('.ufc-center-nav [aria-current="page"]')?.textContent.trim(),
      rankRows:document.querySelectorAll('.ufc-center-rank-row:not(.ufc-center-skeleton-row)').length,
      eventRows:document.querySelectorAll('.ufc-center-event-row').length,
      metricLabels,
      emptyAlt:contentImages.filter((image) => !image.hasAttribute('alt') || !image.alt.trim()).length,
      shellOverflow:shell.scrollWidth - shell.clientWidth,
      sourceText:document.querySelector('.ufc-center-source-note')?.textContent || '',
      footballChromeHidden:['#matchdayCommand', '.live-ticker', '#footballContextNav', '#footballLeagueCommand']
        .every((selector) => getComputedStyle(document.querySelector(selector)).display === 'none'),
    };
  });
  assert.equal(desktop.headingCount, 1, 'Merkezde yalnız bir H1 bulunmalı.');
  assert.equal(desktop.heading, 'UFC');
  assert.equal(desktop.activeNav, 'Merkez');
  assert.ok(desktop.rankRows >= 3, 'Gerçek sıralama kayıtları oluşturulmalı.');
  assert.equal(desktop.eventRows, 1, 'Sağlayıcıdaki tek etkinlik listelenmeli.');
  assert.deepEqual(desktop.metricLabels, ['YAKLAŞAN KART', 'SIKLET', 'ŞAMPİYON', 'İLK KART']);
  assert.equal(desktop.emptyAlt, 0, 'İçerik görsellerinin açıklayıcı alt metni olmalı.');
  assert.ok(desktop.shellOverflow <= 1, `Masaüstü kabuğu yatay taşmamalı (${desktop.shellOverflow}px).`);
  assert.match(desktop.sourceText, /üretilmez/i, 'Veri kapsamı tahmini veri üretilmediğini açıklamalı.');
  assert.equal(desktop.footballChromeHidden, true, 'UFC dalında futbol maç merkezi ve skor şeritleri görünmemeli.');
  assert.ok(apiRequests.length >= 4 && apiRequests.every((path) => path.startsWith('/api/ufc/')), 'UFC merkezi yalnız UFC API ailesini çağırmalı.');
  assert.deepEqual(pageErrors, [], 'UFC merkezinde sayfa hatası oluşmamalı.');

  const select = page.locator('[data-ufc-division-select]');
  await select.focus();
  const focusOutline = await select.evaluate((element) => getComputedStyle(element).outlineStyle);
  assert.notEqual(focusOutline, 'none', 'Siklet seçimi görünür klavye odağı taşımalı.');
  await select.selectOption({ index:1 });
  assert.equal(await page.locator('[data-ufc-division]:visible').count(), 1, 'Siklet seçimi tek sıralama paneli göstermeli.');

  await page.setViewportSize({ width:390, height:844 });
  const mobile = await page.evaluate(() => {
    const shell = document.querySelector('.ufc-center-shell');
    const navTargets = [...document.querySelectorAll('.ufc-center-nav>a')].map((item) => item.getBoundingClientRect().height);
    return { overflow:shell.scrollWidth - shell.clientWidth, navTargets };
  });
  assert.ok(mobile.overflow <= 1, `Mobil kabuk yatay taşmamalı (${mobile.overflow}px).`);
  assert.ok(mobile.navTargets.every((height) => height >= 44), 'Mobil ana sekmeler en az 44px dokunma hedefi olmalı.');

  const errorPage = await context.newPage();
  await errorPage.route('**/api/**', (route) => route.fulfill({ status:503, contentType:'application/json', body:JSON.stringify({ error:'provider_refresh_in_progress' }) }));
  await errorPage.goto(`${BASE}/ufc/`, { waitUntil:'domcontentloaded' });
  await errorPage.waitForFunction(() => Boolean(document.getElementById('xyzUfcCenterStylesheet')?.sheet));
  await errorPage.waitForSelector('.ufc-center[data-state="error"]');
  assert.equal(await errorPage.locator('#ufcxContent h1').innerText(), 'UFC', 'Hata görünümü branş kimliğini korumalı.');
  assert.equal(await errorPage.locator('[data-ufc-retry]').count(), 1, 'Hata görünümü yeniden deneme kontrolü sunmalı.');
  assert.match(await errorPage.locator('.ufc-center-empty').innerText(), /doğrulanmış boş sonuç değildir/i, 'Bağlantı hatası boş veri gibi sunulmamalı.');

  console.log('OK  UFC lig merkezi: gerçek veri kapsamı, shimmer, responsive ve erişilebilirlik kontrolleri geçti.');
} finally {
  await browser?.close();
  server.kill();
  if (serverError && !browser) console.error(serverError);
}
