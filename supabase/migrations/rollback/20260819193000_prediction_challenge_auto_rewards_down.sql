-- GERİ ALMA: 20260819193000_prediction_challenge_auto_rewards.sql
-- Türkçe açıklama: haftalık challenge alanlarını ve settlement fonksiyonunu kaldırır.
-- UYARI: matches.challenge_week / challenge_league kolonları VERİ KAYBIYLA düşer.
-- Kolonları düşürmeden önce yeni Worker sürümü geri alınmalıdır (Worker bu
-- alanlara yazıyor; şema hatasında fallback var ama önce Worker geri alınmalı).
-- Önce: \copy (select id, challenge_week, challenge_league from public.matches
--        where challenge_week is not null) to 'challenge_yedek.csv' csv header
begin;

drop function if exists public.settle_prediction_challenge_match(text,integer,integer);
drop index if exists public.matches_challenge_week_idx;
alter table public.matches drop constraint if exists matches_challenge_league_check;
alter table public.matches drop column if exists challenge_league;
alter table public.matches drop column if exists challenge_week;
-- Kampanya satırı ödül geçmişiyle ilişkili olabileceği için silinmez, pasife alınır.
update public.reward_campaigns set status='cancelled' where code='weekly-six-perfect';

commit;
