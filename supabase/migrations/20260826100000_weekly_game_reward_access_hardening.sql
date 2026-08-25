-- Weekly game and reward access hardening.
--
-- Historical membership migrations intentionally remain unchanged. This
-- forward-only repair makes the public game contract explicit:
--   * answer_key is never selectable by anon/authenticated,
--   * public game reads use a safe projection,
--   * entry and reward writes are possible only through controlled RPC/server
--     paths, never through direct PostgREST table writes.

begin;

-- A table-level SELECT grant exposes every current and future column. Replace
-- it with an explicit allowlist and publish the stable PostgREST contract as a
-- security-invoker view so the base weekly_games RLS policy still applies.
revoke select on table public.weekly_games from public, anon, authenticated;
grant select (
  id,
  league_key,
  season,
  week,
  game_type,
  title,
  prompt,
  status,
  opens_at,
  locks_at,
  closes_at,
  source_refs,
  scoring_rules,
  created_at,
  updated_at
) on table public.weekly_games to anon, authenticated;

create or replace view public.weekly_games_public
with (security_invoker = true, security_barrier = true)
as
select
  id,
  league_key,
  season,
  week,
  game_type,
  title,
  prompt,
  status,
  opens_at,
  locks_at,
  closes_at,
  source_refs,
  scoring_rules,
  created_at,
  updated_at
from public.weekly_games
where status in ('published', 'locked', 'scored', 'archived');

revoke all on table public.weekly_games_public from public, anon, authenticated;
grant select on table public.weekly_games_public to anon, authenticated;

comment on view public.weekly_games_public is
  'Public weekly-game projection. Deliberately excludes answer_key and created_by; base-table RLS remains active through security_invoker.';

-- The SECURITY DEFINER submit_weekly_game_entry RPC validates publication and
-- opening/locking timestamps. Direct table grants and permissive own-write
-- policies bypassed those checks and also allowed callers to set score fields.
drop policy if exists weekly_entries_own_insert on public.weekly_game_entries;
drop policy if exists weekly_entries_own_update_unlocked on public.weekly_game_entries;
revoke insert, update, delete on table public.weekly_game_entries
  from public, anon, authenticated;
grant select on table public.weekly_game_entries to authenticated;

-- Reward creation/update is likewise server/RPC-owned. In particular, clients
-- must not manufacture manual_admin claims or change reviewer/status fields.
drop policy if exists reward_claims_own_insert on public.reward_claims;
drop policy if exists reward_claims_own_update_pending on public.reward_claims;
revoke insert, update, delete on table public.reward_claims
  from public, anon, authenticated;
grant select on table public.reward_claims to authenticated;

-- Reassert the only authenticated write entry points after tightening table
-- ACLs. Both functions derive user_id from auth.uid() and are SECURITY DEFINER.
revoke all on function public.submit_weekly_game_entry(uuid, jsonb, text)
  from public, anon;
grant execute on function public.submit_weekly_game_entry(uuid, jsonb, text)
  to authenticated;

revoke all on function public.request_reward_claim(uuid, text, text)
  from public, anon;
grant execute on function public.request_reward_claim(uuid, text, text)
  to authenticated;

commit;

-- Rollback: supabase/migrations/rollback/20260826100000_weekly_game_reward_access_hardening_down.sql
