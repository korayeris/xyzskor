-- Canlı skor mimarisi: kalıcı snapshot, event, senkron kilidi ve gözlemlenebilirlik.
-- Bkz. docs/LIVE-SCORE-HANDOFF-2026-08-22.md #1.
--
-- Bu migration idempotenttir (create table/index if not exists, on conflict do
-- nothing) ve supabase/migrations/rollback/20260822200000_live_match_infrastructure_down.sql
-- ile tamamen geri alınabilir.

begin;

-- 1) provider_fixtures: sağlayıcı fixture kimliğinin canonical lig/branş
--    eşlemesi. Worker her fixture normalize ettiğinde bu tabloyu upsert eder;
--    lig/branş izolasyonu doğrulaması için tek doğruluk kaynağıdır.
create table if not exists public.provider_fixtures (
  provider text not null,
  provider_fixture_id text not null,
  sport text not null default 'football',
  league_key text not null,
  provider_league_id text,
  season_id text,
  kickoff_utc timestamptz,
  home_provider_id text,
  away_provider_id text,
  canonical_state text,
  updated_at timestamptz not null default now(),
  primary key (provider, provider_fixture_id)
);
create index if not exists provider_fixtures_league_key_idx on public.provider_fixtures(league_key);

-- 2) live_match_snapshots: her fixture için son doğrulanmış canlı durum.
--    Edge cache kaybolsa bile bu tablo kalıcı "son doğrulanmış skor" kaynağıdır.
create table if not exists public.live_match_snapshots (
  fixture_id text primary key,
  provider text not null default 'sportmonks',
  sport text not null default 'football',
  league_key text not null,
  sequence bigint not null default 1,
  status text not null,
  minute integer,
  added_time integer,
  home_score integer,
  away_score integer,
  payload jsonb not null,
  provider_updated_at timestamptz,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '5 minutes',
  checksum text
);
create index if not exists live_match_snapshots_league_key_idx on public.live_match_snapshots(league_key);
create index if not exists live_match_snapshots_status_idx on public.live_match_snapshots(status);

-- 3) live_match_events: gol/kart/değişiklik gibi ayrık olaylar.
--    provider_event_id ile unique -> event dedup garantisi.
create table if not exists public.live_match_events (
  id bigserial primary key,
  fixture_id text not null,
  provider_event_id text not null,
  league_key text not null,
  team_provider_id text,
  player_provider_id text,
  type text not null,
  minute integer,
  extra_minute integer,
  payload jsonb,
  provider_timestamp timestamptz,
  created_at timestamptz not null default now(),
  unique (fixture_id, provider_event_id)
);
create index if not exists live_match_events_fixture_idx on public.live_match_events(fixture_id);

-- 4) provider_sync_runs: her upstream çağrı denemesinin gözlemlenebilirlik
--    kaydı. Circuit breaker ve rate-limit/latency metrikleri buradan okunur.
create table if not exists public.provider_sync_runs (
  id bigserial primary key,
  endpoint_class text not null,
  scope_key text,
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  duration_ms integer,
  http_status integer,
  outcome text not null,
  request_count integer not null default 1,
  rate_limit_remaining integer,
  rate_limit_reset timestamptz,
  error_code text
);
create index if not exists provider_sync_runs_endpoint_started_idx
  on public.provider_sync_runs(endpoint_class, started_at desc);

-- 5) sync_locks: aynı lig/fixture için paralel upstream çağrıyı engelleyen
--    kısa süreli lease (single-flight). Worker isolate'leri paylaşılan
--    hafızaya sahip olmadığından bu tablo tekilleştirmenin tek güvenilir
--    kaynağıdır (bkz. handoff #2 -- "mevcut platforma en uygun tekilleştirme
--    yöntemi": OpenAI Sites'ın Cache API/Durable Object garantisi
--    doğrulanamadığından Supabase tabanlı kilit seçildi).
create table if not exists public.sync_locks (
  lock_key text primary key,
  holder text not null,
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.provider_fixtures enable row level security;
alter table public.live_match_snapshots enable row level security;
alter table public.live_match_events enable row level security;
alter table public.provider_sync_runs enable row level security;
alter table public.sync_locks enable row level security;

-- Canlı skor/event verisi public tüketim içindir (istemci ileride Realtime
-- ile doğrudan okuyabilir); operasyonel tablolar (fixtures/sync_runs/locks)
-- yalnızca service role/Worker tarafından görülür.
drop policy if exists live_match_snapshots_public_read on public.live_match_snapshots;
create policy live_match_snapshots_public_read on public.live_match_snapshots
  for select to anon, authenticated using (true);

drop policy if exists live_match_events_public_read on public.live_match_events;
create policy live_match_events_public_read on public.live_match_events
  for select to anon, authenticated using (true);

revoke all on table public.provider_fixtures from anon, authenticated;
revoke all on table public.provider_sync_runs from anon, authenticated;
revoke all on table public.sync_locks from anon, authenticated;
revoke insert, update, delete on table public.live_match_snapshots from anon, authenticated;
revoke insert, update, delete on table public.live_match_events from anon, authenticated;

comment on table public.provider_fixtures is
  'Sağlayıcı fixture kimliğinin canonical lig/branş eşlemesi; lig izolasyonu doğrulamasının tek kaynağı.';
comment on table public.live_match_snapshots is
  'Her fixture için son doğrulanmış canlı durum. Edge cache kaybında kalıcı fallback kaynağıdır.';
comment on table public.live_match_events is
  'Sağlayıcı event ID ile tekilleştirilmiş gol/kart/değişiklik olayları.';
comment on table public.provider_sync_runs is
  'Upstream çağrı denemelerinin gözlemlenebilirlik kaydı (circuit breaker ve metrikler için).';
comment on table public.sync_locks is
  'Aynı kapsam (lig/fixture) için paralel upstream çağrıyı engelleyen kısa süreli lease.';

-- 6) try_acquire_sync_lock: atomik "tek kişi upstream'e gitsin" kilidi.
--    Süresi dolmuş kilit varsa devralınır; aksi halde false döner (o anda
--    başka bir istek upstream'e gitmektedir, çağıran kalıcı snapshot sunmalı).
create or replace function public.try_acquire_sync_lock(p_key text, p_holder text, p_ttl_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  acquired boolean := false;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  loop
    begin
      insert into public.sync_locks(lock_key, holder, acquired_at, expires_at)
      values (p_key, p_holder, now(), now() + make_interval(secs => greatest(1, p_ttl_seconds)));
      acquired := true;
      exit;
    exception when unique_violation then
      update public.sync_locks
        set holder = p_holder, acquired_at = now(), expires_at = now() + make_interval(secs => greatest(1, p_ttl_seconds))
        where lock_key = p_key and expires_at < now();
      if found then
        acquired := true;
      end if;
      exit;
    end;
  end loop;
  return acquired;
end;
$$;

revoke all on function public.try_acquire_sync_lock(text, text, integer) from public, anon, authenticated;
grant execute on function public.try_acquire_sync_lock(text, text, integer) to service_role;

comment on function public.try_acquire_sync_lock(text, text, integer) is
  'Single-flight kilidi: süresi dolmamış kilit varsa false, aksi halde kilidi devralıp true döner.';

commit;

-- GERİ ALMA PLANI: supabase/migrations/rollback/20260822200000_live_match_infrastructure_down.sql
