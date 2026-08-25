-- XYZSKOR haftalik challenge ucdan uca davranis testi (gercek PostgreSQL).
-- Kapsam: 6 challenge maci -> authenticated kullanici tahminleri -> service_role
-- settlement -> aylik tier + haftalik 6/6 odul uygunlugu -> RLS gizlilik kontrolu
-- -> idempotency (ikinci settlement mukerrer odul acmaz).
\set ON_ERROR_STOP on
\timing off
begin;

create temporary table t_result(id text primary key, ok boolean, detail text) on commit drop;
grant all on t_result to public;

-- Fixture
insert into auth.users (id,email,email_confirmed_at) values
  ('22222222-2222-2222-2222-222222222222','e2e-perfect@test.local',now()),
  ('33333333-3333-3333-3333-333333333333','e2e-partial@test.local',now())
on conflict (id) do nothing;

insert into public.matches (id,hafta,ev,konuk,kickoff,verified,status,challenge_week,challenge_league)
select 'e2e:'||i, 1, 'Ev '||i, 'Konuk '||i, now()+interval '3 hours', true, 'planlandi',
       date '2026-08-17', (array['super-lig','premier-league','la-liga'])[1+(i%3)]
from generate_series(1,6) i;

-- 20260825160000_prediction_integrity_restore.sql tahmin yazmayi oturum zorunlu
-- hale getirdi (auth.uid() null ise reddedilir). Bu yuzden her kullanicinin
-- tahminleri kendi oturum baglaminda yazilir; boylece test hem eski davranisa
-- gore guncellenmis olur hem de sahiplik kontrolunu gercekten kanitlar.
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
-- Mukemmel kullanici 6/6 dogru (hepsi ev sahibi kazanir -> pick '1')
insert into public.predictions (match_id,user_id,pick,score_home,score_away)
select 'e2e:'||i,'22222222-2222-2222-2222-222222222222','1',2,0 from generate_series(1,6) i;

set local "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
-- Kismi kullanici 5 dogru 1 yanlis
insert into public.predictions (match_id,user_id,pick,score_home,score_away)
select 'e2e:'||i,'33333333-3333-3333-3333-333333333333', case when i=6 then 'X' else '1' end,2,0
from generate_series(1,6) i;

-- Regresyon: baska kullanici adina tahmin yazilamaz ve oturumsuz yazma reddedilir.
do $$
begin
  begin
    insert into public.predictions (match_id,user_id,pick,score_home,score_away)
    values ('e2e:1','22222222-2222-2222-2222-222222222222','1',1,0);
    raise exception 'GUVENLIK: baska kullanici adina tahmin yazilabildi.';
  exception when others then
    if position('Başka kullanıcı adına' in sqlerrm) = 0 then raise; end if;
  end;
end $$;
reset "request.jwt.claim.sub";
do $$
begin
  begin
    insert into public.predictions (match_id,user_id,pick,score_home,score_away)
    values ('e2e:2','22222222-2222-2222-2222-222222222222','1',1,0);
    raise exception 'GUVENLIK: oturum olmadan tahmin yazilabildi.';
  exception when others then
    if position('oturum gerekli' in sqlerrm) = 0 then raise; end if;
  end;
end $$;

-- DB tarafi kickoff kilidi (enforce_prediction_integrity) kanitlandi: tahminler
-- kickoff oncesi yazildi, simdi maclar gecmise alinip settlement yapilir.
insert into t_result
select '00_db_kickoff_kilidi_var',
       exists (select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
               where p.proname='enforce_prediction_integrity'), 'trigger mevcut';
update public.matches set kickoff = now() - interval '3 hours' where challenge_week = date '2026-08-17';

-- 1) authenticated rol settlement yapamaz
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
begin
  begin
    perform public.settle_prediction_challenge_match('e2e:1',2,0);
    insert into t_result values ('01_authenticated_settlement_reddedilir', false, 'HATA BEKLENIYORDU');
  exception when others then
    insert into t_result values ('01_authenticated_settlement_reddedilir', true, sqlerrm);
  end;
