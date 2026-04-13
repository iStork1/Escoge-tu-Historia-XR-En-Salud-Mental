# Database Migrations Guide

## Overview
This folder contains all database migration scripts for "Escoje tu Historia". Migrations are numbered sequentially and designed to be idempotent (safe to re-run).

## Current Migrations

### 009_stable_scores_and_dashboard_metrics.sql 🆕
**Status**: Ready to apply after `008_prune_optional_tables.sql`

**What it does**:
- Replaces `fn_compute_session_scores()` with bounded and stable semantics:
  - GDS total bounded to `[0, 15]`
  - PHQ total bounded to `[0, 27]`
  - Prefers `decision_ratings` as source of truth when present, falls back to `clinical_mappings`
- Adds trigger `trg_compute_session_scores_on_decision_rating` on `decision_ratings` (`AFTER INSERT OR UPDATE`)
- Replaces `fn_sessions_after_update()` to aggregate from `session_scores` when session closes (instead of deprecated normalized columns)
- Replaces `dashboard_sessions` view with richer score metrics (`avg/max totals` + normalized averages)

**When to run**:
1. After baseline schema + previous migrations
2. After backend update that writes `decision_ratings`

**Verify it worked**:
```sql
-- Trigger exists
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_name = 'trg_compute_session_scores_on_decision_rating';

-- Stable score bounds
SELECT
  MAX(gds_total) AS max_gds,
  MAX(phq_total) AS max_phq,
  MIN(gds_total) AS min_gds,
  MIN(phq_total) AS min_phq
FROM session_scores;
-- Expected: max_gds <= 15, max_phq <= 27, mins >= 0

-- View exposes new columns
SELECT * FROM dashboard_sessions LIMIT 1;
```

### 001_fix_schema.sql ✅ (APPLIED 2026-02-22)
**Status**: Production-ready after staging validation

**What it does**:
- Adds foreign key constraints for data integrity
- Adds 3 new columns to `options` table: `consequence`, `next_chapter_id`, `next_scene_id`
- Renames `options.designer_mapping` → `options.gds_mapping` for clarity
- Creates trigger for automatic `session_scores` computation
- Adds GDS-15 item 7 risk detection (social isolation)
- Creates/updates all supporting indexes

**When to run**:
1. **First time**: After `schema.sql`, `indexes.sql`, `views.sql`, `audit_triggers.sql`
2. **Already applied?**: Safe to re-run (idempotent); will not cause errors

**How to run**:
```bash
# Option 1: Supabase SQL Editor (recommended)
1. Open Supabase dashboard → SQL Editor
2. Copy & paste contents of 001_fix_schema.sql
3. Run all queries
4. Check completion message at bottom

# Option 2: Command line (psql)
psql -h your-host.supabase.co -U postgres -d postgres -f ./001_fix_schema.sql

# Option 3: Node.js script
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabase = createClient(URL, KEY);
const sql = fs.readFileSync('./001_fix_schema.sql', 'utf8');
const queries = sql.split(';').filter(q => q.trim());
for (const query of queries) {
  await supabase.rpc('exec', { sql: query });
}
```

**Verify it worked**:
```sql
-- Check columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'options' 
ORDER BY column_name;
-- Expected: audio_hash, audio_id, audio_path, arousal, ... consequence, created_at, gds_mapping, metadata, next_chapter_id, next_scene_id, ...

-- Check foreign keys
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'decisions' AND constraint_type = 'FOREIGN KEY';
-- Expected: fk_decisions_chapter_id, fk_decisions_option_id, fk_decisions_option_id, fk_decisions_session_id

-- Check triggers
SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = 'public';
-- Expected: trg_clinical_mappings_after_insert, trg_compute_session_scores_on_decision, trg_compute_session_scores_on_mapping, trg_decisions_after_insert, trg_sessions_after_update

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'options';
-- Expected: idx_options_next_chapter, idx_options_next_scene, idx_options_scene, ...
```

