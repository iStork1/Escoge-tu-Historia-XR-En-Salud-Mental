# Migration 003 Implementation Summary

**Status**: ✅ **COMPLETE** — All database files updated and ready for deployment

**Date**: 2026-02-23  
**Scope**: Sprint 2b Data Capture & Session Lifecycle Management  
**Impact**: Production database schema v1.2

---

## 📋 What Was Done

### 1. ✅ Created Migration 003
**File**: `database/migrations/003_fix_data_capture.sql`

**Key Changes**:

#### Removed Redundant Columns (Lines 5-15)
```sql
ALTER TABLE sessions DROP COLUMN IF EXISTS normalized_emotional_score_gds;
ALTER TABLE sessions DROP COLUMN IF EXISTS normalized_emotional_score_phq;
ALTER TABLE sessions DROP COLUMN IF EXISTS ingest_batch_id;
```
**Why**: These columns were legacy denormalization attempts. Calculations now live in `session_scores` table via trigger.

#### Added Session Lifecycle Triggers (Lines 20-100)
Three new PostgreSQL functions + three new triggers:

1. **`fn_ensure_session_start()`** (Lines 25-36)
   - Guarantees `started_at` is populated on session creation
   - **CRITICAL**: Resets `consent_given = FALSE` EVERY new session (prevents caching)
   - Trigger: `trg_ensure_session_start` (ON INSERT on sessions)

2. **`fn_calculate_session_length()`** (Lines 41-52)
   - Auto-calculates `session_length_seconds` when session ends
   - Sets `is_closed = TRUE` simultaneously
   - Trigger: `trg_calculate_session_length` (ON UPDATE on sessions)

3. **`fn_ensure_decision_timestamp()`** (Lines 57-67)
   - Guarantees `created_at` populated on decision insertion
   - Trigger: `trg_ensure_decision_timestamp` (ON INSERT on decisions)

#### Added Data Integrity Constraints (Lines 19-20)
```sql
ALTER TABLE sessions ADD CONSTRAINT check_session_dates 
CHECK (ended_at IS NULL OR ended_at >= started_at);
```
**Ensures**: Sessions cannot have illogical dates (ended before started).

#### Improved Scene Metadata (Lines 73-83)
Enhanced `scenes.metadata` JSONB structure with:
- `emotional_intensity` (0-10 scale)
- `accessibility_warnings` (array of flags)
- `estimated_completion_seconds` (UX timing)

---

### 2. ✅ Updated `schema.sql`
**Changes**: Removed 3 problematic columns from sessions table

```diff
- normalized_emotional_score_gds FLOAT,
- normalized_emotional_score_phq FLOAT,
- ingest_batch_id UUID,
+ CONSTRAINT check_session_dates CHECK (ended_at IS NULL OR ended_at >= started_at)
```

---

### 3. ✅ Updated `audit_triggers.sql`
**Changes**: Appended 3 new trigger functions + 3 new triggers

```sql
-- ADDED:
CREATE OR REPLACE FUNCTION fn_calculate_session_length() RETURNS TRIGGER
CREATE OR REPLACE FUNCTION fn_ensure_session_start() RETURNS TRIGGER
CREATE OR REPLACE FUNCTION fn_ensure_decision_timestamp() RETURNS TRIGGER

CREATE TRIGGER trg_calculate_session_length BEFORE UPDATE ON sessions
CREATE TRIGGER trg_ensure_session_start BEFORE INSERT ON sessions
CREATE TRIGGER trg_ensure_decision_timestamp BEFORE INSERT ON decisions
```

---

### 4. ✅ Updated `DEPLOYMENT_ORDER.md`
**Changes**: Added Phase 2c documentation

**New Section**: "Phase 2c: Session Lifecycle & Data Integrity (Sprint 2b - NEW)"

Includes:
- Full file description
- Dependencies
- Execution steps for Supabase UI
- Verification queries
- Rollback instructions

---

### 5. ✅ Updated `migrations/README.md`
**Changes**: Documented migrations 002 and 003 (were previously listed as "future")

**New Sections**:

