-- Deployment script for Phase 1: users + auth_tokens + example RLS
--
-- EXECUTION ORDER (Critical):
--   1. database/schema.sql (base schema creation)
--   2. database/migrations/001_fix_schema.sql (apply Sprint 0a/0b/0c updates)
--   3. database/indexes.sql (create all performance indexes)
--   4. database/audit_triggers.sql (create/update all triggers and functions)
--   5. database/seed_data.sql (populate initial content)
--   6. THIS FILE: deploy.sql (users, auth, RLS policies)
--
-- See database/migrations/README.md for detailed guidance and validation queries.
--
-- If you want to rebuild from scratch, you can drop all tables with:
-- DROP TABLE IF EXISTS decision_ratings, session_scores, clinical_mappings, decisions, options, scenes, chapters, audio_metrics, risk_events, decision_audit, sessions, users, auth_tokens CASCADE;

-- Users table (prototype)
CREATE TABLE IF NOT EXISTS users (
  user_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pseudonym text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Short-lived tokens for prototype login flow
CREATE TABLE IF NOT EXISTS auth_tokens (
  token uuid PRIMARY KEY,
  pseudonym text NOT NULL REFERENCES users(pseudonym) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- Example: ensure audio_metrics inserts only when session has consent
-- Assumes table audio_metrics(session_id uuid, audio_path text, ...)
-- Create policy: allow inserts only if the referenced session has consent_given = true
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    -- roles are managed by Supabase; skip creation here
    RAISE NOTICE 'Skipping role creation in script; use Supabase console for role management';
  END IF;
END$$;

-- Policy example: insert_audio_if_consented
-- Note: run this in Supabase SQL editor after confirming `audio_metrics` exists
--
-- CREATE POLICY insert_audio_if_consented ON audio_metrics
-- FOR INSERT USING (
--   EXISTS (
--     SELECT 1 FROM sessions s WHERE s.session_id = audio_metrics.session_id AND s.consent_given = true
--   )
-- );

-- Policy example: restrict reading decision_audit to clinicians/service_role
-- CREATE POLICY select_audit_clinician ON decision_audit
-- FOR SELECT USING (
--   current_setting('jwt.claims.role', true) = 'clinician' OR current_setting('role', true) = 'service_role'
-- );

-- Indexes to speed lookups
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires ON auth_tokens (expires_at);

-- Helper seed: create a test user for local dev
INSERT INTO users (pseudonym)
SELECT 'test-user-1'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE pseudonym = 'test-user-1');

-- Note: adapt RLS policies to your Supabase project's JWT claims and roles.
