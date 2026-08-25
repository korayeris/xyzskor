import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../worker/index.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const leagueIds={'super-lig':600,'premier-league':8,'la-liga':564,bundesliga:82,'serie-a':384};
const seasonIds={'super-lig':28203,'premier-league':28204,'la-liga':28205,bundesliga:28206,'serie-a':28207};
const providerCalls=new Map();
let failureMode=null;
const count=(key)=>providerCalls.set(key,(providerCalls.get(key)||0)+1);
const response=(payload,status=200,type='application/json')=>new Response(type.includes('json')?JSON.stringify(payload):String(payload),{status,headers:{'Content-Type':type}});
const positions=['Goalkeeper','Defender','Defender','Defender','Defender','Midfielder','Midfielder','Midfielder','Forward','Forward','Forward'];

global.fetch=async(value)=>{
  const url=new URL(String(value)); count(url.pathname);
  await new Promise(resolveDelay=>setTimeout(resolveDelay,4));
  const league=Object.keys(leagueIds).find(key=>url.pathname===`/v3/football/leagues/${leagueIds[key]}`);
  if(league) return response({data:{id:leagueIds[league],name:league,currentseason:{id:seasonIds[league]}}});
  const season=Object.keys(seasonIds).find(key=>url.pathname.endsWith(`/${seasonIds[key]}`));
  if(url.pathname.includes('/standings/seasons/')) return response({data:[]});
  if(url.pathname.includes('/schedules/seasons/')) return response({data:[{rounds:[{name:'9',fixtures:[{id:leagueIds[season]*100+9,league_id:leagueIds[season],season_id:seasonIds[season],round_id:9,starting_at:'2026-08-23 18:00:00',result_info:'finished',state:{short_name:'FT'},participants:[{id:1,name:'Ev',meta:{location:'home'}},{id:2,name:'Konuk',meta:{location:'away'}}],scores:[{participant_id:1,description:'CURRENT',score:{goals:2}},{participant_id:2,description:'CURRENT',score:{goals:0}}]}]}]}]});
  if(url.pathname.includes('/topscorers/seasons/')){
    if(failureMode==='429') return response({message:'rate limited'},429);
    if(failureMode==='500') return response({message:'provider down'},500);
    if(failureMode==='html') return response('<html>gateway error</html>',200,'text/html');
    if(failureMode==='timeout') throw new DOMException('timed out','AbortError');
    return response({data:[{id:1,season_id:seasonIds[season],player_id:101,participant_id:1,position:1,total:5,player:{display_name:'Lider'},participant:{name:'Ev'},type:{name:'Goals',code:'goals',developer_name:'GOALS'}}]});
  }
  if(url.pathname.includes('/fixtures/')) return response({data:{id:Number(url.pathname.split('/').pop()),participants:[{id:1,name:'Ev',meta:{location:'home'}},{id:2,name:'Konuk',meta:{location:'away'}}],scores:[{participant_id:1,description:'CURRENT',score:{goals:2}},{participant_id:2,description:'CURRENT',score:{goals:0}}],lineups:positions.map((position,index)=>({player_id:String(100+index),team_id:1,type_id:11,player_name:`Oyuncu ${index}`,detailedposition:{name:position},minutes_played:90})),events:[]}});
  throw new Error(`unmocked ${url}`);
};

const env={SPORTMONKS_API_TOKEN:'load-test-token',ASSETS:{fetch:async()=>new Response('')}};
const context={waitUntil(){}};
async function request(path){
  const started=performance.now();
  const result=await worker.fetch(new Request(`http://local${path}`),env,context);
  return {status:result.status,body:await result.json(),ms:performance.now()-started};
}
const percentile=(values,p)=>{
  const sorted=[...values].sort((a,b)=>a-b);
  return Math.round(sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)]*100)/100;
};
const summarize=(name,rows,before)=>({name,clients:rows.length,p50Ms:percentile(rows.map(row=>row.ms),.5),p95Ms:percentile(rows.map(row=>row.ms),.95),p99Ms:percentile(rows.map(row=>row.ms),.99),success:rows.filter(row=>row.status===200).length,providerCalls:[...providerCalls.entries()].filter(([key])=>key.startsWith('/v3/')).reduce((sum,[key,value])=>sum+value-(before.get(key)||0),0),topscorerCalls:[...providerCalls.entries()].filter(([key])=>key.includes('/topscorers/')).reduce((sum,[key,value])=>sum+value-(before.get(key)||0),0)});

const scenarios=[];
let before=new Map(providerCalls);
const sameLeague=await Promise.all(Array.from({length:100},()=>request('/api/football/leaders?league=super-lig')));
assert.ok(sameLeague.every(row=>row.status===200));
assert.equal((providerCalls.get('/v3/football/topscorers/seasons/28203')||0)-(before.get('/v3/football/topscorers/seasons/28203')||0),1);
scenarios.push(summarize('100-same-league-leaders',sameLeague,before));

before=new Map(providerCalls);
const leagueKeys=Object.keys(leagueIds);
const fiveLeagues=await Promise.all(Array.from({length:100},(_,index)=>request(`/api/football/leaders?league=${leagueKeys[index%5]}`)));
assert.ok(fiveLeagues.every(row=>row.status===200));
assert.equal(leagueKeys.reduce((sum,key)=>sum+(providerCalls.get(`/v3/football/topscorers/seasons/${seasonIds[key]}`)||0)-(before.get(`/v3/football/topscorers/seasons/${seasonIds[key]}`)||0),0),5);
scenarios.push(summarize('100-users-five-leagues',fiveLeagues,before));

before=new Map(providerCalls);
const weekly=await Promise.all(Array.from({length:50},()=>request('/api/football/weekly-awards?league=super-lig')));
assert.ok(weekly.every(row=>row.status===200));
assert.equal((providerCalls.get('/v3/football/fixtures/60009')||0)-(before.get('/v3/football/fixtures/60009')||0),1);
scenarios.push(summarize('50-same-round-weekly-job',weekly,before));

const failures={};
for(const mode of ['429','500','html','timeout']){
  failureMode=mode;
  const result=await request('/api/football/leaders?league=super-lig');
  assert.equal(result.status,502);
  assert.equal(result.body.cacheStatus,undefined,'provider failure must not be labelled verified-empty');
  failures[mode]={status:result.status,error:result.body.error};
}
failureMode=null;
const invalid=await request('/api/football/leaders?league=super-lig%27%20or%201%3D1');
assert.equal(invalid.status,400);
assert.ok(!JSON.stringify([...providerCalls.keys()]).includes('load-test-token'));

const report={generatedAt:new Date().toISOString(),environment:'local-stub-no-production-quota',scenarios,failures,providerCalls:Object.fromEntries(providerCalls),cache:{sameKeyCoalesced:99,fiveLeagueCoalesced:95,weeklyCoalesced:49},security:{invalidLeagueRejected:true,secretInReport:false},database:{parallelPublishedRows:'requires qa:db; covered by weekly_football_concurrency_test.sh'}};
const output=resolve(root,'reports/performance/weekly-football-load-report.json');
await mkdir(dirname(output),{recursive:true});
await writeFile(output,`${JSON.stringify(report,null,2)}\n`,'utf8');
console.log(JSON.stringify(report,null,2));
console.log(`Weekly football load test: PASS (${output})`);
