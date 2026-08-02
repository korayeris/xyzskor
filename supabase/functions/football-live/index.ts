import { createClient } from "npm:@supabase/supabase-js@2";

type Team = {
  id: string;
  name: string;
  logo: string | null;
  score: number | null;
};

type NormalizedMatch = {
  id: string;
  competition: string;
  competitionLogo: string | null;
  country: string | null;
  startedAt: string | null;
  status: "scheduled" | "live" | "halftime" | "finished";
  minute: number | null;
  home: Team;
  away: Team;
};

type ProviderResult = {
  matches: NormalizedMatch[];
  updatedAt: string;
};

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

function allowedOrigin(request: Request): string {
  const origin = request.headers.get("origin") || "";
  const configured = (Deno.env.get("LIVE_ALLOWED_ORIGINS") || "http://127.0.0.1:4173,http://localhost:4173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configured.includes(origin) ? origin : configured[0] || "http://127.0.0.1:4173";
}

function corsHeaders(request: Request) {
  return {
    "Access-Control-Allow-Origin": allowedOrigin(request),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-refresh-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function response(request: Request, body: unknown, status = 200, cacheControl = "no-store") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...corsHeaders(request), "Cache-Control": cacheControl },
  });
}

function requireSecret(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} yapılandırılmamış.`);
  return value;
}

function normalizedStatus(shortCode: string, elapsed: unknown): NormalizedMatch["status"] {
  const code = String(shortCode || "").toUpperCase();
  if (["HT", "BT"].includes(code)) return "halftime";
  if (["1H", "2H", "ET", "P", "INT", "LIVE"].includes(code) || Number(elapsed) > 0) return "live";
  if (["FT", "AET", "PEN"].includes(code)) return "finished";
  return "scheduled";
}

async function apiFootballAdapter(): Promise<ProviderResult> {
  const apiKey = requireSecret("API_FOOTBALL_KEY");
  const upstream = await fetch("https://v3.football.api-sports.io/fixtures?live=all", {
    headers: { "x-apisports-key": apiKey, "Accept": "application/json" },
  });
  const payload = await upstream.json();
  if (!upstream.ok) throw new Error(`API-Football ${upstream.status}: ${payload?.message || "istek başarısız"}`);

  const rows = Array.isArray(payload?.response) ? payload.response : [];
  const matches = rows
    .filter((row: any) => {
      const country = String(row?.league?.country || "").toLocaleLowerCase("tr-TR");
      const league = String(row?.league?.name || "").toLocaleLowerCase("tr-TR");
      return country === "turkey" && (league.includes("süper lig") || league.includes("super lig"));
    })
    .map((row: any): NormalizedMatch => ({
      id: `api-football:${row.fixture.id}`,
      competition: String(row.league?.name || "Süper Lig"),
      competitionLogo: row.league?.logo || null,
      country: row.league?.country || "Turkey",
      startedAt: row.fixture?.date || null,
      status: normalizedStatus(row.fixture?.status?.short, row.fixture?.status?.elapsed),
      minute: Number.isFinite(Number(row.fixture?.status?.elapsed)) ? Number(row.fixture.status.elapsed) : null,
      home: {
        id: String(row.teams?.home?.id ?? ""),
        name: String(row.teams?.home?.name || "Ev sahibi"),
        logo: row.teams?.home?.logo || null,
        score: Number.isFinite(Number(row.goals?.home)) ? Number(row.goals.home) : null,
      },
      away: {
        id: String(row.teams?.away?.id ?? ""),
        name: String(row.teams?.away?.name || "Deplasman"),
        logo: row.teams?.away?.logo || null,
        score: Number.isFinite(Number(row.goals?.away)) ? Number(row.goals.away) : null,
      },
    }));

  return { matches, updatedAt: new Date().toISOString() };
}

function sportmonksCurrentScore(scores: any[], participantId: unknown): number | null {
  const candidates = (Array.isArray(scores) ? scores : []).filter((score) => String(score?.participant_id) === String(participantId));
  const current = candidates.find((score) => String(score?.description || "").toUpperCase() === "CURRENT") || candidates.at(-1);
  const goals = current?.score?.goals;
  return Number.isFinite(Number(goals)) ? Number(goals) : null;
}

async function sportmonksAdapter(): Promise<ProviderResult> {
  const token = requireSecret("SPORTMONKS_API_TOKEN");
  const leagueIds = (Deno.env.get("SPORTMONKS_LEAGUE_IDS") || "").split(",").map((id) => id.trim()).filter(Boolean);
  if (!leagueIds.length) throw new Error("SPORTMONKS_LEAGUE_IDS yapılandırılmamış.");
  const url = new URL("https://api.sportmonks.com/v3/football/livescores/inplay");
  url.searchParams.set("api_token", token);
  url.searchParams.set("include", "participants;scores;league;state");
  const upstream = await fetch(url);
  const payload = await upstream.json();
  if (!upstream.ok) throw new Error(`Sportmonks ${upstream.status}: ${payload?.message || "istek başarısız"}`);

  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const matches = rows
    .filter((fixture: any) => leagueIds.includes(String(fixture?.league_id)))
    .map((fixture: any): NormalizedMatch => {
      const participants = Array.isArray(fixture?.participants) ? fixture.participants : [];
      const home = participants.find((team: any) => team?.meta?.location === "home") || participants[0] || {};
      const away = participants.find((team: any) => team?.meta?.location === "away") || participants[1] || {};
      const stateCode = String(fixture?.state?.short_name || fixture?.state?.state || "LIVE").toUpperCase();
      return {
        id: `sportmonks:${fixture.id}`,
        competition: String(fixture?.league?.name || "Süper Lig"),
        competitionLogo: fixture?.league?.image_path || null,
        country: "Turkey",
        startedAt: fixture?.starting_at || null,
        status: normalizedStatus(stateCode, fixture?.state?.minute),
        minute: Number.isFinite(Number(fixture?.state?.minute)) ? Number(fixture.state.minute) : null,
        home: { id:String(home.id ?? ""), name:String(home.name || "Ev sahibi"), logo:home.image_path || null, score:sportmonksCurrentScore(fixture?.scores, home.id) },
        away: { id:String(away.id ?? ""), name:String(away.name || "Deplasman"), logo:away.image_path || null, score:sportmonksCurrentScore(fixture?.scores, away.id) },
      };
    });
  return { matches, updatedAt:new Date().toISOString() };
}

function serviceRoleKey(): string | null {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    return Object.values(keys).find((value) => typeof value === "string") as string || null;
  } catch (_) { return null; }
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL")?.trim();
  const key = serviceRoleKey();
  return url && key ? createClient(url, key, { auth:{ persistSession:false } }) : null;
}

async function readCache(scope: string) {
  const admin = adminClient();
  if (!admin) return null;
  const { data, error } = await admin.from("live_feed_cache").select("payload,fetched_at,expires_at").eq("scope", scope).maybeSingle();
  if (error) return null;
  return data;
}

async function writeCache(scope: string, provider: string, result: ProviderResult, ttlSeconds: number) {
  const admin = adminClient();
  if (!admin) return;
  const fetchedAt = new Date();
  await admin.from("live_feed_cache").upsert({
    scope,
    provider,
    payload:result,
    fetched_at:fetchedAt.toISOString(),
    expires_at:new Date(fetchedAt.getTime() + ttlSeconds * 1000).toISOString(),
  });
}

function envSeconds(name: string, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(Deno.env.get(name));
  return Math.max(minimum, Math.min(maximum, Number.isFinite(parsed) ? parsed : fallback));
}

function ttlForResult(result: ProviderResult): number {
  const matches = Array.isArray(result?.matches) ? result.matches : [];
  if (matches.some((match) => match.status === "live" || match.status === "halftime")) {
    // Sportmonks livescore verisi canlı maç sırasında sık güncellenir. Sekiz
    // saniyelik TTL, güncellemeyi geciktirmeden sağlayıcı kotasını merkezi
    // Supabase önbelleğiyle korur.
    return envSeconds("LIVE_CACHE_LIVE_SECONDS", 8, 5, 60);
  }
  const now = Date.now();
  const hasNearKickoff = matches.some((match) => {
    if (match.status !== "scheduled" || !match.startedAt) return false;
    const kickoff = new Date(match.startedAt).getTime();
    return kickoff >= now && kickoff - now <= 2 * 60 * 60 * 1000;
  });
  if (hasNearKickoff) return envSeconds("LIVE_CACHE_PREMATCH_SECONDS", 120, 30, 900);
  const legacyIdle = Number(Deno.env.get("LIVE_CACHE_SECONDS"));
  // Boş akışı uzun süre cache'lemek maç başlangıcını kaçırabilir. En geç bir
  // dakika içinde in-play penceresini yeniden kontrol et.
  return envSeconds("LIVE_CACHE_IDLE_SECONDS", Number.isFinite(legacyIdle) ? legacyIdle : 60, 30, 300);
}

function cacheControlFor(ttlSeconds: number): string {
  const browserSeconds = Math.max(5, Math.min(30, Math.floor(ttlSeconds / 2)));
  return `public, max-age=${browserSeconds}, stale-while-revalidate=${Math.max(30, browserSeconds * 2)}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers:corsHeaders(request) });
  if (request.method !== "POST") return response(request, { error:"Yalnızca POST desteklenir." }, 405);

  const origin = request.headers.get("origin") || "";
  if (origin && allowedOrigin(request) !== origin) return response(request, { error:"İzin verilmeyen kaynak." }, 403);

  let body: any = {};
  try { body = await request.json(); } catch (_) { body = {}; }
  const scope = body?.scope === "turkey-super-lig" ? "turkey-super-lig" : "turkey-super-lig";
  const provider = (Deno.env.get("FOOTBALL_DATA_PROVIDER") || "api-football").trim().toLowerCase();
  const refreshSecret = Deno.env.get("LIVE_REFRESH_SECRET") || "";
  const force = Boolean(refreshSecret) && request.headers.get("x-refresh-key") === refreshSecret;
  const cached = await readCache(scope);

  if (!force && cached?.payload) {
    const cachedTtl = ttlForResult(cached.payload as ProviderResult);
    const stateAwareExpiry = new Date(cached.fetched_at).getTime() + cachedTtl * 1000;
    const storedExpiry = new Date(cached.expires_at).getTime();
    if (Math.min(stateAwareExpiry, storedExpiry) > Date.now()) {
      return response(request, { ...cached.payload, stale:false }, 200, cacheControlFor(cachedTtl));
    }
  }

  try {
    const result = provider === "sportmonks" ? await sportmonksAdapter() : await apiFootballAdapter();
    const ttlSeconds = ttlForResult(result);
    await writeCache(scope, provider, result, ttlSeconds);
    return response(request, { ...result, stale:false }, 200, cacheControlFor(ttlSeconds));
  } catch (error) {
    console.error("[football-live]", error instanceof Error ? error.message : error);
    if (cached?.payload) return response(request, { ...cached.payload, stale:true }, 200, "no-store");
    return response(request, { error:"Canlı veri geçici olarak kullanılamıyor." }, 503);
  }
});
