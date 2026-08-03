const STATIC_CACHE = "public, max-age=31536000, immutable";
const HTML_CACHE = "public, max-age=0, must-revalidate";
const SOCIAL_CACHE = "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400";
const SOCIAL_STALE_CACHE = "public, max-age=60, s-maxage=604800";
const X_USER_CACHE = "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800";
const X_TIMEOUT_MS = 8000;
const YOUTUBE_CACHE = "public, max-age=300, s-maxage=5400, stale-while-revalidate=21600";
const YOUTUBE_STALE_CACHE = "public, max-age=60, s-maxage=86400";
const YOUTUBE_TIMEOUT_MS = 8000;
let xFeedRefreshPromise = null;
let youtubeFeedRefreshPromise = null;
const X_CLUBS = [
  { team: "Galatasaray", handle: "GalatasaraySK", url: "https://x.com/GalatasaraySK" },
  { team: "Fenerbahçe", handle: "Fenerbahce", url: "https://x.com/Fenerbahce" },
  { team: "Beşiktaş", handle: "Besiktas", url: "https://x.com/Besiktas" },
  { team: "Trabzonspor", handle: "Trabzonspor", url: "https://x.com/Trabzonspor" },
];
const YOUTUBE_CHANNELS = [
  { name: "Sports Digitale", handle: "@sportsdigitale", id: "UCmEgRY1A2263UXrQhjDuU0Q", url: "https://www.youtube.com/@sportsdigitale" },
  { name: "HT Spor", handle: "@htspor", id: "UCK3mI2lsk3LSo8PBUc8JTSw", url: "https://www.youtube.com/@htspor" },
  { name: "beIN SPORTS Türkiye", handle: "@beINSPORTSTurkiye", id: "UCNopxUNUMinlK3ybMGlpbGQ", url: "https://www.youtube.com/@beINSPORTSTurkiye" },
  { name: "TRT Spor", handle: "@trtspor", id: "UCebdo7-2NdjcktKzco64iNw", url: "https://www.youtube.com/@trtspor" },
];

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

function normalizeXPost(club, post) {
  if (!post) return { ...club, post: null };
  return {
    ...club,
    post: {
      id: post.id,
      text: post.text,
      created_at: post.created_at,
      url: `${club.url}/status/${post.id}`,
      metrics: post.public_metrics || {},
    },
  };
}

async function fetchXUsers(token, request, context) {
  const cacheUrl = new URL("/api/social/x-users-v1", request.url);
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const cache = edgeCache();
  const cached = await readEdgeCache(cache, cacheKey);
  if (cached) return cached.json();

  const usernames = X_CLUBS.map((club) => club.handle).join(",");
  const lookup = await xRequest(`/2/users/by?usernames=${encodeURIComponent(usernames)}`, token);
  const response = jsonResponse(lookup, 200, { "Cache-Control": X_USER_CACHE });
  writeEdgeCache(cache, cacheKey, response, context);
  return lookup;
}

async function fetchXClubFeed(token, request, context) {
  const lookup = await fetchXUsers(token, request, context);
  const users = new Map((lookup.data || []).map((user) => [String(user.username).toLowerCase(), user]));

  const clubs = await Promise.all(X_CLUBS.map(async (club) => {
    const user = users.get(club.handle.toLowerCase());
    if (!user) return { ...club, post: null };
    const params = new URLSearchParams({
      max_results: "5",
      exclude: "replies,retweets",
      "tweet.fields": "created_at,public_metrics",
    });
    const timeline = await xRequest(`/2/users/${encodeURIComponent(user.id)}/tweets?${params}`, token);
    return normalizeXPost(club, timeline.data?.[0] || null);
  }));

  return {
    source: "x-api",
    cost_profile: "text-only-3usd",
    updated_at: new Date().toISOString(),
    cache_ttl_seconds: 86400,
    clubs,
  };
}

async function handleXClubFeed(request, env, context) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  if (!env.X_BEARER_TOKEN) return jsonResponse({ error: "x_not_configured" }, 503, { "Cache-Control": "no-store" });

  const cacheUrl = new URL(request.url);
  cacheUrl.search = "";
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const staleUrl = new URL("/api/social/x-stale-v1", request.url);
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

function handleHealth(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET, HEAD" });
  }
  const payload = {
    status: "ok",
    service: "xyzskor-web",
    timestamp: new Date().toISOString(),
    checks: { static_delivery: "ok", x_feed: env.X_BEARER_TOKEN ? "configured" : "not_configured", youtube_media: env.YOUTUBE_API_KEY ? "configured" : "not_configured" },
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
    if (url.pathname === "/api/social/x") return handleXClubFeed(request, env, context);
    if (url.pathname === "/api/media/youtube") return handleYouTubeMedia(request, env, context);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    let response = await fetchAsset(request, env, pathname);

    if (response.status === 404 && !pathname.split("/").pop()?.includes(".")) {
      response = await fetchAsset(request, env, "/index.html");
    }

    return withHeaders(response, pathname);
  },
};
