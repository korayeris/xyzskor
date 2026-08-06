-- Chat sisteminin RLS, doğrulama, rate limit ve moderasyon kurallarının
-- gerçek PostgreSQL üzerinde davranış testi.
-- Her blok bir senaryoyu test eder ve BEKLENEN/GERÇEKLEŞEN yazar.

\set ON_ERROR_STOP off
\pset pager off

-- Test kullanıcıları
insert into auth.users(id, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111','verified@test.local', now()),
  ('22222222-2222-2222-2222-222222222222','unverified@test.local', null),
  ('33333333-3333-3333-3333-333333333333','mod@test.local', now()),
  ('44444444-4444-4444-4444-444444444444','other@test.local', now())
on conflict (id) do nothing;

insert into public.profiles(id, username, team) values
  ('11111111-1111-1111-1111-111111111111','DogrulanmisUye','Galatasaray'),
  ('22222222-2222-2222-2222-222222222222','DogrulanmamisUye','Fenerbahçe'),
  ('33333333-3333-3333-3333-333333333333','Moderator','Beşiktaş'),
  ('44444444-4444-4444-4444-444444444444','BaskaUye','Trabzonspor')
on conflict (id) do update set username=excluded.username, team=excluded.team;

-- Moderatör rolü
insert into public.admin_memberships(auth_user_id, role, active)
values ('33333333-3333-3333-3333-333333333333','owner', true)
on conflict (auth_user_id) do nothing;

\echo ''
\echo '=========== TEST 1: Odalar olusturuldu mu? ==========='
select count(*) as oda_sayisi, 'BEKLENEN: 7' as beklenen from public.chat_rooms;

\echo ''
\echo '=========== TEST 2: Dogrulanmis kullanici mesaj yazabilir (BEKLENEN: BASARILI) ==========='
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.chat_messages(room_id, user_id, body)
  select id, '11111111-1111-1111-1111-111111111111', 'Merhaba, bu dogrulanmis bir mesaj.'
  from public.chat_rooms where slug='super-lig';
\echo '--> Yazar alanlari sunucuda dolduruldu mu?'
reset role;
select author_name, author_team, author_verified, left(body,30) as body
from public.chat_messages order by created_at desc limit 1;

\echo ''
\echo '=========== TEST 3: Dogrulanmamis kullanici yazamaz (BEKLENEN: HATA) ==========='
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into public.chat_messages(room_id, user_id, body)
  select id, '22222222-2222-2222-2222-222222222222', 'Dogrulanmamis deneme'
  from public.chat_rooms where slug='super-lig';
reset role;

\echo ''
\echo '=========== TEST 4: Baskasi adina mesaj yazilamaz (BEKLENEN: HATA) ==========='
set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
insert into public.chat_messages(room_id, user_id, body)
  select id, '11111111-1111-1111-1111-111111111111', 'Sahte kimlik denemesi'
  from public.chat_rooms where slug='super-lig';
reset role;

\echo ''
\echo '=========== TEST 5: Rate limit - 3 saniyede ikinci mesaj (BEKLENEN: HATA) ==========='
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.chat_messages(room_id, user_id, body)
  select id, '11111111-1111-1111-1111-111111111111', 'Cok hizli ikinci mesaj'
  from public.chat_rooms where slug='super-lig';
reset role;

\echo ''
\echo '=========== TEST 6: Istemci author_verified alanini SAHTE dolduramaz (BEKLENEN: false) ==========='
-- Dogrulanmamis kullanici min_account_state='any' olan bir odada yazsin,
-- ama author_verified=true gondermeye calissin.
update public.chat_rooms set min_account_state='any' where slug='genel-gundem';
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into public.chat_messages(room_id, user_id, body, author_name, author_verified)
  select id, '22222222-2222-2222-2222-222222222222', 'Sahte rozet denemesi', 'SahteAdmin', true
  from public.chat_rooms where slug='genel-gundem';
reset role;
\echo '--> Sunucu ne kaydetti?'
select author_name, author_verified, 'BEKLENEN: DogrulanmamisUye / false' as beklenen
from public.chat_messages where body='Sahte rozet denemesi';

\echo ''
\echo '=========== TEST 7: Kilitli odaya normal kullanici yazamaz (BEKLENEN: HATA) ==========='
update public.chat_rooms set is_locked=true where slug='transfer';
set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
insert into public.chat_messages(room_id, user_id, body)
  select id, '44444444-4444-4444-4444-444444444444', 'Kilitli oda denemesi'
  from public.chat_rooms where slug='transfer';
reset role;

\echo ''
\echo '=========== TEST 8: Kullanici kendi mesajini raporlayamaz (BEKLENEN: HATA) ==========='
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.report_chat_message(
  (select id from public.chat_messages where body like 'Merhaba, bu dogrulanmis%' limit 1), 'spam');
reset role;

\echo ''
\echo '=========== TEST 9: Baska kullanici raporlayabilir (BEKLENEN: ok=true) ==========='
set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.report_chat_message(
  (select id from public.chat_messages where body like 'Merhaba, bu dogrulanmis%' limit 1), 'spam', 'test raporu') as sonuc;
reset role;

\echo ''
\echo '=========== TEST 10: Yetkisiz kullanici moderasyon yapamaz (BEKLENEN: HATA) ==========='
set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.moderate_chat_message(
  (select id from public.chat_messages where body like 'Merhaba, bu dogrulanmis%' limit 1), 'delete', 'test');
reset role;

\echo ''
\echo '=========== TEST 11: Moderator mesaji silebilir (BEKLENEN: ok=true) ==========='
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.moderate_chat_message(
  (select id from public.chat_messages where body like 'Merhaba, bu dogrulanmis%' limit 1), 'delete', 'kural ihlali') as sonuc;
reset role;
\echo '--> audit_logs kaydi olustu mu?'
select action, entity_type, 'BEKLENEN: chat.delete / chat_message' as beklenen
from public.audit_logs order by created_at desc limit 1;

\echo ''
\echo '=========== TEST 12: Silinen mesaj baskalarina gorunmez, sahibine gorunur ==========='
set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select count(*) as baskasi_gorur, 'BEKLENEN: 0' as beklenen
from public.chat_messages where deleted_at is not null;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*) as sahibi_gorur, 'BEKLENEN: 1' as beklenen
from public.chat_messages where deleted_at is not null;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select count(*) as moderator_gorur, 'BEKLENEN: 1' as beklenen
from public.chat_messages where deleted_at is not null;
reset role;