**Rollback** (if something goes wrong):
```sql
-- Drop new constraints
ALTER TABLE decisions DROP CONSTRAINT IF EXISTS fk_decisions_chapter_id;

-- Drop new columns
ALTER TABLE options DROP COLUMN IF EXISTS consequence;
ALTER TABLE options DROP COLUMN IF EXISTS next_chapter_id;
ALTER TABLE options DROP COLUMN IF EXISTS next_scene_id;

-- Rename back
ALTER TABLE options RENAME COLUMN gds_mapping TO designer_mapping;

-- Drop triggers
DROP TRIGGER IF EXISTS trg_compute_session_scores_on_decision ON decisions;
DROP TRIGGER IF EXISTS trg_compute_session_scores_on_mapping ON clinical_mappings;
DROP FUNCTION IF EXISTS fn_compute_session_scores() CASCADE;

-- Drop indexes
DROP INDEX IF EXISTS idx_decisions_chapter_id;
DROP INDEX IF EXISTS idx_options_next_chapter;
DROP INDEX IF EXISTS idx_options_next_scene;
-- ... etc for other new indexes
```

---

## Migration Checklist

Before deploying any migration to production:

- [ ] Run on staging environment first
- [ ] Run validation queries (see above)
- [ ] Test related endpoints (POST /telemetry, PUT /sessions/{id}/close)
- [ ] Monitor application logs for errors
- [ ] Verify data integrity (no orphaned records)
- [ ] Get approval from technical lead
- [ ] Schedule maintenance window if downtime needed
- [ ] Have rollback script ready
- [ ] Document any issues in CHANGES_SUMMARY.md

---

### 002_sprint2a_session_columns.sql ✅ (APPLIED 2026-02-23)
**Status**: Production-ready; essential for session lifecycle tracking

**What it does**:
- Adds `is_closed` BOOLEAN column to sessions table (tracks when session has been ended)
- Adds `created_at` TIMESTAMPTZ column to sessions table (marks when session record was created)
- Sets defaults: `is_closed = FALSE`, `created_at = now()`

**When to run**:
1. **First time**: After `schema.sql`, before `migrations/003_fix_data_capture.sql`
2. **Already applied?**: Safe to re-run (idempotent, uses `IF NOT EXISTS`)

**How to run**:
```bash
# Option 1: Supabase SQL Editor (recommended)
1. Open Supabase dashboard → SQL Editor
2. Copy & paste contents of 002_sprint2a_session_columns.sql
3. Run query
4. Check table structure

# Option 2: psql
psql -h your-host.supabase.co -U postgres -d postgres -f ./002_sprint2a_session_columns.sql
```

**Verify it worked**:
```sql
-- Check new columns exist
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'sessions' AND column_name IN ('is_closed', 'created_at')
ORDER BY ordinal_position;
-- Expected: is_closed (boolean, default FALSE), created_at (timestamp with time zone, default now())
```

**Rollback**:
```sql
ALTER TABLE sessions DROP COLUMN IF EXISTS is_closed;
ALTER TABLE sessions DROP COLUMN IF EXISTS created_at;
```

---

### 003_fix_data_capture.sql ✅ (CREATED 2026-02-23)
**Status**: Production-ready; critical for data integrity and consent management

**What it does**:
- **Removes redundant columns**: `ingest_batch_id`, `normalized_emotional_score_gds`, `normalized_emotional_score_phq` (replaced by session_scores table)
- **Adds constraints**: `CHECK (ended_at IS NULL OR ended_at >= started_at)` — ensures date logic integrity
- **Creates session lifecycle triggers**:
  - `fn_calculate_session_length()` — Auto-calculates `session_length_seconds` when session ends
  - `fn_ensure_session_start()` — Guarantees `started_at` is populated; **resets `consent_given = FALSE` per session** (prevents consent caching)
  - `fn_ensure_decision_timestamp()` — Auto-populates `created_at` on decision insert
- **Improves scenes.metadata**: Adds structure for `emotional_intensity`, `accessibility_warnings`, `estimated_completion_seconds`
- **Improves decision tracking**: Validates that all decision fields (time_to_decision_ms, mapping_confidence, validation_steps, risk_flags) are available for backend population

