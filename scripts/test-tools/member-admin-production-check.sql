-- Read-only production verification for membership/admin hardening.
-- Expected result: every boolean true and missing_profiles = 0.
select
  exists (
    select 1 from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'on_auth_user_created'
      and not tgisinternal
  ) as profile_trigger_present,
  (select count(*) from auth.users u
   left join public.profiles p on p.id = u.id
   where p.id is null) = 0 as profiles_complete,
  not has_function_privilege(
    'anon',
    'public.list_member_admin_console(text,integer)',
    'EXECUTE'
  ) as anon_list_blocked,
  not has_function_privilege(
    'anon',
    'public.set_member_admin_role(uuid,boolean,public.admin_role,boolean)',
    'EXECUTE'
  ) as anon_set_blocked,
  has_function_privilege(
    'authenticated',
    'public.list_member_admin_console(text,integer)',
    'EXECUTE'
  ) as authenticated_list_allowed,
  has_function_privilege(
    'authenticated',
    'public.set_member_admin_role(uuid,boolean,public.admin_role,boolean)',
    'EXECUTE'
  ) as authenticated_set_allowed,
  (select count(*) from auth.users u
   left join public.profiles p on p.id = u.id
   where p.id is null) as missing_profiles;
