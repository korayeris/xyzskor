begin;
create table if not exists public.prediction_reward_eligibilities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  period_month date not null, tier text not null check (tier in ('bronze','silver','gold','diamond','champion')),
  points integer not null default 0, correct_results integer not null default 0, exact_scores integer not null default 0,
  status text not null default 'eligible' check (status in ('eligible','drawn','not_selected','expired')),
  created_at timestamptz not null default now(), unique(user_id,period_month,tier)
);
alter table public.prediction_reward_eligibilities enable row level security;
create policy prediction_reward_eligibilities_own_read on public.prediction_reward_eligibilities for select to authenticated using (user_id=auth.uid());
grant select on public.prediction_reward_eligibilities to authenticated;

create or replace function public.refresh_prediction_reward_eligibility(p_month date)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare affected integer:=0;
begin
  if current_setting('request.jwt.claim.role',true)<>'service_role' then raise exception 'service_role_required'; end if;
  with scored as (
    select p.user_id,
      sum(case when p.pick=case when r.home>r.away then '1' when r.home<r.away then '2' else 'X' end then 3 else 0 end
        +case when p.score_home=r.home and p.score_away=r.away then 5 else 0 end)::integer points,
      count(*) filter(where p.pick=case when r.home>r.away then '1' when r.home<r.away then '2' else 'X' end)::integer correct_results,
      count(*) filter(where p.score_home=r.home and p.score_away=r.away)::integer exact_scores
    from public.predictions p join public.matches m on m.id=p.match_id join public.results r on r.match_id=m.id
    where date_trunc('month',m.kickoff)::date=date_trunc('month',p_month)::date group by p.user_id
  ), tiered as (
    select *,case when points>=65 then 'champion' when points>=50 then 'diamond' when points>=35 then 'gold' when points>=20 then 'silver' when points>=10 then 'bronze' end tier from scored
  )
  insert into public.prediction_reward_eligibilities(user_id,period_month,tier,points,correct_results,exact_scores)
  select user_id,date_trunc('month',p_month)::date,tier,points,correct_results,exact_scores from tiered where tier is not null
  on conflict(user_id,period_month,tier) do update set points=excluded.points,correct_results=excluded.correct_results,exact_scores=excluded.exact_scores;
  get diagnostics affected=row_count; return affected;
end $$;
revoke all on function public.refresh_prediction_reward_eligibility(date) from public,anon,authenticated;
grant execute on function public.refresh_prediction_reward_eligibility(date) to service_role;

create or replace function public.settle_prediction_challenge_match(p_match_id text,p_home integer,p_away integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare target public.matches; refreshed integer:=0;
begin
  if current_setting('request.jwt.claim.role',true)<>'service_role' then raise exception 'service_role_required'; end if;
  if p_home not between 0 and 99 or p_away not between 0 and 99 then raise exception 'invalid_score'; end if;
  select * into target from public.matches where id=p_match_id for update;
  if target.id is null then raise exception 'match_not_found'; end if;
  insert into public.results(match_id,home,away,scored_at) values(p_match_id,p_home,p_away,now())
  on conflict(match_id) do update set home=excluded.home,away=excluded.away,scored_at=now();
  update public.matches set status='bitti',updated_at=now() where id=p_match_id;
  refreshed:=public.refresh_prediction_reward_eligibility(date_trunc('month',target.kickoff)::date);
  return jsonb_build_object('settled',true,'eligibilities_refreshed',refreshed);
end $$;
revoke all on function public.settle_prediction_challenge_match(text,integer,integer) from public,anon,authenticated;
grant execute on function public.settle_prediction_challenge_match(text,integer,integer) to service_role;
commit;
