#!/usr/bin/env bash
set -euo pipefail
DB=${XYZSKOR_TEST_DB:-xyz_suite}
SQL="insert into public.football_weekly_awards (league_id,season_id,round_id,algorithm_version,status,star_player_id,payload) values ('600','28203','parallel','v1','published','101','{}') on conflict (league_id,season_id,round_id,algorithm_version) do update set computed_at=now();"
pids=()
for _ in $(seq 1 20); do
  PGDATABASE="$DB" psql -q -v ON_ERROR_STOP=1 -c "$SQL" >/dev/null &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
count=$(PGDATABASE="$DB" psql -Atqc "select count(*) from public.football_weekly_awards where league_id='600' and season_id='28203' and round_id='parallel' and algorithm_version='v1'")
if [ "$count" != "1" ]; then
  echo "FAIL weekly parallel upsert count=$count"
  exit 1
fi
echo "OK   20 parallel weekly calculations -> 1 published row"
