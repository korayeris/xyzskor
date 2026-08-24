import assert from 'node:assert/strict';
import { launchChromium } from './lib/playwright-loader.mjs';

// Instagram modulu canonical futbol ana/lig ekranlarinda urun yuzeyi degildir.
// Bu smoke, gizli legacy DOM'un kota tuketen bir API istegi baslatmadigini ve
// kullaniciya bos bir sosyal kart gostermedigini kanitlar. Provider payload
// semantigi scripts/test-tools/api_test_harness.mjs tarafindan ayrica test edilir.
async function run(pathname){
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  let instagramRequests = 0;
  page.on('pageerror', error => errors.push(String(error)));
  await page.route('**/api/**', route => {
    const url = route.request().url();
    if(url.includes('/api/social/instagram')) instagramRequests += 1;
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'provider_not_configured' })
    });
  });
  await page.goto(`http://127.0.0.1:4173${pathname}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const result = await page.evaluate(() => {
    const desk = document.getElementById('instagramDesk');
    return {
      present: Boolean(desk),
      visible: Boolean(desk && desk.getClientRects().length && getComputedStyle(desk).visibility !== 'hidden'),
      cards: document.querySelectorAll('.instagram-card').length
    };
  });
  await browser.close();
  assert.equal(result.visible, false, `${pathname}: gizli legacy Instagram masasi gorunmemeli`);
  assert.equal(result.cards, 0, `${pathname}: gizli Instagram karti olusturulmamali`);
  assert.equal(instagramRequests, 0, `${pathname}: gorunmeyen Instagram modulu API sorgulamamali`);
  assert.deepEqual(errors, [], `${pathname}: sayfa hatasi olmamali`);
  console.log(`OK ${pathname}: hidden=${!result.visible}, requests=${instagramRequests}, errors=${errors.length}`);
}

await run('/');
await run('/super-lig');
console.log('Instagram canonical-scope UI contract: PASS');
