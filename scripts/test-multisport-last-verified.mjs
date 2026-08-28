import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { launchChromium } from './test-tools/lib/playwright-loader.mjs';

const PORT=Number(process.env.XYZSKOR_TEST_PORT||4431);
const BASE=`http://127.0.0.1:${PORT}`;
const BRANCH_KEY='xyzskor:last-verified:multisport:v1:basketball';
const VOLLEY_BRANCH_KEY='xyzskor:last-verified:multisport:v1:volleyball';
const STANDINGS_KEY='xyzskor:last-verified:basketball-standings:v1:12%3A2026-2027';
const BSL_ROUTE='/basketbol/lig/basketbol-super-ligi--id-12--sezon-2026-2027/';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const yesterday=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()-24*60*60*1000));
const source=await readFile(new URL('../assets/js/multisport.js',import.meta.url),'utf8');

assert.doesNotMatch(source,/cache\s*:\s*['"]no-store['"]/,'Multisport fetch istekleri browser/CDN cache yolunu zorla kapatmamalı.');
assert.doesNotMatch(source,/['"]Cache-Control['"]\s*:\s*['"]no-cache['"]/,'Multisport fetch istekleri no-cache request header göndermemeli.');
assert.match(source,/date=\$\{encodeURIComponent\(today\)\}[\s\S]*client=v11\$\{dateNamespace\}/,'Today request CDN cache anahtarını İstanbul tarihiyle ayırmalı.');
assert.match(source,/Math\.max\(15,Math\.min\(120,/,'Retry-After 15-120 saniye aralığına sıkıştırılmalı.');
assert.match(source,/branchAutoRetryUsed\.add\(sport\)[\s\S]*openHub\(sport,activeView,false,activeLeagueRoute\)/,'Otomatik deneme yalnız çalışırken tüketilmeli ve güncel branş görünümünü korumalı.');
assert.match(source,/standingsProof:item\?\.standingsProof[\s\S]*proof=\$\{encodeURIComponent\(league\.standingsProof\|\|''\)\}/,'Today standings proof descriptor ve istek zincirinde korunmalı.');
assert.match(source,/trustedBranchPayloads\s*=\s*new WeakSet\(\)/,'Global multisport Map yalnız özel güven işaretli payloadları warm kabul etmeli.');
assert.match(source,/storageByteLength\(raw\)>LAST_VERIFIED_BRANCH_MAX_BYTES[\s\S]*JSON\.parse\(raw\)/,'Last-verified branch boyutu JSON parse öncesinde sınırlandırılmalı.');
assert.match(source,/payload\.date!==responseToday[\s\S]*sports_payload_date_mismatch/,'Fresh response tarihi İstanbul günüyle exact doğrulanmalı.');
assert.match(source,/normalized\.archived=Boolean\(serverStale\|\|item\?\.archived\)/,'Stale normalizasyonu sağlayıcının mevcut item archived işaretini korumalı.');
assert.match(source,/observedMultisportDate[\s\S]*dateChanged[\s\S]*cachedDateChanged/,'Visibility rollover payload türünden bağımsız gözlenen İstanbul gününü izlemeli.');
assert.match(source,/if\(!serverStale\)[\s\S]*branchAutoRetryUsed\.delete\(requestedSport\)/,'Fresh recovery yeni bağımsız hata olayı için retry hakkını sıfırlamalı.');

function branchPayload(home='Archive Home',away='Archive Away',proof='proof-bsl',status='Not Started'){
  return {
    source:'mock-api-sports',date:today,updatedAt:new Date().toISOString(),
    sports:{basketball:[{
      id:`${home}-${away}`,sport:'basketball',provider:'api-sports',league:'Basketbol Süper Ligi',leagueId:12,
      season:'2026-2027',standingsProof:proof,country:'Türkiye',status,time:'20:30',
      date:`${today}T17:30:00.000Z`,feedDate:today,first:{name:home},second:{name:away},
    }]},
  };
}

function volleyballPayload(status='Not Started'){
  return {
    source:'mock-api-sports',date:today,updatedAt:new Date().toISOString(),
    sports:{volleyball:[{id:'volley-1',sport:'volleyball',provider:'api-sports',league:'Sultanlar Ligi',leagueId:31,season:'2026-2027',status,time:'19:00',date:`${today}T16:00:00.000Z`,feedDate:today,first:{name:'Eczacıbaşı'},second:{name:'VakıfBank'}}]},
  };
}

function standingsPayload(){
  return {
    source:'api-sports-basketball',provider:'api-sports',sport:'basketball',leagueId:'12',season:'2026-2027',updatedAt:new Date().toISOString(),
    standings:[
      {position:1,group:'Normal Sezon',team:{id:1,name:'Anadolu Efes'},played:8,won:7,lost:1,pointsFor:700,pointsAgainst:620,pointDifference:80,percentage:.875,form:'WWLWW'},
      {position:2,group:'Normal Sezon',team:{id:2,name:'Fenerbahçe Beko'},played:8,won:6,lost:2,pointsFor:680,pointsAgainst:630,pointDifference:50,percentage:.75,form:'WLWWW'},
    ],
  };
}

function branchWrapper(payload=branchPayload(),sport='basketball'){
  return JSON.stringify({version:1,sport,savedAt:Date.now(),payload});
}

async function seed(context,key,value){
  await context.addInitScript(({storageKey,storageValue})=>localStorage.setItem(storageKey,storageValue),{storageKey:key,storageValue:value});
}

async function speedRetry(context,delay=350){
  await context.addInitScript((retryDelay)=>{
    const nativeSetTimeout=window.setTimeout.bind(window);
    window.setTimeout=(callback,wait,...args)=>nativeSetTimeout(callback,Number(wait)>=15000?retryDelay:wait,...args);
  },delay);
}

async function fakeIstanbulClock(context, initialDate){
  await context.addInitScript((value)=>{
    window.__XYZ_TEST_ISTANBUL_DATE__=value;
    const NativeDateTimeFormat=Intl.DateTimeFormat;
    Intl.DateTimeFormat=function(locales,options){
      const formatter=new NativeDateTimeFormat(locales,options);
      if(options?.timeZone==='Europe/Istanbul'&&String(locales)==='en-CA') return {format:()=>window.__XYZ_TEST_ISTANBUL_DATE__};
      return formatter;
    };
    Intl.DateTimeFormat.prototype=NativeDateTimeFormat.prototype;
    Intl.DateTimeFormat.supportedLocalesOf=NativeDateTimeFormat.supportedLocalesOf.bind(NativeDateTimeFormat);
  },initialDate);
}

async function routeOtherApis(route){
  await route.fulfill({status:503,contentType:'application/json; charset=utf-8',body:JSON.stringify({error:'not_mocked'})});
}

const server=spawn(process.execPath,['scripts/dev-server.mjs'],{
  cwd:new URL('..',import.meta.url),env:{...process.env,XYZSKOR_DEV_PORT:String(PORT)},stdio:['ignore','pipe','pipe'],
});
let serverError='';
server.stderr.on('data',(chunk)=>{serverError+=String(chunk);});

async function waitForServer(){
  for(let attempt=0;attempt<60;attempt+=1){
    try{const response=await fetch(BASE,{method:'HEAD'});if(response.ok)return;}catch(_error){}
    await new Promise((resolve)=>setTimeout(resolve,100));
  }
  throw new Error(`Test sunucusu başlamadı. ${serverError}`);
}

let browser;
try{
  await waitForServer();
  browser=await launchChromium({headless:true});

  // Başarılı ve branş-doğrulanmış payload sınırlı bir last-verified kaydı üretir.
  {
    const context=await browser.newContext();
    const page=await context.newPage();
    await page.route('**/api/**',async(route)=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/sports/today'){
        await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(branchPayload())});
        return;
      }
      await routeOtherApis(route);
    });
    await page.goto(BASE+'/basketbol/',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('.basketball-fixture-row');
    const stored=await page.evaluate((key)=>localStorage.getItem(key),BRANCH_KEY);
    assert.ok(stored,'Başarılı basketbol payload last-verified olarak saklanmalı.');
    assert.ok(new TextEncoder().encode(stored).byteLength<=128*1024,'Branş last-verified kaydı 128 KiB sınırını aşmamalı.');
    assert.equal(JSON.parse(stored).payload.sports.basketball[0].standingsProof,'proof-bsl','Standings proof persisted today kaydında korunmalı.');
    await context.close();
  }

  // 429 sırasında last-verified kayıt güncelmiş gibi değil, tarihli arşiv olarak görünür.
  {
    const context=await browser.newContext();
    await seed(context,BRANCH_KEY,branchWrapper(branchPayload('Archive Home','Archive Away','proof-bsl','Live - Q3')));
    const page=await context.newPage();
    await page.route('**/api/**',async(route)=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/sports/today'){
        await route.fulfill({status:429,headers:{'retry-after':'60'},contentType:'application/json; charset=utf-8',body:JSON.stringify({error:'api_sports_rate_limited'})});
        return;
      }
      await routeOtherApis(route);
    });
    await page.goto(BASE+'/basketbol/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>/güncel veri değil/i.test(document.querySelector('#multiSportNote')?.textContent||''));
    await page.waitForFunction(()=>document.querySelector('#multiSportMetrics .is-live b')?.textContent?.trim()==='0');
    assert.match(await page.locator('#multiSportNote').innerText(),new RegExp(today),'Arşiv payload kendi doğrulanmış tarihini görünür tutmalı.');
    assert.match(await page.locator('.basketball-fixture-state').innerText(),/ARŞİV/,'Arşiv maç yaklaşan/canlı gibi etiketlenmemeli.');
    assert.doesNotMatch(await page.locator('.basketball-fixture-state').innerText(),/CANLI/,'Eski canlı durumu arşiv etiketine sızmamalı.');
    assert.match(await page.locator('.basketball-fixture-row').getAttribute('class'),/\bis-archived\b/,'Arşiv basketbol satırı ayrı durum sınıfı taşımalı.');
    assert.doesNotMatch(await page.locator('.basketball-fixture-row').getAttribute('class'),/\bis-(?:live|upcoming)\b/,'Arşiv basketbol satırı canlı/yaklaşan sınıfı taşımamalı.');
    assert.equal(await page.locator('.basketball-overview-metrics b.is-live').innerText(),'0','Arşiv basketbol kaydı merkez canlı metriğine eklenmemeli.');
    assert.equal(await page.locator('#multiSportMetrics .is-live b').innerText(),'0','Arşiv basketbol kaydı global canlı metriğine eklenmemeli.');
    await page.evaluate(()=>window.openMultiSportHub('basketball','games',true));
    await page.waitForSelector('.multi-event-card.is-archived');
    assert.match(await page.locator('.multi-event-score small').innerText(),new RegExp(`ARŞİV · ${today}`),'Basketbol Games kartı arşiv tarihiyle etiketlenmeli.');
    assert.doesNotMatch(await page.locator('.multi-event-score small').innerText(),/Live|Q3/i,'Basketbol Games kartı eski ham canlı statüyü sızdırmamalı.');
    await page.evaluate(()=>window.openMultiSportHub('basketball','leagues',true));
    await page.waitForSelector('.multi-league-card');
    assert.doesNotMatch(await page.locator('.multi-league-card em').innerText(),/canli/i,'Arşiv lig kartı eski canlı durumunu duyurmamalı.');
    assert.doesNotMatch(await page.locator('.multi-league-card em').getAttribute('class'),/\bis-live\b/,'Arşiv lig kartı canlı sınıfı taşımamalı.');
    assert.match(await page.locator('.multi-league-card em').innerText(),/son doğrulanmış kayıt/i,'Arşiv basketbol lig kartı programı aktif göstermemeli.');
    await page.evaluate(()=>window.openMultiSportHub('basketball','predict',true));
    await page.waitForFunction(()=>/arşiv tahmine açılmaz/i.test(document.querySelector('#multiSportGrid')?.textContent||''));
    assert.equal(await page.locator('[data-predict-key]').count(),0,'Arşiv basketbol kaydı tahmin seçimine açılmamalı.');
    await context.close();
  }

  // Eski canlı set durumu taşıyan voleybol fallback'i de arşiv olarak fail-closed kalır.
  {
    const context=await browser.newContext();
    await seed(context,VOLLEY_BRANCH_KEY,branchWrapper(volleyballPayload('Set 2'),'volleyball'));
    const page=await context.newPage();
    await page.route('**/api/**',async(route)=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/sports/today'){
        await route.fulfill({status:503,contentType:'application/json; charset=utf-8',body:JSON.stringify({error:'api_sports_upstream_unavailable'})});
        return;
      }
      await routeOtherApis(route);
    });
    await page.goto(BASE+'/voleybol/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>/güncel veri değil/i.test(document.querySelector('#multiSportNote')?.textContent||''));
    await page.waitForFunction(()=>document.querySelector('#multiSportMetrics .is-live b')?.textContent?.trim()==='0');
    assert.match(await page.locator('.volleyball-fixture-state').innerText(),/ARŞİV/,'Eski set durumu arşiv etiketiyle gösterilmeli.');
    assert.doesNotMatch(await page.locator('.volleyball-fixture-state').innerText(),/CANLI/,'Eski set durumu canlı etiketine dönüşmemeli.');
    assert.match(await page.locator('.volleyball-fixture-row').getAttribute('class'),/\bis-archived\b/,'Arşiv voleybol satırı ayrı durum sınıfı taşımalı.');
    assert.doesNotMatch(await page.locator('.volleyball-fixture-row').getAttribute('class'),/\bis-(?:live|upcoming)\b/,'Arşiv voleybol satırı canlı/yaklaşan sınıfı taşımamalı.');
    assert.equal(await page.locator('.volleyball-overview-metrics b.is-live').innerText(),'0','Arşiv voleybol kaydı merkez canlı metriğine eklenmemeli.');
    assert.equal(await page.locator('#multiSportMetrics .is-live b').innerText(),'0','Arşiv voleybol kaydı global canlı metriğine eklenmemeli.');
    await page.evaluate(()=>window.openMultiSportHub('volleyball','games',true));
    await page.waitForSelector('.multi-event-card.is-archived');
    assert.match(await page.locator('.multi-event-score small').innerText(),new RegExp(`ARŞİV · ${today}`),'Voleybol Games kartı arşiv tarihiyle etiketlenmeli.');
    assert.doesNotMatch(await page.locator('.multi-event-score small').innerText(),/Set\s*2/i,'Voleybol Games kartı eski ham set statüsünü sızdırmamalı.');
    await page.evaluate(()=>window.openMultiSportHub('volleyball','leagues',true));
    await page.waitForSelector('.multi-league-card');
    assert.doesNotMatch(await page.locator('.multi-league-card em').innerText(),/canli/i,'Arşiv voleybol lig kartı eski canlı durumunu duyurmamalı.');
    assert.doesNotMatch(await page.locator('.multi-league-card em').getAttribute('class'),/\bis-live\b/,'Arşiv voleybol lig kartı canlı sınıfı taşımamalı.');
    assert.match(await page.locator('.multi-league-card em').innerText(),/son doğrulanmış kayıt/i,'Arşiv voleybol lig kartı programı aktif göstermemeli.');
    await context.close();
  }

  // Bozuk JSON ve başka branşa ait kayıt fail-closed reddedilir.
  for(const [label,value] of [
    ['corrupt','{not-json'],
    ['cross-sport',branchWrapper(volleyballPayload(),'volleyball')],
    ['oversized','x'.repeat(128*1024+1)],
  ]){
    const context=await browser.newContext();
    await seed(context,BRANCH_KEY,value);
    const page=await context.newPage();
    await page.route('**/api/**',async(route)=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/sports/today'){
        await route.fulfill({status:503,contentType:'application/json; charset=utf-8',body:JSON.stringify({error:'api_sports_upstream_unavailable'})});
        return;
      }
      await routeOtherApis(route);
    });
    await page.goto(BASE+'/basketbol/',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('[data-basketball-hub-retry]');
    assert.equal(await page.evaluate((key)=>localStorage.getItem(key),BRANCH_KEY),null,`${label} last-verified kaydı silinmeli.`);
    await context.close();
  }

  // Last-verified yokken pending cooldown, görünüm spam'inin yeni ağ isteği açmasını engeller.
  {
    const context=await browser.newContext();
    await speedRetry(context,600);
    const page=await context.newPage();
    let attempts=0;
    await page.route('**/api/**',async(route)=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/sports/today'){
        attempts+=1;
        await route.fulfill({status:429,headers:{'retry-after':'1'},contentType:'application/json; charset=utf-8',body:JSON.stringify({error:'api_sports_rate_limited'})});
        return;
      }
      await routeOtherApis(route);
    });
    await page.goto(BASE+'/basketbol/',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('[data-basketball-hub-retry]');
    for(const view of ['games','leagues','teams','home']) await page.evaluate((next)=>window.openMultiSportHub('basketball',next,true),view);
    await page.waitForTimeout(100);
    assert.equal(attempts,1,'Pending kota cooldown sırasında view spam yeni ağ isteği açmamalı.');
    await page.waitForTimeout(700);
    assert.equal(attempts,2,'Cooldown sonunda yalnız tek otomatik retry çalışmalı.');
    for(const view of ['games','home','leagues']) await page.evaluate((next)=>window.openMultiSportHub('basketball',next,true),view);
    await page.waitForTimeout(100);
    assert.equal(attempts,2,'Tüketilmiş otomatik retry sonrası view spam aynı hatayı yeniden kullanmalı.');
    await context.close();
  }

  // Branştan çıkıp geri girmek timerı iptal edebilir ama Retry-After cooldown'unu delemez.
  {
    const context=await browser.newContext();
    await speedRetry(context,1500);
    const page=await context.newPage();
    let basketballAttempts=0;
    await page.route('**/api/**',async(route)=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/sports/today'&&url.searchParams.get('sport')==='basketball'){
        basketballAttempts+=1;
        await route.fulfill({status:429,headers:{'retry-after':'1'},contentType:'application/json; charset=utf-8',body:JSON.stringify({error:'api_sports_rate_limited'})});
        return;
      }
      if(url.pathname==='/api/sports/today'&&url.searchParams.get('sport')==='volleyball'){
        await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(volleyballPayload())});
        return;
      }
      await routeOtherApis(route);
    });
    await page.goto(BASE+'/basketbol/',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('[data-basketball-hub-retry]');
    await page.evaluate(()=>window.openMultiSportHub('volleyball','home',true));
    await page.waitForSelector('.volleyball-fixture-row');
    await page.evaluate(()=>window.openMultiSportHub('basketball','home',true));
    await page.waitForSelector('[data-basketball-hub-retry]');
    await page.waitForTimeout(100);
    assert.equal(basketballAttempts,1,'Basketbol→voleybol→basketbol navigasyonu aktif Retry-After içinde yeni fetch açmamalı.');
    await context.close();
  }

  // Manuel retry Retry-After cooldown'unu bypass etmez; kontrollü timer tek ağ sahibi kalır.
  {
    const context=await browser.newContext();
    await speedRetry(context,1500);
    const page=await context.newPage();
    let attempts=0;
    await page.route('**/api/**',async(route)=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/sports/today'){
        attempts+=1;
        if(attempts===1){
          await route.fulfill({status:503,headers:{'retry-after':'1'},contentType:'application/json; charset=utf-8',body:JSON.stringify({error:'api_sports_upstream_unavailable'})});
        }else{
          await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(branchPayload('Manual Recovery','Manual Away'))});
        }
        return;
      }
      await routeOtherApis(route);
    });
    await page.goto(BASE+'/basketbol/',{waitUntil:'domcontentloaded'});
    await page.locator('[data-basketball-hub-retry]').click();
    await page.locator('[data-basketball-hub-retry]').click();
    await page.waitForTimeout(100);
    assert.equal(attempts,1,'Manuel retry tıklamaları aktif Retry-After bitmeden erken fetch açmamalı.');
    assert.match(await page.locator('[data-basketball-hub-retry]').innerText(),/Bekleme süresi/,'Cooldown sırasında kullanıcıya açık bekleme geri bildirimi verilmeli.');
    await page.waitForFunction(()=>document.body.innerText.includes('Manual Recovery'));
    assert.equal(attempts,2,'Cooldown sonunda yalnız kontrollü timer tek yeni ağ isteği açmalı.');
    await context.close();
  }

  // 200 olsa bile yanlış İstanbul tarihi render/persist edilmez; doğrulanmış kayıt arşiv fallback olur.
  {
    const context=await browser.newContext();
    await seed(context,BRANCH_KEY,branchWrapper());
    const page=await context.newPage();
    const wrong={...branchPayload('Wrong Date Home','Wrong Date Away'),date:yesterday};
    await page.route('**/api/**',async(route)=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/sports/today'){
        await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(wrong)});
        return;
      }
      await routeOtherApis(route);
    });
    await page.goto(BASE+'/basketbol/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>/güncel veri değil/i.test(document.querySelector('#multiSportNote')?.textContent||''));
    assert.equal(await page.getByText('Wrong Date Home',{exact:true}).count(),0,'Yanlış tarihli 200 payload DOMa uygulanmamalı.');
    assert.doesNotMatch(await page.evaluate((key)=>localStorage.getItem(key)||'',BRANCH_KEY),/Wrong Date Home/,'Yanlış tarihli 200 payload last-verified kaydını ezmemeli.');
    await context.close();
  }

  // Global Map'e sayfa öncesi enjekte edilen client-only fallback özel güven işareti olmadan okunmaz.
  {
    const context=await browser.newContext();
    const injected={...branchPayload('Injected Home','Injected Away'),browser_last_verified:true,stale:true,degraded:true,archived:true};
    await context.addInitScript((payload)=>{window.__XYZ_MULTISPORT_PAYLOADS__=new Map([['basketball',payload]]);},injected);
    const page=await context.newPage();
    let attempts=0;
    await page.route('**/api/**',async(route)=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/sports/today'){
        attempts+=1;
        await route.fulfill({status:503,contentType:'application/json; charset=utf-8',body:JSON.stringify({error:'api_sports_upstream_unavailable'})});
        return;
      }
      await routeOtherApis(route);
    });
    await page.goto(BASE+'/basketbol/',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('[data-basketball-hub-retry]');
    assert.equal(attempts,1,'Güvensiz global Map preload gerçek scoped fetchi atlamamalı.');
    assert.equal(await page.getByText('Injected Home',{exact:true}).count(),0,'Güvensiz global Map payloadı render edilmemeli.');
    assert.equal(await page.evaluate(()=>window.__XYZ_MULTISPORT_PAYLOADS__.has('basketball')),false,'Güvensiz global Map kaydı temizlenmeli.');
    await context.close();
  }

  // Fresh ağ yanıtı client-only flag enjekte etse bile arşiv/warm yetkisi kazanamaz.
  {
    const context=await browser.newContext();
    const page=await context.newPage();
    const injected=branchPayload('Network Fresh','Network Away');
    injected.browser_last_verified=true;
    injected.archived=true;
    await page.route('**/api/**',async(route)=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/sports/today'){
        await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(injected)});
        return;
      }
      await routeOtherApis(route);
    });
    await page.goto(BASE+'/basketbol/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.body.innerText.includes('Network Fresh'));
    assert.doesNotMatch(await page.locator('#multiSportNote').innerText(),/güncel veri değil/i,'Ağdan gelen client-only browser flagi uygulanmamalı.');
    assert.doesNotMatch(await page.locator('.basketball-fixture-row').getAttribute('class'),/\bis-archived\b/,'Fresh ağ itemındaki client-only archived flagi uygulanmamalı.');
    await context.close();
  }

  // 200 stale/degraded canlı statüyü arşivler, tahmini kapatır ve tek retry ile fresh veriye iyileşir.
  {
    const context=await browser.newContext();
    await speedRetry(context,800);
    const page=await context.newPage();
    let attempts=0;
    await page.route('**/api/**',async(route)=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/sports/today'){
        attempts+=1;
        if(attempts===1){
          await route.fulfill({status:200,headers:{'x-data-stale':'true','retry-after':'1'},contentType:'application/json; charset=utf-8',body:JSON.stringify(branchPayload('Stale Live','Stale Away','proof-bsl','Live - Q3'))});
        }else{
          await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(branchPayload('Stale Recovery','Fresh Away'))});
        }
        return;
      }
      await routeOtherApis(route);
    });
    await page.goto(BASE+'/basketbol/',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('.basketball-fixture-row.is-archived');
    assert.equal(await page.locator('.basketball-overview-metrics b.is-live').innerText(),'0','200 stale canlı statü merkez canlı metriğine girmemeli.');
    assert.doesNotMatch(await page.locator('.basketball-fixture-state').innerText(),/CANLI/,'200 stale canlı statü arşiv etiketiyle bastırılmalı.');
    await page.evaluate(()=>window.openMultiSportHub('basketball','predict',true));
    await page.waitForFunction(()=>/arşiv tahmine açılmaz/i.test(document.querySelector('#multiSportGrid')?.textContent||''));
    assert.equal(await page.locator('[data-predict-key]').count(),0,'200 stale karşılaşma tahmine açılmamalı.');
    await page.waitForFunction(()=>document.body.innerText.includes('Stale Recovery'));
    assert.equal(attempts,2,'200 stale payload Retry-After sonrası yalnız tek otomatik recovery açmalı.');
    assert.equal(await page.locator('[data-predict-key]').count(),1,'Fresh recovery arşiv tahmin kilidini kaldırmalı.');
    await context.close();
  }

  // Sekme yeniden görünür olduğunda dünkü trusted cache tek controlled refresh ile yenilenir.
  {
    const context=await browser.newContext();
    await fakeIstanbulClock(context,yesterday);
    const page=await context.newPage();
    let attempts=0;
    await page.route('**/api/**',async(route)=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/sports/today'){
        attempts+=1;
        const payload=attempts===1?branchPayload('Rollover Old','Old Away'):branchPayload('Rollover Fresh','Fresh Away');
        payload.date=attempts===1?yesterday:today;
        await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(payload)});
        return;
      }
      await routeOtherApis(route);
    });
    await page.goto(BASE+'/basketbol/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.body.innerText.includes('Rollover Old'));
    await page.evaluate((newDate)=>{
      window.__XYZ_TEST_ISTANBUL_DATE__=newDate;
      window.__XYZ_MULTISPORT_PAYLOADS__.get('basketball').browser_last_verified=true;
      document.dispatchEvent(new Event('visibilitychange'));
      document.dispatchEvent(new Event('visibilitychange'));
      document.dispatchEvent(new Event('visibilitychange'));
    },today);
    await page.waitForFunction(()=>document.body.innerText.includes('Rollover Fresh'));
    await page.waitForTimeout(100);
    assert.equal(attempts,2,'Visible rollover art arda eventlerde tek controlled refresh açmalı.');
    await context.close();
  }

  // Cache olmayan error state de gözlenen İstanbul günü değişince yeni günlük scope'u bir kez ister.
  {
    const context=await browser.newContext();
    await fakeIstanbulClock(context,yesterday);
    await speedRetry(context,1500);
    const page=await context.newPage();
    let attempts=0;
    const requestDates=[];
    await page.route('**/api/**',async(route)=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/sports/today'){
        attempts+=1;
        requestDates.push(url.searchParams.get('date'));
        if(attempts===1){
          await route.fulfill({status:503,headers:{'retry-after':'1'},contentType:'application/json; charset=utf-8',body:JSON.stringify({error:'api_sports_upstream_unavailable'})});
        }else{
          const payload=branchPayload('No Cache Rollover','Fresh Day');
          payload.date=today;
          await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(payload)});
        }
        return;
      }
      await routeOtherApis(route);
    });
    await page.goto(BASE+'/basketbol/',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('[data-basketball-hub-retry]');
    await page.evaluate((newDate)=>{
      window.__XYZ_TEST_ISTANBUL_DATE__=newDate;
      document.dispatchEvent(new Event('visibilitychange'));
      document.dispatchEvent(new Event('visibilitychange'));
    },today);
    await page.waitForFunction(()=>document.body.innerText.includes('No Cache Rollover'));
    assert.equal(attempts,2,'No-cache error state rollover yalnız tek controlled refresh açmalı.');
    assert.deepEqual(requestDates,[yesterday,today],'Rollover refresh CDN namespaceini yeni İstanbul gününe taşımalı.');
    await context.close();
  }

  // View değişse bile yalnız bir otomatik retry çalışır; tekrar hata sonsuz döngü açmaz.
  {
    const context=await browser.newContext();
    await seed(context,BRANCH_KEY,branchWrapper());
    await speedRetry(context);
    const page=await context.newPage();
    let attempts=0;
    await page.route('**/api/**',async(route)=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/sports/today'){
        attempts+=1;
        await route.fulfill({status:429,headers:{'retry-after':'1'},contentType:'application/json; charset=utf-8',body:JSON.stringify({error:'api_sports_rate_limited'})});
        return;
      }
      await routeOtherApis(route);
    });
    await page.goto(BASE+'/basketbol/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>/güncel veri değil/i.test(document.querySelector('#multiSportNote')?.textContent||''));
    await page.locator('[data-multi-view="games"]').click();
    await page.waitForTimeout(1200);
    assert.equal(attempts,2,'View değişiminden sonra da yalnız bir otomatik retry çalışmalı; ikinci hata yeni timer açmamalı.');
    assert.equal(new URL(page.url()).pathname,'/basketbol/maclar/','Retry aktif görünüm URL’sini bozmamalı.');
    await context.close();
  }

  // Tek otomatik retry başarılı olursa arşiv DOM'u gerçek payload ile değiştirilir.
  {
    const context=await browser.newContext();
    await seed(context,BRANCH_KEY,branchWrapper());
    await speedRetry(context);
    const page=await context.newPage();
    let attempts=0;
    const requestHeaders=[];
    const requestDates=[];
    await page.route('**/api/**',async(route)=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/sports/today'){
        attempts+=1;
        requestHeaders.push(route.request().headers());
        requestDates.push(url.searchParams.get('date'));
        if(attempts===1){
          await route.fulfill({status:429,headers:{'retry-after':'1'},contentType:'application/json; charset=utf-8',body:JSON.stringify({error:'api_sports_rate_limited'})});
        }else{
          await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(branchPayload('Recovery Home','Recovery Away'))});
        }
        return;
      }
      await routeOtherApis(route);
    });
    await page.goto(BASE+'/basketbol/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.body.innerText.includes('Recovery Home'));
    assert.equal(attempts,2,'Başarılı iyileşme tek otomatik retry ile tamamlanmalı.');
    assert.doesNotMatch(await page.locator('#multiSportNote').innerText(),/güncel veri değil/i,'Başarılı response arşiv durumunu DOM’dan kaldırmalı.');
    assert.ok(requestHeaders.every((headers)=>!headers['cache-control']),'Today fetch Cache-Control: no-cache göndermemeli.');
    assert.deepEqual(requestDates,[today,today],'İlk istek ve otomatik retry aynı açık günlük CDN namespace’ini kullanmalı.');
    await context.close();
  }

  // Branş değişimi bekleyen retry timer/controller bağlamını iptal eder.
  {
    const context=await browser.newContext();
    await seed(context,BRANCH_KEY,branchWrapper());
    await speedRetry(context,1500);
    const page=await context.newPage();
    let basketballAttempts=0;
    await page.route('**/api/**',async(route)=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/sports/today'&&url.searchParams.get('sport')==='basketball'){
        basketballAttempts+=1;
        await route.fulfill({status:429,headers:{'retry-after':'1'},contentType:'application/json; charset=utf-8',body:JSON.stringify({error:'api_sports_rate_limited'})});
        return;
      }
      if(url.pathname==='/api/sports/today'&&url.searchParams.get('sport')==='volleyball'){
        await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(volleyballPayload())});
        return;
      }
      await routeOtherApis(route);
    });
    await page.goto(BASE+'/basketbol/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>/güncel veri değil/i.test(document.querySelector('#multiSportNote')?.textContent||''));
    await page.evaluate(()=>window.openMultiSportHub('volleyball','home',true));
    await page.waitForSelector('.volleyball-fixture-row');
    await page.waitForTimeout(1800);
    assert.equal(basketballAttempts,1,'Branş switch iptal edilen basketbol timer’ının upstream’e gitmesini engellemeli.');
    await context.close();
  }

  // Scope-proof aktarımı ve scope-keyed standings last-verified/409 fallback.
  {
    const context=await browser.newContext();
    const page=await context.newPage();
    let standingsAttempts=0;
    const proofs=[];
    const standingsHeaders=[];
    await page.route('**/api/**',async(route)=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/sports/today'){
        await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(branchPayload())});
        return;
      }
      if(url.pathname==='/api/sports/basketball/standings'){
        standingsAttempts+=1;
        proofs.push(url.searchParams.get('proof'));
        standingsHeaders.push(route.request().headers());
        if(standingsAttempts===1){
          await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(standingsPayload())});
        }else{
          await route.fulfill({status:409,contentType:'application/json; charset=utf-8',body:JSON.stringify({error:'basketball_standings_scope_not_discovered'})});
        }
        return;
      }
      await routeOtherApis(route);
    });
    await page.goto(BASE+BSL_ROUTE,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelectorAll('.basketball-standing-row').length===2);
    const stored=await page.evaluate((key)=>localStorage.getItem(key),STANDINGS_KEY);
    assert.ok(stored,'Başarılı lig+sezon standings scope-keyed saklanmalı.');
    assert.ok(new TextEncoder().encode(stored).byteLength<=64*1024,'Standings last-verified kaydı 64 KiB sınırını aşmamalı.');
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>/2 takım · Tarayıcıda saklanan son doğrulanmış puan tablosu/i.test(document.querySelector('.basketball-standings-status')?.textContent||'')
      &&document.querySelectorAll('.basketball-standing-row').length===2);
    assert.equal(await page.locator('.basketball-standing-row').count(),2,'Exact scope 409 son doğrulanmış tabloyu dürüst arşiv olarak korumalı.');
    assert.deepEqual(proofs,['proof-bsl','proof-bsl'],'Today proof her standings isteğine aktarılmalı.');
    assert.ok(standingsHeaders.every((headers)=>!headers['cache-control']),'Standings fetch Cache-Control: no-cache göndermemeli.');
    await context.close();
  }

  // Scope uyuşmayan veya read sınırını aşan standings snapshot başka lige sızmamalı.
  for(const [label,invalid] of [
    ['scope-mismatch',JSON.stringify({version:1,scope:'12:2026-2027',savedAt:Date.now(),payload:{...standingsPayload(),leagueId:'99'}})],
    ['oversized','x'.repeat(64*1024+1)],
  ]){
    const context=await browser.newContext();
    await seed(context,STANDINGS_KEY,invalid);
    const page=await context.newPage();
    await page.route('**/api/**',async(route)=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/sports/today'){
        await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(branchPayload())});
        return;
      }
      if(url.pathname==='/api/sports/basketball/standings'){
        await route.fulfill({status:503,contentType:'application/json; charset=utf-8',body:JSON.stringify({error:'basketball_standings_unavailable'})});
        return;
      }
      await routeOtherApis(route);
    });
    await page.goto(BASE+BSL_ROUTE,{waitUntil:'domcontentloaded'});
    await page.waitForSelector('.basketball-standings-message.is-error');
    assert.equal(await page.locator('.basketball-standing-row').count(),0,`${label} standings satırı render edilmemeli.`);
    assert.equal(await page.evaluate((key)=>localStorage.getItem(key),STANDINGS_KEY),null,`${label} standings snapshot silinmeli.`);
    await context.close();
  }

  console.log('OK  Multisport last-verified, retry, cancellation ve standings proof dayanıklılık sözleşmeleri geçti.');
} finally {
  await browser?.close();
  server.kill();
}
