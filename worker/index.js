const STATIC_CACHE = "public, max-age=31536000, immutable";
const HTML_CACHE = "public, max-age=0, must-revalidate";
const SOCIAL_CACHE = "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400";
const SOCIAL_STALE_CACHE = "public, max-age=60, s-maxage=604800";
const X_USER_CACHE = "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800";
const X_PRESEASON_CACHE = "public, max-age=900, s-maxage=21600, stale-while-revalidate=86400";
const X_PRESEASON_STALE_CACHE = "public, max-age=120, s-maxage=86400";
const X_TIMEOUT_MS = 8000;
const TRANSLATE_TIMEOUT_MS = 7000;
const YOUTUBE_CACHE = "public, max-age=300, s-maxage=5400, stale-while-revalidate=21600";
const YOUTUBE_STALE_CACHE = "public, max-age=60, s-maxage=86400";
const YOUTUBE_TIMEOUT_MS = 8000;
const CLUB_CACHE = "public, max-age=600, s-maxage=21600, stale-while-revalidate=86400";
const CLUB_STALE_CACHE = "public, max-age=60, s-maxage=604800";
const TRANSFER_CACHE = "public, max-age=600, s-maxage=3600, stale-while-revalidate=21600";
const SEASON_CACHE = "public, max-age=120, s-maxage=900, stale-while-revalidate=3600";
const LIVE_API_CACHE = "public, max-age=5, s-maxage=5, stale-while-revalidate=30";
const SPORTMONKS_TIMEOUT_MS = 12000;
const xFeedRefreshPromises = new Map();
const xPreseasonRefreshPromises = new Map();
let youtubeFeedRefreshPromise = null;
const clubProfileRefreshes = new Map();
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
});

const LEAGUE_KEY_CANONICAL = Object.freeze({
  "ucl": "champions-league",
  "uel": "europa-league",
  "laliga": "la-liga",
  "epl": "premier-league",
  "superlig": "super-lig",
  "super-lig": "super-lig",
  "premier-league": "premier-league",
  "la-liga": "la-liga",
  "champions-league": "champions-league",
  "europa-league": "europa-league",
  "all": "all",
});

