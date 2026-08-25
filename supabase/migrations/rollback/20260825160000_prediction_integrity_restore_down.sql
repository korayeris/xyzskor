begin;

drop trigger if exists predictions_integrity_before_write on public.predictions;
drop function if exists public.enforce_prediction_integrity();

drop policy if exists predictions_own_read on public.predictions;
drop policy if exists predictions_own_insert on public.predictions;
drop policy if exists predictions_own_update on public.predictions;
drop policy if exists predictions_admin_all on public.predictions;

-- Restore the production state measured immediately before this repair.
grant select, insert, update, delete on table public.predictions to anon, authenticated;

commit;