**Critical Behavior Changes**:
- ⚠️ **Consent reset**: Every new session starts with `consent_given = FALSE` (no caching from prior sessions)
- ⚠️ **Session length**: Auto-calculated on session end (backend should call `PUT /sessions/{id}/close` to trigger)
- ⚠️ **Decision timestamps**: Auto-populated; backend should not try to set them manually

**When to run**:
1. **First time**: After `migrations/001_fix_schema.sql` AND `migrations/002_sprint2a_session_columns.sql`
2. **Already applied?**: Safe to re-run (idempotent, uses `IF EXISTS` and `DROP TRIGGER IF EXISTS`)

**How to run**:
```bash
# Option 1: Supabase SQL Editor (recommended)
1. Open Supabase dashboard → SQL Editor
2. Copy & paste contents of 003_fix_data_capture.sql
3. Run all queries
4. Check completion message

# Option 2: psql
psql -h your-host.supabase.co -U postgres -d postgres -f ./003_fix_data_capture.sql
```

**Verify it worked**:
```sql
-- Check redundant columns REMOVED
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'sessions' 
AND column_name IN ('ingest_batch_id', 'normalized_emotional_score_gds', 'normalized_emotional_score_phq');
-- Expected: (empty result — all three removed)

-- Check new constraint added
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'sessions' AND constraint_type = 'CHECK';
-- Expected: check_session_dates (or similar)

-- Check new triggers exist
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name IN ('trg_calculate_session_length', 'trg_ensure_session_start', 'trg_ensure_decision_timestamp')
ORDER BY trigger_name;
-- Expected: 3 triggers
```

**Rollback** (if something goes wrong):
```sql
-- Restore removed columns
ALTER TABLE sessions 
ADD COLUMN ingest_batch_id UUID,
ADD COLUMN normalized_emotional_score_gds FLOAT,
ADD COLUMN normalized_emotional_score_phq FLOAT;

-- Drop new triggers & functions
DROP TRIGGER IF EXISTS trg_calculate_session_length ON sessions;
DROP TRIGGER IF EXISTS trg_ensure_session_start ON sessions;
DROP TRIGGER IF EXISTS trg_ensure_decision_timestamp ON decisions;
DROP FUNCTION IF EXISTS fn_calculate_session_length() CASCADE;
DROP FUNCTION IF EXISTS fn_ensure_session_start() CASCADE;
DROP FUNCTION IF EXISTS fn_ensure_decision_timestamp() CASCADE;

-- Drop new constraint
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS check_session_dates;
```

---

### 004_arc_workflow_tables.sql ✅ (CREATED 2026-03-23)
**Status**: Production-ready; required for Prompt 1/Prompt 2 weekly arc persistence

**What it does**:
- Creates `arc_weeks` table for Prompt 1 (weekly architect output)
- Creates `arc_days` table for Prompt 2 (daily generation output, one row per day 1..7)
  - `payload_mode='reference'`: store only pointer to canonical `chapters`
  - `payload_mode='delta'`: store only patch/overrides vs chapter template (recommended for cost/space)
  - `payload_mode='full'`: store full generated payload (highest storage cost)
- Creates `arc_transitions` table for explicit continuity between contiguous weeks
- Adds token/cost telemetry fields (`input_tokens`, `output_tokens`, `estimated_cost_usd`) for cost control
- Adds GIN indexes for JSONB payloads and operational indexes for status/time/day lookups
- Adds operational views:
  - `v_arc_latest_transition`
  - `v_arc_progress`

**When to run**:
1. **First time**: After `migrations/003_fix_data_capture.sql`
2. **Already applied?**: Safe to re-run (idempotent, uses `IF NOT EXISTS` and `CREATE OR REPLACE VIEW`)

**How to run**:
```bash
# Option 1: Supabase SQL Editor
1. Open Supabase dashboard → SQL Editor
2. Copy & paste contents of 004_arc_workflow_tables.sql
3. Run all queries

# Option 2: psql
psql -h your-host.supabase.co -U postgres -d postgres -f ./004_arc_workflow_tables.sql
```

