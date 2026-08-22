// XYZSKOR worker sertlestirme regresyonlari (2026-08-21).
// Kapsanan davranislar:
//  1) Saglayici JSON yerine HTML dondurdugunde bos veri yayinlanmaz, acik hata uretilir.
//  2) Secili lig kapsaminda olmayan fixture icin tahmin kaydedilemez (lig izolasyonu).
//  3) Istemciden gelen challenge_league fixture'in gercek ligiyle eslesmezse reddedilir.
//  4) Hata govdesinde api_token / access_token benzeri degerler maskelenir.
//  5) Transfer akisinda normalize edilen kayit lig kimligini korur ve lig filtresi calisir.
//  6) Kickoff kilidi status listesi mojibake degil, gercek "canlı" degerini yakalar.

import worker from '../worker/index.js';

let PASS = 0, FAIL = 0;
const failures = [];
const ok = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`OK   ${label}`); }
  else { FAIL++; failures.push(`${label}${detail ? ' -> ' + detail : ''}`); console.log(`FAIL ${label}${detail ? ' -> ' + detail : ''}`); }
};

const mockAssets = { fetch: async () => new Response('<html>shell</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }) };
const ctx = { waitUntil: () => {} };
const ENV = { ASSETS: mockAssets, SPORTMONKS_API_TOKEN: 'test-sportmonks-token', SUPABASE_URL: 'https://supabase.test', SUPABASE_ANON_KEY: 'anon-key', SUPABASE_SERVICE_ROLE_KEY: 'service-key' };

let SCENARIO = null;
global.fetch = async (url, init) => {
  const u = new URL(String(url));
  const handled = SCENARIO?.(u, init);
  if (handled) return handled;
  throw new Error('UNMOCKED FETCH: ' + u.toString());
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const html = (status = 200) => new Response('<!doctype html><html><body>Gateway</body></html>', { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

async function call(path, scenario, method = 'GET', body = null, headers = {}) {
  SCENARIO = scenario;
  const req = new Request('http://localhost' + path, { method, body: body ? JSON.stringify(body) : undefined, headers: { 'Content-Type': 'application/json', ...headers } });
  const res = await worker.fetch(req, ENV, ctx);
  let payload = null;
  try { payload = await res.clone().json(); } catch { payload = null; }
  return { status: res.status, payload };
}

const authUser = (u) => u.hostname === 'supabase.test' && u.pathname === '/auth/v1/user'
  ? json({ id: '00000000-0000-0000-0000-0000000000aa', email: 'test@test.local' })
  : null;

const fixtureRow = (leagueId, kickoffOffsetMs = 3 * 3600 * 1000) => ({
  data: {
    id: 12345, league_id: leagueId, season_id: 1, round_id: 7,
    league: { id: leagueId, name: 'Test Ligi' },
    starting_at: new Date(Date.now() + kickoffOffsetMs).toISOString(),
    venue: { name: 'Test Stadi' },
    participants: [
      { id: 1, name: 'Ev Takimi', meta: { location: 'home' } },
      { id: 2, name: 'Konuk Takimi', meta: { location: 'away' } },
    ],
    state: { state: 'NS' },
  },
});

async function main() {
  console.log('\n=== 1) Saglayici HTML dondurdugunde bos veri yayinlanmaz ===');
  {
    const { status, payload } = await call('/api/football/season?league=super-lig', (u) =>
      u.hostname === 'api.sportmonks.com' ? html(200) : null);
    ok(status >= 400, 'HTML yanit hata durumuna cevrilir (200 + bos veri degil)', `status=${status}`);
    ok(!(payload?.matches?.length), 'HTML yanit bos matches listesi olarak yayinlanmaz', JSON.stringify(payload).slice(0, 120));
  }
  {
    const { status, payload } = await call('/api/football/fixture?id=12345', (u) =>
      u.hostname === 'api.sportmonks.com' ? html(200) : null);
    ok(status >= 500 && payload?.error, 'fixture ucunda HTML yanit hata dondurur', `status=${status} error=${payload?.error}`);
  }

  console.log('\n=== 2) Lig izolasyonu: kapsam disi fixture reddedilir ===');
  {
    // 271 = Superliga (Danimarka) — secili lig kumesinde yok.
    const { status, payload } = await call('/api/football/prediction', (u) =>
      authUser(u) || (u.hostname === 'api.sportmonks.com' ? json(fixtureRow(271)) : null),
      'POST', { fixture_id: '12345', pick: '1' }, { Authorization: 'Bearer test' });
    ok(status === 400 && payload?.error === 'fixture_out_of_scope', 'kapsam disi lig 400 fixture_out_of_scope', `status=${status} body=${JSON.stringify(payload)}`);
  }
  {
    const { status, payload } = await call('/api/football/prediction', (u) =>
      authUser(u) || (u.hostname === 'api.sportmonks.com' ? json(fixtureRow(600)) : null)
      || (u.hostname === 'supabase.test' ? json([{ match_id: 'sportmonks:12345', pick: '1' }]) : null),
      'POST', { fixture_id: '12345', pick: '1' }, { Authorization: 'Bearer test' });
    ok(status === 200, 'kapsam icindeki lig (600 Super Lig) kabul edilir', `status=${status} body=${JSON.stringify(payload)}`);
  }

  console.log('\n=== 3) challenge_league capraz dogrulamasi ===');
  {
    const { status, payload } = await call('/api/football/prediction', (u) =>
      authUser(u) || (u.hostname === 'api.sportmonks.com' ? json(fixtureRow(600)) : null),
      'POST', { fixture_id: '12345', pick: '1', challenge_league: 'la-liga' }, { Authorization: 'Bearer test' });
    ok(status === 400 && payload?.error === 'challenge_league_mismatch', 'yanlis challenge_league reddedilir', `status=${status} body=${JSON.stringify(payload)}`);
  }

  console.log('\n=== 4) Hata govdesinde token maskelenir ===');
  {
    const { payload } = await call('/api/football/fixture?id=12345', (u) =>
      u.hostname === 'api.sportmonks.com'
        ? json({ message: 'Unauthorized for https://api.sportmonks.com/v3/football/fixtures/12345?api_token=SUPERSECRETTOKEN123' }, 500)
        : null);
    const text = JSON.stringify(payload || {});
    ok(!text.includes('SUPERSECRETTOKEN123'), 'fixture ucunda api_token sizmaz', text.slice(0, 200));
  }
  {
    // transfers ucu saglayici mesajini errors[] icinde 200 ile yayinliyor; burada maskeleme gorunur olmali.
    const { payload } = await call('/api/football/transfers?league=premier-league', (u) =>
      u.hostname === 'api.sportmonks.com'
        ? json({ message: 'Forbidden: api_token=SUPERSECRETTOKEN123 plan limit' }, 403)
        : null);
    const text = JSON.stringify(payload?.errors || []);
    ok(!text.includes('SUPERSECRETTOKEN123'), 'transfers errors[] icinde token sizmaz', text.slice(0, 200));
    ok(text.includes('REDACTED'), 'maskeleme etiketi eklenir', text.slice(0, 200));
  }

  console.log('\n=== 5) Transfer akisinda lig filtresi calisir ===');
  {
    const { payload } = await call('/api/football/transfers?league=super-lig', (u) => {
      if (u.hostname !== 'api.sportmonks.com') return null;
      if (u.pathname === '/v3/football/transfers/latest') {
        return json({ data: [
          { id: 1, league_id: 600, player: { display_name: 'Yerli Oyuncu' }, fromTeam: { name: 'Kasimpasa' }, toTeam: { name: 'Galatasaray' } },
          { id: 2, league_id: 384, player: { display_name: 'Yabanci Oyuncu' }, fromTeam: { name: 'Milan' }, toTeam: { name: 'Inter' } },
        ] });
      }
      return json({ data: [] });
    });
    const ids = (payload?.confirmed || []).map((row) => row.id);
    ok(ids.includes('1'), 'secili ligin transferi listelenir', JSON.stringify(ids));
    ok(!ids.includes('2'), 'baska ligin transferi (Serie A 384) filtrelenir', JSON.stringify(ids));
    ok((payload?.confirmed || []).every((row) => row.provider_league_id), 'normalize edilen kayit lig kimligini tasir');
  }

  console.log('\n=== 6) Kickoff kilidi mojibake degil ===');
  {
    const source = await (await import('node:fs/promises')).readFile(new URL('../worker/index.js', import.meta.url), 'utf8');
    ok(!source.includes('canlÄ±'), 'worker icinde mojibake status degeri kalmadi');
    ok(/"iptal", "ertelendi", "bitti", "canlı", "devre_arasi"/.test(source), 'kickoff kilidi gercek "canlı" degerini iceriyor');
  }
  {
    const { status, payload } = await call('/api/football/prediction', (u) =>
      authUser(u) || (u.hostname === 'api.sportmonks.com'
        ? json({ ...fixtureRow(600, 60 * 60 * 1000), data: { ...fixtureRow(600, 60 * 60 * 1000).data, state: { state: '1H', minute: 12 } } })
        : null),
      'POST', { fixture_id: '12345', pick: '1' }, { Authorization: 'Bearer test' });
    ok(status === 409 && payload?.error === 'prediction_closed', 'canli mac icin tahmin kapali', `status=${status} body=${JSON.stringify(payload)}`);
  }

  console.log('\n=== 7) Kullanımdan kaldırılan branş ve eski gündem rotaları ===');
  {
    const response = await worker.fetch(new Request('http://localhost/kayak/'), ENV, ctx);
    ok(response.status === 308 && response.headers.get('location') === 'http://localhost/', 'verisiz branş ana ürüne yönlenir');
  }
  {
    const response = await worker.fetch(new Request('http://localhost/amerikan-futbolu/ligler'), ENV, ctx);
    ok(response.status === 308 && response.headers.get('location') === 'http://localhost/', 'Amerikan Futbolu boş sayfa bırakmaz');
  }
  {
    const response = await worker.fetch(new Request('http://localhost/super-lig/news'), ENV, ctx);
    ok(response.status === 308 && response.headers.get('location') === 'http://localhost/super-lig/agenda', 'eski news adresi kanonik gündeme yönlenir');
  }
  {
    const source = await (await import('node:fs/promises')).readFile(new URL('../worker/index.js', import.meta.url), 'utf8');
    ok(source.includes('({ ...item, sport, provider:'), 'çoklu spor cache kaydı koleksiyon branşıyla zorla izole edilir');
    ok(source.includes('/api/sports/today-v9?date='), 'kirli eski çoklu spor cache anahtarı geçersizleştirildi');
  }

  console.log(`\n=== OZET === PASS: ${PASS}  FAIL: ${FAIL}`);
  if (failures.length) { console.log(failures.map((f) => ' - ' + f).join('\n')); process.exit(1); }
}

main().catch((error) => { console.error(error); process.exit(1); });
