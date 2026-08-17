import worker from '../../worker/index.js';
import { readFile } from 'node:fs/promises';

const env = {
  ASSETS: { fetch: async () => new Response('not used') },
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
};
const ctx = { waitUntil() {} };
const userId = '11111111-1111-4111-8111-111111111111';
const guestId = 'guest-owner';
const now = Date.now();
const sessions = new Map([
  ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', { id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', user_id:userId, guest_session_id:guestId, status:'started', nonce:'nonce-valid', started_at:new Date(now - 10000).toISOString() }],
  ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', { id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', user_id:null, guest_session_id:guestId, status:'started', nonce:'nonce-fake', started_at:new Date(now - 10000).toISOString() }],
  ['cccccccc-cccc-4ccc-8ccc-cccccccccccc', { id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc', user_id:null, guest_session_id:'another-guest', status:'started', nonce:'nonce-foreign', started_at:new Date(now - 10000).toISOString() }],
  ['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', { id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', user_id:null, guest_session_id:guestId, status:'started', nonce:'nonce-terminal', started_at:new Date(now - 10000).toISOString() }],
  ['ffffffff-ffff-4fff-8fff-ffffffffffff', { id:'ffffffff-ffff-4fff-8fff-ffffffffffff', user_id:null, guest_session_id:guestId, status:'started', nonce:'nonce-skew', started_at:new Date(now - 60000).toISOString() }],
  ['99999999-9999-4999-8999-999999999999', { id:'99999999-9999-4999-8999-999999999999', user_id:null, guest_session_id:guestId, status:'started', nonce:'nonce-over', started_at:new Date(now - 10000).toISOString() }],
]);
let rewards = 0;

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers:{ 'Content-Type':'application/json' } });
}

global.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  if (url.pathname === '/auth/v1/user') return response(init.headers?.Authorization === 'Bearer valid-token' ? { id:userId } : {}, init.headers?.Authorization === 'Bearer valid-token' ? 200 : 401);
  if (url.pathname === '/rest/v1/rpc/claim_predict_game_reward') {
    const body = JSON.parse(init.body);
    const session = sessions.get(body.p_session_id);
    if (session.status !== 'started') return response({ claimed:false, blocked:'already_completed', points:0 });
    session.status = 'reward_claimed';
    rewards++;
    return response({ claimed:true, points:50, transaction_id:'tx-1' });
  }
  if (url.pathname === '/rest/v1/predict_game_sessions') {
    const id = url.searchParams.get('id')?.replace('eq.', '');
    if (init.method === 'POST') {
      const created = { id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd', started_at:new Date().toISOString(), ...JSON.parse(init.body) };
      sessions.set(created.id, created);
      return response([created]);
    }
    const session = sessions.get(id);
    const userFilter = url.searchParams.get('user_id')?.replace('eq.', '');
    const guestFilter = url.searchParams.get('guest_session_id')?.replace('eq.', '');
    const statusFilter = url.searchParams.get('status')?.replace('eq.', '');
    const owned = session && (!userFilter || session.user_id === userFilter) && (!guestFilter || session.guest_session_id === guestFilter) && (!statusFilter || session.status === statusFilter);
    if (init.method === 'PATCH') {
      if (!owned) return response([]);
      Object.assign(session, JSON.parse(init.body));
      return response([session]);
    }
    return response(owned ? [session] : []);
  }
  throw new Error(`Unmocked request: ${url}`);
};

async function post(path, body, authenticated = false) {
  const headers = { 'Content-Type':'application/json' };
  if (authenticated) headers.Authorization = 'Bearer valid-token';
  const request = new Request(`http://localhost${path}`, { method:'POST', headers, body:JSON.stringify(body) });
  const res = await worker.fetch(request, env, ctx);
  return { status:res.status, body:await res.json() };
}

function assert(condition, label) {
  if (!condition) throw new Error(`FAIL: ${label}`);
  console.log(`OK: ${label}`);
}

