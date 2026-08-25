const STATIC_CACHE = "public, max-age=31536000, immutable";
const UNVERSIONED_STATIC_CACHE = "public, max-age=3600, stale-while-revalidate=86400";
const HTML_CACHE = "public, max-age=0, must-revalidate";
// assets/js/data.js içindeki aktif SELECTED_COMPETITIONS lig anahtarlarıyla
// (super-lig, la-liga, premier-league, bundesliga, serie-a) ve README'de listelenen
// ana sayfalarla senkron tutulmalıdır. "" kök path (/) için, "predict"/"football"
// ürün alanları için, "legal" statik hukuki sayfalar için kullanılıyor.
const KNOWN_APP_ROUTE_PREFIXES = new Set([
  "",
  "predict",
  "football",
  "futbol",
  "all",
  "basketbol",
  "voleybol",
  "ufc",
  "motorsports",
  "legal",
  "super-lig",
  "la-liga",
  "premier-league",
  "bundesliga",
  "serie-a",
]);
// index.html barındırdığı mevcut inline onclick/style kullanımı nedeniyle
// script-src/style-src şu an 'unsafe-inline' içeriyor. Bu, sayfayı bozmadan
// eklenebilecek ilk CSP katmanıdır; inline handler'ların addEventListener'a
// taşınması ayrı, onaylı bir refactor gerektirir (bkz. geliştirme planı).
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://cdn.sportmonks.com https://cdn.sportmonks.io https://images.sportmonks.com https://swhwmqbamzczztpfxctg.supabase.co https://cdn.mythos.cards https://upload.wikimedia.org https://pbs.twimg.com https://video.twimg.com https://i.ytimg.com https://img.youtube.com https://*.fbcdn.net https://platform-lookaside.fbsbx.com https://api.citoapi.com https://ufc.com https://www.ufc.com https://*.api-sports.io https://*.api-football.com",
  "connect-src 'self' https://swhwmqbamzczztpfxctg.supabase.co wss://swhwmqbamzczztpfxctg.supabase.co",
  "frame-src https://www.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// jsonResponse ve withHeaders arasında tekrarlanan güvenlik başlıklarının
// tek kaynağı. Buradaki değerler her iki yol için de aynıdır; yalnızca
// Content-Type/Cache-Control gibi yanıta özgü başlıklar ayrı ayrı eklenir.
function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  };
}
const SOCIAL_CACHE = "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";
const SOCIAL_STALE_CACHE = "public, max-age=3600, s-maxage=604800";
const X_USER_CACHE = "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800";
const X_PRESEASON_CACHE = "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";
const X_PRESEASON_STALE_CACHE = "public, max-age=3600, s-maxage=604800";
const X_TIMEOUT_MS = 8000;
const X_CLUB_DAILY_LIMIT = 5;
const X_PUBLISHER_DAILY_LIMIT = 2;
const X_PRESEASON_DAILY_LIMIT = 4;
const X_RECENT_TWEET_LIMIT = "5";
const X_PRESEASON_TWEET_LIMIT = "10";
const TRANSLATE_TIMEOUT_MS = 7000;
const YOUTUBE_CACHE = "public, max-age=300, s-maxage=5400, stale-while-revalidate=21600";
const YOUTUBE_STALE_CACHE = "public, max-age=60, s-maxage=86400";
const YOUTUBE_TIMEOUT_MS = 8000;
const CLUB_CACHE = "public, max-age=600, s-maxage=21600, stale-while-revalidate=86400";
const CLUB_STALE_CACHE = "public, max-age=60, s-maxage=604800";
const TRANSFER_CACHE = "public, max-age=600, s-maxage=3600, stale-while-revalidate=21600";
// Canli skor ayri /live ucundan geldigi icin sezon fiksturu ve puan tablosu
// kullanici yenilemelerinde tekrar tekrar saglayiciya gitmemelidir. Browser
// kisa surede yeniden dogrulayabilir; paylasilan edge/persistent cache daha
// uzun tutulur.
const SEASON_CACHE = "public, max-age=300, s-maxage=1800, stale-while-revalidate=21600";
const FOOTBALL_HOME_CACHE = "public, max-age=120, s-maxage=300, stale-while-revalidate=3600";
const LIVE_API_CACHE = "public, max-age=5, s-maxage=5, stale-while-revalidate=30";
const SPORTMONKS_TIMEOUT_MS = 12000;
const SEASON_SHARED_TTL_SECONDS = 1800;
const SEASON_SHARED_STALE_SECONDS = 86400;
const FOOTBALL_HOME_SHARED_TTL_SECONDS = 300;
const FOOTBALL_HOME_SHARED_STALE_SECONDS = 3600;
const SEASON_REFRESH_LOCK_SECONDS = 45;
const FOOTBALL_HOME_REFRESH_LOCK_SECONDS = 60;
// Gorunur bransta talep edilen pahali provider uclarinin cold-miss korumasi.
// Provider timeout'u lease suresinden kisa tutulur; normal tamamlanmada holder
// filtresiyle erken birakilir, crash durumunda TTL kilidi acar.
const DEMAND_PROVIDER_TIMEOUT_MS = 10000;
const DEMAND_PROVIDER_LOCK_SECONDS = 15;
const MULTISPORT_SHARED_TTL_SECONDS = 900;
const MULTISPORT_SHARED_STALE_SECONDS = 21600;
const FOOTBALL_LEADERS_TTL_SECONDS = 2700;
const FOOTBALL_LEADERS_STALE_SECONDS = 86400;
const FOOTBALL_WEEKLY_TTL_SECONDS = 21600;
const FOOTBALL_WEEKLY_STALE_SECONDS = 604800;
const XYZ_PERFORMANCE_ALGORITHM_VERSION = "v1";

// ===================== CANLI SKOR MİMARİSİ (bkz. docs/LIVE-SCORE-HANDOFF-2026-08-22.md) =====================
// Yalnızca /api/football/live (5sn poll edilen uç) tarafından kullanılır.
// Zengin include zinciri (lineups/statistics/weatherReport/events) BİLEREK
// burada YOK: bu uç eskiden sportmonksFixtureRequest'in en pahalı include
// setini her 5 saniyede bir çağırıyordu; kota tükenmesinin kök nedeni buydu.
const LIVE_INPLAY_INCLUDES = "participants;scores;league;state;periods";
// Worker isolate'leri arasında paylaşılan hafıza yok ve platformun (OpenAI
// Sites) Cache API/Durable Object garantisi doğrulanamadığından, single-flight
// tekilleştirme Supabase'teki sync_locks + try_acquire_sync_lock() RPC'si
// üzerinden yapılır (bkz. migration 20260822200000).
// Provider isteginin 12sn timeout'undan uzun crash-guard. Basarili ya da
// basarisiz her denemede holder'a bagli olarak erken birakilir; dolayisiyla
// normal 6sn canli yenileme ritmini yavaslatmaz.
const LIVE_LOCK_TTL_SECONDS = 15;
const LIVE_SHARED_TTL_SECONDS = 5;
const LIVE_SHARED_STALE_SECONDS = 45;
const LIVE_PROVIDER_SCOPE_KEY = "live:provider-inplay";
const LIVE_PROVIDER_CACHE_SCOPE = "worker:football-live:inplay:v1";
const LIVE_SNAPSHOT_TTL_SECONDS = 45; // canli olmayan/tamamlanmis snapshot'lar bu sureden sonra "stale" sayilir
const LIVE_CIRCUIT_WINDOW = 5; // son N provider_sync_runs kaydina bakilir
const LIVE_CIRCUIT_FAILURE_THRESHOLD = 3; // ust uste N basarisizlik -> circuit acik
const LIVE_CIRCUIT_OPEN_SECONDS = 20; // circuit acikken upstream'e gidilmez
const FINALIZE_CONFIRMATIONS_SECONDS = [15, 60, 300]; // mac sonu ucdan uca dogrulama takvimi (bilgi amacli; asil kesinlesme verifiedSportmonksFixture ile yapilir)
const INSTAGRAM_TIMEOUT_MS = 9000;
const INSTAGRAM_CACHE = "public, max-age=900, s-maxage=3600, stale-while-revalidate=21600";
const INSTAGRAM_STALE_CACHE = "public, max-age=300, s-maxage=604800";
const INSTAGRAM_GRAPH_VERSION = "v21.0";
// Graph API hashtag arama kotasi: 7 gunluk pencerede 30 benzersiz hashtag.
// Bu yuzden lig basina az sayida, sabit hashtag kullanilir.
const INSTAGRAM_HASHTAGS_BY_LEAGUE = Object.freeze({
  "super-lig": ["superlig", "galatasaray", "fenerbahce"],
  "champions-league": ["championsleague", "uefachampionsleague"],
  "europa-league": ["uefaeuropaleague"],
  "la-liga": ["laliga"],
  "premier-league": ["premierleague"],
  bundesliga: ["bundesliga"],
  "serie-a": ["seriea"],
});
const INSTAGRAM_HASHTAG_MEDIA_LIMIT = 12;
const xFeedRefreshPromises = new Map();
const xPreseasonRefreshPromises = new Map();
const youtubeFeedRefreshPromises = new Map();
const clubProfileRefreshes = new Map();
// Cache API ayni anda gelen miss'leri tek basina birlestirmez. Ayni Worker
// isolate'indaki kullanicilar tek promise'i paylasir; isolate'ler arasi
// tekillestirme asagidaki Supabase cache + sync_locks katmanindadir.
const footballSeasonRefreshPromises = new Map();
let footballHomeRefreshPromise = null;
let footballLiveRefreshPromise = null;
const providerDemandRefreshPromises = new Map();
const X_CLUBS = [
  { team: "Galatasaray", handle: "GalatasaraySK", url: "https://x.com/GalatasaraySK" },
  { team: "Fenerbahçe", handle: "Fenerbahce", url: "https://x.com/Fenerbahce" },
  { team: "Beşiktaş", handle: "Besiktas", url: "https://x.com/Besiktas" },
  { team: "Trabzonspor", handle: "Trabzonspor", url: "https://x.com/Trabzonspor" },
];
const makeXClubList = (pairs) => pairs.map(([team, handle]) => ({ team, handle, url: `https://x.com/${handle}` }));
const X_PUBLISHERS_BY_LEAGUE = Object.freeze({
  "super-lig": makeXClubList([
    ["Fabrizio Romano", "FabrizioRomano"],
    ["Yağız Sabuncuoğlu", "yagosabuncuoglu"],
    ["Sercan Hamzaoğlu", "sercanhamzaolu"],
  ]),
  "champions-league": makeXClubList([
    ["Fabrizio Romano", "FabrizioRomano"],
    ["UEFA Champions League", "ChampionsLeague"],
    ["UEFA", "UEFAcom"],
  ]),
  "europa-league": makeXClubList([
    ["Fabrizio Romano", "FabrizioRomano"],
    ["UEFA Europa League", "EuropaLeague"],
    ["UEFA", "UEFAcom"],
  ]),
  "la-liga": makeXClubList([
    ["Fabrizio Romano", "FabrizioRomano"],
    ["LALIGA English", "LaLigaEN"],
    ["ESPN FC", "ESPNFC"],
  ]),
  "premier-league": makeXClubList([
    ["David Ornstein", "David_Ornstein"],
    ["Premier League", "premierleague"],
    ["Sky Sports Premier League", "SkySportsPL"],
  ]),
  bundesliga: makeXClubList([["Bayern München","FCBayern"],["Borussia Dortmund","BVB"],["Bayer Leverkusen","bayer04fussball"],["RB Leipzig","RBLeipzig"]]),
  "serie-a": makeXClubList([["Inter","Inter"],["Milan","acmilan"],["Juventus","juventusfc"],["Napoli","sscnapoli"]]),
});
const X_CLUBS_BY_LEAGUE = Object.freeze({
  "super-lig": X_CLUBS,
  "champions-league": makeXClubList([
    ["Arsenal", "Arsenal"], ["Bayern München", "FCBayern"], ["Liverpool", "LFC"], ["Tottenham Hotspur", "SpursOfficial"],
    ["Barcelona", "FCBarcelona"], ["Chelsea", "ChelseaFC"], ["Sporting CP", "SportingCP"], ["Manchester City", "ManCity"],
    ["Real Madrid", "realmadrid"], ["Inter", "Inter"], ["Paris Saint-Germain", "PSG_English"], ["Newcastle United", "NUFC"],
    ["Juventus", "juventusfc"], ["Atlético Madrid", "Atleti"], ["Atalanta", "Atalanta_BC"], ["Bayer Leverkusen", "bayer04fussball"],
  ]),
  "europa-league": makeXClubList([
    ["Roma", "OfficialASRoma"], ["Porto", "FCPorto"], ["Rangers", "RangersFC"], ["Fenerbahçe", "Fenerbahce"],
    ["Galatasaray", "GalatasaraySK"], ["Real Betis", "RealBetis"], ["Lazio", "OfficialSSLazio"], ["Feyenoord", "Feyenoord"],
    ["Lyon", "OL"], ["Ajax", "AFCAjax"], ["Braga", "SCBragaOficial"], ["Villarreal", "VillarrealCF"],
    ["Freiburg", "scfreiburg"], ["Olympiacos", "olympiacosfc"], ["Trabzonspor", "Trabzonspor"], ["Beşiktaş", "Besiktas"],
  ]),
  "la-liga": makeXClubList([
    ["Real Madrid", "realmadrid"], ["Barcelona", "FCBarcelona"], ["Atlético Madrid", "Atleti"], ["Athletic Club", "AthleticClub"],
    ["Villarreal", "VillarrealCF"], ["Real Betis", "RealBetis"], ["Real Sociedad", "RealSociedad"], ["Sevilla", "SevillaFC"],
    ["Valencia", "valenciacf"], ["Celta Vigo", "RCCelta"], ["Osasuna", "Osasuna"], ["Getafe", "GetafeCF"],
    ["Rayo Vallecano", "RayoVallecano"], ["Mallorca", "RCD_Mallorca"], ["Girona", "GironaFC"], ["Espanyol", "RCDEspanyol"],
    ["Levante", "LevanteUD"], ["Elche", "elchecf"], ["Alavés", "Alaves"], ["Real Oviedo", "RealOviedo"],
  ]),
  "premier-league": makeXClubList([
    ["Liverpool", "LFC"], ["Arsenal", "Arsenal"], ["Manchester City", "ManCity"], ["Chelsea", "ChelseaFC"],
    ["Tottenham Hotspur", "SpursOfficial"], ["Manchester United", "ManUtd"], ["Newcastle United", "NUFC"], ["Aston Villa", "AVFCOfficial"],
    ["Brighton", "OfficialBHAFC"], ["Bournemouth", "afcbournemouth"], ["Crystal Palace", "CPFC"], ["Everton", "Everton"],
    ["Fulham", "FulhamFC"], ["West Ham United", "WestHam"], ["Brentford", "BrentfordFC"], ["Wolverhampton Wanderers", "Wolves"],
    ["Leeds United", "LUFC"], ["Sunderland", "SunderlandAFC"], ["Burnley", "BurnleyOfficial"], ["Hull City", "HullCity"],
  ]),
  bundesliga: makeXClubList([
    ["Bayern München","FCBayern"],["Borussia Dortmund","BVB"],["Bayer Leverkusen","bayer04fussball"],["RB Leipzig","RBLeipzig"],
    ["Eintracht Frankfurt","Eintracht"],["VfB Stuttgart","VfB"],["Werder Bremen","werderbremen"],["Freiburg","scfreiburg"],
  ]),
  "serie-a": makeXClubList([
    ["Inter","Inter"],["Milan","acmilan"],["Juventus","juventusfc"],["Napoli","sscnapoli"],
    ["Roma","OfficialASRoma"],["Lazio","OfficialSSLazio"],["Atalanta","Atalanta_BC"],["Fiorentina","acffiorentina"],
  ]),
});
const PRESEASON_KEYWORDS = [
  "hazirlik",
  "hazırlık",
  "preseason",
  "pre-season",
  "friendly",
  "friendlies",
  "amistoso",
  "amichevole",
  "amical",
  "test match",
  "hazirlik maci",
  "hazırlık maçı",
  "club friendly",
  "training match",
  "closed-door friendly",
];
const TRANSFER_NEWS_KEYWORDS = [
  "transfer", "transferred", "signing", "signed", "signs", "joins", "joined",
  "contract", "agreement", "deal", "loan", "kiralık", "kiralik", "bonservis",
  "imza", "imzaladı", "imzaladi", "anlaşma", "anlasma", "görüşme", "gorusme",
  "ayrılık", "ayrilik", "resmi açıklama", "official statement", "here we go",
  "fichaje", "traspaso", "prestamo", "firma", "verpflichtung", "wechsel",
  "neuzugang", "prestito", "cessione", "acquisto", "rinnovo"
];
const MATCH_RESULT_KEYWORDS = [
  "mac sonucu",
  "maç sonucu",
  "full time",
  "full-time",
  "final score",
  "final whistle",
  "match result",
  "resultado final",
  "risultato finale",
  "score final",
];
const YOUTUBE_CHANNELS = [
  { name: "Sports Digitale", handle: "@sportsdigitale", id: "UCmEgRY1A2263UXrQhjDuU0Q", url: "https://www.youtube.com/@sportsdigitale" },
  { name: "HT Spor", handle: "@htspor", id: "UCK3mI2lsk3LSo8PBUc8JTSw", url: "https://www.youtube.com/@htspor" },
  { name: "beIN SPORTS Türkiye", handle: "@beINSPORTSTurkiye", id: "UCNopxUNUMinlK3ybMGlpbGQ", url: "https://www.youtube.com/@beINSPORTSTurkiye" },
  { name: "TRT Spor", handle: "@trtspor", id: "UCebdo7-2NdjcktKzco64iNw", url: "https://www.youtube.com/@trtspor" },
];
const YOUTUBE_QUERY_BY_LEAGUE = Object.freeze({
  "super-lig":"Süper Lig",
  "premier-league":"Premier League",
  "la-liga":"La Liga",
  "bundesliga":"Bundesliga",
  "serie-a":"Serie A",
  "champions-league":"Şampiyonlar Ligi OR Champions League",
  "europa-league":"Avrupa Ligi OR Europa League",
  all:"futbol",
});
const YOUTUBE_RELEVANCE_BY_LEAGUE = Object.freeze({
  "super-lig":["süper lig","super lig","galatasaray","fenerbahçe","fenerbahce","beşiktaş","besiktas","trabzonspor"],
  "premier-league":["premier league","arsenal","liverpool","manchester city","manchester united","chelsea","tottenham","newcastle"],
  "la-liga":["la liga","laliga","real madrid","barcelona","atletico","atlético","sevilla","valencia"],
  bundesliga:["bundesliga","bayern","dortmund","leverkusen","leipzig","frankfurt","stuttgart"],
  "serie-a":["serie a","inter","milan","juventus","napoli","roma","lazio","atalanta","fiorentina"],
  all:["futbol","football","soccer"],
});
function youtubeTitleMatchesLeague(title, league) {
  const normalized = String(title || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("tr-TR");
  return (YOUTUBE_RELEVANCE_BY_LEAGUE[league] || YOUTUBE_RELEVANCE_BY_LEAGUE.all).some((term) => normalized.includes(String(term).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("tr-TR")));
}
const SPORTMONKS_TEAM_SEARCH = Object.freeze({
  Alanyaspor:"Alanyaspor", "Amed Sportif Faaliyetler":"Amed SK", Beşiktaş:"Besiktas", "Çaykur Rizespor":"Rizespor", "Çorum FK":"Corum FK", "Erzurumspor FK":"Erzurumspor", Eyüpspor:"Eyupspor", Fenerbahçe:"Fenerbahce", Galatasaray:"Galatasaray", "Gaziantep FK":"Gaziantep", Gençlerbirliği:"Genclerbirligi", Göztepe:"Goztepe", Başakşehir:"Istanbul Basaksehir", Kasımpaşa:"Kasimpasa", Kocaelispor:"Kocaelispor", Konyaspor:"Konyaspor", Samsunspor:"Samsunspor", Trabzonspor:"Trabzonspor"
});
const SELECTED_LEAGUE_IDS_BY_KEY = Object.freeze({
  "super-lig": ["600"],
  "la-liga": ["564"],
  "premier-league": ["8"],
  bundesliga: ["82"],
  "serie-a": ["384"],
  all: ["600", "8", "564", "82", "384"],
});
const SELECTED_LEAGUE_NAMES_BY_KEY = Object.freeze({
  "super-lig": "Süper Lig",
  "la-liga": "LaLiga",
  "premier-league": "Premier League",
  bundesliga: "Bundesliga",
  "serie-a": "Serie A",
});
const SELECTED_LEAGUE_KEYS = new Set(Object.keys(SELECTED_LEAGUE_IDS_BY_KEY));
const X_LEAGUE_KEYS = new Set(Object.keys(X_CLUBS_BY_LEAGUE));

function validLeagueKey(value, options = {}) {
  const key = String(value || "super-lig").trim().toLowerCase();
  if (!SELECTED_LEAGUE_KEYS.has(key)) return null;
  if (options.xFeed && !X_LEAGUE_KEYS.has(key)) return null;
  if (options.single && key === "all") return null;
  return key;
}
function isXFeedPausedRequest(request) {
  const url = new URL(request.url);
  const flag = (url.searchParams.get("pause_x") || "").toLocaleLowerCase("en-US");
  return flag === "1" || flag === "true" || flag === "on" || flag === "yes";
}
function xPausedPayload(league, type = "media") {
  const clubs = type === "preseason"
    ? xDailyPreseasonScope(league).map((club) => ({ ...club, preseason_post: null, account_found: true, upstream_error: "x_feed_paused" }))
    : xDailyClubScope(league).map((club) => ({ ...club, post: null, account_found: true, upstream_error: "x_feed_paused" }));
  const publishers = type === "preseason"
    ? []
    : xDailyPublisherScope(league).map((club) => ({ ...club, publisher: true, post: null, posts: [], account_found: true, upstream_error: "x_feed_paused" }));
  return {
    source: "x-api",
    league,
    status: "paused",
    cost_profile: "manual-pause",
    updated_at: new Date().toISOString(),
    cache_ttl_seconds: 60,
    clubs,
    publishers,
  };
}

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...securityHeaders(),
      // JSON yanıtları hiçbir bağlamda render edilmediği için referrer'ı
      // tamamen kesmek (no-referrer) HTML'den daha sıkı tutulabilir.
      "Referrer-Policy": "no-referrer",
      ...extraHeaders,
    },
  });
}

function safeErrorMessage(error) {
  const message=String(error?.providerMessage||error?.message||'provider_unavailable');
  // Saglayici hata metni istegin URLini yankilayabilir; token benzeri her degeri maskele.
  return redactSecrets(message).replace(/[\r\n\t]/g,' ').slice(0,240);
}

function publicProviderErrorCode(error) {
  const status=Number(error?.status)||0;
  if(status===401) return 'provider_auth_failed';
  if(status===403) return 'provider_plan_restricted';
  if(status===429) return 'provider_rate_limited';
  if(error?.name==='AbortError') return 'provider_timeout';
  return 'provider_unavailable';
}

// Saglayici mesajlarindan ve loglardan sizabilecek anahtarlari maskeler.
function redactSecrets(value) {
  return String(value == null ? '' : value)
    .replace(/((?:api_token|access_token|apikey|api_key|key|token|bearer)["'\s:=]{0,4})([A-Za-z0-9._\-]{8,})/gi, (all, head) => `${head}[REDACTED]`);
}

// Saglayici JSON yerine HTML/hata sayfasi dondurdugunde sessizce bos veri
// yayinlamak yerine acik hata uretir (bkz. XYZSKOR-devir: content-type kontrolu).
async function parseProviderJson(response, provider) {
  const contentType = String(response.headers.get('content-type') || '');
  if (!/\bjson\b/i.test(contentType)) {
    const error = new Error(`${provider}_invalid_content_type`);
    error.status = response.ok ? 502 : response.status;
    error.providerMessage = `Beklenen JSON yerine ${contentType || 'bilinmeyen'} alindi.`;
    throw error;
  }
  try {
    return await response.json();
  } catch (parseError) {
    const error = new Error(`${provider}_invalid_json`);
    error.status = response.ok ? 502 : response.status;
    error.providerMessage = 'Saglayici gecersiz JSON dondurdu.';
    throw error;
  }
}

const SUPABASE_URL_FALLBACK = "https://swhwmqbamzczztpfxctg.supabase.co";
const PREDICT_GAME = Object.freeze({
  TARGET_GOALS: 10,
  MAX_MISSES: 5,
  POINTS_PER_GOAL: 5,
  MAX_REWARD_POINTS: 50,
  MIN_SESSION_MS: 2500,
  MIN_EVENT_INTERVAL_MS: 120,
  MAX_ELAPSED_DRIFT_MS: 10000,
  MAX_EVENTS: 15,
});

function predictGameNonce() {
  return crypto.randomUUID();
}

function validatePredictGameEvents(session, nonce, events, elapsedMs, goals, misses, finalState, finishedAt = Date.now()) {
  const startedAt = Date.parse(session?.started_at || "");
  if (session?.status !== "started" || !session?.nonce || nonce !== session.nonce) return false;
  const serverElapsed = finishedAt - startedAt;
  if (!Number.isFinite(startedAt) || !Number.isSafeInteger(elapsedMs) || elapsedMs < PREDICT_GAME.MIN_SESSION_MS) return false;
  if (Math.abs(serverElapsed - elapsedMs) > PREDICT_GAME.MAX_ELAPSED_DRIFT_MS) return false;
  if (!Array.isArray(events) || events.length !== goals + misses || events.length > PREDICT_GAME.MAX_EVENTS) return false;
  let previous = 0;
  let eventGoals = 0;
  let eventMisses = 0;
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    const eventElapsed = Number(event?.elapsedMs);
    if (!Number.isFinite(eventElapsed) || !["goal", "miss"].includes(event?.type)) return false;
    if (eventElapsed > elapsedMs || eventElapsed - previous < PREDICT_GAME.MIN_EVENT_INTERVAL_MS) return false;
    previous = eventElapsed;
    if (event.type === "goal") eventGoals++;
    else eventMisses++;
    const reachedSuccess = eventGoals === PREDICT_GAME.TARGET_GOALS;
    const reachedGameOver = eventMisses === PREDICT_GAME.MAX_MISSES;
    if (reachedSuccess || reachedGameOver) {
      if (index !== events.length - 1) return false;
      return reachedSuccess
        ? finalState === "GAME_SUCCESS" && eventMisses < PREDICT_GAME.MAX_MISSES && goals === eventGoals && misses === eventMisses
        : finalState === "GAME_OVER" && eventGoals < PREDICT_GAME.TARGET_GOALS && goals === eventGoals && misses === eventMisses;
    }
  }
  return false;
}

function supabaseUrl(env) {
  return String(env.SUPABASE_URL || SUPABASE_URL_FALLBACK).replace(/\/+$/, "");
}

function supabaseServiceKey(env) {
  return env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "";
}

function supabaseAnonKey(env) {
  return env.SUPABASE_ANON_KEY || env.SUPABASE_KEY || supabaseServiceKey(env);
}

function cleanUuid(value) {
  const text = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

function cleanToken(value, max = 120) {
  return String(value || "").trim().replace(/[^a-zA-Z0-9_:-]/g, "").slice(0, max) || null;
}

function productFeatureEnabled(env, key, defaultValue = true) {
  const value = env?.[key] ?? env?.[key.toUpperCase()];
  if (value === undefined || value === null || value === "") return defaultValue;
  return !["0","false","off","disabled"].includes(String(value).trim().toLowerCase());
}

function predictPoints(goals) {
  return Math.min(Math.max(0, Number(goals) || 0) * PREDICT_GAME.POINTS_PER_GOAL, PREDICT_GAME.MAX_REWARD_POINTS);
}

async function readJsonBody(request, maxBytes = 8192) {
  const declaredLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    const error = new Error("payload_too_large");
    error.status = 413;
    throw error;
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > maxBytes) {
    const error = new Error("payload_too_large");
    error.status = 413;
    throw error;
  }
  const text = new TextDecoder().decode(bytes);
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    const error = new Error("invalid_json");
    error.status = 400;
    throw error;
  }
}

async function getAuthUser(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const response = await fetch(`${supabaseUrl(env)}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey(env),
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return user?.id ? user : null;
}

async function supabaseRest(env, path, init = {}) {
  const key = supabaseServiceKey(env);
  if (!key) {
    const error = new Error("supabase_service_not_configured");
    error.status = 503;
    throw error;
  }
  const response = await fetch(`${supabaseUrl(env)}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || "supabase_error");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

// live_feed_cache adi tarihsel olsa da tablo sunucu tarafindaki saglayici
// payload'lari icin genel, service-role-only bir key/value cache'tir. Sezon ve
// bes-lig home snapshot'larini burada tutmak Cache API bulunmayan ya da farkli
// isolate'lara dagilan calisma ortamlarinda her kullanicinin Sportmonks'a
// gitmesini engeller.
async function readProviderSharedCache(env, scope) {
  if (!supabaseServiceKey(env)) return null;
  try {
    const rows = await supabaseRest(
      env,
      `live_feed_cache?scope=eq.${encodeURIComponent(scope)}&select=payload,fetched_at,expires_at&limit=1`
    );
    return Array.isArray(rows) ? rows[0] || null : null;
  } catch (_error) {
    return null;
  }
}

async function writeProviderSharedCache(env, scope, payload, ttlSeconds, provider = "sportmonks") {
  if (!supabaseServiceKey(env)) return false;
  const fetchedAt = new Date();
  try {
    await supabaseRest(env, "live_feed_cache?on_conflict=scope", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        scope,
        provider,
        payload,
        fetched_at: fetchedAt.toISOString(),
        expires_at: new Date(fetchedAt.getTime() + ttlSeconds * 1000).toISOString(),
      }),
    });
    return true;
  } catch (_error) {
    return false;
  }
}

function providerSharedCacheFresh(row, now = Date.now()) {
  const expiresAt = Date.parse(row?.expires_at || "");
  return Boolean(row?.payload && Number.isFinite(expiresAt) && expiresAt > now);
}

function providerSharedCacheWithinStaleWindow(row, maxStaleSeconds, now = Date.now()) {
  if (!row?.payload) return false;
  const fetchedAt = Date.parse(row?.fetched_at || "");
  return Number.isFinite(fetchedAt) && now - fetchedAt <= maxStaleSeconds * 1000;
}

function providerRefreshLockedError(scope) {
  const error = new Error("provider_refresh_in_progress");
  error.status = 503;
  error.scope = scope;
  return error;
}

// ===================== CANLI SKOR: KALICI SNAPSHOT + SINGLE-FLIGHT + CIRCUIT BREAKER =====================

