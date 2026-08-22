-- Gercek PostgreSQL uzerinde esszamanli odul claim yarisini hazirlar.
-- Kullanim: pg_concurrency_test.sh calistirir; bu dosya yalnizca fixture kurar.
\set ON_ERROR_STOP on
delete from public.predict_point_transactions where user_id in (select id from auth.users where email like 'conc-%@test.local');
delete from public.predict_game_sessions where user_id in (select id from auth.users where email like 'conc-%@test.local');
delete from auth.users where email like 'conc-%@test.local';

insert into auth.users (id, email, email_confirmed_at)
values ('11111111-1111-1111-1111-111111111111','conc-1@test.local', now())
on conflict (id) do nothing;

insert into public.predict_game_sessions (id, user_id, guest_session_id, status, nonce, started_at, events)
values
 ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', null, 'started','nonce-A', now(), '[]'::jsonb),
 ('aaaaaaaa-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111', null, 'started','nonce-B', now(), '[]'::jsonb),
 ('aaaaaaaa-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111', null, 'started','nonce-C', now(), '[]'::jsonb),
 ('aaaaaaaa-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111', null, 'started','nonce-D', now(), '[]'::jsonb),
 ('aaaaaaaa-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111', null, 'started','nonce-E', now(), '[]'::jsonb);
