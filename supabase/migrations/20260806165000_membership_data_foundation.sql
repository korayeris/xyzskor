-- XYZSKOR üyelik ve KVKK uyumlu veri temeli.
-- Amaç: auth.users üstüne minimum kişisel veri, açık onay kaydı,
-- haftalık oyun/tahmin kayıtları, ödül talep süreci ve bot/fraud izleme katmanı.

begin;

create extension if not exists pgcrypto with schema extensions;

-- Profil tablosu auth.users'a bağlı kalır; hassas teslimat bilgisi burada tutulmaz.
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists birth_year integer check (birth_year is null or birth_year between 1900 and 2100);
alter table public.profiles add column if not exists favorite_league text;
alter table public.profiles add column if not exists marketing_opt_in boolean not null default false;
alter table public.profiles add column if not exists profile_completed_at timestamptz;
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists deleted_at timestamptz;

create index if not exists profiles_team_idx on public.profiles(team) where deleted_at is null;
create index if not exists profiles_last_seen_idx on public.profiles(last_seen_at desc) where deleted_at is null;

create table if not exists public.legal_documents (
  document_key text not null check (document_key ~ '^[a-z0-9_]+$'),
  version text not null check (char_length(version) between 3 and 40),
  title text not null,
  url_path text not null check (url_path ~ '^/legal/'),
  is_required boolean not null default true,
  is_active boolean not null default true,
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (document_key, version)
);

create index if not exists legal_documents_active_idx
  on public.legal_documents(document_key, effective_at desc)
  where is_active;

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_key text not null,
  version text not null,
  consent_scope text not null default 'required'
    check (consent_scope in ('required','kvkk_notice','explicit_consent','marketing','cookie')),
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, document_key, version, consent_scope),
  foreign key (document_key, version) references public.legal_documents(document_key, version) on delete restrict,
  check (revoked_at is null or revoked_at >= accepted_at)
);

create index if not exists user_consents_user_idx on public.user_consents(user_id, accepted_at desc);
create index if not exists user_consents_document_idx on public.user_consents(document_key, version, accepted_at desc);

create table if not exists public.user_privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  contact_email_hash text,
  request_type text not null check (request_type in ('access','correction','deletion','restriction','objection','export','consent_withdrawal')),
  status text not null default 'received' check (status in ('received','reviewing','waiting_user','completed','rejected')),
  details text,
  response_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  handled_by uuid references auth.users(id)
);

create index if not exists user_privacy_requests_user_idx on public.user_privacy_requests(user_id, created_at desc);
create index if not exists user_privacy_requests_status_idx on public.user_privacy_requests(status, created_at);

create table if not exists public.weekly_games (
  id uuid primary key default gen_random_uuid(),
  league_key text not null,
  season text not null,
  week integer not null check (week > 0),
  game_type text not null check (game_type in ('match_score','legend_quiz','shirt_quiz','career_path','missing_xi','goal_memory','transfer_true_false','number_quiz','derby_memory','teammate_quiz','club_order')),
  title text not null,
  prompt text,
  status text not null default 'draft' check (status in ('draft','published','locked','scored','archived')),
  opens_at timestamptz,
  locks_at timestamptz,
  closes_at timestamptz,
  source_refs jsonb not null default '[]'::jsonb,
  answer_key jsonb,
  scoring_rules jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_key, season, week, game_type)
);

create index if not exists weekly_games_lookup_idx on public.weekly_games(league_key, season, week, status);
create index if not exists weekly_games_open_idx on public.weekly_games(opens_at, locks_at) where status = 'published';

create table if not exists public.weekly_game_entries (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.weekly_games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answer_payload jsonb not null default '{}'::jsonb,
  client_fingerprint_hash text,
  score integer check (score is null or score >= 0),
  submitted_at timestamptz not null default now(),
  locked_at timestamptz,
  scored_at timestamptz,
  score_reason jsonb,
  unique (game_id, user_id)
);

create index if not exists weekly_game_entries_game_idx on public.weekly_game_entries(game_id, submitted_at);
create index if not exists weekly_game_entries_user_idx on public.weekly_game_entries(user_id, submitted_at desc);
create index if not exists weekly_game_entries_score_idx on public.weekly_game_entries(game_id, score desc, submitted_at) where score is not null;

create table if not exists public.reward_campaigns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  sponsor_name text,
  description text,
  rules_url text not null default '/legal/oyun-odul-kurallari.html',
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft','active','paused','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reward_campaigns_status_idx on public.reward_campaigns(status, starts_at, ends_at);

