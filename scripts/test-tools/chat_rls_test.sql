-- Chat RLS, validation, rate-limit and moderation behavior acceptance test.
-- Every negative scenario is caught and asserted. Any unexpected success,
-- unexpected SQLSTATE or positive-result mismatch stops psql immediately.

\set ON_ERROR_STOP on
\pset pager off

begin;
set local statement_timeout = '15s';

create or replace function pg_temp.assert_true(p_condition boolean, p_label text)
returns void
language plpgsql
as $assert$
begin
  if p_condition is not true then
    raise exception using
      errcode = 'ZX100',
      message = format('ASSERTION FAILED: %s', p_label);
  end if;
end;
$assert$;

create or replace function pg_temp.expect_rejection(
  p_sql text,
  p_label text,
  p_allowed_sqlstates text[]
)
returns void
language plpgsql
as $expect$
declare
  caught_state text;
  caught_message text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics
      caught_state = returned_sqlstate,
      caught_message = message_text;

    if caught_state = any(p_allowed_sqlstates) then
      return;
    end if;

    raise exception using
      errcode = 'ZX102',
      message = format(
        'ASSERTION FAILED: %s rejected with unexpected SQLSTATE %s (%s)',
        p_label,
        caught_state,
        caught_message
      );
  end;

  raise exception using
    errcode = 'ZX103',
    message = format('ASSERTION FAILED: %s unexpectedly succeeded', p_label);
end;
$expect$;

-- This catalog guard is also exercised by a deliberate permissive-policy
-- mutation at the end of the suite. It checks names, commands, roles and the
-- security-critical WITH CHECK expression rather than merely counting rows.
create or replace function pg_temp.assert_chat_policy_contract()
returns void
language plpgsql
as $policy_contract$
declare
  matching_policies integer;
  total_policies integer;
  own_insert_check text;
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any(array['chat_rooms', 'chat_messages', 'chat_mutes', 'chat_reports'])
      and not c.relrowsecurity
  ) then
    raise exception using errcode = 'ZX101', message = 'CHAT_POLICY_CONTRACT: RLS is disabled';
  end if;

  select count(*)
  into matching_policies
  from (
    values
      ('chat_rooms',    'chat_rooms_public_read',     'SELECT', array['anon', 'authenticated']::text[]),
      ('chat_rooms',    'chat_rooms_admin_all',       'ALL',    array['authenticated']::text[]),
      ('chat_messages', 'chat_messages_public_read',  'SELECT', array['anon', 'authenticated']::text[]),
      ('chat_messages', 'chat_messages_own_insert',   'INSERT', array['authenticated']::text[]),
      ('chat_messages', 'chat_messages_admin_all',    'ALL',    array['authenticated']::text[]),
      ('chat_mutes',    'chat_mutes_own_read',        'SELECT', array['authenticated']::text[]),
      ('chat_reports',  'chat_reports_own_read',      'SELECT', array['authenticated']::text[]),
      ('chat_reports',  'chat_reports_admin_all',     'ALL',    array['authenticated']::text[])
  ) expected(table_name, policy_name, command_name, policy_roles)
  join pg_policies p
    on p.schemaname = 'public'
   and p.tablename = expected.table_name
   and p.policyname = expected.policy_name
   and p.cmd = expected.command_name
   and p.roles::text[] @> expected.policy_roles
   and p.roles::text[] <@ expected.policy_roles;

  if matching_policies <> 8 then
    raise exception using
      errcode = 'ZX101',
      message = format('CHAT_POLICY_CONTRACT: expected 8 exact policies, matched %s', matching_policies);
  end if;

  select count(*)
  into total_policies
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = any(array['chat_rooms', 'chat_messages', 'chat_mutes', 'chat_reports']);

  if total_policies <> 8 then
    raise exception using
      errcode = 'ZX101',
      message = format('CHAT_POLICY_CONTRACT: expected exactly 8 policies, found %s', total_policies);
  end if;

  select p.with_check
  into own_insert_check
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'chat_messages'
    and p.policyname = 'chat_messages_own_insert';

  if regexp_replace(coalesce(own_insert_check, ''), '[[:space:]()]', '', 'g') <> 'user_id=auth.uid' then
    raise exception using
      errcode = 'ZX101',
      message = format(
        'CHAT_POLICY_CONTRACT: chat_messages_own_insert WITH CHECK changed (%s)',
        coalesce(own_insert_check, '<null>')
      );
  end if;
end;
$policy_contract$;