// Sportmonks livescores/inplay ucunu SADECE minimal include ile cagirir.
// handleFootballMatchday/handleFootballFixture gibi zengin detay uclari bu
// fonksiyonu KULLANMAZ; onlar sportmonksFixtureRequest'teki tam include
// zincirini korur. Boylece 5sn'lik hot-path pahali alanlari asla istemez.
async function sportmonksLiveInplayRequest(token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SPORTMONKS_TIMEOUT_MS);
  try {
    const requestUrl = new URL("https://api.sportmonks.com/v3/football/livescores/inplay");
    requestUrl.searchParams.set("api_token", token);
    requestUrl.searchParams.set("include", LIVE_INPLAY_INCLUDES);
    const response = await fetch(requestUrl.toString(), {
      headers: { Authorization: token, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      const payload = /\bjson\b/i.test(String(response.headers.get("content-type") || ""))
        ? await response.json().catch(() => ({}))
        : {};
      const error = new Error(`Sportmonks API ${response.status}`);
      error.status = response.status;
      error.providerMessage = payload?.message || null;
      error.retryAfter = Number(response.headers.get("retry-after")) || null;
      error.rateLimitRemaining = Number(response.headers.get("x-ratelimit-remaining")) || null;
      throw error;
    }
    return await parseProviderJson(response, "sportmonks");
  } finally {
    clearTimeout(timeout);
  }
}

// Bir kapsam (ör. "live:super-lig") icin single-flight kilidi almaya calisir.
// true donerse cagiran upstream'e gidebilir; false donerse baska bir istek
// zaten upstream'e gitmis/gitmektedir -- cagiran kalici snapshot sunmalidir.
// Supabase yapilandirilmamissa (ör. yerel gelistirme) kilit kontrolu atlanir
// ve dogrudan upstream'e izin verilir (fail-open, ozellik devre disi degil).
async function acquireSyncLock(env, key, ttlSeconds = LIVE_LOCK_TTL_SECONDS) {
  if (!supabaseServiceKey(env)) return true;
  try {
    const holder = `${key}:${crypto.randomUUID()}`;
    const result = await supabaseRest(env, "rpc/try_acquire_sync_lock", {
      method: "POST",
      body: JSON.stringify({ p_key: key, p_holder: holder, p_ttl_seconds: ttlSeconds }),
    });
    return result === true;
  } catch (_error) {
    // Kilit altyapisi gecici olarak erisilemezse canli veriyi tamamen
    // durdurmak yerine tekillestirmeyi atla (fail-open); circuit breaker ve
    // provider_sync_runs zaten upstream tarafini ayrica korur.
    return true;
  }
}

// Canli inplay hot-path'i kilidi timeout/crash durumunda TTL ile, normal
// tamamlanmada ise yalnizca kendi holder degeriyle erkenden birakir. Holder
// filtresi eski bir istegin daha yeni bir sahibin kilidini silmesini engeller.
async function acquireSyncLease(env, key, ttlSeconds = LIVE_LOCK_TTL_SECONDS) {
  if (!supabaseServiceKey(env)) return { acquired:true, holder:null };
  const holder = `${key}:${crypto.randomUUID()}`;
  try {
    const result = await supabaseRest(env, "rpc/try_acquire_sync_lock", {
      method: "POST",
      body: JSON.stringify({ p_key:key, p_holder:holder, p_ttl_seconds:ttlSeconds }),
    });
    return { acquired:result === true, holder:result === true ? holder : null };
  } catch (_error) {
    // Kilit servisi erisilemezse canli ozelligi tamamen durmasin. Ortak
    // 5sn snapshot yine olasi tekrarlarin buyuk kismini emer.
    return { acquired:true, holder:null };
  }
}

async function releaseSyncLease(env, key, holder) {
  if (!supabaseServiceKey(env) || !holder) return;
  try {
    await supabaseRest(
      env,
      `sync_locks?lock_key=eq.${encodeURIComponent(key)}&holder=eq.${encodeURIComponent(holder)}`,
      { method:"DELETE", headers:{ Prefer:"return=minimal" } }
    );
  } catch (_error) {
    // TTL crash-guard kilidi en gec LIVE_LOCK_TTL_SECONDS icinde acar.
  }
}

// Supabase live_feed_cache scope alanini sinirli ve sabit uzunlukta tutarken
// farkli query kombinasyonlarini birbirinden ayirir. Kimlik ayrica cache
// zarfinda saklanir; teorik hash cakismasi yanlis payload yayinlayamaz.
function demandScopeHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function demandCacheEnvelope(row, identity, validatePayload) {
  const envelope = row?.payload;
  if (!envelope || envelope.version !== 1 || envelope.identity !== identity) return null;
  return validatePayload(envelope.value) ? envelope.value : null;
}

async function resolveDemandProviderPayload({
  env,
  kind,
  identity,
  provider,
  ttlSeconds,
  staleSeconds,
  lockSeconds = DEMAND_PROVIDER_LOCK_SECONDS,
  validatePayload,
  fetchPayload,
}) {
  const scope = `worker:demand:v1:${kind}:${demandScopeHash(identity)}`;
  const lockKey = `provider:${scope}`;
  let shared = await readProviderSharedCache(env, scope);
  let sharedPayload = demandCacheEnvelope(shared, identity, validatePayload);
  if (sharedPayload && providerSharedCacheFresh(shared)) {
    return { payload:sharedPayload, stale:false, source:"shared-cache" };
  }
  const stale = sharedPayload && providerSharedCacheWithinStaleWindow(shared, staleSeconds)
    ? { row:shared, payload:sharedPayload }
    : null;

  const lease = await acquireSyncLease(env, lockKey, lockSeconds);
  if (!lease.acquired) {
    // Lock sahibi cache yazimini ilk kontrol ile lease denemesi arasinda
    // tamamlamis olabilir. Tekrar oku; hala yoksa ikinci upstream acma.
    shared = await readProviderSharedCache(env, scope);
    sharedPayload = demandCacheEnvelope(shared, identity, validatePayload);
    if (sharedPayload && providerSharedCacheWithinStaleWindow(shared, staleSeconds)) {
      return {
        payload:sharedPayload,
        stale:!providerSharedCacheFresh(shared),
        source:"shared-cache-locked",
      };
    }
    throw providerRefreshLockedError(scope);
  }

  try {
    // Lease alinana kadar baska isolate yenilemeyi bitirmis olabilir.
    shared = await readProviderSharedCache(env, scope);
    sharedPayload = demandCacheEnvelope(shared, identity, validatePayload);
    if (sharedPayload && providerSharedCacheFresh(shared)) {
      return { payload:sharedPayload, stale:false, source:"shared-cache-after-lock" };
    }

    const payload = await fetchPayload();
    if (!validatePayload(payload)) throw new Error(`${kind}_invalid_provider_payload`);
    await writeProviderSharedCache(env, scope, {
      version:1,
      identity,
      value:payload,
    }, ttlSeconds, provider);
    return { payload, stale:false, source:"provider" };
  } catch (error) {
    if (stale) return { payload:stale.payload, stale:true, source:"shared-cache-stale", error };
    throw error;
  } finally {
    await releaseSyncLease(env, lockKey, lease.holder);
  }
}

async function singleFlightDemandProvider(options) {
  // Map key hash degil tam kimliktir: farkli sport/query kapsamlarinin ayni
  // isolate icinde birbirini bekletmesi ya da payload paylasmasi imkansizdir.
  const mapKey = `${options.kind}:${options.identity}`;
  const existing = providerDemandRefreshPromises.get(mapKey);
  if (existing) return existing;
  const promise = resolveDemandProviderPayload(options);
  providerDemandRefreshPromises.set(mapKey, promise);
  try {
    return await promise;
  } finally {
    if (providerDemandRefreshPromises.get(mapKey) === promise) providerDemandRefreshPromises.delete(mapKey);
  }
}

async function fetchWithDemandTimeout(url, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEMAND_PROVIDER_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal:controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function liveSnapshotChecksum(match) {
  return redactSecrets(`${match.status}:${match.minute ?? ""}:${match.home?.score ?? ""}:${match.away?.score ?? ""}`);
}

// Basarili bir canli cekimden sonra her fixture icin son doğrulanmis
// snapshot'i kalici olarak yazar (upsert). Edge cache kaybolsa/hic
// calismasa bile bu tablo "son doğrulanmış skor" kaynağı olarak kalır.
async function persistLiveSnapshots(env, matches, previousRows = []) {
  if (!supabaseServiceKey(env) || !matches.length) return;
  // Inplay upstream'i tum ligleri birlikte dondurur. Her satir provider
  // league_id'den cozulmus kendi gercek lig anahtariyla yazilmalidir; "all"
  // hicbir zaman kalici bir fixture kapsami degildir.
  const scopedMatches = matches.filter((match) => FOOTBALL_HOME_LEAGUES.includes(match?.leagueKey));
  if (!scopedMatches.length) return;
  const previousByFixture = new Map(previousRows.map((row) => [String(row?.fixture_id || ""), row?.payload]));
  const rows = scopedMatches.map((match) => ({
    fixture_id: match.id,
    provider: "sportmonks",
    sport: "football",
    league_key: match.leagueKey,
    status: match.status,
    minute: Number.isFinite(match.minute) ? match.minute : null,
    home_score: Number.isFinite(match.home?.score) ? match.home.score : null,
    away_score: Number.isFinite(match.away?.score) ? match.away.score : null,
    payload: previousByFixture.get(String(match.id))?.matchday
      ? { ...match, matchday: previousByFixture.get(String(match.id)).matchday }
      : match,
    provider_updated_at: new Date().toISOString(),
    fetched_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + LIVE_SNAPSHOT_TTL_SECONDS * 1000).toISOString(),
    checksum: liveSnapshotChecksum(match),
  }));
  try {
    await supabaseRest(env, "live_match_snapshots?on_conflict=fixture_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    });
  } catch (_error) {
    // Snapshot yazimi basarisiz olsa bile canli yaniti kullaniciya
    // ulastirmayi engellemez; yalnizca gelecekteki fallback zayiflar.
  }
  try {
    const fixtureRows = scopedMatches.map((match) => ({
      provider: "sportmonks",
      provider_fixture_id: String(match.id).replace(/^sportmonks:/, ""),
      sport: "football",
      league_key: match.leagueKey,
      provider_league_id: match.providerLeagueId ? String(match.providerLeagueId) : null,
      home_provider_id: match.home?.id ? String(match.home.id) : null,
      away_provider_id: match.away?.id ? String(match.away.id) : null,
      canonical_state: match.status,
      updated_at: new Date().toISOString(),
    }));
    await supabaseRest(env, "provider_fixtures?on_conflict=provider,provider_fixture_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(fixtureRows),
    });
  } catch (_error) { /* iyilestirici; hot path'i engellemez */ }
}

// Belirli bir lig icin en son kalici snapshot'lari okur (upstream basarisiz
// oldugunda "son doğrulanmış skor" olarak sunulur). expires_at gecmis olsa
// bile snapshot DONER (silinmez); cagiran taraf stale/staleAgeSeconds ile
// bunu acikca etiketler -- boylece sonsuz "beklemede" yerine gercek son
// bilinen durum gosterilir.
async function readLiveSnapshots(env, leagueKey) {
  if (!supabaseServiceKey(env)) return [];
  try {
    const leagueFilter = leagueKey === "all"
      ? `in.(${FOOTBALL_HOME_LEAGUES.map((key) => encodeURIComponent(key)).join(",")})`
      : `eq.${encodeURIComponent(leagueKey)}`;
    const rows = await supabaseRest(
      env,
      `live_match_snapshots?league_key=${leagueFilter}&select=fixture_id,league_key,status,payload,fetched_at,provider_updated_at`
    );
    if (!Array.isArray(rows)) return [];
    return rows.filter((row) => {
      const persistedKey = String(row?.league_key || row?.payload?.leagueKey || "");
      // Tek-lig sorgusunda eski satirlar payload icinde leagueKey tasimiyor
      // olabilir; DB filtresi zaten lig izolasyonunu saglamistir. "all"
      // sorgusunda ise sadece acikca gercek lig anahtari olan satirlar kabul.
      return leagueKey === "all"
        ? FOOTBALL_HOME_LEAGUES.includes(persistedKey)
        : !persistedKey || persistedKey === leagueKey;
    });
  } catch (_error) {
    return [];
  }
}

async function readMatchdaySnapshot(env, fixtureId) {
  if (!supabaseServiceKey(env)) return null;
  try {
    const rows = await supabaseRest(
      env,
      `live_match_snapshots?fixture_id=eq.${encodeURIComponent(`sportmonks:${fixtureId}`)}&select=payload,fetched_at,provider_updated_at&limit=1`
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    const body = row?.payload?.matchday;
    return body && typeof body === "object" ? { body, fetchedAt:row.fetched_at, providerUpdatedAt:row.provider_updated_at } : null;
  } catch (_error) {
    return null;
  }
}

async function persistMatchdaySnapshot(env, fixtureId, body) {
  if (!supabaseServiceKey(env) || !body?.fixture || !body?.details) return;
  const fixture = body.fixture;
  const providerLeagueId = String(fixture.provider_league_id || fixture.league_id || "");
  const leagueKey = selectedLeagueKeyForProviderLeagueId(providerLeagueId);
  if (!leagueKey) return;
  const fixtureKey = `sportmonks:${fixtureId}`;
  let previousPayload = null;
  try {
    const existing = await supabaseRest(env, `live_match_snapshots?fixture_id=eq.${encodeURIComponent(fixtureKey)}&select=payload&limit=1`);
    previousPayload = Array.isArray(existing) ? existing[0]?.payload : null;
  } catch (_error) { /* ilk snapshot olabilir */ }
  const score = fixture.score || {};
  const homeName = fixture.home_name || fixture.ev || fixture.home?.name || "Ev sahibi";
  const awayName = fixture.away_name || fixture.konuk || fixture.away?.name || "Deplasman";
  const payload = {
    ...(previousPayload && typeof previousPayload === "object" ? previousPayload : {}),
    id:fixtureKey,
    leagueKey,
    providerLeagueId,
    startedAt:fixture.kickoff_utc || fixture.kickoff || fixture.starting_at || null,
    status:fixture.status || "scheduled",
    minute:Number.isFinite(Number(fixture.minute)) ? Number(fixture.minute) : null,
    home:{ id:String(fixture.home_team_id || fixture.home?.id || ""), name:homeName, logo:fixture.home_logo || fixture.home?.image_path || null, score:Number.isFinite(Number(score.home)) ? Number(score.home) : null },
    away:{ id:String(fixture.away_team_id || fixture.away?.id || ""), name:awayName, logo:fixture.away_logo || fixture.away?.image_path || null, score:Number.isFinite(Number(score.away)) ? Number(score.away) : null },
    matchday:body,
  };
  try {
    await supabaseRest(env, "live_match_snapshots?on_conflict=fixture_id", {
      method:"POST",
      headers:{ Prefer:"resolution=merge-duplicates,return=minimal" },
      body:JSON.stringify({
        fixture_id:fixtureKey,
        provider:"sportmonks",
        sport:"football",
        league_key:leagueKey,
        status:fixture.status || "scheduled",
        minute:Number.isFinite(Number(fixture.minute)) ? Number(fixture.minute) : null,
        home_score:Number.isFinite(Number(score.home)) ? Number(score.home) : null,
        away_score:Number.isFinite(Number(score.away)) ? Number(score.away) : null,
        payload,
        provider_updated_at:body.updatedAt || new Date().toISOString(),
        fetched_at:new Date().toISOString(),
        expires_at:new Date(Date.now() + 24 * 3600000).toISOString(),
        checksum:liveSnapshotChecksum(payload),
      }),
    });
  } catch (_error) { /* cache yazimi ana yaniti engellemez */ }
}

async function persistSeasonFixtures(env, leagueKey, matches) {
  if (!supabaseServiceKey(env) || !Array.isArray(matches) || !matches.length) return;
  const rows = matches.map((fixture) => {
    const providerFixtureId = String(fixture?.provider_fixture_id || fixture?.id || "").replace(/^sportmonks:/, "");
    if (!/^\d+$/.test(providerFixtureId)) return null;
    return {
      provider:"sportmonks",
      provider_fixture_id:providerFixtureId,
      sport:"football",
      league_key:leagueKey,
      provider_league_id:String(fixture?.provider_league_id || "") || null,
      season_id:String(fixture?.provider_season_id || "") || null,
      kickoff_utc:fixture?.kickoff_utc || fixture?.kickoff || fixture?.starting_at || null,
      home_provider_id:String(fixture?.home_team_id || fixture?.home?.id || "") || null,
      away_provider_id:String(fixture?.away_team_id || fixture?.away?.id || "") || null,
      canonical_state:fixture?.status || (fixture?.result ? "bitti" : "scheduled"),
      updated_at:new Date().toISOString(),
    };
  }).filter(Boolean);
  if (!rows.length) return;
  try {
    await supabaseRest(env, "provider_fixtures?on_conflict=provider,provider_fixture_id", {
      method:"POST",
      headers:{ Prefer:"resolution=merge-duplicates,return=minimal" },
      body:JSON.stringify(rows),
    });
  } catch (_error) { /* sezon yanıtını engellemez */ }
}

async function readDueProviderFixtures(env, now = Date.now()) {
  if (!supabaseServiceKey(env)) return [];
  const from = new Date(now - 4 * 3600000).toISOString();
  const until = new Date(now + 26 * 3600000).toISOString();
  try {
    const rows = await supabaseRest(env, `provider_fixtures?sport=eq.football&kickoff_utc=gte.${encodeURIComponent(from)}&kickoff_utc=lte.${encodeURIComponent(until)}&order=kickoff_utc.asc&limit=80&select=provider_fixture_id,league_key,kickoff_utc,canonical_state`);
    return Array.isArray(rows) ? rows.filter((row) => SELECTED_LEAGUE_KEYS.has(String(row?.league_key || ""))) : [];
  } catch (_error) {
    return [];
  }
}

// Her upstream cagri denemesini gozlemlenebilirlik icin kaydeder. Best-effort:
// bu kayit basarisiz olsa bile ana istek akisini bozmaz (context.waitUntil ile
// cagirilmalidir).
async function recordSyncRun(env, { endpointClass, scopeKey, startedAt, httpStatus, outcome, rateLimitRemaining = null, rateLimitReset = null, errorCode = null }) {
  if (!supabaseServiceKey(env)) return;
  try {
    await supabaseRest(env, "provider_sync_runs", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        endpoint_class: endpointClass,
        scope_key: scopeKey,
        started_at: new Date(startedAt).toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
        http_status: httpStatus,
        outcome,
        rate_limit_remaining: rateLimitRemaining,
        rate_limit_reset: rateLimitReset,
        error_code: errorCode,
      }),
    });
  } catch (_error) { /* gozlemlenebilirlik ikincildir */ }
}

// Son LIVE_CIRCUIT_WINDOW deneme ust uste basarisizsa (ok disi outcome)
// circuit'i acik sayar; bu sirada upstream'e hic gidilmez, dogrudan kalici
// snapshot sunulur. Boylece surekli 429/5xx alan bir saglayici sonsuz
// yeniden denemeyle kotayi tuketmeye devam etmez.
async function isCircuitOpen(env, endpointClass, scopeKey) {
  if (!supabaseServiceKey(env)) return false;
  try {
    const rows = await supabaseRest(
      env,
      `provider_sync_runs?endpoint_class=eq.${encodeURIComponent(endpointClass)}&scope_key=eq.${encodeURIComponent(scopeKey)}&order=started_at.desc&limit=${LIVE_CIRCUIT_WINDOW}&select=outcome,finished_at`
    );
    if (!Array.isArray(rows) || rows.length < LIVE_CIRCUIT_FAILURE_THRESHOLD) return false;
    const recentFailures = rows.slice(0, LIVE_CIRCUIT_FAILURE_THRESHOLD);
    const allFailed = recentFailures.every((row) => row.outcome && row.outcome !== "ok");
    if (!allFailed) return false;
    const lastFailureAt = Date.parse(recentFailures[0]?.finished_at || "");
    return Number.isFinite(lastFailureAt) && Date.now() - lastFailureAt < LIVE_CIRCUIT_OPEN_SECONDS * 1000;
  } catch (_error) {
    return false;
  }
}

async function handlePredictGameStatus(request, env) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  const user = await getAuthUser(request, env);
  if (!user) return jsonResponse({ authenticated: false, reward_eligible: false, training: false }, 200, { "Cache-Control": "no-store" });
  const today = new Date().toISOString().slice(0, 10);
  const rows = await supabaseRest(env, `predict_game_sessions?user_id=eq.${encodeURIComponent(user.id)}&reward_date=eq.${today}&reward_claimed=eq.true&select=id`);
  const eligible = !Array.isArray(rows) || rows.length === 0;
  return jsonResponse({ authenticated: true, reward_eligible: eligible, training: !eligible, reward_date: today }, 200, { "Cache-Control": "no-store" });
}

async function handlePredictGameSession(request, env) {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  const body = await readJsonBody(request);
  const user = await getAuthUser(request, env);
  const guestSessionId = cleanToken(body.guestSessionId, 96);
  const today = new Date().toISOString().slice(0, 10);
  let rewardEligible = Boolean(user?.id);
  if (user?.id) {
    const rows = await supabaseRest(env, `predict_game_sessions?user_id=eq.${encodeURIComponent(user.id)}&reward_date=eq.${today}&reward_claimed=eq.true&select=id`);
    rewardEligible = !Array.isArray(rows) || rows.length === 0;
  }
  const inserted = await supabaseRest(env, "predict_game_sessions", {
    method: "POST",
    body: JSON.stringify({
      user_id: user?.id || null,
      guest_session_id: guestSessionId,
      status: "started",
      reward_eligible: rewardEligible,
      nonce: predictGameNonce(),
    }),
  });
  return jsonResponse({ session: inserted?.[0] || null }, 200, { "Cache-Control": "no-store" });
}

async function handlePredictGameComplete(request, env) {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  const body = await readJsonBody(request);
  const sessionId = cleanUuid(body.sessionId);
  const guestSessionId = cleanToken(body.guestSessionId, 96);
  const goals = Number(body.goals);
  const misses = Number(body.misses);
  const finalState = String(body.finalState || "");
  const idempotencyKey = cleanToken(body.idempotencyKey, 120) || sessionId;
  const nonce = cleanToken(body.nonce, 96);
  const events = body.events;
  const elapsedMs = Number(body.elapsedMs);
  if (!sessionId) return jsonResponse({ error: "invalid_session" }, 400, { "Cache-Control": "no-store" });
  if (!Number.isInteger(goals) || goals < 0 || goals > PREDICT_GAME.TARGET_GOALS) return jsonResponse({ error: "invalid_goals" }, 400, { "Cache-Control": "no-store" });
  if (!Number.isInteger(misses) || misses < 0 || misses > PREDICT_GAME.MAX_MISSES) return jsonResponse({ error: "invalid_misses" }, 400, { "Cache-Control": "no-store" });
  if (!["GAME_SUCCESS", "GAME_OVER"].includes(finalState)) return jsonResponse({ error: "invalid_final_state" }, 400, { "Cache-Control": "no-store" });

  const user = await getAuthUser(request, env);
  const ownerFilter = user?.id
    ? `user_id=eq.${encodeURIComponent(user.id)}`
    : `guest_session_id=eq.${encodeURIComponent(guestSessionId || "")}`;
  const sessions = await supabaseRest(env, `predict_game_sessions?id=eq.${sessionId}&${ownerFilter}&select=id,user_id,guest_session_id,status,nonce,started_at`);
  const gameSession = Array.isArray(sessions) ? sessions[0] : null;
  if (!gameSession) return jsonResponse({ error: "Bu oyun oturumu size ait değil." }, 403, { "Cache-Control": "no-store" });
  const finishedAt = Date.now();
  if (!validatePredictGameEvents(gameSession, nonce, events, elapsedMs, goals, misses, finalState, finishedAt)) {
    await supabaseRest(env, `predict_game_sessions?id=eq.${sessionId}&${ownerFilter}&status=eq.started`, {
      method: "PATCH",
      body: JSON.stringify({ status: "invalid", finished_at: new Date(finishedAt).toISOString(), updated_at: new Date(finishedAt).toISOString() }),
    });
    return jsonResponse({ error: "Oyun sonucu doğrulanamadı." }, 400, { "Cache-Control": "no-store" });
  }
  if (!user?.id) {
    const rows = await supabaseRest(env, `predict_game_sessions?id=eq.${sessionId}&guest_session_id=eq.${encodeURIComponent(guestSessionId || "")}&status=eq.started`, {
      method: "PATCH",
      body: JSON.stringify({
        status: finalState === "GAME_SUCCESS" ? "game_success" : "game_over",
        goals,
        misses,
        points_earned: predictPoints(goals),
        finished_at: new Date().toISOString(),
        idempotency_key: idempotencyKey,
      }),
    });
    if (!Array.isArray(rows) || rows.length === 0) {
      return jsonResponse({ error: "Oyun oturumu daha önce tamamlanmış." }, 409, { "Cache-Control": "no-store" });
    }
    return jsonResponse({ session: rows?.[0] || null, reward: { claimed: false, points: predictPoints(goals), guest: true } }, 200, { "Cache-Control": "no-store" });
  }

  const rpc = await supabaseRest(env, "rpc/claim_predict_game_reward", {
    method: "POST",
    body: JSON.stringify({
      p_session_id: sessionId,
      p_user_id: user.id,
      p_guest_session_id: guestSessionId,
      p_goals: goals,
      p_misses: misses,
      p_final_state: finalState,
      p_idempotency_key: idempotencyKey,
      p_nonce: nonce,
      p_events: events,
      p_elapsed_ms: elapsedMs,
    }),
  });
  return jsonResponse({ reward: rpc, points: rpc?.points ?? predictPoints(goals) }, 200, { "Cache-Control": "no-store" });
}

function sanitizeAnalyticsProperties(properties) {
  const out = {};
  for (const [key, value] of Object.entries(properties || {}).slice(0, 24)) {
    if (!/^[a-zA-Z0-9_:-]{1,48}$/.test(key)) continue;
    if (/email|phone|token|jwt|secret|password|address|ip/i.test(key)) continue;
    if (typeof value === "boolean") out[key] = value;
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (value != null) out[key] = String(value).slice(0, 180);
  }
  return out;
}

async function handleAnalyticsEvent(request, env) {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  const body = await readJsonBody(request, 6144);
  const name = String(body.name || "").trim().slice(0, 64);
  const eventUuid = cleanUuid(body.event_uuid);
  if (!eventUuid || !/^[a-zA-Z0-9_:-]{1,64}$/.test(name)) return jsonResponse({ error: "invalid_event" }, 400, { "Cache-Control": "no-store" });
  const user = await getAuthUser(request, env);
  const analyticsUserId = cleanUuid(body.analytics_user_id);
  const userAgent = request.headers.get("User-Agent") || "";
  const hash = userAgent ? await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userAgent)).then((buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("")) : null;
  try {
    await supabaseRest(env, "analytics_events", {
      method: "POST",
      body: JSON.stringify({
        event_uuid: eventUuid,
        user_id: user?.id || null,
        analytics_user_id: analyticsUserId,
        name,
        properties: sanitizeAnalyticsProperties(body.properties),
        user_agent_hash: hash,
      }),
    });
  } catch (error) {
    if (!String(error?.message || "").includes("duplicate")) throw error;
  }
  return jsonResponse({ ok: true }, 200, { "Cache-Control": "no-store" });
}