create table if not exists public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.reward_campaigns(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('prediction_week','weekly_game','manual_admin')),
  source_id text not null,
  status text not null default 'pending' check (status in ('pending','identity_check','approved','rejected','fulfilled','expired','cancelled')),
  reviewer_id uuid references auth.users(id),
  review_note text,
  shipping_name text,
  shipping_phone text,
  shipping_address jsonb,
  pii_expires_at timestamptz,
  claimed_at timestamptz not null default now(),
  reviewed_at timestamptz,
  fulfilled_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (campaign_id, user_id, source_type, source_id),
  check (
    shipping_address is null
    or jsonb_typeof(shipping_address) = 'object'
  )
);

create index if not exists reward_claims_user_idx on public.reward_claims(user_id, claimed_at desc);
create index if not exists reward_claims_status_idx on public.reward_claims(status, claimed_at);
create index if not exists reward_claims_pii_expiry_idx on public.reward_claims(pii_expires_at) where pii_expires_at is not null;

create table if not exists public.account_security_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('signup','login','logout','prediction_submit','game_submit','reward_claim','rate_limit','suspicious_activity','admin_action')),
  ip_hash text,
  user_agent_hash text,
  risk_score integer not null default 0 check (risk_score between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists account_security_events_user_idx on public.account_security_events(user_id, created_at desc);
create index if not exists account_security_events_risk_idx on public.account_security_events(risk_score desc, created_at desc)
  where risk_score >= 50;

create or replace function public.touch_profile_seen()
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  changed public.profiles;
begin
  if auth.uid() is null then raise exception 'Oturum gerekli.'; end if;
  update public.profiles
  set last_seen_at = now(), updated_at = now()
  where id = auth.uid() and deleted_at is null
  returning * into changed;
  if changed.id is null then raise exception 'Profil bulunamadı.'; end if;
  return changed;
end;
$$;

create or replace function public.update_my_profile(
  p_display_name text default null,
  p_city text default null,
  p_birth_year integer default null,
  p_favorite_league text default null,
  p_marketing_opt_in boolean default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  changed public.profiles;
begin
  if auth.uid() is null then raise exception 'Oturum gerekli.'; end if;
  if p_display_name is not null and char_length(btrim(p_display_name)) not between 2 and 60 then
    raise exception 'Görünen ad 2-60 karakter olmalı.';
  end if;
  update public.profiles
  set
    display_name = coalesce(nullif(btrim(p_display_name), ''), display_name),
    city = coalesce(nullif(btrim(p_city), ''), city),
    birth_year = coalesce(p_birth_year, birth_year),
    favorite_league = coalesce(nullif(btrim(p_favorite_league), ''), favorite_league),
    marketing_opt_in = coalesce(p_marketing_opt_in, marketing_opt_in),
    profile_completed_at = coalesce(profile_completed_at, now()),
    updated_at = now()
  where id = auth.uid() and deleted_at is null
  returning * into changed;
  if changed.id is null then raise exception 'Profil bulunamadı.'; end if;
  return changed;
end;
$$;

create or replace function public.accept_user_consent(
  p_document_key text,
  p_version text,
  p_consent_scope text default 'required',
  p_ip_hash text default null,
  p_user_agent_hash text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.user_consents
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  accepted public.user_consents;
begin
  if auth.uid() is null then raise exception 'Oturum gerekli.'; end if;
  insert into public.user_consents(user_id, document_key, version, consent_scope, ip_hash, user_agent_hash, metadata)
  values (auth.uid(), p_document_key, p_version, coalesce(p_consent_scope,'required'), p_ip_hash, p_user_agent_hash, coalesce(p_metadata,'{}'::jsonb))
  on conflict (user_id, document_key, version, consent_scope)
  do update set accepted_at = now(), revoked_at = null, ip_hash = excluded.ip_hash,
    user_agent_hash = excluded.user_agent_hash, metadata = excluded.metadata
  returning * into accepted;
  return accepted;
end;
$$;

create or replace function public.submit_weekly_game_entry(
  p_game_id uuid,
  p_answer_payload jsonb,
  p_client_fingerprint_hash text default null
)
returns public.weekly_game_entries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_game public.weekly_games;
  entry public.weekly_game_entries;
begin
  if auth.uid() is null then raise exception 'Oturum gerekli.'; end if;
  select * into target_game from public.weekly_games where id = p_game_id;
  if target_game.id is null then raise exception 'Oyun bulunamadı.'; end if;
  if target_game.status <> 'published' then raise exception 'Bu oyun girişe açık değil.'; end if;
  if target_game.opens_at is not null and now() < target_game.opens_at then raise exception 'Oyun henüz açılmadı.'; end if;
  if target_game.locks_at is not null and now() >= target_game.locks_at then raise exception 'Oyun kilitlendi.'; end if;
  insert into public.weekly_game_entries(game_id, user_id, answer_payload, client_fingerprint_hash, submitted_at)
  values (p_game_id, auth.uid(), coalesce(p_answer_payload,'{}'::jsonb), p_client_fingerprint_hash, now())
  on conflict (game_id, user_id)
  do update set answer_payload = excluded.answer_payload,
    client_fingerprint_hash = excluded.client_fingerprint_hash,
    submitted_at = now()
  where public.weekly_game_entries.locked_at is null
  returning * into entry;
  if entry.id is null then raise exception 'Bu oyun girişi kilitli.'; end if;
  return entry;
end;
$$;

create or replace function public.request_reward_claim(
  p_campaign_id uuid,
  p_source_type text,
  p_source_id text
)
returns public.reward_claims
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claim public.reward_claims;
begin
  if auth.uid() is null then raise exception 'Oturum gerekli.'; end if;
  insert into public.reward_claims(campaign_id, user_id, source_type, source_id, pii_expires_at)
  values (p_campaign_id, auth.uid(), p_source_type, p_source_id, now() + interval '180 days')
  on conflict (campaign_id, user_id, source_type, source_id)
  do update set updated_at = now()
  returning * into claim;
  return claim;
end;
$$;

create or replace function public.log_account_security_event(
  p_event_type text,
  p_ip_hash text default null,
  p_user_agent_hash text default null,
  p_risk_score integer default 0,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id bigint;
begin
  insert into public.account_security_events(user_id, event_type, ip_hash, user_agent_hash, risk_score, metadata)
  values (auth.uid(), p_event_type, p_ip_hash, p_user_agent_hash, greatest(0, least(100, coalesce(p_risk_score,0))), coalesce(p_metadata,'{}'::jsonb))
  returning id into new_id;
  return new_id;
end;
$$;

alter table public.legal_documents enable row level security;
alter table public.user_consents enable row level security;
alter table public.user_privacy_requests enable row level security;
alter table public.weekly_games enable row level security;
alter table public.weekly_game_entries enable row level security;
alter table public.reward_campaigns enable row level security;
alter table public.reward_claims enable row level security;
alter table public.account_security_events enable row level security;

do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies
    where schemaname='public' and tablename = any(array[
      'legal_documents','user_consents','user_privacy_requests','weekly_games',
      'weekly_game_entries','reward_campaigns','reward_claims','account_security_events'
    ])
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

create policy legal_documents_public_read on public.legal_documents
  for select to anon, authenticated using (is_active and effective_at <= now());
create policy legal_documents_admin_all on public.legal_documents
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy user_consents_own_read on public.user_consents
  for select to authenticated using (user_id = auth.uid());
create policy user_consents_own_insert on public.user_consents
  for insert to authenticated with check (user_id = auth.uid());
create policy user_consents_admin_read on public.user_consents
  for select to authenticated using (public.is_admin());

create policy privacy_requests_own_read on public.user_privacy_requests
  for select to authenticated using (user_id = auth.uid());
create policy privacy_requests_own_insert on public.user_privacy_requests
  for insert to authenticated with check (user_id = auth.uid());
create policy privacy_requests_admin_all on public.user_privacy_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy weekly_games_public_read on public.weekly_games
  for select to anon, authenticated using (status in ('published','locked','scored','archived'));
create policy weekly_games_admin_all on public.weekly_games
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy weekly_entries_own_read on public.weekly_game_entries
  for select to authenticated using (user_id = auth.uid());
create policy weekly_entries_own_insert on public.weekly_game_entries
  for insert to authenticated with check (user_id = auth.uid());
create policy weekly_entries_own_update_unlocked on public.weekly_game_entries
  for update to authenticated using (user_id = auth.uid() and locked_at is null)
  with check (user_id = auth.uid() and locked_at is null);
create policy weekly_entries_admin_all on public.weekly_game_entries
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy reward_campaigns_public_read on public.reward_campaigns
  for select to anon, authenticated using (status in ('active','completed'));
create policy reward_campaigns_admin_all on public.reward_campaigns
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy reward_claims_own_read on public.reward_claims
  for select to authenticated using (user_id = auth.uid());
create policy reward_claims_own_insert on public.reward_claims
  for insert to authenticated with check (user_id = auth.uid());
create policy reward_claims_own_update_pending on public.reward_claims
  for update to authenticated using (user_id = auth.uid() and status in ('pending','identity_check'))
  with check (user_id = auth.uid() and status in ('pending','identity_check'));
create policy reward_claims_admin_all on public.reward_claims
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy account_security_events_admin_read on public.account_security_events
  for select to authenticated using (public.is_admin());

revoke all on public.legal_documents, public.user_consents, public.user_privacy_requests,
  public.weekly_games, public.weekly_game_entries, public.reward_campaigns, public.reward_claims,
  public.account_security_events from anon;
revoke all on public.legal_documents, public.user_consents, public.user_privacy_requests,
  public.weekly_games, public.weekly_game_entries, public.reward_campaigns, public.reward_claims,
  public.account_security_events from authenticated;

grant select on public.legal_documents, public.weekly_games, public.reward_campaigns to anon, authenticated;
grant select on public.user_consents, public.user_privacy_requests, public.weekly_game_entries,
  public.reward_claims to authenticated;
grant insert on public.user_consents, public.user_privacy_requests, public.weekly_game_entries,
  public.reward_claims to authenticated;
grant update on public.weekly_game_entries, public.reward_claims to authenticated;
grant select on public.account_security_events to authenticated;
grant insert, update, delete on public.legal_documents, public.weekly_games, public.reward_campaigns to authenticated;
grant update, delete on public.user_privacy_requests, public.weekly_game_entries, public.reward_claims to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke all on function public.touch_profile_seen() from public;
revoke all on function public.update_my_profile(text,text,integer,text,boolean) from public;
revoke all on function public.accept_user_consent(text,text,text,text,text,jsonb) from public;
revoke all on function public.submit_weekly_game_entry(uuid,jsonb,text) from public;
revoke all on function public.request_reward_claim(uuid,text,text) from public;
revoke all on function public.log_account_security_event(text,text,text,integer,jsonb) from public;

grant execute on function public.touch_profile_seen() to authenticated;
grant execute on function public.update_my_profile(text,text,integer,text,boolean) to authenticated;
grant execute on function public.accept_user_consent(text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.submit_weekly_game_entry(uuid,jsonb,text) to authenticated;
grant execute on function public.request_reward_claim(uuid,text,text) to authenticated;
grant execute on function public.log_account_security_event(text,text,text,integer,jsonb) to authenticated;

insert into public.legal_documents(document_key, version, title, url_path, is_required, is_active, effective_at)
values
  ('terms', '2026-08-06', 'Kullanım Koşulları', '/legal/kullanim-kosullari.html', true, true, now()),
  ('privacy', '2026-08-06', 'Gizlilik Politikası', '/legal/gizlilik-politikasi.html', true, true, now()),
  ('kvkk_notice', '2026-08-06', 'KVKK Aydınlatma Metni', '/legal/kvkk-aydinlatma.html', true, true, now()),
  ('game_reward_rules', '2026-08-06', 'Oyun ve Ödül Kuralları', '/legal/oyun-odul-kurallari.html', true, true, now()),
  ('marketing', '2026-08-06', 'Ticari İleti İzni', '/legal/ticari-ileti.html', false, true, now()),
  ('cookies', '2026-08-06', 'Çerez Politikası', '/legal/cerez-politikasi.html', false, true, now())
on conflict (document_key, version) do update
set title = excluded.title,
  url_path = excluded.url_path,
  is_required = excluded.is_required,
  is_active = excluded.is_active;

comment on table public.legal_documents is 'Üyelikte gösterilen yasal metinlerin sürümlü kayıtları.';
comment on table public.user_consents is 'Kullanıcının kabul ettiği yasal metin ve açık rıza kayıtları. IP ve user-agent yalnız hash olarak tutulmalıdır.';
comment on table public.user_privacy_requests is 'KVKK erişim, düzeltme, silme, itiraz ve veri taşınabilirliği talepleri.';
comment on table public.weekly_games is 'Predict dışındaki haftalık oyunların yayın, kilit ve skor kaydı.';
comment on table public.weekly_game_entries is 'Kullanıcıların haftalık oyun cevapları. Skor backend/admin tarafından yazılmalıdır.';
comment on table public.reward_claims is 'Yalnız kazananlardan alınan ödül teslimat bilgileri. Teslimat sonrası pii_expires_at ile silme/anonimleştirme yapılmalıdır.';
comment on table public.account_security_events is 'Bot/fraud/rate-limit tespiti için hash tabanlı güvenlik olayları.';

commit;