\echo ''
\echo '=========== TEST 13: Susturulan kullanici yazamaz (BEKLENEN: HATA) ==========='
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.set_chat_mute('44444444-4444-4444-4444-444444444444', 60, 'test susturma') as sonuc;
reset role;
set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
insert into public.chat_messages(room_id, user_id, body)
  select id, '44444444-4444-4444-4444-444444444444', 'Susturulmus kullanici mesaji'
  from public.chat_rooms where slug='genel-gundem';
reset role;

\echo ''
\echo '=========== TEST 14: Yetkisiz kullanici susturma yapamaz (BEKLENEN: HATA) ==========='
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.set_chat_mute('44444444-4444-4444-4444-444444444444', 60, 'yetkisiz');
reset role;

\echo ''
\echo '=========== TEST 15: Bos / cok uzun mesaj reddedilir (BEKLENEN: 2 HATA) ==========='
select pg_sleep(3.2);
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.chat_messages(room_id, user_id, body)
  select id, '11111111-1111-1111-1111-111111111111', '   ' from public.chat_rooms where slug='genel-gundem';
insert into public.chat_messages(room_id, user_id, body)
  select id, '11111111-1111-1111-1111-111111111111', repeat('x', 501) from public.chat_rooms where slug='genel-gundem';
\echo '(iki insert de reddedilmeli: biri bos govde, digeri 500 karakter siniri)'
reset role;

\echo ''
\echo '=========== TEST 16: anon kullanici okuyabilir ama yazamaz ==========='
set role anon;
select count(*) >= 0 as anon_odalari_okur, 'BEKLENEN: t' as beklenen from public.chat_rooms;
insert into public.chat_messages(room_id, user_id, body)
  select id, '11111111-1111-1111-1111-111111111111', 'anon deneme' from public.chat_rooms limit 1;
reset role;

\echo ''
\echo '=========== TEST 17: get_leaderboard RPC calisiyor mu? ==========='
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*) as leaderboard_satir, 'BEKLENEN: hata yok' as beklenen
from public.get_leaderboard(1, null, 'week', 10);
reset role;

\echo ''
\echo '=========== TEST 18: Realtime publication ==========='
select tablename, 'BEKLENEN: chat_messages' as beklenen
from pg_publication_tables where pubname='supabase_realtime' and schemaname='public';
