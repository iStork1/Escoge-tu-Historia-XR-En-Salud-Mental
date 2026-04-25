-- Schema for "Escoje tu Historia" (Supabase/Postgres)
-- Includes tables, extensions, and example RLS policies

-- Enable extensions (run once per DB)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- SETTINGS / CONSTANTS
-- Risk thresholds are versioned in clinical_thresholds and selected via active_threshold_versions.

-- Users (separate identity table)
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pseudonym VARCHAR(64) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB
);

-- Chapters / Scenes / Options: canonical story structure
-- (must be created before sessions, decisions, etc. that reference them)
CREATE TABLE IF NOT EXISTS chapters (
  chapter_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  "order" INT,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS scenes (
  scene_id TEXT PRIMARY KEY,
  chapter_id TEXT REFERENCES chapters(chapter_id) ON DELETE CASCADE,
  title TEXT,
  "order" INT,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS options (
  option_id TEXT PRIMARY KEY,
  scene_id TEXT REFERENCES scenes(scene_id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  consequence TEXT,
  next_chapter_id TEXT REFERENCES chapters(chapter_id) ON DELETE SET NULL,
  next_scene_id TEXT REFERENCES scenes(scene_id) ON DELETE SET NULL,
  gds_mapping JSONB,
  metadata JSONB
);

-- Sessions: one row per play session
CREATE TABLE IF NOT EXISTS sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  pseudonym VARCHAR(64) NOT NULL,
  chapter_id TEXT REFERENCES chapters(chapter_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  is_closed BOOLEAN DEFAULT FALSE,
  session_length_seconds INT,
  consent_given BOOLEAN DEFAULT FALSE,
  privacy_mode VARCHAR(20) CHECK (privacy_mode IN ('anonymous','tracking')) DEFAULT 'anonymous',
  abandonment_flag BOOLEAN DEFAULT FALSE,
  source VARCHAR(50) DEFAULT 'alexa',
  metadata JSONB,
  CONSTRAINT check_session_dates CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Decision audit: raw LLM requests/responses, validation, risk flags
CREATE TABLE IF NOT EXISTS decision_audit (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(session_id) ON DELETE CASCADE,
  decision_id UUID,
  timestamp TIMESTAMPTZ DEFAULT now(),
  llm_request JSONB,
  llm_response JSONB,
  validation_result JSONB,
  risk_flags TEXT[],
  pseudonym VARCHAR(64)
);

-- Decisions: one per user choice per scene
CREATE TABLE IF NOT EXISTS decisions (
  decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(session_id) ON DELETE CASCADE,
  chapter_id TEXT REFERENCES chapters(chapter_id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT now(),
  scene_id TEXT REFERENCES scenes(scene_id) ON DELETE CASCADE,
  option_id TEXT REFERENCES options(option_id) ON DELETE CASCADE,
  option_text TEXT,
  time_to_decision_ms INT,
  mapping_confidence FLOAT CHECK (mapping_confidence >= 0 AND mapping_confidence <= 1),
  validation_steps TEXT[],
  risk_flags TEXT[],
  raw_mapping JSONB
);

-- Decision ratings: concrete rating values derived from decisions (GDS/PHQ items)
CREATE TABLE IF NOT EXISTS decision_ratings (
  rating_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES decisions(decision_id) ON DELETE CASCADE,
  scale VARCHAR(10) CHECK (scale IN ('GDS','PHQ')) NOT NULL,
  item SMALLINT NOT NULL,
  value NUMERIC,
  derived BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Session scores: aggregated totals per session for fast reads
CREATE TABLE IF NOT EXISTS session_scores (
  session_id UUID PRIMARY KEY REFERENCES sessions(session_id) ON DELETE CASCADE,
  gds_total NUMERIC,
  phq_total NUMERIC,
  computed_at TIMESTAMPTZ DEFAULT now()
);

-- Clinical mappings: denormalized entries for analysis
CREATE TABLE IF NOT EXISTS clinical_mappings (
  mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id TEXT REFERENCES options(option_id) ON DELETE CASCADE,
  decision_id UUID REFERENCES decisions(decision_id) ON DELETE CASCADE,
  scale VARCHAR(10) CHECK (scale IN ('GDS','PHQ')),
  item INT,
  weight FLOAT,
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  primary_construct VARCHAR(100),
  rationale TEXT,
  mapping_source VARCHAR(20) CHECK (mapping_source IN ('designer','llm','heuristic')) DEFAULT 'llm',
  source_confidence FLOAT,
  validated BOOLEAN DEFAULT FALSE
);

-- Threshold versions and values for risk detection/recalibration (post-pilot)
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

-- Psychometric validation pipeline metadata and run lineage
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

-- Risk events table
CREATE TABLE IF NOT EXISTS risk_events (
  risk_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(session_id) ON DELETE CASCADE,
  decision_id UUID REFERENCES decisions(decision_id),
  timestamp TIMESTAMPTZ DEFAULT now(),
  detected_at TIMESTAMPTZ DEFAULT now(),
  risk_type VARCHAR(50),
  score FLOAT,
  threshold_used FLOAT,
  action_taken VARCHAR(100),
  notified BOOLEAN DEFAULT FALSE,
  resolved BOOLEAN DEFAULT FALSE,
  notified_at TIMESTAMPTZ,
  first_action_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  notification_attempts INT DEFAULT 0,
  escalation_level INT DEFAULT 0,
  sla_target_minutes INT DEFAULT 15,
  status VARCHAR(30) DEFAULT 'open' CHECK (status IN ('open','notified','in_progress','resolved','closed','overdue_notification','overdue_action','overdue_closure','escalated')),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS risk_event_notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_event_id UUID REFERENCES risk_events(risk_event_id) ON DELETE CASCADE,
  attempt_number INT NOT NULL,
  channel VARCHAR(30) NOT NULL,
  status VARCHAR(20) CHECK (status IN ('queued','sent','failed','acknowledged')) DEFAULT 'queued',
  provider_message_id TEXT,
  payload JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Aggregated user metrics for longitudinal analysis
CREATE TABLE IF NOT EXISTS user_metrics_aggregated (
  pseudonym VARCHAR(64) PRIMARY KEY,
  total_sessions INT DEFAULT 0,
  avg_session_length_seconds FLOAT,
  abandonment_rate FLOAT,
  avg_emotional_score_gds FLOAT,
  avg_emotional_score_phq FLOAT,
  last_risk_flag_date TIMESTAMPTZ,
  frequency_of_use_days INT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audio metrics (only if consent_given = true via RLS)
CREATE TABLE IF NOT EXISTS audio_metrics (
  audio_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(session_id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT now(),
  valence FLOAT,
  arousal FLOAT,
  sadness_score FLOAT,
  pause_durations_ms INT[],
  audio_path TEXT,
  audio_hash VARCHAR(128)
);

-- Example: enable RLS on audio_metrics (create policy via Supabase SQL editor)
-- ALTER TABLE audio_metrics ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "insert_audio_if_consented" ON audio_metrics
--   FOR INSERT USING (
--     EXISTS (
--       SELECT 1 FROM sessions s WHERE s.session_id = audio_metrics.session_id AND s.consent_given = true
--     )
--   );

-- NOTES: materialized views and triggers can populate user_metrics_aggregated.
