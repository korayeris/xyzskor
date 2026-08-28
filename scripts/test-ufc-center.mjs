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
    const classification = document.querySelector('[data-sport-classification="divisions"]');
    const sectionNav = document.querySelector('.ufc-center-nav');
    const contentImages = [...document.querySelectorAll('#ufcxContent img')];
    const metricLabels = [...document.querySelectorAll('.ufc-center-metrics article>span')].map((item) => item.textContent.trim());
    return {
      headingCount:document.querySelectorAll('#ufcxContent h1').length,
      heading:document.querySelector('#ufcxContent h1')?.textContent.trim(),
      activeNav:document.querySelector('.ufc-center-nav [aria-current="page"]')?.textContent.trim(),
      rankRows:document.querySelectorAll('.ufc-center-rank-row:not(.ufc-center-skeleton-row)').length,
      rankingGroups:document.querySelectorAll('[data-ufc-division]').length,
      eventRows:document.querySelectorAll('.ufc-center-event-row').length,
      scopedBouts:document.querySelectorAll('.ufc-center-classified-fights .ufc-center-bout-card').length,
      metricLabels,
      classificationTitle:classification?.querySelector('h2')?.textContent.trim(),
      classificationBeforeSections:Boolean(classification && sectionNav && (classification.compareDocumentPosition(sectionNav) & Node.DOCUMENT_POSITION_FOLLOWING)),
      classificationChoices:[...document.querySelectorAll('[data-ufc-division-rail] [data-classification-key]')].map((item) => ({
        key:item.dataset.classificationKey,
        label:item.textContent.trim(),
        pressed:item.getAttribute('aria-pressed'),
        current:item.getAttribute('aria-current'),
      })),
      titleHook:document.querySelector('[data-classification-title]')?.textContent.trim(),
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
  assert.equal(desktop.rankRows, rankings.length, 'Tümü kapsamı sağlayıcının tüm gerçek sıralama kayıtlarını göstermeli.');
  assert.equal(desktop.rankingGroups, 2, 'Tümü kapsamı gerçek sağlayıcı sıkletlerini ayrı gruplar halinde göstermeli.');
  assert.equal(desktop.eventRows, 1, 'Sağlayıcıdaki tek etkinlik listelenmeli.');
  assert.equal(desktop.scopedBouts, bouts.length, 'Tümü kapsamındaki gerçek müsabakalar dövüş ve sonuç alanında görünmeli.');
  assert.deepEqual(desktop.metricLabels, ['YAKLAŞAN KART', 'SIKLET', 'ŞAMPİYON', 'MÜSABAKA']);
  assert.equal(desktop.classificationTitle, 'SIKLETLER', 'UFC sınıflandırma rayı gerçek taksonomi adıyla sunulmalı.');
  assert.equal(desktop.classificationBeforeSections, true, 'Sıklet rayı ana UFC bölüm sekmelerinden önce gelmeli.');
  assert.deepEqual(desktop.classificationChoices.map((item) => item.label), ['Tümü', 'Bantamweight', 'Welterweight', "Women's Strawweight"], 'Sınıflandırma yalnız sağlayıcının döndürdüğü sıkletlerden oluşmalı.');
  assert.deepEqual(desktop.classificationChoices[0], { key:'all', label:'Tümü', pressed:'true', current:'page' }, 'Tümü seçimi erişilebilir aktif durum taşımalı.');
  assert.equal(desktop.titleHook, 'UFC', 'Seçili merkez başlığı ortak sınıflandırma hookunu korumalı.');
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
  await page.waitForURL(/\?division=bantamweight$/);
  await page.waitForSelector('.ufc-center[data-state="ready"]');
  const bantamweightScope = await page.evaluate(() => ({
    title:document.querySelector('[data-classification-title]')?.textContent.trim(),
    activeKey:document.querySelector('[data-ufc-division-rail] [aria-current="page"]')?.dataset.classificationKey,
    activePressed:document.querySelector('[data-ufc-division-rail] [aria-current="page"]')?.getAttribute('aria-pressed'),
    rankingGroups:document.querySelectorAll('[data-ufc-division]').length,
    rankRows:document.querySelectorAll('.ufc-center-rank-row:not(.ufc-center-skeleton-row)').length,
    scopedBouts:document.querySelectorAll('.ufc-center-classified-fights .ufc-center-bout-card').length,
    fighterCards:document.querySelectorAll('.ufc-center-roster-strip .ufc-center-fighter-card').length,
    metrics:[...document.querySelectorAll('.ufc-center-metrics article')].map((item) => item.innerText),
    source:document.querySelector('.ufc-center-source-note')?.innerText || '',
  }));
  assert.equal(bantamweightScope.title, 'UFC · Bantamweight', 'Merkez kimliği seçilen sıkleti açıkça göstermeli.');
  assert.equal(bantamweightScope.activeKey, 'bantamweight', 'URL seçimi sınıflandırma rayına geri uygulanmalı.');
  assert.equal(bantamweightScope.activePressed, 'true', 'Seçili sıklet erişilebilir basılı durum taşımalı.');
  assert.equal(bantamweightScope.rankingGroups, 1, 'Siklet seçimi tek sıralama grubuna kapsamlanmalı.');
  assert.equal(bantamweightScope.rankRows, 3, 'Yalnız seçilen sıkletin şampiyon ve sıralı sporcuları gösterilmeli.');
  assert.equal(bantamweightScope.scopedBouts, 1, 'Dövüş kartı seçilen sıklete kapsamlanmalı.');
  assert.equal(bantamweightScope.fighterCards, 3, 'Sporcu vitrini seçilen sıklete kapsamlanmalı.');
  assert.match(bantamweightScope.metrics.join('\n'), /SIRALI SPORCU[\s\S]*3[\s\S]*Bantamweight/i, 'Özet metrikleri seçilen sıklet kapsamını taşımalı.');
  assert.match(bantamweightScope.source, /yalnız açık bir sıklet alanı/i, 'Kapsam notu eksik verinin nasıl dışlandığını dürüstçe açıklamalı.');

  await page.goBack();
  await page.waitForSelector('.ufc-center[data-state="ready"]');
  assert.equal(new URL(page.url()).searchParams.has('division'), false, 'Back işlemi Tümü kapsamının temiz URL durumunu geri yüklemeli.');
  assert.equal(await page.locator('[data-ufc-division-rail] [data-classification-key="all"]').getAttribute('aria-pressed'), 'true', 'Back işlemi görünür seçimi Tümü durumuna geri getirmeli.');
  await page.goForward();
  await page.waitForSelector('.ufc-center[data-state="ready"]');
  assert.equal(new URL(page.url()).searchParams.get('division'), 'bantamweight', 'Forward işlemi seçilen sıklet query durumunu geri yüklemeli.');
  assert.equal(await page.locator('[data-classification-title]').innerText(), 'UFC · Bantamweight', 'Forward işlemi merkez kimliğini aynı sıklet kapsamına döndürmeli.');

  const sectionHrefs = await page.locator('.ufc-center-nav>a').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  assert.ok(sectionHrefs.every((href) => new URL(href, BASE).searchParams.get('division') === 'bantamweight'), 'Ana bölüm bağlantıları seçili sıklet query durumunu korumalı.');

  await page.goto(`${BASE}/ufc/rankings/?division=bantamweight`, { waitUntil:'domcontentloaded' });
  await page.waitForSelector('.ufc-center[data-state="ready"]');
  assert.equal(await page.locator('[data-classification-title]').innerText(), 'UFC Sıralamaları · Bantamweight', 'Sıralamalar alt rotası query kapsamını kimliğe uygulamalı.');
  assert.equal(await page.locator('.ufc-center-rank-row').count(), 3, 'Sıralamalar alt rotası yalnız seçili sıklet kayıtlarını göstermeli.');

  await page.goto(`${BASE}/ufc/fighters/?division=bantamweight`, { waitUntil:'domcontentloaded' });
  await page.waitForSelector('.ufc-center[data-state="ready"]');
  assert.equal(await page.locator('[data-classification-title]').innerText(), 'UFC Dövüşçüleri · Bantamweight', 'Dövüşçüler alt rotası query kapsamını kimliğe uygulamalı.');
  assert.equal(await page.locator('.ufc-center-fighter-card').count(), 3, 'Dövüşçüler alt rotası yalnız seçili sıklet profillerini göstermeli.');

  await page.goto(`${BASE}/ufc/events/?division=bantamweight`, { waitUntil:'domcontentloaded' });
  await page.waitForSelector('.ufc-center[data-state="ready"]');
  assert.equal(await page.locator('.ufc-center-event-row').count(), 0, 'Sıklet alanı taşımayan etkinlik seçili query altında tüm veri gibi gösterilmemeli.');
  assert.match(await page.locator('#ufcxContent').innerText(), /etkinlikleri Bantamweight olarak etiketlemedi/i, 'Etkinlik alt rotası eksik sıklet coverageını dürüstçe açıklamalı.');

  await page.goto(`${BASE}/ufc/events/ufc-fight-night-test/?division=bantamweight`, { waitUntil:'domcontentloaded' });
  await page.waitForSelector('.ufc-center[data-state="ready"]');
  assert.equal(await page.locator('[data-classification-title]').innerText(), 'UFC Fight Night: Nurmagomedov vs Song · Bantamweight', 'Etkinlik kimliği seçili sıklet query kapsamını korumalı.');
  assert.equal(await page.locator('.ufc-center-bout-grid .ufc-center-bout-card').count(), 1, 'Etkinlik dövüşleri seçili sıklete kapsamlanmalı.');

  await page.goto(`${BASE}/ufc/?division=not-a-provider-division`, { waitUntil:'domcontentloaded' });
  await page.waitForSelector('.ufc-center[data-state="ready"]');
  const unknownScope = await page.evaluate(() => ({
    url:new URL(location.href).searchParams.get('division'),
    active:document.querySelector('[data-ufc-division-rail] [aria-current="page"]')?.dataset.classificationKey || null,
    warning:document.querySelector('.ufc-center-invalid-classification')?.textContent.trim(),
    title:document.querySelector('[data-classification-title]')?.textContent.trim(),
    ranks:document.querySelectorAll('.ufc-center-rank-row').length,
    fights:document.querySelectorAll('.ufc-center-bout-card').length,
    fighters:document.querySelectorAll('.ufc-center-fighter-card').length,
    events:document.querySelectorAll('.ufc-center-event-row').length,
    text:document.querySelector('#ufcxContent')?.innerText || '',
    leaksFeaturedTitle:(document.querySelector('#ufcxContent')?.innerText || '').includes('UFC Fight Night: Nurmagomedov vs Song'),
  }));
  assert.equal(unknownScope.url, 'not-a-provider-division', 'Doğrulanamayan query sessizce başka kapsama çevrilmemeli.');
  assert.equal(unknownScope.active, null, 'Doğrulanamayan query gerçek bir sağlayıcı seçimi gibi işaretlenmemeli.');
  assert.match(unknownScope.warning, /sağlayıcı listesinde yok/i, 'Sınıflandırma rayı geçersiz queryyi açıkça bildirmeli.');
  assert.match(unknownScope.title, /Sıklet doğrulanamadı/i, 'Merkez kimliği bilinmeyen queryyi Tümü gibi göstermemeli.');
  assert.deepEqual([unknownScope.ranks, unknownScope.fights, unknownScope.fighters, unknownScope.events], [0, 0, 0, 0], 'Bilinmeyen sıklet fail-closed olmalı ve genel veriyi sızdırmamalı.');
  assert.equal(unknownScope.leaksFeaturedTitle, false, 'Bilinmeyen sıklet görünümünde genel etkinlik vitrini seçili kapsam gibi sızmamalı.');
  assert.match(unknownScope.text, /veri kapsamı genişletilmedi/i, 'Fail-closed görünüm kullanıcıya kapsamın genişletilmediğini açıklamalı.');

  await page.goto(`${BASE}/ufc/?division=bantamweight`, { waitUntil:'domcontentloaded' });
  await page.waitForSelector('.ufc-center[data-state="ready"]');

  await page.setViewportSize({ width:390, height:844 });
  const mobile = await page.evaluate(() => {
    const shell = document.querySelector('.ufc-center-shell');
    const navTargets = [...document.querySelectorAll('.ufc-center-nav>a')].map((item) => item.getBoundingClientRect().height);
    const classificationTargets = [...document.querySelectorAll('[data-sport-classification="divisions"] [data-classification-key]')].map((item) => item.getBoundingClientRect().height);
    const shellRect = shell.getBoundingClientRect();
    const overflowing = [...shell.querySelectorAll('*')].filter((item) => {
      const rect = item.getBoundingClientRect();
      return rect.right > shellRect.right + 1 || rect.left < shellRect.left - 1;
    }).slice(0, 8).map((item) => `${item.tagName.toLowerCase()}.${item.className || ''}:${Math.round(item.getBoundingClientRect().right - shellRect.right)}`);
    const direct = [...shell.children].map((item) => ({ className:item.className, width:item.getBoundingClientRect().width, scrollWidth:item.scrollWidth, clientWidth:item.clientWidth }));
    const intrinsic = [...document.querySelectorAll('#ufcxContent, #ufcxContent *')].filter((item) => item.scrollWidth > item.clientWidth + 1).slice(0, 12).map((item) => ({ tag:item.tagName, className:item.className, scrollWidth:item.scrollWidth, clientWidth:item.clientWidth }));
    return { overflow:shell.scrollWidth - shell.clientWidth, navTargets, classificationTargets, overflowing, direct, intrinsic };
  });
  assert.ok(mobile.overflow <= 1, `Mobil kabuk yatay taşmamalı (${mobile.overflow}px): ${mobile.overflowing.join(' | ')} ${JSON.stringify(mobile.direct)} ${JSON.stringify(mobile.intrinsic)}`);
  assert.ok(mobile.navTargets.every((height) => height >= 44), 'Mobil ana sekmeler en az 44px dokunma hedefi olmalı.');
  assert.ok(mobile.classificationTargets.every((height) => height >= 44), 'Mobil sıklet seçimleri en az 44px dokunma hedefi olmalı.');
  assert.ok(apiRequests.every((path) => path.startsWith('/api/ufc/')), 'Back/Forward dahil tüm sınıflandırma yenilemeleri UFC API ailesinde kalmalı.');

  const racePage = await context.newPage();
  const raceErrors = [];
  const raceRequests = [];
  let racePhase = 'initial';
  racePage.on('pageerror', (error) => raceErrors.push(String(error)));
  await racePage.route('**://**', async (route) => {
    const url = route.request().url();
    if (url.startsWith(BASE) && new URL(url).pathname.startsWith('/api/')) {
      const path = new URL(url).pathname + new URL(url).search;
      const phase = racePhase;
      raceRequests.push({ phase, path });
      const delay = phase === 'stale'
        ? (path.startsWith('/api/ufc/events/upcoming') ? 10 : 220)
        : 25;
      await new Promise((resolve) => setTimeout(resolve, delay));
      const body = apiBody(url);
      return route.fulfill({ status:body.error ? 404 : 200, contentType:'application/json; charset=utf-8', body:JSON.stringify(body) });
    }
    if (url.startsWith(BASE)) return route.continue();
    if (/\.(?:png|webp|jpe?g|gif|svg)(?:\?|$)/i.test(url)) return route.fulfill({ status:200, contentType:'image/gif', body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') });
    return route.fulfill({ status:204, body:'' });
  });
  await racePage.goto(`${BASE}/ufc/`, { waitUntil:'domcontentloaded' });
  await racePage.waitForSelector('.ufc-center[data-state="ready"]');
  racePhase = 'stale';
  await racePage.locator('[data-ufc-division-rail] button[data-classification-key="welterweight"]').focus();
  await racePage.keyboard.press('Enter');
  await racePage.waitForSelector('.ufc-center.is-loading');
  await new Promise((resolve) => setTimeout(resolve, 40));
  racePhase = 'final';
  await racePage.locator('[data-ufc-division-rail] button[data-classification-key="bantamweight"]').focus();
  await racePage.keyboard.press('Enter');
  await racePage.waitForSelector('.ufc-center[data-state="ready"]');
  await racePage.waitForFunction(() => document.activeElement?.dataset?.classificationKey === 'bantamweight');
  assert.equal(await racePage.locator('[data-classification-title]').innerText(), 'UFC · Bantamweight', 'Hızlı seçimde son sıklet kimliği stale yanıtla ezilmemeli.');
  assert.equal(raceRequests.filter((item) => item.path === '/api/ufc/events/ufc-fight-night-test').length, 2, 'Abort edilen eski yükleme yeni controller ile fazladan etkinlik detayı başlatmamalı.');
  assert.equal(await racePage.evaluate(() => document.activeElement?.dataset?.classificationKey), 'bantamweight', 'Async yenileme tamamlanınca klavye odağı seçilen sıklet düğmesine dönmeli.');
  assert.deepEqual(raceErrors, [], 'Hızlı sıklet değişiminde sayfa hatası oluşmamalı.');

  const emptyPage = await context.newPage();
  await emptyPage.route('**/api/ufc/**', (route) => {
    const parsed = new URL(route.request().url());
    return route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(wrapped(parsed.pathname.replace('/api/ufc/', ''), [])) });
  });
  await emptyPage.goto(`${BASE}/ufc/`, { waitUntil:'domcontentloaded' });
  await emptyPage.waitForSelector('.ufc-center[data-state="ready"]');
  assert.deepEqual(await emptyPage.locator('[data-ufc-division-rail] [data-classification-key]').allTextContents(), ['Tümü'], 'Sağlayıcı sıklet döndürmezse sınıflandırma seçeneği uydurulmamalı.');
  assert.match(await emptyPage.locator('#ufcxContent').innerText(), /sıralama verisi bekleniyor|yaklaşan kart bulunmuyor/i, 'Doğrulanmış boş sonuç dürüst boş durum metniyle sunulmalı.');

  const catalogErrorPage = await context.newPage();
  await catalogErrorPage.route('**/api/ufc/**', (route) => {
    const parsed = new URL(route.request().url());
    if (parsed.pathname === '/api/ufc/rankings') return route.fulfill({ status:503, contentType:'application/json', body:JSON.stringify({ error:'provider_refresh_in_progress' }) });
    return route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(apiBody(route.request().url())) });
  });
  await catalogErrorPage.goto(`${BASE}/ufc/fighters/?division=bantamweight`, { waitUntil:'domcontentloaded' });
  await catalogErrorPage.waitForSelector('.ufc-center[data-state="error"]');
  assert.match(await catalogErrorPage.locator('.ufc-center-empty').innerText(), /doğrulanmış boş sonuç değildir/i, 'Scoped katalog hatası bilinmeyen sıklet veya doğrulanmış boş sonuç gibi sunulmamalı.');
  assert.equal(await catalogErrorPage.locator('[data-ufc-division-rail] [aria-current="page"]').count(), 0, 'Katalog hatasında Tümü seçimi scoped URL adına aktif gösterilmemeli.');
  assert.match(await catalogErrorPage.locator('.ufc-center-invalid-classification').innerText(), /doğrulanıyor/i, 'Katalog hatasında sıklet bilinmeyen değil doğrulanamayan/pending olarak kalmalı.');

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
