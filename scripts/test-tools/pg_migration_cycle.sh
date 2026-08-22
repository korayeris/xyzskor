#!/usr/bin/env bash
# Gercek PostgreSQL uzerinde: temiz DB -> tum migrationlar -> geri alma zinciri
# -> yeniden uygulama. Her adimda hata olursa FAIL.
set -u
export PGHOST=${PGHOST:-/tmp} PGPORT=${PGPORT:-5433} PGUSER=${PGUSER:-postgres}
DB=${MIGRATION_TEST_DB:-xyz_cycle}
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
fail=0
step() { printf "%-62s" "$1"; }
res() { if [ "$1" -eq 0 ]; then echo "OK"; else echo "FAIL"; fail=1; fi; }

psql -q -d postgres -c "drop database if exists $DB;" -c "create database $DB;" >/dev/null 2>&1
step "supabase shim"; psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/test-tools/pg_supabase_shim.sql" >/dev/null 2>&1; res $?

echo "--- ILERI (apply)"
for f in "$ROOT"/supabase/migrations/*.sql; do
  step "  $(basename "$f")"
  psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$f" >/tmp/mig.log 2>&1; rc=$?; res $rc
  [ $rc -ne 0 ] && grep -m3 -i error /tmp/mig.log
done

echo "--- GERI ALMA (rollback, ters sirada)"
for f in $(ls -r "$ROOT"/supabase/migrations/rollback/*_down.sql); do
  step "  $(basename "$f")"
  psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$f" >/tmp/rb.log 2>&1; rc=$?; res $rc
  [ $rc -ne 0 ] && grep -m3 -i error /tmp/rb.log
done

echo "--- YENIDEN ILERI (re-apply, geri alinan 4 migration)"
for f in 20260817120000_predict_game_event_validation.sql 20260819193000_prediction_challenge_auto_rewards.sql 20260819203000_prediction_reward_tiers.sql 20260821090000_prediction_reward_repair.sql; do
  step "  $f"
  psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/$f" >/tmp/re.log 2>&1; rc=$?; res $rc
  [ $rc -ne 0 ] && grep -m3 -i error /tmp/re.log
done

echo "--- SON DURUM DOGRULAMASI"
step "  settle fonksiyonu haftalik 6/6 odulunu iceriyor"
psql -q -d "$DB" -tAc "select position('weekly-six-perfect' in pg_get_functiondef(p.oid))>0 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='settle_prediction_challenge_match';" | grep -q "^t$"; res $?
step "  rookie katmani kisitta"
psql -q -d "$DB" -tAc "select position('rookie' in pg_get_constraintdef(oid))>0 from pg_constraint where conname='prediction_reward_eligibilities_tier_check';" | grep -q "^t$"; res $?
step "  anon cagirabilen secdef fonksiyon sayisi = 2 (leaderboard + consensus)"
n=$(psql -q -d "$DB" -tAc "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and has_function_privilege('anon',p.oid,'execute');")
[ "$n" = "2" ]; res $?; [ "$n" != "2" ] && echo "     (bulunan: $n)"

echo
if [ $fail -eq 0 ]; then echo "SONUC: PASS"; else echo "SONUC: FAIL"; fi
exit $fail
