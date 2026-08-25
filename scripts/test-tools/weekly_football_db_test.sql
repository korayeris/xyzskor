\set ON_ERROR_STOP on

truncate table public.football_weekly_player_scores, public.football_weekly_awards restart identity;

insert into public.football_weekly_awards
  (league_id, season_id, round_id, algorithm_version, status, star_player_id, payload)
values
  ('600', '28203', '9', 'v1', 'published', '101', '{"test":true}'),
  ('600', '28203', '10', 'v1', 'provisional', '102', '{"test":true}');

do $$
declare
  policy_count integer;
begin
  if has_table_privilege('anon', 'public.football_weekly_awards', 'INSERT')
     or has_table_privilege('authenticated', 'public.football_weekly_awards', 'UPDATE')
     or has_table_privilege('authenticated', 'public.football_weekly_player_scores', 'DELETE') then
    raise exception 'weekly tables expose client write privileges';
  end if;

  select count(*) into policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('football_weekly_awards', 'football_weekly_player_scores')
    and cmd = 'SELECT'
    and qual like '%status%published%';
  if policy_count <> 2 then
    raise exception 'expected two published-only SELECT policies, got %', policy_count;
  end if;
end $$;

set role anon;
do $$
declare visible_count integer;
begin
  select count(*) into visible_count from public.football_weekly_awards;
  if visible_count <> 1 then
    raise exception 'anon should see exactly one published weekly award, got %', visible_count;
  end if;
end $$;
reset role;

insert into public.football_weekly_awards
  (league_id, season_id, round_id, algorithm_version, status, star_player_id, payload)
values ('600', '28203', '9', 'v1', 'published', '101', '{"rerun":true}')
on conflict (league_id, season_id, round_id, algorithm_version)
do update set payload = excluded.payload;

do $$
begin
  if (select count(*) from public.football_weekly_awards where league_id='600' and season_id='28203' and round_id='9' and algorithm_version='v1') <> 1 then
    raise exception 'idempotent weekly award upsert created duplicates';
  end if;
end $$;

select 'OK weekly football RLS/idempotency' as result;
