CREATE TABLE IF NOT EXISTS football_fixture_catalog (
  provider_fixture_id TEXT PRIMARY KEY,
  league_key TEXT NOT NULL,
  kickoff_utc TEXT,
  canonical_state TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_football_fixture_catalog_kickoff
ON football_fixture_catalog(kickoff_utc DESC);

CREATE TABLE IF NOT EXISTS football_match_archives (
  fixture_id TEXT PRIMARY KEY,
  league_key TEXT NOT NULL,
  kickoff_utc TEXT,
  status TEXT,
  payload_json TEXT NOT NULL,
  lineups_count INTEGER NOT NULL DEFAULT 0,
  events_count INTEGER NOT NULL DEFAULT 0,
  statistics_count INTEGER NOT NULL DEFAULT 0,
  completeness_score INTEGER NOT NULL DEFAULT 0 CHECK(completeness_score BETWEEN 0 AND 100),
  is_final INTEGER NOT NULL DEFAULT 0 CHECK(is_final IN (0, 1)),
  provider_updated_at TEXT,
  last_synced_at TEXT NOT NULL,
  finalized_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_football_match_archives_league_kickoff
ON football_match_archives(league_key, kickoff_utc DESC);

CREATE INDEX IF NOT EXISTS idx_football_match_archives_backfill
ON football_match_archives(is_final, last_synced_at);

PRAGMA optimize;