const LEAGUE_FALLBACK_TEAMS_FOR_TRANSFERS = Object.freeze({
  "super-lig": ["Galatasaray","Fenerbahçe","Beşiktaş","Trabzonspor","Bursaspor","Adana Demirspor","Alanyaspor","Kasımpaşa","Konyaspor","Sivasspor"],
  "premier-league": ["Liverpool","Arsenal","Manchester City","Chelsea","Tottenham Hotspur","Manchester United","Newcastle United","Aston Villa","Brighton","Bournemouth","Crystal Palace","Everton","Fulham","West Ham United","Brentford","Wolverhampton Wanderers","Leeds United","Sunderland","Burnley","Hull City"],
  "la-liga": ["Barcelona","Real Madrid","Atlético Madrid","Athletic Club","Villarreal","Real Betis","Real Sociedad","Sevilla","Valencia","Celta Vigo","Osasuna","Getafe","Rayo Vallecano","Mallorca","Girona","Espanyol","Levante","Elche"],
  "champions-league": ["Arsenal","Bayern München","Liverpool","Tottenham Hotspur","Barcelona","Chelsea","Sporting CP","Manchester City","Real Madrid","Inter","Paris Saint-Germain","Newcastle United","Juventus","Atlético Madrid","Atalanta","Bayer Leverkusen"],
  "europa-league": ["Roma","Porto","Rangers","Fenerbahçe","Galatasaray","Real Betis","Lazio","Feyenoord","Lyon","Ajax","Braga","Villarreal","Freiburg","Olympiacos","Trabzonspor","Beşiktaş"],
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
const SPORTMONKS_TEAM_SEARCH = Object.freeze({
  Alanyaspor:"Alanyaspor", "Amed Sportif Faaliyetler":"Amed SK", Beşiktaş:"Besiktas", "Çaykur Rizespor":"Rizespor", "Çorum FK":"Corum FK", "Erzurumspor FK":"Erzurumspor", Eyüpspor:"Eyupspor", Fenerbahçe:"Fenerbahce", Galatasaray:"Galatasaray", "Gaziantep FK":"Gaziantep", Gençlerbirliği:"Genclerbirligi", Göztepe:"Goztepe", Başakşehir:"Istanbul Basaksehir", Kasımpaşa:"Kasimpasa", Kocaelispor:"Kocaelispor", Konyaspor:"Konyaspor", Samsunspor:"Samsunspor", Trabzonspor:"Trabzonspor"
});
const SELECTED_LEAGUE_IDS_BY_KEY = Object.freeze({
  "super-lig": ["600"],
  "champions-league": ["2"],
  "europa-league": ["5"],
  "la-liga": ["564"],
  "premier-league": ["8"],
  all: ["600", "2", "5", "564", "8"],
});
const SELECTED_LEAGUE_NAMES_BY_KEY = Object.freeze({
  "super-lig": "Süper Lig",
  "champions-league": "UEFA Champions League",
  "europa-league": "UEFA Europa League",
  "la-liga": "LaLiga",
  "premier-league": "Premier League",
});
const SELECTED_LEAGUE_KEYS = new Set(Object.keys(SELECTED_LEAGUE_IDS_BY_KEY));
const X_LEAGUE_KEYS = new Set(Object.keys(X_CLUBS_BY_LEAGUE));

function resolveLeagueKey(value, fallback = "super-lig") {
  const key = String(value || "").trim().toLocaleLowerCase("tr-TR");
  if (!key) return fallback || "super-lig";
  const normalized = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const compact = normalized.replace(/[^a-z0-9]+/g, "");
  return LEAGUE_KEY_CANONICAL[key] || LEAGUE_KEY_CANONICAL[normalized] || LEAGUE_KEY_CANONICAL[compact] || fallback || "super-lig";
}

function validLeagueKey(value, options = {}) {
  const key = resolveLeagueKey(value, options.defaultLeague || "super-lig");
  if (!SELECTED_LEAGUE_KEYS.has(key)) return null;
  if (options.xFeed && !X_LEAGUE_KEYS.has(key)) return null;
  if (options.single && key === "all") return null;
  return key;
}

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "X-Frame-Options": "DENY",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-origin",
      ...extraHeaders,
    },
  });
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
  const clubs = X_CLUBS_BY_LEAGUE[league] || [];
  const publishers = X_PUBLISHERS_BY_LEAGUE[league] || [];
  const usernames = [...clubs, ...publishers].map((club) => club.handle).join(",");
  const lookup = await xRequest(`/2/users/by?usernames=${encodeURIComponent(usernames)}&user.fields=verified,verified_type,profile_image_url`, token);
  const response = jsonResponse(lookup, 200, { "Cache-Control": X_USER_CACHE });
  writeEdgeCache(cache, cacheKey, response, context);
  return lookup;
}

