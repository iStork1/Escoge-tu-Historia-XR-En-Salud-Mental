# Database Migrations Guide

## Overview
This folder contains all database migration scripts for "Escoje tu Historia". Migrations are numbered sequentially and designed to be idempotent (safe to re-run).

## Current Migrations

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

## Future Migrations

Expected upcoming migrations (placeholder):
- `002_add_phq_analysis_fields.sql` — (planned) Add extra columns for PHQ-9 advanced analysis
- `003_create_clinician_views.sql` — (planned) Add materialized views for reporting
- `004_add_data_retention_policies.sql` — (planned) Archive old audio/LLM responses

---

## Questions?

- Check `SCHEMA_DOCUMENTATION.md` for full DB schema details
- Check `CHANGES_SUMMARY.md` for detailed impact analysis of Migration 001
- See `schema.sql` for the complete current schema definition
