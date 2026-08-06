-- Maç sohbet odaları: chat_rooms tablosunda match_id kolonu ve index'i
-- 20260806120000_chat_core.sql ile birlikte geldi, ancak odayı AÇACAK bir yol
-- yoktu: istemciye chat_rooms INSERT yetkisi verilmiyor (yalnızca editoryal
-- admin yazabiliyor). Bu migration, maç merkezinden çağrılabilecek güvenli bir
-- oda açma RPC'si ekler.
--
-- Kurallar:
--  * Oda yalnızca public.matches içinde GERÇEKTEN var olan bir maç için açılır
--    (uydurma match_id ile oda üretilemez).
--  * Yalnızca maç penceresi içinde açılır: kickoff'tan 12 saat önce
--    ile kickoff'tan 6 saat sonra arası. Böylece geçmiş sezonun yüzlerce maçı
--    için çöp oda birikmez.
--  * İptal/ertelenen maçlar için oda açılmaz.
--  * Oda zaten varsa yeniden oluşturulmaz, mevcut id döndürülür (idempotent).

begin;

-- Maç odalarını, oynanma zamanına göre sıralamak ve tekilleştirmek için.
create unique index if not exists chat_rooms_match_uidx
  on public.chat_rooms(match_id) where match_id is not null;

create or replace function public.ensure_match_chat_room(p_match_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_match public.matches;
  existing public.chat_rooms;
  room_slug text;
  room_title text;
  new_room public.chat_rooms;
begin
  if auth.uid() is null then
    raise exception 'Maç sohbetine katılmak için giriş yapmalısın.';
  end if;
  if coalesce(btrim(p_match_id), '') = '' then
    raise exception 'Maç belirtilmedi.';
  end if;

  -- Var olan oda: pencere kontrolü yapmadan döndür (maç bitse de sohbet okunur).
  select * into existing from public.chat_rooms where match_id = p_match_id;
  if existing.id is not null then
    return jsonb_build_object('ok', true, 'room_id', existing.id, 'slug', existing.slug, 'created', false);
  end if;

  select * into target_match from public.matches where id = p_match_id;
  if target_match.id is null then
    raise exception 'Maç bulunamadı.';
  end if;
  if target_match.status in ('iptal','ertelendi') then
    raise exception 'Bu maç için sohbet açılmıyor.';
  end if;
  if now() < target_match.kickoff - interval '12 hours' then
    raise exception 'Maç sohbeti başlama saatinden 12 saat önce açılır.';
  end if;
  if now() > target_match.kickoff + interval '6 hours' then
    raise exception 'Bu maçın sohbet penceresi kapandı.';
  end if;

  room_slug := 'mac-' || regexp_replace(lower(p_match_id), '[^a-z0-9]+', '-', 'g');
  room_title := coalesce(target_match.ev, 'Ev sahibi') || ' - ' || coalesce(target_match.konuk, 'Deplasman');

  insert into public.chat_rooms(slug, title, topic, kind, league_key, match_id, sort_order)
  values (
    room_slug,
    room_title,
    'Maç sohbeti · ' || to_char(target_match.kickoff, 'DD.MM.YYYY HH24:MI'),
    'match',
    null, -- lig anahtari: matches.competition serbest metin oldugu icin
          -- guvenilir slug turetilemez; oda match_id ile benzersizdir.
    p_match_id,
    5
  )
  on conflict (slug) do update set is_active = true, updated_at = now()
  returning * into new_room;

  return jsonb_build_object('ok', true, 'room_id', new_room.id, 'slug', new_room.slug, 'created', true);
end;
$$;

comment on function public.ensure_match_chat_room(text) is
  'Bir maç için sohbet odasını idempotent şekilde açar. Yalnızca gerçek ve maç penceresi içindeki maçlar için çalışır.';

-- PUBLIC varsayılan execute yetkisi geri alınır; yalnızca giriş yapmış
-- kullanıcılar bu RPC'yi çağırabilir (fonksiyon içindeki auth.uid() kontrolüne
-- ek savunma katmanı).
revoke all on function public.ensure_match_chat_room(text) from public;
grant execute on function public.ensure_match_chat_room(text) to authenticated;

commit;

-- GERİ ALMA PLANI:
--   drop function if exists public.ensure_match_chat_room(text);
--   drop index if exists public.chat_rooms_match_uidx;
