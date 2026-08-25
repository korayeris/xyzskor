-- XYZSKOR member/admin hardening.
-- Restores profile provisioning, backfills missing profiles, and removes
-- anonymous access to the admin-console RPC surface.

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  candidate text;
  supported_team text;
begin
  candidate := left(
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'username'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'uye_' || substr(replace(new.id::text, '-', ''), 1, 12)
    ),
    40
  );
  if exists (
    select 1 from public.profiles where lower(username) = lower(candidate)
  ) then
    candidate := left(candidate, 31) || '-' || substr(new.id::text, 1, 8);
  end if;

  supported_team := coalesce(
    nullif(trim(new.raw_user_meta_data->>'team'), ''),
    'Diğer'
  );
  if supported_team not in (
    'Beşiktaş', 'Diğer', 'Fenerbahçe', 'Galatasaray', 'Trabzonspor'
  ) then
    supported_team := 'Diğer';
  end if;

  insert into public.profiles (id, username, team)
  values (new.id, candidate, supported_team)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Existing auth users created while the trigger was absent must receive a
-- deterministic, collision-resistant profile without exposing their email.
insert into public.profiles (id, username, team)
select
  u.id,
  'uye_' || substr(replace(u.id::text, '-', ''), 1, 12),
  'Diğer'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- handle_new_user is SECURITY DEFINER and already owns username/team
-- normalisation. It is trigger-only; clients cannot execute it directly.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;

revoke all on function public.list_member_admin_console(text, integer)
  from public, anon;
revoke all on function public.set_member_admin_role(
  uuid, boolean, public.admin_role, boolean
) from public, anon;

grant execute on function public.list_member_admin_console(text, integer)
  to authenticated;
grant execute on function public.set_member_admin_role(
  uuid, boolean, public.admin_role, boolean
) to authenticated;

commit;

-- Rollback: supabase/migrations/rollback/20260825150000_member_admin_hardening_down.sql
