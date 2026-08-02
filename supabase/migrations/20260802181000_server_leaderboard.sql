begin;

create or replace function public.get_leaderboard(
  p_week integer,
  p_team text default null,
  p_period text default 'week',
  p_limit integer default 100
)
returns table (
  user_id uuid,
  username text,
  team text,
  points bigint,
  exact_scores bigint,
  correct_results bigint,
  completed_at timestamptz,
  position bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with eligible_matches as (
    select id, hafta
    from public.matches
    where coalesce(status, '') not in ('iptal','ertelendi')
  ),
  week_totals as (
    select hafta, count(*)::bigint as match_count
    from eligible_matches
    group by hafta
  ),
  prediction_activity as (
    select p.user_id, m.hafta,
      count(*)::bigint as prediction_count,
      max(p.submitted_at) as completed_at
    from public.predictions p
    join eligible_matches m on m.id = p.match_id
    group by p.user_id, m.hafta
  ),
  scored as (
    select p.user_id, m.hafta,
      sum(
        case when p.pick = case when r.home > r.away then '1' when r.home < r.away then '2' else 'X' end then 3 else 0 end
        + case when p.score_home = r.home and p.score_away = r.away then 5 else 0 end
        + case
            when p.pick <> case when r.home > r.away then '1' when r.home < r.away then '2' else 'X' end
             and p.score_home is not null and p.score_away is not null
             and p.score_home - p.score_away = r.home - r.away
            then 1 else 0
          end
      )::bigint as score_points,
      count(*) filter (where p.score_home = r.home and p.score_away = r.away)::bigint as exact_scores,
      count(*) filter (
        where p.pick = case when r.home > r.away then '1' when r.home < r.away then '2' else 'X' end
      )::bigint as correct_results
    from public.predictions p
    join eligible_matches m on m.id = p.match_id
    join public.results r on r.match_id = p.match_id
    group by p.user_id, m.hafta
  ),
  weekly as (
    select a.user_id, a.hafta,
      coalesce(s.score_points, 0)
        + case when a.prediction_count = wt.match_count and wt.match_count > 0 then 2 else 0 end as points,
      coalesce(s.exact_scores, 0) as exact_scores,
      coalesce(s.correct_results, 0) as correct_results,
      a.completed_at
    from prediction_activity a
    join week_totals wt on wt.hafta = a.hafta
    left join scored s on s.user_id = a.user_id and s.hafta = a.hafta
  ),
  season as (
    select w.user_id,
      sum(w.points)::bigint as points,
      sum(w.exact_scores)::bigint as exact_scores,
      sum(w.correct_results)::bigint as correct_results,
      max(w.completed_at) as completed_at
    from weekly w
    group by w.user_id
  ),
  chosen as (
    select pr.id as user_id, pr.username, pr.team,
      case when p_period = 'season' then coalesce(se.points, 0) else coalesce(we.points, 0) end::bigint as points,
      case when p_period = 'season' then coalesce(se.exact_scores, 0) else coalesce(we.exact_scores, 0) end::bigint as exact_scores,
      case when p_period = 'season' then coalesce(se.correct_results, 0) else coalesce(we.correct_results, 0) end::bigint as correct_results,
      case when p_period = 'season' then se.completed_at else we.completed_at end as completed_at
    from public.profiles pr
    left join weekly we on we.user_id = pr.id and we.hafta = p_week
    left join season se on se.user_id = pr.id
    where p_team is null or p_team = 'Genel' or pr.team = p_team
  ),
  ranked as (
    select c.*,
      row_number() over (
        order by c.points desc, c.exact_scores desc, c.correct_results desc, c.completed_at asc nulls last, c.username asc
      )::bigint as position
    from chosen c
  )
  select r.user_id, r.username, r.team, r.points, r.exact_scores, r.correct_results, r.completed_at, r.position
  from ranked r
  where r.position <= greatest(1, least(coalesce(p_limit, 100), 500)) or r.user_id = auth.uid()
  order by r.position;
$$;

revoke all on function public.get_leaderboard(integer,text,text,integer) from public;
grant execute on function public.get_leaderboard(integer,text,text,integer) to anon, authenticated;

comment on function public.get_leaderboard(integer,text,text,integer) is
  'Puanlamayı veritabanında hesaplar; en fazla 500 sıralama satırı ve oturum sahibinin kendi satırını döndürür.';

commit;
