const STATIC_CACHE = "public, max-age=31536000, immutable";
const HTML_CACHE = "public, max-age=0, must-revalidate";
const SOCIAL_CACHE = "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400";
const SOCIAL_STALE_CACHE = "public, max-age=60, s-maxage=604800";
const X_USER_CACHE = "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800";
const X_TIMEOUT_MS = 8000;
const YOUTUBE_CACHE = "public, max-age=300, s-maxage=5400, stale-while-revalidate=21600";
const YOUTUBE_STALE_CACHE = "public, max-age=60, s-maxage=86400";
const YOUTUBE_TIMEOUT_MS = 8000;
const CLUB_CACHE = "public, max-age=600, s-maxage=21600, stale-while-revalidate=86400";
const CLUB_STALE_CACHE = "public, max-age=60, s-maxage=604800";
const TRANSFER_CACHE = "public, max-age=600, s-maxage=3600, stale-while-revalidate=21600";
const SPORTMONKS_TIMEOUT_MS = 12000;
let xFeedRefreshPromise = null;
let youtubeFeedRefreshPromise = null;
const clubProfileRefreshes = new Map();
const X_CLUBS = [
  { team: "Galatasaray", handle: "GalatasaraySK", url: "https://x.com/GalatasaraySK" },
  { team: "Fenerbahçe", handle: "Fenerbahce", url: "https://x.com/Fenerbahce" },
  { team: "Beşiktaş", handle: "Besiktas", url: "https://x.com/Besiktas" },
  { team: "Trabzonspor", handle: "Trabzonspor", url: "https://x.com/Trabzonspor" },
];
const makeXClubList = (pairs) => pairs.map(([team, handle]) => ({ team, handle, url: `https://x.com/${handle}` }));
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

async function fetchXUsers(token, request, context) {
  const cacheUrl = new URL("/api/social/x-users-v1", request.url);
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const cache = edgeCache();
  const cached = await readEdgeCache(cache, cacheKey);
  if (cached) return cached.json();

  const league = new URL(request.url).searchParams.get("league") || "super-lig";
  const clubs = X_CLUBS_BY_LEAGUE[league] || X_CLUBS;
  const usernames = clubs.map((club) => club.handle).join(",");
  const lookup = await xRequest(`/2/users/by?usernames=${encodeURIComponent(usernames)}&user.fields=verified,verified_type,profile_image_url`, token);
  const response = jsonResponse(lookup, 200, { "Cache-Control": X_USER_CACHE });
  writeEdgeCache(cache, cacheKey, response, context);
  return lookup;
}

async function fetchXClubFeed(token, request, context) {
  const league = new URL(request.url).searchParams.get("league") || "super-lig";
  const clubsForLeague = X_CLUBS_BY_LEAGUE[league] || X_CLUBS;
  const lookup = await fetchXUsers(token, request, context);
  const users = new Map((lookup.data || []).map((user) => [String(user.username).toLowerCase(), user]));

  const clubs = await Promise.all(clubsForLeague.map(async (club) => {
    try {
      const user = users.get(club.handle.toLowerCase());
      if (!user) return { ...club, post: null, account_found: false, verified: false };
      const params = new URLSearchParams({
        max_results: "3",
        exclude: "replies,retweets",
        "tweet.fields": "created_at,public_metrics,attachments",
        expansions: "attachments.media_keys",
        "media.fields": "media_key,type,url,preview_image_url,width,height,alt_text",
      });
      const timeline = await xRequest(`/2/users/${encodeURIComponent(user.id)}/tweets?${params}`, token);
      const mediaByKey = new Map((timeline.includes?.media || []).map((media) => [media.media_key, media]));
      return { ...normalizeXPost(club, timeline.data?.[0] || null, mediaByKey), account_found: true, verified: Boolean(user.verified || user.verified_type), profile_image_url: user.profile_image_url || null };
    } catch (error) {
      if (error?.status === 402) throw error;
      return { ...club, post: null, account_found: true, verified: false, upstream_error: error?.status || "unavailable" };
    }
  }));

  return {
    source: "x-api",
    league,
    cost_profile: "media-rich-daily",
    fetch_mode: "verified-club-latest-post-daily",
    updated_at: new Date().toISOString(),
    cache_ttl_seconds: 86400,
    clubs,
  };
}

