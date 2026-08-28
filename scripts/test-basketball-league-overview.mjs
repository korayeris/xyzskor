import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { launchChromium } from './test-tools/lib/playwright-loader.mjs';

const PORT = Number(process.env.XYZSKOR_TEST_PORT || 4418);
const BASE = `http://127.0.0.1:${PORT}`;
const BSL_ROUTE='/basketbol/lig/basketbol-super-ligi--id-12--sezon-2026-2027/';
const server = spawn(process.execPath, ['scripts/dev-server.mjs'], {
  cwd:new URL('..', import.meta.url),
  env:{ ...process.env, XYZSKOR_DEV_PORT:String(PORT) },
  stdio:['ignore','pipe','pipe'],
});

let serverError='';
server.stderr.on('data',(chunk)=>{ serverError+=String(chunk); });

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

const todayPayload={
  source:'mock',
  date:'2026-08-28',
  updatedAt:'2026-08-28T09:00:00.000Z',
  sports:{basketball:[
    {id:'bsl-1',sport:'basketball',league:'Basketbol Süper Ligi',leagueId:12,season:'2026-2027',country:'Türkiye',status:'Not Started',time:'20:30',timestamp:1787949000,first:{name:'Anadolu Efes'},second:{name:'Fenerbahçe Beko'}},
    {id:'euro-1',sport:'basketball',league:'EuroLeague',leagueId:99,season:'2026-2027',country:'Avrupa',status:'Quarter 1',score:'61 - 58',time:'CANLI',timestamp:1787940000,first:{name:'Olympiacos'},second:{name:'Real Madrid'}},
    {id:'nba-1',sport:'basketball',league:'NBA',leagueId:77,season:'2026-2027',country:'ABD',status:'Game Finished',score:'110 - 104',time:'BİTTİ',timestamp:1787972400,first:{name:'Boston Celtics'},second:{name:'New York Knicks'}},
    {id:'acb-1',sport:'basketball',league:'ACB',leagueId:88,season:'2026-2027',country:'İspanya',status:'Break Time',time:'DEVRE',timestamp:1787954400,first:{name:'Barcelona'},second:{name:'Valencia Basket'}},
    {id:'dup-a',sport:'basketball',league:'Premier Basket',leagueId:111,season:'2026',country:'Ülke A',status:'Over Time',time:'UZATMA',timestamp:1787958000,first:{name:'Alpha'},second:{name:'Beta'}},
    {id:'dup-b',sport:'basketball',league:'Premier Basket',leagueId:112,season:'2026',country:'Ülke B',status:'Not Started',time:'21:00',timestamp:1787961600,first:{name:'Gamma'},second:{name:'Delta'}},
  ]},
};

