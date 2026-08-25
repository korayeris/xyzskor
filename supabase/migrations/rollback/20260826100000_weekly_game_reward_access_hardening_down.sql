-- ROLLBACK: 20260826100000_weekly_game_reward_access_hardening.sql
-- Restores the exact client table surface created by
-- 20260806165000_membership_data_foundation.sql.

begin;

drop view if exists public.weekly_games_public;

revoke select (
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
) on table public.weekly_games from anon, authenticated;
grant select on table public.weekly_games to anon, authenticated;

drop policy if exists weekly_entries_own_insert on public.weekly_game_entries;
create policy weekly_entries_own_insert on public.weekly_game_entries
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists weekly_entries_own_update_unlocked on public.weekly_game_entries;
create policy weekly_entries_own_update_unlocked on public.weekly_game_entries
  for update to authenticated using (user_id = auth.uid() and locked_at is null)
  with check (user_id = auth.uid() and locked_at is null);

drop policy if exists reward_claims_own_insert on public.reward_claims;
create policy reward_claims_own_insert on public.reward_claims
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists reward_claims_own_update_pending on public.reward_claims;
create policy reward_claims_own_update_pending on public.reward_claims
  for update to authenticated using (user_id = auth.uid() and status in ('pending', 'identity_check'))
  with check (user_id = auth.uid() and status in ('pending', 'identity_check'));

grant insert, update, delete on table public.weekly_game_entries,
  public.reward_claims to authenticated;

commit;