async function handleXClubFeed(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  if (!env.X_BEARER_TOKEN) return jsonResponse({ error: "x_not_configured" }, 503, { "Cache-Control": "no-store" });

  const cacheUrl = new URL("/api/social/x-media-v2", request.url);
  const requestedLeague = cacheUrl.searchParams.get("league");
  const league = requestedLeague || "super-lig";
  if (requestedLeague) cacheUrl.searchParams.set("league", requestedLeague);
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const staleUrl = new URL("/api/social/x-media-stale-v2", request.url);
  if (requestedLeague) staleUrl.searchParams.set("league", requestedLeague);
  const staleKey = new Request(staleUrl.toString(), { method: "GET" });
  const cache = edgeCache();
  const cached = await readEdgeCache(cache, cacheKey);
  if (cached) return cached;
  const stale = await readEdgeCache(cache, staleKey);

  try {
    if (!xFeedRefreshPromise) xFeedRefreshPromise = fetchXClubFeed(env.X_BEARER_TOKEN, request, context);
    const payload = await xFeedRefreshPromise;
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
    xFeedRefreshPromise = null;
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
  const cached = await readEdgeCache(cache, cacheKey); if (cached) return cached;
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
  const league = url.searchParams.get("league") || "super-lig";
  const teamNames = (url.searchParams.get("teams") || "").split("|").map((name) => name.trim()).filter(Boolean);
  const teamSet = new Set(teamNames.map((name) => normalizedFootballName(name)));
  const cacheUrl = new URL(url);
  cacheUrl.search = `?league=${encodeURIComponent(league)}&teams=${encodeURIComponent(teamNames.slice(0, 80).join("|"))}`;
  const cache = edgeCache();
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const cached = await readEdgeCache(cache, cacheKey); if (cached) return cached;
  const leagueIds = SELECTED_LEAGUE_IDS_BY_KEY[league] || SELECTED_LEAGUE_IDS_BY_KEY["super-lig"];
  const filters = leagueIds?.length ? `&filters=transferLeagues:${leagueIds.join(",")}` : "";
  const confirmedPath = `/transfers?include=player;fromTeam;toTeam&per_page=50${filters}`;
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
  const inScope = (row) => {
    if (!teamSet.size) return true;
    return teamSet.has(normalizedFootballName(row.from)) || teamSet.has(normalizedFootballName(row.to));
  };
  const payload = {
    source: "sportmonks-football-api-v3",
    league,
    updatedAt: new Date().toISOString(),
    confirmed: confirmed.filter(inScope).slice(0, 24),
    rumours: rumours.filter(inScope).slice(0, 24),
    errors,
  };
  const response = jsonResponse(payload, 200, { "Cache-Control": TRANSFER_CACHE });
  writeEdgeCache(cache, cacheKey, response, context);
  return response;
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

async function fetchSportmonksClubProfile(teamName, token) {
  const searchName = SPORTMONKS_TEAM_SEARCH[teamName] || teamName;
  const searchParams = new URLSearchParams({ include: "venue;coaches.nationality" });
  const search = await sportmonksRequest(`/teams/search/${encodeURIComponent(searchName)}?${searchParams}`, token);
  const team = chooseSportmonksTeam(relationRows(search?.data), searchName);
  if (!team?.id) {
    const error = new Error("Sportmonks team not found"); error.status = 404; throw error;
  }
  let squad = [];
  try {
    const extended = await sportmonksRequest(`/squads/teams/${encodeURIComponent(team.id)}/extended?include=position;detailedPosition`, token);
    squad = normalizeSportmonksSquad(extended);
  } catch (error) {
    if ([401, 429].includes(error?.status)) throw error;
    const standard = await sportmonksRequest(`/squads/teams/${encodeURIComponent(team.id)}?include=player;position;detailedPosition`, token);
    squad = normalizeSportmonksSquad(standard);
  }
  let lastMatch = { lineup: [], formation: null, fixture: null };
  try { lastMatch = await latestAvailableLineup(team.id, token); } catch (error) {
    if ([401, 429].includes(error?.status)) throw error;
  }
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
  if (!team.trim()) return jsonResponse({ error: "unknown_team" }, 400, { "Cache-Control": "no-store" });
  const cacheUrl = new URL(url); cacheUrl.search = `?team=${encodeURIComponent(team)}`;
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const staleUrl = new URL(`/api/football/club-stale-v1/${encodeURIComponent(team)}`, request.url);
  const staleKey = new Request(staleUrl.toString(), { method: "GET" });
  const cache = edgeCache();
  const cached = await readEdgeCache(cache, cacheKey); if (cached) return cached;
  const stale = await readEdgeCache(cache, staleKey);
  try {
    if (!clubProfileRefreshes.has(team)) clubProfileRefreshes.set(team, fetchSportmonksClubProfile(team, token));
    const payload = await clubProfileRefreshes.get(team);
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
    clubProfileRefreshes.delete(team);
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
    checks: { static_delivery: "ok", x_feed: env.X_BEARER_TOKEN ? "configured" : "not_configured", youtube_media: env.YOUTUBE_API_KEY ? "configured" : "not_configured", sportmonks_clubs: env.SPORTMONKS_API_TOKEN || env.SPORTMONKS_TOKEN ? "configured" : "not_configured" },
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
    if (["/api/social/x", "/api/social/x-media-v2"].includes(url.pathname)) return handleXClubFeed(request, env, context);
    if (url.pathname === "/api/media/youtube") return handleYouTubeMedia(request, env, context);
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
