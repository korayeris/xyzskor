-- XYZSKOR PROMPT 8 — REVIEW ONLY / DO NOT APPLY
-- Ön koşul: canlı schema-only export, policy/function export ve staging doğrulaması.
-- Bu taslak mevcut public.is_admin() fonksiyonunu değiştirmez.

begin;

create type public.editorial_status as enum (
  'new','review_pending','changes_requested','source_pending','conflicting',
  'approved','scheduled','published','rejected'
);
create type public.editorial_confidence as enum (
  'official','strong_claim','rumour','data_analysis','conflicting'
);
create type public.admin_role as enum (
  'owner','editor','reviewer','source_manager','football_data'
);

create table public.admin_memberships (
  auth_user_id uuid primary key references auth.users(id) on delete restrict,
  role public.admin_role not null,
  telegram_user_id bigint unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create function public.is_editorial_admin(required_roles public.admin_role[] default null)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.admin_memberships m
    where m.auth_user_id = auth.uid() and m.active
      and (required_roles is null or m.role = any(required_roles))
  );
$$;

create table public.editorial_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 5 and 240),
  spot text,
  body text,
  category text not null,
  confidence public.editorial_confidence,
  status public.editorial_status not null default 'new',
  related_match_id text,
  related_team text,
  related_player text,
  author_id uuid not null references auth.users(id),
  editor_id uuid references auth.users(id),
  first_seen_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  check ((status = 'published') = (published_at is not null))
);
create index editorial_items_public_idx on public.editorial_items (published_at desc) where status = 'published';
create index editorial_items_queue_idx on public.editorial_items (status, updated_at);
create index editorial_items_match_idx on public.editorial_items (related_match_id) where related_match_id is not null;

create table public.editorial_sources (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  canonical_url text not null check (canonical_url ~ '^https?://'),
  normalized_domain text not null unique,
  source_type text not null check (source_type in ('official','agency','journalist','publisher','data_provider')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.editorial_item_sources (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.editorial_items(id) on delete cascade,
  source_id uuid not null references public.editorial_sources(id) on delete restrict,
  source_url text check (source_url is null or source_url ~ '^https?://'),
  claim text,
  independent_group text,
  first_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique nulls not distinct (item_id, source_id, source_url)
);
create index editorial_item_sources_item_idx on public.editorial_item_sources(item_id);

create table public.editorial_updates (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.editorial_items(id) on delete cascade,
  body text not null,
  is_correction boolean not null default false,
  is_public boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index editorial_updates_item_time_idx on public.editorial_updates(item_id, created_at);

create table public.editorial_reviews (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.editorial_items(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  decision public.editorial_status not null,
  note text,
  created_at timestamptz not null default now()
);
create index editorial_reviews_item_time_idx on public.editorial_reviews(item_id, created_at desc);

create table public.publication_jobs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.editorial_items(id) on delete restrict,
  run_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','running','done','failed','cancelled')),
  idempotency_key text not null unique,
  attempts integer not null default 0 check (attempts >= 0),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index publication_jobs_due_idx on public.publication_jobs(run_at) where status = 'pending';

create table public.audit_logs (
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
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);
create index audit_logs_request_idx on public.audit_logs(request_id) where request_id is not null;

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('telegram','email','push')),
  event_key text not null,
  recipient_key text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','cancelled')),
  provider_message_id text,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(channel, event_key, recipient_key)
);

alter table public.admin_memberships enable row level security;
alter table public.editorial_items enable row level security;
alter table public.editorial_sources enable row level security;
alter table public.editorial_item_sources enable row level security;
alter table public.editorial_updates enable row level security;
alter table public.editorial_reviews enable row level security;
alter table public.publication_jobs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notification_deliveries enable row level security;

create policy editorial_items_public_read on public.editorial_items for select
using (status = 'published' and published_at <= now());
create policy editorial_items_admin_all on public.editorial_items for all to authenticated
using (public.is_editorial_admin(null)) with check (public.is_editorial_admin(null));

create policy editorial_sources_public_read on public.editorial_sources for select using (active);
create policy editorial_sources_admin_all on public.editorial_sources for all to authenticated
using (public.is_editorial_admin(array['owner','source_manager']::public.admin_role[]))
with check (public.is_editorial_admin(array['owner','source_manager']::public.admin_role[]));

create policy editorial_links_public_read on public.editorial_item_sources for select using (
  exists (select 1 from public.editorial_items i where i.id=item_id and i.status='published' and i.published_at<=now())
);
create policy editorial_links_admin_all on public.editorial_item_sources for all to authenticated
using (public.is_editorial_admin(null)) with check (public.is_editorial_admin(null));

create policy editorial_updates_public_read on public.editorial_updates for select using (
  is_public and exists (select 1 from public.editorial_items i where i.id=item_id and i.status='published' and i.published_at<=now())
);
create policy editorial_updates_admin_all on public.editorial_updates for all to authenticated
using (public.is_editorial_admin(null)) with check (public.is_editorial_admin(null));

create policy reviews_admin_only on public.editorial_reviews for all to authenticated
using (public.is_editorial_admin(null)) with check (public.is_editorial_admin(null));
create policy jobs_admin_read on public.publication_jobs for select to authenticated using (public.is_editorial_admin(null));
create policy audit_admin_read on public.audit_logs for select to authenticated using (public.is_editorial_admin(array['owner']::public.admin_role[]));
create policy delivery_admin_read on public.notification_deliveries for select to authenticated using (public.is_editorial_admin(null));
create policy memberships_owner_read on public.admin_memberships for select to authenticated using (public.is_editorial_admin(array['owner']::public.admin_role[]));

-- Worker tablolarına doğrudan client write policy verilmedi; service_role RLS'i bypass eder.
-- audit_logs için UPDATE/DELETE policy kasıtlı olarak yoktur.
-- İlk owner üyeliği Dashboard/SQL güvenli bakım oturumunda doğrulanmış auth UID ile eklenmelidir.

rollback; -- İnceleme dosyasının yanlışlıkla çalıştırılmasında kalıcı değişiklik bırakma.

-- ONAYLI MIGRATION İÇİN DOWN PLANI (ayrı transaction ve dependency kontrolüyle):
-- drop table notification_deliveries, audit_logs, publication_jobs, editorial_reviews,
--   editorial_updates, editorial_item_sources, editorial_sources, editorial_items,
--   admin_memberships;
-- drop function public.is_editorial_admin(public.admin_role[]);
-- drop type public.admin_role, public.editorial_confidence, public.editorial_status;
