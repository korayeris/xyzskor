import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const chatRlsTest = await readFile(
  new URL('./test-tools/chat_rls_test.sql', import.meta.url),
  'utf8',
);
const pgSuite = await readFile(
  new URL('./test-tools/pg_suite.sh', import.meta.url),
  'utf8',
);

assert.match(chatRlsTest, /^\\set ON_ERROR_STOP on$/m,
  'chat RLS SQL must stop at the first failed assertion');
assert.doesNotMatch(chatRlsTest, /^\\set ON_ERROR_STOP off$/m,
  'chat RLS SQL must never disable ON_ERROR_STOP');
assert.match(chatRlsTest, /create or replace function pg_temp\.expect_rejection[\s\S]*execute p_sql[\s\S]*unexpectedly succeeded/i,
  'negative scenarios need an exception-catching unexpected-success guard');
assert.ok(
  (chatRlsTest.match(/select pg_temp\.expect_rejection\(/g) || []).length >= 11,
  'all expected rejection scenarios must use expect_rejection assertions',
);
assert.ok(
  (chatRlsTest.match(/select pg_temp\.assert_true\(/g) || []).length >= 14,
  'positive results must use fail-capable assertions',
);
assert.match(chatRlsTest, /array\['23514'\][\s\S]*array\['23514'\]/,
  'both body validation failures must assert the CHECK-violation SQLSTATE');
assert.match(chatRlsTest, /POLICY MUTATION SELF-TEST[\s\S]*with check \(true\)[\s\S]*mutation_detected[\s\S]*with check \(user_id = auth\.uid\(\)\)/i,
  'the suite must prove its policy guard detects and restores a permissive mutation');
assert.match(chatRlsTest, /begin;[\s\S]*rollback;[\s\S]*PASS: chat\/RLS/i,
  'fixtures and policy mutation must be isolated in a rolled-back transaction');

assert.match(pgSuite, /if psql -q -d "\$DB" -v ON_ERROR_STOP=1 -f "\$DIR\/chat_rls_test\.sql"[\s\S]*else[\s\S]*fail=1[\s\S]*fi/,
  'pg_suite step 3 must convert chat psql nonzero status into suite failure');
assert.doesNotMatch(pgSuite, /grep[^\n]*BEKLENEN/i,
  'pg_suite must not infer chat success from BEKLENEN source/output markers');

console.log('Chat/RLS fail-closed static contract passed.');