**Verify it worked**:
```sql
-- Check new tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema='public'
AND table_name IN ('arc_weeks','arc_days','arc_transitions')
ORDER BY table_name;

-- Check uniqueness one day per arc
SELECT indexname
FROM pg_indexes
WHERE tablename='arc_days' AND indexdef ILIKE '%UNIQUE%';

-- Check compact payload modes are available
SELECT column_name
FROM information_schema.columns
WHERE table_name='arc_days'
AND column_name IN ('payload_mode','chapter_template_id','delta_json','output_json','generated_metrics')
ORDER BY column_name;

-- Check views
SELECT table_name
FROM information_schema.views
WHERE table_schema='public'
AND table_name IN ('v_arc_latest_transition','v_arc_progress');
```

---

### 005_narrative_path_cache.sql ✅ (CREATED 2026-03-23)
**Status**: Production-ready; required for deterministic path reuse and cache KPIs

**What it does**:
- Creates `narrative_path_cache` for segmented deterministic path-key reuse
- Adds variant ranking fields (`quality_score`, `usage_count`, `avg_rating`) to serve best cached narrative
- Creates `narrative_cache_events` for hit/miss/write/rating observability
- Creates views:
  - `v_narrative_path_cache_best`
  - `v_narrative_cache_kpis`

**When to run**:
1. **First time**: After `migrations/004_arc_workflow_tables.sql`
2. **Already applied?**: Safe to re-run (idempotent; uses `IF NOT EXISTS` and `CREATE OR REPLACE VIEW`)

**How to run**:
```bash
# Option 1: Supabase SQL Editor
1. Open Supabase dashboard -> SQL Editor
2. Copy & paste contents of 005_narrative_path_cache.sql
3. Run all queries

# Option 2: psql
psql -h your-host.supabase.co -U postgres -d postgres -f ./005_narrative_path_cache.sql
```

**Verify it worked**:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('narrative_path_cache','narrative_cache_events');

SELECT table_name FROM information_schema.views
WHERE table_name IN ('v_narrative_path_cache_best','v_narrative_cache_kpis');

SELECT * FROM v_narrative_cache_kpis;
```

**Rollback**:
```sql
DROP VIEW IF EXISTS v_arc_progress;
DROP VIEW IF EXISTS v_arc_latest_transition;
DROP TRIGGER IF EXISTS trg_touch_arc_days_updated_at ON arc_days;
DROP TRIGGER IF EXISTS trg_touch_arc_weeks_updated_at ON arc_weeks;
DROP FUNCTION IF EXISTS fn_touch_updated_at() CASCADE;
DROP TABLE IF EXISTS arc_transitions;
DROP TABLE IF EXISTS arc_days;
DROP TABLE IF EXISTS arc_weeks;
```

**How it relates to existing `chapters` table**:
- `chapters` remains canonical/base content.
- `arc_days` stores dynamic runtime variations per week/day.
- You do **not** need to replace `chapters` or rewrite the whole schema.
- Recommended production mode: `delta` (minimize DB size and LLM tokens).

---

### 006_backfill_decision_metrics_and_null_hardening.sql ✅ (CREATED 2026-03-25)
**Status**: Production-ready; recommended to fix historical NULL-heavy telemetry rows

**What it does**:
- Hardens JSON defaults for null-prone fields (`scenes.metadata`, `sessions.metadata`)
- Backfills `sessions.started_at` and `sessions.session_length_seconds` when derivable
- Backfills `decisions.validation_steps` and `decisions.risk_flags` as empty arrays where null
- Creates missing decision-level `clinical_mappings` from static option mappings (`options.gds_mapping` and `options.metadata.phq_mapping`)
- Backfills `decisions.mapping_confidence` from inserted/available mappings
- Backfills `decision_audit.validation_result` with mapping diagnostics
- Recomputes `session_scores` globally (`gds_total`, `phq_total`)
- Adds trigger `trg_autofill_decision_mappings_from_option` to auto-generate mappings for future inserts into `decisions`

**When to run**:
1. **First time**: After `migrations/003_fix_data_capture.sql` and after static options are loaded
2. **Already applied?**: Safe to re-run (idempotent behavior by guarded inserts/updates)

**How to run**:
```bash
# Option 1: Supabase SQL Editor
1. Open Supabase dashboard -> SQL Editor
2. Copy & paste contents of 006_backfill_decision_metrics_and_null_hardening.sql
3. Run all queries

