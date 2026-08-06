-- XYZSKOR sohbet çekirdeği: gündem odaları, mesajlar, moderasyon ve raporlama.
--
-- Tasarım kararları:
--  1) Yazma yetkisi yalnızca e-postası doğrulanmış kullanıcılara verilir
--     ("doğrulanmış hesap"). Doğrulama Supabase Auth'ta tutulduğu için
--     auth.users.email_confirmed_at üzerinden security definer bir yardımcı
--     fonksiyonla okunur.
--  2) profiles tablosunda kullanıcı SADECE kendi satırını okuyabiliyor
--     (profiles_own_read). Bu yüzden mesaj yazarının görünen adı ve takımı
--     mesaj satırına DENORMALIZE edilir; aksi halde sohbette başkalarının
--     adı hiç görünmezdi. Denormalizasyon trigger içinde sunucu tarafında
--     yapılır, istemci bu alanları gönderemez/değiştiremez.
--  3) Silinen mesaj fiziksel olarak silinmez; deleted_at + moderasyon
--     nedeni ile işaretlenir, böylece denetim izi korunur ve Realtime
--     aboneleri silmeyi UPDATE olayı olarak görür.
--  4) Moderasyon işlemleri audit_logs'a yazılır. audit_logs'ta istemciye
--     INSERT grant'i yok; bu yüzden yazma yalnızca security definer RPC
--     içinden yapılır (mevcut güvenlik modeli korunur).

begin;

/* ===================== YARDIMCI FONKSİYONLAR ===================== */

-- E-postası doğrulanmış kullanıcı mı? ("doğrulanmış hesap")
create or replace function public.is_verified_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;

comment on function public.is_verified_user() is
  'Oturumdaki kullanıcının e-posta doğrulamasını tamamlayıp tamamlamadığını döndürür. Sohbette yazma yetkisi bu koşula bağlıdır.';

/* ===================== ODALAR ===================== */

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  topic text,
  -- 'league' (lig gündemi), 'match' (maç odası), 'general' (genel gündem)
  kind text not null default 'general',
  league_key text,
  match_id text,
  is_active boolean not null default true,
  -- Oda kilitliyse yalnızca moderatörler yazabilir.
  is_locked boolean not null default false,
  -- Yazma için gereken minimum hesap durumu: 'verified' | 'any'
  min_account_state text not null default 'verified',
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists chat_rooms_slug_uidx on public.chat_rooms(slug);
create index if not exists chat_rooms_active_idx on public.chat_rooms(is_active, sort_order);
create index if not exists chat_rooms_league_idx on public.chat_rooms(league_key) where league_key is not null;
create index if not exists chat_rooms_match_idx on public.chat_rooms(match_id) where match_id is not null;

/* ===================== MESAJLAR ===================== */

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  -- Sunucu tarafında doldurulan görüntüleme alanları (bkz. tasarım kararı 2).
  author_name text not null default '',
  author_team text not null default '',
  author_verified boolean not null default false,
  reply_to uuid references public.chat_messages(id) on delete set null,
  -- Moderasyon
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_reason text,
  report_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint chat_messages_body_len check (char_length(btrim(body)) between 1 and 500)
);

-- Oda akışının ana sorgusu: son N mesaj.
create index if not exists chat_messages_room_time_idx on public.chat_messages(room_id, created_at desc);
-- Rate limit trigger'ının sorgusu (kullanıcının son mesajı).
create index if not exists chat_messages_user_time_idx on public.chat_messages(user_id, created_at desc);
-- Moderasyon kuyruğu: raporlanmış ve henüz silinmemiş mesajlar.
create index if not exists chat_messages_reported_idx on public.chat_messages(report_count desc, created_at desc)
  where deleted_at is null and report_count > 0;

/* ===================== SUSTURMA (MUTE / BAN) ===================== */

create table if not exists public.chat_mutes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- null = süresiz (ban)
  muted_until timestamptz,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists chat_mutes_until_idx on public.chat_mutes(muted_until);

-- Kullanıcı şu anda susturulmuş mu?
create or replace function public.is_chat_muted(target uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.chat_mutes m
    where m.user_id = coalesce(target, auth.uid())
      and (m.muted_until is null or m.muted_until > now())
  );
$$;

/* ===================== RAPORLAR ===================== */

create table if not exists public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default 'other',
  note text,
  -- 'open' | 'resolved' | 'dismissed'
  status text not null default 'open',
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chat_reports_reason_len check (char_length(coalesce(note,'')) <= 400)
);

-- Aynı kullanıcı aynı mesajı bir kez raporlayabilir.
create unique index if not exists chat_reports_unique_idx on public.chat_reports(message_id, reporter_id);
create index if not exists chat_reports_open_idx on public.chat_reports(status, created_at desc) where status = 'open';

