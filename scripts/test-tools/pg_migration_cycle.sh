#!/usr/bin/env bash
# Gercek PostgreSQL uzerinde: temiz DB -> tum migrationlar -> geri alma zinciri
# -> yeniden uygulama. Her adimda hata olursa FAIL.
set -u
export PGHOST=${PGHOST:-/tmp} PGPORT=${PGPORT:-5433} PGUSER=${PGUSER:-postgres}
DB=${MIGRATION_TEST_DB:-xyz_cycle}
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PREDICTION_INTEGRITY_MIGRATION=20260825160000_prediction_integrity_restore.sql
PREDICTION_INTEGRITY_STATE_SQL="$ROOT/scripts/test-tools/pg_prediction_integrity_state.sql"
prediction_integrity_pre_state=
prediction_integrity_snapshot_ok=0
fail=0
step() { printf "%-62s" "$1"; }
res() { if [ "$1" -eq 0 ]; then echo "OK"; else echo "FAIL"; fail=1; fi; }

psql -q -d postgres -c "drop database if exists $DB;" -c "create database $DB;" >/dev/null 2>&1
step "supabase shim"; psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/test-tools/pg_supabase_shim.sql" >/dev/null 2>&1; res $?

echo "--- ILERI (apply)"
for f in "$ROOT"/supabase/migrations/*.sql; do
  if [ "$(basename "$f")" = "$PREDICTION_INTEGRITY_MIGRATION" ]; then
    step "  prediction integrity rollback referansini kaydet"
    prediction_integrity_pre_state=$(psql -q -d "$DB" -tA -v ON_ERROR_STOP=1 -f "$PREDICTION_INTEGRITY_STATE_SQL" 2>/tmp/mig-state.log); rc=$?
    if [ $rc -eq 0 ] && [ -n "$prediction_integrity_pre_state" ]; then
      prediction_integrity_snapshot_ok=1
      res 0
    else
      res 1
      [ $rc -ne 0 ] && grep -m3 -i error /tmp/mig-state.log
      [ $rc -eq 0 ] && echo "     (katalog referansi bos dondu)"
    fi
  fi
  step "  $(basename "$f")"
  psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$f" >/tmp/mig.log 2>&1; rc=$?; res $rc
  [ $rc -ne 0 ] && grep -m3 -i error /tmp/mig.log
done

echo "--- GERI ALMA (rollback, ters sirada)"
for f in $(ls -r "$ROOT"/supabase/migrations/rollback/*_down.sql); do
  step "  $(basename "$f")"
  psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$f" >/tmp/rb.log 2>&1; rc=$?; res $rc
  [ $rc -ne 0 ] && grep -m3 -i error /tmp/rb.log

  if [ "$(basename "$f")" = "${PREDICTION_INTEGRITY_MIGRATION%.sql}_down.sql" ]; then
    step "  prediction integrity rollback tam onceki durumu kuruyor"
    prediction_integrity_rollback_state=$(psql -q -d "$DB" -tA -v ON_ERROR_STOP=1 -f "$PREDICTION_INTEGRITY_STATE_SQL" 2>/tmp/rb-state.log); state_rc=$?
    if [ $state_rc -eq 0 ] && [ $prediction_integrity_snapshot_ok -eq 1 ] && [ "$prediction_integrity_rollback_state" = "$prediction_integrity_pre_state" ]; then
      res 0
    else
      res 1
      [ $state_rc -ne 0 ] && grep -m3 -i error /tmp/rb-state.log
      [ $prediction_integrity_snapshot_ok -ne 1 ] && echo "     (ileri migration oncesi referans alinamadi)"
      [ $state_rc -eq 0 ] && [ $prediction_integrity_snapshot_ok -eq 1 ] && echo "     (policy/ACL/function/trigger/index katalog durumu farkli)"
    fi
  fi
done

# Geri alinan HER migration ileri yonde yeniden uygulanir. Bu liste eskiden
# elle yazilmis 4 dosyadan olusuyordu; migration seti buyudugu icin geri alinan
# 9 migrationdan yalnizca 4'u geri yukleniyor, ardindan gelen "SON DURUM
# DOGRULAMASI" adimlari eksik bir semayi tam sema gibi olcuyordu (bu yuzden
# anon secdef sayisi 2 yerine 4 gorunuyordu). Liste artik rollback dosyalarindan
# turetilir, boylece dongu gercekten apply -> rollback -> re-apply olur.
echo "--- YENIDEN ILERI (re-apply, geri alinan tum migrationlar)"
for down in $(ls "$ROOT"/supabase/migrations/rollback/*_down.sql); do
  f="$(basename "$down" | sed 's/_down\.sql$/.sql/')"
  [ -f "$ROOT/supabase/migrations/$f" ] || { step "  $f"; echo "FAIL"; echo "     (ileri migration bulunamadi)"; fail=1; continue; }
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
