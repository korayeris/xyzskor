# XYZSKOR Professional Handoff

Last updated: 2026-08-03
Audience: incoming senior/full-stack engineer, technical lead, product owner
Status: current-state handoff based on repository-verifiable evidence

## 1. Executive summary

XYZSKOR is currently a vanilla web application with a hybrid delivery model:

- Frontend: static HTML, CSS and modular browser JavaScript
- Primary database/auth: Supabase
- Public site hosting and edge delivery: Sites project plus Cloudflare-style Worker entrypoint
- Sports data normalization: two server-side layers exist
  - Supabase Edge Function: `football-live`
  - Worker API routes: `/api/football/*`, `/api/social/*`, `/api/media/youtube`

The product direction is clear, but the implementation is still transitional:

- real provider-backed routes exist for live football, season bundles, club profiles, transfers and official X feeds
- several frontend sections are still populated by embedded static datasets or premium-looking placeholders
- documentation partially reflects an older "Edge Function first" architecture and should now be read as historical context, not the full current truth

This document is intended to let a professional engineer take over without reconstructing the system from chat history.

## 2. Confirmed system inventory

The following items are confirmed directly from repository state.

### 2.1 Hosting and deployment

- Sites hosting project id: `appgprj_6a6cb5dd1124819199c961895189c684`
- Hosting config file: `.openai/hosting.json`
- Worker entrypoint: `worker/index.js`
- Static production bundle output: `dist/`

### 2.2 Backend and database

- Supabase project id: `swhwmqbamzczztpfxctg`
- Supabase URL exposed to browser as publishable client endpoint:
  - `https://swhwmqbamzczztpfxctg.supabase.co`
- Supabase browser client bootstrap:
  - `assets/js/data.js`
- Supabase Edge Function:
  - `supabase/functions/football-live/index.ts`
- SQL migrations:
  - `supabase/migrations/*.sql`

### 2.3 External providers supported in code

- Sportmonks
  - token env names: `SPORTMONKS_API_TOKEN` or `SPORTMONKS_TOKEN`
  - selectable league ids in repo: `600,2,5,564,8`
- X API
  - token env name: `X_BEARER_TOKEN`
- YouTube Data API
  - key env name: `YOUTUBE_API_KEY`
- API-Football
  - env name still supported in Supabase Edge Function: `API_FOOTBALL_KEY`
  - architecture docs still mention it as an older or fallback onboarding path

## 3. Commercial and purchased assets register

This section is split deliberately between repo-confirmed and owner-confirmed items.

### 3.1 Repo-confirmed commercial dependencies

- Supabase project exists and is actively wired into the app
- Sites hosting project exists and is wired into deployment config
- Codebase is prepared for Sportmonks production usage
- Codebase is prepared for X API usage
- Codebase is prepared for YouTube API usage

### 3.2 Requires owner/manual confirmation outside repo

These cannot be proven from source code alone and should be filled by the business owner before handoff:

| Item | Current repo evidence | Manual owner action |
|---|---|---|
| Sportmonks subscription tier | token variable names and selected league ids exist | record exact plan name, billing cycle, renewal date, account email |
| X developer billing / credits | `X_BEARER_TOKEN` integration exists, budget warning noted in README | record app id, billing model, monthly spend cap, owner account |
| YouTube API billing project | API key supported in code | record Google Cloud project id, quota alerts, owner account |
| Supabase billing tier | project exists, no billing tier encoded in repo | record free/pro plan, payment owner, backup policy |
| Domain purchase | no custom domain configuration in repo | record registrar, DNS owner, renewal date if a domain is bought later |

Recommended non-code artifact for the owner:

- keep a separate `ops-secrets-ledger` outside Git with:
  - provider name
  - owner email
  - renewal date
  - payment card owner
  - console URL
  - recovery codes location

## 4. Current architecture

## 4.1 Frontend runtime

Primary files:

- `index.html`
- `assets/css/app.css`
- `assets/js/data.js`
- `assets/js/live.js`
- `assets/js/ui.js`
- `assets/js/match-center.js`