/* ===================== YAZMA KURALLARI (TRIGGER) ===================== */

create or replace function public.enforce_chat_message_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_room public.chat_rooms;
  author public.profiles;
  recent_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sohbete katılmak için giriş yapmalısın.';
  end if;
  if new.user_id <> auth.uid() then
    raise exception 'Başka kullanıcı adına mesaj gönderilemez.';
  end if;

  select * into target_room from public.chat_rooms where id = new.room_id;
  if target_room.id is null then
    raise exception 'Sohbet odası bulunamadı.';
  end if;
  if not target_room.is_active then
    raise exception 'Bu sohbet odası kapalı.';
  end if;
  if target_room.is_locked and not public.is_editorial_admin(null) then
    raise exception 'Bu oda şu anda yalnızca moderatörlere açık.';
  end if;
  if target_room.min_account_state = 'verified'
     and not public.is_verified_user()
     and not public.is_editorial_admin(null) then
    raise exception 'Bu odada yazabilmek için e-posta adresini doğrulaman gerekiyor.';
  end if;
  if public.is_chat_muted(auth.uid()) then
    raise exception 'Sohbette yazma yetkin geçici olarak kapatıldı.';
  end if;

  -- Spam koruması: 3 saniyede bir mesaj, dakikada en fazla 12 mesaj.
  if exists (
    select 1 from public.chat_messages
    where user_id = auth.uid() and created_at > now() - interval '3 seconds'
  ) then
    raise exception 'Çok hızlı mesaj gönderiyorsun, birkaç saniye bekle.';
  end if;
  select count(*) into recent_count from public.chat_messages
    where user_id = auth.uid() and created_at > now() - interval '1 minute';
  if recent_count >= 12 then
    raise exception 'Dakikalık mesaj sınırına ulaştın, biraz bekle.';
  end if;

  -- Yanıtlanan mesaj aynı odada olmalı.
  if new.reply_to is not null and not exists (
    select 1 from public.chat_messages where id = new.reply_to and room_id = new.room_id
  ) then
    raise exception 'Yanıtlanan mesaj bu odada bulunamadı.';
  end if;

  -- Görüntüleme alanları sunucuda doldurulur; istemciden gelen değer yok sayılır.
  select * into author from public.profiles where id = auth.uid();
  new.author_name := coalesce(nullif(btrim(author.username), ''), 'Taraftar');
  new.author_team := coalesce(nullif(btrim(author.team), ''), 'Diğer');
  new.author_verified := public.is_verified_user();
  new.body := btrim(new.body);
  new.created_at := now();
  new.deleted_at := null;
  new.deleted_by := null;
  new.deleted_reason := null;
  new.report_count := 0;
  return new;
end;
$$;

drop trigger if exists chat_messages_rules_before_insert on public.chat_messages;
create trigger chat_messages_rules_before_insert
before insert on public.chat_messages
for each row execute function public.enforce_chat_message_rules();

/* ===================== RAPORLAMA RPC ===================== */

