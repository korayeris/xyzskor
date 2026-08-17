-- Predict mini oyunu sonucunu nonce ve zaman damgali olaylarla sunucuda dogrular.
-- Eski migration degistirilmez; bu migration mevcut kurulumu geriye uyumlu bicimde sertlestirir.
begin;

alter table public.predict_game_sessions add column if not exists nonce text;
alter table public.predict_game_sessions add column if not exists events jsonb not null default '[]'::jsonb;

alter table public.predict_game_sessions drop constraint if exists predict_game_sessions_status_check;
alter table public.predict_game_sessions add constraint predict_game_sessions_status_check
  check (status in ('started','completed','game_success','game_over','training','reward_claimed','reward_blocked_daily_limit','invalid'));
alter table public.predict_game_sessions drop constraint if exists predict_game_sessions_events_check;
alter table public.predict_game_sessions add constraint predict_game_sessions_events_check
  check (jsonb_typeof(events) = 'array' and jsonb_array_length(events) <= 15);

create unique index if not exists predict_game_sessions_nonce_uidx
  on public.predict_game_sessions(nonce) where nonce is not null;

create or replace function public.claim_predict_game_reward(
  p_session_id uuid,
  p_user_id uuid,
  p_guest_session_id text,
  p_goals integer,
  p_misses integer,
  p_final_state text,
  p_idempotency_key text,
  p_nonce text,
  p_events jsonb,
  p_elapsed_ms bigint
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
  event_row jsonb;
  event_time numeric;
  previous_time numeric := 0;
  goal_count integer := 0;
  miss_count integer := 0;
  valid_result boolean := true;
  terminal_reached boolean := false;
  event_index integer := 0;
begin
  if p_user_id is null or p_session_id is null then
    raise exception 'Kimlik ve oyun oturumu gereklidir.';
  end if;
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and auth.uid() is distinct from p_user_id then
    raise exception 'Bu oyun oturumu size ait degil.';
  end if;
  if p_goals is null or p_goals < 0 or p_goals > 10
     or p_misses is null or p_misses < 0 or p_misses > 5
     or p_final_state not in ('GAME_SUCCESS','GAME_OVER') then
    raise exception 'Oyun sonucu gecersiz.';
  end if;

  select * into target from public.predict_game_sessions
  where id = p_session_id for update;

  if target.id is null then
    raise exception 'Oyun oturumu bulunamadi.';
  end if;
  if target.user_id is not null and target.user_id <> p_user_id then
    raise exception 'Bu oyun oturumu size ait degil.';
  end if;
  if target.user_id is null and coalesce(target.guest_session_id,'') <> coalesce(p_guest_session_id,'') then
    raise exception 'Bu oyun oturumu size ait degil.';
  end if;
  if target.status <> 'started' then
    return jsonb_build_object('claimed', false, 'points', 0, 'blocked', 'already_completed');
  end if;

  valid_result := target.nonce is not null and target.nonce = p_nonce
    and p_elapsed_ms >= 2500
    and abs((extract(epoch from now() - target.started_at) * 1000)::bigint - p_elapsed_ms) <= 10000
    and jsonb_typeof(p_events) = 'array'
    and jsonb_array_length(p_events) = p_goals + p_misses
    and jsonb_array_length(p_events) <= 15;

  if valid_result then
    for event_row in select value from jsonb_array_elements(p_events)
    loop
      event_index := event_index + 1;
      if event_row->>'type' not in ('goal','miss')
         or jsonb_typeof(event_row->'elapsedMs') <> 'number' then
        valid_result := false;
        exit;
      end if;
      event_time := (event_row->>'elapsedMs')::numeric;
      if event_time - previous_time < 120
         or event_time > p_elapsed_ms then
        valid_result := false;
        exit;
      end if;
      previous_time := event_time;
      if event_row->>'type' = 'goal' then goal_count := goal_count + 1;
      else miss_count := miss_count + 1;
      end if;
      if goal_count = 10 or miss_count = 5 then
        terminal_reached := true;
        valid_result := event_index = jsonb_array_length(p_events)
          and ((goal_count = 10 and miss_count < 5 and p_final_state = 'GAME_SUCCESS')
            or (miss_count = 5 and goal_count < 10 and p_final_state = 'GAME_OVER'));
        exit;
      end if;
    end loop;
    valid_result := valid_result and terminal_reached and goal_count = p_goals and miss_count = p_misses;
  end if;

  if not coalesce(valid_result, false) then
    update public.predict_game_sessions
    set status = 'invalid', finished_at = now(), events = coalesce(p_events, '[]'::jsonb), updated_at = now()
    where id = p_session_id;
    return jsonb_build_object('claimed', false, 'points', 0, 'blocked', 'invalid');
  end if;

  points := least(p_goals * 5, 50);
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || today::text, 0));
  update public.predict_game_sessions
  set user_id = p_user_id, status = 'completed', goals = p_goals, misses = p_misses,
      points_earned = points, finished_at = now(), events = p_events,
      idempotency_key = coalesce(idempotency_key, p_idempotency_key), updated_at = now()
  where id = p_session_id returning * into target;

  if exists (select 1 from public.predict_game_sessions
    where user_id = p_user_id and reward_claimed and reward_date = today and id <> p_session_id) then
    update public.predict_game_sessions set status = 'reward_blocked_daily_limit',
      reward_eligible = false, updated_at = now() where id = p_session_id;
    return jsonb_build_object('claimed', false, 'points', points, 'blocked', 'daily_limit');
  end if;

  insert into public.predict_point_transactions(user_id, amount, type, source, source_id, idempotency_key, metadata)
  values (p_user_id, points, 'game_reward', 'predict_mini_game', p_session_id,
    coalesce(nullif(p_idempotency_key,''), p_session_id::text),
    jsonb_build_object('goals', p_goals, 'misses', p_misses, 'final_state', p_final_state))
  on conflict (idempotency_key) do update set metadata = public.predict_point_transactions.metadata
  returning * into claimed;

  update public.predict_game_sessions set status = 'reward_claimed', reward_eligible = true,
    reward_claimed = true, rewarded_at = now(), reward_date = today, updated_at = now()
  where id = p_session_id;
  return jsonb_build_object('claimed', true, 'points', claimed.amount, 'transaction_id', claimed.id);
