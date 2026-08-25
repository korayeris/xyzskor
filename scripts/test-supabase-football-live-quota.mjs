import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { transform } from 'esbuild';

const sourcePath = new URL('../supabase/functions/football-live/index.ts', import.meta.url);
const rawSource = await readFile(sourcePath, 'utf8');
const testableSource = rawSource.replace(
  /^import\s+\{\s*createClient\s*\}\s+from\s+"npm:@supabase\/supabase-js@2\.112\.4";\s*/,
  'const createClient = globalThis.__createClient;\n',
);
const compiled = await transform(testableSource, { loader:'ts', format:'iife', target:'es2022' });

const env = new Map([
  ['FOOTBALL_DATA_PROVIDER', 'sportmonks'],
  ['SPORTMONKS_API_TOKEN', 'test-sportmonks-secret-token'],
  ['SPORTMONKS_LEAGUE_IDS', '600,8,564,82,384'],
  ['SUPABASE_URL', 'https://supabase.test'],
  ['SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-secret'],
  ['LIVE_ALLOWED_ORIGINS', 'http://127.0.0.1:4173'],
]);

const state = {
  handler:null,
  providerCalls:0,
  providerUrls:[],
  cacheRows:new Map(),
  snapshotRows:[],
  lockAllowed:true,
  lockCalls:[],
  lockDeletes:[],
  cacheWrites:[],
};

function tableBuilder(table) {
  const query = { operation:'select', body:null, filters:[], inFilters:[] };
  const builder = {
    select() { query.operation = 'select'; return builder; },
    update(body) { query.operation = 'update'; query.body = body; return builder; },
    upsert(body) { query.operation = 'upsert'; query.body = body; return builder; },
    delete() { query.operation = 'delete'; return builder; },
    eq(column, value) { query.filters.push([column, String(value)]); return builder; },
    in(column, values) { query.inFilters.push([column, values.map(String)]); return builder; },
    async maybeSingle() {
      if (table !== 'live_feed_cache') return { data:null, error:null };
      const scope = query.filters.find(([column]) => column === 'scope')?.[1];
      return { data:scope ? state.cacheRows.get(scope) || null : null, error:null };
    },
    then(resolve, reject) { return execute().then(resolve, reject); },
  };

  async function execute() {
    if (table === 'live_feed_cache' && query.operation === 'upsert') {
      const row = structuredClone(query.body);
      state.cacheRows.set(String(row.scope), row);
      state.cacheWrites.push(row);
      return { data:null, error:null };
    }
    if (table === 'live_match_snapshots' && query.operation === 'select') {
      let rows = state.snapshotRows.slice();
      for (const [column, value] of query.filters) rows = rows.filter((row) => String(row[column]) === value);
      for (const [column, values] of query.inFilters) rows = rows.filter((row) => values.includes(String(row[column])));
      return { data:structuredClone(rows), error:null };
    }
    if (table === 'sync_locks' && query.operation === 'delete') {
      state.lockDeletes.push(Object.fromEntries(query.filters));
      return { data:null, error:null };
    }
    return { data:null, error:null };
  }

  return builder;
}

function createClient() {
  return {
    from:tableBuilder,
    async rpc(name, body) {
      assert.equal(name, 'try_acquire_sync_lock');
      state.lockCalls.push(structuredClone(body));
      return { data:state.lockAllowed, error:null };
    },
  };
}

function fixture(id, leagueId, homeScore, awayScore) {
  return {
    id,
    league_id:leagueId,
    league:{ id:leagueId, name:`League ${leagueId}` },
    starting_at:'2026-08-24T18:00:00Z',
    state:{ short_name:'LIVE', minute:42 },
    periods:[{ ticking:true, minutes:42, time_added:1 }],
    participants:[
      { id:`${id}-h`, name:`Home ${id}`, image_path:null, meta:{ location:'home' } },
      { id:`${id}-a`, name:`Away ${id}`, image_path:null, meta:{ location:'away' } },
    ],
    scores:[
      { participant_id:`${id}-h`, description:'CURRENT', score:{ goals:homeScore } },
      { participant_id:`${id}-a`, description:'CURRENT', score:{ goals:awayScore } },
    ],
  };
}

