-- pg_supabase_shim.sql ve tum migration'lardan sonra calistirilir.
-- Test transaction sonunda geri alinir; production verisine dokunmaz.
begin;

do $$
declare
  test_user uuid := '11111111-1111-4111-8111-111111111111';
  valid_session uuid;
  fake_session uuid;
  terminal_session uuid;
  skew_session uuid;
  result jsonb;
  valid_events jsonb;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  insert into auth.users(id) values (test_user) on conflict (id) do nothing;
  insert into public.profiles(id, username) values (test_user, 'predict_security_test') on conflict (id) do nothing;

  select jsonb_agg(jsonb_build_object('type','goal','elapsedMs',n * 500) order by n)
  into valid_events from generate_series(1, 10) n;

  insert into public.predict_game_sessions(user_id, status, nonce, started_at, reward_eligible)
  values (test_user, 'started', 'sql-valid-nonce', now() - interval '10 seconds', true)
  returning id into valid_session;

  result := public.claim_predict_game_reward(valid_session, test_user, null, 10, 0,
    'GAME_SUCCESS', 'sql-valid-key', 'sql-valid-nonce', valid_events, 6000);
  if not (result->>'claimed')::boolean then raise exception 'valid_flow_failed: %', result; end if;

  result := public.claim_predict_game_reward(valid_session, test_user, null, 10, 0,
    'GAME_SUCCESS', 'sql-valid-key', 'sql-valid-nonce', valid_events, 6000);
  if result->>'blocked' <> 'already_completed' then raise exception 'duplicate_not_blocked: %', result; end if;

  insert into public.predict_game_sessions(user_id, status, nonce, started_at, reward_eligible)
  values (test_user, 'started', 'sql-fake-nonce', now() - interval '10 seconds', true)
  returning id into fake_session;

  result := public.claim_predict_game_reward(fake_session, test_user, null, 10, 0,
    'GAME_SUCCESS', 'sql-fake-key', 'sql-fake-nonce', '[]'::jsonb, 6000);
  if result->>'blocked' <> 'invalid' then raise exception 'fake_post_not_blocked: %', result; end if;
  if (select status from public.predict_game_sessions where id = fake_session) <> 'invalid' then
    raise exception 'fake_session_not_closed';
  end if;

  insert into public.predict_game_sessions(user_id, status, nonce, started_at, reward_eligible)
  values (test_user, 'started', 'sql-terminal-nonce', now() - interval '10 seconds', true)
  returning id into terminal_session;
  result := public.claim_predict_game_reward(terminal_session, test_user, null, 10, 1,
    'GAME_SUCCESS', 'sql-terminal-key', 'sql-terminal-nonce',
    valid_events || jsonb_build_array(jsonb_build_object('type','miss','elapsedMs',5500)), 6000);
  if result->>'blocked' <> 'invalid' then raise exception 'post_terminal_event_not_blocked: %', result; end if;

  insert into public.predict_game_sessions(user_id, status, nonce, started_at, reward_eligible)
  values (test_user, 'started', 'sql-skew-nonce', now() - interval '60 seconds', true)
  returning id into skew_session;
  result := public.claim_predict_game_reward(skew_session, test_user, null, 10, 0,
    'GAME_SUCCESS', 'sql-skew-key', 'sql-skew-nonce', valid_events, 6000);
  if result->>'blocked' <> 'invalid' then raise exception 'elapsed_skew_not_blocked: %', result; end if;
end $$;

do $$
begin
  if position('pg_advisory_xact_lock' in pg_get_functiondef(
    'public.claim_predict_game_reward(uuid,uuid,text,integer,integer,text,text,text,jsonb,bigint)'::regprocedure)) = 0 then
    raise exception 'daily_claim_lock_missing';
  end if;
end $$;

rollback;
