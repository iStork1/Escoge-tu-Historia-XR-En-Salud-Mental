-- Schema for "Escoje tu Historia" (Supabase/Postgres)
-- Includes tables, extensions, and example RLS policies

-- Enable extensions (run once per DB)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- SETTINGS / CONSTANTS (adjust in migration or app config)
-- phq9_item9 risk threshold used by triggers/logic: 0.2

-- Sessions: one row per play session
CREATE TABLE IF NOT EXISTS sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pseudonym VARCHAR(64) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  session_length_seconds INT,
  consent_given BOOLEAN DEFAULT FALSE,
  privacy_mode VARCHAR(20) CHECK (privacy_mode IN ('anonymous','tracking')) DEFAULT 'anonymous',
  abandonment_flag BOOLEAN DEFAULT FALSE,
  chapter_id VARCHAR(50),
  source VARCHAR(50) DEFAULT 'alexa',
  ingest_batch_id UUID,
  normalized_emotional_score_gds FLOAT,
  normalized_emotional_score_phq FLOAT,
  metadata JSONB
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
  timestamp TIMESTAMPTZ DEFAULT now(),
  chapter_id VARCHAR(50),
  scene_id VARCHAR(100),
  option_id VARCHAR(100),
  option_text TEXT,
  time_to_decision_ms INT,
  mapping_confidence FLOAT CHECK (mapping_confidence >= 0 AND mapping_confidence <= 1),
  validation_steps TEXT[],
  risk_flags TEXT[],
  raw_mapping JSONB
);

-- Clinical mappings: denormalized entries for analysis
CREATE TABLE IF NOT EXISTS clinical_mappings (
  mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES decisions(decision_id) ON DELETE CASCADE,
  scale VARCHAR(10) CHECK (scale IN ('GDS','PHQ')),
  item INT,
  weight FLOAT,
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  primary_construct VARCHAR(100),
  rationale TEXT,
  validated BOOLEAN DEFAULT FALSE
);

-- Risk events table
CREATE TABLE IF NOT EXISTS risk_events (
  risk_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(session_id) ON DELETE CASCADE,
  decision_id UUID REFERENCES decisions(decision_id),
  timestamp TIMESTAMPTZ DEFAULT now(),
  risk_type VARCHAR(50),
  score FLOAT,
  threshold_used FLOAT,
  action_taken VARCHAR(100),
  notified BOOLEAN DEFAULT FALSE,
  resolved BOOLEAN DEFAULT FALSE,
  notes TEXT
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