async function xRequest(pathname, token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), X_TIMEOUT_MS);
  try {
    const response = await fetch(`https://api.x.com${pathname}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error(`X API ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function edgeCache() {
  try {
    return typeof caches === "undefined" ? null : caches.default || null;
  } catch {
    return null;
  }
}

async function readEdgeCache(cache, key) {
  if (!cache) return null;
  try {
    return await cache.match(key);
  } catch {
    return null;
  }
}

function isUsableJsonCache(response) {
  return Boolean(response?.ok && String(response.headers.get("Content-Type") || "").toLowerCase().includes("application/json"));
}

function writeEdgeCache(cache, key, response, context) {
  if (!cache || !context?.waitUntil) return;
  try {
    context.waitUntil(cache.put(key, response.clone()).catch(() => {}));
  } catch {
    // The response still succeeds when the runtime cache is unavailable.
  }
}

function xDailyClubScope(league) {
  return (X_CLUBS_BY_LEAGUE[league] || []).slice(0, X_CLUB_DAILY_LIMIT);
}

function xDailyPublisherScope(league) {
  return (X_PUBLISHERS_BY_LEAGUE[league] || []).slice(0, X_PUBLISHER_DAILY_LIMIT);
}

function xDailyPreseasonScope(league) {
  return (X_CLUBS_BY_LEAGUE[league] || []).slice(0, X_PRESEASON_DAILY_LIMIT);
}

function xCreditsPayload(league, type = "media") {
  const clubs = type === "preseason"
    ? xDailyPreseasonScope(league).map((club) => ({ ...club, preseason_post: null, account_found: true, upstream_error: "x_credits_depleted" }))
    : xDailyClubScope(league).map((club) => ({ ...club, post: null, account_found: true, upstream_error: "x_credits_depleted" }));
  const publishers = type === "preseason"
    ? []
    : xDailyPublisherScope(league).map((club) => ({ ...club, publisher: true, post: null, posts: [], account_found: true, upstream_error: "x_credits_depleted" }));
  return {
    source: "x-api",
    league,
    status: "x_credits_depleted",
    cost_profile: "daily-capped-safe-mode",
    updated_at: new Date().toISOString(),
    cache_ttl_seconds: 86400,
    clubs,
    publishers,
  };
}

function normalizeXMedia(media) {
  if (!media?.media_key) return null;
  const previewUrl = media.type === "photo" ? media.url : (media.preview_image_url || media.url);
  if (!previewUrl) return null;
  return {
    media_key: media.media_key,
    type: media.type || "photo",
    url: media.url || null,
    preview_image_url: media.preview_image_url || null,
    width: Number(media.width) || null,
    height: Number(media.height) || null,
    alt_text: media.alt_text || "",
  };
}

function normalizeXPost(club, post, mediaByKey = new Map()) {
  if (!post) return { ...club, post: null };
  const media = (post.attachments?.media_keys || [])
    .map((key) => normalizeXMedia(mediaByKey.get(key)))
    .filter(Boolean)
    .slice(0, 4);
  return {
    ...club,
    post: {
      id: post.id,
      text: post.text,
      created_at: post.created_at,
      url: `${club.url}/status/${post.id}`,
      metrics: post.public_metrics || {},
      media,
    },
  };
}

function normalizeLooseText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US");
}

function isProbablyTurkishText(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  if (/[çğıöşüÇĞİÖŞÜ]/.test(text)) return true;
  const lowered = normalizeLooseText(text);
  const strongSignals = [" ve ", " ile ", " icin ", " bugun ", " resmi ", " galibiyet ", " maca ", " mac ", " bilet ", " kamp ", " hazirlik "];
  return strongSignals.some((token) => lowered.includes(token));
}

async function translateTextToTurkish(text) {
  const source = String(text || "").trim();
  if (!source || isProbablyTurkishText(source)) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSLATE_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({
      client: "gtx",
      sl: "auto",
      tl: "tr",
      dt: "t",
      q: source.slice(0, 1800),
    });
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    const translated = Array.isArray(payload?.[0]) ? payload[0].map((part) => part?.[0] || "").join("").trim() : "";
    if (!translated) return null;
    if (normalizeLooseText(translated) === normalizeLooseText(source)) return null;
    return translated;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function xPostSearchText(post, mediaByKey = new Map()) {
  const altText = (post?.attachments?.media_keys || [])
    .map((key) => mediaByKey.get(key)?.alt_text || "")
    .filter(Boolean)
    .join(" ");
  return `${post?.text || ""} ${altText}`.trim();
}

function isPreseasonPost(post, mediaByKey = new Map()) {
  const haystack = normalizeLooseText(xPostSearchText(post, mediaByKey));
  return PRESEASON_KEYWORDS.some((keyword) => haystack.includes(normalizeLooseText(keyword)));
}

function isTransferNewsPost(post, mediaByKey = new Map()) {
  const haystack = normalizeLooseText(xPostSearchText(post, mediaByKey));
  return TRANSFER_NEWS_KEYWORDS.some((keyword) => haystack.includes(normalizeLooseText(keyword)));
}

function extractScoreline(text) {
  const match = String(text || "").match(/(^|[^\d])(\d{1,2})\s*[-:–]\s*(\d{1,2})([^\d]|$)/);
  if (!match) return null;
  if (Number(match[2]) > 15 || Number(match[3]) > 15) return null;
  return `${match[2]}-${match[3]}`;
}

function findBestPreseasonPost(posts, mediaByKey) {
  return (posts || [])
    .filter((post) => isPreseasonPost(post, mediaByKey))
    .map((post) => {
      const searchText = xPostSearchText(post, mediaByKey);
      const normalized = normalizeLooseText(searchText);
      const scoreline = extractScoreline(searchText);
      const resultSignal = MATCH_RESULT_KEYWORDS.some((keyword) => normalized.includes(normalizeLooseText(keyword)));
      return { post, searchText, scoreline, rank: (scoreline ? 100 : 0) + (resultSignal ? 25 : 0) };
    })
    .sort((a, b) => b.rank - a.rank || new Date(b.post.created_at || 0) - new Date(a.post.created_at || 0))[0] || null;
}

function preseasonLabel(post) {
  const text = normalizeLooseText(post?.text || "");
  if (extractScoreline(post?.text || "")) return "Son sonuc";
  if (text.includes("matchday") || text.includes("bugun") || text.includes("today")) return "Mac gunu";
  if (text.includes("camp") || text.includes("kamp")) return "Kamp";
  if (text.includes("play-off") || text.includes("playoff")) return "Eslesme";
  return "Hazirlik";
}

async function fetchXUsers(token, request, context) {
  const cacheUrl = new URL("/api/social/x-users-v1", request.url);
  const requestedLeague = new URL(request.url).searchParams.get("league");
  if (requestedLeague) cacheUrl.searchParams.set("league", requestedLeague);
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const cache = edgeCache();
  const cached = await readEdgeCache(cache, cacheKey);
  if (isUsableJsonCache(cached)) return cached.json();

  const league = validLeagueKey(new URL(request.url).searchParams.get("league"), { xFeed:true }) || "super-lig";
  const clubs = xDailyClubScope(league);
  const publishers = xDailyPublisherScope(league);
  const usernames = [...clubs, ...publishers].map((club) => club.handle).join(",");
  const lookup = await xRequest(`/2/users/by?usernames=${encodeURIComponent(usernames)}&user.fields=verified,verified_type,profile_image_url`, token);
  const response = jsonResponse(lookup, 200, { "Cache-Control": X_USER_CACHE });
  writeEdgeCache(cache, cacheKey, response, context);
  return lookup;
}

async function fetchXClubFeed(token, request, context) {
  const league = validLeagueKey(new URL(request.url).searchParams.get("league"), { xFeed:true }) || "super-lig";
  const clubsForLeague = xDailyClubScope(league);
  const publishersForLeague = xDailyPublisherScope(league);
  const lookup = await fetchXUsers(token, request, context);
  const users = new Map((lookup.data || []).map((user) => [String(user.username).toLowerCase(), user]));

  const loadAccount = async (club, publisher = false) => {
    try {
      const user = users.get(club.handle.toLowerCase());
      if (!user) return { ...club, publisher, post: null, account_found: false, verified: false };
      const params = new URLSearchParams({
        max_results: X_RECENT_TWEET_LIMIT,
        exclude: "replies,retweets",
        "tweet.fields": "created_at,public_metrics,attachments",
        expansions: "attachments.media_keys",
        "media.fields": "media_key,type,url,preview_image_url,width,height,alt_text",
      });
      const timeline = await xRequest(`/2/users/${encodeURIComponent(user.id)}/tweets?${params}`, token);
      const mediaByKey = new Map((timeline.includes?.media || []).map((media) => [media.media_key, media]));
      const transferRows = (timeline.data || []).filter((row) => isTransferNewsPost(row, mediaByKey)).slice(0, publisher ? 2 : 1);
      const posts = await Promise.all(transferRows.map(async (row) => {
        const normalized = normalizeXPost({ ...club, publisher }, row, mediaByKey).post;
        const translatedText = normalized?.text ? await translateTextToTurkish(normalized.text) : null;
        return normalized ? { ...normalized, translated_text_tr: translatedText } : null;
      }));
      const normalizedPosts = posts.filter(Boolean);
      return {
        ...club,
        publisher,
        account_found: true,
        verified: Boolean(user.verified || user.verified_type),
        profile_image_url: user.profile_image_url || null,
        post: normalizedPosts[0] || null,
        posts: normalizedPosts,
      };
    } catch (error) {
      if (error?.status === 402) throw error;
      return { ...club, publisher, post: null, account_found: true, verified: false, upstream_error: error?.status || "unavailable" };
    }
  };
  const clubs = await Promise.all(clubsForLeague.map((club) => loadAccount(club)));
  const publishers = await Promise.all(publishersForLeague.map((club) => loadAccount(club, true)));

  return {
    source: "x-api",
    league,
    content_scope: "transfer-only",
    cost_profile: "daily-capped-safe-mode",
    fetch_mode: "limited-club-and-publisher-watchlist",
    updated_at: new Date().toISOString(),
    cache_ttl_seconds: 86400,
    publisher_slots: publishersForLeague.length,
    clubs,
    publishers,
  };
}

async function fetchXPreseasonFeed(token, request, context) {
  const league = validLeagueKey(new URL(request.url).searchParams.get("league"), { xFeed:true }) || "super-lig";
  const clubsForLeague = xDailyPreseasonScope(league);
  const lookup = await fetchXUsers(token, request, context);
  const users = new Map((lookup.data || []).map((user) => [String(user.username).toLowerCase(), user]));

  const loadAccount = async (club) => {
    try {
      const user = users.get(club.handle.toLowerCase());
      if (!user) return { ...club, preseason_post: null, account_found: false, verified: false };
      const params = new URLSearchParams({
        max_results: X_PRESEASON_TWEET_LIMIT,
        exclude: "replies,retweets",
        "tweet.fields": "created_at,public_metrics,attachments",
        expansions: "attachments.media_keys",
        "media.fields": "media_key,type,url,preview_image_url,width,height,alt_text",
      });
      const timeline = await xRequest(`/2/users/${encodeURIComponent(user.id)}/tweets?${params}`, token);
      const mediaByKey = new Map((timeline.includes?.media || []).map((media) => [media.media_key, media]));
      const preseasonMatch = findBestPreseasonPost(timeline.data || [], mediaByKey);
      const normalized = normalizeXPost(club, preseasonMatch?.post || null, mediaByKey);
      const translatedText = normalized.post?.text ? await translateTextToTurkish(normalized.post.text) : null;
      return {
        ...club,
        account_found: true,
        verified: Boolean(user.verified || user.verified_type),
        profile_image_url: user.profile_image_url || null,
        preseason_post: normalized.post
          ? {
              ...normalized.post,
              translated_text_tr: translatedText,
              scoreline: preseasonMatch?.scoreline || extractScoreline(normalized.post.text),
              label: preseasonMatch?.scoreline ? "Son sonuc" : preseasonLabel(normalized.post),
            }
          : null,
      };
    } catch (error) {
      if (error?.status === 402) throw error;
      return { ...club, preseason_post: null, account_found: true, verified: false, upstream_error: error?.status || "unavailable" };
    }
  };

  const clubs = await Promise.all(clubsForLeague.map((club) => loadAccount(club)));
  clubs.sort((a, b) => {
    const aTime = a.preseason_post?.created_at ? new Date(a.preseason_post.created_at).getTime() : 0;
    const bTime = b.preseason_post?.created_at ? new Date(b.preseason_post.created_at).getTime() : 0;
    return bTime - aTime || String(a.team).localeCompare(String(b.team), "tr");
  });
  return {
    source: "x-api",
    league,
    cost_profile: "daily-capped-safe-mode",
    updated_at: new Date().toISOString(),
    cache_ttl_seconds: 86400,
    clubs,
  };
}

async function handleXClubFeed(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  if (!env.X_BEARER_TOKEN) return jsonResponse({ error: "x_not_configured" }, 503, { "Cache-Control": "no-store" });

  const cacheUrl = new URL("/api/football/x-media-v4", request.url);
  const requestedLeague = new URL(request.url).searchParams.get("league");
  const league = validLeagueKey(requestedLeague, { xFeed:true });
  if (!league) return jsonResponse({ error:"invalid_league" }, 400, { "Cache-Control":"no-store" });
  if (requestedLeague) cacheUrl.searchParams.set("league", requestedLeague);
  if (isXFeedPausedRequest(request)) {
    const payload = xPausedPayload(league, "media");
    const response = jsonResponse(payload, 200, { "Cache-Control": SOCIAL_CACHE, "X-Data-Stale": "true", "X-Data-Status": "x_feed_paused" });
    return response;
  }
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const staleUrl = new URL("/api/football/x-media-stale-v4", request.url);
  if (requestedLeague) staleUrl.searchParams.set("league", requestedLeague);
  const staleKey = new Request(staleUrl.toString(), { method: "GET" });
  const cache = edgeCache();
  const cached = await readEdgeCache(cache, cacheKey);
  if (isUsableJsonCache(cached)) return cached;
  const stale = await readEdgeCache(cache, staleKey);

  try {
    if (!xFeedRefreshPromises.has(league)) xFeedRefreshPromises.set(league, fetchXClubFeed(env.X_BEARER_TOKEN, request, context));
    const payload = await xFeedRefreshPromises.get(league);
    const response = jsonResponse(payload, 200, { "Cache-Control": SOCIAL_CACHE, "X-Data-Stale": "false" });
    const staleResponse = jsonResponse(payload, 200, { "Cache-Control": SOCIAL_STALE_CACHE });
    writeEdgeCache(cache, cacheKey, response, context);
    writeEdgeCache(cache, staleKey, staleResponse, context);
    return response;
  } catch (error) {
    if (stale) {
      const headers = new Headers(stale.headers);
      headers.set("Cache-Control", "public, max-age=60, s-maxage=300");
      headers.set("Warning", '110 - "Response is stale"');
      headers.set("X-Data-Stale", "true");
      return new Response(stale.body, { status: 200, headers });
    }
    if (error?.status === 402) {
      const payload = xCreditsPayload(league, "media");
      const response = jsonResponse(payload, 200, { "Cache-Control": SOCIAL_CACHE, "X-Data-Stale": "true", "X-Data-Status": "x_credits_depleted" });
      const staleResponse = jsonResponse(payload, 200, { "Cache-Control": SOCIAL_STALE_CACHE, "X-Data-Stale": "true", "X-Data-Status": "x_credits_depleted" });
      writeEdgeCache(cache, cacheKey, response, context);
      writeEdgeCache(cache, staleKey, staleResponse, context);
      return response;
    }
    return jsonResponse({ error: "x_upstream_unavailable" }, 502, { "Cache-Control": "no-store", "Retry-After": "300" });
  } finally {
    xFeedRefreshPromises.delete(league);
  }
}

async function handleXPreseasonFeed(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  if (!env.X_BEARER_TOKEN) return jsonResponse({ error: "x_not_configured" }, 503, { "Cache-Control": "no-store" });

  const cacheUrl = new URL("/api/football/x-preseason-v1", request.url);
  const requestedLeague = new URL(request.url).searchParams.get("league");
  const league = validLeagueKey(requestedLeague, { xFeed:true });
  if (!league) return jsonResponse({ error:"invalid_league" }, 400, { "Cache-Control":"no-store" });
  if (requestedLeague) cacheUrl.searchParams.set("league", requestedLeague);
  if (isXFeedPausedRequest(request)) {
    const payload = xPausedPayload(league, "preseason");
    const response = jsonResponse(payload, 200, { "Cache-Control": X_PRESEASON_CACHE, "X-Data-Stale": "true", "X-Data-Status": "x_feed_paused" });
    return response;
  }
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const staleUrl = new URL("/api/football/x-preseason-stale-v1", request.url);
  if (requestedLeague) staleUrl.searchParams.set("league", requestedLeague);
  const staleKey = new Request(staleUrl.toString(), { method: "GET" });
  const cache = edgeCache();
  const cached = await readEdgeCache(cache, cacheKey);
  if (isUsableJsonCache(cached)) return cached;
  const stale = await readEdgeCache(cache, staleKey);

  try {
    if (!xPreseasonRefreshPromises.has(league)) xPreseasonRefreshPromises.set(league, fetchXPreseasonFeed(env.X_BEARER_TOKEN, request, context));
    const payload = await xPreseasonRefreshPromises.get(league);
    const response = jsonResponse(payload, 200, { "Cache-Control": X_PRESEASON_CACHE, "X-Data-Stale": "false" });
    const staleResponse = jsonResponse(payload, 200, { "Cache-Control": X_PRESEASON_STALE_CACHE });
    writeEdgeCache(cache, cacheKey, response, context);
    writeEdgeCache(cache, staleKey, staleResponse, context);
    return response;
  } catch (error) {
    if (stale) {
      const headers = new Headers(stale.headers);
      headers.set("Cache-Control", "public, max-age=120, s-maxage=900");
      headers.set("Warning", '110 - "Response is stale"');
      headers.set("X-Data-Stale", "true");
      return new Response(stale.body, { status: 200, headers });
    }
    if (error?.status === 402) {
      const payload = xCreditsPayload(league, "preseason");
      const response = jsonResponse(payload, 200, { "Cache-Control": X_PRESEASON_CACHE, "X-Data-Stale": "true", "X-Data-Status": "x_credits_depleted" });
      const staleResponse = jsonResponse(payload, 200, { "Cache-Control": X_PRESEASON_STALE_CACHE, "X-Data-Stale": "true", "X-Data-Status": "x_credits_depleted" });
      writeEdgeCache(cache, cacheKey, response, context);
      writeEdgeCache(cache, staleKey, staleResponse, context);
      return response;
    }
    return jsonResponse({ error: "x_upstream_unavailable" }, 502, { "Cache-Control": "no-store", "Retry-After": "900" });
  } finally {
    xPreseasonRefreshPromises.delete(league);
  }
}

async function youtubeRequest(pathname, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), YOUTUBE_TIMEOUT_MS);
  try {
    const separator = pathname.includes("?") ? "&" : "?";
    const response = await fetch(`https://www.googleapis.com/youtube/v3${pathname}${separator}key=${encodeURIComponent(apiKey)}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error(`YouTube API ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchYouTubeMedia(apiKey, league) {
  const query = YOUTUBE_QUERY_BY_LEAGUE[league] || YOUTUBE_QUERY_BY_LEAGUE.all;
  const channelResults = await Promise.all(YOUTUBE_CHANNELS.map(async (channel) => {
    const params = new URLSearchParams({ part: "snippet", channelId: channel.id, q:query, maxResults: "4", order: "date", type: "video" });
    const payload = await youtubeRequest(`/search?${params}`, apiKey);
    return (payload.items || []).map((item) => ({ ...item, channel }));
  }));
  const searchItems = channelResults.flat();
  const videoIds = [...new Set(searchItems.map((item) => item.id?.videoId).filter(Boolean))];
  let detailById = new Map();
  if (videoIds.length) {
    const params = new URLSearchParams({ part: "snippet,contentDetails,liveStreamingDetails", id: videoIds.join(",") });
    const details = await youtubeRequest(`/videos?${params}`, apiKey);
    detailById = new Map((details.items || []).map((item) => [item.id, item]));
  }
  const items = searchItems.map((item) => {
    const id = item.id.videoId;
    const detail = detailById.get(id) || {};
    const snippet = detail.snippet || item.snippet || {};
    const liveState = snippet.liveBroadcastContent || item.snippet?.liveBroadcastContent || "none";
    const thumbnail = snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || "";
    return {
      id,
      title: snippet.title || "YouTube yayını",
      channelTitle: snippet.channelTitle || item.channel.name,
      channelHandle: item.channel.handle,
      publishedAt: snippet.publishedAt || item.snippet?.publishedAt || null,
      thumbnail,
      duration: detail.contentDetails?.duration || null,
      live: liveState === "live",
      upcoming: liveState === "upcoming",
      concurrentViewers: detail.liveStreamingDetails?.concurrentViewers || null,
      url: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
    };
  }).filter((item) => item.id && item.thumbnail);
  const scopedItems = items.filter((item) => youtubeTitleMatchesLeague(item.title, league));
  scopedItems.sort((a, b) => Number(b.live) - Number(a.live) || Number(b.upcoming) - Number(a.upcoming) || new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  return { source: "youtube-data-api-v3", league, query, updated_at: new Date().toISOString(), refresh_seconds: 5400, channels: YOUTUBE_CHANNELS, items: scopedItems.slice(0, 8) };
}

function decodeXmlText(value) {
  return String(value || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

async function fetchYouTubeRssFallback(league) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), YOUTUBE_TIMEOUT_MS);
  try {
    const results = await Promise.allSettled(YOUTUBE_CHANNELS.map(async (channel) => {
      const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channel.id)}`, { headers: { Accept: "application/atom+xml, application/xml;q=0.9" }, signal: controller.signal });
      if (!response.ok) throw new Error(`YouTube RSS ${response.status}`);
      const xml = await response.text();
      return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => {
        const entry = match[1];
        const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] || "";
        const title = decodeXmlText(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "");
        return { id, title, channelTitle: channel.name, channelHandle: channel.handle, publishedAt: entry.match(/<published>([^<]+)<\/published>/)?.[1] || null, thumbnail: entry.match(/<media:thumbnail[^>]+url="([^"]+)"/)?.[1] || (id ? `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg` : ""), duration: null, live: false, upcoming: false, concurrentViewers: null, url: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` };
      });
    }));
    const items = results.flatMap((result) => result.status === "fulfilled" ? result.value : []).filter((item) => item.id && item.thumbnail && youtubeTitleMatchesLeague(item.title, league));
    items.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
    return { source: "youtube-channel-rss", league, query: YOUTUBE_QUERY_BY_LEAGUE[league] || YOUTUBE_QUERY_BY_LEAGUE.all, updated_at: new Date().toISOString(), refresh_seconds: 5400, channels: YOUTUBE_CHANNELS, items: items.slice(0, 8) };
  } finally {
    clearTimeout(timeout);
  }
}

async function handleYouTubeMedia(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  if (!env.YOUTUBE_API_KEY) return jsonResponse({ error: "youtube_not_configured", channels: YOUTUBE_CHANNELS }, 503, { "Cache-Control": "no-store" });
  const requestUrl = new URL(request.url);
  const league = Object.hasOwn(YOUTUBE_QUERY_BY_LEAGUE, requestUrl.searchParams.get("league")) ? requestUrl.searchParams.get("league") : "all";
  const cacheUrl = new URL(request.url); cacheUrl.search = `?league=${encodeURIComponent(league)}&v=3`;
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const staleUrl = new URL(`/api/media/youtube-stale-v3/${encodeURIComponent(league)}`, request.url);
  const staleKey = new Request(staleUrl.toString(), { method: "GET" });
  const legacyUrl = new URL(request.url); legacyUrl.search = `?league=${encodeURIComponent(league)}`;
  const legacyStaleUrl = new URL(`/api/media/youtube-stale-v2/${encodeURIComponent(league)}`, request.url);
  const cache = edgeCache();
  const cached = await readEdgeCache(cache, cacheKey); if (isUsableJsonCache(cached)) return cached;
  const stale = await readEdgeCache(cache, staleKey);
  const legacy = await readEdgeCache(cache, new Request(legacyUrl.toString(), { method: "GET" }))
    || await readEdgeCache(cache, new Request(legacyStaleUrl.toString(), { method: "GET" }));
  try {
    if (!youtubeFeedRefreshPromises.has(league)) youtubeFeedRefreshPromises.set(league, fetchYouTubeMedia(env.YOUTUBE_API_KEY, league));
    const payload = await youtubeFeedRefreshPromises.get(league);
    const response = jsonResponse(payload, 200, { "Cache-Control": YOUTUBE_CACHE, "X-Data-Stale": "false" });
    writeEdgeCache(cache, cacheKey, response, context);
    writeEdgeCache(cache, staleKey, jsonResponse(payload, 200, { "Cache-Control": YOUTUBE_STALE_CACHE }), context);
    return response;
  } catch (error) {
    if (stale) {
      const headers = new Headers(stale.headers); headers.set("X-Data-Stale", "true"); headers.set("Warning", '110 - "Response is stale"');
      return new Response(stale.body, { status: 200, headers });
    }
    if (legacy) {
      const legacyPayload = await legacy.json().catch(() => null);
      if (legacyPayload && Array.isArray(legacyPayload.items)) {
        const payload = { ...legacyPayload, league, items: legacyPayload.items.filter((item) => youtubeTitleMatchesLeague(item?.title, league)).slice(0, 8) };
        const response = jsonResponse(payload, 200, { "Cache-Control": YOUTUBE_CACHE, "X-Data-Stale": "true", Warning: '110 - "Response is stale"' });
        writeEdgeCache(cache, cacheKey, response, context);
        return response;
      }
    }
    if (error?.status !== 403) {
      const payload = await fetchYouTubeRssFallback(league).catch(() => null);
      if (payload) {
        const response = jsonResponse(payload, 200, { "Cache-Control": YOUTUBE_CACHE, "X-Data-Stale": "false", "X-Data-Source": "youtube-channel-rss" });
        writeEdgeCache(cache, cacheKey, response, context);
        writeEdgeCache(cache, staleKey, jsonResponse(payload, 200, { "Cache-Control": YOUTUBE_STALE_CACHE }), context);
        return response;
      }
    }
    return jsonResponse({ error: error?.status === 403 ? "youtube_quota_or_key_error" : "youtube_upstream_unavailable", channels: YOUTUBE_CHANNELS }, error?.status === 403 ? 403 : 502, { "Cache-Control": "no-store", "Retry-After": "900" });
  } finally {
    youtubeFeedRefreshPromises.delete(league);
  }
}

function relationRows(value) {
  const data = value && typeof value === "object" && "data" in value ? value.data : value;
  if (Array.isArray(data)) return data;
  return data && typeof data === "object" ? [data] : [];
}

function normalizedFootballName(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "");
}

async function sportmonksRequest(pathname, token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SPORTMONKS_TIMEOUT_MS);
  try {
    const requestUrl = new URL(`https://api.sportmonks.com/v3/football${pathname}`);
    if (!requestUrl.searchParams.has("api_token")) requestUrl.searchParams.set("api_token", token);
    const response = await fetch(requestUrl.toString(), {
      headers: { Authorization: token, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      const payload = /\bjson\b/i.test(String(response.headers.get('content-type') || ''))
        ? await response.json().catch(() => ({}))
        : {};
      const error = new Error(`Sportmonks API ${response.status}`);
      error.status = response.status;
      error.providerMessage = payload?.message || null;
      throw error;
    }
    return await parseProviderJson(response, 'sportmonks');
  } finally {
    clearTimeout(timeout);
  }
}

async function sportmonksCoreRequest(pathname, token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SPORTMONKS_TIMEOUT_MS);
  try {
    const requestUrl = new URL(`https://api.sportmonks.com/v3${pathname}`);
    if (!requestUrl.searchParams.has("api_token")) requestUrl.searchParams.set("api_token", token);
    const response = await fetch(requestUrl.toString(), {
      headers: { Authorization: token, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      const payload = /\bjson\b/i.test(String(response.headers.get('content-type') || ''))
        ? await response.json().catch(() => ({}))
        : {};
      const error = new Error(`Sportmonks API ${response.status}`);
      error.status = response.status;
      error.providerMessage = payload?.message || null;
      throw error;
    }
    return await parseProviderJson(response, 'sportmonks');
  } finally {
    clearTimeout(timeout);
  }
}

async function handleFootballCoverage(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error:"method_not_allowed" }, 405, { Allow:"GET" });
  const token = env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN;
  if (!token) return jsonResponse({ error:"sportmonks_not_configured", provider:"sportmonks" }, 503, { "Cache-Control":"no-store" });
  const cacheUrl = new URL("/api/football/coverage-v8", request.url); cacheUrl.search = "";
  const cache = edgeCache(); const cacheKey = new Request(cacheUrl.toString(), { method:"GET" });
  const cached = await readEdgeCache(cache, cacheKey); if (isUsableJsonCache(cached)) return cached;
  try {
    const payload = await sportmonksCoreRequest("/my/leagues", token);
    const availableIds = new Set();
    const subscribedById = new Map();
    const visit = (value, depth = 0) => {
      if (!value || depth > 6) return;
      if (Array.isArray(value)) { value.forEach((row) => visit(row, depth + 1)); return; }
      if (typeof value !== "object") return;
      const leagueId = value.league_id || value.league?.id || ((value.name || value.short_code || value.image_path) ? value.id : null);
      if (leagueId !== null && leagueId !== undefined && String(leagueId)) {
        const id = String(leagueId);
        availableIds.add(id);
        const name = value.league?.name || value.name || value.short_code || null;
        if (name && !subscribedById.has(id)) subscribedById.set(id, String(name));
      }
      Object.values(value).forEach((row) => visit(row, depth + 1));
    };
    visit(payload?.data);
    const selected = await Promise.all(Object.entries(SELECTED_LEAGUE_IDS_BY_KEY).filter(([key]) => key !== "all").map(async ([league, ids]) => {
      const leagueId = String(ids[0]);
      const subscriptionReported = availableIds.has(leagueId);
      if (!subscriptionReported) return {
        league, leagueId, name:SELECTED_LEAGUE_NAMES_BY_KEY[league] || null,
        available:false, subscriptionReported:false, metadataAvailable:false,
        currentSeasonId:null, reason:"not_in_subscription",
        capabilities:{ fixtures:false, results:false, standings:false, live:false },
      };
      try {
        const probe = await sportmonksRequest(`/leagues/${encodeURIComponent(leagueId)}?include=currentSeason`, token);
        const row = relationRows(probe?.data)[0] || null;
        const currentSeason = sportmonksCurrentSeason(row);
        let fixturesAvailable = false;
        let scheduleStatus = null;
        if (currentSeason?.id) {
          try {
            await sportmonksRequest(`/schedules/seasons/${encodeURIComponent(currentSeason.id)}`, token);
            fixturesAvailable = true;
          } catch (error) { scheduleStatus = error?.status || 502; }
        }
        const metadataAvailable = Boolean(row?.id);
        const reason = !metadataAvailable ? "metadata_unavailable" : !currentSeason?.id ? "season_unavailable" : !fixturesAvailable ? "fixtures_unavailable" : "ready";
        return { league, leagueId, name:row?.name || SELECTED_LEAGUE_NAMES_BY_KEY[league] || null, available:fixturesAvailable, subscriptionReported, metadataAvailable, currentSeasonId:currentSeason?.id ? String(currentSeason.id) : null, reason, status:scheduleStatus, capabilities:{ fixtures:fixturesAvailable, results:fixturesAvailable, standings:fixturesAvailable, live:fixturesAvailable } };
      } catch (error) {
        return { league, leagueId, name:SELECTED_LEAGUE_NAMES_BY_KEY[league] || null, available:false, subscriptionReported, metadataAvailable:false, currentSeasonId:null, reason:error?.status === 403 ? "plan_restricted" : "provider_error", status:error?.status || 502, capabilities:{ fixtures:false, results:false, standings:false, live:false } };
      }
    }));
    const subscribed = [...availableIds].map((leagueId) => ({ leagueId, name:subscribedById.get(leagueId) || null })).sort((a,b) => String(a.name || a.leagueId).localeCompare(String(b.name || b.leagueId)));
    const response = jsonResponse({ source:"sportmonks-selected-league-probes", updatedAt:new Date().toISOString(), myLeaguesReportedCount:availableIds.size, subscribed, selected }, 200, { "Cache-Control":"public, max-age=300, s-maxage=3600" });
    writeEdgeCache(cache, cacheKey, response, context); return response;
  } catch (error) {
    return jsonResponse({ error:error?.status === 401 ? "sportmonks_token_invalid" : error?.status === 403 ? "sportmonks_plan_restricted" : "sportmonks_upstream_unavailable", provider:"sportmonks", providerStatus:error?.status || null }, error?.status === 401 || error?.status === 403 ? error.status : 502, { "Cache-Control":"no-store", "Retry-After":"300" });
  }
}

function chooseSportmonksTeam(rows, searchName) {
  const target = normalizedFootballName(searchName);
  return rows.find((team) => normalizedFootballName(team?.name) === target)
    || rows.find((team) => normalizedFootballName(team?.name).includes(target) || target.includes(normalizedFootballName(team?.name)))
    || rows[0]
    || null;
}

function normalizeSportmonksCoach(team) {
  const rows = relationRows(team?.coaches);
  const row = rows.find((coach) => !coach?.end && !coach?.meta?.end) || rows[0];
  if (!row) return null;
  const coach = row.coach || row;
  const nationality = coach.nationality || row.nationality || {};
  return {
    id: coach.id || null,
    name: coach.display_name || coach.common_name || coach.name || null,
    image: coach.image_path || null,
    nationality: nationality.name || coach.nationality_name || null,
    dateOfBirth: coach.date_of_birth || null,
    source: "sportmonks",
  };
}

