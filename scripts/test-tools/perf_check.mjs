// Gercek mobil performans olcumu: CPU 4x yavaslatma + Fast 3G benzeri ag.
import { chromium } from './lib/playwright-loader.mjs';

const b = await chromium.launch({args:['--no-sandbox']});
const ctx = await b.newContext({ viewport:{width:390,height:844}, userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' });
const page = await ctx.newPage();

// API'leri mock'la (sandbox'ta upstream yok) â€” gercek senaryoda benzer gecikme olur
await page.route('**/api/**', async r => { await new Promise(s=>setTimeout(s,120)); r.fulfill({status:503,contentType:'application/json',body:'{"error":"sportmonks_not_configured"}'}); });
// Harici kaynaklar sandbox'ta duser; olcumu bozmasin diye hizli bos yanit
await page.route(/(jsdelivr|unpkg|fonts\.g|wikimedia|fotmob|mythos\.cards|supabase\.co)/, r => r.abort());

const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });          // ~orta segment telefon
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', {
  offline:false, latency:150, downloadThroughput: 1.6*1024*1024/8, uploadThroughput: 750*1024/8   // Fast 3G
});

let transferred = 0;
page.on('response', async (res) => {
  try { const h = res.headers(); const len = Number(h['content-length']||0); transferred += len || 0; } catch {}
});

const t0 = Date.now();
await page.goto('http://127.0.0.1:4173', { waitUntil:'domcontentloaded' });
const domReady = Date.now() - t0;
await page.waitForTimeout(5000);

const m = await page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const paints = {};
  performance.getEntriesByType('paint').forEach(p => paints[p.name] = Math.round(p.startTime));
  const res = performance.getEntriesByType('resource');
  const bytes = res.reduce((a,r) => a + (r.transferSize||0), 0);
  const decoded = res.reduce((a,r) => a + (r.decodedBodySize||0), 0);
  let lcp = null;
  try {
    const e = performance.getEntriesByType('largest-contentful-paint');
    if (e.length) lcp = Math.round(e[e.length-1].startTime);
  } catch {}
  return {
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
    loadEvent: Math.round(nav.loadEventEnd || 0),
    firstPaint: paints['first-paint'] ?? null,
    firstContentfulPaint: paints['first-contentful-paint'] ?? null,
    largestContentfulPaint: lcp,
    resourceCount: res.length,
    transferKB: Math.round(bytes/1024),
    decodedKB: Math.round(decoded/1024),
    domNodes: document.querySelectorAll('*').length,
    cssRules: (() => { let n=0; for(const s of document.styleSheets){ try{ n += s.cssRules.length; }catch{} } return n; })(),
    longTasks: (() => { try { return performance.getEntriesByType('longtask').length; } catch { return 'n/a'; } })(),
  };
});

// Uzun gorevleri ayrica gozlemle (kasma gostergesi)
const lt = await page.evaluate(() => new Promise(res => {
  const found = [];
  try {
    const obs = new PerformanceObserver(list => list.getEntries().forEach(e => found.push(Math.round(e.duration))));
    obs.observe({ entryTypes: ['longtask'] });
  } catch { return res('desteklenmiyor'); }
  // Sekme gecisi tetikle: kasma en cok burada gorulur
  try { if (typeof switchMainTab === 'function') { switchMainTab('predict'); } } catch {}
  setTimeout(() => { try { if (typeof switchMainTab === 'function') switchMainTab('football'); } catch {} }, 400);
  setTimeout(() => res(found), 2500);
}));

await b.close();
console.log('=== MOBIL PERFORMANS (CPU 4x yavas + Fast 3G) ===');
console.log(JSON.stringify(m, null, 2));
console.log('Sekme gecisinde uzun gorevler (ms, >50ms = kasma riski):', lt);

