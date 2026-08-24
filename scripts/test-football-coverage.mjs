import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const dataSource = await readFile(new URL('../assets/js/data.js', import.meta.url), 'utf8');
const liveSource = await readFile(new URL('../assets/js/live.js', import.meta.url), 'utf8');
const uiSource = await readFile(new URL('../assets/js/ui.js', import.meta.url), 'utf8');
const start = dataSource.indexOf('const FOOTBALL_COVERAGE_CACHE_MS');
const end = dataSource.indexOf('const LEAGUE_CONTEXT', start);
assert.ok(start >= 0 && end > start, 'Coverage istemci kodu bulunmalı.');

function createHarness(fetchImpl){
  const context = { fetch:fetchImpl, Map, Date, Error, console };
  vm.createContext(context);
  vm.runInContext(`function competitionLabelBySlug(key){ return key; }\n${dataSource.slice(start,end)}\nthis.api={loadFootballCoverage,footballCoverageState,footballCoverageUnavailable};`, context);
  return context.api;
}

function functionSource(source,name){
  const asyncStart=source.indexOf(`async function ${name}(`);
  const start=asyncStart>=0 ? asyncStart : source.indexOf(`function ${name}(`);
  assert.ok(start>=0, `${name} bulunmalı.`);
  const bodyStart=source.indexOf('{',start);
  let depth=0, quote=null, escaped=false;
  for(let index=bodyStart;index<source.length;index+=1){
    const char=source[index];
    if(quote){ if(escaped) escaped=false; else if(char==='\\') escaped=true; else if(char===quote) quote=null; continue; }
    if(char==="'"||char==='"'||char==='`'){quote=char;continue;}
    if(char==='{') depth+=1;
    if(char==='}' && --depth===0) return source.slice(start,index+1);
  }
  throw new Error(`${name} tamamlanmadı.`);
}

let calls = 0;
const success = createHarness(async()=>{
  calls += 1;
  return { ok:true, json:async()=>({updatedAt:'2026-08-17T00:00:00Z',selected:[
    {league:'super-lig',available:true,currentSeasonId:'1'},
    {league:'la-liga',available:false,currentSeasonId:null}
  ]}) };
});
await success.loadFootballCoverage();
await success.loadFootballCoverage();
assert.equal(calls, 1, 'Geçerli cache süresinde coverage yalnız bir kez çağrılmalı.');
assert.equal(success.footballCoverageUnavailable('la-liga'), true, 'Kapsam dışı lig unavailable olmalı.');
assert.equal(success.footballCoverageUnavailable('super-lig'), false, 'Kapsamdaki lig açık kalmalı.');

let concurrentCalls=0;
let releaseCoverage;
const concurrent=createHarness(()=>{
  concurrentCalls+=1;
  return new Promise(resolve=>{ releaseCoverage=()=>resolve({ok:true,json:async()=>({selected:[]})}); });
});
const pending=[concurrent.loadFootballCoverage(),concurrent.loadFootballCoverage(),concurrent.loadFootballCoverage()];
assert.equal(concurrentCalls,1,'Eşzamanlı selector renderları tek coverage isteğini paylaşmalı.');
releaseCoverage();
await Promise.all(pending);

let failedCalls = 0;
const failOpen = createHarness(async()=>{
  failedCalls += 1;
  return { ok:false, status:503, json:async()=>({error:'sportmonks_not_configured'}) };
});
assert.equal(await failOpen.loadFootballCoverage(), null, 'Coverage 5xx sonucu fail-open olmalı.');
assert.equal(failOpen.footballCoverageState('la-liga'), null, '5xx ligleri yanlışlıkla kapsam dışı işaretlememeli.');
assert.equal(failOpen.footballCoverageUnavailable('la-liga'), false, '5xx normal lig akışını engellememeli.');
assert.equal(failedCalls, 1);
assert.equal(await failOpen.loadFootballCoverage(), null, 'Kısa hata backoff süresinde fail-open sürmeli.');
assert.equal(failedCalls, 1, '5xx sonrası renderlar backoff süresinde endpointi tekrar çağırmamalı.');

