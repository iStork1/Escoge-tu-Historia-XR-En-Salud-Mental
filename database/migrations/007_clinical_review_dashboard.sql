-- ========================================================================
-- Migration 007: Clinical Review Dashboard Tables
-- Purpose: Store clinician feedback on clinical mappings for dashboard
-- Idempotent: Safe to re-run
-- ========================================================================

-- Reviewers (clinicians / supervisors)
CREATE TABLE IF NOT EXISTS reviewers (
  reviewer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  role VARCHAR(20) CHECK (role IN ('clinician','supervisor','admin')) DEFAULT 'clinician',
  email TEXT UNIQUE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Reviews of clinical mappings (per mapping)
CREATE TABLE IF NOT EXISTS clinical_mapping_reviews (
  review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_id UUID REFERENCES clinical_mappings(mapping_id) ON DELETE CASCADE,
  decision_id UUID REFERENCES decisions(decision_id) ON DELETE SET NULL,
  option_id TEXT REFERENCES options(option_id) ON DELETE SET NULL,
  reviewer_id UUID REFERENCES reviewers(reviewer_id) ON DELETE SET NULL,
  verdict VARCHAR(20) CHECK (verdict IN ('approve','reject','adjust','unclear')) NOT NULL,
  reviewer_confidence FLOAT CHECK (reviewer_confidence >= 0 AND reviewer_confidence <= 1),
  reason TEXT,
  suggested_mapping JSONB,
  review_tags TEXT[],
  training_ready BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure columns exist if table created earlier without them
ALTER TABLE clinical_mapping_reviews ADD COLUMN IF NOT EXISTS decision_id UUID;
ALTER TABLE clinical_mapping_reviews ADD COLUMN IF NOT EXISTS option_id TEXT;
ALTER TABLE clinical_mapping_reviews ADD COLUMN IF NOT EXISTS reviewer_id UUID;
ALTER TABLE clinical_mapping_reviews ADD COLUMN IF NOT EXISTS reviewer_confidence FLOAT;
ALTER TABLE clinical_mapping_reviews ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE clinical_mapping_reviews ADD COLUMN IF NOT EXISTS suggested_mapping JSONB;
ALTER TABLE clinical_mapping_reviews ADD COLUMN IF NOT EXISTS review_tags TEXT[];
ALTER TABLE clinical_mapping_reviews ADD COLUMN IF NOT EXISTS training_ready BOOLEAN DEFAULT FALSE;
ALTER TABLE clinical_mapping_reviews ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE clinical_mapping_reviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Trigger to maintain updated_at
CREATE OR REPLACE FUNCTION fn_set_review_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_review_updated_at ON clinical_mapping_reviews;
CREATE TRIGGER trg_set_review_updated_at
BEFORE UPDATE ON clinical_mapping_reviews
FOR EACH ROW EXECUTE FUNCTION fn_set_review_updated_at();

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_reviewers_role ON reviewers(role);
CREATE INDEX IF NOT EXISTS idx_mapping_reviews_mapping_id ON clinical_mapping_reviews(mapping_id);
CREATE INDEX IF NOT EXISTS idx_mapping_reviews_decision_id ON clinical_mapping_reviews(decision_id);
CREATE INDEX IF NOT EXISTS idx_mapping_reviews_option_id ON clinical_mapping_reviews(option_id);
CREATE INDEX IF NOT EXISTS idx_mapping_reviews_reviewer_id ON clinical_mapping_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_mapping_reviews_verdict ON clinical_mapping_reviews(verdict);
CREATE INDEX IF NOT EXISTS idx_mapping_reviews_training_ready ON clinical_mapping_reviews(training_ready);
CREATE INDEX IF NOT EXISTS idx_mapping_reviews_created_at ON clinical_mapping_reviews(created_at);

-- View: review queue with mapping + decision context
CREATE OR REPLACE VIEW v_mapping_review_queue AS
SELECT
  cm.mapping_id,
  cm.decision_id,
  cm.option_id,
  cm.scale,
  cm.item,
  cm.weight,
  cm.confidence,
  cm.primary_construct,
  cm.rationale,
  cm.mapping_source,
  cm.source_confidence,
  cm.validated,
  d.session_id,
  d.timestamp,
  s.pseudonym,
  o.option_text,
  o.consequence,
  COUNT(r.review_id) AS review_count,
  MAX(r.created_at) AS last_review_at,
  BOOL_OR(r.verdict = 'reject') AS has_reject,
  BOOL_OR(r.verdict = 'adjust') AS has_adjust,
  BOOL_OR(r.training_ready) AS training_ready
FROM clinical_mappings cm
LEFT JOIN decisions d ON d.decision_id = cm.decision_id
LEFT JOIN sessions s ON s.session_id = d.session_id
LEFT JOIN options o ON o.option_id = cm.option_id
LEFT JOIN clinical_mapping_reviews r ON r.mapping_id = cm.mapping_id
GROUP BY
  cm.mapping_id,
  cm.decision_id,
  cm.option_id,
  cm.scale,
  cm.item,
  cm.weight,
  cm.confidence,
  cm.primary_construct,
  cm.rationale,
  cm.mapping_source,
  cm.source_confidence,
  cm.validated,
  d.session_id,
  d.timestamp,
  s.pseudonym,
  o.option_text,
  o.consequence;

-- View: review stats
CREATE OR REPLACE VIEW v_mapping_review_stats AS
SELECT
  DATE(created_at) AS review_date,
  verdict,
  COUNT(*) AS total_reviews,
  AVG(reviewer_confidence) AS avg_reviewer_confidence
FROM clinical_mapping_reviews
GROUP BY DATE(created_at), verdict
ORDER BY review_date DESC;

-- View: training-ready mapping feedback
CREATE OR REPLACE VIEW v_mapping_training_ready AS
SELECT
  r.review_id,
  r.mapping_id,
  r.decision_id,
  r.option_id,
  r.reviewer_id,
  r.verdict,
  r.reviewer_confidence,
  r.reason,
  r.suggested_mapping,
  r.review_tags,
  r.created_at,
  cm.scale,
  cm.item,
  cm.weight,
  cm.confidence,
  cm.primary_construct,
  cm.mapping_source
FROM clinical_mapping_reviews r
JOIN clinical_mappings cm ON cm.mapping_id = r.mapping_id
WHERE r.training_ready = TRUE;
