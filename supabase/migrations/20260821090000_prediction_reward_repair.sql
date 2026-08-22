-- Türkçe açıklama: 2026-08-19 tarihli iki migration arasındaki regresyonu ve
-- 5.6 (PUBLIC EXECUTE) ihlallerini onarır. Migration geçmişi yeniden yazılmaz;
-- bu ileri tarihli düzeltme migration'ıdır.
--
-- 1) NEDEN: 20260819203000 migration'ı settle_prediction_challenge_match'i
--    yeniden tanımlayarak 20260819193000'de eklenen "haftalık 6 maçın 6'sını
--    bilen üyeye ödül uygunluk kaydı açma" davranışını sessizce SİLDİ.
--    reward_campaigns içindeki 'weekly-six-perfect' kampanyası kaldı ama
--    hiçbir reward_claims satırı üretilemiyordu. Bu sürüm iki davranışı
--    birleştirir: aylık tier tazeleme + haftalık 6/6 ödül uygunluğu.
-- 2) NEDEN: PostgreSQL yeni fonksiyona varsayılan olarak PUBLIC EXECUTE verir;
--    is_admin, is_editorial_admin, is_verified_user, change_team_once ve
--    handle_new_user anon rolü tarafından çağrılabilir durumdaydı.
-- 3) NEDEN: data.js içindeki PREDICT_REWARD_TIERS 'rookie' (Çaylak) katmanını
--    içeriyor ama tablo check kısıtı bu değeri reddediyordu; tek doğruluk
--    kaynağı ilkesi gereği kısıt UI ile hizalanır.

-- 4) NEDEN: refresh_prediction_reward_eligibility her çağrıldığında kullanıcının
--    O ANKİ puanına karşılık gelen tier için satır açıyor ve eski tier satırını
--    silmiyordu. Unique kısıt (user_id, period_month, tier) olduğu için ay
--    içinde Bronz -> Gümüş -> Altın geçen bir üye ÜÇ ayrı uygunluk satırına
--    sahip oluyordu; ödül çekilişi aynı üyeyi üç kez hak sahibi sayabilir.
--    Gerçek PostgreSQL testiyle doğrulandı (bronze=16, silver=32, gold=48).
-- 5) NEDEN: 20260819193000 içindeki kampanya upsert'i `status` alanını
--    güncellemiyordu; kampanya bir kez pasife alındıysa yeniden uygulama onu
--    tekrar aktif etmiyor ve haftalık 6/6 ödülü sessizce hiç açılmıyordu.

begin;

-- 5) Kampanya durumu her zaman aktif hale getirilir.
insert into public.reward_campaigns(code,title,sponsor_name,description,status)
values ('weekly-six-perfect','6 Maç Challenge','XYZSKOR','Haftalık altı maçın sonucunu doğru tahmin eden üyeler için ödül uygunluğu.','active')
on conflict (code) do update set title=excluded.title, description=excluded.description, status='active';

-- 3) Tier sözlüğünü UI ile hizala (Çaylak dahil).
alter table public.prediction_reward_eligibilities
  drop constraint if exists prediction_reward_eligibilities_tier_check;
alter table public.prediction_reward_eligibilities
  add constraint prediction_reward_eligibilities_tier_check
  check (tier in ('rookie','bronze','silver','gold','diamond','champion'));

-- 4) Aylık uygunluk tazeleme: üye başına AY BAŞINA TEK tier satırı bırakır.
create or replace function public.refresh_prediction_reward_eligibility(p_month date)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected integer := 0;
  month_start date := date_trunc('month', p_month)::date;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  drop table if exists tmp_reward_tier;
  create temporary table tmp_reward_tier(
    user_id uuid primary key, tier text, points integer,
    correct_results integer, exact_scores integer
  ) on commit drop;

  insert into tmp_reward_tier(user_id, tier, points, correct_results, exact_scores)
  with scored as (
    select p.user_id,
      sum(case when p.pick = case when r.home>r.away then '1' when r.home<r.away then '2' else 'X' end then 3 else 0 end
        + case when p.score_home=r.home and p.score_away=r.away then 5 else 0 end)::integer as points,
      count(*) filter (where p.pick = case when r.home>r.away then '1' when r.home<r.away then '2' else 'X' end)::integer as correct_results,
      count(*) filter (where p.score_home=r.home and p.score_away=r.away)::integer as exact_scores
    from public.predictions p
    join public.matches m on m.id = p.match_id
    join public.results r on r.match_id = m.id
    where date_trunc('month', m.kickoff)::date = month_start
    group by p.user_id
  )
  select user_id,
    case when points>=65 then 'champion' when points>=50 then 'diamond' when points>=35 then 'gold'
         when points>=20 then 'silver' when points>=10 then 'bronze' else 'rookie' end,
    points, correct_results, exact_scores
  from scored;

  -- Ayni ay icinde artik gecerli olmayan tier satirlarini kaldir (tekil tier garantisi).
  delete from public.prediction_reward_eligibilities e
  using tmp_reward_tier t
  where e.user_id = t.user_id and e.period_month = month_start and e.tier <> t.tier
    and e.status in ('eligible','not_selected');

  insert into public.prediction_reward_eligibilities(user_id,period_month,tier,points,correct_results,exact_scores)
  select user_id, month_start, tier, points, correct_results, exact_scores from tmp_reward_tier
  on conflict (user_id,period_month,tier) do update
    set points=excluded.points, correct_results=excluded.correct_results, exact_scores=excluded.exact_scores;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.refresh_prediction_reward_eligibility(date) from public, anon, authenticated;