const teamNames=['Anadolu Efes','Fenerbahçe Beko','Beşiktaş','Türk Telekom','Karşıyaka','Tofaş','Galatasaray','Bahçeşehir Koleji'];
function standingsPayload(leagueId,season,names=teamNames){
  return {
    source:'api-sports-basketball',provider:'api-sports',sport:'basketball',leagueId,season,
    updatedAt:'2026-08-28T09:01:00.000Z',
    standings:names.map((name,index)=>({
      position:index+1,group:'Normal Sezon',team:{id:index+1,name},played:8,won:8-index,lost:index,
      pointsFor:720-index*9,pointsAgainst:610+index*8,pointDifference:110-index*17,percentage:(8-index)/8,form:'WWLWW',
    })),
    coverage:{standings:names.length,groups:1},
  };
}

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
      await new Promise((resolve)=>setTimeout(resolve,240));
      await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(todayPayload)});
      return;
    }
    if(url.pathname==='/api/sports/basketball/standings'){
      const league=url.searchParams.get('league');
      const season=url.searchParams.get('season');
      await new Promise((resolve)=>setTimeout(resolve,220));
      if(league==='88'){
        await route.fulfill({status:503,contentType:'application/json; charset=utf-8',body:JSON.stringify({error:'basketball_standings_unavailable'})});
        return;
      }
      const payload=league==='77' ? standingsPayload(league,season,[]) : standingsPayload(league,season,league==='99'?teamNames.slice().reverse():teamNames);
      await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(payload)});
      return;
    }
    await route.fulfill({status:503,contentType:'application/json; charset=utf-8',body:JSON.stringify({error:'not_mocked'})});
  });

  await page.goto(BASE+BSL_ROUTE,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.basketball-loading-shell .basketball-standing-skeleton');
  assert.equal(await page.locator('#multiSportGrid').getAttribute('aria-busy'),'true','Soğuk basketbol açılışı aria-busy olmalı.');
  assert.ok(await page.locator('.basketball-loading-shell .basketball-standing-skeleton').count()>=6,'Soğuk açılış tam tablo shimmerı göstermeli.');

  await page.waitForSelector('[data-basketball-league-center][data-basketball-standings-scope="12:2026-2027"]');
  assert.ok(await page.locator('.basketball-standing-skeleton').count()>=6,'Günlük program geldikten sonra standings isteği boyunca tablo shimmerı sürmeli.');
  await page.waitForFunction(()=>document.querySelectorAll('.basketball-standing-row').length===8&&document.querySelector('.basketball-standings-table')?.getAttribute('aria-busy')==='false');

  const semantics=await page.evaluate(()=>({
    h1:[...document.querySelectorAll('#multiSportHub h1')].filter((node)=>node.offsetParent!==null).map((node)=>node.textContent.trim()),
    caption:document.querySelector('.basketball-standings-table caption')?.textContent.trim(),
    rowHeaders:document.querySelectorAll('.basketball-standings-table tbody th[scope="row"]').length,
    selectedLeague:document.querySelector('#multiLeagueStrip [aria-current="page"]')?.textContent.trim(),
    classificationHook:document.querySelector('#multiLeagueStrip')?.dataset.sportClassification,
    classificationTitle:document.querySelector('[data-classification-title]')?.textContent.trim(),
    classificationBeforeViews:Boolean(document.querySelector('#multiLeagueStrip')?.compareDocumentPosition(document.querySelector('#multiSportViews'))&Node.DOCUMENT_POSITION_FOLLOWING),
    bodyOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    tableRegion:document.querySelector('.basketball-standings-scroll')?.getAttribute('role'),
    tableHeaders:[...document.querySelectorAll('.basketball-standings-table thead th')].filter((node)=>getComputedStyle(node).display!=='none').length,
    tableScrollable:(()=>{const region=document.querySelector('.basketball-standings-scroll');if(!region)return false;region.scrollLeft=region.scrollWidth;return region.scrollWidth>region.clientWidth&&region.scrollLeft>0;})(),
    decorativeTeamLogos:[...document.querySelectorAll('.basketball-standing-row img')].every((image)=>image.alt===''),
    heroFont:parseFloat(getComputedStyle(document.querySelector('.multisport-hero h1')).fontSize),
    heroPaddingTop:parseFloat(getComputedStyle(document.querySelector('.multisport-hero')).paddingTop),
    fixtures:document.querySelectorAll('.basketball-fixture-row').length,
  }));
  assert.deepEqual(semantics.h1,['Basketbol'],'Basketbol rotası tek görünür branş H1 kullanmalı.');
  assert.equal(semantics.caption,'Basketbol Süper Ligi puan durumu','Puan tablosu erişilebilir caption taşımalı.');
  assert.equal(semantics.rowHeaders,8,'Her takım gerçek satır başlığı olmalı.');
  assert.equal(semantics.selectedLeague,'Basketbol Süper Ligi','İlk doğrulanmış lig seçili açılmalı.');
  assert.equal(semantics.classificationHook,'leagues','Lig rayı ortak sınıflandırma hook’unu taşımalı.');
  assert.equal(semantics.classificationTitle,'Basketbol Süper Ligi','Merkez kimliği seçili sınıflandırmayla aynı olmalı.');
  assert.equal(semantics.classificationBeforeViews,true,'Lig sınıflandırması bölüm sekmelerinden önce görünmeli.');
  assert.equal(new URL(page.url()).pathname,BSL_ROUTE,'Doğrudan lig URL’si seçili basketbol kapsamını korumalı.');
  assert.ok(semantics.bodyOverflow<=1,`390px görünüm body taşırmamalı: ${semantics.bodyOverflow}px`);
  assert.equal(semantics.tableRegion,'region','Kaydırılabilir tablo adlandırılmış region olmalı.');
  assert.equal(semantics.tableHeaders,7,'Mobil tabloda yüzde ve averaj dahil yedi sütun erişilebilir kalmalı.');
  assert.equal(semantics.tableScrollable,true,'Mobil tablo body taşırmadan yatay kaydırılabilmeli.');
  assert.equal(semantics.decorativeTeamLogos,true,'Bitişik takım metni olan logolar ekran okuyucuda adı tekrarlamamalı.');
  assert.equal(semantics.heroFont,32,'390px basketbol hero başlığı yeni mobil tipografi değerini kullanmalı.');
  assert.equal(semantics.heroPaddingTop,18,'390px basketbol hero padding değeri eski important kuralına yenilmemeli.');
  assert.equal(semantics.fixtures,1,'Seçili lig yalnız kendi fikstürünü göstermeli.');
  assert.equal(await page.locator('.basketball-fixture-row.is-live').count(),0,'Not Started durumu canlı olarak işaretlenmemeli.');

  assert.equal(requested.filter((path)=>path.startsWith('/api/sports/today?sport=basketball')).length,1,'Basketbol günlük feed yalnız bir kez istenmeli.');
  assert.equal(requested.filter((path)=>path.startsWith('/api/sports/basketball/standings?league=12')).length,1,'İlk lig standings yalnız bir kez istenmeli.');
  assert.equal(requested.filter((path)=>path.startsWith('/api/football/')).length,0,'Basketbol görünümü futbol API ailesine dokunmamalı.');

  await page.locator('[data-multi-view="games"]').click();
  await page.waitForFunction(()=>document.activeElement?.dataset?.multiView==='games');
  assert.equal(new URL(page.url()).pathname,BSL_ROUTE+'maclar/','Bölüm geçişi seçili lig kapsamını URL’de korumalı.');
  await page.locator('[data-multi-view="home"]').click();
  await page.waitForFunction(()=>document.activeElement?.dataset?.multiView==='home'&&document.querySelectorAll('.basketball-standing-row').length===8);
  assert.equal(new URL(page.url()).pathname,BSL_ROUTE,'Genel görünüm seçili lig URL’sine dönmeli.');

  await page.locator('#multiLeagueStrip [data-league="scope:99:2026-2027"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-basketball-league-center]')?.dataset.basketballStandingsScope==='99:2026-2027');
  await page.waitForFunction(()=>document.querySelectorAll('.basketball-standing-row').length===8&&document.querySelector('.basketball-standings-table')?.getAttribute('aria-busy')==='false');
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.league),'scope:99:2026-2027','Lig değişiminden sonra klavye odağı seçili kontrolde kalmalı.');
  assert.equal(await page.locator('.basketball-fixture-row.is-live').count(),1,'Canlı maç seçili ligde belirgin kalmalı.');
  const euroRoute='/basketbol/lig/euroleague--id-99--sezon-2026-2027/';
  assert.equal(new URL(page.url()).pathname,euroRoute,'Lig seçimi paylaşılabilir provider-scope URL üretmeli.');

  await page.locator('#multiLeagueStrip [data-league="scope:77:2026-2027"]').click();
  await page.waitForFunction(()=>/doğrulanmış sıralama yayımlamadı/i.test(document.querySelector('.basketball-standings-status')?.textContent||''));
  assert.equal(await page.locator('.basketball-standing-row').count(),0,'Doğrulanmış boş standings sahte satır üretmemeli.');
  assert.match(await page.locator('.basketball-fixtures-body').innerText(),/Boston Celtics/,'Boş standings günlük fikstürü silmemeli.');
  const nbaRoute='/basketbol/lig/nba--id-77--sezon-2026-2027/';
  assert.equal(new URL(page.url()).pathname,nbaRoute,'İkinci lig scope’u URL’ye karışmadan yazılmalı.');
  await page.goBack();
  await page.waitForFunction(()=>document.querySelector('[data-basketball-league-center]')?.dataset.basketballStandingsScope==='99:2026-2027');
  assert.equal(new URL(page.url()).pathname,euroRoute,'Back seçili EuroLeague kapsamını geri yüklemeli.');
  assert.match(await page.locator('.basketball-fixtures-body').innerText(),/Olympiacos/,'Back sonrası fikstür de EuroLeague kapsamına dönmeli.');
  await page.goForward();
  await page.waitForFunction(()=>document.querySelector('[data-basketball-league-center]')?.dataset.basketballStandingsScope==='77:2026-2027');
  assert.equal(new URL(page.url()).pathname,nbaRoute,'Forward seçili NBA kapsamını geri yüklemeli.');
  assert.match(await page.locator('.basketball-fixtures-body').innerText(),/Boston Celtics/,'Forward sonrası fikstür NBA kapsamına dönmeli.');

  await page.locator('#multiLeagueStrip [data-league="scope:88:2026-2027"]').click();
  await page.waitForSelector('.basketball-standings-message.is-error [data-basketball-standings-retry]');
  assert.equal(await page.locator('.basketball-standings-status').getAttribute('role'),'alert','Standings sağlayıcı hatası canlı alert olmalı.');
  assert.match(await page.locator('.basketball-fixtures-body').innerText(),/Barcelona/,'Standings hatası fikstür panelini korumalı.');
  assert.equal(await page.locator('.basketball-fixture-row.is-live').count(),1,'Break Time durumu canlı maç akışında kalmalı.');
  await page.locator('[data-basketball-standings-retry]').click();
  await page.waitForSelector('.basketball-standings-message.is-error [data-basketball-standings-retry]');
  assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('basketball-standings-scroll')),true,'Standings retry odağı görünür tablo bölgesinde tutmalı.');

  assert.equal(await page.locator('#multiLeagueStrip [aria-label^="Premier Basket,"]').count(),2,'Aynı adlı farklı lig scope’ları iki ayrı seçim olmalı.');
  await page.locator('#multiLeagueStrip [data-league="scope:111:2026"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-basketball-league-center]')?.dataset.basketballStandingsScope==='111:2026');
  assert.match(await page.locator('.basketball-fixtures-body').innerText(),/Alpha/,'İlk aynı adlı lig yalnız kendi fikstürünü göstermeli.');
  assert.doesNotMatch(await page.locator('.basketball-fixtures-body').innerText(),/Gamma/,'İkinci aynı adlı ligin fikstürü ilk scope’a karışmamalı.');
  assert.equal(await page.locator('.basketball-fixture-row.is-live').count(),1,'Over Time durumu canlı olarak işaretlenmeli.');
  await page.locator('#multiLeagueStrip [data-league="scope:112:2026"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-basketball-league-center]')?.dataset.basketballStandingsScope==='112:2026');
  assert.match(await page.locator('.basketball-fixtures-body').innerText(),/Gamma/,'İkinci aynı adlı lig kendi fikstürünü göstermeli.');
  assert.doesNotMatch(await page.locator('.basketball-fixtures-body').innerText(),/Alpha/,'İlk aynı adlı ligin fikstürü ikinci scope’a karışmamalı.');

  const standingsBeforeAll=requested.filter((path)=>path.startsWith('/api/sports/basketball/standings')).length;
  await page.locator('#multiLeagueStrip [data-classification-key="all"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-basketball-league-center]')?.dataset.leagueRoute===''&&/toplu görünümde puan tablosu gösterilmez/i.test(document.querySelector('.basketball-standings-status')?.textContent||''));
  assert.equal(new URL(page.url()).pathname,'/basketbol/','Tümü sınıflandırması kanonik basketbol köküne dönmeli.');
  assert.equal(await page.locator('[data-classification-title]').innerText(),'Tüm ligler','Toplu görünüm aggregate kimliğini açıkça göstermeli.');
  assert.equal(await page.locator('.basketball-overview-metrics').getAttribute('aria-label'),'Tüm ligler özeti','Toplu metrikler ekran okuyucuya seçili lig varmış gibi tanıtılmamalı.');
  assert.match(await page.locator('.basketball-source-note').innerText(),/Günlük toplu kapsam[\s\S]*Lig puan tabloları karıştırılmaz[\s\S]*bir lig seçilmeden sıralama gösterilmez/i,'Toplu veri notu günlük aggregate kapsamı ve standings sınırını dürüstçe açıklamalı.');
  assert.equal(await page.locator('.basketball-standing-row').count(),0,'Toplu görünüm farklı ligleri tek puan tablosunda karıştırmamalı.');
  assert.equal(await page.locator('.basketball-fixture-row').count(),6,'Toplu görünüm yalnız doğrulanmış günlük maçları aggregate edebilmeli.');
  assert.equal(requested.filter((path)=>path.startsWith('/api/sports/basketball/standings')).length,standingsBeforeAll,'Tümü görünümü ligleri karıştıran yeni standings isteği açmamalı.');
  await page.goBack();
  await page.waitForFunction(()=>document.querySelector('[data-basketball-league-center]')?.dataset.basketballStandingsScope==='112:2026');
  assert.match(await page.locator('.basketball-fixtures-body').innerText(),/Gamma/,'Back toplu görünümden önceki provider scope’unu geri yüklemeli.');

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
    if(url.pathname==='/api/sports/basketball/standings'){
      await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(standingsPayload(url.searchParams.get('league'),url.searchParams.get('season')))});
      return;
    }
    await route.fulfill({status:503,contentType:'application/json; charset=utf-8',body:JSON.stringify({error:'not_mocked'})});
  });
  await retryPage.goto(BASE+BSL_ROUTE,{waitUntil:'domcontentloaded'});
  await retryPage.waitForSelector('[data-basketball-hub-retry]');
  await retryPage.locator('[data-basketball-hub-retry]').click();
  await retryPage.waitForFunction(()=>document.activeElement?.matches('.basketball-league-identity h2')&&document.querySelectorAll('.basketball-standing-row').length===8);
  assert.equal(todayAttempts,2,'Hub retry yalnız bir kontrollü yeni günlük feed isteği açmalı.');
  await retryPage.close();

  console.log('OK  Basketbol lig merkezi, gerçek standings ve mobil erişilebilirlik sözleşmeleri geçti.');
} finally {
  await browser?.close();
  server.kill();
}
