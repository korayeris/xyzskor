-- GERİ ALMA: 20260819203000_prediction_reward_tiers.sql
-- Türkçe açıklama: aylık ödül katmanı tablosunu, tazeleme fonksiyonunu ve
-- bu migration'ın getirdiği settle sürümünü kaldırır; settle fonksiyonunu
-- 20260819193000 sürümüne (haftalık 6/6 ödül uygunluğu) geri kurar.
-- UYARI: prediction_reward_eligibilities tablosu VERİ KAYBIYLA düşürülür.
-- Önce: \copy (select * from public.prediction_reward_eligibilities) to 'yedek.csv' csv header
begin;

drop function if exists public.refresh_prediction_reward_eligibility(date);
drop table if exists public.prediction_reward_eligibilities;

create or replace function public.settle_prediction_challenge_match(
  p_match_id text, p_home integer, p_away integer
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  target public.matches;
  campaign uuid;
  eligible_count integer := 0;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_home not between 0 and 99 or p_away not between 0 and 99 then raise exception 'invalid_score'; end if;
  select * into target from public.matches where id=p_match_id for update;
  if target.id is null or target.challenge_week is null then raise exception 'challenge_match_not_found'; end if;
  insert into public.results(match_id,home,away,scored_at) values (p_match_id,p_home,p_away,now())
  on conflict (match_id) do update set home=excluded.home, away=excluded.away, scored_at=now();
  update public.matches set status='bitti', updated_at=now() where id=p_match_id;
  if (select count(*) from public.matches m join public.results r on r.match_id=m.id where m.challenge_week=target.challenge_week) = 6 then
    select id into campaign from public.reward_campaigns where code='weekly-six-perfect' and status='active';
    if campaign is not null then
      insert into public.reward_claims(campaign_id,user_id,source_type,source_id,status,pii_expires_at)
      select campaign, p.user_id, 'prediction_week', target.challenge_week::text, 'pending', now()+interval '90 days'
      from public.predictions p
      join public.matches m on m.id=p.match_id
      join public.results r on r.match_id=m.id
      where m.challenge_week=target.challenge_week
      group by p.user_id
      having count(*)=6 and count(*) filter (
        where p.pick = case when r.home>r.away then '1' when r.home<r.away then '2' else 'X' end
      )=6
      on conflict (campaign_id,user_id,source_type,source_id) do nothing;
      get diagnostics eligible_count = row_count;
    end if;
  end if;
  return jsonb_build_object('settled',true,'new_reward_claims',eligible_count);
end $$;
revoke all on function public.settle_prediction_challenge_match(text,integer,integer) from public, anon, authenticated;
grant execute on function public.settle_prediction_challenge_match(text,integer,integer) to service_role;

commit;
