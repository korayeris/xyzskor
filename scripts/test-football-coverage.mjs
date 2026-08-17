import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const dataSource = await readFile(new URL('../assets/js/data.js', import.meta.url), 'utf8');
const start = dataSource.indexOf('const FOOTBALL_COVERAGE_CACHE_MS');
const end = dataSource.indexOf('const LEAGUE_CONTEXT', start);
assert.ok(start >= 0 && end > start, 'Coverage istemci kodu bulunmalı.');

function createHarness(fetchImpl){
  const context = { fetch:fetchImpl, Map, Date, Error, console };
  vm.createContext(context);
  vm.runInContext(`function competitionLabelBySlug(key){ return key; }\n${dataSource.slice(start,end)}\nthis.api={loadFootballCoverage,footballCoverageState,footballCoverageUnavailable};`, context);
  return context.api;
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

let failedCalls = 0;
const failOpen = createHarness(async()=>{
  failedCalls += 1;
  return { ok:false, status:503, json:async()=>({error:'sportmonks_not_configured'}) };
});
assert.equal(await failOpen.loadFootballCoverage(), null, 'Coverage 5xx sonucu fail-open olmalı.');
assert.equal(failOpen.footballCoverageState('la-liga'), null, '5xx ligleri yanlışlıkla kapsam dışı işaretlememeli.');
assert.equal(failOpen.footballCoverageUnavailable('la-liga'), false, '5xx normal lig akışını engellememeli.');
assert.equal(failedCalls, 1);

console.log('Football coverage istemci testleri başarılı.');
