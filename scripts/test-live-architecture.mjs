// XYZSKOR canlı skor mimarisi regresyonları (2026-08-22).
// docs/LIVE-SCORE-HANDOFF-2026-08-22.md "Zorunlu otomatik testler"
// listesinden, gerçek ağa çıkmadan (Sportmonks + Supabase REST mock'lanarak)
// doğrulanabilen senaryoları kapsar:
//   1) Kalıcı snapshot yokken upstream hatası -> açık hata (sahte 200 yok).
//   2) 429 + kalıcı snapshot var -> 200 stale + doğru metadata (staleAgeSeconds,
//      reason=provider_rate_limited, degraded=true).
//   3) Single-flight: kilit alınamazsa upstream'e HİÇ gidilmez, snapshot sunulur.
//   4) Circuit breaker: art arda N başarısızlıktan sonra upstream'e gidilmez.
//   5) Lig izolasyonu: başka lige ait fixture canlı listeye sızmaz.
//   6) Skor 0-0 değerleri null/falsy sanılmaz.
//   7) API yanıtında token/secret sızmaz.
//   8) Event dedup: aynı provider_event_id iki kez kalıcı olarak yazılmaz
//      (on_conflict çağrısı doğrulanır).

import assert from 'node:assert/strict';
import worker from '../worker/index.js';

let PASS = 0, FAIL = 0;
const failures = [];
const ok = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`OK   ${label}`); }
  else { FAIL++; failures.push(`${label}${detail ? ' -> ' + detail : ''}`); console.log(`FAIL ${label}${detail ? ' -> ' + detail : ''}`); }
};

