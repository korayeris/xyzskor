-- GERİ ALMA: 20260821090000_prediction_reward_repair.sql
-- Türkçe açıklama: settle fonksiyonunu 20260819203000 sürümüne döndürür,
-- tier kısıtını 5 katmana geri alır ve kaldırılan EXECUTE yetkilerini iade eder.
-- UYARI: 'rookie' katmanında satır varsa kısıt geri alınamaz; önce o satırları
-- taşımak/silmek gerekir (aşağıdaki kontrol sorgusu bunu bildirir).
begin;

do $$
declare rookie_rows integer;
begin
  select count(*) into rookie_rows from public.prediction_reward_eligibilities where tier = 'rookie';
  if rookie_rows > 0 then
    raise exception 'GERI ALMA ENGELLENDI: % adet rookie katmani satiri var; once bu satirlari temizle.', rookie_rows;
  end if;
end $$;

alter table public.prediction_reward_eligibilities
  drop constraint if exists prediction_reward_eligibilities_tier_check;
alter table public.prediction_reward_eligibilities
  add constraint prediction_reward_eligibilities_tier_check
  check (tier in ('bronze','silver','gold','diamond','champion'));

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

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_verified_user() to anon, authenticated;
grant execute on function public.is_editorial_admin(public.admin_role[]) to anon, authenticated;
grant execute on function public.change_team_once(text) to anon, authenticated;
grant execute on function public.handle_new_user() to public;
grant execute on function public.enforce_prediction_integrity() to public;

commit;
