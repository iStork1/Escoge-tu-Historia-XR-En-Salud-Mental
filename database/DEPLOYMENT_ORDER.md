# Database Deployment Order

**Critical:** Script execution order determines schema integrity and trigger correctness. Follow this sequence exactly.

---

## 📋 Execution Sequence

### Phase 1: Schema Foundation
**File:** `schema.sql`
- **Purpose**: Create all core tables (sessions, decisions, clinical_mappings, options, scenes, chapters, etc.)
- **Dependencies**: None (runs first)
- **Execution Time**: ~5–10 seconds
- **Idempotent**: ✅ Yes (uses `IF NOT EXISTS`)
- **Rollback**: Drop all tables with `DROP TABLE IF EXISTS ... CASCADE;`

**Supabase UI:**
```
1. Go to SQL Editor
2. Create new query
3. Copy entire schema.sql content
4. Run
5. Verify: Check Tables list → should show ~10 tables
```

---

### Phase 2: Schema Migrations (Sprint 0)
**File:** `migrations/001_fix_schema.sql`
- **Purpose**: Apply all Sprint 0 updates (new FK constraints, new columns on options, triggers for session_scores, enhanced risk detection for GDS-7, index creation)
- **Dependencies**: schema.sql must exist first
- **Execution Time**: ~30–60 seconds (includes index creation)
- **Idempotent**: ✅ Yes (uses `IF NOT EXISTS` and `IF EXISTS` guards)
- **Rollback**: See bottom of 001_fix_schema.sql for commented-out DROP statements

**Why this order?** New column references in triggers require the base schema to exist; triggers cannot reference columns they're about to create.

**Supabase UI:**
```
1. Go to SQL Editor
2. Create new query
3. Copy entire migrations/001_fix_schema.sql content
4. Run
5. Verify success criteria (see migrations/README.md)
```

**After Migration, Validate:**
```sql
-- Verify 4 columns added to options
SELECT column_name FROM information_schema.columns 
WHERE table_name='options' 
ORDER BY ordinal_position;
-- Expected: 7 columns (id, decision_id, consequence, next_chapter_id, next_scene_id, gds_mapping, created_at)

-- Verify FK on decisions
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name='decisions' 
ORDER BY constraint_name;
-- Expected: includes fk_decisions_chapter_id

-- Verify triggers exist
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name LIKE 'trg_compute_%' 
ORDER BY trigger_name;
-- Expected: 2 triggers (trg_compute_session_scores_on_decision, trg_compute_session_scores_on_mapping)
```

---

### Phase 3: Performance Indexes
**File:** `indexes.sql`
- **Purpose**: Create all query optimization indexes (25 total, covering FK columns, search patterns, and new denormalized columns)
- **Dependencies**: schema.sql + migrations/001_fix_schema.sql (so all columns exist)
- **Execution Time**: ~10–20 seconds
- **Idempotent**: ✅ Yes (uses `IF NOT EXISTS`)
- **Rollback**: Drop individual indexes with `DROP INDEX IF EXISTS idx_name;`

**Why after migrations?** New columns (next_chapter_id, next_scene_id, gds_mapping) need indexes; migration creates them first.

**Supabase UI:**
```
1. Go to SQL Editor
2. Create new query
3. Copy entire indexes.sql content
4. Run
5. Verify: Check Indexes list → should show 25 indexes
```

---

### Phase 4: Triggers & Functions
**File:** `audit_triggers.sql`
- **Purpose**: Create/update PostgreSQL functions and triggers (risk detection, session_scores computation, audit logging)
- **Dependencies**: schema.sql + migrations/001_fix_schema.sql
- **Execution Time**: ~5–10 seconds
- **Idempotent**: ✅ Yes (uses `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS`)
- **Rollback**: Drop triggers and functions individually (see SCHEMA_DOCUMENTATION.md)

**Why after migrations?** Triggers reference new columns (e.g., gds_mapping in fn_clinical_mappings_after_insert); migrations must create those first.

**Supabase UI:**
```
1. Go to SQL Editor
2. Create new query
3. Copy entire audit_triggers.sql content
4. Run
5. Verify: Check Functions list → should show 4 new functions
            Check Triggers list → should show 10+ triggers
```

---

### Phase 5: Initial Data
**File:** `seed_data.sql`
- **Purpose**: Populate test/initial data (example chapters, scenes, options, clinical mappings)
- **Dependencies**: All previous files (tables, triggers, functions must exist)
- **Execution Time**: ~5–10 seconds
- **Idempotent**: ✅ Conditional (uses `WHERE NOT EXISTS` patterns)
- **Rollback**: Use `DELETE FROM table_name;` or restore from backup

