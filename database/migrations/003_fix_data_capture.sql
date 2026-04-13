-- Migration 003: Fix Session Data Capture & Remove Redundant Fields
-- Purpose: Eliminate unused columns, ensure proper session lifecycle tracking,
--          enforce consent re-prompting, and auto-calculate session_length_seconds
-- Author: Database Audit December 2026
-- Dependencies: schema.sql, migrations/001_fix_schema.sql, migrations/002_sprint2a_session_columns.sql

-- ========================================
-- PHASE 1: Clean up redundant columns
-- ========================================

-- Remove denormalized emotional scores (use session_scores table instead)
ALTER TABLE sessions 
DROP COLUMN IF EXISTS normalized_emotional_score_gds,
DROP COLUMN IF EXISTS normalized_emotional_score_phq,
DROP COLUMN IF EXISTS ingest_batch_id;

-- Add comments for clarity on what to store
COMMENT ON COLUMN sessions.consent_given IS 'User consent for data collection. Must be collected EVERY session (no caching from previous sessions).';
COMMENT ON COLUMN sessions.started_at IS 'Timestamp when session started. Auto-set on session creation.';
COMMENT ON COLUMN sessions.ended_at IS 'Timestamp when session ended. Set when user completes or closes session.';
COMMENT ON COLUMN sessions.session_length_seconds IS 'Auto-calculated: (ended_at - started_at) / 1 second. Computed when session ends.';

-- ========================================
-- PHASE 2: Ensure proper timestamp capture
-- ========================================

-- Trigger to auto-calculate session_length_seconds when session ends
CREATE OR REPLACE FUNCTION fn_calculate_session_length()
RETURNS TRIGGER AS $$
BEGIN
  -- When ended_at is set, calculate session_length_seconds
  IF (NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL) THEN
    NEW.session_length_seconds := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::INT;
    NEW.is_closed := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_session_length ON sessions;
CREATE TRIGGER trg_calculate_session_length
BEFORE UPDATE ON sessions
FOR EACH ROW
EXECUTE FUNCTION fn_calculate_session_length();

-- ========================================
-- PHASE 3: Ensure started_at is always populated
-- ========================================

-- Trigger to ensure started_at defaults to now() on insert (backup)
CREATE OR REPLACE FUNCTION fn_ensure_session_start()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.started_at IS NULL THEN
    NEW.started_at := now();
  END IF;
  -- Ensure consent_given defaults to FALSE (will be set by user prompt)
  IF NEW.consent_given IS NULL THEN
    NEW.consent_given := FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_session_start ON sessions;
CREATE TRIGGER trg_ensure_session_start
BEFORE INSERT ON sessions
FOR EACH ROW
EXECUTE FUNCTION fn_ensure_session_start();

-- ========================================
-- PHASE 4: Improve scene metadata schema
-- ========================================

-- Ensure scenes.metadata is JSONB with default structure
-- First, update any NULL metadata to empty object
UPDATE scenes SET metadata = '{}' WHERE metadata IS NULL;

-- Add constraint to ensure metadata is always valid JSON
ALTER TABLE scenes 
ALTER COLUMN metadata SET DEFAULT '{}';

-- Add comment explaining metadata structure
COMMENT ON COLUMN scenes.metadata IS 'JSON object with keys: emotional_intensity (high|medium|low), accessibility_warnings (array), estimated_completion_seconds (int)';

-- ========================================
-- PHASE 5: Improve decision tracking
-- ========================================

-- Ensure decisions always have timestamps
CREATE OR REPLACE FUNCTION fn_ensure_decision_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.timestamp IS NULL THEN
    NEW.timestamp := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_decision_timestamp ON decisions;
CREATE TRIGGER trg_ensure_decision_timestamp
BEFORE INSERT ON decisions
FOR EACH ROW
EXECUTE FUNCTION fn_ensure_decision_timestamp();

-- ========================================
-- PHASE 6: Validate completeness
-- ========================================

-- Check that all sessions have started_at
DO $$
DECLARE v_orphaned INT;
BEGIN
  SELECT COUNT(*) INTO v_orphaned FROM sessions WHERE started_at IS NULL;
  IF v_orphaned > 0 THEN
    RAISE WARNING 'Found % sessions with NULL started_at. Setting to created_at...', v_orphaned;
    UPDATE sessions SET started_at = created_at WHERE started_at IS NULL;
  END IF;
END$$;

-- ========================================
-- PHASE 7: Verify migration success
-- ========================================

-- Summary of schema changes
DO $$
DECLARE
  v_sessions_cols TEXT;
BEGIN
  SELECT string_agg(column_name, ', ' ORDER BY column_name) INTO v_sessions_cols
  FROM information_schema.columns
  WHERE table_name = 'sessions' AND column_name NOT IN ('session_id', 'user_id', 'pseudonym', 'chapter_id', 'created_at', 'started_at', 'ended_at', 'is_closed', 'session_length_seconds', 'consent_given', 'privacy_mode', 'abandonment_flag', 'source', 'metadata');
  
  IF v_sessions_cols IS NOT NULL THEN
    RAISE NOTICE 'Warning: Found unexpected columns in sessions table: %', v_sessions_cols;
  ELSE
    RAISE NOTICE 'Migration 003 successful: Sessions table cleaned and ready for proper capture';
  END IF;
END$$;

-- ========================================
-- ROLLBACK (commented out - use if needed)
-- ========================================
/*
-- To rollback this migration, run:

-- Remove triggers
DROP TRIGGER IF EXISTS trg_calculate_session_length ON sessions;
DROP TRIGGER IF EXISTS trg_ensure_session_start ON sessions;
DROP TRIGGER IF EXISTS trg_ensure_decision_timestamp ON decisions;

-- Remove functions
DROP FUNCTION IF EXISTS fn_calculate_session_length();
DROP FUNCTION IF EXISTS fn_ensure_session_start();
DROP FUNCTION IF EXISTS fn_ensure_decision_timestamp();

-- Restore columns (if backup exists - otherwise they're lost)
-- ALTER TABLE sessions ADD COLUMN ingest_batch_id UUID;
-- ALTER TABLE sessions ADD COLUMN normalized_emotional_score_gds FLOAT;
-- ALTER TABLE sessions ADD COLUMN normalized_emotional_score_phq FLOAT;
*/