const clientSource = await readFile(new URL('../../assets/js/predict-game.js', import.meta.url), 'utf8');
assert(/elapsedMs:Math\.round\(performance\.now\(\) - game\.sessionStartedAt\)/.test(clientSource), 'istemci olaylari monotonic performance ofseti kullanir');
assert(!/events\.push\([^\n]*Date\.now/.test(clientSource), 'istemci olaylari duvar saatine bagli degildir');

const created = await post('/api/predict-game/session', { guestSessionId:guestId });
assert(created.status === 200 && /^[0-9a-f-]{36}$/i.test(created.body.session.nonce), 'session baslatma server nonce dondurur');

const fake = await post('/api/predict-game/complete', {
  sessionId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', guestSessionId:guestId,
  goals:10, misses:0, finalState:'GAME_SUCCESS', nonce:'nonce-fake', events:[], elapsedMs:6000,
});
assert(fake.status === 400 && rewards === 0 && sessions.get('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb').status === 'invalid', 'duz POST odul alamaz ve session invalid kapanir');

const events = Array.from({ length:10 }, (_, index) => ({ type:'goal', elapsedMs:(index + 1) * 500 }));
const valid = await post('/api/predict-game/complete', {
  sessionId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', guestSessionId:guestId,
  goals:10, misses:0, finalState:'GAME_SUCCESS', nonce:'nonce-valid', events, elapsedMs:6000,
}, true);
assert(valid.status === 200 && valid.body.reward.claimed === true && rewards === 1, 'gecerli akista odul verilir');

const duplicate = await post('/api/predict-game/complete', {
  sessionId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', guestSessionId:guestId,
  goals:10, misses:0, finalState:'GAME_SUCCESS', nonce:'nonce-valid', events, elapsedMs:6000,
}, true);
assert(duplicate.status === 400 && rewards === 1, 'ayni session ikinci kez tamamlanamaz');

const foreign = await post('/api/predict-game/complete', {
  sessionId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc', guestSessionId:guestId,
  goals:10, misses:0, finalState:'GAME_SUCCESS', nonce:'nonce-foreign', events, elapsedMs:6000,
});
assert(foreign.status === 403 && sessions.get('cccccccc-cccc-4ccc-8ccc-cccccccccccc').status === 'started', 'misafir yabanci session icin 403 alir');

const afterTerminal = await post('/api/predict-game/complete', {
  sessionId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', guestSessionId:guestId,
  goals:10, misses:1, finalState:'GAME_SUCCESS', nonce:'nonce-terminal',
  events:[...events, { type:'miss', elapsedMs:5500 }], elapsedMs:6000,
});
assert(afterTerminal.status === 400 && sessions.get('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee').status === 'invalid', 'terminal olaydan sonraki event reddedilir');

const skewed = await post('/api/predict-game/complete', {
  sessionId:'ffffffff-ffff-4fff-8fff-ffffffffffff', guestSessionId:guestId,
  goals:10, misses:0, finalState:'GAME_SUCCESS', nonce:'nonce-skew', events, elapsedMs:6000,
});
assert(skewed.status === 400 && sessions.get('ffffffff-ffff-4fff-8fff-ffffffffffff').status === 'invalid', 'istemci ve sunucu elapsed sapmasi reddedilir');

const overEvents = Array.from({ length:5 }, (_, index) => ({ type:'miss', elapsedMs:(index + 1) * 500 }));
const gameOver = await post('/api/predict-game/complete', {
  sessionId:'99999999-9999-4999-8999-999999999999', guestSessionId:guestId,
  goals:0, misses:5, finalState:'GAME_OVER', nonce:'nonce-over', events:overEvents, elapsedMs:6000,
});
assert(gameOver.status === 200 && gameOver.body.session.status === 'game_over', 'GAME_OVER tam besinci kacirmada kabul edilir');

console.log('Predict game security behavior: PASS');
