-- P0: shared evidence registry.
-- Captures every case-packet artifact with immutable provenance. This is the
-- "capture" boundary; it never calculates. Problem 1 continues to read only the
-- listing_csv artifact through the existing runs pipeline.
CREATE TABLE IF NOT EXISTS evidence_artifacts (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('listing_csv','deal_record','comment_thread','image','document','outcome_set','reference_assessment','unsupported')),
  filename TEXT NOT NULL,
  object_key TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK(byte_size >= 0),
  source_system TEXT NOT NULL,
  source_reference TEXT NOT NULL DEFAULT '',
  captured_by TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  ingestion_status TEXT NOT NULL CHECK(ingestion_status IN ('received','parsed','failed','superseded','deleted')),
  sensitivity TEXT NOT NULL CHECK(sensitivity IN ('standard','financial','personal','restricted')),
  retention_policy TEXT NOT NULL DEFAULT 'deal-lifetime',
  note TEXT NOT NULL DEFAULT '',
  supersedes_id TEXT,
  created_at TEXT NOT NULL
);
-- Identical bytes for one deal are stored once; re-upload is reported as a
-- duplicate rather than creating an uncontrolled copy.
CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_artifacts_dedupe ON evidence_artifacts(deal_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_evidence_artifacts_deal ON evidence_artifacts(deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_artifacts_kind ON evidence_artifacts(deal_id, kind);
