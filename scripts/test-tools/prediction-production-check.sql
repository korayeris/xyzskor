select
  (select relrowsecurity from pg_class
   where oid = 'public.predictions'::regclass) as rls_enabled,
  to_regprocedure('public.enforce_prediction_integrity()') is not null as lock_function,
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.predictions'::regclass
      and tgname = 'predictions_integrity_before_write'
      and tgenabled = 'O'
  ) as lock_trigger,
  (select count(*) from pg_policies
   where schemaname = 'public'
     and tablename = 'predictions'
     and policyname in (
       'predictions_own_read',
       'predictions_own_insert',
       'predictions_own_update',
       'predictions_admin_all'
     )) = 4 as policies_complete,
  not has_table_privilege(
    'anon', 'public.predictions', 'SELECT,INSERT,UPDATE,DELETE'
  ) as anon_blocked,
  has_table_privilege(
    'authenticated', 'public.predictions', 'SELECT,INSERT,UPDATE'
  ) as authenticated_ready,
  (select count(*) from (
     select match_id, user_id from public.predictions
     group by match_id, user_id having count(*) > 1
   ) duplicate_rows) = 0 as no_duplicate_keys,
  (select count(*) from public.predictions
   where pick not in ('1','X','2')) = 0 as valid_picks;