function normalizeSportmonksSquad(payload) {
  return relationRows(payload?.data).filter((row) => {
    const player = row.player || row;
    return row.in_squad !== false && player.in_squad !== false;
  }).map((row) => {
    const player = row.player || row;
    const position = row.detailedposition || row.detailedPosition || player.detailedposition || player.detailedPosition || row.position || player.position || {};
    return {
      id: player.id || row.player_id || null,
      name: player.display_name || player.common_name || player.name || row.player_name || null,
      image: player.image_path || null,
      number: row.jersey_number ?? player.jersey_number ?? null,
      position: position.name || position.code || null,
    };
  }).filter((player) => player.name);
}

function textValue(...values) {
  return values.find((value) => value !== null && value !== undefined && String(value).trim()) || "";
}

function normalizeTeamName(row, keys) {
  for (const key of keys) {
    const value = row?.[key] || row?.[key?.toLowerCase?.()] || row?.[key?.replace?.(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)];
    if (typeof value === "string") return value;
    if (value?.name || value?.display_name) return value.name || value.display_name;
  }
  return "";
}

function transferLeagueId(row) {
  return row?.league_id || row?.league?.id || row?.fromTeam?.league_id || row?.fromTeam?.league?.id || row?.toTeam?.league_id || row?.toTeam?.league?.id || row?.from?.league_id || row?.from?.league?.id || row?.to?.league_id || row?.to?.league?.id || null;
}

function normalizeTransferAmount(row) {
  const amount = row?.amount ?? row?.fee ?? row?.transfer_fee ?? row?.market_value ?? null;
  const currency = row?.currency || row?.currency_code || "EUR";
  if (amount === null || amount === undefined || amount === "") return row?.type?.name || row?.type || "Açıklanmadı";
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return String(amount);
  const compact = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 2 }).format(numeric);
  return `${currency === "EUR" ? "€" : `${currency} `}${compact}`;
}

function normalizeSportmonksTransfer(row, kind) {
  const player = row?.player || {};
  const from = normalizeTeamName(row, ["fromTeam", "fromteam", "from_team", "from"]);
  const to = normalizeTeamName(row, ["toTeam", "toteam", "to_team", "to"]);
  const probability = row?.probability || row?.certainty || row?.confidence || "";
  const source = row?.source || row?.source_name || row?.publication || (kind === "rumour" ? "Sportmonks Transfer Rumours" : "Sportmonks Transfers");
  return {
    id: String(row?.id || `${kind}:${player?.id || ""}:${from}:${to}`),
    kind,
    name: textValue(player.display_name, player.common_name, player.name, row?.player_name, "Oyuncu"),
    photo: player.image_path || row?.player_image || null,
    from: from || "Açıklanmadı",
    to: to || "Açıklanmadı",
    fee: normalizeTransferAmount(row),
    status: kind === "rumour" ? (probability ? `Söylenti · ${probability}` : "Söylenti") : (row?.completed || row?.confirmed ? "Resmî işlem" : textValue(row?.status, row?.type?.name, "Transfer")),
    detail: textValue(row?.description, row?.info, row?.type?.name, row?.date),
    date: textValue(row?.date, row?.updated_at, row?.created_at),
    source,
    sourceUrl: row?.source_url || row?.url || row?.source?.url || null,
    // Lig izolasyonu icin ham satirdaki lig kimligi normalize edilen kayitta korunur;
    // aksi halde transferLeagueId daima null doner ve lig filtresi olu kalir.
    provider_league_id: transferLeagueId(row) ? String(transferLeagueId(row)) : null,
  };
}

async function handleFootballTransfers(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  const token = env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN;
  if (!token) return jsonResponse({ error: "sportmonks_not_configured" }, 503, { "Cache-Control": "no-store" });
  const url = new URL(request.url);
  const league = validLeagueKey(url.searchParams.get("league"), { single:true });
  if (!league) return jsonResponse({ error:"invalid_league" }, 400, { "Cache-Control":"no-store" });
  const teamNames = (url.searchParams.get("teams") || "").split("|").map((name) => name.trim()).filter(Boolean);
  const teamSet = new Set(teamNames.map((name) => normalizedFootballName(name)));
  const cacheUrl = new URL(url);
  cacheUrl.search = `?league=${encodeURIComponent(league)}&teams=${encodeURIComponent(teamNames.slice(0, 80).join("|"))}`;
  const cache = edgeCache();
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const cached = await readEdgeCache(cache, cacheKey); if (cached) return cached;
  const leagueIds = SELECTED_LEAGUE_IDS_BY_KEY[league] || SELECTED_LEAGUE_IDS_BY_KEY["super-lig"];
  const leagueIdSet = new Set(leagueIds.map((id) => String(id)));
  const confirmedPath = "/transfers/latest?include=player;fromTeam;toTeam;type;position;detailedPosition&per_page=50";
  const rumoursPath = `/transfer-rumours?include=player;fromTeam;toTeam;type;position;detailedPosition&per_page=50`;
  const [confirmedResult, rumourResult] = await Promise.allSettled([
    sportmonksRequest(confirmedPath, token),
    sportmonksRequest(rumoursPath, token),
  ]);
  const errors = [];
  if (confirmedResult.status === "rejected") errors.push({ source: "transfers", status: confirmedResult.reason?.status || 502, code:publicProviderErrorCode(confirmedResult.reason) });
  if (rumourResult.status === "rejected") errors.push({ source: "transfer-rumours", status: rumourResult.reason?.status || 502, code:publicProviderErrorCode(rumourResult.reason) });
  const confirmed = confirmedResult.status === "fulfilled" ? relationRows(confirmedResult.value?.data).map((row) => normalizeSportmonksTransfer(row, "confirmed")) : [];
  const rumours = rumourResult.status === "fulfilled" ? relationRows(rumourResult.value?.data).map((row) => normalizeSportmonksTransfer(row, "rumour")) : [];
  const inScope = (row) => {
    const rowLeagueId = row?.provider_league_id || transferLeagueId(row);
    if (leagueIdSet.size && rowLeagueId && !leagueIdSet.has(String(rowLeagueId))) return false;
    // Takım listesi henüz yüklenmediyse lig kimliği olmayan global transferleri
    // kabul etme. Aksi halde yeni lige ilk geçişte başka ülkelerin kayıtları
    // cache'e girip o ligde görünür kalıyordu.
    if (!teamSet.size) return Boolean(rowLeagueId && leagueIdSet.has(String(rowLeagueId)));
    return teamSet.has(normalizedFootballName(row.from)) || teamSet.has(normalizedFootballName(row.to));
  };
  const payload = {
    source: "sportmonks-football-api-v3",
    league,
    leagueIds,
    scopeTeams: teamNames,
    updatedAt: new Date().toISOString(),
    confirmed: confirmed.filter(inScope).slice(0, 24),
    rumours: rumours.filter(inScope).slice(0, 24),
    errors,
  };
  const response = jsonResponse(payload, 200, { "Cache-Control": TRANSFER_CACHE });
  writeEdgeCache(cache, cacheKey, response, context);
  return response;
}

function sportmonksCurrentSeason(row) {
  const current = row?.currentseason || row?.currentSeason;
  const currentRows = Array.isArray(current) ? current : current ? [current] : [];
  if (currentRows[0]?.id) return currentRows[0];
  const seasons = relationRows(row?.seasons || row?.season).filter((season) => season?.id);
  if (!seasons.length) return null;
  const flagged = seasons.find((season) => season?.is_current || season?.current || season?.active);
  if (flagged?.id) return flagged;
  return seasons.slice().sort((left, right) => {
    const leftEnd = Date.parse(left?.finished_at || left?.end_date || left?.ending_at || left?.updated_at || 0) || 0;
    const rightEnd = Date.parse(right?.finished_at || right?.end_date || right?.ending_at || right?.updated_at || 0) || 0;
    if (rightEnd !== leftEnd) return rightEnd - leftEnd;
    const leftStart = Date.parse(left?.starting_at || left?.start_date || left?.created_at || 0) || 0;
    const rightStart = Date.parse(right?.starting_at || right?.start_date || right?.created_at || 0) || 0;
    return rightStart - leftStart;
  })[0];
}

function standingNumber(row, names) {
  for (const name of names) {
    if (row?.[name] !== undefined && row?.[name] !== null && Number.isFinite(Number(row[name]))) return Number(row[name]);
  }
  const details = relationRows(row?.details);
  const match = details.find((detail) => {
    const code = String(detail?.type?.code || detail?.type?.name || detail?.code || detail?.name || "").toLowerCase();
    return names.some((name) => code === name || code.includes(name));
  });
  return Number(match?.value ?? match?.points ?? match?.standing_value ?? 0) || 0;
}

// Sportmonks v3'te `form` include edilmedigi surece gelmez; include edildiginde
// ise duz string degil bir ILISKI (dizi) olarak doner. Onceki kod dogrudan
// String(row.form) yaptigi icin dizi geldiginde "[object Object]" uretirdi.
// Bu yardimci her iki sekli de guvenle en fazla 8 karakterlik W/D/L dizgisine cevirir.
function normalizeStandingForm(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 8);
  const rows = relationRows(value);
  if (!rows.length) return "";
  const letters = rows
    .slice()
    .sort((left, right) => Number(left?.sort_order ?? 0) - Number(right?.sort_order ?? 0))
    .map((entry) => {
      const raw = String(entry?.form ?? entry?.result ?? entry?.value ?? "").trim().toUpperCase();
      if (!raw) return "";
      const first = raw[0];
      // Saglayici bazi durumlarda Almanca/Ingilizce kisaltma karisik dondurebilir.
      if (first === "W" || first === "G") return "W";
      if (first === "L" || first === "M") return "L";
      if (first === "D" || first === "B" || first === "U") return "D";
      return "";
    })
    .filter(Boolean)
    .join("");
  return letters.slice(-8);
}

function normalizeProviderStanding(row, league, seasonId, index) {
  const participant = row?.participant || row?.team || {};
  const goalsFor = standingNumber(row, ["goals_for", "overall_goals_for", "scored", "goals_scored"]);
  const goalsAgainst = standingNumber(row, ["goals_against", "overall_goals_against", "conceded", "goals_conceded"]);
  return {
    season: String(seasonId), week: 0,
    team: String(participant?.name || row?.team_name || `Takım ${index + 1}`),
    played: standingNumber(row, ["played", "overall_matches_played", "matches_played", "games_played"]),
    won: standingNumber(row, ["won", "overall_won", "wins"]),
    drawn: standingNumber(row, ["draw", "drawn", "overall_draw", "draws"]),
    lost: standingNumber(row, ["lost", "overall_lost", "losses"]),
    goals_for: goalsFor, goals_against: goalsAgainst,
    goal_difference: Number(row?.goal_difference ?? row?.goaldifference ?? goalsFor - goalsAgainst) || 0,
    points: standingNumber(row, ["points", "overall_points"]),
    form: normalizeStandingForm(row?.form),
    source: "sportmonks", competition: league?.name || null, competition_logo: league?.image_path || null,
    country: league?.country?.name || null, provider_league_id: String(league?.id || ""), provider_season_id: String(seasonId),
    provider_team_id: participant?.id ? String(participant.id) : null, team_logo: participant?.image_path || null, verified_at: new Date().toISOString(),
  };
}

function normalizeProviderFixture(fixture, league, seasonId, roundNumber) {
  const participants = relationRows(fixture?.participants);
  const home = participants.find((team) => team?.meta?.location === "home") || participants[0] || {};
  const away = participants.find((team) => team?.meta?.location === "away") || participants[1] || {};
  const kickoff = fixture?.starting_at ? new Date(fixture.starting_at).toISOString() : null;
  if (!fixture?.id || !kickoff || !home?.name || !away?.name) return null;
  const stateCode = String(fixture?.state?.short_name || fixture?.state?.state || "").toUpperCase();
  const status = ["CANC", "CANCL", "CANCELLED"].includes(stateCode) ? "iptal"
    : ["POSTP", "SUSP", "DELAYED"].includes(stateCode) ? "ertelendi"
      : normalizedFootballStatus(stateCode, fixture?.state?.minute, fixture?.result_info);
  const id = `sportmonks:${fixture.id}`;
  const homeScore = fixture?.home_score ?? sportmonksScore(fixture?.scores, home.id);
  const awayScore = fixture?.away_score ?? sportmonksScore(fixture?.scores, away.id);
  return {
    id, hafta: Number(roundNumber) || 1, ev: String(home.name), konuk: String(away.name), kickoff,
    stadyum: String(fixture?.venue?.name || "Açıklanacak"), status,
    verified: true, competition: fixture?.league?.name || league?.name || null,
    competition_logo: fixture?.league?.image_path || league?.image_path || null,
    country: fixture?.league?.country?.name || league?.country?.name || null,
    provider_league_id: String(league?.id || ""), provider_season_id: String(seasonId),
    home_team_id: home?.id ? String(home.id) : null, away_team_id: away?.id ? String(away.id) : null,
    home_logo: home?.image_path || null, away_logo: away?.image_path || null,
    result: status === "bitti" && homeScore != null && awayScore != null ? { home: Number(homeScore), away: Number(awayScore) } : null,
  };
}

function normalizedFootballStatus(code, minute, resultInfo) {
  if (["HT", "BT"].includes(code)) return "devre_arasi";
  if (["1H", "2H", "ET", "P", "INT", "LIVE"].includes(code) || Number(minute) > 0) return "canlı";
  if (["FT", "AET", "PEN"].includes(code) || resultInfo) return "bitti";
  return null;
}

function sportmonksScore(scores, participantId) {
  const rows = relationRows(scores).filter((score) => String(score?.participant_id) === String(participantId));
  const current = rows.find((score) => String(score?.description || "").toUpperCase() === "CURRENT") || rows.at(-1);
  const goals = current?.score?.goals;
  return goals !== undefined && goals !== null && Number.isFinite(Number(goals)) ? Number(goals) : null;
}

function normalizeSportmonksFixtureDetails(fixture) {
  const participants = relationRows(fixture?.participants);
  const teamById = new Map(participants.map((team) => [String(team?.id), team]));
  const lineups = relationRows(fixture?.lineups).map((row) => {
    const player = row?.player || {};
    const team = teamById.get(String(row?.team_id || row?.participant_id)) || {};
    const position = row?.position || row?.detailedposition || row?.detailedPosition || {};
    return { team:team.name || null, team_id:row?.team_id || row?.participant_id || null, player_id:row?.player_id || player.id || null, player_name:row?.player_name || player.display_name || player.common_name || player.name || null, player_image:player.image_path || row?.image_path || null, number:row?.jersey_number ?? null, position:position.name || position.code || null, formation_field:row?.formation_field || null, formation_position:row?.formation_position ?? null, is_official:true, is_captain:Boolean(row?.captain), is_keeper:/goal|keeper|kaleci/i.test(position.name || position.code || ""), type_id:row?.type_id ?? null };
  }).filter((row) => row.team && row.player_name);
  const absences = relationRows(fixture?.sidelined).map((row) => {
    const player = row?.player || {};
    const team = teamById.get(String(row?.participant_id || row?.team_id)) || {};
    return { team:team.name || null, player_name:player.display_name || player.common_name || player.name || row?.player_name || null, reason:row?.reason || row?.description || row?.category || null, availability_status:row?.type?.name || row?.type || "other", verification_status:"provider", source:"Sportmonks" };
  }).filter((row) => row.team && row.player_name);
  const events = relationRows(fixture?.events).map((row) => ({ id:row?.id || null, minute:row?.minute ?? row?.sort_order ?? null, participant_id:row?.participant_id || null, team:teamById.get(String(row?.participant_id))?.name || null, player:row?.player_name || row?.player?.display_name || row?.player?.name || null, player_image:row?.player?.image_path || null, relatedPlayer:row?.related_player_name || row?.relatedplayer?.display_name || null, type_id:row?.type_id ?? null, type:row?.type?.name || row?.type?.code || row?.type || row?.addition || "Olay", result:row?.result || null })).filter((row) => row.team || row.player);
  const statistics = relationRows(fixture?.statistics).map((row) => { const location=String(row?.location || teamById.get(String(row?.participant_id))?.meta?.location || "").toLowerCase(); const team=teamById.get(String(row?.participant_id)) || (location === "home" ? participants.find((item)=>item?.meta?.location === "home") : location === "away" ? participants.find((item)=>item?.meta?.location === "away") : null); return { team:team?.name || null, participant_id:row?.participant_id || team?.id || null, location:location || null, type_id:row?.type_id ?? null, label:row?.type?.name || row?.type?.code || row?.name || null, value:row?.data?.value ?? row?.value ?? null }; }).filter((row) => row.label && row.value !== null);
  const xg = relationRows(fixture?.xgfixture || fixture?.xGFixture || fixture?.expected).map((row) => ({ participant_id:row?.participant_id || null, location:row?.location || teamById.get(String(row?.participant_id))?.meta?.location || null, value:Number(row?.data?.value ?? row?.value) })).filter((row) => Number.isFinite(row.value));
  const predictions = relationRows(fixture?.predictions).map((row) => ({ type_id:row?.type_id ?? null, predictions:row?.predictions || row?.data || null })).filter((row) => row.predictions);
  const refereeRow = relationRows(fixture?.referees)[0];
  const referee = refereeRow?.referee || refereeRow || null;
  return { lineups, absences, events, statistics, xg, predictions, formations:relationRows(fixture?.formations), periods:relationRows(fixture?.periods), venue:fixture?.venue || null, referee:referee ? { name:referee.display_name || referee.common_name || referee.name || null, image:referee.image_path || null } : null, weather:fixture?.weatherreport || fixture?.weatherReport || null };
}

async function sportmonksFixtureRequest(path, token) {
  const includeSets = [
    "participants;scores;league.country;state;events.type;events.player;lineups.player;lineups.detailedposition;lineups.details.type;statistics.type;venue;periods;formations;referees.referee;weatherReport;sidelined.player",
    "participants;scores;league;state;events;lineups.player;statistics.type;venue;periods;formations",
    "participants;scores;league;state",
  ];
  const errors = [];
  for (const includes of includeSets) {
    try {
      const payload = await sportmonksRequest(`${path}${path.includes("?") ? "&" : "?"}include=${encodeURIComponent(includes)}`, token);
      return { payload, includes, degraded:errors.length > 0 };
    } catch (error) {
      errors.push(error);
      if (![400, 403, 404, 422].includes(error?.status)) throw error;
    }
  }
  throw errors.at(-1) || new Error("Sportmonks fixture request unavailable");
}

async function sportmonksFixturePredictions(fixtureId, token) {
  try {
    const payload = await sportmonksRequest(`/fixtures/${encodeURIComponent(fixtureId)}?include=predictions`, token);
    return relationRows(payload?.data?.predictions || payload?.predictions).map((row) => ({
      type_id: row?.type_id ?? null,
      predictions: row?.predictions || row?.data || null,
    })).filter((row) => row.predictions);
  } catch (error) {
    if ([400, 403, 404, 422].includes(error?.status)) return [];
    throw error;
  }
}

// Sportmonks fixture id'sinden secili lig anahtarini cozer; fixture secili
// liglerden hicbirine ait degilse null doner (lig izolasyonu invarianti).
function selectedLeagueKeyForProviderLeagueId(providerLeagueId) {
  const id = String(providerLeagueId || "");
  if (!id) return null;
  for (const [key, ids] of Object.entries(SELECTED_LEAGUE_IDS_BY_KEY)) {
    if (key === "all") continue;
    if (ids.map(String).includes(id)) return key;
  }
  return null;
}

async function verifiedSportmonksFixture(fixtureId, token) {
  const payload = await sportmonksRequest(`/fixtures/${encodeURIComponent(fixtureId)}?include=participants;state;league;venue`, token);
  const row = payload?.data || payload || {};
  const fixture = normalizeProviderFixture(row, row?.league || "sportmonks", row?.season_id, row?.round_id);
  if (!fixture) {
    const error = new Error("fixture_unavailable");
    error.status = 404;
    throw error;
  }
  // INVARIANT: fixture.league_id daima secili lig kumesinden biri olmalidir.
  const providerLeagueId = String(row?.league_id || row?.league?.id || fixture.provider_league_id || "");
  const leagueKey = selectedLeagueKeyForProviderLeagueId(providerLeagueId);
  if (!leagueKey) {
    const error = new Error("fixture_out_of_scope");
    error.status = 400;
    error.providerMessage = "Bu mac secili lig kapsaminda degil.";
    throw error;
  }
  fixture.provider_league_id = providerLeagueId;
  fixture.league_key = leagueKey;
  return fixture;
}

async function handleFootballPrediction(request, env) {
  if (!["GET", "POST"].includes(request.method)) return jsonResponse({ error:"method_not_allowed" }, 405, { Allow:"GET, POST" });
  const user = await getAuthUser(request, env);
  if (!user?.id) return jsonResponse({ error:"authentication_required" }, 401, { "Cache-Control":"no-store" });
  const token = env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN;
  if (!token) return jsonResponse({ error:"sportmonks_not_configured" }, 503, { "Cache-Control":"no-store" });
  const input = request.method === "POST" ? await readJsonBody(request, 4096) : Object.fromEntries(new URL(request.url).searchParams);
  const fixtureId = String(input.fixture_id || input.fixture || "").replace(/^sportmonks:/, "");
  if (!/^\d+$/.test(fixtureId)) return jsonResponse({ error:"invalid_fixture" }, 400, { "Cache-Control":"no-store" });
  const matchId = `sportmonks:${fixtureId}`;
  if (request.method === "GET") {
    const rows = await supabaseRest(env, `predictions?match_id=eq.${encodeURIComponent(matchId)}&user_id=eq.${encodeURIComponent(user.id)}&select=pick,score_home,score_away,submitted_at`);
    return jsonResponse({ prediction:Array.isArray(rows) ? rows[0] || null : null }, 200, { "Cache-Control":"no-store" });
  }
  const pick = String(input.pick || "").toUpperCase();
  const hasHome = input.score_home !== null && input.score_home !== undefined && input.score_home !== "";
  const hasAway = input.score_away !== null && input.score_away !== undefined && input.score_away !== "";
  const scoreHome = hasHome ? Number(input.score_home) : null;
  const scoreAway = hasAway ? Number(input.score_away) : null;
  const challengeLeague = ["super-lig", "premier-league", "la-liga"].includes(String(input.challenge_league || "")) ? String(input.challenge_league) : null;
  if (!["1", "X", "2"].includes(pick)) return jsonResponse({ error:"invalid_pick" }, 400, { "Cache-Control":"no-store" });
  if (hasHome !== hasAway || (hasHome && (![scoreHome, scoreAway].every(Number.isInteger) || scoreHome < 0 || scoreAway < 0 || scoreHome > 99 || scoreAway > 99))) {
    return jsonResponse({ error:"invalid_score" }, 400, { "Cache-Control":"no-store" });
  }
  try {
    const fixture = await verifiedSportmonksFixture(fixtureId, token);
    if (["iptal", "ertelendi", "bitti", "canlı", "devre_arasi"].includes(fixture.status) || Date.now() >= Date.parse(fixture.kickoff) - 15 * 60000) {
      return jsonResponse({ error:"prediction_closed" }, 409, { "Cache-Control":"no-store" });
    }
    // Istemciden gelen challenge_league, fixture'in gercek ligiyle eslesmezse
    // challenge tablosuna baska ligden mac enjekte edilebilir.
    if (challengeLeague && challengeLeague !== fixture.league_key) {
      return jsonResponse({ error:"challenge_league_mismatch" }, 400, { "Cache-Control":"no-store" });
    }
    const matchRecord={ id:matchId, hafta:fixture.hafta || 1, ev:fixture.ev, konuk:fixture.konuk, kickoff:fixture.kickoff, stadyum:fixture.stadyum, verified:true, status:fixture.status, source:"sportmonks", challenge_week:challengeLeague ? currentChallengeWeek() : null, challenge_league:challengeLeague, updated_at:new Date().toISOString() };
    try {
      await supabaseRest(env, "matches?on_conflict=id", { method:"POST", headers:{ Prefer:"resolution=merge-duplicates,return=representation" }, body:JSON.stringify(matchRecord) });
    } catch (schemaError) {
      if (!/challenge_(week|league)|column/i.test(String(schemaError?.message || ""))) throw schemaError;
      delete matchRecord.challenge_week; delete matchRecord.challenge_league;
      await supabaseRest(env, "matches?on_conflict=id", { method:"POST", headers:{ Prefer:"resolution=merge-duplicates,return=representation" }, body:JSON.stringify(matchRecord) });
    }
    const saved = await supabaseRest(env, "predictions?on_conflict=match_id,user_id", {
      method:"POST",
      headers:{ Prefer:"resolution=merge-duplicates,return=representation" },
      body:JSON.stringify({ match_id:matchId, user_id:user.id, pick, score_home:scoreHome, score_away:scoreAway }),
    });
    return jsonResponse({ prediction:Array.isArray(saved) ? saved[0] || null : saved }, 200, { "Cache-Control":"no-store" });
  } catch (error) {
    if (error?.message === "fixture_out_of_scope") {
      return jsonResponse({ error:"fixture_out_of_scope" }, 400, { "Cache-Control":"no-store" });
    }
    return jsonResponse({ error:error?.status === 404 ? "fixture_unavailable" : "prediction_save_failed" }, error?.status === 404 ? 404 : 502, { "Cache-Control":"no-store" });
  }
}

function currentChallengeWeek(now = new Date()) {
  const day = now.getUTCDay() || 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + 1));
  return monday.toISOString().slice(0, 10);
}

