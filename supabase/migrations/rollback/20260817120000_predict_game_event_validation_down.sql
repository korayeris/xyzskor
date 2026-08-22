-- GERİ ALMA: 20260817120000_predict_game_event_validation.sql
-- Türkçe açıklama: nonce/events tabanlı doğrulama katmanını kaldırır.
-- UYARI: bu geri alma GÜVENLİK SEVİYESİNİ DÜŞÜRÜR (sıralı terminal olay
-- doğrulaması ve saat sapması kontrolü kaybolur). Yalnızca Worker'ın eski
-- sürümüne dönüldüğünde ve zorunluysa uygulanmalıdır.
-- events/nonce kolonları veri taşıdığı için düşürülmez, yalnızca yeni
-- fonksiyon ve tekil indeks kaldırılır.
begin;

drop function if exists public.claim_predict_game_reward(uuid,uuid,text,integer,integer,text,text,text,jsonb,bigint);
drop index if exists public.predict_game_sessions_nonce_uidx;

alter table public.predict_game_sessions drop constraint if exists predict_game_sessions_events_check;
alter table public.predict_game_sessions drop constraint if exists predict_game_sessions_status_check;
alter table public.predict_game_sessions add constraint predict_game_sessions_status_check
  check (status in ('started','completed','game_success','game_over','training','reward_claimed','reward_blocked_daily_limit'));

-- Eski overload'a service_role yetkisini iade et.
grant execute on function public.claim_predict_game_reward(uuid,uuid,text,integer,integer,text,text) to service_role;

commit;

-- KALAN İŞ: kolon temizliği (events, nonce) ancak veri yedeklendikten sonra,
-- ayrı bir transaction'da yapılmalıdır:
--   alter table public.predict_game_sessions drop column if exists events;
--   alter table public.predict_game_sessions drop column if exists nonce;
