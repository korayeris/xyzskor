import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { launchChromium } from './test-tools/lib/playwright-loader.mjs';

const PORT = 4397;
const BASE = `http://127.0.0.1:${PORT}`;
const server = spawn(process.execPath, ['scripts/dev-server.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, XYZSKOR_DEV_PORT:String(PORT) },
  stdio:['ignore', 'pipe', 'pipe'],
});

let serverError = '';
server.stderr.on('data', (chunk) => { serverError += String(chunk); });

async function waitForServer(){
  for(let attempt=0;attempt<50;attempt+=1){
    try{
      const response = await fetch(BASE, { method:'HEAD' });
      if(response.ok) return;
    }catch(_error){}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Test sunucusu başlamadı. ${serverError}`);
}

let browser;
try{
  await waitForServer();
  browser = await launchChromium({ headless:true });
  const page = await browser.newPage({ viewport:{ width:390, height:844 } });
  await page.route('**/api/**', (route) => route.fulfill({
    status:503,
    contentType:'application/json; charset=utf-8',
    body:JSON.stringify({ error:'provider_unavailable' }),
  }));

  for(const [path, expected] of [['/basketbol/', 'Basketbol'], ['/voleybol/', 'Voleybol']]){
    await page.goto(BASE + path, { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#multiSportGrid .multi-event-empty, #multiSportGrid .basketball-error-state'));
    const headings = await page.locator('#multiSportHub h1:visible').allTextContents();
    assert.deepEqual(headings.map((text) => text.trim()), [expected], `${path} hata görünümü branş H1'ini korumalı.`);
    assert.match(await page.locator('#multiSportGrid').innerText(), new RegExp(expected), `${path} hata metni branşı adlandırmalı.`);
  }

  await page.goto(BASE + '/ufc/', { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#ufcxContent .ufcx-empty'));
  const ufcHeadings = await page.locator('#ufcxContent h1:visible').allTextContents();
  assert.deepEqual(ufcHeadings.map((text) => text.trim()), ['UFC'], 'UFC hata görünümünde tek ve anlamlı H1 olmalı.');
  assert.doesNotMatch(await page.locator('body').innerText(), /Ã|Â/, 'UFC görünür metninde mojibake kalmamalı.');

  await page.goto(BASE + '/futbol/', { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openAuth === 'function');
  await page.evaluate(() => window.openAuth('register'));

  const authSemantics = await page.evaluate(() => {
    const team = document.getElementById('regTeam');
    const modeSwitch = document.getElementById('authSwitch');
    const error = document.getElementById('authErr');
    return {
      teamLabels:[...(team.labels || [])].map((label) => label.textContent.trim()),
      switchTag:modeSwitch.tagName,
      switchType:modeSwitch.getAttribute('type'),
      errorRole:error.getAttribute('role'),
      errorLive:error.getAttribute('aria-live'),
      errorAtomic:error.getAttribute('aria-atomic'),
    };
  });
  assert.deepEqual(authSemantics.teamLabels, ['Tuttuğun takım'], 'Takım seçimi programatik etikete sahip olmalı.');
  assert.deepEqual(
    [authSemantics.switchTag, authSemantics.switchType],
    ['BUTTON', 'button'],
    'Üyelik modu değiştiricisi gerçek button olmalı.',
  );
  assert.deepEqual(
    [authSemantics.errorRole, authSemantics.errorLive, authSemantics.errorAtomic],
    ['alert', 'assertive', 'true'],
    'Üyelik hatası ekran okuyucuya canlı duyurulmalı.',
  );

  await page.locator('#authSwitch').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#authTitle').innerText(), 'Giriş Yap', 'Enter üyelik modunu değiştirmeli.');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'authSwitch', 'Mod değişiminden sonra klavye odağı düğmede kalmalı.');
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#authTitle').innerText(), 'Üye Ol', 'Space üyelik modunu değiştirmeli.');

  await page.locator('#authSubmit').click();
  assert.equal(await page.locator('#authErr').innerText(), 'E-posta ve şifre gerekli.', 'Boş form hatası görünür ve canlı bölgede olmalı.');

  console.log('OK  Branş hata kimliği ve üyelik erişilebilirliği regresyonları geçti.');
} finally {
  await browser?.close();
  server.kill();
}
