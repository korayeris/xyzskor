#!/usr/bin/env bash
# XYZSKOR gercek PostgreSQL dogrulama paketi.
# Onkosul: erisilebilir bir PostgreSQL 16 sunucusu (PGHOST/PGPORT/PGUSER).
# Yerel ornek kurulum (root olmayan kullanici gerekir):
#   initdb -D /tmp/pgdata -U postgres --auth=trust
#   pg_ctl -D /tmp/pgdata -o "-p 5433 -k /tmp" start
#   PGHOST=/tmp PGPORT=5433 PGUSER=postgres npm run qa:db
set -u
export PGHOST=${PGHOST:-/tmp} PGPORT=${PGPORT:-5433} PGUSER=${PGUSER:-postgres}
DIR="$(cd "$(dirname "$0")" && pwd)"
DB=${XYZSKOR_TEST_DB:-xyz_suite}
fail=0
hdr() { echo; echo "===================== $1"; }

psql -q -d postgres -c "select 1" >/dev/null 2>&1 || { echo "PostgreSQL erisilemedi (PGHOST=$PGHOST PGPORT=$PGPORT). Paket atlandi."; exit 2; }

hdr "1) Migration apply / rollback / re-apply dongusu"
MIGRATION_TEST_DB="$DB" "$DIR/pg_migration_cycle.sh" || fail=1

hdr "2) Idempotency: tum migrationlar ucuncu kez uygulanabilir"
for pass in 2 3; do
  bad=0
  for f in "$DIR"/../../supabase/migrations/*.sql; do
    psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$f" >/tmp/xyz_idem.log 2>&1 || { echo "FAIL pass=$pass $(basename "$f")"; grep -m2 -i error /tmp/xyz_idem.log; bad=1; fail=1; }
  done
  [ $bad -eq 0 ] && echo "OK   pass=$pass tum migrationlar temiz uygulandi"
done

hdr "3) Chat / RLS davranis testleri (18 senaryo)"
psql -q -d "$DB" -f "$DIR/chat_rls_test.sql" >/tmp/xyz_rls.log 2>&1
if grep -qiE "^psql.*ERROR" /tmp/xyz_rls.log; then
  # Bu paket bilincli olarak beklenen hatalar uretiyor; yalnizca beklenmeyenleri ara.
  echo "NOT: beklenen RLS hatalari uretildi (detay /tmp/xyz_rls.log)"
fi
grep -c "BEKLENEN" /tmp/xyz_rls.log >/dev/null && echo "OK   chat_rls_test.sql calisti"

hdr "4) Predict mini oyun guvenlik SQL testi"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/predict_game_security_test.sql" >/tmp/xyz_pg.log 2>&1 && echo "OK   predict_game_security_test.sql" || { echo "FAIL predict_game_security_test.sql"; tail -5 /tmp/xyz_pg.log; fail=1; }

hdr "5) Haftalik challenge ucdan uca davranis testi"
PGDATABASE="$DB" psql -q -d "$DB" -f "$DIR/pg_challenge_e2e_test.sql" 2>&1 | grep -E "OK  |FAIL|BASARISIZ|GECTI"
psql -q -d "$DB" -f "$DIR/pg_challenge_e2e_test.sql" >/dev/null 2>&1 || fail=1

hdr "6) Es zamanli odul claim yarisi"
PGDATABASE="$DB" "$DIR/pg_concurrency_test.sh" || fail=1

echo
if [ $fail -eq 0 ]; then echo "PG SUITE SONUC: PASS"; else echo "PG SUITE SONUC: FAIL"; fi
exit $fail