const providerPayload = {
  data:[
    fixture(6001, 600, 1, 0),
    fixture(8001, 8, 2, 1),
    fixture(5641, 564, 0, 0),
    fixture(8201, 82, 3, 2),
    fixture(3841, 384, 1, 1),
    fixture(2001, 2, 9, 9), // aktif bes lig disi: asla cikisa sizmamali
  ],
};

const context = vm.createContext({
  __createClient:createClient,
  Deno:{
    env:{ get:(name) => env.get(name) },
    serve:(handler) => { state.handler = handler; },
  },
  fetch:async (url) => {
    const parsed = new URL(String(url));
    if (parsed.hostname !== 'api.sportmonks.com') throw new Error(`unexpected fetch ${parsed.hostname}`);
    state.providerCalls += 1;
    state.providerUrls.push(parsed.toString());
    await new Promise((resolve) => setTimeout(resolve, 25));
    return new Response(JSON.stringify(providerPayload), { status:200, headers:{ 'Content-Type':'application/json' } });
  },
  Request,
  Response,
  Headers,
  URL,
  AbortController,
  setTimeout,
  clearTimeout,
  structuredClone,
  crypto:globalThis.crypto,
  console,
});
new vm.Script(compiled.code, { filename:'football-live.edge.test.js' }).runInContext(context);
assert.equal(typeof state.handler, 'function', 'Deno.serve handler kaydedilmeli');

async function invoke(league) {
  const request = new Request('https://edge.test/functions/v1/football-live', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ scope:'selected-leagues', league }),
  });
  const response = await state.handler(request);
  return { response, payload:await response.json() };
}

const leagueKeys = ['all', 'super-lig', 'premier-league', 'la-liga', 'bundesliga', 'serie-a'];
const parallel = await Promise.all(leagueKeys.map(invoke));
assert.equal(state.providerCalls, 1, 'all + 5 paralel fallback tam bir Sportmonks inplay istegi yapmali');
assert.ok(parallel.every(({ response }) => response.status === 200), 'tum route yanitlari basarili olmali');

const canonicalKeys = ['bundesliga', 'la-liga', 'premier-league', 'serie-a', 'super-lig'];
const allMatches = parallel[0].payload.matches;
assert.deepEqual(allMatches.map((match) => match.leagueKey).sort(), canonicalKeys, 'all cevabi bes gercek leagueKey tasimali');
assert.ok(allMatches.every((match) => match.leagueKey !== 'all'), 'leagueKey=all uretilmemeli');
assert.ok(allMatches.every((match) => String(match.providerLeagueId) !== '2'), 'allowlist disi provider league_id cikisa sizmamali');
parallel.slice(1).forEach(({ payload }, index) => {
  assert.equal(payload.matches.length, 1, `${leagueKeys[index + 1]} yalniz kendi macini dondurmeli`);
  assert.equal(payload.matches[0].leagueKey, leagueKeys[index + 1], `${leagueKeys[index + 1]} route filtresi strict olmali`);
});

