// Sites D1 schema contract. The executable migration lives in
// drizzle/0001_football_match_archive.sql and is packaged with every release.
export type FootballFixtureCatalogRow = {
  provider_fixture_id: string;
  league_key: string;
  kickoff_utc: string | null;
  canonical_state: string | null;
  updated_at: string;
};

export type FootballMatchArchiveRow = {
  fixture_id: string;
  league_key: string;
  kickoff_utc: string | null;
  status: string | null;
  payload_json: string;
  lineups_count: number;
  events_count: number;
  statistics_count: number;
  completeness_score: number;
  is_final: 0 | 1;
  provider_updated_at: string | null;
  last_synced_at: string;
  finalized_at: string | null;
};
