import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const forward = await readFile(new URL(
  '../supabase/migrations/20260826100000_weekly_game_reward_access_hardening.sql',
  import.meta.url,
), 'utf8');
const rollback = await readFile(new URL(
  '../supabase/migrations/rollback/20260826100000_weekly_game_reward_access_hardening_down.sql',
  import.meta.url,
), 'utf8');
const dbTest = await readFile(new URL(
  './test-tools/membership_game_reward_integrity_test.sql',
  import.meta.url,
), 'utf8');
const dbSuite = await readFile(new URL('./test-tools/pg_suite.sh', import.meta.url), 'utf8');

const publicView = forward.match(
  /create or replace view public\.weekly_games_public[\s\S]*?\bas\s+select([\s\S]*?)from public\.weekly_games/i,
);
assert.ok(publicView, 'safe weekly_games_public view must exist');
assert.doesNotMatch(publicView[1], /\banswer_key\b|\bcreated_by\b/i,
  'safe weekly game view must exclude private columns');
assert.match(forward, /security_invoker\s*=\s*true/i,
  'safe weekly game view must preserve caller RLS');
assert.match(forward, /revoke select on table public\.weekly_games from public, anon, authenticated/i,
  'table-wide weekly_games SELECT must be revoked');
const safeColumnGrant = forward.match(
  /grant select \(([\s\S]*?)\) on table public\.weekly_games to anon, authenticated/i,
);
assert.ok(safeColumnGrant, 'weekly_games must expose an explicit safe column allowlist');
assert.doesNotMatch(safeColumnGrant[1], /\banswer_key\b|\bcreated_by\b/i,
  'weekly_games client column grant must exclude private columns');

for (const table of ['weekly_game_entries', 'reward_claims']) {
  assert.match(forward, new RegExp(
    `revoke insert, update, delete on table public\\.${table}[\\s\\S]*?from public, anon, authenticated`,
    'i',
  ), `${table} direct client writes must be revoked`);
}
for (const policy of [
  'weekly_entries_own_insert',
  'weekly_entries_own_update_unlocked',
  'reward_claims_own_insert',
  'reward_claims_own_update_pending',
]) {
  assert.match(forward, new RegExp(`drop policy if exists ${policy}`, 'i'),
    `${policy} permissive policy must be removed`);
  assert.match(rollback, new RegExp(`create policy ${policy}`, 'i'),
    `${policy} must be restored by rollback`);
}

assert.match(forward, /grant execute on function public\.submit_weekly_game_entry\(uuid, jsonb, text\)[\s\S]*?to authenticated/i,
  'controlled weekly entry RPC must remain executable by authenticated');
assert.match(forward, /grant execute on function public\.request_reward_claim\(uuid, text, text\)[\s\S]*?to authenticated/i,
  'controlled reward claim RPC must remain executable by authenticated');
assert.match(rollback, /drop view if exists public\.weekly_games_public/i,
  'rollback must remove the safe projection');
assert.match(rollback, /grant select on table public\.weekly_games to anon, authenticated/i,
  'rollback must restore the historical weekly_games table grant');
assert.match(rollback, /grant insert, update, delete on table public\.weekly_game_entries,[\s\S]*?public\.reward_claims to authenticated/i,
  'rollback must restore historical client write grants');

for (const contract of [
  /has_column_privilege\('anon',[\s\S]*?'answer_key',[\s\S]*?'SELECT'\)/i,
  /has_table_privilege\('authenticated',[\s\S]*?'public\.weekly_game_entries',[\s\S]*?'INSERT'\)/i,
  /has_table_privilege\('authenticated',[\s\S]*?'public\.reward_claims',[\s\S]*?'UPDATE'\)/i,
  /public\.submit_weekly_game_entry\(/i,
  /public\.request_reward_claim\(/i,
  /controlled weekly entry RPC did not persist its safe row/i,
  /controlled reward claim RPC did not persist its safe row/i,
]) {
  assert.match(dbTest, contract, `database acceptance contract missing: ${contract}`);
}
assert.match(dbSuite, /membership_game_reward_integrity_test\.sql/,
  'PostgreSQL suite must execute membership integrity acceptance tests');

console.log('Membership weekly-game/reward integrity static contract passed.');