// NOT (2026-08-22 audit): bu fonksiyon oncesinde `matches.challenge_week`
// kolonuna ve `settle_prediction_challenge_match` RPC'sine kosulsuz
// guveniyordu. Production Supabase semasinda (proje swhwmqbamzczztpfxctg)
// bu kolon/fonksiyon YOK -- ilk supabaseRest cagrisi her cron turunda
// "column does not exist" ile patliyor ve scheduled() bunu hic yakalamadan
// yutuyordu (sessiz sonsuz basarisizlik). Bu, README/memory'deki "silent
// failure masking" aninin bir baska ornegi. Asagidaki surum:
//  1) Yalnizca DOGRULANMIS kolonlara (matches.status, results) dayanir,
//  2) Lig izolasyonu icin verifiedSportmonksFixture kullanir (baska ligden
//     sonuc sizmasini engeller),
//  3) results upsert + matches.status guncellemesi idempotenttir (ayni
//     sonuc tekrar tekrar islense de veri degismez),
//  4) challenge/reward RPC'sini FIRSATCI olarak dener; eksikse (42883/42703)
//     provider_sync_runs'a acikca kaydeder, sessizce yutmaz.
async function settlePendingFootballPredictions(env) {
  const token = env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN;
  if (!token || !supabaseServiceKey(env)) return { checked: 0, settled: 0 };
  const startedAt = Date.now();
  let pending = [];
  try {
    const cutoff = encodeURIComponent(new Date().toISOString());
    pending = await supabaseRest(env, `matches?source=eq.sportmonks&kickoff=lt.${cutoff}&status=neq.bitti&select=id,status&order=kickoff.asc&limit=24`);
  } catch (error) {
    await recordSyncRun(env, { endpointClass: "finalize", scopeKey: "pending-query", startedAt, httpStatus: error?.status || 0, outcome: "schema_error", errorCode: safeErrorMessage(error) });
    return { checked: 0, settled: 0, error: "pending_query_failed" };
  }
  let settled = 0;
  let rewardRpcMissing = false;
  for (const row of Array.isArray(pending) ? pending : []) {
    const fixtureId = String(row.id || "").replace(/^sportmonks:/, "");
    if (!/^\d+$/.test(fixtureId)) continue;
    try {
      const fixture = await verifiedSportmonksFixture(fixtureId, token);
      if (fixture?.status !== "bitti" || !fixture.result) continue;
      // Idempotent: ayni skor tekrar tekrar upsert edilse de sonuc degismez.
      await supabaseRest(env, "results?on_conflict=match_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ match_id: row.id, home: fixture.result.home, away: fixture.result.away, scored_at: new Date().toISOString() }),
      });
      await supabaseRest(env, `matches?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "bitti" }),
      });
      settled += 1;
      if (!rewardRpcMissing) {
        try {
          await supabaseRest(env, "rpc/settle_prediction_challenge_match", {
            method: "POST",
            body: JSON.stringify({ p_match_id: row.id, p_home: fixture.result.home, p_away: fixture.result.away }),
          });
        } catch (rpcError) {
          // 42883 = fonksiyon yok, 42703 = kolon yok (challenge_week vb).
          // Bu, oduel/challenge migration backlog'unun henuz uygulanmadigi
          // ANLAMINA gelir -- ayri, bilinen bir dagitim engelidir; canli
          // skor kesinlestirmesini (results/matches) ENGELLEMEZ.
          if (/42883|42703|does not exist/i.test(String(rpcError?.message || ""))) rewardRpcMissing = true;
        }
      }
    } catch (_error) { /* bu fixture bir sonraki cron turunda tekrar denenir */ }
  }
  await recordSyncRun(env, { endpointClass: "finalize", scopeKey: "settle", startedAt, httpStatus: 200, outcome: rewardRpcMissing ? "partial_reward_rpc_missing" : "ok" });
  return { checked: Array.isArray(pending) ? pending.length : 0, settled, rewardRpcMissing };
}

function utcDateWithOffset(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function fetchFixtureTeamContext(team, fixtureId, token) {
  if (!team?.id) return null;
  try {
    const windows = [[-420,-301],[-300,-181],[-180,-61],[-60,60]];
    const settled = await Promise.allSettled(windows.map(([from,to]) => sportmonksRequest(`/fixtures/between/${utcDateWithOffset(from)}/${utcDateWithOffset(to)}/${encodeURIComponent(team.id)}?include=participants;scores;league;state&per_page=50`, token)));
    const now = Date.now();
    const fixtures = [...new Map(settled.flatMap((result) => result.status === "fulfilled" ? relationRows(result.value?.data) : []).map((item) => [String(item?.id), item])).values()];
    const matches = fixtures.filter((item) => String(item?.id) !== String(fixtureId)).map((item) => {
      const participants = relationRows(item?.participants);
      const opponent = participants.find((participant) => String(participant?.id) !== String(team.id)) || {};
      const ownScore = sportmonksScore(item?.scores, team.id), opponentScore = sportmonksScore(item?.scores, opponent.id);
      const start = Date.parse(item?.starting_at || "");
      const finished = Number.isFinite(ownScore) && Number.isFinite(opponentScore) && (start < now || /FT|AET|PEN/i.test(String(item?.state?.short_name || "")));
      return { id:item?.id || null, kickoff:item?.starting_at || null, league:item?.league?.name || null, opponent:opponent?.name || "Rakip", opponent_logo:opponent?.image_path || null, score:finished ? { team:ownScore, opponent:opponentScore } : null, result:finished ? (ownScore > opponentScore ? "W" : ownScore < opponentScore ? "L" : "D") : null, finished, start };
    }).filter((item) => Number.isFinite(item.start));
    return { team_id:team.id, team:team.name || null, team_logo:team.image_path || null, recent:matches.filter((item) => item.finished).sort((a,b)=>b.start-a.start).slice(0,5).reverse(), next:matches.filter((item) => !item.finished && item.start > now).sort((a,b)=>a.start-b.start)[0] || null };
  } catch (_) {
    return { team_id:team.id, team:team.name || null, team_logo:team.image_path || null, recent:[], next:null, unavailable:true };
  }
}

async function fetchSportmonksLeagueWindow(leagueKey, leagueId, token, priorErrors = []) {
  const windows = [[-150,-61],[-60,29],[30,119],[120,209],[210,299]];
  const requests = windows.map(([from,to]) => sportmonksRequest(`/fixtures/between/${utcDateWithOffset(from)}/${utcDateWithOffset(to)}?include=participants;scores;league.country;state;venue&filters=fixtureLeagues:${encodeURIComponent(leagueId)}&per_page=50`, token));
  const settled = await Promise.allSettled(requests);
  const fixtures = settled.flatMap((result) => result.status === "fulfilled" ? relationRows(result.value?.data) : []);
  const strictlyScoped = fixtures.filter((fixture) => String(fixture?.league_id || fixture?.league?.id || "") === String(leagueId));
  if (!strictlyScoped.length) {
    const error = settled.find((result) => result.status === "rejected")?.reason || new Error("Sportmonks lig fikstürü bulunamadı");
    throw error;
  }
  const league = strictlyScoped.find((fixture) => fixture?.league)?.league || { id:leagueId, name:SELECTED_LEAGUE_NAMES_BY_KEY[leagueKey] || null };
  const matches = strictlyScoped.map((fixture, index) => normalizeProviderFixture(fixture, league, fixture?.season_id || "league-window", fixture?.round_id || index + 1)).filter(Boolean);
  const uniqueMatches = [...new Map(matches.map((row) => [row.id, row])).values()].sort((a,b) => new Date(a.kickoff) - new Date(b.kickoff));
  return {
    source:"sportmonks-football-api-v3", provider:"sportmonks", league:leagueKey, leagueId:String(leagueId), seasonId:String(strictlyScoped[0]?.season_id || "league-window"), competition:league.name || SELECTED_LEAGUE_NAMES_BY_KEY[leagueKey] || null, updatedAt:new Date().toISOString(), matches:uniqueMatches,
    results:uniqueMatches.filter((row) => row.result).map((row) => ({ match_id:row.id, ...row.result, scored_at:new Date().toISOString() })), standings:[], coverage:{ fixtures:uniqueMatches.length, results:uniqueMatches.filter((row) => row.result).length, standings:0, mode:"league-date-window" },
    errors:priorErrors.concat(settled.flatMap((result,index) => result.status === "rejected" ? [{ module:`fixtures-window-${index + 1}`, code:publicProviderErrorCode(result.reason) }] : [])),
  };
}

async function fetchSportmonksSeasonBundle(leagueKey, token) {
  const leagueId = (SELECTED_LEAGUE_IDS_BY_KEY[leagueKey] || SELECTED_LEAGUE_IDS_BY_KEY["super-lig"])[0];
  let league = { id: leagueId, name: SELECTED_LEAGUE_NAMES_BY_KEY[leagueKey] || null };
  let season = null;
  let leagueLookupError = null;
  let leagueResolved = false;
  try {
    const leaguePayload = await sportmonksRequest(`/leagues/${encodeURIComponent(leagueId)}?include=currentSeason;seasons;country`, token);
    const leagueRow = leaguePayload?.data || null;
    leagueResolved = Boolean(leagueRow?.id);
    league = { ...league, ...(leagueRow || {}) };
    season = sportmonksCurrentSeason(league);
  } catch (error) {
    leagueLookupError = error;
  }
  if (!season?.id) {
    let seasons = [];
    try {
      const seasonsPayload = await sportmonksRequest(`/seasons?include=league&filters=seasonLeagues:${encodeURIComponent(leagueId)}&order=desc&per_page=50`, token);
      seasons = relationRows(seasonsPayload?.data).filter((row) => row?.id && String(row?.league_id || row?.league?.id || leagueId) === String(leagueId));
      if (seasons.length) leagueResolved = true;
    } catch (error) {
      leagueLookupError = leagueLookupError || error;
    }
    season = sportmonksCurrentSeason({ seasons });
    const seasonLeague = season?.league || seasons[0]?.league;
    if (seasonLeague) league = { ...league, ...seasonLeague };
  }
  // Lig seçimine erişim yoksa bunu genel bir "fikstür bulunamadı" hatasına
  // dönüştürme; istemci gerçek plan/yetki durumunu gösterebilsin.
  if (!season?.id && !leagueResolved && leagueLookupError) throw leagueLookupError;
  if (!season?.id && !leagueResolved) {
    const accessError = new Error(`${SELECTED_LEAGUE_NAMES_BY_KEY[leagueKey] || leagueKey} mevcut Sportmonks aboneliğine dahil değil`);
    accessError.status = 403;
    accessError.providerMessage = accessError.message;
    throw accessError;
  }
  if (!season?.id) return fetchSportmonksLeagueWindow(leagueKey, leagueId, token, [{ module:"season", code:leagueLookupError ? publicProviderErrorCode(leagueLookupError) : "active_season_unavailable" }]);
  const seasonId = String(season.id);
  const [standingsResult, scheduleResult] = await Promise.allSettled([
    sportmonksRequest(`/standings/seasons/${encodeURIComponent(seasonId)}?include=participant;details.type;form`, token),
    sportmonksRequest(`/schedules/seasons/${encodeURIComponent(seasonId)}`, token),
  ]);
  const standings = standingsResult.status === "fulfilled"
    ? relationRows(standingsResult.value?.data).map((row, index) => normalizeProviderStanding(row, league, seasonId, index)).filter((row) => row.team)
    : [];
  const matches = [];
  if (scheduleResult.status === "fulfilled") {
    for (const stage of relationRows(scheduleResult.value?.data)) {
      const rounds = relationRows(stage?.rounds);
      rounds.forEach((round, index) => relationRows(round?.fixtures).forEach((fixture) => {
        const normalized = normalizeProviderFixture(fixture, league, seasonId, Number.parseInt(String(round?.name || ""), 10) || index + 1);
        if (normalized) matches.push(normalized);
      }));
    }
  }
  const uniqueMatches = [...new Map(matches.map((row) => [row.id, row])).values()];
  return {
    source: "sportmonks-football-api-v3", provider: "sportmonks", league: leagueKey, leagueId: String(leagueId), seasonId,
    competition: league.name || null, updatedAt: new Date().toISOString(), matches: uniqueMatches,
    results: uniqueMatches.filter((row) => row.result).map((row) => ({ match_id: row.id, ...row.result, scored_at: new Date().toISOString() })),
    standings: standings.sort((a, b) => Number(b.points || 0) - Number(a.points || 0)),
    coverage: { fixtures: uniqueMatches.length, results: uniqueMatches.filter((row) => row.result).length, standings: standings.length },
    errors: [standingsResult, scheduleResult].flatMap((result, index) => result.status === "rejected" ? [{ module: index === 0 ? "standings" : "fixtures", code:publicProviderErrorCode(result.reason) }] : []).concat(leagueLookupError ? [{ module:"league", code:publicProviderErrorCode(leagueLookupError) }] : []),
  };
}

function validSharedSeasonPayload(payload, league) {
  return Boolean(
    payload
    && payload.league === league
    && Array.isArray(payload.matches)
    && Array.isArray(payload.standings)
    && Array.isArray(payload.results)
  );
}

async function resolveFootballSeasonBundle(env, league, token) {
  const scope = `worker:football-season:v1:${league}`;
  const lockKey = `provider:${scope}`;
  let shared = await readProviderSharedCache(env, scope);
  if (validSharedSeasonPayload(shared?.payload, league) && providerSharedCacheFresh(shared)) {
    return { payload:shared.payload, stale:false, source:"shared-cache" };
  }
  const stale = validSharedSeasonPayload(shared?.payload, league)
    && providerSharedCacheWithinStaleWindow(shared, SEASON_SHARED_STALE_SECONDS)
    ? shared
    : null;
  const acquired = await acquireSyncLock(env, lockKey, SEASON_REFRESH_LOCK_SECONDS);
  if (!acquired) {
    // Kilidi alan baska isolate cache'i bu kontrol ile yazmis olabilir.
    shared = await readProviderSharedCache(env, scope);
    if (validSharedSeasonPayload(shared?.payload, league)
      && providerSharedCacheWithinStaleWindow(shared, SEASON_SHARED_STALE_SECONDS)) {
      return { payload:shared.payload, stale:!providerSharedCacheFresh(shared), source:"shared-cache-locked" };
    }
    throw providerRefreshLockedError(scope);
  }
  try {
    const payload = await fetchSportmonksSeasonBundle(league, token);
    // Cross-isolate bekleyenler response donmeden once snapshot'i gorebilsin.
    await writeProviderSharedCache(env, scope, payload, SEASON_SHARED_TTL_SECONDS);
    return { payload, stale:false, source:"provider" };
  } catch (error) {
    if (stale) return { payload:stale.payload, stale:true, source:"shared-cache-stale", error };
    throw error;
  }
}

async function singleFlightFootballSeason(env, league, token) {
  const existing = footballSeasonRefreshPromises.get(league);
  if (existing) return existing;
  const promise = resolveFootballSeasonBundle(env, league, token);
  footballSeasonRefreshPromises.set(league, promise);
  try {
    return await promise;
  } finally {
    if (footballSeasonRefreshPromises.get(league) === promise) footballSeasonRefreshPromises.delete(league);
  }
}

function footballProviderFixtureId(value) {
  return String(value || "").replace(/^sportmonks:/, "");
}

function normalizedTopscorerMetric(type) {
  const key = String(type?.developer_name || type?.code || type?.name || "").toLowerCase().replace(/[^a-z]/g, "");
  if (/assist/.test(key)) return "assists";
  if (/yellowcard/.test(key)) return "yellowCards";
  if (/redcard/.test(key)) return "redCards";
  if (/goal/.test(key) && !/own|conced|against/.test(key)) return "goals";
  return null;
}

function normalizeTopscorerRow(row) {
  const metric = normalizedTopscorerMetric(row?.type);
  const player = row?.player || {};
  const team = row?.participant || {};
  if (!metric || !row?.player_id || !Number.isFinite(Number(row?.total))) return null;
  return {
    metric,
    playerId:String(row.player_id),
    playerName:player.display_name || player.common_name || player.name || `Oyuncu ${row.player_id}`,
    playerImage:player.image_path || null,
    teamId:row.participant_id ? String(row.participant_id) : null,
    teamName:team.name || null,
    teamImage:team.image_path || null,
    total:Number(row.total),
    rank:Number(row.position) || null,
    providerType:{ id:row.type_id ?? row?.type?.id ?? null, code:row?.type?.code || null, name:row?.type?.name || null },
  };
}

function normalizeFootballLeaders(rows) {
  const output = { goals:[], assists:[], yellowCards:[], redCards:[] };
  const best = new Map(Object.keys(output).map((key) => [key, new Map()]));
  for (const row of rows) {
    const normalized = normalizeTopscorerRow(row);
    if (!normalized) continue;
    const previous=best.get(normalized.metric).get(normalized.playerId);
    if(!previous||normalized.total>previous.total||(normalized.total===previous.total&&(normalized.rank||999)<(previous.rank||999))) best.get(normalized.metric).set(normalized.playerId,normalized);
  }
  for (const key of Object.keys(output)) output[key]=[...best.get(key).values()].sort((a,b) => b.total-a.total || (a.rank || 999)-(b.rank || 999) || a.playerId.localeCompare(b.playerId)).slice(0,10);
  return output;
}

async function fetchFootballLeadersPayload(league, seasonId, token) {
  const params = new URLSearchParams({ include:"player;participant;type", per_page:"100" });
  const payload = await sportmonksRequest(`/topscorers/seasons/${encodeURIComponent(seasonId)}?${params}`, token);
  const rows = relationRows(payload?.data);
  const leaders = normalizeFootballLeaders(rows);
  return {
    league, leagueId:String(SELECTED_LEAGUE_IDS_BY_KEY[league][0]), seasonId:String(seasonId),
    ...leaders,
    source:"sportmonks-football-api-v3", sourceUpdatedAt:new Date().toISOString(), computedAt:new Date().toISOString(),
    cacheStatus:rows.length ? "fresh" : "verified-empty", isStale:false, scopeValidated:true,
  };
}

async function resolveFootballLeaders(env, league, seasonId, token) {
  const identity = `${league}:${seasonId}:topscorers:v1`;
  return singleFlightDemandProvider({
    env, kind:"football-leaders", identity, provider:"sportmonks",
    ttlSeconds:FOOTBALL_LEADERS_TTL_SECONDS, staleSeconds:FOOTBALL_LEADERS_STALE_SECONDS, lockSeconds:45,
    validatePayload:(payload) => payload?.league === league && String(payload?.seasonId) === String(seasonId)
      && ["goals","assists","yellowCards","redCards"].every((key) => Array.isArray(payload?.[key])),
    fetchPayload:() => fetchFootballLeadersPayload(league, seasonId, token),
  });
}

function playerPositionGroup(value, isKeeper=false) {
  const text = String(value || "").toLowerCase();
  if (isKeeper || /goal|keeper|kaleci/.test(text)) return "goalkeeper";
  if (/defen|back|bek|stoper/.test(text)) return "defender";
  if (/mid|orta|wing/.test(text)) return "midfielder";
  if (/forward|striker|attack|forvet/.test(text)) return "forward";
  return "unknown";
}

function eventKind(event) {
  const value = String(event?.type?.developer_name || event?.type?.code || event?.type?.name || event?.type || event?.addition || "").toLowerCase();
  if (/second.*yellow|yellow.*red/.test(value)) return "secondYellow";
  if (/red.*card|redcard/.test(value)) return "redCard";
  if (/yellow.*card|yellowcard/.test(value)) return "yellowCard";
  if (/own.*goal/.test(value)) return "ownGoal";
  if (/penalty.*miss|missed.*penalty/.test(value)) return "penaltyMissed";
  if (/penalty.*save|saved.*penalty/.test(value)) return "penaltySaved";
  if (/assist/.test(value)) return "assist";
  if (/goal/.test(value)) return "goal";
  return null;
}

function lineupMinutes(row) {
  const details = relationRows(row?.details);
  const minuteDetail = details.find((detail) => /minute/i.test(String(detail?.type?.developer_name || detail?.type?.name || detail?.type?.code || "")));
  const value = minuteDetail?.data?.value ?? minuteDetail?.value ?? row?.minutes_played ?? row?.minutes;
  if (Number.isFinite(Number(value))) return Math.max(0,Math.min(130,Number(value)));
  return Number(row?.type_id) === 11 ? 90 : 0;
}

function calculateXYZPerformanceScore(input) {
  const position = playerPositionGroup(input.position,input.isKeeper);
  const minutes = Math.max(0,Number(input.minutes)||0);
  const counts = { goal:0,assist:0,yellowCard:0,secondYellow:0,redCard:0,ownGoal:0,penaltyMissed:0,penaltySaved:0, ...(input.events || {}) };
  const breakdown = {
    base:minutes>0 ? 6 : 0,
    minutes:minutes>=60 ? .5 : minutes>0 ? .2 : 0,
    goals:counts.goal * ({goalkeeper:3,defender:2.5,midfielder:2,forward:1.7,unknown:1.7}[position]),
    assists:counts.assist * 1.2,
    result:input.teamResult === "win" ? .3 : input.teamResult === "draw" ? .1 : 0,
    cleanSheet:input.cleanSheet && minutes>=60 ? ({goalkeeper:1,defender:1,midfielder:.3,forward:0,unknown:0}[position]) : 0,
    cards:counts.yellowCard*-.5 + counts.secondYellow*-1.5 + counts.redCard*-2,
    penalties:counts.ownGoal*-1.5 + counts.penaltyMissed*-1 + counts.penaltySaved*2,
  };
  const raw = Object.values(breakdown).reduce((sum,value)=>sum+Number(value||0),0);
  return { score:Math.round(Math.max(0,Math.min(10,raw))*10)/10, breakdown, position, minutes };
}

function chooseWeeklyXI(players) {
  const formations = [{name:"4-3-3",g:1,d:4,m:3,f:3},{name:"4-4-2",g:1,d:4,m:4,f:2},{name:"3-4-3",g:1,d:3,m:4,f:3}];
  const sorted = [...players].sort((a,b)=>b.score-a.score || b.contributions-a.contributions || b.minutes-a.minutes || a.playerId.localeCompare(b.playerId));
  let best = null;
  for (const formation of formations) {
    const picks = [
      ...sorted.filter(p=>p.position==="goalkeeper").slice(0,formation.g),
      ...sorted.filter(p=>p.position==="defender").slice(0,formation.d),
      ...sorted.filter(p=>p.position==="midfielder").slice(0,formation.m),
      ...sorted.filter(p=>p.position==="forward").slice(0,formation.f),
    ];
    if (picks.length!==11 || new Set(picks.map(p=>p.playerId)).size!==11) continue;
    const total=picks.reduce((sum,p)=>sum+p.score,0);
    if (!best || total>best.total) best={formation:formation.name,total,players:picks};
  }
  return best;
}

function selectWeeklyRound(matches) {
  const rows = (Array.isArray(matches) ? matches : []).filter((match) => Number.isFinite(Number(match?.hafta)));
  const unavailable = (match) => /postpon|ertelen|cancel|iptal|abandon|askıya/i.test(String(match?.status || ""));
  const finished = (match) => !unavailable(match) && (Boolean(match?.result) || /bitti|finished|\bft\b|aet|pen/i.test(String(match?.status || "")));
  const candidateRound = rows.filter(finished).reduce((max, match) => Math.max(max, Number(match.hafta) || 0), 0);
  if (!candidateRound) return { roundId:0, matches:[], complete:false };
  const roundMatches = rows.filter((match) => Number(match.hafta) === candidateRound);
  return { roundId:candidateRound, matches:roundMatches, complete:roundMatches.length > 0 && roundMatches.every(finished) };
}

function scoreWeeklyFixture(fixture) {
  const participants=relationRows(fixture?.participants);
  const scoreByTeam=new Map(participants.map(team=>[String(team.id),sportmonksScore(fixture?.scores,team.id)]));
  const eventRows=[...new Map(relationRows(fixture?.events).map((event,index)=>[String(event?.id ?? `${event?.type_id}:${event?.player_id}:${event?.minute}:${index}`),event])).values()];
  return relationRows(fixture?.lineups).map(row=>{
    const player=row?.player || {};
    const playerId=String(row?.player_id || player?.id || "");
    const teamId=String(row?.team_id || row?.participant_id || "");
    const team=participants.find(item=>String(item?.id)===teamId) || {};
    const opponent=participants.find(item=>String(item?.id)!==teamId) || {};
    const ownScore=scoreByTeam.get(teamId),opponentScore=scoreByTeam.get(String(opponent?.id));
    const events={};
    for(const event of eventRows){
      const primary=String(event?.player_id || event?.player?.id || "")===playerId;
      const related=String(event?.related_player_id || event?.relatedplayer?.id || "")===playerId;
      const kind=eventKind(event);
      if(primary&&kind) events[kind]=(events[kind]||0)+1;
      if(related&&kind==="goal") events.assist=(events.assist||0)+1;
    }
    // Providers may emit the same dismissal as yellow + second-yellow + red
    // records. Score the disciplinary outcome once, while preserving a
    // genuinely separate first yellow when it exists.
    if(events.secondYellow){
      events.yellowCard=Math.max(0,(events.yellowCard||0)-events.secondYellow);
      events.redCard=0;
    }
    const result=Number.isFinite(ownScore)&&Number.isFinite(opponentScore)?(ownScore>opponentScore?"win":ownScore===opponentScore?"draw":"loss"):null;
    const calculated=calculateXYZPerformanceScore({position:row?.detailedposition?.name || row?.position?.name, isKeeper:/goal|keeper/i.test(String(row?.detailedposition?.name||row?.position?.name||"")), minutes:lineupMinutes(row), events, teamResult:result, cleanSheet:Number(opponentScore)===0});
    return { playerId,playerName:row?.player_name||player?.display_name||player?.common_name||player?.name||`Oyuncu ${playerId}`,playerImage:player?.image_path||null,teamId,teamName:team?.name||null,teamImage:team?.image_path||null,...calculated,events,contributions:(events.goal||0)+(events.assist||0),fixtureId:String(fixture.id) };
  }).filter(player=>player.playerId&&player.minutes>0);
}

async function persistWeeklyAwards(env,payload) {
  if(!supabaseServiceKey(env)||!payload?.roundId) return;
  const rows=payload.playerScores.map(player=>({league_id:payload.leagueId,season_id:payload.seasonId,round_id:payload.roundId,player_id:player.playerId,algorithm_version:payload.algorithmVersion,status:payload.status,score:player.score,minutes:player.minutes,payload:player,source_updated_at:payload.sourceUpdatedAt,computed_at:payload.computedAt}));
  await supabaseRest(env,"football_weekly_player_scores?on_conflict=league_id,season_id,round_id,player_id,algorithm_version",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(rows)});
  await supabaseRest(env,"football_weekly_awards?on_conflict=league_id,season_id,round_id,algorithm_version",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify([{league_id:payload.leagueId,season_id:payload.seasonId,round_id:payload.roundId,algorithm_version:payload.algorithmVersion,status:payload.status,star_player_id:payload.star?.playerId||null,formation:payload.teamOfWeek?.formation||null,payload:{star:payload.star,teamOfWeek:payload.teamOfWeek},source_updated_at:payload.sourceUpdatedAt,computed_at:payload.computedAt,is_stale:false,calculation_evidence:{fixtureIds:payload.fixtureIds,algorithmVersion:payload.algorithmVersion}}])});
}

async function fetchWeeklyAwardsPayload(env,league,seasonBundle,token) {
  const selectedRound=selectWeeklyRound(seasonBundle.matches||[]),roundId=selectedRound.roundId,roundMatches=selectedRound.matches;
  if(!roundId||!roundMatches.length||!selectedRound.complete) return {league,leagueId:String(SELECTED_LEAGUE_IDS_BY_KEY[league][0]),seasonId:String(seasonBundle.seasonId),roundId:roundId?String(roundId):null,status:"provisional",algorithmVersion:XYZ_PERFORMANCE_ALGORITHM_VERSION,star:null,teamOfWeek:null,playerScores:[],fixtureIds:[],sourceUpdatedAt:seasonBundle.updatedAt||null,computedAt:new Date().toISOString(),reason:selectedRound.complete?"no_completed_round":"round_incomplete"};
  const fixtureResults=await Promise.allSettled(roundMatches.map(match=>sportmonksFixtureRequest(`/fixtures/${encodeURIComponent(footballProviderFixtureId(match.id))}`,token)));
  const fixtures=fixtureResults.filter(result=>result.status==="fulfilled").map(result=>relationRows(result.value.payload?.data)[0]).filter(Boolean);
  const scores=fixtures.flatMap(scoreWeeklyFixture);
  const aggregated=[...new Map(scores.map(score=>[score.playerId,[]])).entries()].map(([playerId])=>{
    const rows=scores.filter(score=>score.playerId===playerId),minutes=rows.reduce((sum,row)=>sum+row.minutes,0);
    const base={...rows[0],score:Math.round((rows.reduce((sum,row)=>sum+row.score*row.minutes,0)/Math.max(1,minutes))*10)/10,minutes,contributions:rows.reduce((sum,row)=>sum+row.contributions,0)};
    return base;
  }).sort((a,b)=>b.score-a.score||b.contributions-a.contributions||b.minutes-a.minutes||a.playerId.localeCompare(b.playerId));
  const status=fixtures.length===roundMatches.length?"published":"provisional";
  const teamOfWeek=status==="published"?chooseWeeklyXI(aggregated):null;
  const payload={league,leagueId:String(SELECTED_LEAGUE_IDS_BY_KEY[league][0]),seasonId:String(seasonBundle.seasonId),roundId:String(roundId),status:status==="published"&&teamOfWeek?"published":"provisional",algorithmVersion:XYZ_PERFORMANCE_ALGORITHM_VERSION,star:aggregated[0]||null,teamOfWeek,playerScores:aggregated,fixtureIds:fixtures.map(row=>String(row.id)),source:"sportmonks-data-xyzskor-calculation",sourceUpdatedAt:seasonBundle.updatedAt||new Date().toISOString(),computedAt:new Date().toISOString(),isStale:false};
  if(payload.status==="published") await persistWeeklyAwards(env,payload).catch(()=>{});
  return payload;
}

async function handleFootballLeaders(request,env) {
  if(request.method!=="GET") return jsonResponse({error:"method_not_allowed"},405,{Allow:"GET"});
  if(!productFeatureEnabled(env,"football_leaders_enabled")) return jsonResponse({error:"feature_disabled"},404,{"Cache-Control":"no-store"});
  const token=env.SPORTMONKS_API_TOKEN||env.SPORTMONKS_TOKEN;
  const league=validLeagueKey(new URL(request.url).searchParams.get("league"),{single:true});
  if(!league) return jsonResponse({error:"invalid_league"},400,{"Cache-Control":"no-store"});
  if(!token) return jsonResponse({error:"sportmonks_not_configured"},503,{"Cache-Control":"no-store"});
  try{
    const season=(await singleFlightFootballSeason(env,league,token)).payload;
    const result=await resolveFootballLeaders(env,league,season.seasonId,token);
    return jsonResponse({...result.payload,cacheStatus:result.stale?"stale":result.payload.cacheStatus,isStale:result.stale,degraded:Boolean(result.stale&&result.error)},200,{"Cache-Control":"public, max-age=300, s-maxage=2700, stale-while-revalidate=86400","X-Data-Stale":result.stale?"true":"false"});
  }catch(error){return jsonResponse({error:error?.message==="provider_refresh_in_progress"?"provider_refresh_in_progress":"football_leaders_unavailable"},error?.message==="provider_refresh_in_progress"?503:502,{"Cache-Control":"no-store"});}
}

async function handleFootballWeeklyAwards(request,env) {
  if(request.method!=="GET") return jsonResponse({error:"method_not_allowed"},405,{Allow:"GET"});
  if(!productFeatureEnabled(env,"xyz_performance_score_enabled")||!productFeatureEnabled(env,"weekly_star_enabled")||!productFeatureEnabled(env,"team_of_week_enabled")) return jsonResponse({error:"feature_disabled"},404,{"Cache-Control":"no-store"});
  const token=env.SPORTMONKS_API_TOKEN||env.SPORTMONKS_TOKEN;
  const league=validLeagueKey(new URL(request.url).searchParams.get("league"),{single:true});
  if(!league) return jsonResponse({error:"invalid_league"},400,{"Cache-Control":"no-store"});
  if(!token) return jsonResponse({error:"sportmonks_not_configured"},503,{"Cache-Control":"no-store"});
  try{
    const season=(await singleFlightFootballSeason(env,league,token)).payload;
    const identity=`${league}:${season.seasonId}:latest:${XYZ_PERFORMANCE_ALGORITHM_VERSION}`;
    const result=await singleFlightDemandProvider({env,kind:"football-weekly-awards",identity,provider:"sportmonks",ttlSeconds:FOOTBALL_WEEKLY_TTL_SECONDS,staleSeconds:FOOTBALL_WEEKLY_STALE_SECONDS,lockSeconds:60,validatePayload:(payload)=>payload?.league===league&&payload?.algorithmVersion===XYZ_PERFORMANCE_ALGORITHM_VERSION&&Array.isArray(payload?.playerScores),fetchPayload:()=>fetchWeeklyAwardsPayload(env,league,season,token)});
    return jsonResponse({...result.payload,cacheStatus:result.stale?"stale":result.payload.status==="published"?"fresh":"provisional",isStale:result.stale,degraded:Boolean(result.stale&&result.error)},200,{"Cache-Control":"public, max-age=900, s-maxage=21600, stale-while-revalidate=604800","X-Data-Stale":result.stale?"true":"false"});
  }catch(error){return jsonResponse({error:error?.message==="provider_refresh_in_progress"?"provider_refresh_in_progress":"football_weekly_awards_unavailable"},error?.message==="provider_refresh_in_progress"?503:502,{"Cache-Control":"no-store"});}
}

async function handleFootballSeason(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  const token = env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN;
  if (!token) return jsonResponse({ error: "sportmonks_not_configured", provider: "sportmonks" }, 503, { "Cache-Control": "no-store" });
  const url = new URL(request.url);
  const league = validLeagueKey(url.searchParams.get("league"), { single:true });
  if (!league) return jsonResponse({ error:"invalid_league" }, 400, { "Cache-Control":"no-store" });
  const cacheUrl = new URL(url); cacheUrl.search = `?league=${encodeURIComponent(league)}`;
  const cache = edgeCache(); const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const cached = await readEdgeCache(cache, cacheKey);
  if (isUsableJsonCache(cached)) return cached;
  try {
    const result = await singleFlightFootballSeason(env, league, token);
    const payload = result.payload;
    const response = jsonResponse(payload, 200, {
      "Cache-Control": result.stale ? "public, max-age=30, s-maxage=60, stale-while-revalidate=300" : SEASON_CACHE,
      "X-Data-Stale": result.stale ? "true" : "false",
      "X-Data-Cache": result.source,
    });
    if (result.source === "provider") context.waitUntil(persistSeasonFixtures(env, league, payload.matches));
    writeEdgeCache(cache, cacheKey, response, context); return response;
  } catch (error) {
    const locked = error?.message === "provider_refresh_in_progress";
    return jsonResponse({ error: error?.status === 401 ? "sportmonks_token_invalid" : error?.status === 403 ? "sportmonks_plan_restricted" : locked ? "provider_refresh_in_progress" : "sportmonks_upstream_unavailable", provider: "sportmonks", providerStatus:error?.status || null }, error?.status === 401 || error?.status === 403 ? error.status : locked ? 503 : 502, { "Cache-Control": "no-store", "Retry-After": locked ? "3" : "300" });
  }
}

const FOOTBALL_HOME_LEAGUES = Object.freeze(["super-lig", "premier-league", "la-liga", "bundesliga", "serie-a"]);

function footballHomeDayKey(value) {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp)) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/Istanbul", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date(timestamp));
}

function compactFootballHomePayload(bundles) {
  const now = Date.now();
  const today = footballHomeDayKey(new Date(now).toISOString());
  const matches = [];
  const standingsByLeague = {};
  const availability = {};
  const seasonsByLeague = {};
  const selectedResultIds = new Set();
  for (const { league, bundle } of bundles) {
    availability[league] = Boolean(bundle && Array.isArray(bundle.matches));
    standingsByLeague[league] = (bundle?.standings || []).slice(0, 5).map((row) => ({ ...row, league_key:league }));
    seasonsByLeague[league] = bundle ? { seasonId:bundle.seasonId || null, competition:bundle.competition || SELECTED_LEAGUE_NAMES_BY_KEY[league] || null, updatedAt:bundle.updatedAt || null } : null;
    const resultIds = new Set((bundle?.results || []).map((row) => String(row?.match_id || row?.id || "")));
    const rows = (bundle?.matches || [])
      .map((match) => ({ ...match, league_key:league }))
      .filter((match) => Number.isFinite(Date.parse(match.kickoff || "")))
      .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
    const unavailable = (match) => /iptal|cancel|ertelen|postpon|suspend|delay/i.test(String(match?.status || ""));
    const finished = (match) => Boolean(match?.result) || /bitti|finished|\bft\b|aet|pen/i.test(String(match?.status || "")) || resultIds.has(String(match?.id || match?.match_id || ""));
    const live = (match) => /canl|live|inplay|in_play|devre|half[ -]?time|\bht\b/i.test(String(match?.status || ""));
    const todays = rows.filter((match) => footballHomeDayKey(match.kickoff) === today && !unavailable(match) && (finished(match) || live(match) || Date.parse(match.kickoff) >= now));
    const upcoming = rows.filter((match) => !unavailable(match) && !finished(match) && Date.parse(match.kickoff) >= now).slice(0, 3);
    const recent = rows.filter((match) => Date.parse(match.kickoff) < now && finished(match)).slice(-2);
    const selected = todays.length ? todays : (upcoming.length ? upcoming : recent);
    for (const match of selected) selectedResultIds.add(String(match?.id || match?.match_id || ""));
    matches.push(...selected);
  }
  const results = bundles.flatMap(({ bundle }) => bundle?.results || []).filter((row) => selectedResultIds.has(String(row?.match_id || row?.id || "")));
  return {
    version:1,
    league:"all",
    source:"sportmonks-football-home",
    updatedAt:new Date().toISOString(),
    matches,
    standings:[],
    standingsByLeague,
    seasonsByLeague,
    availability,
    results,
  };
}

function validSharedFootballHomePayload(payload) {
  return Boolean(
    payload
    && payload.league === "all"
    && Array.isArray(payload.matches)
    && payload.standingsByLeague
    && typeof payload.standingsByLeague === "object"
    && payload.availability
    && typeof payload.availability === "object"
  );
}

async function resolveFootballHomeBundle(url, env, context) {
  const scope = "worker:football-home:v1";
  const lockKey = `provider:${scope}`;
  let shared = await readProviderSharedCache(env, scope);
  if (validSharedFootballHomePayload(shared?.payload) && providerSharedCacheFresh(shared)) {
    return { payload:shared.payload, stale:false, source:"shared-cache" };
  }
  const stale = validSharedFootballHomePayload(shared?.payload)
    && providerSharedCacheWithinStaleWindow(shared, FOOTBALL_HOME_SHARED_STALE_SECONDS)
    ? shared
    : null;
  const acquired = await acquireSyncLock(env, lockKey, FOOTBALL_HOME_REFRESH_LOCK_SECONDS);
  if (!acquired) {
    shared = await readProviderSharedCache(env, scope);
    if (validSharedFootballHomePayload(shared?.payload)
      && providerSharedCacheWithinStaleWindow(shared, FOOTBALL_HOME_SHARED_STALE_SECONDS)) {
      return { payload:shared.payload, stale:!providerSharedCacheFresh(shared), source:"shared-cache-locked" };
    }
    throw providerRefreshLockedError(scope);
  }

  const settled = await Promise.allSettled(FOOTBALL_HOME_LEAGUES.map(async (league) => {
    const seasonUrl = new URL("/api/football/season", url.origin);
    seasonUrl.searchParams.set("league", league);
    const response = await handleFootballSeason(new Request(seasonUrl.toString(), { method:"GET", headers:{ Accept:"application/json" } }), env, context);
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.league !== league || !Array.isArray(payload.matches)) {
      const error = new Error(payload?.detail || payload?.error || `season_${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }));
  const bundles = FOOTBALL_HOME_LEAGUES.map((league, index) => ({ league, bundle:settled[index].status === "fulfilled" ? settled[index].value : null }));
  if (!bundles.some((entry) => entry.bundle) && stale) {
    return { payload:stale.payload, stale:true, source:"shared-cache-stale" };
  }
  const payload = compactFootballHomePayload(bundles);
  payload.errors = settled.flatMap((result, index) => result.status === "rejected" ? [{ league:FOOTBALL_HOME_LEAGUES[index], status:result.reason?.status || 502, message:result.reason?.message || "unavailable" }] : []);
  await writeProviderSharedCache(env, scope, payload, FOOTBALL_HOME_SHARED_TTL_SECONDS);
  return { payload, stale:false, source:"provider" };
}

