#!/usr/bin/env bash
# Ayni kullanicinin ayni UTC gununde 5 farkli oturumla es zamanli odul claim etmesini test eder.
# BEKLENEN: tam olarak 1 claim=true, 4 tanesi blocked=daily_limit; puan tablosunda 1 satir.
set -u
export PGHOST=${PGHOST:-/tmp} PGPORT=${PGPORT:-5433} PGUSER=${PGUSER:-postgres} PGDATABASE=${PGDATABASE:-xyz}
DIR="$(cd "$(dirname "$0")" && pwd)"
psql -q -v ON_ERROR_STOP=1 -f "$DIR/pg_concurrency_test.sql" >/dev/null || exit 1
EVENTS='[{"type":"goal","elapsedMs":200},{"type":"goal","elapsedMs":400},{"type":"goal","elapsedMs":600},{"type":"goal","elapsedMs":800},{"type":"goal","elapsedMs":1000},{"type":"goal","elapsedMs":1200},{"type":"goal","elapsedMs":1400},{"type":"goal","elapsedMs":1600},{"type":"goal","elapsedMs":1800},{"type":"goal","elapsedMs":2000}]'
OUT=$(mktemp -d)
i=0
for n in A B C D E; do
  i=$((i+1))
  sid="aaaaaaaa-0000-0000-0000-00000000000$i"
  (
    psql -q -X -A -t -c "set request.jwt.claim.sub='11111111-1111-1111-1111-111111111111';
      select public.claim_predict_game_reward('$sid'::uuid,'11111111-1111-1111-1111-111111111111'::uuid,
        null, 10, 0, 'GAME_SUCCESS', 'idem-$n', 'nonce-$n', '$EVENTS'::jsonb, 5000);" > "$OUT/$n.txt" 2>&1
  ) &
done
wait
claimed=$(grep -ho '"claimed" *: *true' "$OUT"/*.txt | wc -l)
daily=$(grep -ho 'daily_limit' "$OUT"/*.txt | wc -l)
rows=$(psql -q -X -A -t -c "select count(*) from public.predict_point_transactions where user_id='11111111-1111-1111-1111-111111111111';")
pts=$(psql -q -X -A -t -c "select coalesce(sum(amount),0) from public.predict_point_transactions where user_id='11111111-1111-1111-1111-111111111111';")
echo "claimed=true sayisi : $claimed  (beklenen 1)"
echo "daily_limit sayisi  : $daily  (beklenen 4)"
echo "puan islemi satiri  : $rows  (beklenen 1)"
echo "toplam puan         : $pts  (beklenen 50)"
for f in "$OUT"/*.txt; do echo "  $(basename "$f"): $(cat "$f" | tr -d '\n')"; done
if [ "$claimed" = "1" ] && [ "$rows" = "1" ] && [ "$pts" = "50" ]; then echo "SONUC: PASS"; exit 0; fi
echo "SONUC: FAIL"; exit 1