end;
$$;

revoke all on function public.claim_predict_game_reward(uuid,uuid,text,integer,integer,text,text) from public, service_role;
drop function if exists public.claim_predict_game_reward(uuid,uuid,text,integer,integer,text,text,text,jsonb);
revoke all on function public.claim_predict_game_reward(uuid,uuid,text,integer,integer,text,text,text,jsonb,bigint) from public;
grant execute on function public.claim_predict_game_reward(uuid,uuid,text,integer,integer,text,text,text,jsonb,bigint) to authenticated, service_role;

comment on column public.predict_game_sessions.nonce is 'Sunucunun uretdigi tekil oyun dogrulama degeri.';
comment on column public.predict_game_sessions.events is 'Gol ve kacirma olaylarinin zaman damgali, dogrulanmis listesi.';
comment on function public.claim_predict_game_reward(uuid,uuid,text,integer,integer,text,text,text,jsonb,bigint)
  is 'Nonce, sure, olay araligi, sahiplik ve tekrar tamamlama kontrolleriyle odulu atomik verir.';

commit;

-- GERI ALMA PLANI (ayri transaction): yeni function overload ve nonce indexini kaldir;
-- events/nonce kolonlarini ancak yeni Worker geri alindiktan ve veri yedeklendikten sonra kaldir;
-- eski function icin service_role execute yetkisini yeniden ver ve status constraintini onceki listeyle kur.
-- KALAN RISK: Nonce ve istemci olay kaydi fiziksel oyunu kriptografik olarak kanitlamaz.
-- Daha guclu koruma icin her atista tek kullanimlik sunucu challenge protokolu ayri backlog maddesidir.