async function singleFlightFootballHome(url, env, context) {
  if (footballHomeRefreshPromise) return footballHomeRefreshPromise;
  const promise = resolveFootballHomeBundle(url, env, context);
  footballHomeRefreshPromise = promise;
  try {
    return await promise;
  } finally {
    if (footballHomeRefreshPromise === promise) footballHomeRefreshPromise = null;
  }
}

async function handleFootballHome(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error:"method_not_allowed" }, 405, { Allow:"GET" });
  const token = env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN;
  if (!token) return jsonResponse({ error:"sportmonks_not_configured", provider:"sportmonks" }, 503, { "Cache-Control":"no-store" });
  const url = new URL(request.url);
  const cacheUrl = new URL("/api/football/home", url.origin);
  const cache = edgeCache();
  const cacheKey = new Request(cacheUrl.toString(), { method:"GET" });
  const cached = await readEdgeCache(cache, cacheKey);
  if (isUsableJsonCache(cached)) return cached;
  try {
    const result = await singleFlightFootballHome(url, env, context);
    const payload = result.payload;
    const response = jsonResponse(payload, 200, {
      "Cache-Control":result.stale ? "public, max-age=30, s-maxage=60, stale-while-revalidate=300" : FOOTBALL_HOME_CACHE,
      "X-Data-Partial":payload.errors?.length ? "true" : "false",
      "X-Data-Stale":result.stale ? "true" : "false",
      "X-Data-Cache":result.source,
    });
    writeEdgeCache(cache, cacheKey, response, context);
    return response;
  } catch (error) {
    const locked = error?.message === "provider_refresh_in_progress";
    return jsonResponse({ error:locked ? "provider_refresh_in_progress" : "football_home_unavailable", provider:"sportmonks" }, locked ? 503 : 502, { "Cache-Control":"no-store", "Retry-After":locked ? "3" : "60" });
  }
}

const MATCHDAY_FINISHED_STATES = new Set(["bitti", "ft", "aet", "pen", "finished", "after penalties", "after extra time"]);

function matchdayRefreshSeconds(body, now = Date.now()) {
  const fixture = body?.fixture || {};
  const status = String(fixture.status || "").toLocaleLowerCase("tr-TR");
  if (MATCHDAY_FINISHED_STATES.has(status)) return 7 * 86400;
  const kickoff = Date.parse(fixture.kickoff_utc || fixture.kickoff || fixture.starting_at || "");
  if (!Number.isFinite(kickoff)) return 300;
  const distance = kickoff - now;
  if (distance > 24 * 3600000) return 21600;
  if (distance > 2 * 3600000) return 900;
  if (distance > 60 * 60000) return 300;
  if (distance > 15 * 60000) return 60;
  if (distance > -4 * 3600000) return 10;
  return 300;
}

function matchdaySnapshotIsFresh(snapshot, now = Date.now()) {
  if (!snapshot?.body) return false;
  const fetchedAt = Date.parse(snapshot.fetchedAt || snapshot.body.updatedAt || "");
  if (!Number.isFinite(fetchedAt)) return false;
  return now - fetchedAt <= matchdayRefreshSeconds(snapshot.body, now) * 1000;
}

function matchdayCacheHeader(body) {
  const ttl = matchdayRefreshSeconds(body);
  const browserTtl = Math.min(ttl, MATCHDAY_FINISHED_STATES.has(String(body?.fixture?.status || "").toLocaleLowerCase("tr-TR")) ? 21600 : 300);
  return `public, max-age=${browserTtl}, s-maxage=${ttl}, stale-while-revalidate=${Math.max(30, Math.min(3600, ttl))}`;
}

async function fetchMatchdayProviderBody(fixtureId, token) {
  const providerResult = await sportmonksFixtureRequest(`/fixtures/${fixtureId}`, token);
  const row = providerResult?.payload?.data || providerResult?.payload || {};
  const fixture = normalizeProviderFixture(row, "sportmonks");
  if (!fixture) {
    const error = new Error("fixture_unavailable");
    error.status = 404;
    throw error;
  }
  const providerLeagueId = String(row?.league_id || row?.league?.id || fixture.provider_league_id || "");
  const leagueKey = selectedLeagueKeyForProviderLeagueId(providerLeagueId);
  if (!leagueKey) {
    const error = new Error("fixture_out_of_scope");
    error.status = 400;
    throw error;
  }
  fixture.provider_league_id = providerLeagueId;
  fixture.league_key = leagueKey;
  const details = normalizeSportmonksFixtureDetails(row);
  const participants = relationRows(row.participants);
  const home = participants.find((item) => String(item?.meta?.location || "").toLowerCase() === "home") || participants[0] || {};
  const away = participants.find((item) => String(item?.meta?.location || "").toLowerCase() === "away") || participants[1] || {};
  const scores = relationRows(row.scores);
  const scoreFor = (participant) => {
    const matching = scores.filter((score) => String(score?.participant_id || "") === String(participant?.id || ""));
    const preferred = matching.find((score) => /current|total|2nd_half/i.test(String(score?.description || score?.type?.name || ""))) || matching.at(-1);
    const value = preferred?.score?.goals ?? preferred?.score ?? preferred?.goals;
    return Number.isFinite(Number(value)) ? Number(value) : null;
  };
  const activePeriod = details.periods.find((period) => period?.ticking) || null;
  const derivedStatus = fixture.status || (activePeriod ? "canlı" : null);
  const derivedMinute = Number.isFinite(Number(activePeriod?.minutes)) ? Number(activePeriod.minutes) : fixture.minute ?? null;
  return {
    source:"Sportmonks Football API",
    provider:"sportmonks",
    league:leagueKey,
    updatedAt:new Date().toISOString(),
    degraded:Boolean(providerResult?.degraded),
    fixture:{ ...fixture, status:derivedStatus, minute:derivedMinute, score:{ home:scoreFor(home), away:scoreFor(away) } },
    details,
  };
}

function matchdaySnapshotResponse(snapshot, { stale = false, reason = null } = {}) {
  const fetchedAt = Date.parse(snapshot?.fetchedAt || snapshot?.body?.updatedAt || "");
  const staleAgeSeconds = Number.isFinite(fetchedAt) ? Math.max(0, Math.round((Date.now() - fetchedAt) / 1000)) : 0;
  return {
    ...snapshot.body,
    snapshot:true,
    stale,
    staleAgeSeconds,
    degraded:stale || Boolean(snapshot.body?.degraded),
    reason:reason || undefined,
    snapshotUpdatedAt:snapshot.providerUpdatedAt || snapshot.fetchedAt || snapshot.body?.updatedAt || null,
    nextRefreshInSeconds:matchdayRefreshSeconds(snapshot.body),
  };
}

async function syncMatchdayFixture(env, fixtureId, { force = false } = {}) {
  const token = env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN;
  if (!token || !/^\d+$/.test(String(fixtureId))) return { outcome:"skipped" };
  const existing = await readMatchdaySnapshot(env, fixtureId);
  if (!force && matchdaySnapshotIsFresh(existing)) return { outcome:"fresh", snapshot:existing };
  const scopeKey = `matchday:${fixtureId}`;
  if (await isCircuitOpen(env, "matchday", scopeKey)) return { outcome:"circuit_open", snapshot:existing };
  if (!await acquireSyncLock(env, scopeKey, 25)) return { outcome:"locked", snapshot:existing };
  const startedAt = Date.now();
  try {
    const body = await fetchMatchdayProviderBody(fixtureId, token);
    await persistMatchdaySnapshot(env, fixtureId, body);
    await recordSyncRun(env, { endpointClass:"matchday", scopeKey, startedAt, httpStatus:200, outcome:"ok" });
    return { outcome:"ok", body };
  } catch (error) {
    await recordSyncRun(env, { endpointClass:"matchday", scopeKey, startedAt, httpStatus:error?.status || 502, outcome:error?.status === 429 ? "rate_limited" : "upstream_error", rateLimitRemaining:error?.rateLimitRemaining ?? null, errorCode:safeErrorMessage(error) });
    return { outcome:error?.status === 429 ? "rate_limited" : "failed", snapshot:existing, error };
  }
}

async function warmDueMatchdays(env) {
  const due = await readDueProviderFixtures(env);
  let attempted = 0;
  for (const fixture of due) {
    if (attempted >= 12) break;
    const fixtureId = String(fixture?.provider_fixture_id || "");
    if (!/^\d+$/.test(fixtureId)) continue;
    const existing = await readMatchdaySnapshot(env, fixtureId);
    if (matchdaySnapshotIsFresh(existing)) continue;
    attempted += 1;
    const result = await syncMatchdayFixture(env, fixtureId);
    if (result.outcome === "rate_limited" || result.outcome === "circuit_open") break;
  }
}

async function fixtureCatalogIsFresh(env, leagueKey, now = Date.now()) {
  if (!supabaseServiceKey(env)) return false;
  try {
    const cutoff = new Date(now - 6 * 3600000).toISOString();
    const rows = await supabaseRest(env, `provider_fixtures?sport=eq.football&league_key=eq.${encodeURIComponent(leagueKey)}&updated_at=gte.${encodeURIComponent(cutoff)}&select=provider_fixture_id&limit=1`);
    return Array.isArray(rows) && rows.length > 0;
  } catch (_error) {
    return false;
  }
}

async function refreshFixtureCatalogs(env) {
  const token = env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN;
  if (!token) return;
  const leagues = Object.keys(SELECTED_LEAGUE_IDS_BY_KEY).filter((key) => key !== "all");
  for (const leagueKey of leagues) {
    if (await fixtureCatalogIsFresh(env, leagueKey)) continue;
    const scopeKey = `catalog:${leagueKey}`;
    if (await isCircuitOpen(env, "catalog", scopeKey)) continue;
    if (!await acquireSyncLock(env, scopeKey, 120)) continue;
    const startedAt = Date.now();
    try {
      const payload = await fetchSportmonksSeasonBundle(leagueKey, token);
      await persistSeasonFixtures(env, leagueKey, payload.matches);
      await recordSyncRun(env, { endpointClass:"catalog", scopeKey, startedAt, httpStatus:200, outcome:"ok" });
    } catch (error) {
      await recordSyncRun(env, { endpointClass:"catalog", scopeKey, startedAt, httpStatus:error?.status || 502, outcome:error?.status === 429 ? "rate_limited" : "upstream_error", rateLimitRemaining:error?.rateLimitRemaining ?? null, errorCode:safeErrorMessage(error) });
      if (error?.status === 429) break;
    }
  }
}

async function maintainMatchdayCatalog(env) {
  await refreshFixtureCatalogs(env);
  await warmDueMatchdays(env);
}

async function handleFootballMatchday(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error:"method_not_allowed" }, 405, { Allow:"GET" });
  const token = env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN;
  if (!token) return jsonResponse({ error:"sportmonks_not_configured", provider:"sportmonks" }, 503, { "Cache-Control":"no-store" });
  const fixtureId = String(new URL(request.url).searchParams.get("fixture") || "").replace(/^sportmonks:/, "");
  if (!/^\d+$/.test(fixtureId)) return jsonResponse({ error:"invalid_fixture" }, 400, { "Cache-Control":"no-store" });
  const cache = edgeCache();
  const cacheKey = new Request(new URL(`/api/football/matchday-cache-v2/${fixtureId}`, request.url), { method:"GET" });
  const cached = await readEdgeCache(cache, cacheKey);
  if (isUsableJsonCache(cached)) return cached;

  const persisted = await readMatchdaySnapshot(env, fixtureId);
  if (matchdaySnapshotIsFresh(persisted)) {
    const body = matchdaySnapshotResponse(persisted);
    const response = jsonResponse(body, 200, { "Cache-Control":matchdayCacheHeader(body), "X-Data-Stale":"false" });
    writeEdgeCache(cache, cacheKey, response, context);
    return response;
  }

  const result = await syncMatchdayFixture(env, fixtureId);
  if (result.body) {
    const body = { ...result.body, snapshot:false, stale:false, staleAgeSeconds:0, nextRefreshInSeconds:matchdayRefreshSeconds(result.body) };
    const response = jsonResponse(body, 200, { "Cache-Control":matchdayCacheHeader(body), "X-Data-Stale":"false" });
    writeEdgeCache(cache, cacheKey, response, context);
    return response;
  }

  const fallback = result.snapshot || persisted;
  if (fallback?.body) {
    const reason = result.outcome === "rate_limited" ? "provider_rate_limited" : result.outcome === "locked" ? "sync_in_progress" : "provider_unavailable";
    return jsonResponse(matchdaySnapshotResponse(fallback, { stale:true, reason }), 200, { "Cache-Control":"public, max-age=30, s-maxage=60", "X-Data-Stale":"true" });
  }
  const status = result.outcome === "rate_limited" ? 429 : result.error?.status === 400 ? 400 : 503;
  return jsonResponse({
    error:status === 429 ? "sportmonks_rate_limited" : result.error?.message === "fixture_out_of_scope" ? "fixture_out_of_scope" : "matchday_unavailable",
    provider:"sportmonks",
    reason:result.outcome,
    retryAfterSeconds:status === 429 ? Math.max(30, Number(result.error?.retryAfter) || 30) : 5,
  }, status, { "Cache-Control":"no-store", "Retry-After":status === 429 ? String(Math.max(30, Number(result.error?.retryAfter) || 30)) : "5" });
}

function normalizeLiveInplayMatch(fixture) {
  const leagueKey = selectedLeagueKeyForProviderLeagueId(fixture?.league_id || fixture?.league?.id);
  if (!leagueKey) return null;
  const participants = relationRows(fixture?.participants);
  const home = participants.find((team) => team?.meta?.location === "home") || participants[0] || {};
  const away = participants.find((team) => team?.meta?.location === "away") || participants[1] || {};
  const code = String(fixture?.state?.short_name || fixture?.state?.state || "LIVE").toUpperCase();
  const periods = relationRows(fixture?.periods);
  const tickingPeriod = periods.find((period) => period?.ticking) || periods.findLast?.((period) => period?.ended == null) || periods.at(-1);
  const providerMinute = fixture?.state?.minute == null ? NaN : Number(fixture.state.minute);
  const periodMinute = tickingPeriod?.minutes == null ? NaN : Number(tickingPeriod.minutes);
  const minute = Number.isFinite(providerMinute) ? providerMinute : Number.isFinite(periodMinute) ? periodMinute : null;
  const finished = /^(?:FT|AET|PEN|AFTER_PENALTIES|FINISHED)$/.test(code);
  const halftime = /^(?:HT|BREAK)$/.test(code);
  return {
    id: `sportmonks:${fixture.id}`,
    leagueKey,
    providerLeagueId: fixture?.league_id ? String(fixture.league_id) : null,
    competition: fixture?.league?.name || "Seçili lig",
    competitionLogo: fixture?.league?.image_path || null,
    country: fixture?.league?.country?.name || null,
    startedAt: fixture?.starting_at || null,
    status: finished ? "finished" : halftime ? "halftime" : "live",
    minute,
    addedTime: Number.isFinite(Number(tickingPeriod?.time_added)) ? Number(tickingPeriod.time_added) : null,
    home: { id: String(home.id || ""), name: String(home.name || "Ev sahibi"), logo: home.image_path || null, score: sportmonksScore(fixture?.scores, home.id) },
    away: { id: String(away.id || ""), name: String(away.name || "Deplasman"), logo: away.image_path || null, score: sportmonksScore(fixture?.scores, away.id) },
  };
}

// nextRefreshInSeconds: handoff #2'deki akilli yenileme takvimini
// yansitir. Istemci bu degeri temel alarak bir sonraki poll'u planlar
// (bkz. assets/js/live.js scheduleNextLivePoll); sunucu tarafi otorite budur.
function nextRefreshSecondsFor(matches) {
  if (matches.some((match) => match.status === "live")) return 6;
  if (matches.some((match) => match.status === "halftime")) return 15;
  return 60;
}

// Kalici bir snapshot satirindan API sozlesmesindeki "matches" ogesini geri
// kurar. payload zaten normalizeLiveInplayMatch ciktisidir.
function matchFromSnapshotRow(row, requestedLeague) {
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : null;
  if (!payload) return null;
  const providerKey = selectedLeagueKeyForProviderLeagueId(payload?.providerLeagueId);
  const persistedKey = String(row?.league_key || payload?.leagueKey || "");
  if (providerKey && persistedKey && providerKey !== persistedKey) return null;
  const fallbackKey = requestedLeague && requestedLeague !== "all" ? requestedLeague : null;
  const leagueKey = providerKey || (FOOTBALL_HOME_LEAGUES.includes(persistedKey) ? persistedKey : null) || fallbackKey;
  if (!leagueKey || !FOOTBALL_HOME_LEAGUES.includes(leagueKey)) return null;
  if (requestedLeague !== "all" && leagueKey !== requestedLeague) return null;
  return { ...payload, leagueKey };
}

function liveMatchesForLeague(matches, league) {
  return (Array.isArray(matches) ? matches : []).filter((match) => {
    const providerKey = selectedLeagueKeyForProviderLeagueId(match?.providerLeagueId);
    if (!providerKey || match?.leagueKey !== providerKey) return false;
    return league === "all" ? FOOTBALL_HOME_LEAGUES.includes(providerKey) : providerKey === league;
  });
}

function validSharedLivePayload(payload) {
  return Boolean(
    payload
    && Array.isArray(payload.matches)
    && payload.matches.every((match) => {
      const providerKey = selectedLeagueKeyForProviderLeagueId(match?.providerLeagueId);
      return Boolean(providerKey && match?.leagueKey === providerKey);
    })
  );
}

function sharedLiveResult(row, source) {
  const fetchedAt = Date.parse(row?.fetched_at || "");
  const stale = !providerSharedCacheFresh(row);
  return {
    outcome:"ok",
    source,
    providerUpdatedAt:row?.payload?.providerUpdatedAt || row?.fetched_at || new Date().toISOString(),
    stale,
    staleAgeSeconds:Number.isFinite(fetchedAt) ? Math.max(0, Math.round((Date.now() - fetchedAt) / 1000)) : 0,
    matches:liveMatchesForLeague(row?.payload?.matches, "all"),
  };
}

// Sportmonks /livescores/inplay provider-global bir uctur. Route kapsamindan
// bagimsiz tek istek yapilir; sonuc provider league_id ile gercek bes lige
// ayrilir, ortak snapshot'a yazilir ve route handler'i sonradan strict filtreler.
async function resolveFootballLiveInplay(env, token, context) {
  let shared = await readProviderSharedCache(env, LIVE_PROVIDER_CACHE_SCOPE);
  if (validSharedLivePayload(shared?.payload) && providerSharedCacheFresh(shared)) {
    return sharedLiveResult(shared, "shared-cache");
  }

  if (await isCircuitOpen(env, "live", LIVE_PROVIDER_SCOPE_KEY)) {
    return { outcome:"circuit_open" };
  }

  const lease = await acquireSyncLease(env, LIVE_PROVIDER_SCOPE_KEY, LIVE_LOCK_TTL_SECONDS);
  if (!lease.acquired) {
    shared = await readProviderSharedCache(env, LIVE_PROVIDER_CACHE_SCOPE);
    if (validSharedLivePayload(shared?.payload)
      && providerSharedCacheWithinStaleWindow(shared, LIVE_SHARED_STALE_SECONDS)) {
      return { ...sharedLiveResult(shared, "shared-cache-locked"), outcome:"locked" };
    }
    return { outcome:"locked" };
  }

  const startedAt = Date.now();
  try {
    // Ilk cache kontrolu ile lock alimi arasinda baska isolate yenilemeyi
    // bitirmis olabilir. Kilit sahibiyken tekrar bakip gereksiz upstream'i kes.
    shared = await readProviderSharedCache(env, LIVE_PROVIDER_CACHE_SCOPE);
    if (validSharedLivePayload(shared?.payload) && providerSharedCacheFresh(shared)) {
      return sharedLiveResult(shared, "shared-cache-after-lock");
    }

    const payload = await sportmonksLiveInplayRequest(token);
    const matches = relationRows(payload?.data)
      .map((fixture) => normalizeLiveInplayMatch(fixture))
      .filter(Boolean);
    const providerUpdatedAt = new Date().toISOString();

    // Bos sonuc da yazilir: dogrulanmis "canli mac yok" yaniti diger lig
    // isteklerinin ayni 5sn pencerede provider'a yeniden gitmesini engeller.
    await writeProviderSharedCache(env, LIVE_PROVIDER_CACHE_SCOPE, {
      providerUpdatedAt,
      matches,
    }, LIVE_SHARED_TTL_SECONDS);
    const previousRows = await readLiveSnapshots(env, "all");
    await persistLiveSnapshots(env, matches, previousRows);
    context.waitUntil(recordSyncRun(env, {
      endpointClass:"live", scopeKey:LIVE_PROVIDER_SCOPE_KEY, startedAt,
      httpStatus:200, outcome:"ok",
    }));
    return { outcome:"ok", source:"provider", providerUpdatedAt, matches };
  } catch (error) {
    const status = Number(error?.status) || 0;
    const outcome = status === 401 || status === 403
      ? "config_error"
      : status === 429
        ? "rate_limited"
        : error?.name === "AbortError"
          ? "timeout"
          : "upstream_error";
    context.waitUntil(recordSyncRun(env, {
      endpointClass:"live", scopeKey:LIVE_PROVIDER_SCOPE_KEY, startedAt,
      httpStatus:status, outcome,
      rateLimitRemaining:error?.rateLimitRemaining ?? null,
      errorCode:status === 401
        ? "sportmonks_token_invalid"
        : status === 403
          ? "sportmonks_plan_restricted"
          : safeErrorMessage(error),
    }));
    return { outcome:"error", error };
  } finally {
    await releaseSyncLease(env, LIVE_PROVIDER_SCOPE_KEY, lease.holder);
  }
}

async function singleFlightFootballLiveInplay(env, token, context) {
  if (footballLiveRefreshPromise) return footballLiveRefreshPromise;
  const promise = resolveFootballLiveInplay(env, token, context);
  footballLiveRefreshPromise = promise;
  try {
    return await promise;
  } finally {
    if (footballLiveRefreshPromise === promise) footballLiveRefreshPromise = null;
  }
}

async function handleFootballLive(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  const token = env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN;
  const league = validLeagueKey(new URL(request.url).searchParams.get("league"));
  if (!league) return jsonResponse({ error: "invalid_league" }, 400, { "Cache-Control": "no-store" });
  const nowIso = new Date().toISOString();
  const baseMeta = { provider: "sportmonks", league, updatedAt: nowIso };

  if (!token) {
    // Saglayici yapilandirilmamis: bunu "canli mac yok" ile karistirma, acikca
    // ayirt edilebilir bir sebep kodu don. `error` alani geriye donuk
    // uyumluluk icindir (istemci fallback mesaji icin okur); `reason` handoff
    // #3'teki makinece ayristirilabilir sozlesmedir.
    return jsonResponse({ ...baseMeta, error: "sportmonks_not_configured", providerUpdatedAt: null, stale: false, staleAgeSeconds: 0, degraded: true, reason: "not_configured", nextRefreshInSeconds: 60, matches: [] }, 503, { "Cache-Control": "no-store" });
  }

  // Son doğrulanmış snapshot'ları her durumda hazır tut (basari/hata farketmez);
  // upstream basarisiz olursa veya kilit alinamazsa buradan dönülür.
  const snapshotRows = await readLiveSnapshots(env, league);
  const snapshotMatches = snapshotRows.map((row) => matchFromSnapshotRow(row, league)).filter(Boolean);
  const newestFetchedAt = snapshotRows.reduce((max, row) => {
    const t = Date.parse(row?.fetched_at || "");
    return Number.isFinite(t) ? Math.max(max, t) : max;
  }, 0);
  const staleAgeSeconds = newestFetchedAt ? Math.max(0, Math.round((Date.now() - newestFetchedAt) / 1000)) : null;

  const respondWithSnapshot = (status, reason, degraded) => {
    const nextRefreshInSeconds = nextRefreshSecondsFor(snapshotMatches);
    return jsonResponse({
      ...baseMeta,
      providerUpdatedAt: newestFetchedAt ? new Date(newestFetchedAt).toISOString() : null,
      stale: true,
      staleAgeSeconds: staleAgeSeconds ?? 0,
      degraded,
      reason,
      nextRefreshInSeconds,
      matches: snapshotMatches,
    }, status, { "Cache-Control": "no-store", "X-Data-Stale": "true" });
  };

  const liveResult = await singleFlightFootballLiveInplay(env, token, context);

  if (liveResult.outcome === "circuit_open") {
    return snapshotMatches.length
      ? respondWithSnapshot(200, "provider_unavailable", true)
      : jsonResponse({ ...baseMeta, providerUpdatedAt: null, stale: false, staleAgeSeconds: 0, degraded: true, reason: "provider_unavailable", nextRefreshInSeconds: 30, matches: [] }, 503, { "Cache-Control": "no-store", "Retry-After": "30" });
  }

  if (liveResult.outcome === "locked") {
    // Baska bir isolate provider-global yenilemeyi yapiyor. Ortak cache daha
    // once yazildiysa onu, aksi halde yalnizca istenen ligin snapshot'ini sun.
    const hasSharedResult = Array.isArray(liveResult.matches);
    const lockedMatches = hasSharedResult
      ? liveMatchesForLeague(liveResult.matches, league)
      : snapshotMatches;
    const lockedUpdatedAt = liveResult.providerUpdatedAt
      || (newestFetchedAt ? new Date(newestFetchedAt).toISOString() : null);
    if (hasSharedResult && liveResult.stale) {
      // 5sn freshness'i bitmis ama 45sn guvenli stale penceresindeki ortak
      // skor, lock kaybeden istek icin korunur. Bu veri yeni/otoritatif ya da
      // dogrulanmis "mac yok" gibi sunulamaz; yenileme hala baska isolate'tadir.
      return jsonResponse({
        ...baseMeta,
        providerUpdatedAt:lockedUpdatedAt,
        stale:true,
        staleAgeSeconds:liveResult.staleAgeSeconds ?? 0,
        degraded:true,
        reason:"sync_in_progress",
        nextRefreshInSeconds:2,
        matches:lockedMatches,
      }, 200, {
        "Cache-Control":"no-store",
        "X-Data-Stale":"true",
        "Retry-After":"2",
      });
    }
    if (!hasSharedResult && snapshotMatches.length) {
      return jsonResponse({
        ...baseMeta,
        providerUpdatedAt:lockedUpdatedAt,
        stale:true,
        staleAgeSeconds:staleAgeSeconds ?? 0,
        degraded:true,
        reason:"sync_in_progress",
        nextRefreshInSeconds:2,
        matches:snapshotMatches,
      }, 200, {
        "Cache-Control":"no-store",
        "X-Data-Stale":"true",
        "Retry-After":"2",
      });
    }
    return lockedMatches.length
      ? jsonResponse({ ...baseMeta, providerUpdatedAt: lockedUpdatedAt, stale: false, staleAgeSeconds: staleAgeSeconds ?? 0, degraded: false, nextRefreshInSeconds: nextRefreshSecondsFor(lockedMatches), matches: lockedMatches }, 200, { "Cache-Control": "no-store" })
      : hasSharedResult
        ? jsonResponse({ ...baseMeta, providerUpdatedAt: lockedUpdatedAt, stale: false, staleAgeSeconds: 0, degraded: false, reason: "no_live_matches", nextRefreshInSeconds: 30, matches: [] }, 200, { "Cache-Control": "no-store" })
        : jsonResponse({ ...baseMeta, providerUpdatedAt: null, stale: false, staleAgeSeconds: 0, degraded: true, reason: "sync_in_progress", nextRefreshInSeconds: 2, matches: [] }, 503, { "Cache-Control":"no-store", "Retry-After":"2" });
  }

  if (liveResult.outcome === "ok") {
    const matches = liveMatchesForLeague(liveResult.matches, league);
    return jsonResponse({
      ...baseMeta,
      providerUpdatedAt: liveResult.providerUpdatedAt,
      stale: false,
      staleAgeSeconds: 0,
      degraded: false,
      reason: matches.length ? undefined : "no_live_matches",
      nextRefreshInSeconds: nextRefreshSecondsFor(matches),
      matches,
    }, 200, { "Cache-Control": LIVE_API_CACHE });
  }

  {
    const error = liveResult.error || new Error("sportmonks_upstream_unavailable");
    const status = error?.status;
    if (status === 401 || status === 403) {
      return jsonResponse({ ...baseMeta, error: status === 401 ? "sportmonks_token_invalid" : "sportmonks_plan_restricted", providerUpdatedAt: null, stale: false, staleAgeSeconds: 0, degraded: true, reason: status === 401 ? "not_configured" : "plan_restricted", nextRefreshInSeconds: 60, matches: [] }, status, { "Cache-Control": "no-store", "Retry-After": "300" });
    }
    if (status === 429) {
      return snapshotMatches.length
        ? respondWithSnapshot(200, "provider_rate_limited", true)
        : jsonResponse({ ...baseMeta, error: "sportmonks_rate_limited", providerUpdatedAt: null, stale: false, staleAgeSeconds: 0, degraded: true, reason: "provider_rate_limited", nextRefreshInSeconds: Math.max(30, Number(error?.retryAfter) || 30), matches: [] }, 429, { "Cache-Control": "no-store", "Retry-After": String(Math.max(30, Number(error?.retryAfter) || 30)) });
    }
    // Timeout, 5xx, HTML/bozuk JSON (parseProviderJson zaten bunu hataya
    // ceviriyor) -- hepsi ayni "provider_unavailable" siniftadir ama asla
    // matches:[] BASARILI YANIT olarak maskelenmez.
    return snapshotMatches.length
      ? respondWithSnapshot(200, "stale_snapshot", true)
      : jsonResponse({ ...baseMeta, error: "sportmonks_upstream_unavailable", providerUpdatedAt: null, stale: false, staleAgeSeconds: 0, degraded: true, reason: "provider_unavailable", nextRefreshInSeconds: 20, matches: [] }, 503, { "Cache-Control": "no-store", "Retry-After": "20" });
  }
}

