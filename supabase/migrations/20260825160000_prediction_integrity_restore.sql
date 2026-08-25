-- Restore the production Predict write/read contract.

begin;

create unique index if not exists predictions_match_user_uidx
  on public.predictions (match_id, user_id);

create or replace function public.enforce_prediction_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_match public.matches;
begin
  if auth.uid() is null then
    raise exception 'Tahmin kaydetmek için oturum gerekli.';
  end if;
  if new.user_id <> auth.uid() then
    raise exception 'Başka kullanıcı adına tahmin kaydedilemez.';
  end if;

  select * into target_match
  from public.matches
  where id = new.match_id;

  if target_match.id is null then
    raise exception 'Maç bulunamadı.';
  end if;
  if target_match.status in ('iptal', 'ertelendi', 'cancelled', 'postponed') then
    raise exception 'Bu maç tahmine kapalı.';
  end if;
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

revoke all on table public.predictions from public, anon;
grant select, insert, update, delete on table public.predictions to authenticated;

revoke all on function public.enforce_prediction_integrity()
  from public, anon, authenticated;

commit;

-- Rollback: supabase/migrations/rollback/20260825160000_prediction_integrity_restore_down.sql