**Supabase UI:**
```
1. Go to SQL Editor
2. Create new query
3. Copy entire seed_data.sql content
4. Run
5. Verify: SELECT COUNT(*) FROM chapters; -- should show test data
```

---

### Phase 6: Application Users & Authentication
**File:** `deploy.sql`
- **Purpose**: Create users, auth_tokens tables and example RLS policies
- **Dependencies**: All previous files
- **Execution Time**: ~2–3 seconds
- **Idempotent**: ✅ Yes (uses `IF NOT EXISTS`)
- **Rollback**: Drop users and auth_tokens tables

**Supabase UI:**
```
1. Go to SQL Editor
2. Create new query
3. Copy entire deploy.sql content
4. Run
5. Verify: SELECT * FROM users; -- should show test-user-1
```

---

## 🧪 Full Deployment Script (All-in-One)

Copy this sequence into Supabase SQL Editor as **separate queries**, running each and confirming success before the next:

```sql
-- Query 1: Base Schema
[Copy schema.sql content]

-- Query 2: Schema Migrations (Sprint 0)
[Copy migrations/001_fix_schema.sql content]

-- Query 3: Indexes
[Copy indexes.sql content]

-- Query 4: Triggers & Functions
[Copy audit_triggers.sql content]

-- Query 5: Seed Data
[Copy seed_data.sql content]

-- Query 6: Users & Auth
[Copy deploy.sql content]
```

---

## 📊 Post-Deployment Validation

After all 6 scripts succeed, run these checks:

```sql
-- 1. Table count (expected: ~10)
SELECT COUNT(*) as table_count FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- 2. Column count on options (expected: 7)
SELECT COUNT(*) as option_columns FROM information_schema.columns 
WHERE table_name = 'options';

-- 3. FK constraints (expected: ≥10)
SELECT COUNT(*) as fk_count FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY';

-- 4. Trigger count (expected: ≥10)
SELECT COUNT(*) as trigger_count FROM information_schema.triggers;

-- 5. Index count (expected: 25)
SELECT COUNT(*) as index_count FROM pg_indexes WHERE schemaname = 'public';

-- 6. Function count (expected: ≥4 new ones)
SELECT COUNT(*) as function_count FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';
```

---

## ⚠️ Common Issues & Fixes

### Issue: "Trigger references undefined column"
**Cause**: Running audit_triggers.sql before migrations/001_fix_schema.sql
**Fix**: Run migrations first: `migrations/001_fix_schema.sql`

### Issue: "Index creation failed: column does not exist"
**Cause**: Running indexes.sql before migrations/001_fix_schema.sql
**Fix**: Run migrations first: `migrations/001_fix_schema.sql`

### Issue: "FK constraint violation when inserting"
**Cause**: seed_data.sql references non-existent chapters/scenes
**Fix**: Check seed_data.sql prerequisites; ensure all FOREIGN KEY targets exist

### Issue: "Session scores not auto-computing"
**Cause**: Session_scores trigger not firing (audit_triggers.sql not run)
**Fix**: Run `audit_triggers.sql` to create triggers and functions

---

## 🔄 Rollback Procedure

If any script fails:

1. **Check error message** in Supabase SQL Editor
2. **Review migrations/README.md** for troubleshooting
3. **Option A (Partial Rollback)**:
   ```sql
   -- Undo just the last script without losing data
   DROP TRIGGER IF EXISTS trg_compute_session_scores_on_decision CASCADE;
   DROP TRIGGER IF EXISTS trg_compute_session_scores_on_mapping CASCADE;
   DROP FUNCTION IF EXISTS fn_compute_session_scores() CASCADE;
   -- etc. (see commented section in migrations/001_fix_schema.sql)
   ```

4. **Option B (Full Rollback)**:
   ```sql
   DROP TABLE IF EXISTS decision_ratings, session_scores, clinical_mappings, decisions, 
                      options, scenes, chapters, audio_metrics, risk_events, decision_audit, 
                      sessions, users, auth_tokens CASCADE;
   ```
   Then re-run from `schema.sql` onward.

---

## 📞 Support & Documentation

- **Detailed Migration Guide**: See [migrations/README.md](./migrations/README.md)
- **Schema Reference**: See [SCHEMA_DOCUMENTATION.md](./SCHEMA_DOCUMENTATION.md)
- **Change Summary**: See [CHANGES_SUMMARY.md](./CHANGES_SUMMARY.md)
- **Sprint Checklist**: See [SPRINT_0_CHECKLIST.md](./SPRINT_0_CHECKLIST.md)

---

**Last Updated**: 2026-02-22  
**Version**: 1.1 (Sprint 0 Complete)  
**Status**: ✅ Ready for Staging → Production Deployment