async function handleFootballFixture(request, env) {
  if (request.method !== "GET") return jsonResponse({ error:"method_not_allowed" }, 405, { Allow:"GET" });
  const token = env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN;
  if (!token) return jsonResponse({ error:"sportmonks_not_configured" }, 503, { "Cache-Control":"no-store" });
  const id = String(new URL(request.url).searchParams.get("id") || "").replace(/^sportmonks:/, "");
  if (!/^\d+$/.test(id)) return jsonResponse({ error:"invalid_fixture_id" }, 400, { "Cache-Control":"no-store" });
  try {
    const result = await sportmonksFixtureRequest(`/fixtures/${encodeURIComponent(id)}`, token);
    const row = result.payload?.data || {};
    const leagueKey = selectedLeagueKeyForProviderLeagueId(row?.league_id || row?.league?.id);
    const fixture = normalizeProviderFixture(row, row?.league || { id:row?.league_id }, row?.season_id, row?.round_id);
    if (fixture && leagueKey) fixture.league_key = leagueKey;
    return jsonResponse({ source:"sportmonks-football-api-v3", id:`sportmonks:${id}`, updatedAt:new Date().toISOString(), fixture:fixture || null, details:normalizeSportmonksFixtureDetails(row), coverage:{ includes:result.includes.split(";") }, degraded:result.degraded }, 200, { "Cache-Control":SEASON_CACHE });
  } catch (error) {
    return jsonResponse({ error:error?.status===403?"sportmonks_plan_restricted":"sportmonks_fixture_unavailable" }, error?.status===403?403:502, { "Cache-Control":"no-store", "Retry-After":"60" });
  }
}

// ===================== CANLI SKOR: AYRIŞTIRILMIŞ AYRINTI UÇLARI (handoff #3) =====================
// /api/football/live artık zengin include zincirini hiç çağırmıyor (bkz.
// handleFootballLive). Kadro/istatistik/olay gibi pahalı alanlar yalnızca
// istemci gerçekten o sekmeyi açtığında, kendi cache anahtarı ve TTL'iyle
// buradan çekilir.
const MATCH_EVENTS_CACHE = "public, max-age=8, s-maxage=8, stale-while-revalidate=30";
const MATCH_DETAILS_CACHE = "public, max-age=300, s-maxage=1800, stale-while-revalidate=3600";
const MATCH_STATISTICS_LIVE_CACHE = "public, max-age=30, s-maxage=30, stale-while-revalidate=60";
const MATCH_STATISTICS_IDLE_CACHE = "public, max-age=1800, s-maxage=3600, stale-while-revalidate=21600";

async function sportmonksFixtureWithInclude(fixtureId, include, token) {
  const payload = await sportmonksRequest(`/fixtures/${encodeURIComponent(fixtureId)}?include=${encodeURIComponent(include)}`, token);
  return payload?.data || payload || {};
}

function parseMatchFixtureId(pathname) {
  const match = pathname.match(/^\/api\/football\/matches\/([^/]+)\/(events|details|statistics)$/);
  if (!match) return null;
  const id = decodeURIComponent(match[1]).replace(/^sportmonks:/, "");
  return /^\d+$/.test(id) ? { id, resource: match[2] } : null;
}

function normalizeLiveEvent(row, teamById) {
  const team = teamById.get(String(row?.participant_id));
  return {
    provider_event_id: row?.id != null ? String(row.id) : null,
    minute: row?.minute ?? null,
    extra_minute: row?.extra_minute ?? null,
    team_provider_id: row?.participant_id != null ? String(row.participant_id) : null,
    team: team?.name || null,
    player_provider_id: row?.player_id != null ? String(row.player_id) : null,
    player: row?.player_name || row?.player?.display_name || row?.player?.name || null,
    type: row?.type?.name || row?.type?.code || row?.type || row?.addition || "Olay",
    type_id: row?.type_id ?? null,
    result: row?.result || null,
  };
}

// Olaylari kalici olarak da yazar (provider_event_id ile dedup); boylece ayni
// gol istemciye iki kez farkli sirayla gelse bile (ör. gec gelen eski cevap)
// tekrar goruntulenmez -- benzersizlik veritabani duzeyinde garanti edilir.
async function persistLiveEvents(env, fixtureId, leagueKey, events) {
  if (!supabaseServiceKey(env) || !events.length) return;
  const rows = events.filter((event) => event.provider_event_id).map((event) => ({
    fixture_id: fixtureId,
    provider_event_id: event.provider_event_id,
    league_key: leagueKey,
    team_provider_id: event.team_provider_id,
    player_provider_id: event.player_provider_id,
    type: event.type,
    minute: event.minute,
    extra_minute: event.extra_minute,
    payload: event,
  }));
  if (!rows.length) return;
  try {
    await supabaseRest(env, "live_match_events?on_conflict=fixture_id,provider_event_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    });
  } catch (_error) { /* dedup zaten unique constraint ile korunuyor; yazim hatasi hot path'i engellemez */ }
}

async function handleFootballMatchEvents(request, env, fixtureId) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  const token = env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN;
  if (!token) return jsonResponse({ error: "sportmonks_not_configured" }, 503, { "Cache-Control": "no-store" });
  try {
    const fixture = await sportmonksFixtureWithInclude(fixtureId, "participants;events.type;league;state", token);
    const providerLeagueId = String(fixture?.league_id || fixture?.league?.id || "");
    const leagueKey = selectedLeagueKeyForProviderLeagueId(providerLeagueId);
    if (!leagueKey) return jsonResponse({ error: "fixture_out_of_scope" }, 400, { "Cache-Control": "no-store" });
    const participants = relationRows(fixture?.participants);
    const teamById = new Map(participants.map((team) => [String(team?.id), team]));
    const events = relationRows(fixture?.events)
      .map((row) => normalizeLiveEvent(row, teamById))
      .filter((event) => event.provider_event_id)
      .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
    const etag = `"${events.map((event) => event.provider_event_id).join(",") || "empty"}"`;
    if (request.headers.get("If-None-Match") === etag) {
      return new Response(null, { status: 304, headers: { ...securityHeaders(), ETag: etag, "Cache-Control": MATCH_EVENTS_CACHE } });
    }
    // Kalici event dedup: best-effort, yaniti bloklamaz.
    persistLiveEvents(env, `sportmonks:${fixtureId}`, leagueKey, events).catch(() => {});
    return jsonResponse({ provider: "sportmonks", league: leagueKey, fixtureId: `sportmonks:${fixtureId}`, updatedAt: new Date().toISOString(), events }, 200, { "Cache-Control": MATCH_EVENTS_CACHE, ETag: etag });
  } catch (error) {
    return jsonResponse({ error: error?.status === 403 ? "sportmonks_plan_restricted" : "sportmonks_upstream_unavailable" }, error?.status === 403 ? 403 : 502, { "Cache-Control": "no-store", "Retry-After": "30" });
  }
}

async function handleFootballMatchDetails(request, env, fixtureId) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  const token = env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN;
  if (!token) return jsonResponse({ error: "sportmonks_not_configured" }, 503, { "Cache-Control": "no-store" });
  try {
    const fixture = await sportmonksFixtureWithInclude(
      fixtureId,
      "participants;league;state;venue;lineups.player;lineups.position;referees.referee;weatherReport;sidelined.player;formations;periods",
      token
    );
    const providerLeagueId = String(fixture?.league_id || fixture?.league?.id || "");
    const leagueKey = selectedLeagueKeyForProviderLeagueId(providerLeagueId);
    if (!leagueKey) return jsonResponse({ error: "fixture_out_of_scope" }, 400, { "Cache-Control": "no-store" });
    const details = normalizeSportmonksFixtureDetails(fixture);
    delete details.events; // olaylar ayri uctan (/events) sunulur, burada tekrar edilmez
    delete details.statistics; // istatistikler ayri uctan (/statistics) sunulur
    return jsonResponse({ provider: "sportmonks", league: leagueKey, fixtureId: `sportmonks:${fixtureId}`, updatedAt: new Date().toISOString(), details }, 200, { "Cache-Control": MATCH_DETAILS_CACHE });
  } catch (error) {
    return jsonResponse({ error: error?.status === 403 ? "sportmonks_plan_restricted" : "sportmonks_upstream_unavailable" }, error?.status === 403 ? 403 : 502, { "Cache-Control": "no-store", "Retry-After": "60" });
  }
}

async function handleFootballMatchStatistics(request, env, fixtureId) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  const token = env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN;
  if (!token) return jsonResponse({ error: "sportmonks_not_configured" }, 503, { "Cache-Control": "no-store" });
  try {
    const fixture = await sportmonksFixtureWithInclude(fixtureId, "participants;league;state;statistics.type", token);
    const providerLeagueId = String(fixture?.league_id || fixture?.league?.id || "");
    const leagueKey = selectedLeagueKeyForProviderLeagueId(providerLeagueId);
    if (!leagueKey) return jsonResponse({ error: "fixture_out_of_scope" }, 400, { "Cache-Control": "no-store" });
    const stateCode = String(fixture?.state?.short_name || fixture?.state?.state || "").toUpperCase();
    const isLive = ["1H", "2H", "ET", "P", "INT", "LIVE", "HT", "BT"].includes(stateCode);
    const { statistics } = normalizeSportmonksFixtureDetails(fixture);
    return jsonResponse({ provider: "sportmonks", league: leagueKey, fixtureId: `sportmonks:${fixtureId}`, updatedAt: new Date().toISOString(), statistics }, 200, { "Cache-Control": isLive ? MATCH_STATISTICS_LIVE_CACHE : MATCH_STATISTICS_IDLE_CACHE });
  } catch (error) {
    return jsonResponse({ error: error?.status === 403 ? "sportmonks_plan_restricted" : "sportmonks_upstream_unavailable" }, error?.status === 403 ? 403 : 502, { "Cache-Control": "no-store", "Retry-After": "60" });
  }
}

function fixtureLineupForTeam(fixture, teamId) {
  return relationRows(fixture?.lineups)
    .filter((row) => String(row?.team_id) === String(teamId) && (Number(row?.type_id) === 11 || row?.formation_field != null))
    .sort((a, b) => Number(a?.formation_field || 99) - Number(b?.formation_field || 99))
    .slice(0, 11)
    .map((row) => {
      const player = row.player || {};
      const position = row.position || row.detailedposition || row.detailedPosition || {};
      return {
        id: row.player_id || player.id || null,
        name: row.player_name || player.display_name || player.common_name || player.name || null,
        image: player.image_path || null,
        number: row.jersey_number ?? null,
        position: position.name || position.code || null,
        formationField: row.formation_field ?? null,
      };
    }).filter((player) => player.name);
}

function fixtureFormationForTeam(fixture, teamId) {
  const row = relationRows(fixture?.formations).find((formation) => String(formation?.participant_id || formation?.team_id) === String(teamId));
  return row?.formation || row?.name || null;
}

function isoDateOffset(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function latestAvailableLineup(teamId, token) {
  const windows = [[-99, 0], [-199, -100], [-299, -200], [-399, -300]];
  for (const [startOffset, endOffset] of windows) {
    const params = new URLSearchParams({ include: "lineups.player;lineups.position;formations", order: "desc", per_page: "25" });
    const path = `/fixtures/between/${isoDateOffset(startOffset)}/${isoDateOffset(endOffset)}/${encodeURIComponent(teamId)}?${params}`;
    let payload;
    try { payload = await sportmonksRequest(path, token); } catch (error) {
      if ([401, 403, 429].includes(error?.status)) throw error;
      continue;
    }
    const fixtures = relationRows(payload?.data).sort((a, b) => new Date(b?.starting_at || 0) - new Date(a?.starting_at || 0));
    for (const fixture of fixtures) {
      const lineup = fixtureLineupForTeam(fixture, teamId);
      if (lineup.length >= 11) return {
        lineup,
        formation: fixtureFormationForTeam(fixture, teamId),
        fixture: { id: fixture.id || null, name: fixture.name || null, startingAt: fixture.starting_at || null },
      };
    }
  }
  return { lineup: [], formation: null, fixture: null };
}

async function fetchSportmonksClubProfile(teamName, token, requestedTeamId = null, requestedSeasonId = null, requestedTeamImage = null) {
  const searchName = SPORTMONKS_TEAM_SEARCH[teamName] || teamName;
  const searchParams = new URLSearchParams({ include: "venue;coaches.nationality" });
  const teamId = requestedTeamId && /^\d+$/.test(String(requestedTeamId)) ? String(requestedTeamId) : null;
  const seasonId = requestedSeasonId && /^\d+$/.test(String(requestedSeasonId)) ? String(requestedSeasonId) : null;
  let search = null;
  try {
    search = teamId
      ? await sportmonksRequest(`/teams/${encodeURIComponent(teamId)}?${searchParams}`, token)
      : await sportmonksRequest(`/teams/search/${encodeURIComponent(searchName)}?${searchParams}`, token);
  } catch (error) {
    if (!teamId || ![403, 404].includes(error?.status)) throw error;
  }
  const providerTeam = teamId ? relationRows(search?.data)[0] : chooseSportmonksTeam(relationRows(search?.data), searchName);
  const safeTeamImage = /^https:\/\/cdn\.sportmonks\.com\//i.test(String(requestedTeamImage || "")) ? requestedTeamImage : null;
  const team = providerTeam?.id ? providerTeam : (teamId ? { id: teamId, name: teamName, image_path: safeTeamImage } : null);
  if (!team?.id) {
    const error = new Error("Sportmonks team not found"); error.status = 404; throw error;
  }
  let squad = [];
  try {
    const extended = await sportmonksRequest(`/squads/teams/${encodeURIComponent(team.id)}/extended?include=position;detailedPosition`, token);
    squad = normalizeSportmonksSquad(extended);
  } catch (error) {
    if ([401, 429].includes(error?.status)) throw error;
    try {
      const standard = await sportmonksRequest(`/squads/teams/${encodeURIComponent(team.id)}?include=player;position;detailedPosition`, token);
      squad = normalizeSportmonksSquad(standard);
    } catch (standardError) {
      if ([401, 429].includes(standardError?.status)) throw standardError;
    }
  }
  if (!squad.length && seasonId) {
    try {
      const seasonal = await sportmonksRequest(`/squads/seasons/${encodeURIComponent(seasonId)}/teams/${encodeURIComponent(team.id)}?include=player;position`, token);
      squad = normalizeSportmonksSquad(seasonal);
    } catch (error) {
      if ([401, 429].includes(error?.status)) throw error;
    }
  }
  let lastMatch = { lineup: [], formation: null, fixture: null };
  try { lastMatch = await latestAvailableLineup(team.id, token); } catch (error) {
    if ([401, 429].includes(error?.status)) throw error;
  }
  if (!squad.length && lastMatch.lineup.length) squad = lastMatch.lineup;
  const venue = relationRows(team.venue)[0] || team.venue || null;
  return {
    source: "sportmonks-football-api-v3",
    updatedAt: new Date().toISOString(),
    team: { id: team.id, name: team.name || teamName, image: team.image_path || null, founded: team.founded || null },
    venue: venue ? { id: venue.id || null, name: venue.name || null, city: venue.city_name || venue.city?.name || null, capacity: venue.capacity || null, image: venue.image_path || null } : null,
    coach: normalizeSportmonksCoach(team),
    squad,
    lineup: lastMatch.lineup,
    formation: lastMatch.formation,
    lineupFixture: lastMatch.fixture,
  };
}

async function handleClubProfile(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  const token = env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN;
  if (!token) return jsonResponse({ error: "sportmonks_not_configured" }, 503, { "Cache-Control": "no-store" });
  const url = new URL(request.url);
  const team = url.searchParams.get("team") || "";
  const teamId = url.searchParams.get("teamId") || "";
  const seasonId = url.searchParams.get("seasonId") || "";
  const teamImage = url.searchParams.get("teamImage") || "";
  if (!team.trim()) return jsonResponse({ error: "unknown_team" }, 400, { "Cache-Control": "no-store" });
  const cacheUrl = new URL(url); cacheUrl.search = `?team=${encodeURIComponent(team)}&teamId=${encodeURIComponent(teamId)}&seasonId=${encodeURIComponent(seasonId)}&teamImage=${encodeURIComponent(teamImage)}`;
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const staleUrl = new URL(`/api/football/club-stale-v1/${encodeURIComponent(team)}`, request.url);
  const staleKey = new Request(staleUrl.toString(), { method: "GET" });
  const cache = edgeCache();
  const cached = await readEdgeCache(cache, cacheKey); if (cached) return cached;
  const stale = await readEdgeCache(cache, staleKey);
  try {
    const refreshKey = `${team}:${teamId}:${seasonId}`;
    if (!clubProfileRefreshes.has(refreshKey)) clubProfileRefreshes.set(refreshKey, fetchSportmonksClubProfile(team, token, teamId, seasonId, teamImage));
    const payload = await clubProfileRefreshes.get(refreshKey);
    const response = jsonResponse(payload, 200, { "Cache-Control": CLUB_CACHE, "X-Data-Stale": "false" });
    writeEdgeCache(cache, cacheKey, response, context);
    writeEdgeCache(cache, staleKey, jsonResponse(payload, 200, { "Cache-Control": CLUB_STALE_CACHE }), context);
    return response;
  } catch (error) {
    if (stale) {
      const payload = await stale.json(); payload.stale = true;
      return jsonResponse(payload, 200, { "Cache-Control": "public, max-age=60, s-maxage=300", "X-Data-Stale": "true", Warning: '110 - "Response is stale"' });
    }
    const status = error?.status === 401 ? 401 : error?.status === 403 ? 403 : error?.status === 429 ? 429 : error?.status === 404 ? 404 : 502;
    const errorCode = status === 401 ? "sportmonks_token_invalid" : status === 403 ? "sportmonks_plan_restricted" : status === 429 ? "sportmonks_rate_limited" : status === 404 ? "sportmonks_team_not_found" : "sportmonks_upstream_unavailable";
    return jsonResponse({ error: errorCode }, status, { "Cache-Control": "no-store", "Retry-After": status === 429 ? "3600" : "300" });
  } finally {
    clubProfileRefreshes.delete(`${team}:${teamId}:${seasonId}`);
  }
}

/* ===================== INSTAGRAM GÜNDEM GÖNDERİLERİ =====================
   ÖNEMLİ KISIT: Instagram Graph API, üçüncü tarafın (örn. bir kulübün)
   hesabından doğrudan gönderi çekmeye izin vermez. Yalnızca şunlar mümkündür:
     a) Sizin yönettiğiniz Business/Creator hesabının kendi gönderileri
        (/{ig-user-id}/media)
     b) Hashtag araması ile o hashtag'i kullanan HERKESE AÇIK gönderiler
        (/ig_hashtag_search + /{hashtag-id}/recent_media) — takımlarla ilgili
        gündem gönderilerine ulaşmanın desteklenen yolu budur. Kota: 7 günlük
        pencerede en fazla 30 benzersiz hashtag.
   Bu endpoint (b) yolunu kullanır, (a)'yı da destekler ve her ikisi de
   yapılandırılmamışsa net bir hata kodu döndürür (sahte veri üretmez). */

async function instagramGraphRequest(path, params, token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INSTAGRAM_TIMEOUT_MS);
  try {
    const url = new URL(`https://graph.facebook.com/${INSTAGRAM_GRAPH_VERSION}${path}`);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    });
    url.searchParams.set("access_token", token);
    const response = await fetch(url.toString(), { headers: { Accept: "application/json" }, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`Instagram Graph API ${response.status}`);
      error.status = response.status;
      // Meta hata kodlarını yukarı taşı; kota/izin ayrımı için gerekli.
      error.providerMessage = payload?.error?.message || null;
      error.providerCode = payload?.error?.code ?? null;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeInstagramMedia(row, source) {
  if (!row?.id) return null;
  const isVideo = String(row.media_type || "").toUpperCase() === "VIDEO";
  // Video için thumbnail_url, foto/carousel için media_url kullanılır.
  const preview = isVideo ? (row.thumbnail_url || row.media_url || null) : (row.media_url || row.thumbnail_url || null);
  if (!preview && !row.caption) return null;
  const caption = String(row.caption || "").trim();
  return {
    id: String(row.id),
    source,
    permalink: row.permalink || null,
    caption: caption.length > 400 ? `${caption.slice(0, 400)}…` : caption,
    mediaType: row.media_type || "IMAGE",
    preview,
    isVideo,
    username: row.username || null,
    timestamp: row.timestamp || null,
    likeCount: Number.isFinite(Number(row.like_count)) ? Number(row.like_count) : null,
    commentsCount: Number.isFinite(Number(row.comments_count)) ? Number(row.comments_count) : null,
  };
}

async function fetchInstagramHashtagMedia(hashtag, igUserId, token) {
  // 1) Hashtag adını id'ye çevir.
  const search = await instagramGraphRequest("/ig_hashtag_search", { user_id: igUserId, q: hashtag }, token);
  const hashtagId = relationRows(search?.data)[0]?.id;
  if (!hashtagId) return [];
  // 2) O hashtag'in son herkese açık gönderilerini al.
  const media = await instagramGraphRequest(`/${encodeURIComponent(hashtagId)}/recent_media`, {
    user_id: igUserId,
    fields: "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count",
    limit: String(INSTAGRAM_HASHTAG_MEDIA_LIMIT),
  }, token);
  return relationRows(media?.data)
    .map((row) => normalizeInstagramMedia(row, { kind: "hashtag", value: hashtag }))
    .filter(Boolean);
}

async function fetchInstagramOwnMedia(igUserId, token) {
  const media = await instagramGraphRequest(`/${encodeURIComponent(igUserId)}/media`, {
    fields: "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count,username",
    limit: "12",
  }, token);
  return relationRows(media?.data)
    .map((row) => normalizeInstagramMedia(row, { kind: "account", value: row.username || "own" }))
    .filter(Boolean);
}

async function handleInstagramFeed(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });

  const token = env.INSTAGRAM_ACCESS_TOKEN;
  const igUserId = env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  if (!token || !igUserId) {
    return jsonResponse({
      error: "instagram_not_configured",
      provider: "instagram-graph-api",
      // Kurulum için gereken iki secret açıkça bildirilir (değerleri değil).
      required: ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ACCOUNT_ID"],
      note: "Instagram Graph API yalnızca kendi Business hesabınızın gönderilerine ve hashtag aramasına izin verir; başka bir hesabın gönderileri doğrudan çekilemez.",
    }, 503, { "Cache-Control": "no-store" });
  }

  const url = new URL(request.url);
  const league = validLeagueKey(url.searchParams.get("league"), { single: true });
  if (!league) return jsonResponse({ error: "invalid_league" }, 400, { "Cache-Control": "no-store" });

  const cacheUrl = new URL("/api/social/instagram-v1", request.url);
  cacheUrl.searchParams.set("league", league);
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const staleUrl = new URL("/api/social/instagram-stale-v1", request.url);
  staleUrl.searchParams.set("league", league);
  const staleKey = new Request(staleUrl.toString(), { method: "GET" });
  const cache = edgeCache();
  const cached = await readEdgeCache(cache, cacheKey);
  if (isUsableJsonCache(cached)) return cached;
  const stale = await readEdgeCache(cache, staleKey);

  const hashtags = INSTAGRAM_HASHTAGS_BY_LEAGUE[league] || [];
  const errors = [];
  try {
    const settled = await Promise.allSettled([
      ...hashtags.map((tag) => fetchInstagramHashtagMedia(tag, igUserId, token)),
      fetchInstagramOwnMedia(igUserId, token),
    ]);

    const items = [];
    settled.forEach((result, index) => {
      const label = index < hashtags.length ? `hashtag:${hashtags[index]}` : "own-media";
      if (result.status === "fulfilled") items.push(...result.value);
      else errors.push({ source: label, status: result.reason?.status || 502, code: result.reason?.providerCode ?? publicProviderErrorCode(result.reason) });
    });

    // Her gönderi tek kez; en yeni önce.
    const unique = [...new Map(items.map((item) => [item.id, item])).values()]
      .sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0))
      .slice(0, 18);

    // Hiç veri yoksa ve tüm kaynaklar hata verdiyse bunu hata olarak bildir;
    // boş listeyi "içerik yok" gibi göstermek yanıltıcı olurdu.
    if (!unique.length && errors.length && errors.length >= hashtags.length + 1) {
      const first = errors[0];
      const status = [401, 403].includes(first.status) ? first.status : 502;
      return jsonResponse({
        error: status === 401 ? "instagram_token_invalid" : status === 403 ? "instagram_permission_denied" : "instagram_upstream_unavailable",
        provider: "instagram-graph-api", league, errors,
      }, status, { "Cache-Control": "no-store", "Retry-After": "600" });
    }

    const payload = {
      source: "instagram-graph-api",
      league,
      hashtags,
      updatedAt: new Date().toISOString(),
      items: unique,
      errors,
    };
    const response = jsonResponse(payload, 200, { "Cache-Control": INSTAGRAM_CACHE, "X-Data-Stale": "false" });
    writeEdgeCache(cache, cacheKey, response, context);
    writeEdgeCache(cache, staleKey, jsonResponse(payload, 200, { "Cache-Control": INSTAGRAM_STALE_CACHE }), context);
    return response;
  } catch (error) {
    if (stale) {
      const headers = new Headers(stale.headers);
      headers.set("Cache-Control", "public, max-age=120, s-maxage=900");
      headers.set("X-Data-Stale", "true");
      headers.set("Warning", '110 - "Response is stale"');
      return new Response(stale.body, { status: 200, headers });
    }
    const status = error?.status === 401 ? 401 : error?.status === 403 ? 403 : 502;
    return jsonResponse({
      error: status === 401 ? "instagram_token_invalid" : status === 403 ? "instagram_permission_denied" : "instagram_upstream_unavailable",
      provider: "instagram-graph-api",
    }, status, { "Cache-Control": "no-store", "Retry-After": "600" });
  }
}

const MULTISPORT_FEEDS = Object.freeze({
  basketball: { host: "v1.basketball.api-sports.io", path: "games" },
  volleyball: { host: "v1.volleyball.api-sports.io", path: "games" },
});

function multisportDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function normalizeMultisportItem(sport, row) {
  const mma = sport === "mma";
  const first = mma ? row?.fighters?.first : row?.teams?.home;
  const second = mma ? row?.fighters?.second : row?.teams?.away;
  const scoreValue = (value) => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number" || typeof value === "string") return value;
    if (typeof value === "object") {
      for (const key of ["total", "current", "points", "runs", "goals", "score"]) {
        const nested = scoreValue(value[key]);
        if (nested !== null) return nested;
      }
    }
    return null;
  };
  const firstScore = scoreValue(row?.scores?.home);
  const secondScore = scoreValue(row?.scores?.away);
  return {
    sport,
    provider: "api-sports",
    id: row?.id,
    league: mma ? row?.slug : row?.league?.name,
    leagueLogo: row?.league?.logo || null,
    leagueId: row?.league?.id || null,
    season: row?.league?.season || row?.season || null,
    country: row?.country?.name || row?.country || null,
    venue: row?.venue?.name || row?.venue || null,
    date: row?.date || null,
    category: row?.category || null,
    time: row?.time || null,
    timestamp: row?.timestamp || null,
    status: row?.status?.long || row?.status?.short || null,
    score: firstScore != null && secondScore != null ? `${firstScore} - ${secondScore}` : null,
    first: { name: first?.name || null, logo: first?.logo || null, winner: mma ? first?.winner : null },
    second: { name: second?.name || null, logo: second?.logo || null, winner: mma ? second?.winner : null },
  };
}