Observed frontend model:

- no framework
- global state in browser memory
- hash-based navigation
- render pipeline is imperative, not component-driven
- league theme switching is handled in UI logic and CSS class application

Implication for takeover:

- onboarding is fast for a DOM-heavy engineer
- long-term maintainability will degrade if feature count continues to grow without modular state boundaries

## 4.2 Server-side topology

There are two active server-side integration surfaces:

1. Supabase Edge Function `football-live`
2. Worker API adapter in `worker/index.js`

Current request patterns in code:

- `sb.functions.invoke('football-live', ...)`
- `fetch('/api/football/live?...')`
- `fetch('/api/football/club?...')`
- `fetch('/api/football/transfers?...')`
- `fetch('/api/social/x-media-v2?...')`
- `fetch('/api/media/youtube')`

Professional interpretation:

- the app has evolved from a single-provider edge-function design into a mixed server model
- this is workable, but ownership boundaries are currently blurred
- a future engineer should decide whether canonical provider orchestration lives in:
  - Supabase Edge Functions, or
  - Worker routes, or
  - a dedicated backend service

Without that decision, drift will continue.

## 4.3 Data flow by domain

### Live matches

- frontend attempts Supabase `football-live`
- then falls back to Worker `/api/football/live`
- provider target is Sportmonks when configured

### Season bundle

- frontend can request season data from Supabase function
- Worker also exposes `/api/football/season`
- standings and schedules can be normalized from provider payloads

### Club profile

- Worker route `/api/football/club`
- club squad, coach, venue and related profile data normalize from Sportmonks

### Transfers

- Worker route `/api/football/transfers`
- intended to normalize confirmed and rumour records per selected league
- frontend still contains static transfer fallback content in `assets/js/data.js`

### Social feed

- Worker route `/api/social/x-media-v2`
- official club/publisher handles configured per league
- media expansions supported
- fallback UI states still visible when feed is empty or not configured

### Video/media panel

- Worker route `/api/media/youtube`
- prepared but dependent on `YOUTUBE_API_KEY`

## 5. Verified live vs static split

This is the most important section for takeover.

## 5.1 Real provider-backed or potentially real provider-backed

- Worker health endpoint: `/api/health`
- X feed proxy and caching
- YouTube media proxy and caching
- Worker football endpoints:
  - `/api/football/live`
  - `/api/football/season`
  - `/api/football/club`
  - `/api/football/transfers`
- Supabase Edge Function season and live sync logic

## 5.2 Static or embedded content still present in frontend

Embedded directly in `assets/js/data.js`:

- publishable Supabase browser config
- fallback league club lists
- hardcoded `HISTORIC_STANDINGS_2024_25`
- hardcoded `SUPER_LIG_CLUBS_2026_27`
- hardcoded `TRANSFER_CENTER_DATA`
- hardcoded coach and market-value intelligence blocks for Super Lig clubs

Operational consequence:

- the product can look full even when provider data is missing
- that is good for design iteration
- it is dangerous for production credibility unless each static block is intentionally labeled as editorial/reference/fallback

## 5.3 Placeholder or premium-empty states still visible

Visible wording patterns still in code:

- "hazirlaniyor"
- "bekleniyor"
- "yayinlandiginda dolacak"
- "baglanti kontrol ediliyor"
- "resmi hesap dogrulaniyor"

This means the product still exposes internal completion status to end users instead of using production-grade empty states.

## 6. Secrets and environment contract

Confirmed env variable contract from repo:

### Worker-side

- `X_BEARER_TOKEN`
- `YOUTUBE_API_KEY`
- `SPORTMONKS_API_TOKEN`
- `SPORTMONKS_TOKEN`

### Supabase Edge Function side

