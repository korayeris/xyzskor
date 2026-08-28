import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launchChromium } from './test-tools/lib/playwright-loader.mjs';

const PORT=Number(process.env.XYZSKOR_TEST_PORT||4428);
const BASE=`http://127.0.0.1:${PORT}`;
const ROOT=fileURLToPath(new URL('..',import.meta.url));
const server=spawn(process.execPath,['scripts/dev-server.mjs'],{
  cwd:ROOT,
  env:{...process.env,XYZSKOR_DEV_PORT:String(PORT)},
  stdio:['ignore','pipe','pipe'],
});

let serverError='';
server.stderr.on('data',(chunk)=>{serverError+=String(chunk);});

async function waitForServer(){
  for(let attempt=0;attempt<60;attempt+=1){
    try{
      const response=await fetch(BASE,{method:'HEAD'});
      if(response.ok) return;
    }catch(_error){}
    await new Promise((resolve)=>setTimeout(resolve,100));
  }
  throw new Error(`Test sunucusu başlamadı. ${serverError}`);
}

const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const todayPayload={
  source:'mock',
  date:today,
  updatedAt:`${today}T09:00:00.000Z`,
  sports:{volleyball:[
    {id:'sultan-1',sport:'volleyball',league:'Sultanlar Ligi',leagueId:31,season:'2026-2027',country:'Türkiye',status:'Set 3',score:'1 - 1',time:'CANLI',timestamp:1787940000,venue:'Burhan Felek Vestel Voleybol Salonu',first:{name:'Eczacıbaşı Dynavit'},second:{name:'VakıfBank'}},
    {id:'sultan-2',sport:'volleyball',league:'Sultanlar Ligi',leagueId:31,season:'2026-2027',country:'Türkiye',status:'Not Started',time:'20:30',timestamp:1787949000,first:{name:'Fenerbahçe Medicana'},second:{name:'Galatasaray Daikin'}},
    {id:'efeler-1',sport:'volleyball',league:'Efeler Ligi',leagueId:32,season:'2026-2027',country:'Türkiye',status:'Finished',score:'3 - 1',time:'BİTTİ',timestamp:1787934000,first:{name:'Halkbank'},second:{name:'Ziraat Bankkart'}},
    {id:'premier-1',sport:'volleyball',league:'Premier Volleyball League',leagueId:92,season:'2026',country:'Filipinler',status:'Scheduled',time:'22:00',timestamp:1787958000,first:{name:'Creamline'},second:{name:'Choco Mucho'}},
    {id:'global-it',sport:'volleyball',league:'Global Cup',leagueId:201,season:'2026',country:'İtalya',status:'Scheduled',time:'18:00',timestamp:1787950000,first:{name:'Milano'},second:{name:'Trentino'}},
    {id:'global-br',sport:'volleyball',league:'Global Cup',leagueId:202,season:'2026',country:'Brezilya',status:'Scheduled',time:'19:00',timestamp:1787954000,first:{name:'Minas'},second:{name:'Sada Cruzeiro'}},
  ]},
};

