import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const ENV = {
  SPORTMONKS_API_TOKEN:'sportmonks-test',
  SUPABASE_URL:'https://supabase.test',
  SUPABASE_ANON_KEY:'anon',
  SUPABASE_SERVICE_ROLE_KEY:'service',
  ASSETS:{ fetch:async () => new Response('not-used') },
};
const ctx = { waitUntil(promise) { promise?.catch?.(() => {}); } };
const now = Date.now();
const fixtureId = '555001';
const kickoff = new Date(now + 30 * 60000).toISOString();
const storedBody = {
  source:'Sportmonks Football API', provider:'sportmonks', league:'super-lig', updatedAt:new Date(now - 5000).toISOString(), degraded:false,
  fixture:{ id:`sportmonks:${fixtureId}`, provider_fixture_id:fixtureId, provider_league_id:'600', ev:'Genel Ev', konuk:'Genel Konuk', kickoff, status:'scheduled', score:{home:null,away:null} },
  details:{ lineups:[{team:'Genel Ev',player_name:'Oyuncu A',type_id:11}], events:[], statistics:[], formations:[] },
};
const snapshotRow = (ageMs = 5000) => ({
  fixture_id:`sportmonks:${fixtureId}`,
  fetched_at:new Date(now - ageMs).toISOString(),
  provider_updated_at:new Date(now - ageMs).toISOString(),
  payload:{ id:`sportmonks:${fixtureId}`, matchday:storedBody },
});
const providerFixture = {
  id:Number(fixtureId), league_id:600, season_id:28203, starting_at:kickoff,
  league:{id:600,name:'Super Lig'}, state:{short_name:'NS'},
  participants:[
    {id:88,name:'Genel Ev',image_path:'https://cdn.test/home.png',meta:{location:'home'}},
    {id:99,name:'Genel Konuk',image_path:'https://cdn.test/away.png',meta:{location:'away'}},
  ],
  scores:[],
  lineups:[{participant_id:88,type_id:11,jersey_number:1,player:{id:1,display_name:'Oyuncu A'}}],
  statistics:[], events:[], formations:[{location:'home',formation:'4-2-3-1'},{location:'away',formation:'4-3-3'}], periods:[],
};

let scenario = null;
let calls = [];
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input?.url || input));
  calls.push({url:url.toString(),init});
  const response = await scenario(url, init);
  if (response) return response;
  throw new Error(`UNMOCKED ${url}`);
};
const json = (body, status = 200, headers = {}) => Response.json(body, {status,headers});
async function requestWith(handler) {
  calls = [];
  scenario = handler;
  const response = await worker.fetch(new Request(`https://xyz.test/api/football/matchday?fixture=${fixtureId}`), ENV, ctx);
  return { response, body:await response.json(), calls };
}
const baseSupabase = (url, init, snapshot) => {
  if (url.pathname.includes('/rest/v1/provider_sync_runs')) return json([]);
  if (url.pathname.includes('/rest/v1/rpc/try_acquire_sync_lock')) return json(true);
  if (url.pathname.includes('/rest/v1/live_match_snapshots') && (init.method || 'GET') === 'GET') return json(snapshot ? [snapshot] : []);
  if (url.pathname.includes('/rest/v1/live_match_snapshots') && init.method === 'POST') return json([]);
  return null;
};

// Herhangi bir fixture için taze kalıcı snapshot sağlayıcıya gitmeden sunulur.
{
  const result = await requestWith((url, init) => baseSupabase(url, init, snapshotRow()));
  assert.equal(result.response.status, 200);
  assert.equal(result.body.snapshot, true);
  assert.equal(result.body.stale, false);
  assert.equal(result.body.details.lineups[0].player_name, 'Oyuncu A');
  assert.equal(result.calls.some((call) => call.url.includes('api.sportmonks.com')), false);
}

// Bayat snapshot + 429: doğrulanmış veri kaybolmaz ve sebep açıkça döner.
{
  const result = await requestWith((url, init) => {
    const base = baseSupabase(url, init, snapshotRow(10 * 60000));
    if (base) return base;
    if (url.hostname === 'api.sportmonks.com') return json({message:'rate limit'}, 429, {'retry-after':'60'});
    return null;
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.stale, true);
  assert.equal(result.body.reason, 'provider_rate_limited');
  assert.equal(result.body.details.lineups.length, 1);
}

// Soğuk fixture başarıyla çekilir ve aynı yanıtta kalıcı snapshot'a yazılır.
{
  const result = await requestWith((url, init) => {
    const base = baseSupabase(url, init, null);
    if (base) return base;
    if (url.hostname === 'api.sportmonks.com') return json({data:providerFixture});
    return null;
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.fixture.provider_league_id, '600');
  assert.equal(result.body.details.lineups.length, 1);
  const write = result.calls.find((call) => call.url.includes('/rest/v1/live_match_snapshots?on_conflict=fixture_id') && call.init.method === 'POST');
  assert.ok(write, 'Genel fixture ayrıntısı kalıcı snapshot olarak yazılmalı.');
  assert.equal(String(JSON.parse(write.init.body).payload.matchday.fixture.id).replace(/^sportmonks:/, ''), fixtureId);
}

// Başka worker aynı fixture'ı güncelliyorsa ikinci upstream çağrısı yapılmaz.
{
  const result = await requestWith((url, init) => {
    if (url.pathname.includes('/rest/v1/provider_sync_runs')) return json([]);
    if (url.pathname.includes('/rest/v1/rpc/try_acquire_sync_lock')) return json(false);
    if (url.pathname.includes('/rest/v1/live_match_snapshots')) return json([snapshotRow(10 * 60000)]);
    return null;
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.reason, 'sync_in_progress');
  assert.equal(result.calls.some((call) => call.url.includes('api.sportmonks.com')), false);
}

console.log('Generic matchday snapshot checks passed.');
