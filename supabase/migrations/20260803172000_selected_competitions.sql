alter table public.matches
  add column if not exists competition text,
  add column if not exists competition_logo text,
  add column if not exists country text,
  add column if not exists provider_league_id text,
  add column if not exists provider_season_id text;

create index if not exists matches_competition_kickoff_idx
  on public.matches (competition, kickoff);

create index if not exists matches_provider_league_kickoff_idx
  on public.matches (provider_league_id, kickoff);
