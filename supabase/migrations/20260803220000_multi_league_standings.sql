alter table public.league_standings
  add column if not exists competition text,
  add column if not exists competition_logo text,
  add column if not exists country text,
  add column if not exists provider_league_id text,
  add column if not exists provider_season_id text,
  add column if not exists provider_team_id text;

create index if not exists league_standings_competition_points_idx
  on public.league_standings (competition, points desc);

create index if not exists league_standings_provider_lookup_idx
  on public.league_standings (provider_league_id, provider_season_id, points desc);