assert.equal(state.lockCalls.length, 1, 'provider-global lease yalniz bir kez alinmali');
assert.equal(state.lockCalls[0].p_key, 'live:provider-inplay', 'lock anahtari Worker ile ayni olmali');
assert.equal(state.lockCalls[0].p_ttl_seconds, 15, 'lease, 12 saniyelik provider timeoutundan uzun olmali');
assert.equal(state.lockDeletes.length, 1, 'lease basarili istek sonunda bir kez birakilmali');
assert.equal(state.lockDeletes[0].lock_key, 'live:provider-inplay', 'yalniz global live lock silinmeli');
assert.equal(state.lockDeletes[0].holder, state.lockCalls[0].p_holder, 'lease yalniz kendi holder degeriyle silinmeli');
assert.equal(state.cacheWrites.length, 1, 'ortak provider sonucu tek cache satirina bir kez yazilmali');
assert.equal(state.cacheWrites[0].scope, 'worker:football-live:inplay:v1', 'cache scope Worker ile ayni olmali');
assert.deepEqual(state.cacheWrites[0].payload.matches.map((match) => match.leagueKey).sort(), canonicalKeys, 'cache gercek lig anahtarlarini korumali');

const cachedSerieA = await invoke('serie-a');
assert.equal(cachedSerieA.response.status, 200);
assert.equal(cachedSerieA.payload.matches[0].leagueKey, 'serie-a');
assert.equal(state.providerCalls, 1, 'fresh ortak cache sonraki route isteginde provider cagirmamali');

const serializedResponses = JSON.stringify(parallel.map(({ payload }) => payload));
assert.ok(!serializedResponses.includes(env.get('SPORTMONKS_API_TOKEN')), 'Sportmonks token yanita sizmamali');
assert.ok(!serializedResponses.includes(env.get('SUPABASE_SERVICE_ROLE_KEY')), 'service role key yanita sizmamali');

// Worker ayni locku tutarken ve cache/snapshot henuz yokken fallback ikinci
// upstream'i acmamalidir; durum acikca sync_in_progress olmalidir.
state.cacheRows.clear();
state.snapshotRows = [];
state.lockAllowed = false;
state.providerCalls = 0;
state.lockCalls.length = 0;
const locked = await invoke('super-lig');
assert.equal(locked.response.status, 503, 'lock var + verified veri yok -> 503');
assert.equal(locked.payload.reason, 'sync_in_progress', 'lock durumu no_live_matches diye maskelenmemeli');
assert.deepEqual(locked.payload.matches, [], 'bilinmeyen durum sahte mac verisi uretmemeli');
assert.equal(state.providerCalls, 0, 'Worker locku varken Edge fallback provider cagirmamali');

const expiredShared = structuredClone(state.cacheWrites[0]);
expiredShared.fetched_at = new Date(Date.now() - 60_000).toISOString();
expiredShared.expires_at = new Date(Date.now() - 55_000).toISOString();
state.cacheRows.set(expiredShared.scope, expiredShared);
const tooOld = await invoke('super-lig');
assert.equal(tooOld.response.status, 503, '45sn penceresini asan ortak cache canli skor diye sunulmamali');
assert.equal(tooOld.payload.reason, 'sync_in_progress');
assert.equal(state.providerCalls, 0, 'eski cache de Worker lockunu bypass edip provider cagirmamali');
state.cacheRows.clear();

// Kalici, provider league_id ile dogrulanabilir snapshot varsa lock sirasinda
// yalniz istenen lig icin stale fallback sunulabilir.
state.snapshotRows = [{
  league_key:'premier-league',
  fetched_at:new Date(Date.now() - 3000).toISOString(),
  payload:providerPayload.data.length ? {
    ...allMatches.find((match) => match.leagueKey === 'premier-league'),
  } : null,
}];
const snapshot = await invoke('premier-league');
assert.equal(snapshot.response.status, 200, 'verified snapshot lock sirasinda sunulmali');
assert.equal(snapshot.payload.stale, true, 'snapshot stale olarak etiketlenmeli');
assert.equal(snapshot.payload.reason, 'sync_in_progress');
assert.equal(snapshot.payload.matches.length, 1);
assert.equal(snapshot.payload.matches[0].leagueKey, 'premier-league');
assert.equal(state.providerCalls, 0, 'snapshot fallback da provider cagirmamali');

console.log('Supabase football-live quota/isolation contract passed (all + 5 => 1 upstream).');
