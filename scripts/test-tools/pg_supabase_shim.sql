-- Supabase'e özgü nesnelerin yerel PostgreSQL'de taklidi.
-- Amaç: migration dosyalarını gerçek bir veritabanında çalıştırıp
-- sözdizimi, bağımlılık ve RLS politikası hatalarını yakalamak.

create extension if not exists pgcrypto;

-- Roller
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='supabase_admin') then create role supabase_admin nologin; end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- auth şeması ve users tablosu
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant usage on schema auth to anon, authenticated, service_role;

-- Test oturumu: current_setting ile taklit edilen auth.uid()/auth.jwt()
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;

-- Realtime publication (migration bunu kontrol ediyor)
do $$ begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
