-- XYZSKOR Predict mini oyun puan ledger/session katmani.
-- Destructive degildir; mevcut tahmin, liderlik ve haftalik oyun tablolarini genisletmeden
-- mini oyuna ozel server-authoritative odul akisini ekler.

begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.profiles add column if not exists analytics_user_id uuid not null default gen_random_uuid();
create unique index if not exists profiles_analytics_user_id_uidx on public.profiles(analytics_user_id);

create table if not exists public.predict_game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  guest_session_id text,
  status text not null default 'started'
    check (status in ('started','completed','game_success','game_over','training','reward_claimed','reward_blocked_daily_limit')),
  goals integer not null default 0 check (goals between 0 and 10),
  misses integer not null default 0 check (misses between 0 and 5),
  points_earned integer not null default 0 check (points_earned between 0 and 50),
  reward_eligible boolean not null default false,
  reward_claimed boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rewarded_at timestamptz,
  reward_date date,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (points_earned = least(goals * 5, 50)),
  check (finished_at is null or finished_at >= started_at)
);

create index if not exists predict_game_sessions_user_idx on public.predict_game_sessions(user_id, started_at desc);
create index if not exists predict_game_sessions_guest_idx on public.predict_game_sessions(guest_session_id, started_at desc) where guest_session_id is not null;
create unique index if not exists predict_game_sessions_idempotency_uidx
  on public.predict_game_sessions(idempotency_key)
  where idempotency_key is not null;
create unique index if not exists predict_game_sessions_daily_reward_uidx
  on public.predict_game_sessions(user_id, reward_date)
  where reward_claimed and user_id is not null and reward_date is not null;

create table if not exists public.predict_point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount between 0 and 50),
  type text not null check (type in ('game_reward','admin_adjustment')),
  source text not null check (source in ('predict_mini_game','admin')),
  source_id uuid,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists predict_point_transactions_user_idx on public.predict_point_transactions(user_id, created_at desc);
create unique index if not exists predict_point_transactions_idempotency_uidx on public.predict_point_transactions(idempotency_key);
create unique index if not exists predict_point_transactions_source_uidx
  on public.predict_point_transactions(source, source_id)
  where source_id is not null;

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  event_uuid uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  analytics_user_id uuid,
  name text not null check (name ~ '^[a-zA-Z0-9_:-]{1,64}$'),
  properties jsonb not null default '{}'::jsonb,
  user_agent_hash text,
  created_at timestamptz not null default now(),
  unique(event_uuid)
);

create index if not exists analytics_events_name_time_idx on public.analytics_events(name, created_at desc);
create index if not exists analytics_events_user_idx on public.analytics_events(user_id, created_at desc) where user_id is not null;

alter table public.predict_game_sessions enable row level security;
alter table public.predict_point_transactions enable row level security;
alter table public.analytics_events enable row level security;

do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies
    where schemaname='public' and tablename = any(array[
      'predict_game_sessions','predict_point_transactions','analytics_events'
    ])
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

create policy predict_game_sessions_own_read on public.predict_game_sessions
  for select to authenticated using (user_id = auth.uid());

create policy predict_point_transactions_own_read on public.predict_point_transactions
  for select to authenticated using (user_id = auth.uid());

create policy analytics_events_admin_read on public.analytics_events
  for select to authenticated using (public.is_admin());

revoke all on public.predict_game_sessions, public.predict_point_transactions, public.analytics_events from anon;
revoke all on public.predict_game_sessions, public.predict_point_transactions, public.analytics_events from authenticated;
grant select on public.predict_game_sessions, public.predict_point_transactions to authenticated;
grant select on public.analytics_events to authenticated;

create or replace function public.claim_predict_game_reward(
  p_session_id uuid,
  p_user_id uuid,
  p_guest_session_id text,
  p_goals integer,
  p_misses integer,
  p_final_state text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.predict_game_sessions;
  points integer;
  today date := (now() at time zone 'UTC')::date;
  claimed public.predict_point_transactions;
begin
  if p_user_id is null then
    raise exception 'authenticated_user_required';
  end if;
  if p_session_id is null then
    raise exception 'session_required';
  end if;
  if p_goals is null or p_goals < 0 or p_goals > 10 then
    raise exception 'invalid_goals';
  end if;
  if p_misses is null or p_misses < 0 or p_misses > 5 then
    raise exception 'invalid_misses';
  end if;
  if p_final_state not in ('GAME_SUCCESS','GAME_OVER') then
    raise exception 'invalid_final_state';
  end if;

  points := least(p_goals * 5, 50);

  select * into target
  from public.predict_game_sessions
  where id = p_session_id
  for update;

  if target.id is null then
    raise exception 'session_not_found';
  end if;
  if target.user_id is not null and target.user_id <> p_user_id then
    raise exception 'session_owner_mismatch';
  end if;
  if target.user_id is null and coalesce(target.guest_session_id,'') <> coalesce(p_guest_session_id,'') then
    raise exception 'guest_session_mismatch';
  end if;

  update public.predict_game_sessions
  set user_id = p_user_id,
      status = case when reward_claimed then status else 'completed' end,
      goals = p_goals,
      misses = p_misses,
      points_earned = points,
      finished_at = coalesce(finished_at, now()),
      idempotency_key = coalesce(idempotency_key, p_idempotency_key),
      updated_at = now()
  where id = p_session_id
  returning * into target;

  if target.reward_claimed then
    return jsonb_build_object('claimed', true, 'points', target.points_earned, 'duplicate', true);
  end if;

  if exists (
    select 1 from public.predict_game_sessions
    where user_id = p_user_id
      and reward_claimed
      and reward_date = today
      and id <> p_session_id
  ) then
    update public.predict_game_sessions
    set status = 'reward_blocked_daily_limit',
        reward_eligible = false,
        updated_at = now()
    where id = p_session_id;
    return jsonb_build_object('claimed', false, 'points', points, 'blocked', 'daily_limit');
  end if;

  insert into public.predict_point_transactions(user_id, amount, type, source, source_id, idempotency_key, metadata)
  values (
    p_user_id,
    points,
    'game_reward',
    'predict_mini_game',
    p_session_id,
    coalesce(nullif(p_idempotency_key,''), p_session_id::text),
    jsonb_build_object('goals', p_goals, 'misses', p_misses, 'final_state', p_final_state)
  )
  on conflict (idempotency_key) do update
    set metadata = public.predict_point_transactions.metadata
  returning * into claimed;

  update public.predict_game_sessions
  set status = 'reward_claimed',
      reward_eligible = true,
      reward_claimed = true,
      rewarded_at = now(),
      reward_date = today,
      updated_at = now()
  where id = p_session_id;

  return jsonb_build_object('claimed', true, 'points', claimed.amount, 'transaction_id', claimed.id);
end;
$$;

revoke all on function public.claim_predict_game_reward(uuid,uuid,text,integer,integer,text,text) from public;
grant execute on function public.claim_predict_game_reward(uuid,uuid,text,integer,integer,text,text) to service_role;

comment on table public.predict_game_sessions is 'Predict mini futbol oyunu session kayitlari; odul alanlari yalniz server tarafindan guncellenir.';
comment on table public.predict_point_transactions is 'Predict puanlari icin append-only ledger. Browser insert/update/delete yetkisi yoktur.';
comment on table public.analytics_events is 'Worker tarafindan sanitize edilmis urun analitik olaylari. Browser dogrudan insert yapamaz.';
comment on function public.claim_predict_game_reward(uuid,uuid,text,integer,integer,text,text) is 'Mini oyun sonucunu dogrular, gunluk limit ve idempotency ile Predict puanini atomik claim eder.';

commit;
