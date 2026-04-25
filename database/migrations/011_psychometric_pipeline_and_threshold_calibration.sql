-- ========================================================================
-- Migration 011: Psychometric validation pipeline + threshold calibration
-- Purpose: P2-01, P2-02, P2-03 foundations
-- ========================================================================

CREATE TABLE IF NOT EXISTS active_threshold_versions (
  threshold_domain VARCHAR(50) PRIMARY KEY,
  threshold_version VARCHAR(50) NOT NULL,
  activated_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS clinical_thresholds (
  threshold_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  threshold_domain VARCHAR(50) NOT NULL DEFAULT 'risk_detection',
  threshold_version VARCHAR(50) NOT NULL,
  risk_type VARCHAR(80) NOT NULL,
  threshold_value NUMERIC NOT NULL,
  score_min NUMERIC,
  score_max NUMERIC,
  calibrated_from_run_id UUID,
  calibrated_at TIMESTAMPTZ DEFAULT now(),
  rationale TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  UNIQUE (threshold_domain, threshold_version, risk_type)
);

CREATE TABLE IF NOT EXISTS psychometric_pipeline_versions (
  pipeline_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_version VARCHAR(50) UNIQUE NOT NULL,
  model_version VARCHAR(50) NOT NULL,
  rules_version VARCHAR(50) NOT NULL,
  threshold_version VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by VARCHAR(100),
  notes TEXT,
  config JSONB
);

CREATE TABLE IF NOT EXISTS psychometric_validation_datasets (
  dataset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_name VARCHAR(100) NOT NULL,
  dataset_version VARCHAR(50) NOT NULL,
  cohort VARCHAR(50) NOT NULL DEFAULT 'all',
  source_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB,
  UNIQUE (dataset_name, dataset_version, cohort)
);

CREATE TABLE IF NOT EXISTS psychometric_validation_runs (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_version_id UUID NOT NULL REFERENCES psychometric_pipeline_versions(pipeline_version_id) ON DELETE RESTRICT,
  dataset_id UUID NOT NULL REFERENCES psychometric_validation_datasets(dataset_id) ON DELETE RESTRICT,
  executed_at TIMESTAMPTZ DEFAULT now(),
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  cohort VARCHAR(50),
  rules_version VARCHAR(50) NOT NULL,
  threshold_version VARCHAR(50) NOT NULL,
  model_version VARCHAR(50) NOT NULL,
  parameters JSONB,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS psychometric_validation_results (
  result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES psychometric_validation_runs(run_id) ON DELETE CASCADE,
  pipeline_version_id UUID NOT NULL REFERENCES psychometric_pipeline_versions(pipeline_version_id) ON DELETE RESTRICT,
  session_id UUID REFERENCES sessions(session_id) ON DELETE SET NULL,
  pseudonym VARCHAR(64),
  cohort VARCHAR(50) NOT NULL,
  model_version VARCHAR(50) NOT NULL,
  rules_version VARCHAR(50) NOT NULL,
  threshold_version VARCHAR(50) NOT NULL,
  predicted_score NUMERIC NOT NULL,
  threshold_used NUMERIC NOT NULL,
  predicted_positive BOOLEAN NOT NULL,
  reference_score NUMERIC,
  reference_positive BOOLEAN NOT NULL,
  confusion_bucket VARCHAR(2) CHECK (confusion_bucket IN ('TP','TN','FP','FN')),
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_psy_runs_pipeline ON psychometric_validation_runs (pipeline_version_id, run_date DESC);
CREATE INDEX IF NOT EXISTS idx_psy_results_run ON psychometric_validation_results (run_id, cohort, model_version);
CREATE INDEX IF NOT EXISTS idx_psy_results_pipeline ON psychometric_validation_results (pipeline_version_id, threshold_version);

-- Post-pilot calibrated thresholds (v2026_04_pilot_r1)
INSERT INTO active_threshold_versions(threshold_domain, threshold_version, activated_at, notes)
VALUES ('risk_detection', 'v2026_04_pilot_r1', now(), 'Activated after pilot recalibration')
ON CONFLICT (threshold_domain)
DO UPDATE SET threshold_version = EXCLUDED.threshold_version,
              activated_at = EXCLUDED.activated_at,
              notes = EXCLUDED.notes;

INSERT INTO active_threshold_versions(threshold_domain, threshold_version, activated_at, notes)
VALUES ('score_banding', 'v2026_04_score_r1', now(), 'Score bands recalibrated after pilot')
ON CONFLICT (threshold_domain)
DO UPDATE SET threshold_version = EXCLUDED.threshold_version,
              activated_at = EXCLUDED.activated_at,
              notes = EXCLUDED.notes;

INSERT INTO clinical_thresholds(
  threshold_domain,
  threshold_version,
  risk_type,
  threshold_value,
  score_min,
  score_max,
  calibrated_at,
  rationale,
  is_active
)
VALUES
  ('risk_detection', 'v2026_04_pilot_r1', 'PHQ9_ITEM9_SELFHARM', 0.18, 0.00, 1.00, now(), 'Pilot sensitivity uplift while preserving specificity', TRUE),
  ('risk_detection', 'v2026_04_pilot_r1', 'GDS7_SOCIAL_ISOLATION', 0.26, 0.00, 1.00, now(), 'Pilot calibration to reduce FN in social isolation cohort', TRUE)
ON CONFLICT (threshold_domain, threshold_version, risk_type)
DO UPDATE SET threshold_value = EXCLUDED.threshold_value,
              score_min = EXCLUDED.score_min,
              score_max = EXCLUDED.score_max,
              calibrated_at = EXCLUDED.calibrated_at,
              rationale = EXCLUDED.rationale,
              is_active = EXCLUDED.is_active;

INSERT INTO clinical_thresholds(
  threshold_domain,
  threshold_version,
  risk_type,
  threshold_value,
  score_min,
  score_max,
  calibrated_at,
  rationale,
  is_active
)
VALUES
  ('score_banding', 'v2026_04_score_r1', 'CLINICAL_SCORE_LOW', 0.30, 0.00, 1.00, now(), 'Pilot calibrated lower limit for low concern', TRUE),
  ('score_banding', 'v2026_04_score_r1', 'CLINICAL_SCORE_MODERATE', 0.55, 0.00, 1.00, now(), 'Pilot calibrated moderate threshold', TRUE),
  ('score_banding', 'v2026_04_score_r1', 'CLINICAL_SCORE_HIGH', 0.78, 0.00, 1.00, now(), 'Pilot calibrated high-risk threshold', TRUE)
ON CONFLICT (threshold_domain, threshold_version, risk_type)
DO UPDATE SET threshold_value = EXCLUDED.threshold_value,
              score_min = EXCLUDED.score_min,
              score_max = EXCLUDED.score_max,
              calibrated_at = EXCLUDED.calibrated_at,
              rationale = EXCLUDED.rationale,
              is_active = EXCLUDED.is_active;

-- Ensure only one active threshold version per risk type in domain.
UPDATE clinical_thresholds
SET is_active = CASE WHEN threshold_version = 'v2026_04_pilot_r1' THEN TRUE ELSE FALSE END
WHERE threshold_domain = 'risk_detection';

UPDATE clinical_thresholds
SET is_active = CASE WHEN threshold_version = 'v2026_04_score_r1' THEN TRUE ELSE FALSE END
WHERE threshold_domain = 'score_banding';

-- Trigger helper to resolve active threshold
CREATE OR REPLACE FUNCTION fn_get_active_clinical_threshold(
  p_risk_type TEXT,
  p_default NUMERIC,
  p_domain TEXT DEFAULT 'risk_detection'
)
RETURNS NUMERIC AS $$
DECLARE
  v_threshold NUMERIC;
BEGIN
  SELECT ct.threshold_value
  INTO v_threshold
  FROM clinical_thresholds ct
  JOIN active_threshold_versions atv
    ON atv.threshold_domain = ct.threshold_domain
   AND atv.threshold_version = ct.threshold_version
  WHERE ct.threshold_domain = p_domain
    AND ct.risk_type = p_risk_type
    AND ct.is_active = TRUE
  ORDER BY ct.calibrated_at DESC
  LIMIT 1;

  RETURN COALESCE(v_threshold, p_default);
END;
$$ LANGUAGE plpgsql;

-- Replace risk detection trigger function to use calibrated thresholds.
CREATE OR REPLACE FUNCTION fn_clinical_mappings_after_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_score NUMERIC;
  v_threshold_phq9 NUMERIC;
  v_threshold_gds7 NUMERIC;
BEGIN
  v_score := (COALESCE(NEW.weight,0) * COALESCE(NEW.confidence,0));
  v_threshold_phq9 := fn_get_active_clinical_threshold('PHQ9_ITEM9_SELFHARM', 0.2);
  v_threshold_gds7 := fn_get_active_clinical_threshold('GDS7_SOCIAL_ISOLATION', 0.3);

  IF (NEW.scale = 'PHQ' AND NEW.item = 9 AND v_score >= v_threshold_phq9) THEN
    INSERT INTO risk_events(session_id, decision_id, risk_type, score, threshold_used, action_taken, notified)
    SELECT d.session_id, NEW.decision_id, 'PHQ9_ITEM9_SELFHARM', v_score, v_threshold_phq9, 'AUTO_INSERT', FALSE
    FROM decisions d
    WHERE d.decision_id = NEW.decision_id;
  END IF;

  IF (NEW.scale = 'GDS' AND NEW.item = 7 AND v_score >= v_threshold_gds7) THEN
    INSERT INTO risk_events(session_id, decision_id, risk_type, score, threshold_used, action_taken, notified)
    SELECT d.session_id, NEW.decision_id, 'GDS7_SOCIAL_ISOLATION', v_score, v_threshold_gds7, 'AUTO_INSERT', FALSE
    FROM decisions d
    WHERE d.decision_id = NEW.decision_id
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