end $$;

-- 2) RLS: kullanici baskasinin tahminini goremez
insert into t_result
select '02_baskasinin_tahmini_gizli',
       (select count(*) from public.predictions where user_id='33333333-3333-3333-3333-333333333333')=0,
       'gorunen satir: '||(select count(*) from public.predictions where user_id='33333333-3333-3333-3333-333333333333')::text;
insert into t_result
select '03_kendi_tahminini_gorur',
       (select count(*) from public.predictions where user_id='22222222-2222-2222-2222-222222222222')=6,
       'gorunen satir: '||(select count(*) from public.predictions where user_id='22222222-2222-2222-2222-222222222222')::text;
reset role;
set local request.jwt.claim.role = 'service_role';

-- 3) service_role ile 6 macin sonucunu yaz
do $$
declare i integer; last jsonb;
begin
  for i in 1..6 loop
    last := public.settle_prediction_challenge_match('e2e:'||i, 2, 0);
  end loop;
  insert into t_result values ('04_settlement_calisti', (last->>'settled')='true', last::text);
  insert into t_result values ('05_haftalik_6_6_odulu_acildi', (last->>'new_reward_claims')::int >= 1, last::text);
end $$;

-- 4) Odul kaydi yalnizca 6/6 bilen kullaniciya acildi
insert into t_result
select '06_odul_yalniz_mukemmel_kullaniciya',
       (select count(*) from public.reward_claims where source_type='prediction_week')=1
       and exists (select 1 from public.reward_claims where source_type='prediction_week'
                   and user_id='22222222-2222-2222-2222-222222222222'),
       'toplam claim: '||(select count(*) from public.reward_claims where source_type='prediction_week')::text;

-- 5) Idempotency: tekrar settlement mukerrer odul acmaz
do $$
declare again jsonb;
begin
  again := public.settle_prediction_challenge_match('e2e:6', 2, 0);
  insert into t_result values ('07_tekrar_settlement_idempotent',
    (again->>'new_reward_claims')::int = 0
    and (select count(*) from public.reward_claims where source_type='prediction_week')=1, again::text);
end $$;

-- 6) Aylik tier: mukemmel kullanici 6*3 + 6*5 = 48 puan -> altin (35-49)
insert into t_result
select '08_aylik_tier_dogru',
       coalesce((select tier from public.prediction_reward_eligibilities
                 where user_id='22222222-2222-2222-2222-222222222222' ),'YOK')='gold',
       'satirlar='||coalesce((select string_agg(tier||':'||points::text, ', ' order by points) from public.prediction_reward_eligibilities
                 where user_id='22222222-2222-2222-2222-222222222222'),'YOK');

-- 6b) Tekil tier garantisi: ay icinde uye basina TEK satir kalmali
insert into t_result
select '08b_uye_basina_tek_tier_satiri',
       (select count(*) from public.prediction_reward_eligibilities
        where user_id='22222222-2222-2222-2222-222222222222')=1,
       'satir sayisi='||(select count(*) from public.prediction_reward_eligibilities
        where user_id='22222222-2222-2222-2222-222222222222')::text;

-- 7) Kismi kullanici: 5*3 + 5*5 = 40 -> altin, ama odul claim'i yok
insert into t_result
select '09_kismi_kullanici_odul_almadi',
       not exists (select 1 from public.reward_claims where source_type='prediction_week'
                   and user_id='33333333-3333-3333-3333-333333333333'), '';

select case when ok then 'OK  ' else 'FAIL' end||'  '||id||coalesce('   ['||nullif(detail,'')||']','') as sonuc
from t_result order by id;

do $$
declare bad integer;
begin
  select count(*) into bad from t_result where not ok;
  if bad > 0 then raise exception 'CHALLENGE E2E BASARISIZ: % test', bad; end if;
  raise notice 'CHALLENGE E2E: TUM TESTLER GECTI';
end $$;

rollback;
