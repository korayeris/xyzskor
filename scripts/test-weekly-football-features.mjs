import assert from 'node:assert/strict';
import worker, { calculateXYZPerformanceScore, chooseWeeklyXI, selectWeeklyRound } from '../worker/index.js';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const env={ASSETS:{fetch:async()=>new Response('')},SPORTMONKS_API_TOKEN:'test-token'};
const context={waitUntil() {}};
let calls=[];
let providerFailureMode=null;
const sharedRows=new Map();

const participants=[{id:10,name:'Ev',image_path:'home.png',meta:{location:'home'}},{id:20,name:'Konuk',image_path:'away.png',meta:{location:'away'}}];
const schedule={data:[{rounds:[{name:'3',fixtures:[{id:900,league_id:600,season_id:28203,round_id:3,starting_at:'2026-08-22 18:00:00',result_info:'finished',state:{short_name:'FT'},participants,scores:[{participant_id:10,description:'CURRENT',score:{goals:2}},{participant_id:20,description:'CURRENT',score:{goals:0}}]}]}]}]};
const positions=['Goalkeeper','Defender','Defender','Defender','Defender','Midfielder','Midfielder','Midfielder','Forward','Forward','Forward'];
const lineups=positions.map((position,index)=>({id:1000+index,player_id:String(100+index),team_id:10,type_id:11,player_name:`Oyuncu ${index}`,detailedposition:{name:position},player:{id:String(100+index),display_name:`Oyuncu ${index}`,image_path:`p${index}.png`},minutes_played:90}));
const fixture={data:{id:900,league_id:600,season_id:28203,round_id:3,starting_at:'2026-08-22 18:00:00',result_info:'finished',state:{short_name:'FT'},participants,scores:schedule.data[0].rounds[0].fixtures[0].scores,lineups,events:[{id:1,player_id:'108',participant_id:10,type:{name:'Goal'}},{id:1,player_id:'108',participant_id:10,type:{name:'Goal'}},{id:2,player_id:'109',related_player_id:'108',participant_id:10,type:{name:'Goal'}},{id:3,player_id:'108',participant_id:10,type:{name:'Goal'}},{id:4,player_id:'108',participant_id:10,type:{name:'Goal'}},{id:5,player_id:'107',participant_id:10,type:{name:'Yellow Card'}},{id:6,player_id:'106',participant_id:10,minute:70,type:{name:'Yellow Card'}},{id:7,player_id:'106',participant_id:10,minute:70,type:{name:'Second Yellow Red Card'}},{id:8,player_id:'106',participant_id:10,minute:70,type:{name:'Red Card'}}]}};
const topRows=[
  {id:1,season_id:28203,player_id:108,participant_id:10,type_id:84,position:1,total:4,player:{display_name:'Golcü',image_path:'g.png'},participant:{name:'Ev',image_path:'home.png'},type:{name:'Goals',code:'goals',developer_name:'GOALS'}},
  {id:2,season_id:28203,player_id:109,participant_id:10,type_id:85,position:1,total:3,player:{display_name:'Asistçi'},participant:{name:'Ev'},type:{name:'Assists',code:'assists',developer_name:'ASSISTS'}},
  {id:3,season_id:28203,player_id:110,participant_id:20,type_id:83,position:1,total:2,player:{display_name:'Kartlı'},participant:{name:'Konuk'},type:{name:'Redcards',code:'redcards',developer_name:'REDCARDS'}},
  {id:4,season_id:28203,player_id:111,participant_id:20,type_id:82,position:1,total:5,player:{display_name:'Sarı'},participant:{name:'Konuk'},type:{name:'Yellowcards',code:'yellowcards',developer_name:'YELLOWCARDS'}},
  {id:5,season_id:28203,player_id:108,participant_id:10,type_id:84,position:2,total:6,player:{display_name:'Golcü'},participant:{name:'Ev'},type:{name:'Goals',code:'goals',developer_name:'GOALS'}},
  {id:6,season_id:28203,player_id:112,participant_id:20,type_id:84,position:3,total:1,type:{name:'Goals',code:'goals',developer_name:'GOALS'}},
];

