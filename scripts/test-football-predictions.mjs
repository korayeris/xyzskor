import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const calls=[];
const fixture={
  id:29999123, season_id:28083, round_id:1, starting_at:'2026-08-29 18:00:00',
  participants:[
    {id:9,name:'Manchester City',image_path:'https://cdn.sportmonks.com/city.png',meta:{location:'home'}},
    {id:19,name:'Arsenal',image_path:'https://cdn.sportmonks.com/arsenal.png',meta:{location:'away'}},
  ],
  state:{short_name:'NS'}, league:{id:8,name:'Premier League'}, venue:{name:'Etihad Stadium'},
  predictions:[{type_id:237,predictions:{home:44.2,draw:25.1,away:30.7}}],
};

globalThis.fetch=async (input, init={})=>{
  const url=String(input?.url || input); calls.push({url,init});
  if(url.includes('/auth/v1/user')) return Response.json({id:'11111111-1111-4111-8111-111111111111'});
  if(url.includes('api.sportmonks.com')) {
    const parsed=new URL(url), include=parsed.searchParams.get('include') || '';
    assert.ok(!include.includes('xGFixture'), 'xG temel veya Predictions isteğine karışmamalı.');
    if(include === 'predictions') return Response.json({data:{...fixture,participants:undefined,predictions:fixture.predictions}});
    return Response.json({data:fixture});
  }
  if(url.includes('/rest/v1/matches')) return Response.json([{id:'sportmonks:29999123'}]);
  if(url.includes('/rest/v1/predictions')) {
    if((init.method || 'GET') === 'POST') return Response.json([{pick:'1',score_home:2,score_away:1,submitted_at:'2026-08-19T00:00:00Z'}]);
    return Response.json([]);
  }
  throw new Error(`Unexpected URL: ${url}`);
};

const env={
  SPORTMONKS_API_TOKEN:'sportmonks-test',
  SUPABASE_URL:'https://supabase.test', SUPABASE_ANON_KEY:'anon', SUPABASE_SERVICE_ROLE_KEY:'service',
};
const context={waitUntil(){}};
const matchday=await worker.fetch(new Request('https://xyz.test/api/football/matchday?fixture=29999123'),env,context);
assert.equal(matchday.status,200);
const matchdayPayload=await matchday.json();
assert.equal(matchdayPayload.degraded,false,'Kapalı xG temel maç kapsamını düşürmemeli.');
assert.equal(matchdayPayload.details.predictions.length,1,'Predictions ayrı çağrıdan maç merkezine bağlanmalı.');
assert.equal(matchdayPayload.details.predictions[0].predictions.home,44.2);

const saved=await worker.fetch(new Request('https://xyz.test/api/football/prediction',{
  method:'POST', headers:{Authorization:'Bearer user-token','Content-Type':'application/json'},
  body:JSON.stringify({fixture_id:'29999123',pick:'1',score_home:2,score_away:1}),
}),env,context);
assert.equal(saved.status,200);
const savedPayload=await saved.json();
assert.equal(savedPayload.prediction.pick,'1');
const matchWrite=calls.find((call)=>call.url.includes('/rest/v1/matches') && call.init.method === 'POST');
const predictionWrite=calls.find((call)=>call.url.includes('/rest/v1/predictions') && call.init.method === 'POST');
assert.ok(matchWrite,'Doğrulanmış sağlayıcı fikstürü matches tablosuna bağlanmalı.');
assert.ok(predictionWrite,'Kullanıcı seçimi mevcut predictions tablosuna yazılmalı.');
assert.equal(JSON.parse(predictionWrite.init.body).user_id,'11111111-1111-4111-8111-111111111111');

console.log('Football Predictions integration checks passed.');