async function fetchXClubFeed(token, request, context) {
  const league = validLeagueKey(new URL(request.url).searchParams.get("league"), { xFeed:true }) || "super-lig";
  const clubsForLeague = X_CLUBS_BY_LEAGUE[league] || [];
  const publishersForLeague = X_PUBLISHERS_BY_LEAGUE[league] || [];
  const lookup = await fetchXUsers(token, request, context);
  const users = new Map((lookup.data || []).map((user) => [String(user.username).toLowerCase(), user]));

  const loadAccount = async (club, publisher = false) => {
    try {
      const user = users.get(club.handle.toLowerCase());
      if (!user) return { ...club, publisher, post: null, account_found: false, verified: false };
      const params = new URLSearchParams({
        max_results: "5",
        exclude: "replies,retweets",
        "tweet.fields": "created_at,public_metrics,attachments",
        expansions: "attachments.media_keys",
        "media.fields": "media_key,type,url,preview_image_url,width,height,alt_text",
      });
      const timeline = await xRequest(`/2/users/${encodeURIComponent(user.id)}/tweets?${params}`, token);
      const mediaByKey = new Map((timeline.includes?.media || []).map((media) => [media.media_key, media]));
      const posts = await Promise.all((timeline.data || []).slice(0, publisher ? 2 : 1).map(async (row) => {
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
    cost_profile: "media-rich-daily",
    fetch_mode: "verified-club-and-publisher-watchlist",
    updated_at: new Date().toISOString(),
    cache_ttl_seconds: 300,
    publisher_slots: publishersForLeague.length,
    clubs,
    publishers,
  };
}

async function fetchXPreseasonFeed(token, request, context) {
  const league = validLeagueKey(new URL(request.url).searchParams.get("league"), { xFeed:true }) || "super-lig";
  const clubsForLeague = X_CLUBS_BY_LEAGUE[league] || [];
  const lookup = await fetchXUsers(token, request, context);
  const users = new Map((lookup.data || []).map((user) => [String(user.username).toLowerCase(), user]));

  const loadAccount = async (club) => {
    try {
      const user = users.get(club.handle.toLowerCase());
      if (!user) return { ...club, preseason_post: null, account_found: false, verified: false };
      const params = new URLSearchParams({
        max_results: "50",
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
    updated_at: new Date().toISOString(),
    cache_ttl_seconds: 21600,
    clubs,
  };
}

async function handleXClubFeed(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  if (!env.X_BEARER_TOKEN) return jsonResponse({ error: "x_not_configured" }, 503, { "Cache-Control": "no-store" });

  const cacheUrl = new URL("/api/football/x-media-v1", request.url);
  const requestedLeague = new URL(request.url).searchParams.get("league");
  const league = validLeagueKey(requestedLeague, { xFeed:true });
  if (!league) return jsonResponse({ error:"invalid_league" }, 400, { "Cache-Control":"no-store" });
  if (requestedLeague) cacheUrl.searchParams.set("league", requestedLeague);
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const staleUrl = new URL("/api/football/x-media-stale-v1", request.url);
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
      return jsonResponse({ error: "x_credits_depleted" }, 402, { "Cache-Control": "no-store" });
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
      return jsonResponse({ error: "x_credits_depleted" }, 402, { "Cache-Control": "no-store" });
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

async function fetchYouTubeMedia(apiKey) {
  const channelResults = await Promise.all(YOUTUBE_CHANNELS.map(async (channel) => {
    const params = new URLSearchParams({ part: "snippet", channelId: channel.id, maxResults: "4", order: "date", type: "video" });
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
  items.sort((a, b) => Number(b.live) - Number(a.live) || Number(b.upcoming) - Number(a.upcoming) || new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  return { source: "youtube-data-api-v3", updated_at: new Date().toISOString(), refresh_seconds: 5400, channels: YOUTUBE_CHANNELS, items: items.slice(0, 8) };
}

async function handleYouTubeMedia(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  if (!env.YOUTUBE_API_KEY) return jsonResponse({ error: "youtube_not_configured", channels: YOUTUBE_CHANNELS }, 503, { "Cache-Control": "no-store" });
  const cacheUrl = new URL(request.url); cacheUrl.search = "";
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const staleUrl = new URL("/api/media/youtube-stale-v1", request.url);
  const staleKey = new Request(staleUrl.toString(), { method: "GET" });
  const cache = edgeCache();
  const cached = await readEdgeCache(cache, cacheKey); if (isUsableJsonCache(cached)) return cached;
  const stale = await readEdgeCache(cache, staleKey);
  try {
    if (!youtubeFeedRefreshPromise) youtubeFeedRefreshPromise = fetchYouTubeMedia(env.YOUTUBE_API_KEY);
    const payload = await youtubeFeedRefreshPromise;
    const response = jsonResponse(payload, 200, { "Cache-Control": YOUTUBE_CACHE, "X-Data-Stale": "false" });
    writeEdgeCache(cache, cacheKey, response, context);
    writeEdgeCache(cache, staleKey, jsonResponse(payload, 200, { "Cache-Control": YOUTUBE_STALE_CACHE }), context);
    return response;
  } catch (error) {
    if (stale) {
      const headers = new Headers(stale.headers); headers.set("X-Data-Stale", "true"); headers.set("Warning", '110 - "Response is stale"');
      return new Response(stale.body, { status: 200, headers });
    }
    return jsonResponse({ error: error?.status === 403 ? "youtube_quota_or_key_error" : "youtube_upstream_unavailable", channels: YOUTUBE_CHANNELS }, error?.status === 403 ? 403 : 502, { "Cache-Control": "no-store", "Retry-After": "900" });
  } finally {
    youtubeFeedRefreshPromise = null;
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
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`Sportmonks API ${response.status}`);
      error.status = response.status;
      error.providerMessage = payload?.message || null;
      throw error;
    }
    return payload;
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
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`Sportmonks API ${response.status}`);
      error.status = response.status;
      error.providerMessage = payload?.message || null;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function handleFootballCoverage(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error:"method_not_allowed" }, 405, { Allow:"GET" });
  const token = env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN;
  if (!token) return jsonResponse({ error:"sportmonks_not_configured", provider:"sportmonks" }, 503, { "Cache-Control":"no-store" });
  const cacheUrl = new URL("/api/football/coverage-v3", request.url); cacheUrl.search = "";
  const cache = edgeCache(); const cacheKey = new Request(cacheUrl.toString(), { method:"GET" });
  const cached = await readEdgeCache(cache, cacheKey); if (isUsableJsonCache(cached)) return cached;
  try {
    const payload = await sportmonksCoreRequest("/my/leagues", token);
    const availableIds = new Set();
    const visit = (value, depth = 0) => {
      if (!value || depth > 6) return;
      if (Array.isArray(value)) { value.forEach((row) => visit(row, depth + 1)); return; }
      if (typeof value !== "object") return;
      const leagueId = value.league_id || value.league?.id || ((value.name || value.short_code || value.image_path) ? value.id : null);
      if (leagueId !== null && leagueId !== undefined && String(leagueId)) availableIds.add(String(leagueId));
      Object.values(value).forEach((row) => visit(row, depth + 1));
    };
    visit(payload?.data);
    const selected = await Promise.all(Object.entries(SELECTED_LEAGUE_IDS_BY_KEY).filter(([key]) => key !== "all").map(async ([league, ids]) => {
      const leagueId = String(ids[0]);
      try {
        const probe = await sportmonksRequest(`/leagues/${encodeURIComponent(leagueId)}?include=currentSeason`, token);
        const row = relationRows(probe?.data)[0] || null;
        const currentSeason = sportmonksCurrentSeason(row);
        return { league, leagueId, name:row?.name || SELECTED_LEAGUE_NAMES_BY_KEY[league] || null, available:Boolean(row?.id), currentSeasonId:currentSeason?.id ? String(currentSeason.id) : null };
      } catch (error) {
        return { league, leagueId, name:SELECTED_LEAGUE_NAMES_BY_KEY[league] || null, available:false, currentSeasonId:null, status:error?.status || 502 };
      }
    }));
    const response = jsonResponse({ source:"sportmonks-selected-league-probes", updatedAt:new Date().toISOString(), myLeaguesReportedCount:availableIds.size, selected }, 200, { "Cache-Control":"public, max-age=300, s-maxage=3600" });
    writeEdgeCache(cache, cacheKey, response, context); return response;
  } catch (error) {
    return jsonResponse({ error:error?.status === 401 ? "sportmonks_token_invalid" : error?.status === 403 ? "sportmonks_plan_restricted" : "sportmonks_upstream_unavailable", provider:"sportmonks", providerStatus:error?.status || null, detail:error?.providerMessage || error?.message || "unavailable" }, error?.status === 401 || error?.status === 403 ? error.status : 502, { "Cache-Control":"no-store", "Retry-After":"300" });
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
    age: coach.dob ? calculateAge(coach.dob) : coach.age || null,
    contract: coach.meta?.end || row?.meta?.end || row?.meta?.contractEnd || coach.contract_end || row?.contract?.end || null,
    tenure: coach.meta?.start || row?.meta?.start || coach.started_at || row?.contract?.start || coach.contract_start || null,
    source: "sportmonks",
    profile: coach.profile || null,
    role: coach.role?.name || row?.role?.name || coach.role || row?.role || null,
    status: coach.status || row?.status || null,
  };
}

function normalizeSportmonksVenue(row) {
  const venue = relationRows(row?.venue)[0] || row?.venue || null;
  if (!venue) return null;
  const city = venue.city_name || venue.city?.name || venue.city || null;
  const country = venue.country_name || venue.country?.name || venue.country || null;
  const addressParts = [venue.address, venue.location, venue.city, venue.zip_code || venue.zipcode, city, country].filter(Boolean);
  return {
    id: venue.id || null,
    name: venue.name || null,
    city,
    country: typeof country === "string" ? country : null,
    capacity: venue.capacity || null,
    image: venue.image_path || null,
    address: addressParts.length ? addressParts.join(", ") : null,
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
  };
}

async function handleFootballTransfers(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  const token = env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN;
  if (!token) return jsonResponse({ error: "sportmonks_not_configured" }, 503, { "Cache-Control": "no-store" });
  const url = new URL(request.url);
  const league = validLeagueKey(url.searchParams.get("league"), { single:true });
  if (!league) return jsonResponse({ error:"invalid_league" }, 400, { "Cache-Control":"no-store" });
  const queryTeamNames = (url.searchParams.get("teams") || "").split("|").map((name) => name.trim()).filter(Boolean);
  const fallbackTeamNames = LEAGUE_FALLBACK_TEAMS_FOR_TRANSFERS[league] || [];
  const teamNames = [...new Set([...queryTeamNames, ...fallbackTeamNames])].slice(0, 80);
  const teamSet = new Set(teamNames.map((name) => normalizedFootballName(name)));
  const cacheUrl = new URL(url);
  cacheUrl.search = `?league=${encodeURIComponent(league)}&teams=${encodeURIComponent(teamNames.slice(0, 80).join("|"))}`;
  const cache = edgeCache();
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const cached = await readEdgeCache(cache, cacheKey); if (cached) return cached;
  const leagueIds = SELECTED_LEAGUE_IDS_BY_KEY[league] || SELECTED_LEAGUE_IDS_BY_KEY["super-lig"];
  const confirmedPath = "/transfers/latest?include=player;fromTeam;toTeam;type;position;detailedPosition&per_page=50";
  const rumoursPath = `/transfer-rumours?include=player&per_page=50`;
  const [confirmedResult, rumourResult] = await Promise.allSettled([
    sportmonksRequest(confirmedPath, token),
    sportmonksRequest(rumoursPath, token),
  ]);
  const errors = [];
  if (confirmedResult.status === "rejected") errors.push({ source: "transfers", status: confirmedResult.reason?.status || 502, message: confirmedResult.reason?.providerMessage || confirmedResult.reason?.message || "unavailable" });
  if (rumourResult.status === "rejected") errors.push({ source: "transfer-rumours", status: rumourResult.reason?.status || 502, message: rumourResult.reason?.providerMessage || rumourResult.reason?.message || "unavailable" });
  const confirmed = confirmedResult.status === "fulfilled" ? relationRows(confirmedResult.value?.data).map((row) => normalizeSportmonksTransfer(row, "confirmed")) : [];
  const rumours = rumourResult.status === "fulfilled" ? relationRows(rumourResult.value?.data).map((row) => normalizeSportmonksTransfer(row, "rumour")) : [];
  const leagueIdSet = new Set((SELECTED_LEAGUE_IDS_BY_KEY[league] || []).map(String));
  const inScope = (row) => {
    if (teamSet.size && (teamSet.has(normalizedFootballName(row.from)) || teamSet.has(normalizedFootballName(row.to)))) return true;
    const fromTeam = row.fromTeam || row.fromteam || row.from_team || {};
    const toTeam = row.toTeam || row.toteam || row.to_team || {};
    const fromLeagueId = String(fromTeam?.league_id || fromTeam?.league?.id || fromTeam?.competition_id || "");
    const toLeagueId = String(toTeam?.league_id || toTeam?.league?.id || toTeam?.competition_id || "");
    return (fromLeagueId && leagueIdSet.has(fromLeagueId)) || (toLeagueId && leagueIdSet.has(toLeagueId));
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
    form: String(row?.form || "").slice(0, 8),
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
    return { team:team.name || null, player_name:row?.player_name || player.display_name || player.common_name || player.name || null, number:row?.jersey_number ?? null, position:position.name || position.code || null, is_official:true, is_captain:Boolean(row?.captain), is_keeper:/goal|keeper|kaleci/i.test(position.name || position.code || ""), type_id:row?.type_id ?? null };
  }).filter((row) => row.team && row.player_name);
  const absences = relationRows(fixture?.sidelined).map((row) => {
    const player = row?.player || {};
    const team = teamById.get(String(row?.participant_id || row?.team_id)) || {};
    return { team:team.name || null, player_name:player.display_name || player.common_name || player.name || row?.player_name || null, reason:row?.reason || row?.description || row?.category || null, availability_status:row?.type?.name || row?.type || "other", verification_status:"provider", source:"Sportmonks" };
  }).filter((row) => row.team && row.player_name);
  const events = relationRows(fixture?.events).map((row) => ({ id:row?.id || null, minute:row?.minute ?? row?.sort_order ?? null, team:teamById.get(String(row?.participant_id))?.name || null, player:row?.player_name || row?.player?.display_name || row?.player?.name || null, relatedPlayer:row?.related_player_name || row?.relatedplayer?.display_name || null, type:row?.type?.name || row?.type?.code || row?.type || row?.addition || "Olay", result:row?.result || null })).filter((row) => row.team || row.player);
  const statistics = relationRows(fixture?.statistics).map((row) => ({ team:teamById.get(String(row?.participant_id))?.name || null, label:row?.type?.name || row?.type?.code || row?.name || null, value:row?.data?.value ?? row?.value ?? null })).filter((row) => row.team && row.label && row.value !== null);
  const refereeRow = relationRows(fixture?.referees)[0];
  const referee = refereeRow?.referee || refereeRow || null;
  return { lineups, absences, events, statistics, formations:relationRows(fixture?.formations), periods:relationRows(fixture?.periods), venue:fixture?.venue || null, referee:referee ? { name:referee.display_name || referee.common_name || referee.name || null, image:referee.image_path || null } : null, weather:fixture?.weatherreport || fixture?.weatherReport || null };
}

async function sportmonksFixtureRequest(path, token) {
  const includeSets = [
    "participants;scores;league.country;state;events.type;lineups.player;lineups.position;statistics.type;venue;periods;formations;referees.referee;weatherReport;sidelined.player",
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

function utcDateWithOffset(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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
    errors:priorErrors.concat(settled.flatMap((result,index) => result.status === "rejected" ? [{ module:`fixtures-window-${index + 1}`, message:result.reason?.providerMessage || result.reason?.message || "unavailable" }] : [])),
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
  if (!season?.id && [401, 403].includes(leagueLookupError?.status)) throw leagueLookupError;
  if (!season?.id && !leagueResolved) {
    const accessError = new Error(`${SELECTED_LEAGUE_NAMES_BY_KEY[leagueKey] || leagueKey} mevcut Sportmonks aboneliğine dahil değil`);
    accessError.status = 403;
    accessError.providerMessage = accessError.message;
    throw accessError;
  }
  if (!season?.id) return fetchSportmonksLeagueWindow(leagueKey, leagueId, token, [{ module:"season", message:leagueLookupError?.providerMessage || leagueLookupError?.message || "active_season_unavailable" }]);
  const seasonId = String(season.id);
  const [standingsResult, scheduleResult] = await Promise.allSettled([
    sportmonksRequest(`/standings/seasons/${encodeURIComponent(seasonId)}?include=participant;details.type`, token),
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
    errors: [standingsResult, scheduleResult].flatMap((result, index) => result.status === "rejected" ? [{ module: index === 0 ? "standings" : "fixtures", message: result.reason?.providerMessage || result.reason?.message || "unavailable" }] : []).concat(leagueLookupError ? [{ module:"league", message:leagueLookupError?.providerMessage || leagueLookupError?.message || "fallback_used" }] : []),
  };
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
  const cached = await readEdgeCache(cache, cacheKey); if (isUsableJsonCache(cached)) return cached;
  try {
    const payload = await fetchSportmonksSeasonBundle(league, token);
    const response = jsonResponse(payload, 200, { "Cache-Control": SEASON_CACHE, "X-Data-Stale": "false" });
    writeEdgeCache(cache, cacheKey, response, context); return response;
  } catch (error) {
    return jsonResponse({ error: error?.status === 401 ? "sportmonks_token_invalid" : error?.status === 403 ? "sportmonks_plan_restricted" : "sportmonks_upstream_unavailable", provider: "sportmonks", providerStatus:error?.status || null, detail:error?.providerMessage || error?.message || "unavailable" }, error?.status === 401 || error?.status === 403 ? error.status : 502, { "Cache-Control": "no-store", "Retry-After": "300" });
  }
}

async function handleFootballLive(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  const token = env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN;
  if (!token) return jsonResponse({ error: "sportmonks_not_configured", provider: "sportmonks" }, 503, { "Cache-Control": "no-store" });
  const league = validLeagueKey(new URL(request.url).searchParams.get("league"));
  if (!league) return jsonResponse({ error:"invalid_league" }, 400, { "Cache-Control":"no-store" });
  const leagueIds = SELECTED_LEAGUE_IDS_BY_KEY[league] || SELECTED_LEAGUE_IDS_BY_KEY["super-lig"];
  const cacheUrl = new URL(request.url); cacheUrl.search = `?league=${encodeURIComponent(league)}`;
  const cache = edgeCache(); const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const cached = await readEdgeCache(cache, cacheKey); if (cached) return cached;
  try {
    const liveResult = await sportmonksFixtureRequest("/livescores/inplay", token);
    const payload = liveResult.payload;
    const matches = relationRows(payload?.data).filter((fixture) => leagueIds.includes(String(fixture?.league_id))).map((fixture) => {
      const participants = relationRows(fixture?.participants);
      const home = participants.find((team) => team?.meta?.location === "home") || participants[0] || {};
      const away = participants.find((team) => team?.meta?.location === "away") || participants[1] || {};
      const code = String(fixture?.state?.short_name || fixture?.state?.state || "LIVE").toUpperCase();
      return { id:`sportmonks:${fixture.id}`, competition:fixture?.league?.name || "Seçili lig", competitionLogo:fixture?.league?.image_path || null, country:fixture?.league?.country?.name || null, startedAt:fixture?.starting_at || null, status:code === "HT" ? "halftime" : "live", minute:Number.isFinite(Number(fixture?.state?.minute)) ? Number(fixture.state.minute) : null, home:{ id:String(home.id || ""), name:String(home.name || "Ev sahibi"), logo:home.image_path || null, score:sportmonksScore(fixture?.scores, home.id) }, away:{ id:String(away.id || ""), name:String(away.name || "Deplasman"), logo:away.image_path || null, score:sportmonksScore(fixture?.scores, away.id) }, details:normalizeSportmonksFixtureDetails(fixture) };
    });
    const response = jsonResponse({ source:"sportmonks-football-api-v3", league, updatedAt:new Date().toISOString(), matches, coverage:{ matches:matches.length, includes:liveResult.includes.split(";") }, degraded:liveResult.degraded }, 200, { "Cache-Control": LIVE_API_CACHE });
    writeEdgeCache(cache, cacheKey, response, context); return response;
  } catch (error) {
    return jsonResponse({ error: error?.status === 401 ? "sportmonks_token_invalid" : error?.status === 403 ? "sportmonks_plan_restricted" : "sportmonks_upstream_unavailable", provider: "sportmonks" }, error?.status === 401 || error?.status === 403 ? error.status : 502, { "Cache-Control": "no-store", "Retry-After": "30" });
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
    return jsonResponse({ source:"sportmonks-football-api-v3", id:`sportmonks:${id}`, updatedAt:new Date().toISOString(), details:normalizeSportmonksFixtureDetails(result.payload?.data || {}), coverage:{ includes:result.includes.split(";") }, degraded:result.degraded }, 200, { "Cache-Control":SEASON_CACHE });
  } catch (error) {
    return jsonResponse({ error:error?.status===403?"sportmonks_plan_restricted":"sportmonks_fixture_unavailable" }, error?.status===403?403:502, { "Cache-Control":"no-store", "Retry-After":"60" });
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
  const searchParams = new URLSearchParams({ include: "venue;coaches.nationality;venue.country" });
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
  const venue = normalizeSportmonksVenue(team);
  return {
    source: "sportmonks-football-api-v3",
    updatedAt: new Date().toISOString(),
    team: { id: team.id, name: team.name || teamName, image: team.image_path || null, founded: team.founded || null, country: team.country?.name || team.country || null },
    venue,
    address: venue?.address || null,
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

function handleHealth(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET, HEAD" });
  }
  const payload = {
    status: "ok",
    service: "xyzskor-web",
    timestamp: new Date().toISOString(),
    checks: { static_delivery: "ok", x_feed: env.X_BEARER_TOKEN ? "configured" : "not_configured", youtube_media: env.YOUTUBE_API_KEY ? "configured" : "not_configured", sportmonks_live: env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN ? "configured" : "not_configured", sportmonks_season: env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN ? "configured" : "not_configured", sportmonks_clubs: env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN ? "configured" : "not_configured" },
  };
  if (request.method === "HEAD") return new Response(null, { status: 200, headers: jsonResponse(payload, 200, { "Cache-Control": "no-store" }).headers });
  return jsonResponse(payload, 200, { "Cache-Control": "no-store" });
}

function withHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Cache-Control", pathname.startsWith("/assets/") ? STATIC_CACHE : HTML_CACHE);

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

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") return handleHealth(request, env);
    if (["/api/social/x", "/api/social/x-media-v2", "/api/social/x-media-v3", "/api/social/x-media-v4"].includes(url.pathname)) return handleXClubFeed(request, env, context);
    if (["/api/social/x-preseason-v1", "/api/social/x-preseason-v2", "/api/social/x-preseason-v3"].includes(url.pathname)) return handleXPreseasonFeed(request, env, context);
    if (url.pathname === "/api/football/x-media") return handleXClubFeed(request, env, context);
    if (url.pathname === "/api/football/x-preseason") return handleXPreseasonFeed(request, env, context);
    if (url.pathname === "/api/football/coverage") return handleFootballCoverage(request, env, context);
    if (url.pathname === "/api/media/youtube") return handleYouTubeMedia(request, env, context);
    if (url.pathname === "/api/football/live") return handleFootballLive(request, env, context);
    if (url.pathname === "/api/football/fixture") return handleFootballFixture(request, env);
    if (url.pathname === "/api/football/season") return handleFootballSeason(request, env, context);
    if (url.pathname === "/api/football/club") return handleClubProfile(request, env, context);
    if (url.pathname === "/api/football/transfers") return handleFootballTransfers(request, env, context);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    let response = await fetchAsset(request, env, pathname);

    if (response.status === 404 && !pathname.split("/").pop()?.includes(".")) {
      response = await fetchAsset(request, env, "/index.html");
    }

    return withHeaders(response, pathname);
  },
};