global.fetch=async(url,init={})=>{
  const u=new URL(String(url)); calls.push(u.pathname+u.search);
  if(u.hostname==='db.test'){
    const method=String(init.method||'GET').toUpperCase();
    if(u.pathname.endsWith('/rpc/try_acquire_sync_lock')) return json(true);
    if(u.pathname.endsWith('/live_feed_cache')&&method==='GET'){
      const scope=u.searchParams.get('scope')?.replace(/^eq\./,'');
      return json(sharedRows.has(scope)?[sharedRows.get(scope)]:[]);
    }
    if(u.pathname.endsWith('/live_feed_cache')&&method==='POST'){
      const body=JSON.parse(init.body);sharedRows.set(body.scope,body);return json([]);
    }
    if(u.pathname.endsWith('/sync_locks')&&method==='DELETE') return json([]);
    throw new Error(`unmocked supabase ${method} ${u}`);
  }
  if(u.pathname==='/v3/football/leagues/600') return json({data:{id:600,name:'Süper Lig',currentseason:{id:28203}}});
  if(u.pathname==='/v3/football/standings/seasons/28203') return json({data:[]});
  if(u.pathname==='/v3/football/schedules/seasons/28203') return json(schedule);
  if(u.pathname==='/v3/football/topscorers/seasons/28203'){
    if(providerFailureMode==='500') return json({message:'provider down api_token=test-token'},500);
    if(providerFailureMode==='html') return new Response('<html>gateway</html>',{status:200,headers:{'Content-Type':'text/html'}});
    if(providerFailureMode==='timeout') throw new DOMException('timed out','AbortError');
    return json({data:topRows});
  }
  if(u.pathname==='/v3/football/fixtures/900') return json(fixture);
  throw new Error(`unmocked ${u}`);
};

async function get(path){const response=await worker.fetch(new Request(`http://localhost${path}`),env,context);return {response,payload:await response.json()};}

const leaders=await get('/api/football/leaders?league=super-lig');
assert.equal(leaders.response.status,200);
assert.equal(leaders.payload.goals[0].playerName,'Golcü');
assert.equal(leaders.payload.assists[0].total,3);
assert.equal(leaders.payload.yellowCards[0].total,5);
assert.equal(leaders.payload.redCards[0].total,2);
assert.equal(leaders.payload.goals.filter(row=>row.playerId==='108').length,1,'duplicate player metric must be deduplicated');
assert.equal(leaders.payload.goals.find(row=>row.playerId==='108').total,6,'duplicate player metric must keep the strongest verified total');
assert.equal(leaders.payload.goals.find(row=>row.playerId==='112').playerName,'Oyuncu 112','missing player relation must use a safe fallback');
assert.equal(leaders.payload.scopeValidated,true);

calls=[];
const concurrent=await Promise.all(Array.from({length:50},()=>get('/api/football/leaders?league=super-lig')));
assert.ok(concurrent.every(item=>item.response.status===200));
assert.equal(calls.filter(path=>path.startsWith('/v3/football/topscorers/seasons/28203')).length,1,'50 concurrent leader requests must share one provider call');

calls=[];
const weekly=await get('/api/football/weekly-awards?league=super-lig');
assert.equal(weekly.response.status,200);
assert.equal(weekly.payload.algorithmVersion,'v1');
assert.equal(weekly.payload.status,'published');
assert.equal(weekly.payload.teamOfWeek.formation,'4-3-3');
assert.equal(weekly.payload.teamOfWeek.players.length,11);
assert.equal(new Set(weekly.payload.teamOfWeek.players.map(player=>player.playerId)).size,11);
assert.equal(weekly.payload.teamOfWeek.players.filter(player=>player.position==='goalkeeper').length,1);
assert.equal(weekly.payload.star.playerId,'108');
assert.equal(weekly.payload.star.events.goal,3,'duplicate provider event id must be counted once');
assert.equal(weekly.payload.star.score,10,'score must be capped at 10.0');
const yellowPlayer=weekly.payload.playerScores.find(player=>player.playerId==='107');
assert.equal(yellowPlayer.events.yellowCard,1);
assert.equal(yellowPlayer.breakdown.cards,-0.5,'yellow-card penalty must be applied once');
const dismissedPlayer=weekly.payload.playerScores.find(player=>player.playerId==='106');
assert.equal(dismissedPlayer.events.secondYellow,1);
assert.equal(dismissedPlayer.events.redCard,0,'duplicate red representation must be suppressed');
assert.equal(dismissedPlayer.breakdown.cards,-1.5,'second-yellow dismissal must not be double-counted');
for(const player of weekly.payload.playerScores){
  const raw=Object.values(player.breakdown).reduce((sum,value)=>sum+Number(value||0),0);
  assert.equal(player.score,Math.round(Math.max(0,Math.min(10,raw))*10)/10,'score must equal its capped breakdown');
}

const invalid=await get('/api/football/leaders?league=champions-league');
assert.equal(invalid.response.status,400);
for(const endpoint of ['/api/football/leaders?league=super-lig','/api/football/weekly-awards?league=super-lig']){
  const response=await worker.fetch(new Request(`http://localhost${endpoint}`,{method:'POST'}),env,context);
  assert.equal(response.status,405);
}

