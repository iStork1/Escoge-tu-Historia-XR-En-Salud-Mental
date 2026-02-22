-- ========================================================================
-- Migration 001: Fix Schema Constraints, Add Missing Columns & Triggers
-- Covers Sprint 0a, 0b, 0c
-- ========================================================================
-- Purpose:
--   - Sprint 0a: Add FK constraints, missing columns (next_chapter_id, 
--     next_scene_id, consequence), rename designer_mapping to gds_mapping
--   - Sprint 0b: Create triggers for session_scores computation and 
--     GDS-15 item 7 risk detection
--   - Run this migration on staging before applying to production

-- ========================================================================
-- SPRINT 0a: CORE CONSTRAINTS & MISSING COLUMNS
-- ========================================================================

-- Step 1: Add FK constraint to decisions.chapter_id (was missing)
ALTER TABLE decisions 
ADD CONSTRAINT fk_decisions_chapter_id 
FOREIGN KEY (chapter_id) REFERENCES chapters(chapter_id) ON DELETE CASCADE;

-- Step 2: Add FK constraint to decisions.scene_id (make oncascade for safety)
ALTER TABLE decisions DROP CONSTRAINT IF EXISTS fk_decisions_scene_id;
ALTER TABLE decisions 
ADD CONSTRAINT fk_decisions_scene_id 
FOREIGN KEY (scene_id) REFERENCES scenes(scene_id) ON DELETE CASCADE;

-- Step 3: Add FK constraint to decisions.option_id (make oncascade for safety)
ALTER TABLE decisions DROP CONSTRAINT IF EXISTS fk_decisions_option_id;
ALTER TABLE decisions 
ADD CONSTRAINT fk_decisions_option_id 
FOREIGN KEY (option_id) REFERENCES options(option_id) ON DELETE CASCADE;

-- Step 4: Add missing columns to options table
-- NOTE: If columns already exist, ALTER will fail; use IF NOT EXISTS (Postgres 14+)
-- For Postgres < 14, errors will be in the log but won't stop migration

DO $$
BEGIN
  -- Add next_chapter_id column
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'options' AND column_name = 'next_chapter_id'
  ) THEN
    ALTER TABLE options ADD COLUMN next_chapter_id TEXT REFERENCES chapters(chapter_id) ON DELETE SET NULL;
  END IF;
  
  -- Add next_scene_id column
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'options' AND column_name = 'next_scene_id'
  ) THEN
    ALTER TABLE options ADD COLUMN next_scene_id TEXT REFERENCES scenes(scene_id) ON DELETE SET NULL;
  END IF;
  
  -- Add consequence column
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'options' AND column_name = 'consequence'
  ) THEN
    ALTER TABLE options ADD COLUMN consequence TEXT;
  END IF;
  
  -- Rename designer_mapping to gds_mapping
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'options' AND column_name = 'designer_mapping'
  ) THEN
    ALTER TABLE options RENAME COLUMN designer_mapping TO gds_mapping;
  END IF;
END $$;

-- ========================================================================
-- SPRINT 0b: FIX TRIGGERS & DENORMALIZATION
-- ========================================================================

-- Step 5: Create/replace trigger for session_scores computation (new)
CREATE OR REPLACE FUNCTION fn_compute_session_scores()
RETURNS TRIGGER AS $$
DECLARE
  v_session_id UUID;
  v_gds_total NUMERIC;
  v_phq_total NUMERIC;
BEGIN
  -- Determine which session to update based on which table fired the trigger
  IF TG_TABLE_NAME = 'decisions' THEN
    v_session_id := NEW.session_id;
  ELSIF TG_TABLE_NAME = 'clinical_mappings' THEN
    v_session_id := (SELECT session_id FROM decisions WHERE decision_id = NEW.decision_id);
  END IF;

  -- If no valid session, skip (e.g., when inserting designer mappings at startup)
  IF v_session_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate GDS total: sum of (weight * confidence) for all GDS mappings in this session
  SELECT COALESCE(SUM(cm.weight * cm.confidence), 0)
  INTO v_gds_total
  FROM clinical_mappings cm
  JOIN decisions d ON cm.decision_id = d.decision_id
  WHERE d.session_id = v_session_id AND cm.scale = 'GDS';

  -- Calculate PHQ total: sum of (weight * confidence) for all PHQ mappings in this session
  SELECT COALESCE(SUM(cm.weight * cm.confidence), 0)
  INTO v_phq_total
  FROM clinical_mappings cm
  JOIN decisions d ON cm.decision_id = d.decision_id
  WHERE d.session_id = v_session_id AND cm.scale = 'PHQ';

  -- Upsert into session_scores
  INSERT INTO session_scores(session_id, gds_total, phq_total, computed_at)
  VALUES (v_session_id, v_gds_total, v_phq_total, now())
  ON CONFLICT (session_id) DO UPDATE
  SET gds_total = EXCLUDED.gds_total,
      phq_total = EXCLUDED.phq_total,
      computed_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger on decisions insert
