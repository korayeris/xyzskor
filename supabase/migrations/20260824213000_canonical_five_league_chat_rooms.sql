-- Chat league rooms follow the same five-competition contract as football APIs.
-- Retired UEFA package rooms are preserved for audit/message history, but they
-- are no longer selectable. This migration is idempotent and data preserving.

begin;

update public.chat_rooms
set is_active = false,
    updated_at = now()
where kind = 'league'
  and league_key in ('champions-league', 'europa-league');

insert into public.chat_rooms (
  slug, title, topic, kind, league_key, is_active, is_locked,
  min_account_state, sort_order, updated_at
)
values
  ('bundesliga', 'Bundesliga', 'Almanya ligi maçları ve gündemi', 'league', 'bundesliga', true, false, 'verified', 50, now()),
  ('serie-a', 'Serie A', 'İtalya ligi maçları ve gündemi', 'league', 'serie-a', true, false, 'verified', 60, now())
on conflict (slug) do update
set title = excluded.title,
    topic = excluded.topic,
    kind = 'league',
    league_key = excluded.league_key,
    is_active = true,
    is_locked = false,
    min_account_state = 'verified',
    sort_order = excluded.sort_order,
    updated_at = now();

-- Keep the visible order equal to the canonical provider/API order.
update public.chat_rooms
set is_active = true,
    sort_order = case league_key
      when 'super-lig' then 20
      when 'premier-league' then 30
      when 'la-liga' then 40
      when 'bundesliga' then 50
      when 'serie-a' then 60
    end,
    updated_at = now()
where kind = 'league'
  and league_key in ('super-lig', 'premier-league', 'la-liga', 'bundesliga', 'serie-a');

commit;
