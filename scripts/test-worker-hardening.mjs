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
const ENV = { ASSETS: mockAssets, SPORTMONKS_API_TOKEN: 'test-sportmonks-token', API_SPORTS_KEY: 'api-sports-key', SUPABASE_URL: 'https://supabase.test', SUPABASE_ANON_KEY: 'anon-key', SUPABASE_SERVICE_ROLE_KEY: 'service-key' };

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
    ok((payload?.errors || []).every((row) => /^provider_/.test(row.code || '') && !('message' in row)), 'public hata kaydi yalniz makinece okunabilir genel kod tasir', text.slice(0, 200));
  }

  console.log('\n=== 5) Transfer akisinda lig filtresi calisir ===');
  {
    const { payload } = await call('/api/football/transfers?league=super-lig', (u) => {
      if (u.hostname !== 'api.sportmonks.com') return null;
      if (/^\/v3\/football\/transfers\/between\/\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/.test(u.pathname)) {
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
    ok(source.includes('/api/sports/today-v12?date='), 'demand-scope çoklu spor cache anahtarı sürümlendi');
    ok(!source.includes('Promise.all([0, -1, -2, -3, -7]'), 'today endpointi görünmeyen geçmiş günleri toplu sorgulamaz');
  }

  console.log('\n=== 8) Çoklu spor API fail-closed branş sözleşmesi ===');
  {
    const { status, payload } = await call('/api/sports/today', () => null);
    ok(status === 400 && payload?.error === 'sport_required', 'sport parametresi olmadan birleşik branş yanıtı verilmez');
  }
  {
    const { status, payload } = await call('/api/sports/today?sport=football', () => null);
    ok(status === 400 && payload?.error === 'invalid_sport', 'futbol çoklu-spor endpointine sokulmaz');
  }
  {
    const upstreamHosts = new Set();
    let upstreamCalls = 0;
    let requestedDate = null;
    const { status, payload } = await call('/api/sports/today?sport=basketball', (u) => {
      // Supabase ortak cache/lease kontrol duzlemidir; provider kota sayimina
      // yalniz API-Sports veri hostlari dahildir.
      if (u.hostname === 'supabase.test') return null;
      if(u.hostname !== 'v1.basketball.api-sports.io') throw new Error('cross_branch_upstream:' + u.hostname);
      upstreamHosts.add(u.hostname);
      upstreamCalls += 1;
      requestedDate = u.searchParams.get('date');
      return json({ response:[{ id:7, teams:{ home:{ name:'Anadolu Efes' }, away:{ name:'Fenerbahçe Beko' } }, league:{ name:'Basketbol Süper Ligi' }, status:{ long:'Scheduled' } }] });
    });
    ok(status === 200, 'basketbol branş isteği başarılı');
    ok(JSON.stringify(Object.keys(payload?.sports||{})) === JSON.stringify(['basketball']), 'API yanıtı yalnız basketball anahtarını taşır', JSON.stringify(payload?.sports));
    ok([...upstreamHosts].every((host)=>host === 'v1.basketball.api-sports.io'), 'basketbol isteği yalnız basketbol sağlayıcısına gider', [...upstreamHosts].join(','));
    ok(upstreamCalls === 1 && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate || ''), 'today isteği yalnız bugün için tek upstream çağrı yapar', `calls=${upstreamCalls} date=${requestedDate}`);
    ok((payload?.sports?.basketball||[]).every((item)=>item.sport === 'basketball'), 'yanıttaki her kayıt zorunlu basketball etiketi taşır');
  }

  console.log('\n=== 9) BranÅŸ DOM izolasyonu ===');
  {
    const source = await (await import('node:fs/promises')).readFile(new URL('../assets/js/multisport.js', import.meta.url), 'utf8');
    ok(source.includes("['page-story','page-live','footballContextNav','footballLeagueCommand','matchdayCommand']"), 'Ã§oklu spor rotasÄ± futbol yÃ¼zeyini DOM\'dan kaldÄ±rÄ±r');
    ok(source.includes("'.next-match-ticker,.live-ticker'"), 'Ã§oklu spor rotasÄ± futbol ticker kapsayÄ±cÄ±sÄ±nÄ± DOM\'dan kaldÄ±rÄ±r');
    ok(source.includes('updateBranchTicker([]);'), 'branÅŸ verisi gelmeden futbol ticker\'Ä± temizlenir');
    ok(source.includes('requestEpoch !== hubRequestEpoch || activeSport !== requestedSport || activeView !== requestedView'), 'geÃ§ dÃ¶nen eski branÅŸ yanÄ±tÄ± yeni ekranÄ± yeniden Ã§izemez');
  }

  console.log('\n=== 10) Bes lig kompakt home endpointi ===');
  {
    let leagueLookups = 0;
    const { status, payload } = await call('/api/football/home', (u) => {
      if(u.hostname !== 'api.sportmonks.com') return null;
      const leagueMatch = u.pathname.match(/\/v3\/football\/leagues\/(\d+)$/);
      if(leagueMatch){
        leagueLookups += 1;
        const id = leagueMatch[1];
        return json({ data:{ id, name:`League ${id}`, currentSeason:{ id:`season-${id}` } } });
      }
      if(u.pathname.includes('/v3/football/standings/seasons/')) return json({ data:[] });
      if(u.pathname.includes('/v3/football/schedules/seasons/')) return json({ data:[] });
      return null;
    });
    ok(status === 200 && payload?.league === 'all', 'home endpointi tek aggregate sozlesme dondurur', `status=${status}`);
    ok(leagueLookups === 5, 'edge katmani bes ligi paralel ve tam birer kez cozer', `lookups=${leagueLookups}`);
    ok(Object.keys(payload?.availability||{}).length === 5 && Object.values(payload.availability).every(Boolean), 'home yaniti bes lig icin ayri availability tasir', JSON.stringify(payload?.availability));
    ok(Array.isArray(payload?.errors) && payload.errors.length === 0, 'basarili bes lig yanitinda hata siniri temizdir', JSON.stringify(payload?.errors));
  }

  console.log('\n=== 11) Provider kota single-flight ve kalici cache ===');
  {
    const quotaEnv = { ...ENV };
    delete quotaEnv.SUPABASE_SERVICE_ROLE_KEY;
    let providerCalls = 0;
    SCENARIO = async (u) => {
      if(u.hostname !== 'api.sportmonks.com') return null;
      providerCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 12));
      const leagueMatch = u.pathname.match(/\/v3\/football\/leagues\/(\d+)$/);
      if(leagueMatch) return json({ data:{ id:leagueMatch[1], name:`League ${leagueMatch[1]}`, currentSeason:{ id:`season-${leagueMatch[1]}` } } });
      if(u.pathname.includes('/v3/football/standings/seasons/')) return json({ data:[] });
      if(u.pathname.includes('/v3/football/schedules/seasons/')) return json({ data:[] });
      throw new Error('unexpected_provider_path:' + u.pathname);
    };
    const responses = await Promise.all(Array.from({ length:12 }, () => worker.fetch(new Request('http://localhost/api/football/season?league=serie-a'), quotaEnv, ctx)));
    ok(responses.every((response) => response.status === 200), 'ayni lig icin eszamanli season istekleri basarili', responses.map((response)=>response.status).join(','));
    ok(providerCalls === 3, '12 eszamanli season istegi tek provider zincirini paylasir', `calls=${providerCalls}`);
  }
  {
    const quotaEnv = { ...ENV };
    delete quotaEnv.SUPABASE_SERVICE_ROLE_KEY;
    let providerCalls = 0;
    SCENARIO = async (u) => {
      if(u.hostname !== 'api.sportmonks.com') return null;
      providerCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 12));
      const leagueMatch = u.pathname.match(/\/v3\/football\/leagues\/(\d+)$/);
      if(leagueMatch) return json({ data:{ id:leagueMatch[1], name:`League ${leagueMatch[1]}`, currentSeason:{ id:`season-${leagueMatch[1]}` } } });
      if(u.pathname.includes('/v3/football/standings/seasons/')) return json({ data:[] });
      if(u.pathname.includes('/v3/football/schedules/seasons/')) return json({ data:[] });
      throw new Error('unexpected_provider_path:' + u.pathname);
    };
    const responses = await Promise.all(Array.from({ length:10 }, () => worker.fetch(new Request('http://localhost/api/football/home'), quotaEnv, ctx)));
    ok(responses.every((response) => response.status === 200), 'eszamanli home istekleri basarili', responses.map((response)=>response.status).join(','));
    ok(providerCalls === 15, '10 eszamanli home istegi bes liglik zinciri yalniz bir kez calistirir', `calls=${providerCalls}`);
  }
  {
    let storedSharedRow = null;
    let providerCalls = 0;
    SCENARIO = async (u, init = {}) => {
      if(u.hostname === 'supabase.test' && u.pathname === '/rest/v1/live_feed_cache') {
        if(String(init.method || 'GET').toUpperCase() === 'POST') {
          const body = JSON.parse(String(init.body || '{}'));
          storedSharedRow = { payload:body.payload, fetched_at:body.fetched_at, expires_at:body.expires_at };
          return json([]);
        }
        return json(storedSharedRow ? [storedSharedRow] : []);
      }
      if(u.hostname === 'supabase.test' && u.pathname === '/rest/v1/rpc/try_acquire_sync_lock') return json(true);
      if(u.hostname === 'api.sportmonks.com') {
        providerCalls += 1;
        const leagueMatch = u.pathname.match(/\/v3\/football\/leagues\/(\d+)$/);
        if(leagueMatch) return json({ data:{ id:leagueMatch[1], name:'Premier League', currentSeason:{ id:'season-8' } } });
        if(u.pathname.includes('/v3/football/standings/seasons/')) return json({ data:[] });
        if(u.pathname.includes('/v3/football/schedules/seasons/')) return json({ data:[] });
      }
      throw new Error('unexpected_shared_cache_path:' + u.toString());
    };
    const first = await worker.fetch(new Request('http://localhost/api/football/season?league=premier-league'), ENV, ctx);
    const second = await worker.fetch(new Request('http://localhost/api/football/season?league=premier-league'), ENV, ctx);
    ok(first.status === 200 && second.status === 200, 'kalici season snapshot ardisik isteklerde kullanilir', `${first.status}/${second.status}`);
    ok(providerCalls === 3 && second.headers.get('x-data-cache') === 'shared-cache', 'ikinci isolate-benzeri cache miss provider yerine live_feed_cache okur', `calls=${providerCalls} cache=${second.headers.get('x-data-cache')}`);
  }

  console.log('\n=== 12) Gorunen bransta demand single-flight ve paylasilan lease ===');
  {
    const quotaEnv = { ...ENV };
    delete quotaEnv.SUPABASE_SERVICE_ROLE_KEY;
    let upstreamCalls = 0;
    SCENARIO = async (u) => {
      if (u.hostname !== 'v1.basketball.api-sports.io') throw new Error('unexpected_multisport_host:' + u.hostname);
      upstreamCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return json({ response:[{ id:701, teams:{ home:{ name:'A' }, away:{ name:'B' } }, league:{ name:'BSL' }, status:{ long:'Scheduled' } }] });
    };
    const responses = await Promise.all(Array.from({ length:20 }, () => worker.fetch(
      new Request('http://localhost/api/sports/today?sport=basketball'), quotaEnv, ctx
    )));
    ok(responses.every((response) => response.status === 200), '20 paralel ayni basketbol kapsami basarili', responses.map((response) => response.status).join(','));
    ok(upstreamCalls === 1, '20 paralel ayni sport+date yalniz bir upstream cagirir', `calls=${upstreamCalls}`);
  }
  {
    const quotaEnv = { ...ENV };
    delete quotaEnv.SUPABASE_SERVICE_ROLE_KEY;
    const calls = { basketball:0, volleyball:0 };
    SCENARIO = async (u) => {
      const sport = u.hostname.startsWith('v1.basketball.') ? 'basketball'
        : u.hostname.startsWith('v1.volleyball.') ? 'volleyball'
          : null;
      if (!sport) throw new Error('unexpected_multisport_host:' + u.hostname);
      calls[sport] += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return json({ response:[{ id:sport === 'basketball' ? 702 : 703, teams:{ home:{ name:'A' }, away:{ name:'B' } }, league:{ name:sport }, status:{ long:'Scheduled' } }] });
    };
    const paths = [
      ...Array.from({ length:10 }, () => '/api/sports/today?sport=basketball'),
      ...Array.from({ length:10 }, () => '/api/sports/today?sport=volleyball'),
    ];
    const responses = await Promise.all(paths.map((path) => worker.fetch(new Request('http://localhost' + path), quotaEnv, ctx)));
    const payloads = await Promise.all(responses.map((response) => response.json()));
    ok(calls.basketball === 1 && calls.volleyball === 1, 'basketbol ve voleybol bagimsiz keyed single-flight kullanir', JSON.stringify(calls));
    ok(payloads.slice(0, 10).every((payload) => Object.keys(payload.sports || {}).join() === 'basketball')
      && payloads.slice(10).every((payload) => Object.keys(payload.sports || {}).join() === 'volleyball'),
    'farkli bransta payload izolasyonu korunur');
  }
  {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Istanbul', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
    const sharedPayload = {
      source:'api-sports-free', date, updatedAt:new Date().toISOString(),
      sports:{ basketball:[{ id:704, sport:'basketball', provider:'api-sports' }] },
      coverage:{ basketball:1 },
    };
    const sharedRow = {
      payload:{ version:1, identity:`basketball:${date}`, value:sharedPayload },
      fetched_at:new Date().toISOString(),
      expires_at:new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
    let sharedReads = 0;
    let upstreamCalls = 0;
    SCENARIO = async (u) => {
      if (u.hostname === 'supabase.test' && u.pathname === '/rest/v1/live_feed_cache') {
        sharedReads += 1;
        return json(sharedReads === 1 ? [] : [sharedRow]);
      }
      if (u.hostname === 'supabase.test' && u.pathname === '/rest/v1/rpc/try_acquire_sync_lock') return json(false);
      if (u.hostname.endsWith('.api-sports.io')) { upstreamCalls += 1; return json({ response:[] }); }
      throw new Error('unexpected_locked_demand_path:' + u.toString());
    };
    const response = await worker.fetch(new Request('http://localhost/api/sports/today?sport=basketball'), ENV, ctx);
    const payload = await response.clone().json();
    ok(response.status === 200 && response.headers.get('x-data-cache') === 'shared-cache-locked', 'baska isolate lock sahibiyken yazilan ortak cache sunulur', `status=${response.status} cache=${response.headers.get('x-data-cache')}`);
    ok(upstreamCalls === 0 && payload?.sports?.basketball?.[0]?.id === 704, 'lock kaybeden isolate ikinci upstream acmaz', `calls=${upstreamCalls}`);
  }
  {
    let storedSharedRow = null;
    let upstreamCalls = 0;
    let lockCalls = 0;
    SCENARIO = async (u, init = {}) => {
      if (u.hostname === 'supabase.test' && u.pathname === '/rest/v1/live_feed_cache') {
        if (String(init.method || 'GET').toUpperCase() === 'POST') {
          const body = JSON.parse(String(init.body || '{}'));
          storedSharedRow = { payload:body.payload, fetched_at:body.fetched_at, expires_at:body.expires_at };
          return json([]);
        }
        return json(storedSharedRow ? [storedSharedRow] : []);
      }
      if (u.hostname === 'supabase.test' && u.pathname === '/rest/v1/rpc/try_acquire_sync_lock') {
        lockCalls += 1;
        return json(true);
      }
      if (u.hostname === 'supabase.test' && u.pathname === '/rest/v1/sync_locks') return json([]);
      if (u.hostname === 'v1.basketball.api-sports.io') {
        upstreamCalls += 1;
        return json({ response:[{ id:705, teams:{ home:{ name:'A' }, away:{ name:'B' } }, league:{ name:'BSL' }, status:{ long:'Scheduled' } }] });
      }
      throw new Error('unexpected_demand_holder_path:' + u.toString());
    };
    const first = await worker.fetch(new Request('http://localhost/api/sports/today?sport=basketball'), ENV, ctx);
    const second = await worker.fetch(new Request('http://localhost/api/sports/today?sport=basketball'), ENV, ctx);
    ok(first.status === 200 && second.status === 200, 'lease sahibi ortak cache yazdiktan sonra ardil istek basarili');
    ok(upstreamCalls === 1 && lockCalls === 1 && second.headers.get('x-data-cache') === 'shared-cache',
      'holder yolu tek upstream yapar; sonraki isolate ortak cache okur', `upstream=${upstreamCalls} locks=${lockCalls} cache=${second.headers.get('x-data-cache')}`);
  }
  {
    let upstreamCalls = 0;
    SCENARIO = async (u) => {
      if (u.hostname === 'supabase.test' && u.pathname === '/rest/v1/live_feed_cache') return json([]);
      if (u.hostname === 'supabase.test' && u.pathname === '/rest/v1/rpc/try_acquire_sync_lock') return json(false);
      if (u.hostname.endsWith('.api-sports.io')) { upstreamCalls += 1; return json({ response:[] }); }
      throw new Error('unexpected_locked_empty_demand_path:' + u.toString());
    };
    const response = await worker.fetch(new Request('http://localhost/api/sports/today?sport=volleyball'), ENV, ctx);
    const payload = await response.json();
    ok(response.status === 503 && payload?.error === 'provider_refresh_in_progress', 'lock sahibi henuz cache yazmadiysa acik sync-in-progress doner');
    ok(upstreamCalls === 0, 'lock kaybeden ve cache bulamayan isolate yine upstream acmaz', `calls=${upstreamCalls}`);
  }
  {
    const quotaEnv = { ...ENV };
    delete quotaEnv.SUPABASE_SERVICE_ROLE_KEY;
    const cases = [
      { label:'4xx', expected:502, response:() => json({ message:'Bad Request' }, 400) },
      { label:'429', expected:429, response:() => json({ message:'Rate limit' }, 429, { 'Retry-After':'45' }) },
      { label:'HTML', expected:502, response:() => html(200) },
      { label:'timeout', expected:502, response:() => { throw new DOMException('aborted', 'AbortError'); } },
    ];
    for (const testCase of cases) {
      SCENARIO = async (u) => {
        if (u.hostname === 'v1.basketball.api-sports.io') return testCase.response();
        throw new Error('unexpected_multisport_failure_host:' + u.hostname);
      };
      const response = await worker.fetch(new Request('http://localhost/api/sports/today?sport=basketball'), quotaEnv, ctx);
      const payload = await response.json();
      ok(response.status === testCase.expected, `${testCase.label} + latest cache yok -> acik ${testCase.expected}`, `status=${response.status}`);
      ok(!payload?.sports, `${testCase.label} provider hatasi bos sports:[] 200 olarak maskelenmez`, JSON.stringify(payload));
    }
  }
  {
    let sharedCacheWrites = 0;
    SCENARIO = async (u, init = {}) => {
      const method = String(init.method || 'GET').toUpperCase();
      if (u.hostname === 'supabase.test' && u.pathname === '/rest/v1/live_feed_cache') {
        if (method === 'POST') sharedCacheWrites += 1;
        return json([]);
      }
      if (u.hostname === 'supabase.test' && u.pathname === '/rest/v1/rpc/try_acquire_sync_lock') return json(true);
      if (u.hostname === 'supabase.test' && u.pathname === '/rest/v1/sync_locks') return json([]);
      if (u.hostname === 'v1.volleyball.api-sports.io') return json({ message:'provider down' }, 500);
      throw new Error('unexpected_multisport_500_path:' + u.toString());
    };
    const response = await worker.fetch(new Request('http://localhost/api/sports/today?sport=volleyball'), ENV, ctx);
    const payload = await response.json();
    ok(response.status === 502 && payload?.error === 'api_sports_upstream_unavailable', '5xx + latest/shared cache yok -> 502');
    ok(sharedCacheWrites === 0, 'provider 5xx bos basari payloadi olarak persistent cachee yazilmaz', `writes=${sharedCacheWrites}`);
  }
  {
    let sharedCacheWrites = 0;
    SCENARIO = async (u, init = {}) => {
      const method = String(init.method || 'GET').toUpperCase();
      if (u.hostname === 'supabase.test' && u.pathname === '/rest/v1/live_feed_cache') {
        if (method === 'POST') sharedCacheWrites += 1;
        return json([]);
      }
      if (u.hostname === 'supabase.test' && u.pathname === '/rest/v1/rpc/try_acquire_sync_lock') return json(true);
      if (u.hostname === 'supabase.test' && u.pathname === '/rest/v1/sync_locks') return json([]);
      if (u.hostname === 'v1.volleyball.api-sports.io') return json({ errors:{}, response:[] });
      throw new Error('unexpected_multisport_empty_path:' + u.toString());
    };
    const response = await worker.fetch(new Request('http://localhost/api/sports/today?sport=volleyball'), ENV, ctx);
    const payload = await response.json();
    ok(response.status === 200 && Array.isArray(payload?.sports?.volleyball) && payload.sports.volleyball.length === 0,
      'dogrulanmis 2xx JSON response=[] gercek bos sonuc olarak kabul edilir');
    ok(sharedCacheWrites === 1, 'yalniz dogrulanmis bos provider cevabi persistent cachee yazilabilir', `writes=${sharedCacheWrites}`);
  }
  {
    const quotaEnv = { ...ENV, CITO_API_KEY:'cito-key', OCBLACKTOP_API_KEY:'blacktop-key' };
    delete quotaEnv.SUPABASE_SERVICE_ROLE_KEY;
    const calls = { ufc:0, motorsports:0 };
    SCENARIO = async (u) => {
      if (u.hostname === 'api.citoapi.com') {
        calls.ufc += 1;
        await new Promise((resolve) => setTimeout(resolve, 15));
        return json({ events:[{ id:'ufc-1' }] });
      }
      if (u.hostname === 'api.ocblacktop.com') {
        calls.motorsports += 1;
        await new Promise((resolve) => setTimeout(resolve, 15));
        return json({ drivers:[{ id:'driver-1' }] });
      }
      throw new Error('unexpected_optional_demand_host:' + u.hostname);
    };
    const responses = await Promise.all([
      ...Array.from({ length:10 }, () => worker.fetch(new Request('http://localhost/api/ufc?resource=upcoming'), quotaEnv, ctx)),
      ...Array.from({ length:10 }, () => worker.fetch(new Request('http://localhost/api/motorsports?sport=formula-1&resource=drivers'), quotaEnv, ctx)),
    ]);
    ok(responses.every((response) => response.status === 200), 'UFC upcoming ve motorspor proxy paralel cold-miss yanitlari basarili');
    ok(calls.ufc === 1 && calls.motorsports === 1, 'UFC ve motorspor cold-missleri de scope basina tek upstream kullanir', JSON.stringify(calls));
  }
  {
    const quotaEnv = { ...ENV, CITO_API_KEY:'cito-key', OCBLACKTOP_API_KEY:'blacktop-key' };
    delete quotaEnv.SUPABASE_SERVICE_ROLE_KEY;
    SCENARIO = async (u) => {
      if (u.hostname === 'api.citoapi.com') return json({ success:false, error:'provider_quota_exhausted' });
      throw new Error('unexpected_ufc_application_error_path:' + u.toString());
    };
    const response = await worker.fetch(new Request('http://localhost/api/ufc/events/upcoming'), quotaEnv, ctx);
    ok(response.status === 502, 'UFC HTTP 200 uygulama hatasi bos basari olarak cachelenmez', `status=${response.status}`);
  }
  {
    const quotaEnv = { ...ENV, CITO_API_KEY:'cito-key', OCBLACKTOP_API_KEY:'blacktop-key' };
    delete quotaEnv.SUPABASE_SERVICE_ROLE_KEY;
    SCENARIO = async (u) => {
      if (u.hostname === 'api.ocblacktop.com') return json({ success:false, error:'provider_quota_exhausted' });
      throw new Error('unexpected_motorsport_application_error_path:' + u.toString());
    };
    const response = await worker.fetch(new Request('http://localhost/api/motorsports?sport=formula-e&resource=drivers'), quotaEnv, ctx);
    ok(response.status === 502, 'Motor sporları HTTP 200 uygulama hatasi bos basari olarak cachelenmez', `status=${response.status}`);
  }
  {
    const quotaEnv = { ...ENV, CITO_API_KEY:'cito-key', OCBLACKTOP_API_KEY:'blacktop-key' };
    delete quotaEnv.SUPABASE_SERVICE_ROLE_KEY;
    let calls = 0;
    SCENARIO = async (u) => {
      if (u.hostname !== 'api.citoapi.com') throw new Error('unexpected_ufc_schema_path:' + u.toString());
      calls += 1;
      return calls === 1 ? json({ unexpected:true }) : json({ success:true, data:[{ id:'ufc-recovered' }] });
    };
    const first = await worker.fetch(new Request('http://localhost/api/ufc/events/recent?limit=37'), quotaEnv, ctx);
    const second = await worker.fetch(new Request('http://localhost/api/ufc/events/recent?limit=37'), quotaEnv, ctx);
    ok(first.status === 502, 'UFC tanimsiz 2xx semasi bos basari yerine 502 olur', `status=${first.status}`);
    ok(second.status === 200 && calls === 2, 'UFC bozuk semasi cachelenmez; sonraki gecerli yanit iyilesir', `status=${second.status} calls=${calls}`);
  }
  {
    const quotaEnv = { ...ENV, CITO_API_KEY:'cito-key' };
    delete quotaEnv.SUPABASE_SERVICE_ROLE_KEY;
    SCENARIO = async (u) => {
      if (u.hostname === 'api.citoapi.com') {
        return json({ success:true, data:{ strikingAccuracy:55, sigStrikeDefense:61, takedownAccuracy:44 } });
      }
      throw new Error('unexpected_ufc_stats_schema_path:' + u.toString());
    };
    const response = await worker.fetch(new Request('http://localhost/api/ufc/fighters/schema-test/stats'), quotaEnv, ctx);
    const payload = await response.json();
    ok(response.status === 200 && payload?.data?.data?.strikingAccuracy === 55,
      'UFC dogrudan sporcu istatistik semasi gecerli provider verisi olarak korunur', `status=${response.status}`);
  }
  {
    const quotaEnv = { ...ENV, CITO_API_KEY:'cito-key', OCBLACKTOP_API_KEY:'blacktop-key' };
    delete quotaEnv.SUPABASE_SERVICE_ROLE_KEY;
    let calls = 0;
    SCENARIO = async (u) => {
      if (u.hostname !== 'api.ocblacktop.com') throw new Error('unexpected_motorsport_schema_path:' + u.toString());
      calls += 1;
      return calls === 1 ? json({ unexpected:true }) : json({ teams:[{ id:'team-recovered' }] });
    };
    const first = await worker.fetch(new Request('http://localhost/api/motorsports?sport=formula-e&resource=teams&season=2099'), quotaEnv, ctx);
    const second = await worker.fetch(new Request('http://localhost/api/motorsports?sport=formula-e&resource=teams&season=2099'), quotaEnv, ctx);
    ok(first.status === 502, 'Motor sporlari tanimsiz 2xx semasi bos basari yerine 502 olur', `status=${first.status}`);
    ok(second.status === 200 && calls === 2, 'Motor sporlari bozuk semasi cachelenmez; sonraki gecerli yanit iyilesir', `status=${second.status} calls=${calls}`);
  }

  console.log('\n=== 12b) Basketbol standings scope ve normalize sozlesmesi ===');
  {
    const quotaEnv = { ...ENV };
    delete quotaEnv.SUPABASE_SERVICE_ROLE_KEY;
    SCENARIO = async (u) => {
      if (u.hostname !== 'v1.basketball.api-sports.io' || u.pathname !== '/games') throw new Error('unexpected_basketball_discovery_path:' + u.toString());
      const leagues = [
        { id:12, name:'Basketbol Super Ligi', season:'2026-2027' },
        { id:13, name:'Schema Test Ligi', season:'2026' },
        { id:14, name:'Bos Sonuc Ligi', season:'2026' },
      ];
      return json({ errors:{}, response:leagues.map((league,index)=>({
        id:900+index, league, country:{name:'Test'}, date:new Date().toISOString(), time:'20:00',
        status:{long:'Not Started'}, teams:{home:{name:`Home ${index}`},away:{name:`Away ${index}`}}, scores:{home:null,away:null},
      })) });
    };
    const discovery = await worker.fetch(new Request('http://localhost/api/sports/today?sport=basketball'), quotaEnv, ctx);
    const discoveryPayload = await discovery.clone().json();
    const discoveredItems = discoveryPayload?.sports?.basketball || [];
    const standingsProof = discoveredItems.find((item) => String(item?.leagueId) === '12' && item?.season === '2026-2027')?.standingsProof;
    ok(discovery.status === 200, 'standings scope once bugunun dogrulanmis basketbol feedinden kesfedilir', `status=${discovery.status}`);
    ok(discoveredItems.length === 3 && discoveredItems.every((item) => /^bsp1\.\d{4}-\d{2}-\d{2}\.\d{1,10}\.\d{4}(?:-\d{4})?\.[A-Za-z0-9_-]{43}$/.test(item?.standingsProof || '')),
      'today yaniti her gercek basketbol lig+sezon scopeunu surumlu standings proof ile tasir', JSON.stringify(discoveredItems));
    ok(!JSON.stringify(discoveryPayload).includes(quotaEnv.API_SPORTS_KEY) && !String(standingsProof || '').includes(quotaEnv.API_SPORTS_KEY),
      'HMAC proof API-Sports secretini acik veya payload icinde sizdirmaz');

    let upstreamCalls = 0;
    SCENARIO = async (u) => {
      if (u.hostname !== 'v1.basketball.api-sports.io' || u.pathname !== '/standings') throw new Error('unexpected_basketball_standings_path:' + u.toString());
      upstreamCalls += 1;
      ok(u.searchParams.get('league') === '12' && u.searchParams.get('season') === '2026-2027', 'standings upstream yalniz dogrulanmis lig+sezon scope kullanir', u.search);
      return json({ errors:{}, response:[[
        { position:1, group:{name:'Grup A'}, team:{id:1,name:'A1'}, games:{played:3,win:{total:2,percentage:'66.67'},lose:{total:1}}, points:{for:240,against:210}, form:'WWL' },
        { position:2, group:{name:'Grup A'}, team:{id:2,name:'A2'}, games:{played:3,win:{total:2,percentage:'66.67%'},lose:{total:1}}, points:{for:232,against:214}, form:'WLW' },
      ],[
        { position:1, group:{name:'Grup B'}, team:{id:3,name:'B1'}, games:{played:3,win:{total:2,percentage:0.6667},lose:{total:1}}, points:{for:225,against:218}, form:'LWW' },
        { position:2, group:{name:'Grup B'}, team:{id:4,name:'B2'}, games:{played:3,win:{total:2,percentage:'66.67'},lose:{total:1}}, points:{for:220,against:219}, form:'WLW' },
      ]] });
    };
    const response = await worker.fetch(new Request('http://localhost/api/sports/basketball/standings?league=12&season=2026-2027'), quotaEnv, ctx);
    const payload = await response.json();
    ok(response.status === 200 && payload?.sport === 'basketball' && payload?.standings?.length === 4, 'nested standings gruplari normalize edilerek yayinlanir', JSON.stringify(payload));
    ok(payload.standings.every((row) => Math.abs(Number(row.percentage) - 0.6667) < 0.0001), '66.67, 66.67% ve 0.6667 ayni 0..1 yuzde birimine normalize edilir', payload.standings.map((row) => row.percentage).join(','));
    ok(payload.standings[0]?.pointDifference === 30 && upstreamCalls === 1, 'puan farki hesaplanir ve tek scope tek upstream kullanir', `difference=${payload.standings[0]?.pointDifference} calls=${upstreamCalls}`);
    ok(payload.standings.map((row)=>row.team.name).join(',') === 'A1,A2,B1,B2', 'coklu grup bloklari global pozisyon siralamasiyla ic ice gecmez', payload.standings.map((row)=>row.team.name).join(','));

    const isolatedWorker = (await import(`../worker/index.js?basketball-proof-isolate=${Date.now()}`)).default;
    let proofUpstreamCalls = 0;
    SCENARIO = async (u) => {
      if (u.hostname !== 'v1.basketball.api-sports.io' || u.pathname !== '/standings') throw new Error('unexpected_cross_isolate_proof_path:' + u.toString());
      proofUpstreamCalls += 1;
      return json({ errors:{}, response:[] });
    };
    const proofResponse = await isolatedWorker.fetch(new Request(`http://localhost/api/sports/basketball/standings?league=12&season=2026-2027&proof=${encodeURIComponent(standingsProof)}`), quotaEnv, ctx);
    ok(proofResponse.status === 200 && proofUpstreamCalls === 1,
      'gecerli proof bos discovery ile yeni isolate icinde dogrudan standings providerina gecer', `status=${proofResponse.status} calls=${proofUpstreamCalls}`);

    const proofParts = String(standingsProof || '').split('.');
    const signature = proofParts.at(-1) || '';
    const tamperedProof = [...proofParts.slice(0, -1), `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`].join('.');
    const rejectedProofCases = [
      ['yanlis lig', `league=112&season=2026-2027&proof=${encodeURIComponent(standingsProof)}`],
      ['yanlis sezon', `league=12&season=2025-2026&proof=${encodeURIComponent(standingsProof)}`],
      ['degistirilmis imza', `league=12&season=2026-2027&proof=${encodeURIComponent(tamperedProof)}`],
      ['yanlis surum', `league=12&season=2026-2027&proof=${encodeURIComponent(String(standingsProof || '').replace(/^bsp1\./, 'bsp2.'))}`],
      ['bozuk token', 'league=12&season=2026-2027&proof=not-a-proof'],
    ];
    let rejectedProofUpstreamCalls = 0;
    SCENARIO = async () => {
      rejectedProofUpstreamCalls += 1;
      return json({ errors:{}, response:[] });
    };
    for (const [label, query] of rejectedProofCases) {
      const rejected = await isolatedWorker.fetch(new Request(`http://localhost/api/sports/basketball/standings?${query}`), quotaEnv, ctx);
      const rejectedPayload = await rejected.json();
      ok(rejected.status === 409 && rejectedPayload?.error === 'basketball_standings_scope_not_discovered',
        `${label} proof discovery bosken fail-closed reddedilir`, `status=${rejected.status} body=${JSON.stringify(rejectedPayload)}`);
    }
    const wrongSecret = await isolatedWorker.fetch(
      new Request(`http://localhost/api/sports/basketball/standings?league=12&season=2026-2027&proof=${encodeURIComponent(standingsProof)}`),
      { ...quotaEnv, API_SPORTS_KEY:'different-api-sports-secret' },
      ctx,
    );
    ok(wrongSecret.status === 409, 'proof yalniz onu ureten API-Sports secret anahtariyla dogrulanir', `status=${wrongSecret.status}`);
    ok(rejectedProofUpstreamCalls === 0, 'yanlis/tahrif edilmis proof standings provider kotasi harcamaz', `fetches=${rejectedProofUpstreamCalls}`);

    SCENARIO = async () => { throw new Error('health_proof_test_should_not_fetch'); };
    const health = await isolatedWorker.fetch(new Request('http://localhost/api/health'), quotaEnv, ctx);
    const healthText = await health.text();
    ok(health.status === 200 && !healthText.includes(quotaEnv.API_SPORTS_KEY) && !healthText.includes(String(standingsProof || '')),
      'API-Sports secret ve standings proof health yanitina sizmaz', healthText.slice(0, 200));

    let undiscoveredFetches = 0;
    SCENARIO = async () => { undiscoveredFetches += 1; return json({ errors:{}, response:[] }); };
    const undiscovered = await worker.fetch(new Request('http://localhost/api/sports/basketball/standings?league=999&season=2026'), quotaEnv, ctx);
    const undiscoveredPayload = await undiscovered.json();
    ok(undiscovered.status === 409 && undiscoveredPayload?.error === 'basketball_standings_scope_not_discovered', 'bicimsel gecerli ama gunluk feedde kesfedilmemis scope upstream oncesi reddedilir', JSON.stringify(undiscoveredPayload));
    ok(undiscoveredFetches === 0, 'kesfedilmemis scope API-Sports kotasi harcamaz', `fetches=${undiscoveredFetches}`);

    let schemaFetches = 0;
    SCENARIO = async (u) => { schemaFetches += 1; return json({ errors:{}, response:[{ unexpected:true }] }); };
    const schemaMismatch = await worker.fetch(new Request('http://localhost/api/sports/basketball/standings?league=13&season=2026'), quotaEnv, ctx);
    ok(schemaMismatch.status === 502 && schemaFetches === 1, 'normalize edilemeyen dolu provider semasi dogrulanmis bos olarak cachelenmez', `status=${schemaMismatch.status} fetches=${schemaFetches}`);

    SCENARIO = async () => json({ errors:{}, response:[] });
    const verifiedEmpty = await worker.fetch(new Request('http://localhost/api/sports/basketball/standings?league=14&season=2026'), quotaEnv, ctx);
    const verifiedEmptyPayload = await verifiedEmpty.json();
    ok(verifiedEmpty.status === 200 && Array.isArray(verifiedEmptyPayload?.standings) && verifiedEmptyPayload.standings.length === 0, 'gercek response bos sonucu sahte hata veya satira cevrilmez', JSON.stringify(verifiedEmptyPayload));
  }
  {
    let fetches = 0;
    SCENARIO = async () => { fetches += 1; return json({ response:[] }); };
    const invalid = await worker.fetch(new Request('http://localhost/api/sports/basketball/standings?league=12x&season=2026/27'), ENV, ctx);
    const payload = await invalid.json();
    ok(invalid.status === 400 && payload?.error === 'invalid_basketball_standings_scope', 'gecersiz lig/sezon upstream oncesi 400 ile reddedilir', JSON.stringify(payload));
    ok(fetches === 0, 'gecersiz standings scope provider kredisi harcamaz', `fetches=${fetches}`);
  }

  console.log('\n=== 13) JSON hata siniri ve bayt limiti ===');
  {
    for (const path of ['/api/analytics/event', '/api/predict-game/session']) {
      const malformed = await worker.fetch(new Request('http://localhost' + path, {
        method:'POST', headers:{ 'Content-Type':'application/json' }, body:'{"broken":',
      }), ENV, ctx);
      const payload = await malformed.json();
      ok(malformed.status === 400 && payload?.error === 'invalid_json', `${path} bozuk JSON icin kontrollu 400 dondurur`, JSON.stringify(payload));
      ok(malformed.headers.get('cache-control') === 'no-store' && malformed.headers.get('x-content-type-options') === 'nosniff', `${path} JSON hata yaniti guvenlik basliklarini korur`);
    }
    const oversized = await worker.fetch(new Request('http://localhost/api/analytics/event', {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ value:'x'.repeat(9000) }),
    }), ENV, ctx);
    const oversizedPayload = await oversized.json();
    ok(oversized.status === 413 && oversizedPayload?.error === 'payload_too_large', 'gercek UTF-8 bayt limiti asimi kontrollu 413 dondurur', JSON.stringify(oversizedPayload));

    const declaredOversized = await worker.fetch(new Request('http://localhost/api/analytics/event', {
      method:'POST', headers:{ 'Content-Type':'application/json', 'Content-Length':'9000' }, body:'{}',
    }), ENV, ctx);
    ok(declaredOversized.status === 413, 'buyuk Content-Length govde okunmadan 413 ile reddedilir', `status=${declaredOversized.status}`);
  }

  console.log('\n=== 14) Statik varlik cache butunlugu ===');
  {
    const versioned = await worker.fetch(new Request('http://localhost/assets/js/app.js?v=release-hash'), ENV, ctx);
    const unversioned = await worker.fetch(new Request('http://localhost/assets/img/team.webp'), ENV, ctx);
    ok(/max-age=31536000/.test(versioned.headers.get('cache-control') || '') && /immutable/.test(versioned.headers.get('cache-control') || ''), 'surumlu asset uzun immutable cache alir');
    ok(/max-age=3600/.test(unversioned.headers.get('cache-control') || '') && !/immutable/.test(unversioned.headers.get('cache-control') || ''), 'surumsuz gorsel yeniden dogrulanabilir kisa cache alir');
  }

  console.log(`\n=== OZET === PASS: ${PASS}  FAIL: ${FAIL}`);
  if (failures.length) { console.log(failures.map((f) => ' - ' + f).join('\n')); process.exit(1); }
}

main().catch((error) => { console.error(error); process.exit(1); });