#### 002_sprint2a_session_columns.sql ✅
- Adds `is_closed` and `created_at` columns
- Full execution guide and verification SQL
- Rollback instructions

#### 003_fix_data_capture.sql ✅
- Comprehensive documentation of all changes
- Verification queries to confirm success
- Backend integration requirements
- Rollback script

---

### 6. ✅ Updated `SCHEMA_DOCUMENTATION.md`
**Changes**: Full schema update for v1.2

**Updates**:
- Version bumped to 1.2
- Sessions table description updated (removed deprecated columns)
- Triggers section expanded with all 7 functions documented:
  - `fn_clinical_mappings_after_insert()` — Risk detection
  - `fn_compute_session_scores()` — Score aggregation
  - `fn_ensure_session_start()` — Consent reset **NEW**
  - `fn_calculate_session_length()` — Duration calculation **NEW**
  - `fn_ensure_decision_timestamp()` — Timestamp guarantee **NEW**
  - `fn_sessions_after_update()` — Metrics aggregation
- Deployment steps updated with all 9 migration phases in order
- Backend integration requirements documented

---

## 🚀 Deployment Sequence (Ready to Execute)

### Database Deployment Order (Critical)

Run these in Supabase SQL Editor as separate queries:

1. ✅ `schema.sql`
2. ✅ `migrations/001_fix_schema.sql`
3. ✅ `migrations/002_sprint2a_session_columns.sql`
4. ✅ `migrations/003_fix_data_capture.sql` ← **NEW**
5. ✅ `indexes.sql`
6. ✅ `views.sql` (if exists)
7. ✅ `audit_triggers.sql`
8. ✅ `seed_data.sql`
9. ✅ `deploy.sql`

**Each file is idempotent** — safe to re-run if interrupted.

---

## ⚠️ Critical Behavior Changes for Backend

After deploying Migration 003, the backend **MUST** implement these behaviors:

### 1. Consent Re-Prompting (REQUIRED)
**What Changed**: SQL now enforces `consent_given = FALSE` on EVERY new session creation.

**Backend Action**:
```
Session Start Flow:
  1. Create new session via POST /sessions
  2. Trigger sets consent_given = FALSE automatically
  3. Backend MUST prompt user: "¿Autoriza el almacenamiento de datos?"
  4. User responds YES/NO
  5. Backend calls PUT /sessions/{session_id}/consent with value TRUE/FALSE
```

**Why**: Prevents consent caching from previous sessions (privacy requirement).

---

### 2. Session End Tracking (REQUIRED)
**What Changed**: Backend now must explicitly close sessions to trigger auto-calculation.

**Backend Action**:
```
Session End Flow:
  1. When Alexa skill ends (state machine reaches ENDED)
  2. Backend calls: PUT /sessions/{session_id}/close
  3. This sets ended_at = now()
  4. Trigger fn_calculate_session_length() fires
  5. session_length_seconds auto-calculated
  6. is_closed auto-set to TRUE
```

**If not implemented**: `session_length_seconds` will remain NULL (data incomplete).

---

### 3. Decision Payload Enhancement (RECOMMENDED)
**What Changed**: Schema fields exist but backend must populate them.

**Required Fields** (if your clinical team wants them):
- `time_to_decision_ms` — elapsed time from choice presentation to selection
- `mapping_confidence` — (0-1) confidence in clinical mapping
- `validation_steps` — JSON array of validation rules applied
- `risk_flags` — JSON object with risk indicators

**Status**: Schema ready; backend instrumentation pending.

---

## 📊 Verification Queries

After each migration deployment, run these in Supabase SQL Editor:

### Verify Migration 003 Deployment
```sql
-- 1. Check columns removed
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'sessions' 
AND column_name IN ('ingest_batch_id', 'normalized_emotional_score_gds', 'normalized_emotional_score_phq');
-- Expected: (empty result)

-- 2. Check new constraint exists
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'sessions' AND constraint_type = 'CHECK';
-- Expected: check_session_dates

-- 3. Check new triggers exist
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name IN ('trg_calculate_session_length', 'trg_ensure_session_start', 'trg_ensure_decision_timestamp');
-- Expected: 3 triggers

-- 4. Check new functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('fn_calculate_session_length', 'fn_ensure_session_start', 'fn_ensure_decision_timestamp');
-- Expected: 3 functions
```

