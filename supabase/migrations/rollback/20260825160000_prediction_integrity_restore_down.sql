begin;

-- The forward migration only reasserts this index. It predates that migration
-- (20260802180000_platform_core.sql), so the rollback must preserve it.
create unique index if not exists predictions_match_user_uidx
  on public.predictions (match_id, user_id);

-- `public.enforce_prediction_integrity()` bu migration tarafından
-- OLUŞTURULMADI; 20260802180000_platform_core.sql tarafından oluşturulup burada
-- `create or replace` ile güncellendi. Bu yüzden geri alma adımında fonksiyon
-- DROP EDİLMEZ: drop edilmesi, daha eski migrationlara ait nesneyi ve trigger'ı
-- yok ederek 20260821090000 down/re-apply adımlarını
-- "function public.enforce_prediction_integrity() does not exist" hatasıyla
-- kırıyordu (gerçek PostgreSQL apply → rollback → re-apply döngüsünde tespit
-- edildi). Doğru davranış: fonksiyonu 20260802180000'deki tanımına döndürmek.
create or replace function public.enforce_prediction_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_match public.matches;
begin
  if auth.uid() is not null and new.user_id <> auth.uid() then
    raise exception 'Başka kullanıcı adına tahmin kaydedilemez.';
  end if;
  select * into target_match from public.matches where id = new.match_id;
  if target_match.id is null then raise exception 'Maç bulunamadı.'; end if;
  if target_match.status in ('iptal','ertelendi') then raise exception 'Bu maç tahmine kapalı.'; end if;
  if now() >= target_match.kickoff - interval '15 minutes' then
    raise exception 'Tahmin süresi doldu.';
  end if;
  new.submitted_at := now();
  return new;
end;
$$;

drop trigger if exists predictions_integrity_before_write on public.predictions;
create trigger predictions_integrity_before_write
before insert or update on public.predictions
for each row execute function public.enforce_prediction_integrity();

alter table public.predictions enable row level security;

drop policy if exists predictions_own_read on public.predictions;
drop policy if exists predictions_own_insert on public.predictions;
drop policy if exists predictions_own_update on public.predictions;
drop policy if exists predictions_admin_all on public.predictions;

-- Restore the policy definitions originally installed by platform_core. The
-- forward migration replaced these objects even though their contract did not
-- change, so dropping them without recreating them is not a valid rollback.
create policy predictions_own_read
on public.predictions for select to authenticated
using (user_id = auth.uid());

create policy predictions_own_insert
on public.predictions for insert to authenticated
with check (user_id = auth.uid());

create policy predictions_own_update
on public.predictions for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy predictions_admin_all
on public.predictions for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 20260806090000 removed authenticated DELETE and 20260821090000 removed
-- direct execution of this trigger function. Both migrations remain applied
-- when only 20260825160000 is rolled back, so preserve those restrictions.
revoke all on table public.predictions from public, anon, authenticated;
grant select, insert, update on table public.predictions to authenticated;

revoke all on function public.enforce_prediction_integrity()
  from public, anon, authenticated;

commit;
