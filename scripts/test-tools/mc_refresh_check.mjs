// Canli mac yenilemesi gercekten calisiyor mu? Ve panel kapaninca duruyor mu?
import { launchChromium } from './lib/playwright-loader.mjs';
import assert from 'node:assert/strict';

const b = await launchChromium();
const ctx = await b.newContext({viewport:{width:1280,height:900}});
const page = await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e).slice(0,200)));

let fixtureCalls = 0;
// TEK route: Playwright son eklenen route'u once uyguladigi icin ayri route'lar
// birbirini golgeliyordu. Hepsini tek handler'da ayristiriyoruz.
await page.route('**/api/**', async r => {
  const u = r.request().url();
  if (u.includes('/api/football/fixture')) {
    fixtureCalls++;
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      source:'sportmonks', id:'sportmonks:1', updatedAt:new Date().toISOString(),
      details:{ lineups:[], absences:[], events:[{minute:fixtureCalls*10,team:'Galatasaray',player:'Oyuncu',type:'Gol'}],
        statistics:[{team:'Galatasaray',label:'Sut',value:String(fixtureCalls)}], venue:{name:'RAMS Park'}, referee:null, weather:null }
    })});
  }
  return r.fulfill({status:503,contentType:'application/json',body:'{"error":"sportmonks_not_configured"}'});
});
await page.route(/(jsdelivr|unpkg|fonts\.g|wikimedia|fotmob|mythos|supabase\.co|googleapis)/, r=>r.abort());

await page.goto('http://127.0.0.1:4173',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2000);

// CANLI bir maç enjekte et. openMatchCenter artık kalıcı fixture rotasına
// yönlendirdiği için eski modalı açmasını beklemiyoruz; veri yenileme sözleşmesini
// doğrudan fixture kimliği üzerinden doğruluyoruz.
await page.evaluate(() => {
  MATCHES.length = 0;
  MATCHES.push({ id:'sportmonks:1', hafta:1, ev:'Galatasaray', konuk:'FenerbahÃ§e',
    kickoff:new Date(Date.now()-30*60000).toISOString(), stadyum:'RAMS Park', status:'canlÄ±', verified:true, competition:'SÃ¼per Lig' });
});
const phase = await page.evaluate(()=>typeof mcPhase==='function' ? mcPhase(MATCHES[0]) : 'fonksiyon yok');
await page.evaluate(async () => {
  mcMatchId='sportmonks:1';
  await ensureMcData(mcMatchId);
  mcScheduleRefresh();
});
await page.waitForTimeout(1500);

const callsAfterOpen = fixtureCalls;

// 32 sn beklemek yerine zamanlayiciyi hizlandiramayiz; bunun yerine
// TTL'i asmis gibi cache'i eskitip ensureMcData'yi tekrar cagiralim
await page.evaluate(async () => {
  const c = mcCache && mcCache['sportmonks:1'];
  if (c) c.fetchedAt = Date.now() - 60000;   // 60 sn once alinmis gibi
  await ensureMcData('sportmonks:1');
});
await page.waitForTimeout(600);
const callsAfterStale = fixtureCalls;

// Supabase TTL'i dolmadigi icin ikinci turda supabase sorgusu atlanmali
const supabaseSkipped = await page.evaluate(()=>{
  const c = mcCache && mcCache['sportmonks:1'];
  return c ? { hasSupabaseStamp: !!c.supabaseFetchedAt, fetchedAtGuncel: (Date.now()-c.fetchedAt) < 5000 } : null;
});

// Zamanlayici kuruldu mu, kapaninca duruyor mu?
const timerRunning = await page.evaluate(()=>typeof mcRefreshTimer!=='undefined' && mcRefreshTimer!==null);
await page.evaluate(()=>closeMatchCenter(false));
await page.waitForTimeout(400);
const timerStopped = await page.evaluate(()=>typeof mcRefreshTimer!=='undefined' && mcRefreshTimer===null);

await b.close();
console.log('=== CANLI MAC YENILEME TESTI ===');
console.log('  mcPhase(canli mac)        :', phase, '(BEKLENEN: live)');
console.log('  acilista fixture cagrisi  :', callsAfterOpen, '(BEKLENEN: 1)');
console.log('  TTL dolunca yeniden cekti :', callsAfterStale > callsAfterOpen, `(${callsAfterOpen} -> ${callsAfterStale})`);
console.log('  cache damgalari           :', JSON.stringify(supabaseSkipped));
console.log('  acikken zamanlayici aktif :', timerRunning, '(BEKLENEN: true)');
console.log('  kapaninca zamanlayici dur :', timerStopped, '(BEKLENEN: true)');
console.log('  pageerror                 :', errs.length?errs:'YOK');

assert.equal(phase,'live','Canlı durum bütün istemci varyantlarında live fazına dönmeli.');
assert.equal(callsAfterOpen,1,'İlk canlı fixture detayı tam bir kez çekilmeli.');
assert.ok(callsAfterStale>callsAfterOpen,'Canlı TTL dolduğunda fixture yeniden çekilmeli.');
assert.ok(supabaseSkipped?.hasSupabaseStamp&&supabaseSkipped?.fetchedAtGuncel,'Ayrı Supabase ve sağlayıcı cache damgaları korunmalı.');
assert.equal(timerRunning,true,'Canlı maçta yenileme zamanlayıcısı kurulmalı.');
assert.equal(timerStopped,true,'Maç merkezi kapanınca zamanlayıcı durmalı.');
assert.deepEqual(errs,[],'Sayfa hatası oluşmamalı.');
