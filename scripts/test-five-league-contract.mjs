import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const CANONICAL_KEYS = ['super-lig', 'premier-league', 'la-liga', 'bundesliga', 'serie-a'];
const CANONICAL_IDS = ['600', '8', '564', '82', '384'];
const FORWARD_MIGRATION = '20260824213000_canonical_five_league_chat_rooms.sql';
const ROLLBACK_MIGRATION = '20260824213000_canonical_five_league_chat_rooms_down.sql';

const [edgeSource, functionEnv, rootEnv, chatSource, forwardSql, rollbackSql, handoffMap] = await Promise.all([
  readFile(new URL('../supabase/functions/football-live/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/.env.example', import.meta.url), 'utf8'),
  readFile(new URL('../.env.example', import.meta.url), 'utf8'),
  readFile(new URL('../assets/js/chat.js', import.meta.url), 'utf8'),
  readFile(new URL(`../supabase/migrations/${FORWARD_MIGRATION}`, import.meta.url), 'utf8'),
  readFile(new URL(`../supabase/migrations/rollback/${ROLLBACK_MIGRATION}`, import.meta.url), 'utf8'),
  readFile(new URL('../docs/KODDAN-DEVAM-HARITASI.md', import.meta.url), 'utf8'),
]);

function quotedValues(source) {
  return [...source.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

function envValue(source, key) {
  return source.match(new RegExp(`^${key}=([^\\r\\n]*)$`, 'm'))?.[1]?.trim() || '';
}

const defaultIdsLiteral = edgeSource.match(/const DEFAULT_SELECTED_LEAGUE_IDS\s*=\s*(\[[^\]]+\])/);
assert.ok(defaultIdsLiteral, 'Edge function default league ID list must exist.');
assert.deepEqual(quotedValues(defaultIdsLiteral[1]), CANONICAL_IDS, 'Edge function default IDs must be the canonical five in order.');

const edgeMapBody = edgeSource.match(/const SELECTED_LEAGUE_IDS_BY_KEY[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1] || '';
assert.ok(edgeMapBody, 'Edge function league-key map must exist.');
CANONICAL_KEYS.forEach((key, index) => {
  assert.match(edgeMapBody, new RegExp(`['"]${key}['"]\\s*:\\s*\\[['"]${CANONICAL_IDS[index]}['"]\\]`), `${key} must map to ${CANONICAL_IDS[index]}.`);
});
assert.match(edgeMapBody, /['"]all['"]\s*:\s*DEFAULT_SELECTED_LEAGUE_IDS/, 'Aggregate scope must reuse the canonical five IDs.');
assert.doesNotMatch(edgeMapBody, /champions-league|europa-league|['"](?:2|5)['"]/, 'Retired UCL/UEL keys and IDs must not remain in the active edge map.');
assert.match(edgeSource, /if \(!target\) return \[\];[\s\S]*return target\.filter\(\(id\) => configured\.includes\(id\)\);/, 'League selection must fail closed for unknown or disabled IDs.');
assert.doesNotMatch(edgeSource, /allowed\.length\s*\?\s*allowed\s*:\s*target/, 'Empty env intersections must never bypass the provider allowlist.');
assert.match(edgeSource, /hasOwnProperty\.call\(SELECTED_LEAGUE_IDS_BY_KEY, requestedLeague\)[\s\S]*Desteklenmeyen lig anahtarı/, 'Unknown league keys must be rejected before provider access.');

const expectedEnvIds = CANONICAL_IDS.join(',');
assert.equal(envValue(functionEnv, 'SPORTMONKS_LEAGUE_IDS'), expectedEnvIds, 'Supabase function env example must match the canonical IDs.');
assert.equal(envValue(rootEnv, 'SPORTMONKS_LEAGUE_IDS'), expectedEnvIds, 'Root env example must document the same canonical IDs.');
assert.doesNotMatch(functionEnv, /Champions League|Europa League|600,2,5,564,8/, 'Function env documentation must not advertise retired competitions.');

const chatAllowlistLiteral = chatSource.match(/const CHAT_LEAGUE_ALLOWLIST\s*=\s*new Set\((\[[^\]]+\])\)/);
assert.ok(chatAllowlistLiteral, 'Chat must expose a current-five fail-safe allowlist.');
assert.deepEqual(quotedValues(chatAllowlistLiteral[1]), CANONICAL_KEYS, 'Chat allowlist must match the canonical league order.');
assert.match(chatSource, /chatState\.rooms\s*=\s*\(data \|\| \[\]\)\.filter\(chatRoomIsInCurrentScope\)/, 'Loaded chat rooms must be filtered through the fail-safe allowlist.');

assert.match(forwardSql, /league_key in \('champions-league', 'europa-league'\)/, 'Forward migration must target both retired rooms.');
assert.match(forwardSql, /set is_active = false[\s\S]*champions-league[\s\S]*europa-league/, 'Forward migration must deactivate retired rooms.');
assert.match(forwardSql, /\('bundesliga',[\s\S]*'bundesliga', true[\s\S]*\('serie-a',[\s\S]*'serie-a', true/, 'Forward migration must upsert active Bundesliga and Serie A rooms.');
assert.match(forwardSql, /on conflict \(slug\) do update[\s\S]*is_active = true/, 'Room upsert must reactivate an existing canonical room.');
assert.match(forwardSql, /^begin;[\s\S]*commit;\s*$/m, 'Forward migration must be transactional.');

assert.match(rollbackSql, /set is_active = false[\s\S]*league_key in \('bundesliga', 'serie-a'\)/, 'Rollback must preserve but deactivate new rooms.');
assert.match(rollbackSql, /\('lig-champions-league',[\s\S]*'champions-league', true[\s\S]*\('lig-europa-league',[\s\S]*'europa-league', true/, 'Rollback must recreate retired rooms if they are missing.');
assert.match(rollbackSql, /on conflict \(slug\) do update[\s\S]*is_active = excluded\.is_active/, 'Rollback room restoration must be idempotent.');
assert.match(rollbackSql, /set is_active = true[\s\S]*champions-league[\s\S]*europa-league/, 'Rollback must restore retired rooms to their prior active state.');
assert.match(rollbackSql, /^begin;[\s\S]*commit;\s*$/m, 'Rollback migration must be transactional.');

const supportedLine = handoffMap.split(/\r?\n/).find((line) => line.startsWith('Desteklenen lig anahtarları:')) || '';
CANONICAL_KEYS.forEach((key) => assert.ok(supportedLine.includes(`\`${key}\``), `Continuation map must list ${key}.`));
assert.ok(supportedLine.includes(expectedEnvIds), 'Continuation map must publish the canonical provider ID order.');
assert.doesNotMatch(supportedLine, /champions-league|europa-league/, 'Continuation map must not list retired competitions as supported.');

console.log('Canonical five-league contract check passed.');