create or replace function public.report_chat_message(p_message_id uuid, p_reason text default 'other', p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.chat_messages;
  new_count integer;
begin
  if auth.uid() is null then
    raise exception 'Rapor göndermek için giriş yapmalısın.';
  end if;
  select * into target from public.chat_messages where id = p_message_id and deleted_at is null;
  if target.id is null then
    raise exception 'Mesaj bulunamadı.';
  end if;
  if target.user_id = auth.uid() then
    raise exception 'Kendi mesajını raporlayamazsın.';
  end if;

  insert into public.chat_reports(message_id, reporter_id, reason, note)
  values (p_message_id, auth.uid(), coalesce(nullif(btrim(p_reason), ''), 'other'), nullif(btrim(p_note), ''))
  on conflict (message_id, reporter_id) do nothing;

  select count(*) into new_count from public.chat_reports where message_id = p_message_id and status = 'open';
  update public.chat_messages set report_count = new_count where id = p_message_id;

  -- Eşiği aşan mesaj otomatik gizlenir; moderatör incelemesini bekler.
  if new_count >= 4 then
    update public.chat_messages
      set deleted_at = now(), deleted_reason = 'auto_hidden_report_threshold'
      where id = p_message_id and deleted_at is null;
  end if;

  return jsonb_build_object('ok', true, 'report_count', new_count, 'auto_hidden', new_count >= 4);
end;
$$;

/* ===================== MODERASYON RPC ===================== */

create or replace function public.moderate_chat_message(p_message_id uuid, p_action text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.chat_messages;
  action text := lower(btrim(coalesce(p_action, '')));
begin
  if not public.is_editorial_admin(array['owner','editor','reviewer']::public.admin_role[]) then
    raise exception 'Bu işlem için moderatör yetkisi gerekiyor.';
  end if;
  select * into target from public.chat_messages where id = p_message_id;
  if target.id is null then
    raise exception 'Mesaj bulunamadı.';
  end if;

  if action = 'delete' then
    update public.chat_messages
      set deleted_at = now(), deleted_by = auth.uid(), deleted_reason = coalesce(nullif(btrim(p_reason),''), 'moderator_removed')
      where id = p_message_id;
    -- Mesaj kaldırıldı: açık raporlar "işleme alındı" olarak kapatılır.
    update public.chat_reports set status = 'resolved', resolved_by = auth.uid(), resolved_at = now()
      where message_id = p_message_id and status = 'open';
  elsif action = 'restore' then
    update public.chat_messages
      set deleted_at = null, deleted_by = null, deleted_reason = null, report_count = 0
      where id = p_message_id;
    -- Mesaj geri alındı: raporlar haksız bulundu.
    update public.chat_reports set status = 'dismissed', resolved_by = auth.uid(), resolved_at = now()
      where message_id = p_message_id and status = 'open';
  else
    raise exception 'Geçersiz moderasyon işlemi.';
  end if;

  -- audit_logs'a yazma yalnızca definer fonksiyon içinden yapılır.
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data)
  values (auth.uid(), 'chat.' || action, 'chat_message', p_message_id::text,
          jsonb_build_object('deleted_at', target.deleted_at, 'report_count', target.report_count),
          jsonb_build_object('reason', p_reason));

  return jsonb_build_object('ok', true, 'action', action);
end;
$$;

create or replace function public.set_chat_mute(p_user_id uuid, p_minutes integer default 60, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  until timestamptz;
begin
  if not public.is_editorial_admin(array['owner','editor']::public.admin_role[]) then
    raise exception 'Bu işlem için moderatör yetkisi gerekiyor.';
  end if;
  if p_user_id is null then
    raise exception 'Kullanıcı belirtilmedi.';
  end if;

  if p_minutes is null or p_minutes <= 0 then
    -- 0 veya negatif: susturmayı kaldır.
    delete from public.chat_mutes where user_id = p_user_id;
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, after_data)
    values (auth.uid(), 'chat.unmute', 'auth_user', p_user_id::text, jsonb_build_object('reason', p_reason));
    return jsonb_build_object('ok', true, 'muted', false);
  end if;

  -- 100 yıldan uzun süre = kalıcı ban (muted_until null).
  until := case when p_minutes >= 52560000 then null else now() + make_interval(mins => p_minutes) end;
  insert into public.chat_mutes(user_id, muted_until, reason, created_by)
  values (p_user_id, until, nullif(btrim(p_reason),''), auth.uid())
  on conflict (user_id) do update
    set muted_until = excluded.muted_until, reason = excluded.reason,
        created_by = excluded.created_by, created_at = now();

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, after_data)
  values (auth.uid(), 'chat.mute', 'auth_user', p_user_id::text,
          jsonb_build_object('muted_until', until, 'reason', p_reason));

  return jsonb_build_object('ok', true, 'muted', true, 'muted_until', until);
end;
$$;

/* ===================== RLS ===================== */

alter table public.chat_rooms enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_mutes enable row level security;
alter table public.chat_reports enable row level security;

do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies
    where schemaname='public' and tablename = any(array['chat_rooms','chat_messages','chat_mutes','chat_reports'])
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- Odalar: aktif odalar herkese açık (giriş yapmayan da gündem başlıklarını görür).
create policy chat_rooms_public_read on public.chat_rooms
  for select to anon, authenticated using (is_active = true);
create policy chat_rooms_admin_all on public.chat_rooms
  for all to authenticated
  using (public.is_editorial_admin(null)) with check (public.is_editorial_admin(null));

-- Mesajlar: silinmemiş mesajlar okunabilir; kullanıcı kendi silinmiş mesajını
-- da görür (neden kaybolduğunu anlaması için); moderatör hepsini görür.
create policy chat_messages_public_read on public.chat_messages
  for select to anon, authenticated
  using (
    deleted_at is null
    or user_id = auth.uid()
    or public.is_editorial_admin(null)
  );
-- Yazma: yalnızca kendi adına. Diğer tüm kurallar (doğrulama, mute, oda
-- kilidi, rate limit) trigger'da zorlanır.
create policy chat_messages_own_insert on public.chat_messages
  for insert to authenticated with check (user_id = auth.uid());
create policy chat_messages_admin_all on public.chat_messages
  for all to authenticated
  using (public.is_editorial_admin(null)) with check (public.is_editorial_admin(null));

-- Susturmalar: kullanıcı yalnızca kendi durumunu görebilir (neden
-- yazamadığını anlaması için). Yazma yalnızca RPC üzerinden.
create policy chat_mutes_own_read on public.chat_mutes
  for select to authenticated using (user_id = auth.uid() or public.is_editorial_admin(null));