# Option 2: psql
psql -h your-host.supabase.co -U postgres -d postgres -f ./006_backfill_decision_metrics_and_null_hardening.sql
```

**Verify it worked**:
```sql
-- Decision-level mappings now exist
SELECT COUNT(*) AS decision_level_mappings
FROM clinical_mappings
WHERE decision_id IS NOT NULL;

-- Sessions with computed scores
SELECT COUNT(*) AS sessions_with_scores
FROM session_scores;

-- Null checks
SELECT COUNT(*) AS null_scene_metadata FROM scenes WHERE metadata IS NULL;
SELECT COUNT(*) AS null_session_metadata FROM sessions WHERE metadata IS NULL;
SELECT COUNT(*) AS null_mapping_confidence FROM decisions WHERE mapping_confidence IS NULL;
```

---

### 007_clinical_review_dashboard.sql ✅ (CREATED 2026-03-29)
**Status**: Production-ready; enables clinician review workflow

**What it does**:
- Creates `reviewers` (clinician identities for dashboard)
- Creates `clinical_mapping_reviews` (approve/reject/adjust feedback)
- Adds views: `v_mapping_review_queue`, `v_mapping_review_stats`, `v_mapping_training_ready`
- Adds indexes for reviewer, verdict, and training-ready queries

**When to run**:
1. **First time**: After `migrations/006_backfill_decision_metrics_and_null_hardening.sql`
2. **Already applied?**: Safe to re-run (idempotent)

**Verify it worked**:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('reviewers','clinical_mapping_reviews');

SELECT table_name FROM information_schema.views
WHERE table_name IN ('v_mapping_review_queue','v_mapping_review_stats','v_mapping_training_ready');
```

---

## Future Migrations

Expected upcoming migrations:
- `008_add_phq_analysis_fields.sql` — (planned) Add extra columns for PHQ-9 advanced analysis
- `009_add_data_retention_policies.sql` — (planned) Archive old audio/LLM responses after retention period

---

## Migration Execution Order (Critical)

**Always run migrations in this sequence:**

1. `schema.sql` (base schema)
2. `indexes.sql` (optional, but recommended early)
3. `migrations/001_fix_schema.sql`
4. `migrations/002_sprint2a_session_columns.sql`
5. `migrations/003_fix_data_capture.sql` ← NEW
6. `migrations/004_arc_workflow_tables.sql` ← NEW
7. `migrations/005_narrative_path_cache.sql` ← NEW
8. `migrations/006_backfill_decision_metrics_and_null_hardening.sql` ← NEW
9. `migrations/007_clinical_review_dashboard.sql` ← NEW
10. `audit_triggers.sql` (functions and triggers)
11. `seed_data.sql` (test data)
12. `deploy.sql` (users and auth)

Running out of order may cause:
- FK constraint errors (trying to reference non-existent columns)
- Trigger errors (new columns don't exist yet)
- Index errors (columns don't exist)

---

## Backend Integration Required

After deploying Migration 003, the backend must:

1. **Session start**: Prompt user with "¿Autoriza el almacenamiento de datos?" BEFORE starting session (session lifecycle trigger will set `consent_given = FALSE` on each new session - this is enforced)
   
2. **Session end**: Call `PUT /sessions/{session_id}/close` to set `ended_at`, which triggers auto-calculation of `session_length_seconds`

3. **Decision payload**: When user makes a choice, include:
   - `time_to_decision_ms` = time elapsed since choice presented
   - `mapping_confidence` = (0-1) confidence score in clinical mapping
   - `validation_steps` = JSON array of validation rule names applied

**See `SCHEMA_DOCUMENTATION.md` for full trigger function signatures and behavior.**

---

## Questions?

- Check `SCHEMA_DOCUMENTATION.md` for full DB schema details and trigger documentation
- Check `CHANGES_SUMMARY.md` for detailed impact analysis and historical context
- Check `DEPLOYMENT_ORDER.md` for complete deployment sequence with all phases
- See `schema.sql` for the complete current schema definition
