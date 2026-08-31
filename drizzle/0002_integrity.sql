CREATE TABLE IF NOT EXISTS run_operations (
  operation_key TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_deal_version ON runs(deal_id, version_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rows_run_listing ON run_rows(run_id, listing_id);