DROP TRIGGER IF EXISTS trg_compute_session_scores_on_decision ON decisions;
CREATE TRIGGER trg_compute_session_scores_on_decision
AFTER INSERT ON decisions
FOR EACH ROW EXECUTE FUNCTION fn_compute_session_scores();

-- Attach trigger on clinical_mappings insert
DROP TRIGGER IF EXISTS trg_compute_session_scores_on_mapping ON clinical_mappings;
CREATE TRIGGER trg_compute_session_scores_on_mapping
AFTER INSERT ON clinical_mappings
FOR EACH ROW EXECUTE FUNCTION fn_compute_session_scores();

-- Step 6: Update risk detection trigger to include GDS-15 item 7 (social isolation)
CREATE OR REPLACE FUNCTION fn_clinical_mappings_after_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- PHQ-9 item 9 (self-harm) detection
  IF (NEW.scale = 'PHQ' AND NEW.item = 9 AND (COALESCE(NEW.weight,0) * COALESCE(NEW.confidence,0)) >= 0.2) THEN
    INSERT INTO risk_events(session_id, decision_id, risk_type, score, threshold_used, action_taken, notified)
    SELECT
      d.session_id,
      NEW.decision_id,
      'PHQ9_ITEM9_SELFHARM',
      (COALESCE(NEW.weight,0) * COALESCE(NEW.confidence,0)),
      0.2,
      'AUTO_INSERT',
      FALSE
    FROM decisions d
    WHERE d.decision_id = NEW.decision_id;
  END IF;
  
  -- GDS-15 item 7 (social engagement / isolation) detection
  IF (NEW.scale = 'GDS' AND NEW.item = 7 AND (COALESCE(NEW.weight,0) * COALESCE(NEW.confidence,0)) >= 0.3) THEN
    INSERT INTO risk_events(session_id, decision_id, risk_type, score, threshold_used, action_taken, notified)
    SELECT
      d.session_id,
      NEW.decision_id,
      'GDS7_SOCIAL_ISOLATION',
      (COALESCE(NEW.weight,0) * COALESCE(NEW.confidence,0)),
      0.3,
      'AUTO_INSERT',
      FALSE
    FROM decisions d
    WHERE d.decision_id = NEW.decision_id
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clinical_mappings_after_insert ON clinical_mappings;
CREATE TRIGGER trg_clinical_mappings_after_insert
AFTER INSERT ON clinical_mappings
FOR EACH ROW EXECUTE FUNCTION fn_clinical_mappings_after_insert();

-- ========================================================================
-- INDEXES: Ensure critical indexes exist for performance
-- ========================================================================

-- Index on decisions for fast lookup by session and timestamp
CREATE INDEX IF NOT EXISTS idx_decisions_session_timestamp ON decisions(session_id, timestamp DESC);

-- Index on clinical_mappings for risk detection queries
CREATE INDEX IF NOT EXISTS idx_clinical_mappings_scale_item ON clinical_mappings(scale, item);

-- Index on risk_events for clinician reporting
CREATE INDEX IF NOT EXISTS idx_risk_events_timestamp ON risk_events(timestamp DESC);

-- Index on decisions by chapter for narrative analysis
CREATE INDEX IF NOT EXISTS idx_decisions_chapter ON decisions(chapter_id);

-- ========================================================================
-- VALIDATION QUERIES (run after migration to confirm)
-- ========================================================================

-- Verify columns exist
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'options' AND column_name IN ('next_chapter_id', 'next_scene_id', 'consequence', 'gds_mapping') ORDER BY column_name;

-- Verify FK constraints exist
-- SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'decisions' AND constraint_type = 'FOREIGN KEY';

-- Verify triggers exist
-- SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'clinical_mappings' OR event_object_table = 'decisions';

-- ========================================================================
-- END OF MIGRATION 001
-- ========================================================================