-- Raporlar: kullanıcı kendi raporunu görür, moderatör hepsini.
create policy chat_reports_own_read on public.chat_reports
  for select to authenticated using (reporter_id = auth.uid() or public.is_editorial_admin(null));
create policy chat_reports_admin_all on public.chat_reports
  for all to authenticated
  using (public.is_editorial_admin(null)) with check (public.is_editorial_admin(null));

/* ===================== GRANT ===================== */

revoke all on public.chat_rooms, public.chat_messages, public.chat_mutes, public.chat_reports from anon;
grant select on public.chat_rooms, public.chat_messages to anon, authenticated;
-- Mesaj yazma dışında istemciye doğrudan yazma yetkisi verilmez;
-- rapor/moderasyon/susturma yalnızca RPC üzerinden yapılır.
grant insert on public.chat_messages to authenticated;
grant select on public.chat_mutes, public.chat_reports to authenticated;

-- PostgreSQL yeni fonksiyonlara VARSAYILAN olarak PUBLIC execute yetkisi verir.
-- security definer fonksiyonlarda bu, yetkisiz rollerin fonksiyonu çağırabilmesi
-- anlamına gelir. Fonksiyonların içinde auth.uid()/rol kontrolü olsa da
-- defense-in-depth gereği önce PUBLIC yetkisi geri alınır, sonra yalnızca
-- gereken role verilir (20260802181000_server_leaderboard.sql ile aynı desen).
revoke all on function public.is_verified_user() from public;
revoke all on function public.is_chat_muted(uuid) from public;
revoke all on function public.report_chat_message(uuid, text, text) from public;
revoke all on function public.moderate_chat_message(uuid, text, text) from public;
revoke all on function public.set_chat_mute(uuid, integer, text) from public;
revoke all on function public.enforce_chat_message_rules() from public;

grant execute on function public.is_verified_user() to anon, authenticated;
grant execute on function public.is_chat_muted(uuid) to authenticated;
grant execute on function public.report_chat_message(uuid, text, text) to authenticated;
grant execute on function public.moderate_chat_message(uuid, text, text) to authenticated;
grant execute on function public.set_chat_mute(uuid, integer, text) to authenticated;

/* ===================== REALTIME ===================== */
-- Realtime bu projede ilk kez kullanılıyor; tablo publication'a eklenmeli.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
    ) then
      execute 'alter publication supabase_realtime add table public.chat_messages';
    end if;
  end if;
end $$;

/* ===================== BAŞLANGIÇ ODALARI ===================== */
-- Lig gündemi odaları; maç odaları uygulama tarafından açılır.
insert into public.chat_rooms(slug, title, topic, kind, league_key, sort_order) values
  ('genel-gundem','Genel Gündem','Türkiye ve Avrupa futbol gündemi','general', null, 10),
  ('super-lig','Süper Lig','Süper Lig haftası, maçlar ve tartışmalar','league','super-lig', 20),
  ('champions-league','Şampiyonlar Ligi','UCL gecelerinin sohbet odası','league','champions-league', 30),
  ('europa-league','UEFA Avrupa Ligi','UEL maçları ve gündemi','league','europa-league', 40),
  ('la-liga','La Liga','İspanya ligi gündemi','league','la-liga', 50),
  ('premier-league','Premier League','İngiltere ligi gündemi','league','premier-league', 60),
  ('transfer','Transfer Gündemi','Resmî transferler, iddialar ve söylentiler','general', null, 70)
on conflict (slug) do nothing;

comment on table public.chat_rooms is 'Gündem sohbet odaları. Lig odaları sabittir, maç odaları uygulama tarafından açılır.';
comment on table public.chat_messages is 'Sohbet mesajları. Yazar adı/takımı sunucu tarafında denormalize edilir; silme yumuşak (deleted_at) yapılır.';
comment on table public.chat_mutes is 'Sohbet susturma kayıtları. muted_until null ise kalıcı yasak.';
comment on table public.chat_reports is 'Kullanıcı mesaj raporları. 4 açık rapor mesajı otomatik gizler.';

commit;

-- GERİ ALMA PLANI (ayrı transaction'da çalıştırılmalı):
--   alter publication supabase_realtime drop table public.chat_messages;
--   drop function if exists public.set_chat_mute(uuid, integer, text);
--   drop function if exists public.moderate_chat_message(uuid, text, text);
--   drop function if exists public.report_chat_message(uuid, text, text);
--   drop function if exists public.enforce_chat_message_rules();
--   drop function if exists public.is_chat_muted(uuid);
--   drop function if exists public.is_verified_user();
--   drop table if exists public.chat_reports;
--   drop table if exists public.chat_mutes;
--   drop table if exists public.chat_messages;
--   drop table if exists public.chat_rooms;