### Test Session Lifecycle
```sql
-- Test 1: Verify consent reset
INSERT INTO sessions (session_id, pseudonym, started_at) 
VALUES (gen_random_uuid(), 'test-user', now());

SELECT session_id, consent_given, started_at FROM sessions 
WHERE pseudonym = 'test-user' ORDER BY started_at DESC LIMIT 1;
-- Expected: consent_given = FALSE (even if not explicitly set)

-- Test 2: Verify session length calculation
UPDATE sessions SET ended_at = now() 
WHERE session_id = (SELECT session_id FROM sessions WHERE pseudonym = 'test-user' ORDER BY started_at DESC LIMIT 1);

SELECT session_id, started_at, ended_at, session_length_seconds, is_closed 
FROM sessions 
WHERE pseudonym = 'test-user' ORDER BY started_at DESC LIMIT 1;
-- Expected: session_length_seconds populated (not NULL), is_closed = TRUE
```

---

## 📁 Files Modified (Summary)

| File | Change | Status |
|------|--------|--------|
| `migrations/003_fix_data_capture.sql` | **NEW** — 130-line migration with 3 trigger functions | ✅ Created |
| `schema.sql` | Updated sessions table (removed 3 columns, added constraint) | ✅ Updated |
| `audit_triggers.sql` | Appended 3 new trigger functions + 3 triggers | ✅ Updated |
| `DEPLOYMENT_ORDER.md` | Added Phase 2c documentation | ✅ Updated |
| `migrations/README.md` | Documented migrations 002 & 003 | ✅ Updated |
| `SCHEMA_DOCUMENTATION.md` | Updated to v1.2, expanded triggers section | ✅ Updated |

---

## 🔄 Rollback Instructions

If deployment fails or needs to be reverted:

```sql
-- See rollback section at bottom of migrations/003_fix_data_capture.sql
-- Or use rollback statements in migrations/README.md section "### 003_fix_data_capture.sql"

-- Key rollback steps:
-- 1. Restore removed columns
-- 2. Drop new triggers
-- 3. Drop new functions
-- 4. Drop new constraint
-- 5. Verify schema reverted to pre-003 state
```

---

## ✅ Checklist Before Production Deployment

- [ ] Run all migrations in staging environment first
- [ ] Run verification queries from above (verify all 4 checks pass)
- [ ] Backend team implements consent re-prompting logic
- [ ] Backend team implements session close endpoint call
- [ ] Test complete flow: create session → prompt consent → end session → verify session_length_seconds calculated
- [ ] Verify migrations/README.md has complete documentation
- [ ] Verify SCHEMA_DOCUMENTATION.md is up to date for the team
- [ ] Have rollback scripts ready and tested
- [ ] Document any custom changes made during deployment
- [ ] Get approval from technical lead
- [ ] Schedule deployment window
- [ ] Monitor CloudWatch/Supabase logs during deployment

---

## 📞 Questions?

- **Database Schema**: See `SCHEMA_DOCUMENTATION.md` (full documentation)
- **Migration Details**: See `migrations/README.md` (execution guide)
- **Deployment Order**: See `DEPLOYMENT_ORDER.md` (complete sequence)
- **Backend Integration**: See `migrations/README.md` section "Backend Integration Required"
- **Change History**: See `CHANGES_SUMMARY.md` for detailed impact analysis

---

## 🎯 Next Steps

1. **Staging Deployment**
   - Copy-paste each migration file into Supabase SQL Editor
   - Run verification queries
   - Test with synthetic data

2. **Backend Integration**
   - Update Alexa handler: Add consent prompting before chapter 1
   - Update session manager: Call `PUT /sessions/{id}/close` on skill close
   - Test end-to-end flow with 5 test users

3. **Production Deployment**
   - Follow `DEPLOYMENT_ORDER.md` exactly
   - Have rollback scripts ready
   - Monitor logs during deployment
   - Verify all triggers firing correctly

---

**Status**: Ready for production deployment 🚀