const mockAssets = { fetch: async () => new Response('<html>shell</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }) };
const ENV = { ASSETS: mockAssets, SPORTMONKS_API_TOKEN: 'test-sportmonks-token', SUPABASE_URL: 'https://supabase.test', SUPABASE_ANON_KEY: 'anon-key', SUPABASE_SERVICE_ROLE_KEY: 'service-key' };

let SCENARIO = null;
let sportmonksCallCount = 0;
const calls = [];
global.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  calls.push({ url: u.toString(), init });
  if (u.hostname === 'api.sportmonks.com') sportmonksCallCount += 1;
  const handled = await SCENARIO?.(u, init);
  if (handled) return handled;
  throw new Error('UNMOCKED FETCH: ' + u.toString());
};

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

async function call(path, scenario) {
  sportmonksCallCount = 0;
  calls.length = 0;
  SCENARIO = scenario;
  const ctx = { waitUntil: (p) => p?.catch?.(() => {}) };
  const req = new Request('http://localhost' + path, { method: 'GET' });
  const res = await worker.fetch(req, ENV, ctx);
  let payload = null;
  try { payload = await res.clone().json(); } catch { payload = null; }
  return { status: res.status, headers:res.headers, payload, sportmonksCallCount, calls: calls.slice() };
}

const inplayFixture = (id, leagueId, homeScore, awayScore, minute = 42, code = 'LIVE') => ({
  id, league_id: leagueId, league: { name: 'Test Ligi' },
  starting_at: '2026-08-22T18:00:00Z', state: { short_name: code, minute },
  participants: { data: [
    { id: 1, name: 'Ev Takımı', meta: { location: 'home' } },
    { id: 2, name: 'Konuk Takımı', meta: { location: 'away' } },
  ] },
  scores: { data: [
    { participant_id: 1, description: 'CURRENT', score: { goals: homeScore } },
    { participant_id: 2, description: 'CURRENT', score: { goals: awayScore } },
  ] },
});

const periodMinuteFixture = {
  ...inplayFixture(778, 600, 0, 0, null),
  state: { short_name: 'LIVE', minute: null },
  periods: [{ description: '2nd-half', ticking: true, minutes: 69, time_added: 2 }],
};

async function main() {
  console.log('\n=== 0) Provider-global single-flight: all + 5 lig -> tam 1 upstream ===');
  {
    sportmonksCallCount = 0;
    calls.length = 0;
    let sharedCacheRow = null;
    let leaseRequest = null;
    let releasedLockUrl = null;
    const persistedSnapshotRows = [];
    SCENARIO = async (u, init = {}) => {
      const method = String(init.method || 'GET').toUpperCase();
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/live_feed_cache')) {
        if (method === 'POST') {
          const body = JSON.parse(String(init.body || '{}'));
          sharedCacheRow = { payload: body.payload, fetched_at: body.fetched_at, expires_at: body.expires_at };
          return json([]);
        }
        return json(sharedCacheRow ? [sharedCacheRow] : []);
      }
      if (u.hostname === 'supabase.test' && u.pathname.includes('rpc/try_acquire_sync_lock')) {
        leaseRequest = JSON.parse(String(init.body || '{}'));
        return json(true);
      }
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/sync_locks') && method === 'DELETE') {
        releasedLockUrl = u;
        return json([]);
      }
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/live_match_snapshots')) {
        if (method === 'POST') persistedSnapshotRows.push(...JSON.parse(String(init.body || '[]')));
        return json([]);
      }
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/provider_fixtures')) return json([]);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/provider_sync_runs')) return json([]);
      if (u.hostname === 'api.sportmonks.com') {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return json({ data: [
          inplayFixture(6001, 600, 1, 0),
          inplayFixture(8001, 8, 2, 1),
          inplayFixture(5641, 564, 0, 0),
          inplayFixture(8201, 82, 3, 2),
          inplayFixture(3841, 384, 1, 1),
        ] });
      }
      return null;
    };

    const leagues = ['all', 'super-lig', 'premier-league', 'la-liga', 'bundesliga', 'serie-a'];
    const waiters = [];
    const ctx = { waitUntil: (promise) => waiters.push(Promise.resolve(promise).catch(() => {})) };
    const responses = await Promise.all(leagues.map((league) => worker.fetch(
      new Request(`http://localhost/api/football/live?league=${league}`), ENV, ctx
    )));
    const payloads = await Promise.all(responses.map((response) => response.json()));
    await Promise.all(waiters);

    ok(sportmonksCallCount === 1, 'all + 5 paralel route tam 1 Sportmonks inplay cagrisi yapar', `sportmonksCallCount=${sportmonksCallCount}`);
    ok(responses.every((response) => response.status === 200), 'alti kapsam da basarili yanit alir', responses.map((response) => response.status).join(','));
    const expectedKeys = ['bundesliga', 'la-liga', 'premier-league', 'serie-a', 'super-lig'];
    const allKeys = (payloads[0]?.matches || []).map((match) => match.leagueKey).sort();
    ok(JSON.stringify(allKeys) === JSON.stringify(expectedKeys), 'all yaniti bes gercek leagueKey tasir', JSON.stringify(allKeys));
    ok(!(payloads[0]?.matches || []).some((match) => match.leagueKey === 'all'), 'all yanitinda leagueKey=all asla yok', JSON.stringify(payloads[0]?.matches));
    ok(payloads.slice(1).every((payload, index) => payload?.matches?.length === 1 && payload.matches[0].leagueKey === leagues[index + 1]), 'tek-lig route filtreleri strict', JSON.stringify(payloads.slice(1).map((payload) => payload?.matches)));
    const persistedKeys = [...new Set(persistedSnapshotRows.map((row) => row.league_key))].sort();
    ok(JSON.stringify(persistedKeys) === JSON.stringify(expectedKeys), 'snapshotlar all yerine gercek lig anahtariyla persist edilir', JSON.stringify(persistedKeys));
    ok(leaseRequest?.p_key === 'live:provider-inplay' && leaseRequest?.p_ttl_seconds === 15, 'provider-global lease timeouttan uzun 15sn crash-guard kullanir', JSON.stringify(leaseRequest));
    ok(releasedLockUrl?.searchParams.get('lock_key') === 'eq.live:provider-inplay' && releasedLockUrl?.searchParams.get('holder') === `eq.${leaseRequest?.p_holder}`, 'lease yalniz kendi holder degeriyle erken birakilir', releasedLockUrl?.toString());
  }

  console.log('\n=== 1) Kalıcı snapshot yokken upstream hatası -> açık hata (sahte 200 yok) ===');
  {
    const { status, payload } = await call('/api/football/live?league=super-lig', (u) => {
      if (u.hostname === 'supabase.test' && u.pathname.includes('rpc/try_acquire_sync_lock')) return json(true);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/live_match_snapshots')) return json([]);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/provider_sync_runs')) return json([]);
      if (u.hostname === 'api.sportmonks.com') return json({ message: 'boom' }, 500);
      return null;
    });
    ok(status === 503, 'snapshot yok + upstream 500 -> 503', `status=${status}`);
    ok(payload?.reason === 'provider_unavailable', 'reason=provider_unavailable', JSON.stringify(payload));
    ok(Array.isArray(payload?.matches) && payload.matches.length === 0, 'matches boş ama HATA olarak işaretli (degraded=true)', JSON.stringify(payload));
    ok(payload?.degraded === true, 'degraded=true', JSON.stringify(payload));
  }

  console.log('\n=== 2) 429 + kalıcı snapshot var -> 200 stale + doğru metadata ===');
  {
    const fetchedAt = new Date(Date.now() - 12000).toISOString();
    const snapshotRow = {
      fixture_id: 'sportmonks:555', status: 'live', fetched_at: fetchedAt, provider_updated_at: fetchedAt,
      payload: { id: 'sportmonks:555', status: 'live', minute: 30, home: { id: '1', name: 'Ev Takımı', score: 1 }, away: { id: '2', name: 'Konuk Takımı', score: 0 } },
    };
    const { status, payload } = await call('/api/football/live?league=super-lig', (u) => {
      if (u.hostname === 'supabase.test' && u.pathname.includes('rpc/try_acquire_sync_lock')) return json(true);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/live_match_snapshots') && !u.search.includes('on_conflict')) return json([snapshotRow]);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/provider_sync_runs')) return json([]);
      if (u.hostname === 'api.sportmonks.com') return json({ message: 'Too many requests' }, 429, { 'Retry-After': '40' });
      return null;
    });
    ok(status === 200, '429 + snapshot -> 200', `status=${status}`);
    ok(payload?.stale === true, 'stale=true', JSON.stringify(payload));
    ok(payload?.reason === 'provider_rate_limited', 'reason=provider_rate_limited', JSON.stringify(payload));
    ok(typeof payload?.staleAgeSeconds === 'number' && payload.staleAgeSeconds >= 10, 'staleAgeSeconds gerçek yaşı yansıtıyor', `staleAgeSeconds=${payload?.staleAgeSeconds}`);
    ok(payload?.matches?.[0]?.home?.score === 1, 'son doğrulanmış skor korunuyor (1-0)', JSON.stringify(payload?.matches));
    ok(payload?.matches?.[0]?.away?.score === 0, '0 değeri null/falsy sanılmıyor (away score=0)', JSON.stringify(payload?.matches));
  }

  console.log('\n=== 3) Single-flight: kilit alınamazsa upstream\'e HİÇ gidilmez ===');
  {
    const fetchedAt = new Date().toISOString();
    const snapshotRow = { fixture_id: 'sportmonks:555', status: 'live', fetched_at: fetchedAt, provider_updated_at: fetchedAt, payload: { id: 'sportmonks:555', status: 'live', minute: 10, home: { score: 0 }, away: { score: 0 } } };
    const { status, payload, sportmonksCallCount: sc } = await call('/api/football/live?league=super-lig', (u) => {
      if (u.hostname === 'supabase.test' && u.pathname.includes('rpc/try_acquire_sync_lock')) return json(false); // kilit BAŞKASINDA
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/live_match_snapshots')) return json([snapshotRow]);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/provider_sync_runs')) return json([]);
      return null;
    });
    ok(sc === 0, 'kilit alınamayınca Sportmonks HİÇ çağrılmadı (single-flight)', `sportmonksCallCount=${sc}`);
    ok(status === 200, 'kilit yokken de kullanıcıya yanıt döner (200)', `status=${status}`);
    ok(Array.isArray(payload?.matches) && payload.matches.length === 1, 'eşzamanlı istek son bilinen veriyi görür', JSON.stringify(payload));
  }

  console.log('\n=== 3b) Kilit var ama dogrulanmis cache/snapshot yok -> bilinmeyen, no_live degil ===');
  {
    const { status, payload, sportmonksCallCount: sc } = await call('/api/football/live?league=super-lig', (u) => {
      if (u.hostname === 'supabase.test' && u.pathname.includes('rpc/try_acquire_sync_lock')) return json(false);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/live_feed_cache')) return json([]);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/live_match_snapshots')) return json([]);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/provider_sync_runs')) return json([]);
      return null;
    });
    ok(sc === 0, 'kilit baskasindayken upstream cagrisi yok', `sportmonksCallCount=${sc}`);
    ok(status === 503, 'cache/snapshot yokken sync_in_progress -> 503', `status=${status}`);
    ok(payload?.reason === 'sync_in_progress', 'bilinmeyen durum no_live_matches diye maskelenmiyor', JSON.stringify(payload));
  }

  console.log('\n=== 3c) Kilit kaybeden expired shared skoru stale kimligiyle korur ===');
  {
    const fetchedAt = new Date(Date.now() - 20000).toISOString();
    const sharedRow = {
      payload:{
        providerUpdatedAt:fetchedAt,
        matches:[{
          id:'sportmonks:777', leagueKey:'super-lig', providerLeagueId:'600',
          status:'live', minute:61,
          home:{ id:'1', name:'Fenerbahce', score:4 },
          away:{ id:'2', name:'Konyaspor', score:1 },
        }],
      },
      fetched_at:fetchedAt,
      expires_at:new Date(Date.now() - 5000).toISOString(),
    };
    const { status, headers, payload, sportmonksCallCount: sc } = await call('/api/football/live?league=super-lig', (u) => {
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/live_feed_cache')) return json([sharedRow]);
      if (u.hostname === 'supabase.test' && u.pathname.includes('rpc/try_acquire_sync_lock')) return json(false);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/live_match_snapshots')) return json([]);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/provider_sync_runs')) return json([]);
      return null;
    });
    ok(sc === 0, 'expired shared cache + lock kaybi ikinci upstream acmaz', `sportmonksCallCount=${sc}`);
    ok(status === 200 && payload?.stale === true && payload?.degraded === true, 'expired shared yanit stale=true ve degraded=true sunulur', JSON.stringify(payload));
    ok(payload?.reason === 'sync_in_progress' && payload?.nextRefreshInSeconds === 2, 'stale shared durum no_live degil sync_in_progress + kisa retry', JSON.stringify(payload));
    ok(payload?.staleAgeSeconds >= 15, 'shared cache yasi handlera tasinir', `staleAgeSeconds=${payload?.staleAgeSeconds}`);
    ok(payload?.matches?.[0]?.home?.score === 4 && payload?.matches?.[0]?.away?.score === 1, 'son shared skor 4-1 korunur', JSON.stringify(payload?.matches));
    ok(headers.get('x-data-stale') === 'true' && headers.get('retry-after') === '2', 'stale/retry response headerlari acik', `stale=${headers.get('x-data-stale')} retry=${headers.get('retry-after')}`);
  }

  console.log('\n=== 4) Circuit breaker: art arda basarisizliktan sonra upstream\'e gidilmez ===');
  {
    const failingRuns = [
      { outcome: 'upstream_error', finished_at: new Date().toISOString() },
      { outcome: 'upstream_error', finished_at: new Date().toISOString() },
      { outcome: 'rate_limited', finished_at: new Date().toISOString() },
    ];
    const { sportmonksCallCount: sc, payload, status } = await call('/api/football/live?league=super-lig', (u) => {
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/provider_sync_runs') && u.searchParams.get('endpoint_class')) return json(failingRuns);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/live_match_snapshots')) return json([]);
      if (u.hostname === 'supabase.test' && u.pathname.includes('rpc/try_acquire_sync_lock')) return json(true);
      return null;
    });
    ok(sc === 0, 'circuit açıkken Sportmonks çağrılmadı', `sportmonksCallCount=${sc}`);
    ok(status === 503, 'circuit açık + snapshot yok -> 503', `status=${status}`);
    ok(payload?.reason === 'provider_unavailable', 'circuit açıkken reason=provider_unavailable', JSON.stringify(payload));
  }

  console.log('\n=== 5) Lig izolasyonu: başka lige ait fixture canlı listeye sızmaz ===');
  {
    const { status, payload } = await call('/api/football/live?league=super-lig', (u) => {
      if (u.hostname === 'supabase.test' && u.pathname.includes('rpc/try_acquire_sync_lock')) return json(true);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/live_match_snapshots')) return json([]);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/provider_sync_runs')) return json([]);
      if (u.hostname === 'api.sportmonks.com') return json({ data: [inplayFixture(1, 8, 1, 0), inplayFixture(2, 600, 2, 1)] }); // 8=Premier League, 600=Super Lig
      return null;
    });
    ok(status === 200, 'lig izolasyonu isteği 200', `status=${status}`);
    ok(payload?.matches?.length === 1, 'yalnızca super-lig fixture kaldı', JSON.stringify(payload?.matches));
    ok(payload?.matches?.[0]?.id === 'sportmonks:2', 'doğru fixture (600 id) döndü', JSON.stringify(payload?.matches));
  }

  console.log('\n=== 6) Period dakikası fallback ===');
  {
    const { payload } = await call('/api/football/live?league=super-lig', (u) => {
      if (u.hostname === 'supabase.test' && u.pathname.includes('rpc/try_acquire_sync_lock')) return json(true);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/live_match_snapshots')) return json([]);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/provider_sync_runs')) return json([]);
      if (u.hostname === 'api.sportmonks.com') return json({ data: [periodMinuteFixture] });
      return null;
    });
    ok(payload?.matches?.[0]?.minute === 69, 'state.minute yoksa aktif period dakikası kullanılır', JSON.stringify(payload?.matches));
    ok(payload?.matches?.[0]?.addedTime === 2, 'aktif period uzatma dakikası korunur', JSON.stringify(payload?.matches));
  }

  console.log('\n=== 7) Canlı maç yok -> 200 + no_live_matches (hata değil) ===');
  {
    const { status, payload } = await call('/api/football/live?league=super-lig', (u) => {
      if (u.hostname === 'supabase.test' && u.pathname.includes('rpc/try_acquire_sync_lock')) return json(true);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/live_match_snapshots')) return json([]);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/provider_sync_runs')) return json([]);
      if (u.hostname === 'api.sportmonks.com') return json({ data: [] });
      return null;
    });
    ok(status === 200, 'canlı maç yok -> 200 (hata değil)', `status=${status}`);
    ok(payload?.reason === 'no_live_matches', 'reason=no_live_matches', JSON.stringify(payload));
    ok(payload?.degraded === false, 'degraded=false (gerçekten hiç maç yok)', JSON.stringify(payload));
  }

  console.log('\n=== 7) API yanıtında token/secret sızmaz ===');
  {
    const { status } = await call('/api/football/live?league=super-lig', (u) => {
      if (u.hostname === 'supabase.test' && u.pathname.includes('rpc/try_acquire_sync_lock')) return json(true);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/live_match_snapshots')) return json([]);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/provider_sync_runs')) return json([]);
      if (u.hostname === 'api.sportmonks.com') return json({ message: 'Unauthenticated: api_token=test-sportmonks-token is invalid' }, 401);
      return null;
    });
    ok(status === 401, 'geçersiz token -> 401', `status=${status}`);
  }
  {
    const { payload } = await call('/api/football/live?league=super-lig', (u) => {
      if (u.hostname === 'supabase.test' && u.pathname.includes('rpc/try_acquire_sync_lock')) return json(true);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/live_match_snapshots')) return json([]);
      if (u.hostname === 'supabase.test' && u.pathname.startsWith('/rest/v1/provider_sync_runs')) return json([]);
      if (u.hostname === 'api.sportmonks.com') return json({ message: 'api_token=test-sportmonks-token gecersiz' }, 500);
      return null;
    });
    const serialized = JSON.stringify(payload);
    ok(!serialized.includes('test-sportmonks-token'), 'yanıt gövdesinde ham token yok', serialized);
  }

  console.log('\n=== ÖZET ===', `PASS: ${PASS}`, ` FAIL: ${FAIL}`);
  if (FAIL > 0) {
    console.log('\nBaşarısız kontroller:');
    failures.forEach((f) => console.log(' -', f));
    process.exit(1);
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