-- Make repeated runs deterministic without leaving test data behind: all
-- fixture cleanup and mutations are rolled back at the end of this session.
delete from public.chat_reports
where reporter_id = any(array[
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid,
  '44444444-4444-4444-4444-444444444444'::uuid
]);
delete from public.chat_messages
where user_id = any(array[
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid,
  '44444444-4444-4444-4444-444444444444'::uuid
]);
delete from public.chat_mutes
where user_id = any(array[
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid,
  '44444444-4444-4444-4444-444444444444'::uuid
]);

insert into auth.users(id, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111', 'verified@test.local', now()),
  ('22222222-2222-2222-2222-222222222222', 'unverified@test.local', null),
  ('33333333-3333-3333-3333-333333333333', 'mod@test.local', now()),
  ('44444444-4444-4444-4444-444444444444', 'other@test.local', now())
on conflict (id) do update
set email = excluded.email,
    email_confirmed_at = excluded.email_confirmed_at;

insert into public.profiles(id, username, team) values
  ('11111111-1111-1111-1111-111111111111', 'DogrulanmisUye', 'Galatasaray'),
  ('22222222-2222-2222-2222-222222222222', 'DogrulanmamisUye', 'Fenerbahce'),
  ('33333333-3333-3333-3333-333333333333', 'Moderator', 'Besiktas'),
  ('44444444-4444-4444-4444-444444444444', 'BaskaUye', 'Trabzonspor')
on conflict (id) do update
set username = excluded.username,
    team = excluded.team;

insert into public.admin_memberships(auth_user_id, role, active)
values ('33333333-3333-3333-3333-333333333333', 'owner', true)
on conflict (auth_user_id) do update
set role = excluded.role,
    active = excluded.active;

update public.chat_rooms
set is_active = true,
    is_locked = false,
    min_account_state = 'verified'
where slug = any(array[
  'genel-gundem',
  'super-lig',
  'champions-league',
  'europa-league',
  'la-liga',
  'premier-league',
  'transfer'
]);

select pg_temp.assert_chat_policy_contract();
select pg_temp.assert_true(
  has_table_privilege('anon', 'public.chat_messages', 'SELECT')
  and not has_table_privilege('anon', 'public.chat_messages', 'INSERT')
  and has_table_privilege('authenticated', 'public.chat_messages', 'INSERT'),
  'chat_messages grants do not match the RLS contract'
);

\echo 'TEST 1: canonical chat rooms exist'
select pg_temp.assert_true(
  (
    select count(*) = 7
    from public.chat_rooms
    where slug = any(array[
      'genel-gundem',
      'super-lig',
      'champions-league',
      'europa-league',
      'la-liga',
      'premier-league',
      'transfer'
    ])
  ),
  'seven canonical chat rooms must exist'
);

\echo 'TEST 2: verified user can insert and server owns author fields'
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.chat_messages(room_id, user_id, body, author_name, author_team, author_verified)
select
  id,
  '11111111-1111-1111-1111-111111111111',
  'chat-rls verified message',
  'ForgedName',
  'ForgedTeam',
  false
from public.chat_rooms
where slug = 'super-lig';
select pg_temp.assert_true(
  (
    select count(*) = 1
      and min(author_name) = 'DogrulanmisUye'
      and min(author_team) = 'Galatasaray'
      and bool_and(author_verified)
    from public.chat_messages
    where body = 'chat-rls verified message'
      and user_id = '11111111-1111-1111-1111-111111111111'
  ),
  'verified message or server-derived author fields are wrong'
);
reset role;

\echo 'TEST 3: unverified user is rejected in verified room'
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.expect_rejection(
  $sql$
    insert into public.chat_messages(room_id, user_id, body)
    select id, '22222222-2222-2222-2222-222222222222', 'chat-rls unverified rejected'
    from public.chat_rooms where slug = 'super-lig'
  $sql$,
  'unverified user insert',
  array['P0001']
);
reset role;

\echo 'TEST 4: user cannot insert on behalf of another user'
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select pg_temp.expect_rejection(
  $sql$
    insert into public.chat_messages(room_id, user_id, body)
    select id, '11111111-1111-1111-1111-111111111111', 'chat-rls forged identity'
    from public.chat_rooms where slug = 'super-lig'
  $sql$,
  'cross-user message insert',
  array['P0001', '42501']
);
reset role;

\echo 'TEST 5: second message inside three seconds is rejected'
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.expect_rejection(
  $sql$
    insert into public.chat_messages(room_id, user_id, body)
    select id, '11111111-1111-1111-1111-111111111111', 'chat-rls too fast'
    from public.chat_rooms where slug = 'super-lig'
  $sql$,
  'three-second rate limit',
  array['P0001']
);
reset role;

\echo 'TEST 6: client cannot forge verification or author name'
update public.chat_rooms set min_account_state = 'any' where slug = 'genel-gundem';
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into public.chat_messages(room_id, user_id, body, author_name, author_verified)
select
  id,
  '22222222-2222-2222-2222-222222222222',
  'chat-rls forged badge',
  'ForgedAdmin',
  true
from public.chat_rooms
where slug = 'genel-gundem';
select pg_temp.assert_true(
  (
    select count(*) = 1
      and min(author_name) = 'DogrulanmamisUye'
      and not bool_or(author_verified)
    from public.chat_messages
    where body = 'chat-rls forged badge'
      and user_id = '22222222-2222-2222-2222-222222222222'
  ),
  'server accepted forged chat identity fields'
);
reset role;

\echo 'TEST 7: regular user cannot write to a locked room'
update public.chat_rooms set is_locked = true where slug = 'transfer';
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select pg_temp.expect_rejection(
  $sql$
    insert into public.chat_messages(room_id, user_id, body)
    select id, '44444444-4444-4444-4444-444444444444', 'chat-rls locked room'
    from public.chat_rooms where slug = 'transfer'
  $sql$,
  'locked-room insert',
  array['P0001']
);
reset role;

\echo 'TEST 8: user cannot report own message'
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.expect_rejection(
  $sql$
    select public.report_chat_message(
      (select id from public.chat_messages where body = 'chat-rls verified message'),
      'spam'
    )
  $sql$,
  'self-report RPC',
  array['P0001']
);
reset role;

\echo 'TEST 9: another user can report the message'
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select pg_temp.assert_true(
  (
    select public.report_chat_message(
      (select id from public.chat_messages where body = 'chat-rls verified message'),
      'spam',
      'chat-rls report'
    ) @> '{"ok": true, "report_count": 1}'::jsonb
  ),
  'report RPC did not return ok=true/report_count=1'
);
select pg_temp.assert_true(
  (
    select count(*) = 1
    from public.chat_reports
    where reporter_id = '44444444-4444-4444-4444-444444444444'
      and message_id = (select id from public.chat_messages where body = 'chat-rls verified message')
      and status = 'open'
  ),
  'successful report did not persist exactly one visible report'
);
reset role;

\echo 'TEST 10: regular user cannot moderate a message'
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select pg_temp.expect_rejection(
  $sql$
    select public.moderate_chat_message(
      (select id from public.chat_messages where body = 'chat-rls verified message'),
      'delete',
      'unauthorized'
    )
  $sql$,
  'unauthorized moderation RPC',
  array['P0001']
);
reset role;

\echo 'TEST 11: moderator can delete and an audit row is written'
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select pg_temp.assert_true(
  (
    select public.moderate_chat_message(
      (select id from public.chat_messages where body = 'chat-rls verified message'),
      'delete',
      'chat-rls moderation'
    ) @> '{"ok": true, "action": "delete"}'::jsonb
  ),
  'moderation RPC did not report a successful delete'
);
select pg_temp.assert_true(
  (
    select count(*) = 1
    from public.audit_logs
    where action = 'chat.delete'
      and entity_type = 'chat_message'
      and actor_id = '33333333-3333-3333-3333-333333333333'
      and entity_id = (
        select id::text
        from public.chat_messages
        where body = 'chat-rls verified message'
      )
  ),
  'moderation did not write exactly one matching audit row'
);
reset role;

\echo 'TEST 12: deleted message visibility is owner/moderator only'
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select pg_temp.assert_true(
  (select count(*) = 0 from public.chat_messages where body = 'chat-rls verified message'),
  'another user can see a deleted message'
);
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.assert_true(
  (
    select count(*) = 1 and bool_and(deleted_at is not null)
    from public.chat_messages
    where body = 'chat-rls verified message'
  ),
  'message owner cannot see the deleted message'
);
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select pg_temp.assert_true(
  (
    select count(*) = 1 and bool_and(deleted_at is not null)
    from public.chat_messages
    where body = 'chat-rls verified message'
  ),
  'moderator cannot see the deleted message'
);
reset role;

\echo 'TEST 13: moderator can mute and muted user cannot post'
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select pg_temp.assert_true(
  (
    select public.set_chat_mute(
      '44444444-4444-4444-4444-444444444444',
      60,
      'chat-rls mute'
    ) @> '{"ok": true, "muted": true}'::jsonb
  ),
  'mute RPC did not report success'
);
select pg_temp.assert_true(
  (
    select count(*) = 1
    from public.chat_mutes
    where user_id = '44444444-4444-4444-4444-444444444444'
      and muted_until > now()
  ),
  'mute RPC did not persist an active mute'
);
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select pg_temp.expect_rejection(
  $sql$
    insert into public.chat_messages(room_id, user_id, body)
    select id, '44444444-4444-4444-4444-444444444444', 'chat-rls muted message'
    from public.chat_rooms where slug = 'genel-gundem'
  $sql$,
  'muted-user insert',
  array['P0001']
);
reset role;

\echo 'TEST 14: regular user cannot mute another user'
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.expect_rejection(
  $sql$
    select public.set_chat_mute(
      '22222222-2222-2222-2222-222222222222',
      60,
      'unauthorized'
    )
  $sql$,
  'unauthorized mute RPC',
  array['P0001']
);
reset role;

\echo 'TEST 15: blank and over-500-character messages are rejected'
-- now() is transaction-stable, so age the earlier fixture explicitly instead
-- of sleeping inside this single rollback-only transaction.
update public.chat_messages
set created_at = now() - interval '4 seconds'
where body = 'chat-rls verified message'
  and user_id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.expect_rejection(
  $sql$
    insert into public.chat_messages(room_id, user_id, body)
    select id, '11111111-1111-1111-1111-111111111111', '   '
    from public.chat_rooms where slug = 'genel-gundem'
  $sql$,
  'blank message constraint',
  array['23514']
);
select pg_temp.expect_rejection(
  $sql$
    insert into public.chat_messages(room_id, user_id, body)
    select id, '11111111-1111-1111-1111-111111111111', repeat('x', 501)
    from public.chat_rooms where slug = 'genel-gundem'
  $sql$,
  'message length constraint',
  array['23514']
);
reset role;

\echo 'TEST 16: anon can read rooms but cannot write messages'
set local role anon;
select pg_temp.assert_true(
  (
    select count(*) = 7
    from public.chat_rooms
    where slug = any(array[
      'genel-gundem',
      'super-lig',
      'champions-league',
      'europa-league',
      'la-liga',
      'premier-league',
      'transfer'
    ])
  ),
  'anon cannot read all canonical active rooms'
);
select pg_temp.expect_rejection(
  $sql$
    insert into public.chat_messages(room_id, user_id, body)
    select id, '11111111-1111-1111-1111-111111111111', 'chat-rls anon write'
    from public.chat_rooms where slug = 'genel-gundem'
  $sql$,
  'anonymous message insert',
  array['42501', 'P0001']
);
reset role;

\echo 'TEST 17: authenticated leaderboard RPC returns the caller row'
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.assert_true(
  exists (
    select 1
    from public.get_leaderboard(1, null, 'week', 10) leaderboard
    where leaderboard.user_id = '11111111-1111-1111-1111-111111111111'
      and leaderboard."position" is not null
  ),
  'leaderboard RPC did not return the authenticated caller'
);
reset role;

\echo 'TEST 18: chat_messages is in the realtime publication'
select pg_temp.assert_true(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ),
  'chat_messages is missing from supabase_realtime publication'
);

\echo 'POLICY MUTATION SELF-TEST: permissive INSERT policy must be detected'
do $mutation$
declare
  mutation_detected boolean := false;
begin
  execute 'drop policy chat_messages_own_insert on public.chat_messages';
  execute $ddl$
    create policy chat_messages_own_insert on public.chat_messages
      for insert to authenticated with check (true)
  $ddl$;

  begin
    perform pg_temp.assert_chat_policy_contract();
  exception when sqlstate 'ZX101' then
    mutation_detected := true;
  end;

  if not mutation_detected then
    raise exception using
      errcode = 'ZX104',
      message = 'ASSERTION FAILED: permissive policy mutation escaped the catalog guard';
  end if;

  execute 'drop policy chat_messages_own_insert on public.chat_messages';
  execute $ddl$
    create policy chat_messages_own_insert on public.chat_messages
      for insert to authenticated with check (user_id = auth.uid())
  $ddl$;
  perform pg_temp.assert_chat_policy_contract();
end;
$mutation$;

rollback;
\echo 'PASS: chat/RLS behavior, result assertions and policy mutation guard'
