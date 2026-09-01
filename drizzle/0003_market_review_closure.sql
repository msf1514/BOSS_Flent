CREATE TABLE IF NOT EXISTS market_review_closures (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL UNIQUE,
  run_id TEXT NOT NULL,
  disposition TEXT NOT NULL CHECK(disposition IN ('usable_with_caveats','insufficient_evidence')),
  rationale TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_market_review_closures_run ON market_review_closures(run_id);
