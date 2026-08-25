-- Roll back the member/admin hardening migration without deleting profiles.

begin;

drop trigger if exists on_auth_user_created on auth.users;

-- Restore the immediately preceding production privilege state. The function
-- guard still requires profiles.is_admin=true, but this broader ACL is retained
-- only for a faithful rollback drill.
grant execute on function public.list_member_admin_console(text, integer)
  to anon, authenticated;
grant execute on function public.set_member_admin_role(
  uuid, boolean, public.admin_role, boolean
) to anon, authenticated;

commit;