grant execute on function public.refresh_prediction_reward_eligibility(date) to service_role;

comment on function public.refresh_prediction_reward_eligibility(date) is
  'Ay bazinda puan/tier hesaplar ve uye basina TEK gecerli tier satiri birakir.';

-- 1) Settlement: sonucu kilitler + aylık tier tazeler + haftalık 6/6 ödülü açar.
create or replace function public.settle_prediction_challenge_match(
  p_match_id text,
  p_home integer,
  p_away integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.matches;
  campaign uuid;
  refreshed integer := 0;
  eligible_count integer := 0;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_home is null or p_away is null or p_home not between 0 and 99 or p_away not between 0 and 99 then
    raise exception 'invalid_score';
  end if;

  select * into target from public.matches where id = p_match_id for update;
  if target.id is null then raise exception 'match_not_found'; end if;

  insert into public.results(match_id, home, away, scored_at)
  values (p_match_id, p_home, p_away, now())
  on conflict (match_id) do update set home = excluded.home, away = excluded.away, scored_at = now();
  update public.matches set status = 'bitti', updated_at = now() where id = p_match_id;

  -- Aylik tier tazeleme (20260819203000 davranisi) - idempotent.
  refreshed := public.refresh_prediction_reward_eligibility(date_trunc('month', target.kickoff)::date);

  -- Haftalik 6/6 odul uygunlugu (20260819193000 davranisi) - idempotent.
  if target.challenge_week is not null
     and (select count(*) from public.matches m
          join public.results r on r.match_id = m.id
          where m.challenge_week = target.challenge_week) = 6 then
    select id into campaign from public.reward_campaigns
      where code = 'weekly-six-perfect' and status = 'active';
    if campaign is not null then
      insert into public.reward_claims(campaign_id, user_id, source_type, source_id, status, pii_expires_at)
      select campaign, p.user_id, 'prediction_week', target.challenge_week::text, 'pending', now() + interval '90 days'
      from public.predictions p
      join public.matches m on m.id = p.match_id
      join public.results r on r.match_id = m.id
      where m.challenge_week = target.challenge_week
      group by p.user_id
      having count(*) = 6 and count(*) filter (
        where p.pick = case when r.home > r.away then '1' when r.home < r.away then '2' else 'X' end
      ) = 6
      on conflict (campaign_id, user_id, source_type, source_id) do nothing;
      get diagnostics eligible_count = row_count;
    end if;
  end if;

  return jsonb_build_object(
    'settled', true,
    'eligibilities_refreshed', refreshed,
    'new_reward_claims', eligible_count
  );
end;
$$;

revoke all on function public.settle_prediction_challenge_match(text,integer,integer) from public, anon, authenticated;
grant execute on function public.settle_prediction_challenge_match(text,integer,integer) to service_role;

comment on function public.settle_prediction_challenge_match(text,integer,integer) is
  'Sonucu kilitler, aylık ödül katmanlarını tazeler ve haftadaki 6 seçimin 6sını bilen üyeler için tekil ödül uygunluk kaydı açar.';

-- 2) 5.6: anon rolünün çağırmaması gereken security-definer fonksiyonlar.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.is_verified_user() from public, anon;
grant execute on function public.is_verified_user() to authenticated;
revoke all on function public.is_editorial_admin(public.admin_role[]) from public, anon;
grant execute on function public.is_editorial_admin(public.admin_role[]) to authenticated;
revoke all on function public.change_team_once(text) from public, anon;
grant execute on function public.change_team_once(text) to authenticated;
-- handle_new_user yalnızca auth.users trigger'ı tarafından çağrılır; hiçbir
-- istemci rolünün doğrudan çağırmasına gerek yoktur.
revoke all on function public.handle_new_user() from public, anon, authenticated;
-- enforce_prediction_integrity de trigger fonksiyonudur; doğrudan çağrılmamalı.
revoke all on function public.enforce_prediction_integrity() from public, anon, authenticated;

commit;

-- GERİ ALMA PLANI: supabase/migrations/rollback/20260821090000_prediction_reward_repair_down.sql
