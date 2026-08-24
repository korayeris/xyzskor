-- GERİ ALMA: 20260824213000_canonical_five_league_chat_rooms.sql
-- Mesaj geçmişini korumak için yeni odalar silinmez; pasif duruma alınır.

begin;

update public.chat_rooms
set is_active = false,
    updated_at = now()
where kind = 'league'
  and league_key in ('bundesliga', 'serie-a');

insert into public.chat_rooms (
  slug,
  title,
  topic,
  kind,
  league_key,
  is_active,
  is_locked,
  min_account_state,
  sort_order,
  updated_at
)
values
  ('lig-champions-league', 'Şampiyonlar Ligi', 'Şampiyonlar Ligi maçları ve gündemi', 'league', 'champions-league', true, false, 'verified', 30, now()),
  ('lig-europa-league', 'Avrupa Ligi', 'Avrupa Ligi maçları ve gündemi', 'league', 'europa-league', true, false, 'verified', 40, now())
on conflict (slug) do update
set title = excluded.title,
    topic = excluded.topic,
    kind = excluded.kind,
    league_key = excluded.league_key,
    is_active = excluded.is_active,
    is_locked = excluded.is_locked,
    min_account_state = excluded.min_account_state,
    sort_order = excluded.sort_order,
    updated_at = excluded.updated_at;

update public.chat_rooms
set is_active = true,
    sort_order = case league_key
      when 'super-lig' then 20
      when 'champions-league' then 30
      when 'europa-league' then 40
      when 'la-liga' then 50
      when 'premier-league' then 60
    end,
    updated_at = now()
where kind = 'league'
  and league_key in ('super-lig', 'champions-league', 'europa-league', 'la-liga', 'premier-league');

commit;