for(const key of ['football_leaders_enabled','xyz_performance_score_enabled','weekly_star_enabled','team_of_week_enabled']){
  const featureEnv={...env,[key]:'false'};
  const endpoint=key==='football_leaders_enabled'?'/api/football/leaders?league=super-lig':'/api/football/weekly-awards?league=super-lig';
  const response=await worker.fetch(new Request(`http://localhost${endpoint}`),featureEnv,context);
  assert.equal(response.status,404,`${key}=false must fail closed`);
  assert.equal((await response.json()).error,'feature_disabled');
}

const scoreCases=[
  [{position:'Goalkeeper',minutes:90,events:{goal:1,penaltySaved:1},teamResult:'win',cleanSheet:true},10,'goalkeeper'],
  [{position:'Defender',minutes:90,events:{goal:1},teamResult:'draw',cleanSheet:true},10,'defender'],
  [{position:'Midfielder',minutes:60,events:{assist:1},teamResult:'win',cleanSheet:true},8.3,'midfielder'],
  [{position:'Forward',minutes:45,events:{goal:1},teamResult:'loss',cleanSheet:false},7.9,'forward'],
  [{position:'Mystery',minutes:90,events:{redCard:1,ownGoal:1,penaltyMissed:1},teamResult:'loss'},2,'unknown'],
  [{position:'Defender',minutes:0,events:{redCard:5}},0,'defender'],
];
for(const [input,expected,position] of scoreCases){
  const first=calculateXYZPerformanceScore(input),second=calculateXYZPerformanceScore(input);
  assert.equal(first.score,expected);
  assert.equal(first.position,position);
  assert.deepEqual(first,second,'same score input must be deterministic');
}

const pool=(g,d,m,f)=>[
  ...Array.from({length:g},(_,i)=>({playerId:`g${i}`,position:'goalkeeper',score:9-i/10,contributions:0,minutes:90})),
  ...Array.from({length:d},(_,i)=>({playerId:`d${i}`,position:'defender',score:8-i/10,contributions:0,minutes:90})),
  ...Array.from({length:m},(_,i)=>({playerId:`m${i}`,position:'midfielder',score:8-i/10,contributions:0,minutes:90})),
  ...Array.from({length:f},(_,i)=>({playerId:`f${i}`,position:'forward',score:8-i/10,contributions:0,minutes:90})),
];
assert.equal(chooseWeeklyXI(pool(1,4,3,3)).formation,'4-3-3');
assert.equal(chooseWeeklyXI(pool(1,4,4,2)).formation,'4-4-2');
assert.equal(chooseWeeklyXI(pool(1,3,4,3)).formation,'3-4-3');
assert.equal(chooseWeeklyXI(pool(0,5,5,5)),null,'a team without a goalkeeper must not be published');
assert.equal(chooseWeeklyXI(pool(1,2,7,7)),null,'an invalid position pool must not invent players');

assert.equal(selectWeeklyRound([{hafta:4,status:'finished',result:{home:1,away:0}},{hafta:4,status:'scheduled'}]).complete,false);
assert.equal(selectWeeklyRound([{hafta:4,status:'finished',result:{home:1,away:0}},{hafta:4,status:'postponed',result:{home:0,away:0}}]).complete,false);
assert.equal(selectWeeklyRound([{hafta:4,status:'finished',result:{home:1,away:0}},{hafta:4,status:'finished',result:{home:0,away:0}}]).complete,true);

providerFailureMode='500';
const failedWithoutCache=await get('/api/football/leaders?league=super-lig');
assert.equal(failedWithoutCache.response.status,502);
assert.ok(!JSON.stringify(failedWithoutCache.payload).includes('test-token'),'provider error response must not leak secrets');
assert.equal(failedWithoutCache.payload.cacheStatus,undefined,'provider error must not be labelled verified-empty');
providerFailureMode=null;

const sharedEnv={...env,SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'service-role-test'};
const seeded=await worker.fetch(new Request('http://localhost/api/football/leaders?league=super-lig'),sharedEnv,context);
assert.equal(seeded.status,200);
const seededPayload=await seeded.json();
const leaderCache=[...sharedRows.values()].find(row=>row?.payload?.value?.goals);
assert.ok(leaderCache,'leader response must be persisted as the last verified payload');
leaderCache.expires_at=new Date(Date.now()-1000).toISOString();
providerFailureMode='500';
const degraded=await worker.fetch(new Request('http://localhost/api/football/leaders?league=super-lig'),sharedEnv,context);
const degradedPayload=await degraded.json();
assert.equal(degraded.status,200);
assert.equal(degradedPayload.isStale,true);
assert.equal(degradedPayload.degraded,true);
assert.deepEqual(degradedPayload.goals,seededPayload.goals,'provider 500 must preserve the last verified leaders');
providerFailureMode=null;

console.log('Weekly football features: PASS');
