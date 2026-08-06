create table if not exists public.live_feed_cache (
  scope text primary key,
  provider text not null,
  payload jsonb not null default '{"matches":[]}'::jsonb,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null default now()
);

alter table public.live_feed_cache enable row level security;

comment on table public.live_feed_cache is
  'Sunucu tarafındaki futbol veri adaptörünün kısa ömürlü önbelleği. İstemciden doğrudan okunmaz.';

revoke all on table public.live_feed_cache from anon, authenticated;

