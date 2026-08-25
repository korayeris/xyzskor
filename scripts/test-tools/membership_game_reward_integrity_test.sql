-- Run after pg_supabase_shim.sql and all forward migrations.
-- Catalog checks and behavioral checks execute in one rollback-only transaction.
\set ON_ERROR_STOP on
\pset pager off

begin;

do $$
declare
  weekly_entry_policies text[];
  reward_claim_policies text[];
  view_options text[];
begin
  if has_table_privilege('anon', 'public.weekly_games', 'SELECT')
     or has_table_privilege('authenticated', 'public.weekly_games', 'SELECT') then
    raise exception 'weekly_games must not expose table-wide SELECT';
  end if;

  if has_column_privilege('anon', 'public.weekly_games', 'answer_key', 'SELECT')
     or has_column_privilege('authenticated', 'public.weekly_games', 'answer_key', 'SELECT') then
    raise exception 'answer_key is selectable by a client role';
  end if;

  if not has_column_privilege('anon', 'public.weekly_games', 'id', 'SELECT')
     or not has_column_privilege('authenticated', 'public.weekly_games', 'scoring_rules', 'SELECT')
     or not has_table_privilege('anon', 'public.weekly_games_public', 'SELECT')
     or not has_table_privilege('authenticated', 'public.weekly_games_public', 'SELECT') then
    raise exception 'safe weekly-game read surface is incomplete';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'weekly_games_public'
      and column_name in ('answer_key', 'created_by')
  ) then
    raise exception 'weekly_games_public exposes a private column';
  end if;

  select c.reloptions into view_options
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'weekly_games_public';
  if view_options is null
     or not ('security_invoker=true' = any(view_options))
     or not ('security_barrier=true' = any(view_options)) then
    raise exception 'weekly_games_public must be security_invoker + security_barrier';
  end if;

  if has_table_privilege('authenticated', 'public.weekly_game_entries', 'INSERT')
     or has_table_privilege('authenticated', 'public.weekly_game_entries', 'UPDATE')
     or has_table_privilege('authenticated', 'public.weekly_game_entries', 'DELETE')
     or has_table_privilege('authenticated', 'public.reward_claims', 'INSERT')
     or has_table_privilege('authenticated', 'public.reward_claims', 'UPDATE')
     or has_table_privilege('authenticated', 'public.reward_claims', 'DELETE') then
    raise exception 'authenticated retains a direct weekly-entry/reward write grant';
  end if;

  select array_agg(policyname::text order by policyname) into weekly_entry_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'weekly_game_entries';
  if weekly_entry_policies is distinct from array[
    'weekly_entries_admin_all',
    'weekly_entries_own_read'
  ]::text[] then
    raise exception 'unexpected weekly_game_entries policies: %', weekly_entry_policies;
  end if;

  select array_agg(policyname::text order by policyname) into reward_claim_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'reward_claims';
  if reward_claim_policies is distinct from array[
    'reward_claims_admin_all',
    'reward_claims_own_read'
  ]::text[] then
    raise exception 'unexpected reward_claims policies: %', reward_claim_policies;
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.submit_weekly_game_entry(uuid,jsonb,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.submit_weekly_game_entry(uuid,jsonb,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.request_reward_claim(uuid,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.request_reward_claim(uuid,text,text)',
       'EXECUTE'
     ) then
    raise exception 'controlled RPC execute ACL is incorrect';
  end if;
end $$;

insert into auth.users(id, email, email_confirmed_at)
values ('55555555-5555-4555-8555-555555555555', 'integrity@test.local', now())
on conflict (id) do nothing;

insert into public.profiles(id, username, team)
values ('55555555-5555-4555-8555-555555555555', 'integrity_test', 'Diger')
on conflict (id) do nothing;

insert into public.weekly_games(
  id, league_key, season, week, game_type, title, prompt, status,
  opens_at, locks_at, answer_key, scoring_rules
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'super-lig', '2026', 91,
    'legend_quiz', 'Public fixture', 'Question', 'published',
    now() - interval '1 hour', now() + interval '1 hour',
    '{"answer":"secret"}'::jsonb, '{"points":10}'::jsonb
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'super-lig', '2026', 92,
    'legend_quiz', 'Draft fixture', 'Question', 'draft',
    now() - interval '1 hour', now() + interval '1 hour',
    '{"answer":"draft-secret"}'::jsonb, '{"points":10}'::jsonb
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'super-lig', '2026', 93,
    'legend_quiz', 'Locked fixture', 'Question', 'published',
    now() - interval '2 hours', now() - interval '1 hour',
    '{"answer":"locked-secret"}'::jsonb, '{"points":10}'::jsonb
  )
on conflict (id) do nothing;

insert into public.reward_campaigns(
  id, code, title, status, starts_at, ends_at
)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'integrity-test-campaign',
  'Integrity test campaign',
  'active',
  now() - interval '1 day',
  now() + interval '1 day'
)
on conflict (id) do nothing;

set local role anon;
do $$
declare
  visible_count integer;
  leaked boolean := false;
begin
  select count(*) into visible_count
  from public.weekly_games_public
  where id in (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid
  );
  if visible_count <> 1 then
    raise exception 'safe view did not preserve public RLS: %', visible_count;
  end if;

  begin
    perform answer_key
    from public.weekly_games
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
    leaked := true;
  exception when insufficient_privilege then
    null;
  end;
  if leaked then raise exception 'anon read answer_key'; end if;
end $$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '55555555-5555-4555-8555-555555555555';

do $$
declare
  direct_write_succeeded boolean := false;
begin
  begin
    insert into public.weekly_game_entries(
      game_id, user_id, answer_payload, score, scored_at
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      auth.uid(),
      '{"answer":"secret"}'::jsonb,
      999,
      now()
    );
    direct_write_succeeded := true;
  exception when insufficient_privilege then
    null;
  end;
  if direct_write_succeeded then
    raise exception 'authenticated inserted a scored weekly entry directly';
  end if;
end $$;

select public.submit_weekly_game_entry(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  '{"answer":"A"}'::jsonb,
  'integrity-fingerprint'
);

do $$
declare
  direct_update_succeeded boolean := false;
  locked_rpc_succeeded boolean := false;
begin
  begin
    update public.weekly_game_entries
    set score = 999, scored_at = now()
    where game_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
      and user_id = auth.uid();
    direct_update_succeeded := true;
  exception when insufficient_privilege then
    null;
  end;
  if direct_update_succeeded then
    raise exception 'authenticated updated weekly score fields directly';
  end if;

  begin
    perform public.submit_weekly_game_entry(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      '{"answer":"late"}'::jsonb,
      'integrity-fingerprint'
    );
    locked_rpc_succeeded := true;
  exception when others then
    if sqlerrm not like '%kilitlendi%' then raise; end if;
  end;
  if locked_rpc_succeeded then
    raise exception 'controlled entry RPC accepted a locked game';
  end if;
end $$;

select public.request_reward_claim(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'weekly_game',
  (
    select id::text
    from public.weekly_game_entries
    where game_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
      and user_id = auth.uid()
  )
);

do $$
declare
  direct_insert_succeeded boolean := false;
  direct_update_succeeded boolean := false;
begin
  begin
    insert into public.reward_claims(
      campaign_id, user_id, source_type, source_id, status
    ) values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      auth.uid(),
      'manual_admin',
      'forged',
      'identity_check'
    );
    direct_insert_succeeded := true;
  exception when insufficient_privilege then
    null;
  end;
  if direct_insert_succeeded then
    raise exception 'authenticated manufactured a reward claim directly';
  end if;

  begin
    update public.reward_claims
    set status = 'identity_check',
        reviewer_id = auth.uid(),
        review_note = 'forged review'
    where user_id = auth.uid();
    direct_update_succeeded := true;
  exception when insufficient_privilege then
    null;
  end;
  if direct_update_succeeded then
    raise exception 'authenticated changed protected reward fields directly';
  end if;
end $$;

reset role;

do $$
begin
  if not exists (
    select 1
    from public.weekly_game_entries
    where game_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
      and user_id = '55555555-5555-4555-8555-555555555555'
      and answer_payload = '{"answer":"A"}'::jsonb
      and score is null
      and scored_at is null
  ) then
    raise exception 'controlled weekly entry RPC did not persist its safe row';
  end if;

  if not exists (
    select 1
    from public.reward_claims
    where campaign_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and user_id = '55555555-5555-4555-8555-555555555555'
      and source_type = 'weekly_game'
      and status = 'pending'
      and reviewer_id is null
  ) then
    raise exception 'controlled reward claim RPC did not persist its safe row';
  end if;
end $$;

rollback;
