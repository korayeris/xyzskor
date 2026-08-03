const STATIC_CACHE = "public, max-age=31536000, immutable";
const HTML_CACHE = "public, max-age=0, must-revalidate";
const SOCIAL_CACHE = "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400";
const X_USER_CACHE = "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800";
const X_CLUBS = [
  { team: "Galatasaray", handle: "GalatasaraySK", url: "https://x.com/GalatasaraySK" },
  { team: "Fenerbahçe", handle: "Fenerbahce", url: "https://x.com/Fenerbahce" },
  { team: "Beşiktaş", handle: "Besiktas", url: "https://x.com/Besiktas" },
  { team: "Trabzonspor", handle: "Trabzonspor", url: "https://x.com/Trabzonspor" },
];

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

async function xRequest(pathname, token) {
  const response = await fetch(`https://api.x.com${pathname}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!response.ok) {
    const error = new Error(`X API ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
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
  const cache = edgeCache();
  const cached = await readEdgeCache(cache, cacheKey);
  if (cached) return cached;

  try {
    const response = jsonResponse(await fetchXClubFeed(env.X_BEARER_TOKEN, request, context), 200, { "Cache-Control": SOCIAL_CACHE });
    writeEdgeCache(cache, cacheKey, response, context);
    return response;
  } catch (error) {
    if (error?.status === 402) {
      return jsonResponse({ error: "x_credits_depleted" }, 402, { "Cache-Control": "no-store" });
    }
    return jsonResponse({ error: "x_upstream_unavailable" }, 502, { "Cache-Control": "no-store", "Retry-After": "300" });
  }
}

function withHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
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
    if (url.pathname === "/api/social/x") return handleXClubFeed(request, env, context);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    let response = await fetchAsset(request, env, pathname);

    if (response.status === 404 && !pathname.split("/").pop()?.includes(".")) {
      response = await fetchAsset(request, env, "/index.html");
    }

    return withHeaders(response, pathname);
  },
};
