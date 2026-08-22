// XYZSKOR worker/index.js için kapsamlı API test harness'i.
// Gerçek ağa çıkmadan (SportMonks/X/YouTube upstream'leri mock'lanarak)
// tüm /api/* handler'ların mantığını doğrular: secret yok senaryoları,
// geçersiz parametreler, mock başarı yanıtları, upstream hata kodları
// (401/402/403/404/429/500) ve bunların doğru HTTP durumuna/error koduna
// eşlenmesi.

import worker from '../../worker/index.js';

let PASS = 0, FAIL = 0;
const failures = [];

function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { PASS++; }
  else { FAIL++; failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} -> ${JSON.stringify(actual)}`);
}

function assertTrue(cond, label, detail) {
  if (cond) { PASS++; console.log(`OK   ${label}`); }
  else { FAIL++; failures.push(`${label} ${detail ? '(' + detail + ')' : ''}`); console.log(`FAIL ${label} ${detail ? '(' + detail + ')' : ''}`); }
}

// ---- Mock env.ASSETS (statik dosya sunumu, bu testlerde kullanılmıyor ama gerekli) ----
const mockAssets = { fetch: async () => new Response('<html>shell</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }) };
const ctx = { waitUntil: () => {} };

const NO_SECRETS_ENV = { ASSETS: mockAssets };
const ALL_SECRETS_ENV = { ASSETS: mockAssets, X_BEARER_TOKEN: 'test-x-token', YOUTUBE_API_KEY: 'test-yt-key', SPORTMONKS_API_TOKEN: 'test-sportmonks-token' };

// ---- Mock fetch dispatcher ----
// SCENARIO her testten önce ayarlanır; upstream host+path desenine göre yanıt üretir.
let SCENARIO = null;
global.fetch = async (url, init) => {
  const u = new URL(String(url));
  const handler = SCENARIO?.(u, init);
  if (handler) return handler;
  throw new Error('UNMOCKED FETCH: ' + u.toString());
};

function jsonUpstream(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function run(label, path, env, scenario, method = 'GET') {
  SCENARIO = scenario || null;
  const req = new Request('http://localhost' + path, { method });
  const res = await worker.fetch(req, env, ctx);
  let body = null;
  try { body = await res.clone().json(); } catch { body = null; }
  return { res, body, status: res.status };
}

async function main() {
  console.log('\n=== 1) /api/health ===');
  {
    const { status, body } = await run('health-no-secrets', '/api/health', NO_SECRETS_ENV);
    assertEqual(status, 200, 'health status (no secrets)');
    assertEqual(body?.checks, { static_delivery: 'ok', x_feed: 'not_configured', youtube_media: 'not_configured', sportmonks_live: 'not_configured', sportmonks_season: 'not_configured', sportmonks_clubs: 'not_configured', api_sports_multisport:'not_configured', cito_ufc:'not_configured', openblacktop_motorsports:'not_configured', instagram: 'not_configured' }, 'health checks (no secrets)');
  }
  {
    const { status, body } = await run('health-all-secrets', '/api/health', ALL_SECRETS_ENV);
    assertEqual(status, 200, 'health status (all secrets)');
    assertEqual(body?.checks, { static_delivery: 'ok', x_feed: 'configured', youtube_media: 'configured', sportmonks_live: 'configured', sportmonks_season: 'configured', sportmonks_clubs: 'configured', api_sports_multisport:'not_configured', cito_ufc:'not_configured', openblacktop_motorsports:'not_configured', instagram: 'not_configured' }, 'health checks (all secrets)');
  }
  {
    const { status } = await run('health-post-405', '/api/health', ALL_SECRETS_ENV, null, 'POST');
    assertEqual(status, 405, 'health POST -> 405 method_not_allowed');
  }

  console.log('\n=== 2) /api/football/live ===');
  {
    const { status, body } = await run('live-no-token', '/api/football/live?league=super-lig', NO_SECRETS_ENV);
    assertEqual(status, 503, 'live no token -> 503');
    assertEqual(body?.error, 'sportmonks_not_configured', 'live no token error code');
  }
  {
    const { status, body } = await run('live-invalid-league', '/api/football/live?league=not-a-league', ALL_SECRETS_ENV);
    assertEqual(status, 400, 'live invalid league -> 400');
    assertEqual(body?.error, 'invalid_league', 'live invalid league error code');
  }
  {
    const { status, body } = await run('live-success', '/api/football/live?league=super-lig', ALL_SECRETS_ENV, (u) => {
      if (u.pathname === '/v3/football/livescores/inplay') return jsonUpstream({
        data: [{
          id: 111, league_id: 600, league: { name: 'Süper Lig' },
          starting_at: '2026-08-06T18:00:00Z', state: { short_name: 'LIVE', minute: 42 },
          participants: { data: [
            { id: 1, name: 'Galatasaray', meta: { location: 'home' } },
            { id: 2, name: 'Fenerbahçe', meta: { location: 'away' } },
          ] },
          scores: { data: [
            { participant_id: 1, description: 'CURRENT', score: { goals: 2 } },
            { participant_id: 2, description: 'CURRENT', score: { goals: 1 } },
          ] },
        }],
      });
      return null;
    });
    assertEqual(status, 200, 'live success -> 200');
    assertEqual(body?.matches?.length, 1, 'live success -> 1 match in scope');
    assertEqual(body?.matches?.[0]?.home?.name, 'Galatasaray', 'live success -> home team name');
    assertEqual(body?.matches?.[0]?.home?.score, 2, 'live success -> home score');
    assertEqual(body?.matches?.[0]?.status, 'live', 'live success -> status mapping (LIVE code)');
  }
  {
    // Farklı lige ait maç: league=super-lig filtresi dışında kalmalı.
    const { status, body } = await run('live-out-of-scope', '/api/football/live?league=super-lig', ALL_SECRETS_ENV, (u) => {
      if (u.pathname === '/v3/football/livescores/inplay') return jsonUpstream({
        data: [{ id: 222, league_id: 8, league: { name: 'Premier League' }, participants: { data: [] }, scores: { data: [] } }],
      });
      return null;
    });
    assertEqual(status, 200, 'live out-of-scope -> 200');
    assertEqual(body?.matches?.length, 0, 'live out-of-scope -> lig filtresi dışı maç elendi');
  }
  {
    const { status, body } = await run('live-401', '/api/football/live?league=super-lig', ALL_SECRETS_ENV, () => jsonUpstream({ message: 'Unauthenticated' }, 401));
    assertEqual(status, 401, 'live upstream 401 -> 401');
    assertEqual(body?.error, 'sportmonks_token_invalid', 'live upstream 401 error code');
  }
  {
    const { status, body } = await run('live-403', '/api/football/live?league=super-lig', ALL_SECRETS_ENV, () => jsonUpstream({ message: 'Plan restricted' }, 403));
    assertEqual(status, 403, 'live upstream 403 -> 403');
    assertEqual(body?.error, 'sportmonks_plan_restricted', 'live upstream 403 error code');
  }
  {
    const { status, body } = await run('live-500', '/api/football/live?league=super-lig', ALL_SECRETS_ENV, () => jsonUpstream({ message: 'boom' }, 500));
    assertEqual(status, 200, 'live upstream 500 -> 200 degraded empty state');
    assertEqual(body?.degraded, true, 'live upstream 500 degraded flag');
    assertEqual(body?.matches?.length, 0, 'live upstream 500 empty live list');
  }

  console.log('\n=== 3) /api/football/season ===');
  {
    const { status, body } = await run('season-no-token', '/api/football/season?league=super-lig', NO_SECRETS_ENV);
    assertEqual(status, 503, 'season no token -> 503');
    assertEqual(body?.error, 'sportmonks_not_configured', 'season no token error code');
  }
  {
    const { status, body } = await run('season-invalid-league', '/api/football/season?league=xyz', ALL_SECRETS_ENV);
    assertEqual(status, 400, 'season invalid league -> 400');
    assertEqual(body?.error, 'invalid_league', 'season invalid league error code');
  }
  {
    const { status, body } = await run('season-all-league-rejected', '/api/football/season?league=all', ALL_SECRETS_ENV);
    assertEqual(status, 400, 'season league=all (single:true ile reddedilmeli) -> 400');
    assertEqual(body?.error, 'invalid_league', 'season league=all error code');
  }
  {
    const { status, body } = await run('season-success', '/api/football/season?league=super-lig', ALL_SECRETS_ENV, (u) => {
      if (u.pathname === '/v3/football/leagues/600') return jsonUpstream({
        data: { id: 600, name: 'Süper Lig', country: { name: 'Türkiye' }, currentseason: { id: 999, is_current: true } },
      });
      if (u.pathname === '/v3/football/standings/seasons/999') return jsonUpstream({
        data: [{ participant: { id: 1, name: 'Galatasaray' }, points: 90, won: 28, draw: 3, lost: 3, played: 34, goals_for: 80, goals_against: 20 }],
      });
      if (u.pathname === '/v3/football/schedules/seasons/999') {
        const fixture = {
          id: 555, starting_at: '2026-08-10T18:00:00Z', season_id: 999,
          state: { short_name: 'NS' },
          participants: { data: [
            { id: 1, name: 'Galatasaray', meta: { location: 'home' } },
            { id: 3, name: 'Trabzonspor', meta: { location: 'away' } },
          ] },
        };
        const round = { name: '1', fixtures: { data: [fixture] } };
        const stage = { rounds: { data: [round] } };
        return jsonUpstream({ data: [stage] });
      }
      return null;
    });
    assertEqual(status, 200, 'season success -> 200');
    assertEqual(body?.competition, 'Süper Lig', 'season success -> competition adı');
    assertEqual(body?.standings?.length, 1, 'season success -> 1 standing satırı');
    assertEqual(body?.standings?.[0]?.team, 'Galatasaray', 'season success -> standing takım adı');
    assertEqual(body?.matches?.length, 1, 'season success -> 1 fikstür');
  }
  {
    const { status, body } = await run('season-403-league-not-in-plan', '/api/football/season?league=premier-league', ALL_SECRETS_ENV, () => jsonUpstream({ message: 'not in plan' }, 403));
    assertEqual(status, 403, 'season league erişilemez plan -> 403');
    assertEqual(body?.error, 'sportmonks_plan_restricted', 'season 403 error code');
  }

  console.log('\n=== 4) /api/football/fixture ===');
  {
    const { status, body } = await run('fixture-no-token', '/api/football/fixture?id=123', NO_SECRETS_ENV);
    assertEqual(status, 503, 'fixture no token -> 503');
    assertEqual(body?.error, 'sportmonks_not_configured', 'fixture no token error code');
  }
  {
    const { status, body } = await run('fixture-invalid-id', '/api/football/fixture?id=abc', ALL_SECRETS_ENV);
    assertEqual(status, 400, 'fixture geçersiz id -> 400');
    assertEqual(body?.error, 'invalid_fixture_id', 'fixture geçersiz id error code');
  }
  {
    const { status, body } = await run('fixture-success', '/api/football/fixture?id=sportmonks:555', ALL_SECRETS_ENV, (u) => {
      if (u.pathname === '/v3/football/fixtures/555') return jsonUpstream({
        data: { id: 555, participants: { data: [{ id: 1, name: 'Galatasaray' }, { id: 2, name: 'Fenerbahçe' }] }, venue: { name: 'RAMS Park' } },
      });
      return null;
    });
    assertEqual(status, 200, 'fixture success -> 200 (sportmonks: öneki temizlendi)');
    assertEqual(body?.id, 'sportmonks:555', 'fixture success -> id formatı');
    assertEqual(body?.details?.venue?.name, 'RAMS Park', 'fixture success -> venue adı');
  }
  {
    const { status, body } = await run('fixture-403', '/api/football/fixture?id=555', ALL_SECRETS_ENV, () => jsonUpstream({ message: 'restricted' }, 403));
    assertEqual(status, 403, 'fixture 403 -> 403');
    assertEqual(body?.error, 'sportmonks_plan_restricted', 'fixture 403 error code');
  }

  console.log('\n=== 5) /api/football/club ===');
  {
    const { status, body } = await run('club-no-token', '/api/football/club?team=Galatasaray', NO_SECRETS_ENV);
    assertEqual(status, 503, 'club no token -> 503');
    assertEqual(body?.error, 'sportmonks_not_configured', 'club no token error code');
  }
  {
    const { status, body } = await run('club-missing-team', '/api/football/club?team=', ALL_SECRETS_ENV);
    assertEqual(status, 400, 'club eksik team -> 400');
    assertEqual(body?.error, 'unknown_team', 'club eksik team error code');
  }
  {
    const { status, body } = await run('club-success', '/api/football/club?team=Galatasaray', ALL_SECRETS_ENV, (u) => {
      if (u.pathname.startsWith('/v3/football/teams/search/')) return jsonUpstream({ data: [{ id: 1, name: 'Galatasaray', venue: { data: { id: 9, name: 'RAMS Park' } } }] });
      if (u.pathname === '/v3/football/squads/teams/1/extended') return jsonUpstream({ data: [{ player: { id: 10, display_name: 'Mauro Icardi' }, jersey_number: 9, in_squad: true }] });
      if (u.pathname.startsWith('/v3/football/fixtures/between/')) return jsonUpstream({ data: [] });
      return null;
    });
    assertEqual(status, 200, 'club success -> 200');
    assertEqual(body?.team?.name, 'Galatasaray', 'club success -> takım adı');
    assertEqual(body?.venue?.name, 'RAMS Park', 'club success -> stadyum adı');
    assertEqual(body?.squad?.length, 1, 'club success -> 1 kadro üyesi');
  }
  {
    const { status, body } = await run('club-not-found', '/api/football/club?team=UydurmaTakim', ALL_SECRETS_ENV, (u) => {
      if (u.pathname.startsWith('/v3/football/teams/search/')) return jsonUpstream({ data: [] });
      return null;
    });
    assertEqual(status, 404, 'club bulunamayan takım -> 404');
    assertEqual(body?.error, 'sportmonks_team_not_found', 'club bulunamayan takım error code');
  }

  console.log('\n=== 6) /api/football/transfers ===');
  {
    const { status, body } = await run('transfers-no-token', '/api/football/transfers?league=super-lig', NO_SECRETS_ENV);
    assertEqual(status, 503, 'transfers no token -> 503');
    assertEqual(body?.error, 'sportmonks_not_configured', 'transfers no token error code');
  }
  {
    const { status, body } = await run('transfers-invalid-league', '/api/football/transfers?league=nope', ALL_SECRETS_ENV);
    assertEqual(status, 400, 'transfers geçersiz lig -> 400');
    assertEqual(body?.error, 'invalid_league', 'transfers geçersiz lig error code');
  }
  {
    const { status, body } = await run('transfers-success', '/api/football/transfers?league=super-lig&teams=Galatasaray', ALL_SECRETS_ENV, (u) => {
      if (u.pathname === '/v3/football/transfers/latest') return jsonUpstream({
        data: [{ id: 1, league_id: 600, player: { display_name: 'Test Oyuncu' }, fromTeam: { name: 'Diğer Takım' }, toTeam: { name: 'Galatasaray' }, amount: 5000000 }],
      });
      if (u.pathname === '/v3/football/transfer-rumours') return jsonUpstream({ data: [] });
      return null;
    });
    assertEqual(status, 200, 'transfers success -> 200');
    assertEqual(body?.confirmed?.length, 1, 'transfers success -> 1 confirmed transfer (takım filtresine uygun)');
    assertEqual(body?.confirmed?.[0]?.to, 'Galatasaray', 'transfers success -> hedef takım');
  }
  {
    const { status, body } = await run('transfers-partial-failure', '/api/football/transfers?league=super-lig', ALL_SECRETS_ENV, (u) => {
      if (u.pathname === '/v3/football/transfers/latest') return jsonUpstream({ message: 'boom' }, 500);
      if (u.pathname === '/v3/football/transfer-rumours') return jsonUpstream({ data: [] });
      return null;
    });
    assertEqual(status, 200, 'transfers kısmi upstream hatası -> yine 200 (graceful degrade)');
    assertEqual(body?.errors?.length, 1, 'transfers kısmi hata -> errors dizisinde 1 kayıt');
    assertEqual(body?.confirmed?.length, 0, 'transfers kısmi hata -> confirmed boş');
  }

  console.log('\n=== 7) /api/football/coverage ===');
  {
    const { status, body } = await run('coverage-no-token', '/api/football/coverage', NO_SECRETS_ENV);
    assertEqual(status, 503, 'coverage no token -> 503');
    assertEqual(body?.error, 'sportmonks_not_configured', 'coverage no token error code');
  }
  {
    const { status, body } = await run('coverage-success', '/api/football/coverage', ALL_SECRETS_ENV, (u) => {
      if (u.pathname === '/v3/my/leagues') return jsonUpstream({ data: [
        { id: 600, name: 'Süper Lig' }, { id: 8, name: 'Premier League' }, { id: 564, name: 'La Liga' },
        { id: 82, name: 'Bundesliga' }, { id: 384, name: 'Serie A' }, { id: 2, name: 'Champions League' },
      ] });
      if (u.pathname.startsWith('/v3/football/leagues/')) {
        const id = u.pathname.split('/').pop();
        return jsonUpstream({ data: { id: Number(id), name: 'Lig ' + id, currentseason: { id: 1, is_current: true } } });
      }
      if (u.pathname.startsWith('/v3/football/schedules/seasons/')) return jsonUpstream({ data: [] });
      return null;
    });
    assertEqual(status, 200, 'coverage success -> 200');
    assertEqual(body?.selected?.length, 5, 'coverage success -> 5 aktif lig probe edildi');
    assertEqual(body?.selected?.filter((row) => row.available).length, 5, 'coverage success -> abonelikte raporlanan beş aktif lig available=true');
    assertEqual(body?.selected?.filter((row) => row.subscriptionReported).length, 5, 'coverage success -> aktif liglerde /my/leagues bildirimi ayrı tutulur');
    assertEqual(body?.subscribed?.length, 6, 'coverage success -> abonelikteki ligler gizlenmeden raporlanır');
    assertTrue(body?.selected?.filter((row) => row.subscriptionReported).every((row) => row.metadataAvailable === true), 'coverage success -> abonelikteki liglerin metadata probe sonucu raporlanır');
    assertEqual(body?.selected?.filter((row) => row.reason === 'not_in_subscription').length, 0, 'coverage success -> tüm aktif ligler abonelik kapsamında');
    assertTrue(body?.selected?.every((row) => row.capabilities && typeof row.capabilities.fixtures === 'boolean'), 'coverage success -> lig yetenek matrisi döner');
  }

  console.log('\n=== 8) /api/media/youtube ===');
  {
    const { status, body } = await run('youtube-no-key', '/api/media/youtube', NO_SECRETS_ENV);
    assertEqual(status, 503, 'youtube no key -> 503');
    assertEqual(body?.error, 'youtube_not_configured', 'youtube no key error code');
    assertTrue(Array.isArray(body?.channels) && body.channels.length === 4, 'youtube no key -> yine kanal listesi dönüyor (fallback için)');
  }
  {
    const { status, body } = await run('youtube-success', '/api/media/youtube', ALL_SECRETS_ENV, (u) => {
      if (u.pathname === '/youtube/v3/search') return jsonUpstream({ items: [{ id: { videoId: 'abc123' }, snippet: { title: 'Test Video', channelTitle: 'Test Kanal', publishedAt: '2026-08-01T00:00:00Z', thumbnails: { high: { url: 'https://img.example/test.jpg' } } } }] });
      if (u.pathname === '/youtube/v3/videos') return jsonUpstream({ items: [{ id: 'abc123', snippet: { title: 'Test Video', thumbnails: { high: { url: 'https://img.example/test.jpg' } } }, contentDetails: { duration: 'PT5M' } }] });
      return null;
    });
    assertEqual(status, 200, 'youtube success -> 200');
    assertTrue(body?.items?.length > 0, 'youtube success -> en az 1 video döndü', `items=${body?.items?.length}`);
  }
  {
    const { status, body } = await run('youtube-403-quota', '/api/media/youtube', ALL_SECRETS_ENV, () => jsonUpstream({ message: 'quota' }, 403));
    assertEqual(status, 403, 'youtube kota/anahtar hatası -> 403');
    assertEqual(body?.error, 'youtube_quota_or_key_error', 'youtube 403 error code');
  }

  console.log('\n=== 9) /api/football/x-media (ve /api/social/x aliasları) ===');
  {
    const { status, body } = await run('xmedia-no-token', '/api/football/x-media?league=super-lig', NO_SECRETS_ENV);
    assertEqual(status, 503, 'x-media no token -> 503');
    assertEqual(body?.error, 'x_not_configured', 'x-media no token error code');
  }
  {
    const { status, body } = await run('xmedia-invalid-league', '/api/football/x-media?league=zzz', ALL_SECRETS_ENV);
    assertEqual(status, 400, 'x-media geçersiz lig -> 400');
    assertEqual(body?.error, 'invalid_league', 'x-media geçersiz lig error code');
  }
  {
    const { status, body } = await run('xmedia-paused', '/api/football/x-media?league=super-lig&pause_x=1', ALL_SECRETS_ENV);
    assertEqual(status, 200, 'x-media pause_x=1 -> 200 (ağ çağrısı hiç yapılmadı)');
    assertEqual(body?.status, 'paused', 'x-media pause_x=1 -> status=paused');
  }
  {
    const { status, body } = await run('xmedia-success', '/api/football/x-media?league=super-lig', ALL_SECRETS_ENV, (u) => {
      if (u.pathname === '/2/users/by') return jsonUpstream({ data: [
        { id: 'u1', username: 'GalatasaraySK', verified: true },
        { id: 'u2', username: 'Fenerbahce', verified: true },
        { id: 'u3', username: 'Besiktas', verified: true },
        { id: 'u4', username: 'Trabzonspor', verified: true },
        { id: 'u5', username: 'FabrizioRomano', verified: true },
        { id: 'u6', username: 'yagosabuncuoglu', verified: false },
      ] });
      if (u.pathname.startsWith('/2/users/u1/tweets')) return jsonUpstream({ data: [{ id: 't1', text: 'Galatasaray bugün kazandı', created_at: '2026-08-06T10:00:00Z', public_metrics: {} }] });
      if (/^\/2\/users\/u[2-6]\/tweets/.test(u.pathname)) return jsonUpstream({ data: [] });
      return null;
    });
    assertEqual(status, 200, 'x-media success -> 200');
    assertEqual(body?.clubs?.length, 4, 'x-media success -> 4 kulüp (X_CLUB_DAILY_LIMIT)');
    assertTrue(body?.clubs?.[0]?.post?.text?.includes('Galatasaray'), 'x-media success -> ilk kulübün post metni doğru');
  }
  {
    const { status, body } = await run('xmedia-402-credits', '/api/football/x-media?league=super-lig', ALL_SECRETS_ENV, (u) => {
      if (u.pathname === '/2/users/by') return jsonUpstream({ message: 'credits' }, 402);
      return null;
    });
    assertEqual(status, 200, 'x-media 402 (kredi tükendi) -> yine 200, credits payload ile');
    assertEqual(body?.status, 'x_credits_depleted', 'x-media 402 -> status=x_credits_depleted');
  }
  {
    const { status, body } = await run('xmedia-upstream-down', '/api/football/x-media?league=super-lig', ALL_SECRETS_ENV, () => jsonUpstream({ message: 'down' }, 500));
    assertEqual(status, 502, 'x-media upstream 500 (cache yok) -> 502');
    assertEqual(body?.error, 'x_upstream_unavailable', 'x-media upstream 500 error code');
  }
  {
    // Alias route kontrolü: /api/social/x aynı handler'a gitmeli.
    const { status, body } = await run('xmedia-alias-paused', '/api/social/x?league=super-lig&pause_x=1', ALL_SECRETS_ENV);
    assertEqual(status, 200, '/api/social/x alias -> aynı davranış (paused)');
    assertEqual(body?.status, 'paused', '/api/social/x alias -> status=paused');
  }

  console.log('\n=== 10) /api/football/x-preseason (ve /api/social/x-preseason-v* aliasları) ===');
  {
    const { status, body } = await run('xpreseason-no-token', '/api/football/x-preseason?league=super-lig', NO_SECRETS_ENV);
    assertEqual(status, 503, 'x-preseason no token -> 503');
    assertEqual(body?.error, 'x_not_configured', 'x-preseason no token error code');
  }
  {
    const { status, body } = await run('xpreseason-paused', '/api/football/x-preseason?league=super-lig&pause_x=1', ALL_SECRETS_ENV);
    assertEqual(status, 200, 'x-preseason pause_x=1 -> 200');
    assertEqual(body?.status, 'paused', 'x-preseason pause_x=1 -> status=paused');
  }
  {
    const { status, body } = await run('xpreseason-success', '/api/football/x-preseason?league=super-lig', ALL_SECRETS_ENV, (u) => {
      if (u.pathname === '/2/users/by') return jsonUpstream({ data: [
        { id: 'u1', username: 'GalatasaraySK' }, { id: 'u2', username: 'Fenerbahce' },
        { id: 'u3', username: 'Besiktas' }, { id: 'u4', username: 'Trabzonspor' },
      ] });
      if (u.pathname.startsWith('/2/users/u1/tweets')) return jsonUpstream({ data: [{ id: 't1', text: 'Hazırlık maçında galibiyet: 3-1', created_at: '2026-08-05T10:00:00Z', public_metrics: {} }] });
      return jsonUpstream({ data: [] });
    });
    assertEqual(status, 200, 'x-preseason success -> 200');
    assertTrue(body?.clubs?.some((c) => c.preseason_post?.scoreline === '3-1'), 'x-preseason success -> skor tespiti (3-1) çalıştı', JSON.stringify(body?.clubs?.map((c) => c.preseason_post?.scoreline)));
  }
  {
    const { status, body } = await run('xpreseason-alias', '/api/social/x-preseason-v1?league=super-lig&pause_x=1', ALL_SECRETS_ENV);
    assertEqual(status, 200, '/api/social/x-preseason-v1 alias -> aynı davranış (paused)');
    assertEqual(body?.status, 'paused', '/api/social/x-preseason-v1 alias -> status=paused');
  }

  console.log('\n=== 11) Method not allowed kontrolleri (POST) ===');
  for (const path of [
    '/api/football/live?league=super-lig', '/api/football/season?league=super-lig', '/api/football/fixture?id=1',
    '/api/football/club?team=Galatasaray', '/api/football/transfers?league=super-lig', '/api/football/coverage',
    '/api/media/youtube', '/api/football/x-media?league=super-lig', '/api/football/x-preseason?league=super-lig',
  ]) {
    const { status, body } = await run('post-' + path, path, ALL_SECRETS_ENV, null, 'POST');
    assertEqual(status, 405, `POST ${path} -> 405`);
    assertEqual(body?.error, 'method_not_allowed', `POST ${path} error code`);
  }

  console.log('\n=== 12) /api/social/instagram ===');
  {
    const { status, body } = await run('ig-not-configured', '/api/social/instagram?league=super-lig', ALL_SECRETS_ENV);
    assertEqual(status, 503, 'instagram secret yok -> 503');
    assertEqual(body?.error, 'instagram_not_configured', 'instagram secret yok error code');
    assertTrue(Array.isArray(body?.required) && body.required.length === 2, 'instagram -> gereken secret adlari bildiriliyor');
  }
  const IG_ENV = { ...ALL_SECRETS_ENV, INSTAGRAM_ACCESS_TOKEN: 'test-ig-token', INSTAGRAM_BUSINESS_ACCOUNT_ID: '17841400000000000' };
  {
    const { status, body } = await run('ig-invalid-league', '/api/social/instagram?league=zzz', IG_ENV);
    assertEqual(status, 400, 'instagram gecersiz lig -> 400');
    assertEqual(body?.error, 'invalid_league', 'instagram gecersiz lig error code');
  }
  {
    const { status, body } = await run('ig-success', '/api/social/instagram?league=super-lig', IG_ENV, (u) => {
      if (u.pathname.endsWith('/ig_hashtag_search')) return jsonUpstream({ data: [{ id: 'hash1' }] });
      if (u.pathname.includes('/hash1/recent_media')) return jsonUpstream({ data: [
        { id: 'p1', caption: 'Derbi hazirligi', media_type: 'IMAGE', media_url: 'https://img/1.jpg', permalink: 'https://instagram.com/p/1', timestamp: '2026-08-06T09:00:00Z', like_count: 120, comments_count: 8 },
        { id: 'p2', caption: 'Antrenman', media_type: 'VIDEO', thumbnail_url: 'https://img/2.jpg', media_url: 'https://v/2.mp4', permalink: 'https://instagram.com/p/2', timestamp: '2026-08-06T08:00:00Z' },
      ] });
      if (u.pathname.includes('/media')) return jsonUpstream({ data: [
        { id: 'own1', caption: 'XYZSkor haftanin ozeti', media_type: 'IMAGE', media_url: 'https://img/own.jpg', permalink: 'https://instagram.com/p/own', timestamp: '2026-08-06T10:00:00Z', username: 'xyzskor' },
      ] });
      return null;
    });
    assertEqual(status, 200, 'instagram success -> 200');
    assertTrue(body?.items?.length >= 3, 'instagram success -> hashtag + kendi gonderileri birlestirildi', `items=${body?.items?.length}`);
    assertEqual(body?.items?.[0]?.id, 'own1', 'instagram success -> en yeni gonderi basta (tarih sirali)');
    const video = body?.items?.find((row) => row.id === 'p2');
    assertEqual(video?.isVideo, true, 'instagram success -> video tipi tespit edildi');
    assertEqual(video?.preview, 'https://img/2.jpg', 'instagram success -> video icin thumbnail_url kullanildi');
  }
  {
    // Ayni gonderi hem hashtag hem kendi hesabindan gelirse tekillestirilmeli.
    const { body } = await run('ig-dedupe', '/api/social/instagram?league=la-liga', IG_ENV, (u) => {
      if (u.pathname.endsWith('/ig_hashtag_search')) return jsonUpstream({ data: [{ id: 'h9' }] });
      if (u.pathname.includes('/h9/recent_media')) return jsonUpstream({ data: [{ id: 'dup', caption: 'ayni', media_type: 'IMAGE', media_url: 'https://img/d.jpg', timestamp: '2026-08-06T07:00:00Z' }] });
      if (u.pathname.includes('/media')) return jsonUpstream({ data: [{ id: 'dup', caption: 'ayni', media_type: 'IMAGE', media_url: 'https://img/d.jpg', timestamp: '2026-08-06T07:00:00Z' }] });
      return null;
    });
    assertEqual(body?.items?.length, 1, 'instagram -> ayni id iki kaynaktan gelse de tek kayit');
  }
  {
    const { status, body } = await run('ig-401', '/api/social/instagram?league=super-lig', IG_ENV,
      () => jsonUpstream({ error: { message: 'Invalid OAuth access token', code: 190 } }, 401));
    assertEqual(status, 401, 'instagram token gecersiz -> 401');
    assertEqual(body?.error, 'instagram_token_invalid', 'instagram 401 error code');
  }
  {
    const { status, body } = await run('ig-403', '/api/social/instagram?league=super-lig', IG_ENV,
      () => jsonUpstream({ error: { message: 'Permission denied', code: 10 } }, 403));
    assertEqual(status, 403, 'instagram izin yok -> 403');
    assertEqual(body?.error, 'instagram_permission_denied', 'instagram 403 error code');
  }
  {
    // Hashtag'lerden biri duserse endpoint yine 200 donmeli (kismi bozulma).
    const { status, body } = await run('ig-partial', '/api/social/instagram?league=super-lig', IG_ENV, (u) => {
      if (u.searchParams.get('q') === 'galatasaray') return jsonUpstream({ error: { message: 'rate limited', code: 4 } }, 429);
      if (u.pathname.endsWith('/ig_hashtag_search')) return jsonUpstream({ data: [{ id: 'hx' }] });
      if (u.pathname.includes('/hx/recent_media')) return jsonUpstream({ data: [{ id: 'ok1', caption: 'calisan', media_type: 'IMAGE', media_url: 'https://img/ok.jpg', timestamp: '2026-08-06T09:00:00Z' }] });
      if (u.pathname.includes('/media')) return jsonUpstream({ data: [] });
      return null;
    });
    assertEqual(status, 200, 'instagram kismi hata -> yine 200 (graceful degrade)');
    assertTrue(body?.errors?.length >= 1, 'instagram kismi hata -> errors dizisinde raporlandi');
    assertTrue(body?.items?.length >= 1, 'instagram kismi hata -> calisan kaynaktan icerik geldi');
  }
  {
    const { status, body } = await run('ig-post', '/api/social/instagram?league=super-lig', IG_ENV, null, 'POST');
    assertEqual(status, 405, 'POST /api/social/instagram -> 405');
    assertEqual(body?.error, 'method_not_allowed', 'instagram POST error code');
  }
  {
    // health endpoint instagram durumunu bildiriyor mu?
    const { body } = await run('health-ig', '/api/health', IG_ENV);
    assertEqual(body?.checks?.instagram, 'configured', 'health -> instagram configured');
    const { body: body2 } = await run('health-ig-off', '/api/health', ALL_SECRETS_ENV);
    assertEqual(body2?.checks?.instagram, 'not_configured', 'health -> instagram not_configured');
  }

  console.log('\n=== 13) Sportmonks include duzeltmeleri (regresyon) ===');
  {
    // BUG: /transfer-rumours yalnizca include=player aliyordu; fromTeam/toTeam
    // gelmediginden tum soylentilerde from/to "Aciklanmadi" oluyor ve lig
    // filtresi hic eslesmiyordu.
    let rumourInclude = null;
    const { body } = await run('rumour-include', '/api/football/transfers?league=super-lig', ALL_SECRETS_ENV, (u) => {
      if (u.pathname === '/v3/football/transfer-rumours') {
        rumourInclude = u.searchParams.get('include');
        return jsonUpstream({ data: [{ id: 9, league_id: 600, player: { display_name: 'Soylenti Oyuncu' },
          fromTeam: { name: 'Eski Kulup' }, toTeam: { name: 'Galatasaray' }, probability: 'guclu' }] });
      }
      if (u.pathname === '/v3/football/transfers/latest') return jsonUpstream({ data: [] });
      return null;
    });
    assertTrue(String(rumourInclude || '').includes('fromTeam') && String(rumourInclude || '').includes('toTeam'),
      'transfer-rumours include fromTeam;toTeam iceriyor', `include=${rumourInclude}`);
    assertEqual(body?.rumours?.[0]?.from, 'Eski Kulup', 'soylentide from alani doldu (onceden Aciklanmadi)');
    assertEqual(body?.rumours?.[0]?.to, 'Galatasaray', 'soylentide to alani doldu');
  }
  {
    // BUG: standings cagrisinda include=form yoktu; "SON 5" sutunu hep bostu.
    let standingsInclude = null;
    const { body } = await run('standings-form', '/api/football/season?league=super-lig', ALL_SECRETS_ENV, (u) => {
      if (u.pathname === '/v3/football/leagues/600') return jsonUpstream({ data: { id: 600, name: 'Super Lig', currentseason: { id: 77, is_current: true } } });
      if (u.pathname === '/v3/football/standings/seasons/77') {
        standingsInclude = u.searchParams.get('include');
        // include=form bir ILISKI dondurur (dizi) — duz string degil.
        return jsonUpstream({ data: [{ participant: { id: 1, name: 'Galatasaray' }, points: 90,
          form: { data: [ {sort_order:1, form:'W'}, {sort_order:2, form:'D'}, {sort_order:3, form:'L'}, {sort_order:4, form:'W'}, {sort_order:5, form:'W'} ] } }] });
      }
      if (u.pathname === '/v3/football/schedules/seasons/77') return jsonUpstream({ data: [] });
      return null;
    });
    assertTrue(String(standingsInclude || '').includes('form'), 'standings include form iceriyor', `include=${standingsInclude}`);
    assertEqual(body?.standings?.[0]?.form, 'WDLWW', 'form iliskisi W/D/L dizgisine cevrildi (dizi -> string)');
  }
  {
    // Duz string form da bozulmadan gecmeli (geriye donuk uyum).
    const { body } = await run('standings-form-string', '/api/football/season?league=la-liga', ALL_SECRETS_ENV, (u) => {
      if (u.pathname === '/v3/football/leagues/564') return jsonUpstream({ data: { id: 564, name: 'LaLiga', currentseason: { id: 88, is_current: true } } });
      if (u.pathname === '/v3/football/standings/seasons/88') return jsonUpstream({ data: [{ participant: { id: 2, name: 'Real Madrid' }, points: 80, form: 'WWDLW' }] });
      if (u.pathname === '/v3/football/schedules/seasons/88') return jsonUpstream({ data: [] });
      return null;
    });
    assertEqual(body?.standings?.[0]?.form, 'WWDLW', 'duz string form bozulmadan gecti');
  }
  {
    // Form hic gelmezse bos string olmali, "[object Object]" degil.
    const { body } = await run('standings-form-missing', '/api/football/season?league=premier-league', ALL_SECRETS_ENV, (u) => {
      if (u.pathname === '/v3/football/leagues/8') return jsonUpstream({ data: { id: 8, name: 'Premier League', currentseason: { id: 99, is_current: true } } });
      if (u.pathname === '/v3/football/standings/seasons/99') return jsonUpstream({ data: [{ participant: { id: 3, name: 'Arsenal' }, points: 70 }] });
      if (u.pathname === '/v3/football/schedules/seasons/99') return jsonUpstream({ data: [] });
      return null;
    });
    assertEqual(body?.standings?.[0]?.form, '', 'form yoksa bos string (object bozulmasi yok)');
  }

  console.log('\n=== ÖZET ===');
  console.log(`PASS: ${PASS}  FAIL: ${FAIL}`);
  if (failures.length) {
    console.log('\nBaşarısız kontroller:');
    failures.forEach((f) => console.log(' - ' + f));
    process.exitCode = 1;
  }
}

main();
