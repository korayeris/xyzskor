-- XYZSKOR üye kontrol ve yetkilendirme konsolu.
-- Amaç: frontend'in auth.users tablosuna doğrudan erişmeden adminlerin üyeleri
-- listelemesi ve yetki vermesi.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'admin_role'
  ) then
    create type public.admin_role as enum (
      'owner','editor','reviewer','source_manager','football_data'
    );
  end if;
end;
$$;

create table if not exists public.admin_memberships (
  auth_user_id uuid primary key references auth.users(id) on delete restrict,
  role public.admin_role not null,
  telegram_user_id bigint unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);
create index if not exists audit_logs_request_idx on public.audit_logs(request_id) where request_id is not null;

create or replace function public.is_editorial_admin(required_roles public.admin_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_memberships m
    where m.auth_user_id = auth.uid()
      and m.active
      and (required_roles is null or m.role = any(required_roles))
  );
$$;

alter table public.admin_memberships enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.list_member_admin_console(
  p_search text default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  username text,
  display_name text,
  team text,
  email text,
  is_admin boolean,
  editorial_role public.admin_role,
  editorial_active boolean,
  created_at timestamptz,
  last_seen_at timestamptz,
  prediction_count bigint,
  weekly_game_count bigint,
  reward_claim_count bigint
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Bu işlem için admin yetkisi gerekli.';
  end if;

  return query
  select
    p.id,
    p.username,
    nullif(coalesce(p.username, ''), '') as display_name,
    p.team,
    u.email::text,
    p.is_admin,
    m.role as editorial_role,
    coalesce(m.active, false) as editorial_active,
    p.created_at,
    coalesce(p.updated_at, p.created_at) as last_seen_at,
    coalesce(pr.prediction_count, 0)::bigint as prediction_count,
    coalesce(wg.weekly_game_count, 0)::bigint as weekly_game_count,
    coalesce(rc.reward_claim_count, 0)::bigint as reward_claim_count
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.admin_memberships m on m.auth_user_id = p.id
  left join lateral (
    select count(*)::bigint as prediction_count
    from public.predictions x
    where x.user_id = p.id
  ) pr on true
  left join lateral (
    select count(*)::bigint as weekly_game_count
    from public.weekly_game_entries x
    where x.user_id = p.id
  ) wg on true
  left join lateral (
    select count(*)::bigint as reward_claim_count
    from public.reward_claims x
    where x.user_id = p.id
  ) rc on true
  where
    coalesce(trim(p_search), '') = ''
    or p.username ilike '%' || trim(p_search) || '%'
    or p.team ilike '%' || trim(p_search) || '%'
    or u.email ilike '%' || trim(p_search) || '%'
  order by p.is_admin desc, coalesce(p.updated_at, p.created_at) desc, p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;

create or replace function public.set_member_admin_role(
  p_user_id uuid,
  p_is_admin boolean,
  p_editorial_role public.admin_role default null,
  p_active boolean default true
)
returns table (
  id uuid,
  username text,
  display_name text,
  team text,
  email text,
  is_admin boolean,
  editorial_role public.admin_role,
  editorial_active boolean,
  created_at timestamptz,
  last_seen_at timestamptz,
  prediction_count bigint,
  weekly_game_count bigint,
  reward_claim_count bigint
)
language plpgsql
volatile
security definer
set search_path = public, auth, pg_temp
as $$
declare
  before_profile jsonb;
  before_membership jsonb;
begin
  if not public.is_admin() then
    raise exception 'Bu işlem için admin yetkisi gerekli.';
  end if;

  if p_user_id is null then
    raise exception 'Kullanıcı seçimi gerekli.';
  end if;

  if p_user_id = auth.uid() and coalesce(p_is_admin, false) = false then
    raise exception 'Kendi admin yetkini panelden kaldıramazsın.';
  end if;

  select to_jsonb(p.*) into before_profile
  from public.profiles p
  where p.id = p_user_id;

  if before_profile is null then
    raise exception 'Kullanıcı profili bulunamadı.';
  end if;

  select to_jsonb(m.*) into before_membership
  from public.admin_memberships m
  where m.auth_user_id = p_user_id;

  update public.profiles
  set
    is_admin = coalesce(p_is_admin, false),
    updated_at = now()
  where profiles.id = p_user_id;

  if p_editorial_role is not null then
    insert into public.admin_memberships(auth_user_id, role, active, created_by)
    values (p_user_id, p_editorial_role, coalesce(p_active, true), auth.uid())
    on conflict (auth_user_id) do update
      set role = excluded.role,
          active = excluded.active;
  else
    update public.admin_memberships
    set active = false
    where auth_user_id = p_user_id;
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    auth.uid(),
    'member_admin_role_set',
    'profile',
    p_user_id::text,
    jsonb_build_object('profile', before_profile, 'membership', before_membership),
    jsonb_build_object(
      'is_admin', coalesce(p_is_admin, false),
      'editorial_role', p_editorial_role,
      'editorial_active', case when p_editorial_role is null then false else coalesce(p_active, true) end
    )
  );

  return query
  select *
  from public.list_member_admin_console(
    coalesce(
      (select u.email::text from auth.users u where u.id = p_user_id),
      (select p.username from public.profiles p where p.id = p_user_id)
    ),
    1
  ) c
  where c.id = p_user_id;
end;
$$;

revoke all on function public.list_member_admin_console(text, integer) from public;
revoke all on function public.set_member_admin_role(uuid, boolean, public.admin_role, boolean) from public;
grant execute on function public.list_member_admin_console(text, integer) to authenticated;
grant execute on function public.set_member_admin_role(uuid, boolean, public.admin_role, boolean) to authenticated;

comment on function public.list_member_admin_console(text, integer)
  is 'Admin hesap paneli için üye listesi. auth.users.email yalnız admin RPC üzerinden döner.';
comment on function public.set_member_admin_role(uuid, boolean, public.admin_role, boolean)
  is 'Admin hesap panelinden profile.is_admin ve admin_memberships rolünü güvenli şekilde günceller.';

commit;