let browser;
try{
  await waitForServer();
  browser=await launchChromium({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const requested=[];
  await page.route('**/api/**',async(route)=>{
    const url=new URL(route.request().url());
    requested.push(url.pathname+url.search);
    if(url.pathname==='/api/sports/today'){
      await new Promise((resolve)=>setTimeout(resolve,650));
      await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(todayPayload)});
      return;
    }
    await route.fulfill({status:503,contentType:'application/json; charset=utf-8',body:JSON.stringify({error:'not_mocked'})});
  });

  await page.goto(`${BASE}/voleybol/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(document.getElementById('xyzVolleyballCenterStylesheet')?.sheet));
  await page.waitForSelector('.volleyball-loading-shell .volleyball-fixture-skeleton i');
  assert.equal(await page.locator('#multiSportGrid').getAttribute('aria-busy'),'true','Soğuk voleybol açılışı aria-busy olmalı.');
  assert.equal(await page.locator('.volleyball-loading-shell .volleyball-fixture-skeleton i').count(),7,'Program shimmerı tam akış iskeletini göstermeli.');
  assert.equal(await page.locator('.volleyball-loading-shell .volleyball-team-skeleton i').count(),8,'Takım paneli bağımsız shimmer göstermeli.');

  await page.waitForSelector('[data-volleyball-league-center][data-volleyball-scope="Sultanlar Ligi"]');
  const semantics=await page.evaluate(()=>({
    h1:[...document.querySelectorAll('#multiSportHub h1')].filter((node)=>node.offsetParent!==null).map((node)=>node.textContent.trim()),
    selectedLeague:document.querySelector('#multiLeagueStrip [aria-pressed="true"]')?.textContent.trim(),
    fixtures:document.querySelectorAll('.volleyball-fixture-row').length,
    teams:document.querySelectorAll('.volleyball-team-pool li').length,
    live:document.querySelectorAll('.volleyball-fixture-row.is-live').length,
    programRegion:document.querySelector('.volleyball-program-scroll')?.getAttribute('role'),
    programTabIndex:document.querySelector('.volleyball-program-scroll')?.getAttribute('tabindex'),
    bodyOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    overviewColumns:getComputedStyle(document.querySelector('.volleyball-overview-layout')).gridTemplateColumns.split(' ').filter(Boolean).length,
    heroFont:parseFloat(getComputedStyle(document.querySelector('.multisport-hero h1')).fontSize),
    decorativeLogos:[...document.querySelectorAll('.volleyball-league-center img')].every((image)=>image.alt===''),
    tables:document.querySelectorAll('.volleyball-league-center table').length,
    metrics:[...document.querySelectorAll('.volleyball-overview-metrics article > b')].map((node)=>node.textContent.trim()),
  }));
  assert.deepEqual(semantics.h1,['Voleybol'],'Voleybol rotası tek görünür branş H1 kullanmalı.');
  assert.equal(semantics.selectedLeague,'Sultanlar Ligi','İlk doğrulanmış lig seçili açılmalı.');
  assert.equal(semantics.fixtures,2,'Lig merkezi yalnız seçili ligin maçlarını göstermeli.');
  assert.equal(semantics.teams,4,'Takım havuzu seçili programdan türetilmeli.');
  assert.equal(semantics.live,1,'Set bilgisi canlı durum olarak işaretlenmeli.');
  assert.equal(semantics.programRegion,'region','Kaydırılabilir program adlandırılmış region olmalı.');
  assert.equal(semantics.programTabIndex,'0','Program bölgesi klavyeyle odaklanabilmeli.');
  assert.ok(semantics.bodyOverflow<=1,`390px görünüm body taşırmamalı: ${semantics.bodyOverflow}px`);
  assert.equal(semantics.overviewColumns,1,'Mobil iki kolonlu merkez tek kolona inmeli.');
  assert.equal(semantics.heroFont,32,'Mobil voleybol başlığı futbol/basketbol ailesi ölçeğini kullanmalı.');
  assert.equal(semantics.decorativeLogos,true,'Bitişik takım metni olan logolar adı tekrarlamamalı.');
  assert.equal(semantics.tables,0,'Günlük program verisinden sahte puan tablosu üretilmemeli.');
  assert.deepEqual(semantics.metrics,['2','1','0','4'],'Metrikler yalnız doğrulanmış seçili lig programından hesaplanmalı.');

  assert.equal(requested.filter((path)=>path.startsWith('/api/sports/today?sport=volleyball')).length,1,'Voleybol günlük feed yalnız bir kez istenmeli.');
  assert.equal(requested.filter((path)=>path.startsWith('/api/sports/basketball/standings')).length,0,'Voleybol merkezi basketbol puan tablosu API yoluna dokunmamalı.');
  assert.equal(requested.filter((path)=>path.startsWith('/api/football/')).length,0,'Voleybol merkezi futbol API ailesine dokunmamalı.');

  await page.locator('#multiLeagueStrip [data-league="Premier Volleyball League"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-volleyball-league-center]')?.dataset.volleyballScope==='Premier Volleyball League');
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.league),'Premier Volleyball League','Lig değişiminden sonra klavye odağı seçili pill kontrolde kalmalı.');
  assert.match(await page.locator('.volleyball-program-scroll').innerText(),/Creamline/,'Seçili harici lig programı kendi takımlarını göstermeli.');
  assert.doesNotMatch(await page.locator('.volleyball-program-scroll').innerText(),/Eczacıbaşı/,'Önceki lig programı yeni scope’a karışmamalı.');

  const duplicateScopes=page.locator('#multiLeagueStrip [aria-label^="Global Cup,"]');
  assert.equal(await duplicateScopes.count(),2,'Aynı adlı farklı sağlayıcı ligleri ayrı seçim kapsamları olmalı.');
  await page.locator('#multiLeagueStrip [aria-label="Global Cup, İtalya, 2026"]').click();
  assert.match(await page.locator('.volleyball-program-scroll').innerText(),/Milano/,'Aynı adlı lig seçimi kendi leagueId/sezon fikstürünü göstermeli.');
  assert.doesNotMatch(await page.locator('.volleyball-program-scroll').innerText(),/Minas/,'Aynı adlı başka lig seçilen kapsama karışmamalı.');

  await page.locator('#multiLeagueStrip [data-league="CEV Şampiyonlar Ligi"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-volleyball-league-center]')?.dataset.volleyballScope==='CEV Şampiyonlar Ligi');
  assert.equal(await page.locator('.volleyball-verified-empty').count(),2,'Doğrulanmış boş lig program ve takım panellerinde açıkça gösterilmeli.');
  assert.equal(await page.locator('.volleyball-fixture-row').count(),0,'Doğrulanmış boş sonuç sahte maç üretmemeli.');
  assert.equal(await page.locator('.volleyball-team-pool li').count(),0,'Doğrulanmış boş sonuç sahte takım üretmemeli.');

  const retryPage=await browser.newPage({viewport:{width:390,height:844}});
  let todayAttempts=0;
  await retryPage.route('**/api/**',async(route)=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/sports/today'){
      todayAttempts+=1;
      if(todayAttempts===1){
        await route.fulfill({status:503,contentType:'application/json; charset=utf-8',body:JSON.stringify({error:'api_sports_upstream_unavailable'})});
      }else{
        await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(todayPayload)});
      }
      return;
    }
    await route.fulfill({status:503,contentType:'application/json; charset=utf-8',body:JSON.stringify({error:'not_mocked'})});
  });
  await retryPage.goto(`${BASE}/voleybol/`,{waitUntil:'domcontentloaded'});
  await retryPage.waitForFunction(()=>Boolean(document.getElementById('xyzVolleyballCenterStylesheet')?.sheet));
  await retryPage.waitForSelector('[data-volleyball-hub-retry]');
  assert.equal(await retryPage.locator('.volleyball-error-state').getAttribute('role'),'alert','Sağlayıcı hatası doğrulanmış boş sonuçtan ayrı bir alert olmalı.');
  await retryPage.locator('[data-volleyball-hub-retry]').click();
  await retryPage.waitForFunction(()=>document.activeElement?.matches('.volleyball-league-identity h2')&&document.querySelectorAll('.volleyball-fixture-row').length===2);
  assert.equal(todayAttempts,2,'Hub retry yalnız bir kontrollü yeni günlük feed isteği açmalı.');
  await retryPage.close();

  console.log('OK  Voleybol lig merkezi, doğrulanmış günlük program ve mobil erişilebilirlik sözleşmeleri geçti.');
} finally {
  await browser?.close();
  server.kill();
}
