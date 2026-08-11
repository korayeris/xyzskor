-- Hesap panelindeki iki "henüz bağlı değil" placeholder bölümüne gerçek
-- veri katmanı: Takip edilenler (ek takım takibi) ve Bildirim tercihleri.
--
-- Not (bilinçli sınır): notification_preferences burada sadece kullanıcı
-- tercihini KAYDEDER. Gerçek bildirim gönderimi (worker cron + notification_
-- deliveries üretici servisi) ayrı, henüz yapılmamış bir iş — CLAUDE.md'de
-- "Bildirimler — yalnızca şema" olarak zaten işaretli. Bu migration o
-- eksikliği kapatmıyor, ama tercihi doğru şekilde toplamaya başlıyor; sender
-- servisi yazıldığında okunacak gerçek veri burada birikecek.
begin;

create table if not exists public.user_followed_teams (
  user_id uuid not null references auth.users(id) on delete cascade,
  team text not null check (char_length(team) between 2 and 60),
  created_at timestamptz not null default now(),
  primary key (user_id, team)
);

create index if not exists user_followed_teams_user_idx
  on public.user_followed_teams(user_id, created_at desc);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  match_reminders boolean not null default true,
  weekly_digest boolean not null default true,
  reward_alerts boolean not null default true,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_notification_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists notification_preferences_touch on public.notification_preferences;
create trigger notification_preferences_touch
  before update on public.notification_preferences
  for each row execute function public.touch_notification_preferences_updated_at();

-- Kendi bildirim tercihini oku/oluştur; satır yoksa varsayılan (hepsi açık)
-- değerlerle oluşturup döner. Böylece istemci ayrı bir "yoksa oluştur" adımı
-- yazmak zorunda kalmaz.
create or replace function public.get_my_notification_preferences()
returns public.notification_preferences
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row public.notification_preferences;
begin
  if auth.uid() is null then
    raise exception 'authenticated_user_required';
  end if;
  select * into row from public.notification_preferences where user_id = auth.uid();
  if row.user_id is null then
    insert into public.notification_preferences(user_id)
    values (auth.uid())
    returning * into row;
  end if;
  return row;
end;
$$;

create or replace function public.set_my_notification_preferences(
  p_match_reminders boolean,
  p_weekly_digest boolean,
  p_reward_alerts boolean
)
returns public.notification_preferences
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row public.notification_preferences;
begin
  if auth.uid() is null then
    raise exception 'authenticated_user_required';
  end if;
  insert into public.notification_preferences(user_id, match_reminders, weekly_digest, reward_alerts)
  values (auth.uid(), coalesce(p_match_reminders, true), coalesce(p_weekly_digest, true), coalesce(p_reward_alerts, true))
  on conflict (user_id) do update
    set match_reminders = coalesce(p_match_reminders, public.notification_preferences.match_reminders),
        weekly_digest = coalesce(p_weekly_digest, public.notification_preferences.weekly_digest),
        reward_alerts = coalesce(p_reward_alerts, public.notification_preferences.reward_alerts)
  returning * into row;
  return row;
end;
$$;

alter table public.user_followed_teams enable row level security;
alter table public.notification_preferences enable row level security;

create policy user_followed_teams_own_read on public.user_followed_teams
  for select to authenticated using (user_id = auth.uid());
create policy user_followed_teams_own_insert on public.user_followed_teams
  for insert to authenticated with check (user_id = auth.uid());
create policy user_followed_teams_own_delete on public.user_followed_teams
  for delete to authenticated using (user_id = auth.uid());

-- notification_preferences satırlarına doğrudan istemci erişimi yok; okuma/
-- yazma yalnızca yukarıdaki iki security definer RPC üzerinden. Bu, ileride
-- eklenecek gönderim servisinin bu tabloya güvenle service_role ile yazması/
-- okuması için tabloyu "tek giriş noktalı" tutar.
revoke all on public.user_followed_teams from anon;
grant select, insert, delete on public.user_followed_teams to authenticated;
revoke all on public.notification_preferences from anon, authenticated;
revoke all on function public.get_my_notification_preferences() from public;
grant execute on function public.get_my_notification_preferences() to authenticated;
revoke all on function public.set_my_notification_preferences(boolean,boolean,boolean) from public;
grant execute on function public.set_my_notification_preferences(boolean,boolean,boolean) to authenticated;

comment on table public.user_followed_teams is 'Kullanıcının tuttuğu takıma ek olarak takip ettiği takımlar (kişisel akış/hızlı erişim için). Serbestçe eklenir/çıkarılır, sezonluk kısıt yok.';
comment on table public.notification_preferences is 'Kullanıcı bildirim tercihi. Gönderim servisi henüz yok; bu tablo sadece tercihi toplar.';

commit;
