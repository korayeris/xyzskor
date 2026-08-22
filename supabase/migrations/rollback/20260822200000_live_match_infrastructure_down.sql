-- GERİ ALMA: 20260822200000_live_match_infrastructure.sql
-- Kalıcı canlı skor altyapısını (snapshot/event/sync_runs/sync_locks/
-- provider_fixtures) tamamen kaldırır. UYARI: bu geri alma canlı skor
-- kalıcılığını ve single-flight kilidini devre dışı bırakır; yalnızca
-- Worker eski (snapshot'sız) sürüme döndürüldüğünde uygulanmalıdır.

begin;

drop function if exists public.try_acquire_sync_lock(text, text, integer);

drop table if exists public.sync_locks;
drop table if exists public.provider_sync_runs;
drop table if exists public.live_match_events;
drop table if exists public.live_match_snapshots;
drop table if exists public.provider_fixtures;

commit;