let dataLoads=0, renders=0, selectionCoverageCalls=0;
const selectionContext={fetch:async()=>{selectionCoverageCalls+=1;return {ok:true,json:async()=>({selected:[{league:'la-liga',available:false}]})};},Map,Date,Error,console,
  SELECTED_COMPETITIONS:[{key:'super-lig'},{key:'la-liga'}],activeFootballLeague:'super-lig',activeFootballTeam:'Tümü',MATCHES:[1],STANDINGS:[1],ALL_RESULTS:{x:1},WEEKLY_STORIES:{x:1},DATA_ERRORS:{},activeWeek:1,
  competitionLabelBySlug:key=>key,renderAll:()=>{renders+=1;},loadAllData:async()=>{dataLoads+=1;selectionContext.MATCHES=[];},getAvailableWeeks:()=>[],loadLiveFeed:()=>{}};
vm.createContext(selectionContext);
vm.runInContext(`${dataSource.slice(start,end)}\n${functionSource(liveSource,'loadFootballLeagueSelection')}\nthis.run=loadFootballLeagueSelection;`,selectionContext);
assert.equal(await selectionContext.run('la-liga'),true,'Lig verisi kapsam yardımcı kontrolünü beklemeden çizilmeli.');
assert.equal(dataLoads,1,'Lig seçimi yalnız görünen ligin veri yüklemesini başlatmalı.');
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(selectionCoverageCalls,0,'Lig seçimi otomatik /coverage isteği üretmemeli.');
assert.equal(selectionContext.DATA_ERRORS.coverage,undefined,'Otomatik coverage olmadığında eski kapsam mesajı uydurulmamalı.');
assert.ok(renders>=1,'Lig seçimi yeni kapsamı render etmeli.');

let routedLeague=null;
const routeContext={activeFootballLeague:'super-lig',mcMatchId:null,closeMatchCenter:()=>{},loadFootballLeagueSelection:key=>{routedLeague=key;},switchMainTab:()=>{},setTransferCenterTab:()=>{},openFootballSection:()=>{}};
vm.createContext(routeContext);
vm.runInContext(`${functionSource(liveSource,'applyParsedLocation')}\nthis.run=applyParsedLocation;`,routeContext);
routeContext.run({type:'football-route',league:'la-liga',section:'home'});
assert.equal(routedLeague,'la-liga','Doğrudan URL ve popstate coverage-aware yükleyiciyi kullanmalı.');

const pickerArea={innerHTML:'',querySelectorAll:()=>[]};
const pickerContext={FOOTBALL_COVERAGE_CACHE:{expiresAt:Date.now()+10000,leagues:new Map([['la-liga',{available:false}]])},Date,
  document:{getElementById:()=>null},SELECTED_COMPETITIONS:[{key:'super-lig',short:'SL',label:'Süper Lig'},{key:'la-liga',short:'LL',label:'La Liga'}],activeFootballLeague:'super-lig',
  applyFootballLeagueTheme:()=>{},competitionLabelBySlug:key=>key,escapeHTML:value=>String(value),footballCoverageUnavailable:key=>key==='la-liga',loadFootballCoverage:async()=>null,renderMatchesLeagueFilters:()=>{},selectFootballLeague:()=>{}};
vm.createContext(pickerContext);
vm.runInContext(`${functionSource(uiSource,'renderFootballLeaguePickerInto')}\nthis.run=renderFootballLeaguePickerInto;`,pickerContext);
pickerContext.run(pickerArea);
assert.match(pickerArea.innerHTML,/is-unavailable/,'Kapsam dışı lig seçicide önceden işaretlenmeli.');
assert.match(pickerArea.innerHTML,/kapsam dışı/,'Seçicide kapsam dışı açıklaması görünmeli.');

console.log('Football coverage istemci testleri başarılı.');