const CITO_UFC_RESOURCES = Object.freeze({
  upcoming: "events/upcoming", recent: "events/recent", rankings: "rankings",
  fighters: "fighters", live: "live"
});

async function fetchCitoUfc(env, resourceKey, query = new URLSearchParams()) {
  if (!env.CITO_API_KEY) throw new Error("cito_api_not_configured");
  const resource = CITO_UFC_RESOURCES[resourceKey];
  if (!resource) throw new Error("invalid_cito_ufc_resource");
  const upstream = new URL(`https://api.citoapi.com/api/v1/ufc/${resource}`);
  for (const key of ["page", "limit", "division", "hasStats"]) {
    const value = query.get(key); if (value) upstream.searchParams.set(key, value);
  }
  const response = await fetchWithDemandTimeout(upstream, { headers: { "x-api-key": env.CITO_API_KEY, Accept: "application/json" } });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) throw new Error(`cito_ufc_unavailable_${response.status}`);
  return payload;
}

async function handleCitoUfc(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  const input = new URL(request.url);
  const resource = input.searchParams.get("resource") || "upcoming";
  if (!CITO_UFC_RESOURCES[resource]) return jsonResponse({ error: "invalid_ufc_resource" }, 400, { "Cache-Control": "no-store" });
  const cache = edgeCache();
  const cacheKey = new Request(new URL(`/api/ufc/cache/${resource}?${input.searchParams}`, request.url));
  const cached = await readEdgeCache(cache, cacheKey);
  if (isUsableJsonCache(cached)) return cached;
  const ttl = resource === "live" ? 15 : resource === "upcoming" ? 21600 : resource === "rankings" ? 86400 : 604800;
  const query = new URLSearchParams();
  for (const key of ["page", "limit", "division", "hasStats"]) {
    const value = input.searchParams.get(key);
    if (value) query.set(key, value);
  }
  const identity = `${resource}?${query}`;
  try {
    const result = await singleFlightDemandProvider({
      env,
      kind:"cito-ufc",
      identity,
      provider:"citoapi",
      ttlSeconds:ttl,
      staleSeconds:resource === "live" ? 60 : Math.max(86400, ttl),
      validatePayload:(payload) => Boolean(payload && payload.resource === resource && payload.data != null),
      fetchPayload:async () => ({
        source:"citoapi",
        resource,
        updatedAt:new Date().toISOString(),
        data:await fetchCitoUfc(env, resource, query),
      }),
    });
    const output = jsonResponse(result.payload, 200, {
      "Cache-Control":result.stale
        ? "public, max-age=15, s-maxage=30, stale-while-revalidate=120"
        : `public, max-age=${Math.min(ttl, 21600)}, s-maxage=${ttl}, stale-while-revalidate=86400`,
      "X-Data-Cache":result.source,
      "X-Data-Stale":result.stale ? "true" : "false",
    });
    writeEdgeCache(cache, cacheKey, output, context);
    return output;
  } catch (error) {
    const locked = error?.message === "provider_refresh_in_progress";
    return jsonResponse({ error:locked ? "provider_refresh_in_progress" : error?.message || "cito_ufc_unavailable" }, locked ? 503 : 502, {
      "Cache-Control":"no-store",
      "Retry-After":locked ? "1" : "60",
    });
  }
}

const CITO_UFC_PROXY_ROUTE = /^(?:live(?:\/events|\/health|\/[a-z0-9-]+(?:\/state)?)?|events(?:\/(?:upcoming|recent|[a-z0-9-]+(?:\/(?:bouts|stats|odds))?))?|fight-cards\/[a-z0-9-]+\/odds|bouts(?:\/[a-z0-9-]+(?:\/(?:stats|rounds|odds))?)?|fights\/[a-z0-9-]+\/odds|fighters(?:\/[a-z0-9-]+(?:\/(?:stats|fights))?)?|athletes(?:\/[a-z0-9-]+)?|rankings(?:\/(?:meta|media)?(?:\/[a-z0-9-]+)?)?|sync\/status|search)$/i;

async function handleCitoUfcProxy(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  if (!env.CITO_API_KEY) return jsonResponse({ error: "cito_api_not_configured" }, 503, { "Cache-Control": "no-store" });
  const input = new URL(request.url);
  const route = input.pathname.replace(/^\/api\/ufc\/?/, "") || "events/upcoming";
  if (!CITO_UFC_PROXY_ROUTE.test(route)) return jsonResponse({ error: "invalid_ufc_route" }, 400, { "Cache-Control": "no-store" });
  const upstream = new URL(`https://api.citoapi.com/api/v1/ufc/${route}`);
  for (const key of ["q", "page", "limit", "division", "hasStats", "includeStats", "round", "bookmaker"]) {
    const value = input.searchParams.get(key); if (value) upstream.searchParams.set(key, value);
  }
  const live = route.startsWith("live");
  const ttl = live ? 15 : route.includes("/odds") ? 300 : route.includes("/stats") || route.includes("/rounds") ? 1800 : route.includes("upcoming") ? 21600 : route.includes("rankings") ? 86400 : route.includes("fighters/") ? 604800 : 21600;
  const cache = edgeCache();
  const cacheKey = new Request(new URL(`/api/ufc/proxy-cache/${route}?${upstream.searchParams}`, request.url));
  const cached = await readEdgeCache(cache, cacheKey);
  if (isUsableJsonCache(cached)) return cached;
  const identity = `${route}?${upstream.searchParams}`;
  try {
    const result = await singleFlightDemandProvider({
      env,
      kind:"cito-ufc-proxy",
      identity,
      provider:"citoapi",
      ttlSeconds:ttl,
      staleSeconds:live ? 60 : Math.max(86400, ttl),
      validatePayload:(payload) => Boolean(payload && payload.route === route && payload.data != null),
      fetchPayload:async () => {
        const response = await fetchWithDemandTimeout(upstream, { headers:{ "x-api-key":env.CITO_API_KEY, Accept:"application/json" } });
        const data = await response.json().catch(() => null);
        if (!response.ok || data == null) {
          const error = new Error("cito_ufc_upstream_unavailable");
          error.status = response.status;
          throw error;
        }
        return { source:"citoapi", route, updatedAt:new Date().toISOString(), data };
      },
    });
    const output = jsonResponse(result.payload, 200, {
      "Cache-Control":result.stale
        ? "public, max-age=15, s-maxage=30, stale-while-revalidate=120"
        : `public, max-age=${Math.min(ttl, 21600)}, s-maxage=${ttl}, stale-while-revalidate=86400`,
      "X-Data-Cache":result.source,
      "X-Data-Stale":result.stale ? "true" : "false",
    });
    writeEdgeCache(cache, cacheKey, output, context);
    return output;
  } catch (error) {
    const locked = error?.message === "provider_refresh_in_progress";
    return jsonResponse({ error:locked ? "provider_refresh_in_progress" : "cito_ufc_upstream_unavailable" }, locked ? 503 : 502, {
      "Cache-Control":"no-store",
      "Retry-After":locked ? "1" : "60",
    });
  }
}

function apiSportsUpstreamError(status = 502, payload = null, retryAfter = null) {
  const providerStatus = Number(status) || 0;
  const detail = (() => {
    try { return JSON.stringify(payload || {}); } catch { return ""; }
  })();
  const rateLimited = providerStatus === 429 || /rate|limit|quota/i.test(detail);
  const error = new Error(rateLimited ? "api_sports_rate_limited" : "api_sports_upstream_unavailable");
  error.status = rateLimited ? 429 : 502;
  error.providerStatus = providerStatus || null;
  error.retryAfter = Math.max(1, Number(retryAfter) || (rateLimited ? 60 : 10));
  return error;
}

// Bu fonksiyon yalniz singleFlightDemandProvider icindeki lock sahibinden
// cagrilir. Provider payload'ini mevcut normalize/latest-fallback sozlesmesiyle
// uretir; dis route handler'i asagida ortak cache ve lease'i uygular.
async function fetchMultisportTodayProviderResponse(request, env, context, demandSport = null, demandDate = null) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  const requestedSport = demandSport || new URL(request.url).searchParams.get("sport");
  if (!requestedSport) return jsonResponse({ error: "sport_required" }, 400, { "Cache-Control": "no-store" });
  if (!Object.hasOwn(MULTISPORT_FEEDS, requestedSport)) {
    return jsonResponse({ error: "invalid_sport" }, 400, { "Cache-Control": "no-store" });
  }
  if (!env.API_SPORTS_KEY) return jsonResponse({ error: "api_sports_not_configured" }, 503, { "Cache-Control": "no-store" });
  // Dis handler'in identity anahtariyla ayni gun degerini kullan. Gece yarisi
  // sinirinda iki ayri Date okumasi cache kimligi/payload tarihini ayirmasin.
  const date = demandDate || multisportDate();
  const cache = edgeCache();
  const selectedFeeds = Object.entries(MULTISPORT_FEEDS).filter(([sport]) => sport === requestedSport);
  const entries = await Promise.all(selectedFeeds.map(async ([sport, feed]) => {
    const latestKey = new Request(new URL(`/api/sports/latest-v2/${sport}`, request.url), { method: "GET" });
    const latestCached = await readEdgeCache(cache, latestKey);
    try {
      // Today endpointi yalniz kullanicinin baktigi bugunu sorgular. Eski akis
      // tek ekran icin 0,-1,-2,-3,-7 gunlerini paralel cagirip her cold miss'i
      // bes saglayici kredisine ceviriyordu. Gecmis veri yalniz daha once
      // dogrulanip latest cache'e yazildiysa fallback olarak kullanilir.
      const url = new URL(`https://${feed.host}/${feed.path}`);
      url.searchParams.set("date", date);
      const upstream = await fetchWithDemandTimeout(url, { headers: { "x-apisports-key": env.API_SPORTS_KEY, Accept: "application/json" } });
      const contentType = String(upstream.headers.get("content-type") || "");
      const jsonContent = /\bjson\b/i.test(contentType);
      const upstreamPayload = jsonContent ? await upstream.json().catch(() => null) : null;
      if (!upstream.ok) {
        throw apiSportsUpstreamError(upstream.status, upstreamPayload, upstream.headers.get("retry-after"));
      }
      if (!jsonContent || !upstreamPayload || Object.keys(upstreamPayload.errors || {}).length || !Array.isArray(upstreamPayload.response)) {
        throw apiSportsUpstreamError(502, upstreamPayload);
      }
      // Yalniz bu dogrulanmis 2xx + JSON + errors={} + response=[] yolu
      // otoritatif bos sonuc sayilir ve cache'lenebilir.
      const rows = upstreamPayload.response;
      const feedDate = date;
      const items = rows.map((row) => ({ ...normalizeMultisportItem(sport, row), feedDate, archived: feedDate !== date })).filter((row) => row.id).slice(0, 60);
      if (items.length) {
        writeEdgeCache(cache, latestKey, jsonResponse({ sport, feedDate, items }, 200, { "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=7776000" }), context);
      }
      return [sport, items, { stale:false }];
    } catch (error) {
      if (isUsableJsonCache(latestCached)) {
        const previous = await latestCached.json().catch(() => null);
        const archivedItems = Array.isArray(previous?.items)
          ? previous.items.map((item) => ({ ...item, archived:true }))
          : [];
        return [sport, archivedItems, {
          stale:true,
          status:error?.status === 429 ? 429 : 502,
          retryAfter:Math.max(1, Number(error?.retryAfter) || 10),
        }];
      }
      if (error?.name === "AbortError") throw apiSportsUpstreamError(502, { reason:"timeout" });
      throw error?.status ? error : apiSportsUpstreamError(502, { reason:error?.message || "network_error" });
    }
  }));
  const fallbackMeta = entries.map((entry) => entry[2]).find((meta) => meta?.stale) || null;
  const isolatedEntries = entries.map(([sport, items]) => [
    sport,
    (Array.isArray(items) ? items : [])
      // Cache'ten gelen eski/kirli bir kaydın sport alanına güvenme. Koleksiyon
      // anahtarı veri sağlayıcısını zaten kesin olarak tanımlar.
      .map((item) => ({ ...item, sport, provider: item?.provider || "api-sports" }))
      .filter((item) => item.sport === sport)
  ]);
  const payload = {
    source: env.CITO_API_KEY ? "api-sports-and-citoapi" : "api-sports-free",
    date,
    updatedAt: new Date().toISOString(),
    sports: Object.fromEntries(isolatedEntries),
    coverage: Object.fromEntries(isolatedEntries.map(([sport, items]) => [sport, items.length]))
  };
  const response = jsonResponse(payload, 200, {
    "Cache-Control":fallbackMeta ? "no-store" : "public, max-age=0, s-maxage=900, stale-while-revalidate=21600",
    "X-Data-Stale":fallbackMeta ? "true" : "false",
    ...(fallbackMeta ? {
      "X-Upstream-Status":String(fallbackMeta.status || 502),
      "Retry-After":String(fallbackMeta.retryAfter || 10),
    } : {}),
  });
  return response;
}

function validSharedMultisportPayload(payload, sport, date) {
  const keys = payload?.sports && typeof payload.sports === "object" ? Object.keys(payload.sports) : [];
  const items = payload?.sports?.[sport];
  return Boolean(
    payload
    && payload.date === date
    && keys.length === 1
    && keys[0] === sport
    && Array.isArray(items)
    && items.every((item) => item?.sport === sport)
  );
}

async function handleMultisportToday(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error:"method_not_allowed" }, 405, { Allow:"GET" });
  const requestedSport = new URL(request.url).searchParams.get("sport");
  if (!requestedSport) return jsonResponse({ error:"sport_required" }, 400, { "Cache-Control":"no-store" });
  if (!Object.hasOwn(MULTISPORT_FEEDS, requestedSport)) {
    return jsonResponse({ error:"invalid_sport" }, 400, { "Cache-Control":"no-store" });
  }
  if (!env.API_SPORTS_KEY) return jsonResponse({ error:"api_sports_not_configured" }, 503, { "Cache-Control":"no-store" });
  const date = multisportDate();
  const cache = edgeCache();
  const cacheKey = new Request(new URL(`/api/sports/today-v12?date=${date}&sport=${requestedSport}`, request.url), { method:"GET" });
  const cached = await readEdgeCache(cache, cacheKey);
  if (isUsableJsonCache(cached)) return cached;

  try {
    const identity = `${requestedSport}:${date}`;
    const result = await singleFlightDemandProvider({
      env,
      kind:"multisport-today",
      identity,
      provider:"api-sports",
      ttlSeconds:MULTISPORT_SHARED_TTL_SECONDS,
      staleSeconds:MULTISPORT_SHARED_STALE_SECONDS,
      validatePayload:(payload) => validSharedMultisportPayload(payload, requestedSport, date),
      fetchPayload:async () => {
        const response = await fetchMultisportTodayProviderResponse(request, env, context, requestedSport, date);
        const payload = await response.json().catch(() => null);
        if (response.headers.get("x-data-stale") === "true" && validSharedMultisportPayload(payload, requestedSport, date)) {
          // latest edge snapshot kullanilabilir, fakat bunu provider basarisi
          // gibi persistent/route cache'e yeniden yazma.
          const error = new Error("api_sports_upstream_unavailable");
          error.status = Number(response.headers.get("x-upstream-status")) === 429 ? 429 : 502;
          error.retryAfter = Math.max(1, Number(response.headers.get("retry-after")) || 10);
          error.fallbackPayload = payload;
          throw error;
        }
        if (!response.ok || !validSharedMultisportPayload(payload, requestedSport, date)) {
          const error = new Error(payload?.error || "api_sports_upstream_unavailable");
          error.status = response.status;
          throw error;
        }
        return payload;
      },
    });
    const response = jsonResponse(result.payload, 200, {
      "Cache-Control":result.stale
        ? "public, max-age=30, s-maxage=60, stale-while-revalidate=300"
        : "public, max-age=0, s-maxage=900, stale-while-revalidate=21600",
      "X-Data-Cache":result.source,
      "X-Data-Stale":result.stale ? "true" : "false",
    });
    writeEdgeCache(cache, cacheKey, response, context);
    return response;
  } catch (error) {
    const locked = error?.message === "provider_refresh_in_progress";
    const rateLimited = error?.status === 429;
    if (error?.fallbackPayload && validSharedMultisportPayload(error.fallbackPayload, requestedSport, date)) {
      return jsonResponse({
        ...error.fallbackPayload,
        stale:true,
        degraded:true,
        reason:rateLimited ? "provider_rate_limited" : "provider_unavailable",
      }, 200, {
        "Cache-Control":"no-store",
        "X-Data-Stale":"true",
        "Retry-After":String(Math.max(1, Number(error?.retryAfter) || 10)),
      });
    }
    return jsonResponse({
      error:locked ? "provider_refresh_in_progress" : rateLimited ? "api_sports_rate_limited" : "api_sports_upstream_unavailable",
      provider:"api-sports",
    }, locked ? 503 : rateLimited ? 429 : 502, {
      "Cache-Control":"no-store",
      "Retry-After":locked ? "1" : String(Math.max(1, Number(error?.retryAfter) || (rateLimited ? 60 : 10))),
    });
  }
}

// Son N provider_sync_runs kaydindan lig basina ozet cikarir. Yalnizca
// sayimlar/durum kodlari dondurulur; ham saglayici hata metni, URL veya
// token asla /api/health uzerinden disari sizmaz (handoff #8).
async function liveScoreHealthSummary(env) {
  if (!supabaseServiceKey(env)) return { configured: false };
  try {
    const rows = await supabaseRest(env, `provider_sync_runs?endpoint_class=eq.live&order=started_at.desc&limit=40&select=scope_key,outcome,started_at`);
    const snapshots = await supabaseRest(env, `live_match_snapshots?select=league_key,status,fetched_at`);
    const byScope = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      const key = row.scope_key || "unknown";
      if (!byScope.has(key)) byScope.set(key, { ok: 0, failed: 0, lastOutcome: row.outcome, lastRunAt: row.started_at });
      const entry = byScope.get(key);
      if (row.outcome === "ok") entry.ok += 1; else entry.failed += 1;
    }
    const newestSnapshotAt = (Array.isArray(snapshots) ? snapshots : []).reduce((max, row) => {
      const t = Date.parse(row?.fetched_at || "");
      return Number.isFinite(t) ? Math.max(max, t) : max;
    }, 0);
    return {
      configured: true,
      leagues: Object.fromEntries(byScope),
      snapshot_count: Array.isArray(snapshots) ? snapshots.length : 0,
      newest_snapshot_age_seconds: newestSnapshotAt ? Math.max(0, Math.round((Date.now() - newestSnapshotAt) / 1000)) : null,
    };
  } catch (_error) {
    return { configured: true, unavailable: true };
  }
}

async function handleHealth(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET, HEAD" });
  }
  const payload = {
    status: "ok",
    service: "xyzskor-web",
    timestamp: new Date().toISOString(),
    checks: {
      static_delivery: "ok",
      x_feed: env.X_BEARER_TOKEN ? "configured" : "not_configured",
      youtube_media: env.YOUTUBE_API_KEY ? "configured" : "not_configured",
      sportmonks_live: env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN ? "configured" : "not_configured",
      sportmonks_season: env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN ? "configured" : "not_configured",
      sportmonks_clubs: env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN ? "configured" : "not_configured",
      api_sports_multisport: env.API_SPORTS_KEY ? "configured" : "not_configured",
      cito_ufc: env.CITO_API_KEY ? "configured" : "not_configured",
      openblacktop_motorsports: env.OCBLACKTOP_API_KEY ? "configured" : "not_configured",
      instagram: env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_BUSINESS_ACCOUNT_ID ? "configured" : "not_configured"
    },
    live_score: request.method === "GET" ? await liveScoreHealthSummary(env) : { configured: Boolean(supabaseServiceKey(env)) },
  };
  if (request.method === "HEAD") return new Response(null, { status: 200, headers: jsonResponse(payload, 200, { "Cache-Control": "no-store" }).headers });
  return jsonResponse(payload, 200, { "Cache-Control": "no-store" });
}

const MOTORSPORT_SPORTS = Object.freeze({
  "formula-1": "formula1", "formula-e": "formula-e", indycar: "indycar",
  motogp: "moto-gp", moto2: "moto2", moto3: "moto3", wrc: "wrc",
  wec: "wec", "le-mans": "wec", nascar: "nascar"
});

const MOTORSPORT_RESOURCES = Object.freeze({
  events: "events", drivers: "drivers", teams: "teams", seasons: "seasons",
  circuits: "circuits", "standings-drivers": "standings/drivers",
  "standings-teams": "standings/teams", standings: "standings", live: "live/timing"
});

async function handleMotorsportData(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  if (!env.OCBLACKTOP_API_KEY) return jsonResponse({ error: "motorsport_api_not_configured" }, 503, { "Cache-Control": "no-store" });
  const input = new URL(request.url);
  const sport = MOTORSPORT_SPORTS[input.searchParams.get("sport") || ""];
  const resourceKey = input.searchParams.get("resource") || "events";
  const resource = MOTORSPORT_RESOURCES[resourceKey];
  if (!sport || !resource) return jsonResponse({ error: "invalid_motorsport_query" }, 400, { "Cache-Control": "no-store" });
  if (resourceKey === "live" && !["formula1", "nascar", "wrc"].includes(sport)) {
    return jsonResponse({ source: "orange-cat-blacktop", sport, resource: resourceKey, liveSupported: false, data: [] }, 200, { "Cache-Control": "public, max-age=60" });
  }
  const upstream = new URL(`https://api.ocblacktop.com/v1/${sport}/${resource}`);
  for (const key of ["season", "year", "limit", "offset", "page", "status", "eventId", "sessionId"]) {
    const value = input.searchParams.get(key); if (value) upstream.searchParams.set(key, value);
  }
  const cache = edgeCache();
  const live = resourceKey === "live";
  const cacheKey = new Request(new URL(`/api/motorsports/cache/${sport}/${resourceKey}?${upstream.searchParams}`, request.url));
  const cached = await readEdgeCache(cache, cacheKey);
  if (isUsableJsonCache(cached)) return cached;
  const identity = `${sport}/${resourceKey}?${upstream.searchParams}`;
  const sharedTtl = live ? 60 : resourceKey === "events" ? 300 : 604800;
  try {
    const result = await singleFlightDemandProvider({
      env,
      kind:"motorsports",
      identity,
      provider:"orange-cat-blacktop",
      ttlSeconds:sharedTtl,
      staleSeconds:live ? 120 : resourceKey === "events" ? 3600 : 1209600,
      validatePayload:(payload) => Boolean(payload && payload.sport === sport && payload.resource === resourceKey && payload.data != null),
      fetchPayload:async () => {
        const response = await fetchWithDemandTimeout(upstream, { headers:{ "x-api-key":env.OCBLACKTOP_API_KEY, Accept:"application/json" } });
        const data = await response.json().catch(() => null);
        if (!response.ok || data == null) {
          const error = new Error("motorsport_upstream_unavailable");
          error.status = response.status;
          throw error;
        }
        return {
          source:"orange-cat-blacktop",
          sport,
          resource:resourceKey,
          liveSupported:["formula1", "nascar", "wrc"].includes(sport),
          updatedAt:new Date().toISOString(),
          data,
        };
      },
    });
    const cacheControl = live ? "public, max-age=30, s-maxage=60" : resourceKey === "events" ? "public, max-age=120, s-maxage=300" : "public, max-age=21600, s-maxage=604800, stale-while-revalidate=86400";
    const output = jsonResponse(result.payload, 200, {
      "Cache-Control":result.stale ? "public, max-age=15, s-maxage=30, stale-while-revalidate=120" : cacheControl,
      "X-Data-Cache":result.source,
      "X-Data-Stale":result.stale ? "true" : "false",
    });
    writeEdgeCache(cache, cacheKey, output, context);
    return output;
  } catch (error) {
    const locked = error?.message === "provider_refresh_in_progress";
    return jsonResponse({ error:locked ? "provider_refresh_in_progress" : "motorsport_upstream_unavailable" }, locked ? 503 : 502, {
      "Cache-Control":"no-store",
      "Retry-After":locked ? "1" : "60",
    });
  }
}

function withHeaders(response, pathname, requestUrl) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders())) {
    headers.set(name, value);
  }
  const versionedAsset = pathname.startsWith("/assets/") && new URL(requestUrl).searchParams.has("v");
  headers.set("Cache-Control", pathname.startsWith("/assets/")
    ? (versionedAsset ? STATIC_CACHE : UNVERSIONED_STATIC_CACHE)
    : HTML_CACHE);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function fetchAsset(request, env, pathname) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = pathname;
  const assetRequest = new Request(assetUrl, request);
  return env.ASSETS.fetch(assetRequest);
}

export { calculateXYZPerformanceScore, chooseWeeklyXI, selectWeeklyRound };

export default {
  async fetch(request, env, context) {
    try {
    return await (async () => {
    const url = new URL(request.url);
    const retiredSportRoutes = /^\/(kayak|buz-hokeyi|rugby|beyzbol|hentbol|amerikan-futbolu|avustralya-futbolu)(?:\/|$)/;
    if (retiredSportRoutes.test(url.pathname)) return Response.redirect(new URL("/", url), 308);
    if (/^\/(super-lig|premier-league|la-liga|bundesliga|serie-a)\/news\/?$/.test(url.pathname)) {
      return Response.redirect(new URL(url.pathname.replace(/\/news\/?$/, "/agenda"), url), 308);
    }
    if (url.pathname === "/api/sports/today") return handleMultisportToday(request, env, context);
    if (url.pathname === "/api/ufc") return handleCitoUfc(request, env, context);
    if (url.pathname.startsWith("/api/ufc/")) return handleCitoUfcProxy(request, env, context);
    if (url.pathname === "/api/motorsports") {
      const allowedDynamicResources = new Set(["live", "drivers", "teams", "standings-drivers", "standings-teams", "standings"]);
      if (!allowedDynamicResources.has(url.searchParams.get("resource"))) return jsonResponse({ source: "manual-snapshot", refresh: "disabled" }, 423, { "Cache-Control": "public, max-age=86400" });
      return handleMotorsportData(request, env, context);
    }
    if (url.pathname === "/api/health") return handleHealth(request, env);
    if (url.pathname === "/api/predict-game/status") return handlePredictGameStatus(request, env);
    if (url.pathname === "/api/predict-game/session") return handlePredictGameSession(request, env);
    if (url.pathname === "/api/predict-game/complete") return handlePredictGameComplete(request, env);
    if (url.pathname === "/api/predict-game/claim") return handlePredictGameComplete(request, env);
    if (url.pathname === "/api/analytics/event") return handleAnalyticsEvent(request, env);
    if (["/api/social/x", "/api/social/x-media-v2", "/api/social/x-media-v3", "/api/social/x-media-v4"].includes(url.pathname)) return handleXClubFeed(request, env, context);
    if (["/api/social/x-preseason-v1", "/api/social/x-preseason-v2", "/api/social/x-preseason-v3"].includes(url.pathname)) return handleXPreseasonFeed(request, env, context);
    if (url.pathname === "/api/football/x-media") return handleXClubFeed(request, env, context);
    if (url.pathname === "/api/football/x-preseason") return handleXPreseasonFeed(request, env, context);
    if (url.pathname === "/api/football/coverage") return handleFootballCoverage(request, env, context);
    if (url.pathname === "/api/media/youtube") return handleYouTubeMedia(request, env, context);
    if (url.pathname === "/api/football/matchday") return handleFootballMatchday(request, env, context);
    if (url.pathname === "/api/football/prediction") return handleFootballPrediction(request, env);
    if (url.pathname === "/api/football/live") return handleFootballLive(request, env, context);
    const matchResource = parseMatchFixtureId(url.pathname);
    if (matchResource?.resource === "events") return handleFootballMatchEvents(request, env, matchResource.id);
    if (matchResource?.resource === "details") return handleFootballMatchDetails(request, env, matchResource.id);
    if (matchResource?.resource === "statistics") return handleFootballMatchStatistics(request, env, matchResource.id);
    if (url.pathname === "/api/football/fixture") return handleFootballFixture(request, env);
    if (url.pathname === "/api/football/home") return handleFootballHome(request, env, context);
    if (url.pathname === "/api/football/season") return handleFootballSeason(request, env, context);
    if (url.pathname === "/api/football/leaders") return handleFootballLeaders(request, env);
    if (url.pathname === "/api/football/weekly-awards") return handleFootballWeeklyAwards(request, env);
    if (url.pathname === "/api/football/club") return handleClubProfile(request, env, context);
    if (url.pathname === "/api/football/transfers") return handleFootballTransfers(request, env, context);
    if (url.pathname === "/api/social/instagram") return handleInstagramFeed(request, env, context);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    let response = await fetchAsset(request, env, pathname);

    if (response.status === 404 && !pathname.split("/").pop()?.includes(".")) {
      response = await fetchAsset(request, env, "/index.html");
      // SPA fallback: bilinmeyen/uzantısız path'ler için de her zaman index.html
      // gövdesi döndürülür (client-side router her yolu değerlendirebilsin diye),
      // ama gerçek uygulama rotası olmayan path'lerde artık HTTP durumu 200 değil
      // 404 olarak işaretleniyor (arama motorları/izleme araçları için doğru
      // "soft 404" sinyali). Bilinen rotalar (KNOWN_APP_ROUTE_PREFIXES) 200 kalır.
      const firstSegment = url.pathname.split("/").filter(Boolean)[0] || "";
      if (!KNOWN_APP_ROUTE_PREFIXES.has(firstSegment)) {
        response = new Response(response.body, {
          status: 404,
          statusText: "Not Found",
          headers: response.headers,
        });
      }
    }

    return withHeaders(response, pathname, request.url);
    })();
    } catch (error) {
      const code = error?.message === "invalid_json"
        ? "invalid_json"
        : error?.message === "payload_too_large"
          ? "payload_too_large"
          : "internal_error";
      const status = code === "invalid_json" ? 400 : code === "payload_too_large" ? 413 : 500;
      if (status === 500) console.error("[XYZSkor] Unhandled request error", error);
      return jsonResponse({ error:code }, status, { "Cache-Control":"no-store" });
    }
  },
  async scheduled(_controller, env, context) {
    context.waitUntil(Promise.all([
      settlePendingFootballPredictions(env),
      maintainMatchdayCatalog(env),
    ]));
  },
};
