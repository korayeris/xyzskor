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

// Sites D1 arşivi Supabase service-role olmadan da bitmiş maçın zengin
// ayrıntılarını kalıcı tutar ve sonraki açılışta sağlayıcıya gitmeden sunar.
class FakeArchiveDb {
  constructor() { this.archives = new Map(); }
  prepare(sql) {
    const db = this;
    return {
      bind(...values) {
        return {
          async first() {
            if (/FROM football_match_archives/i.test(sql)) return db.archives.get(String(values[0])) || null;
            return null;
          },
          async all() { return { results:[] }; },
          async run() {
            if (/INSERT INTO football_match_archives/i.test(sql)) {
              db.archives.set(String(values[0]), {
                fixture_id:String(values[0]), league_key:values[1], kickoff_utc:values[2], status:values[3],
                payload_json:values[4], lineups_count:values[5], events_count:values[6], statistics_count:values[7],
                completeness_score:values[8], is_final:values[9], provider_updated_at:values[10],
                last_synced_at:values[11], finalized_at:values[12],
              });
            }
            return { success:true };
          },
        };
      },
    };
  }
}

{
  const db = new FakeArchiveDb();
  const archiveEnv = {
    SPORTMONKS_API_TOKEN:'sportmonks-test',
    DB:db,
    ASSETS:{ fetch:async () => new Response('not-used') },
  };
  const finalFixture = {
    ...providerFixture,
    state:{short_name:'FT'},
    starting_at:new Date(now - 3 * 3600000).toISOString(),
    scores:[{participant_id:88,description:'CURRENT',score:{goals:2}},{participant_id:99,description:'CURRENT',score:{goals:1}}],
    lineups:Array.from({length:22},(_,index)=>({participant_id:index<11?88:99,type_id:11,formation_field:(index%11)+1,jersey_number:index+1,player:{id:index+1,display_name:`Oyuncu ${index+1}`}})),
    events:[{id:71,participant_id:88,player_id:7,player_name:'Golcü',minute:52,type:{name:'Goal'}},{id:72,participant_id:99,player_id:19,player_name:'Giren',related_player_name:'Çıkan',minute:68,type:{name:'Substitution'}}],
    statistics:[{participant_id:88,type:{name:'Shots Total'},data:{value:12}},{participant_id:99,type:{name:'Shots Total'},data:{value:7}}],
    formations:[{participant_id:88,formation:'4-2-3-1'},{participant_id:99,formation:'4-3-3'}],
    periods:[{type_id:1,minutes:45},{type_id:2,minutes:45}],
  };
  let providerCalls = 0;
  scenario = (url) => {
    if (url.hostname === 'api.sportmonks.com') { providerCalls += 1; return json({data:finalFixture}); }
    return null;
  };
  const first = await worker.fetch(new Request(`https://archive.test/api/football/matchday?fixture=${fixtureId}`), archiveEnv, ctx);
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  assert.equal(firstBody.details.lineups.length,22);
  const stored = db.archives.get(fixtureId);
  assert.equal(stored.is_final,1,'Biten maç D1 arşivinde final olarak kilitlenmeli.');
  assert.equal(stored.events_count,2,'Gol/kart/değişiklik olayları arşivlenmeli.');
  assert.equal(stored.statistics_count,2,'Maç istatistikleri arşivlenmeli.');

  scenario = (url) => {
    if (url.hostname === 'api.sportmonks.com') { providerCalls += 1; return json({message:'should not be called'},500); }
    return null;
  };
  const second = await worker.fetch(new Request(`https://archive.test/api/football/matchday?fixture=${fixtureId}`), archiveEnv, ctx);
  const secondBody = await second.json();
  assert.equal(second.status,200);
  assert.equal(secondBody.archive,true,'Geçmiş maç kalıcı arşivden sunulmalı.');
  assert.equal(secondBody.archiveFinal,true);
  assert.equal(secondBody.details.lineups.length,22);
  assert.equal(secondBody.details.events.length,2);
  assert.equal(providerCalls,1,'Final arşiv varken sağlayıcı tekrar çağrılmamalı.');
}

console.log('Durable D1 match archive checks passed.');