- `FOOTBALL_DATA_PROVIDER`
- `API_FOOTBALL_KEY`
- `SPORTMONKS_API_TOKEN`
- `SPORTMONKS_LEAGUE_IDS`
- `LIVE_CACHE_LIVE_SECONDS`
- `LIVE_CACHE_PREMATCH_SECONDS`
- `LIVE_CACHE_IDLE_SECONDS`
- `SEASON_CACHE_SECONDS`
- `LIVE_ALLOWED_ORIGINS`
- optional force-refresh secret

Rules that should remain non-negotiable:

- no service-role key in browser
- no provider secret in Git
- no provider secret in `.openai/hosting.json`
- no provider secret in static asset bundle

## 7. Recommended canonical ownership model

For a professional team handoff, the system should be divided like this:

### Product surface

- Frontend shell
- theme system
- rendering and navigation
- account UX
- predict UX

### Data platform

- league selection contract
- provider normalization
- live match sync
- season sync
- transfer sync
- social/media ingestion

### Platform operations

- hosting and deploy
- secrets and billing ownership
- observability
- incident response
- backups
- migration process

### Content operations

- editorial/news sourcing
- trust labeling
- legal footers and compliance text
- sponsor inventory language

If handed to a professional engineer tomorrow, these boundaries should be explicit before new features are added.

## 8. Immediate technical debts

1. Dual backend path debt
The same football domain is partly served from Supabase Edge Function and partly from Worker routes. Choose one canonical orchestration layer.

2. Static/live mixing debt
Static standings, club intelligence and transfer arrays should be separated into one of:
- editorial fallback datasets
- staging demo fixtures
- removable dev seed files

They should not remain mixed into the main runtime state forever.

3. Documentation drift
`docs/data-provider-architecture.md` still frames API-Football as today's integration, while the current Supabase function defaults provider selection to Sportmonks and the Worker layer now exposes direct football routes.

4. Production language debt
User-facing placeholder text should be replaced with:
- real empty states
- last-updated timestamps
- provider-neutral freshness labels
- recovery states for degraded provider conditions

5. Ownership debt
There is no repo-native operations register for:
- who pays for which provider
- which console owns which token
- what the monthly cost ceiling is

That must exist before larger traffic or staff handoff.

## 9. Handoff package a new engineer should receive

Minimum package:

1. This document
2. `docs/XYZSKOR-devir-teslim.md`
3. `docs/data-provider-architecture.md`
4. `docs/supabase-migration-runbook.md`
5. `docs/production-scale-readiness.md`
6. Current environment variable checklist
7. Provider/billing ownership ledger outside Git
8. Read-only access to:
   - Supabase
   - hosting console
   - Sportmonks console
   - X developer console
   - YouTube/Google Cloud console if used

## 10. Professional takeover roadmap

### Phase 1: stabilize truth

- remove or isolate embedded production-looking static football data
- define the single canonical backend path
- document each public route, payload shape and cache behavior
- add an explicit `data_source` field to frontend-consumed payloads where missing

### Phase 2: production hardening

- add structured logs and error tracking
- add provider freshness monitors
- add secret rotation procedure
- add deployment checklist and rollback checklist

### Phase 3: feature completion

- unify all five leagues at the same depth as Super Lig
- finish official social ingestion strategy per league
- finish transfer truth model for confirmed vs rumour vs editorial mention
- finish club pages with consistent provider-backed depth

### Phase 4: handoff-grade cleanup

- reduce global-state coupling in frontend
- formalize API schema docs
- create staging/prod environment matrix
- create admin/editor runbooks

## 11. What is safe to tell the next engineer on day one

- The app builds successfully.
- The app has a valid hosting project reference.
- The app has a valid Supabase project reference.
- The system is not greenfield anymore.
- The system is not yet cleanly normalized around one backend truth.
- The biggest risk is not styling; it is data authority and ownership clarity.

## 12. Final recommendation

Do not present the system to a professional engineer as "finished but messy."
Present it as:

- a strong product prototype with real hosting and real provider integration points
- already capable of evolving into production
- currently in a transition state between editorial demo data and fully normalized live data

That framing is accurate and prevents bad assumptions during takeover.
