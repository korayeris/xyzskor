import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { launchChromium } from './test-tools/lib/playwright-loader.mjs';

const PORT = 4399;
const BASE = `http://127.0.0.1:${PORT}`;
const server = spawn(process.execPath, ['scripts/dev-server.mjs'], {
  cwd:new URL('..', import.meta.url),
  env:{ ...process.env, XYZSKOR_DEV_PORT:String(PORT) },
  stdio:['ignore', 'pipe', 'pipe'],
});

let serverError = '';
server.stderr.on('data', (chunk) => { serverError += String(chunk); });

async function waitForServer(){
  for(let attempt = 0;attempt < 50;attempt += 1){
    try{
      const response = await fetch(BASE, { method:'HEAD' });
      if(response.ok) return;
    }catch(_error){}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Test sunucusu başlamadı. ${serverError}`);
}

async function preparePage(browser, { fallback = false } = {}){
  const page = await browser.newPage({ viewport:{ width:1024, height:768 } });
  await page.route('**/api/**', (route) => route.fulfill({
    status:503,
    contentType:'application/json; charset=utf-8',
    body:JSON.stringify({ error:'provider_unavailable' }),
  }));
  if(fallback){
    await page.route('**/assets/js/predict-game.js*', (route) => route.fulfill({
      status:200,
      contentType:'application/javascript; charset=utf-8',
      body:'/* predict game intentionally unavailable: fallback contract test */',
    }));
  }

  await page.goto(`${BASE}/futbol/`, { waitUntil:'domcontentloaded' });
  await page.addStyleTag({ content:'#miniGoalGame{display:block!important}' });
  await page.waitForFunction(() => window.__XYZ_APP_BOOT_READY__ === true);
  await page.evaluate(() => window.ensureXYZUiExtras());
  await page.waitForFunction((usesFallback) => {
    const trigger = document.getElementById('miniGoalTrigger');
    return usesFallback ? trigger?.dataset.ready === '1' : trigger?.dataset.predictReady === '1';
  }, fallback);
  return page;
}

async function assertFocusContract(page, label){
  const trigger = page.locator('#miniGoalTrigger');
  const overlay = page.locator('#miniGoalOverlay');

  await trigger.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.getElementById('miniGoalOverlay')?.hidden);

  assert.equal(await page.evaluate(() => document.activeElement?.id), 'miniGoalClose', `${label}: açılış odağı kapat düğmesine gitmeli.`);
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true', `${label}: açık durum tetikleyicide duyurulmalı.`);

  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'miniGoalRestart', `${label}: Shift+Tab ilk öğeden son öğeye sarılmalı.`);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'miniGoalClose', `${label}: Tab son öğeden ilk öğeye sarılmalı.`);

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('miniGoalOverlay')?.hidden);
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false', `${label}: Escape açık durumunu kapatmalı.`);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'miniGoalTrigger', `${label}: Escape odağı görünür tetikleyiciye döndürmeli.`);
  assert.equal(await trigger.evaluate((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden'), true, `${label}: dönüş hedefi görünür olmalı.`);
  assert.equal(await overlay.evaluate((element) => element.contains(document.activeElement)), false, `${label}: kapalı dialog içinde aktif odak kalmamalı.`);

  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.getElementById('miniGoalOverlay')?.hidden);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'miniGoalClose', `${label}: yeniden açılış odağı tutarlı olmalı.`);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('miniGoalOverlay')?.hidden);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'miniGoalTrigger', `${label}: kapat düğmesi odağı tetikleyiciye döndürmeli.`);
  assert.equal(await overlay.evaluate((element) => element.contains(document.activeElement)), false, `${label}: düğmeyle kapanışta gizli odak kalmamalı.`);
}

let browser;
try{
  await waitForServer();
  browser = await launchChromium({ headless:true });

  const mainPage = await preparePage(browser);
  await assertFocusContract(mainPage, 'Ana Predict oyunu');
  await mainPage.close();

  const fallbackPage = await preparePage(browser, { fallback:true });
  assert.equal(await fallbackPage.evaluate(() => typeof window.initPredictMiniGame), 'undefined', 'Yedek test ana oyun yükseltmesi olmadan çalışmalı.');
  await assertFocusContract(fallbackPage, 'UI extras yedek oyunu');
  await fallbackPage.close();

  console.log('OK  Golü At dialog klavye odağı sözleşmesi geçti.');
} finally {
  await browser?.close();
  server.kill();
}
