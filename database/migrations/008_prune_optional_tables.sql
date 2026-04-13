-- ========================================================================
-- Migration 008: Prune Optional / Unused Tables (MVP cleanup)
-- Purpose:
--   - Remove tables that are not referenced by the runtime backend today.
--   - Keep core gameplay + telemetry tables intact.
--
-- Notes:
--   - This migration is intentionally conservative: it drops ONLY optional features.
--   - If you later decide to bring these features back, revert by re-running the
--     original migrations/schema that create them.
-- ========================================================================

-- ================================
-- A) Clinician review dashboard (optional)
-- ================================
-- Views depend on clinical_mapping_reviews/reviewers.
DROP VIEW IF EXISTS v_mapping_training_ready;
DROP VIEW IF EXISTS v_mapping_review_stats;
DROP VIEW IF EXISTS v_mapping_review_queue;

-- Drop tables (order matters for FKs).
DROP TABLE IF EXISTS clinical_mapping_reviews;
DROP TABLE IF EXISTS reviewers;

-- Trigger helper function from migration 007 (safe to drop if unused elsewhere).
DROP FUNCTION IF EXISTS fn_set_review_updated_at();

-- ================================
-- B) Audio metrics (optional)
-- ================================
-- Not referenced by backend code at the moment.
DROP TABLE IF EXISTS audio_metrics;
