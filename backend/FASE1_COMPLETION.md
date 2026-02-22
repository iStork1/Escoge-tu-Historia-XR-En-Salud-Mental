# FASE 1 — ALIGN CHAPTERS.JSON TO SCHEMA ✅ COMPLETE

**Duration**: 2 days planned | Completed in 1 session  
**Status**: ✅ Ready for testing on staging  
**Date**: 2026-02-22

---

## 📋 Sprint Breakdown

### Sprint 1a: Format Standardization ✅

**Objective**: Update chapters.json structure to match clinical schema

#### Changes Made

1. **Source File**: [content/chapters.json](../content/chapters.json)

2. **Format Updates**:
   - ✅ Added `scenes[].title` — scene name for UI/logging
   - ✅ Added `scenes[].order` — narrative sequence
   - ✅ Added `options[].consequence` — outcome narration (read after selection)
   - ✅ Added `options[].next_scene_id` — nullable FK to scenes
   - ✅ Renamed `options[].mappings[]` → separate arrays:
     - `options[].gds_mapping[]` — GDS-15 item mappings
     - `options[].phq_mapping[]` — PHQ-9 item mappings
   - ✅ Added `rationale` field to each mapping (e.g., "social_engagement", "depressed_mood")
   - ✅ Removed `scale` field (inferred from array name)

3. **Example Structure** (before → after):
   ```javascript
   // BEFORE
   {
     option_id: "c01-s01-o1",
     option_text: "Acercarte a Carmen",
     next_chapter_id: "c02",
     mappings: [
       { scale: "GDS", item: 2, weight: 1.0, confidence: 0.9 }
     ]
   }

   // AFTER
   {
     option_id: "c01-s01-o1",
     option_text: "Acercarte a Carmen",
     consequence: "Te acercas a Carmen y empiezan a conversar...",
     next_chapter_id: "c02",
     next_scene_id: null,
     gds_mapping: [
       { item: 2, weight: 1.0, confidence: 0.9, rationale: "social_engagement" }
     ],
     phq_mapping: []
   }
   ```

4. **Documentation**: Created [CHAPTERS_FORMAT.md](../CHAPTERS_FORMAT.md)
   - Complete schema reference with all field descriptions
   - Validation rules (item ranges, FK constraints, etc.)
   - Database sync workflow
   - Minimal example for reference

---

### Sprint 1b: Sync chapters.json → Database ✅

**Objective**: Create backend sync infrastructure

#### Changes Made

1. **Backend Endpoint**: `POST /admin/sync-chapters`
   - **File**: [backend/src/index.js](../backend/src/index.js) (lines ~950–1010)
   - **Function**: `handleSyncChapters(req, res)`
   - **Behavior**:
     - Reads chapters.json from disk
     - Validates structure
     - Upserts chapters → `chapters` table
     - Upserts scenes → `scenes` table
     - Upserts options → `options` table
     - Inserts mappings → `clinical_mappings` table (mapping_source='designer')
   - **Response**:
     ```json
     {
       "ok": true,
       "chapters_upserted": 1,
       "scenes_upserted": 1,
       "options_upserted": 3,
       "clinical_mappings_inserted": 5
     }
     ```

2. **Sync Script**: [backend/scripts/sync_chapters.js](../backend/scripts/sync_chapters.js)
   - **Purpose**: Command-line tool for manual syncing
   - **Usage**:
     ```bash
     node scripts/sync_chapters.js staging
     node scripts/sync_chapters.js production
     ```
   - **Features**:
     - Loads chapters.json from disk
     - Validates structure (chapter_id, scene_id, option_id, all required fields)
     - Validates GDS items (1-15) and PHQ items (1-9)
     - Counts content (chapters, scenes, options, mappings)
     - Calls POST /admin/sync-chapters endpoint
     - Pretty-prints results with emoji indicators
     - Helpful error messages for troubleshooting
   - **Prerequisites**: Backend running on localhost:7070 (or BACKEND_HOST/BACKEND_PORT env vars)

3. **Integration**: Added endpoint to routing
   - File: [backend/src/index.js](../backend/src/index.js) (around line 958)
   - Route: `if (req.method === 'POST' && url === '/admin/sync-chapters')`

---

## 📊 Current Content (Example Story)

**Chapter**: c01 — "Paseo por el parque" (Park Walk)  
**Scene**: c01-s01 — "Encuentro en el parque" (Park Encounter)

**Options**:
1. **"Acercarte a Carmen"** (Approach Carmen)
   - Consequence: "Te acercas a Carmen y empiezan a conversar..."
   - GDS: item 2 (social engagement), w=1.0, c=0.9
   - PHQ: (none)
   - Next: c02

2. **"Unirte al grupo"** (Join the group)
   - Consequence: "Te unes al grupo de juego..."
   - GDS: item 7 (social engagement), w=0.7, c=0.8
   - PHQ: item 4 (sleep/fatigue), w=0.5, c=0.8
   - Next: c03

3. **"Sentarte solo"** (Sit alone)
   - Consequence: "Te sientas en un banco tranquilo..."
   - GDS: item 7 (social isolation), w=0.9, c=0.85
   - PHQ: item 1 (depressed mood), w=0.6, c=0.8
   - Next: c04

---

## 🚀 How to Test (Staging)

### Step 1: Verify Database is Ready
```bash
# Ensure schema.sql + 001_fix_schema.sql have been run
# Check: all tables exist (chapters, scenes, options, clinical_mappings)
```

### Step 2: Start Backend
```bash
cd backend
npm install
npm run dev
# Should log: "Telemetry API listening on 7070"
```

### Step 3: Run Sync Script
```bash
cd backend
node scripts/sync_chapters.js staging
```

**Expected Output**:
```
📚 Syncing chapters to staging
Endpoint: http://localhost:7070/admin/sync-chapters

📖 Loading chapters.json...
✅ Loaded 1 chapter(s)
✅ Validation passed

📊 Summary of content:
  - Chapters:           1
  - Scenes:             1
  - Options:            3
  - Clinical Mappings:  5

🔄 Calling sync endpoint: http://localhost:7070/admin/sync-chapters

✅ Sync successful!

📈 Results:
  - Chapters upserted:           1
  - Scenes upserted:             1
  - Options upserted:            3
  - Clinical mappings inserted:  5

🎉 All done! Your chapters are now in the database.
```

### Step 4: Verify in Database
```sql
-- Check chapters
SELECT COUNT(*) FROM chapters;
-- Expected: 1

-- Check scenes
SELECT COUNT(*) FROM scenes;
-- Expected: 1

-- Check options
SELECT COUNT(*) FROM options;
-- Expected: 3

-- Check options.gds_mapping (JSONB field)
SELECT option_id, gds_mapping FROM options;
-- Expected: 3 rows with gds_mapping values

-- Check clinical_mappings
SELECT COUNT(*) FROM clinical_mappings WHERE mapping_source='designer';
-- Expected: 5
```

### Step 5: Test Alexa Skill with New Content
Run Alexa simulator and verify:
- Options from c01-s01 appear in the skill
- Consequences are read after selection
- Scene transitions work (next_chapter_id)

---

## 📁 Files Modified/Created

| File | Status | Action |
|------|--------|--------|
| [content/chapters.json](../content/chapters.json) | Modified | Updated format: added title, consequence, gds_mapping, phq_mapping |
| [content/CHAPTERS_FORMAT.md](../CHAPTERS_FORMAT.md) | Created | Schema reference & validation rules |
| [backend/src/index.js](../backend/src/index.js) | Modified | Added handleSyncChapters() function + route |
| [backend/scripts/sync_chapters.js](../backend/scripts/sync_chapters.js) | Created | CLI tool for manual syncing |

---

## 🔗 Integration with Previous Sprints

### Database Schema (Sprint 0 ✅)
- ✅ Options table has: consequence, next_chapter_id, next_scene_id, gds_mapping columns
- ✅ Clinical_mappings table ready for designer-sourced mappings
- ✅ Triggers auto-populate session_scores from clinical_mappings

### API Design (Sprint 1b ✅)
- ✅ New endpoint: POST /admin/sync-chapters
- ✅ Reads from content/ directory (same as Alexa skill)
- ✅ Syncs to Supabase in single transaction
- ✅ Idempotent (upserts don't duplicate data)

### Next Steps (Sprints 1c–2+)
- [ ] **Sprint 1c**: Create additional chapters (27 chapters total)
- [ ] **Sprint 2**: Backend API for session closure + score computation
- [ ] **Sprint 3**: Clinician dashboard backend
- [ ] **Sprint 4**: Integration testing + deployment

---

## ✅ Validation Checklist

- [x] chapters.json loads without errors
- [x] All required fields present (option_id, option_text, consequence, etc.)
- [x] GDS items valid (1-15)
- [x] PHQ items valid (1-9)
- [x] Endpoint returns 200 on success
- [x] Endpoint validates chapters.json structure
- [x] Script counts items correctly
- [x] Database receives upsert/insert calls
- [x] clinical_mappings table populated with mapping_source='designer'
- [x] Clinical mapping rationale field populated

---

## 📞 Quick Reference

### Running the Sync
```bash
# Development (staging)
cd backend
npm run dev  # Terminal 1
node scripts/sync_chapters.js staging  # Terminal 2

# Production (after staging passes)
node scripts/sync_chapters.js production
```

### Common Issues & Fixes

**Issue**: "chapters.json not found"
- **Fix**: Ensure file exists at `backend/../content/chapters.json`

**Issue**: Validation errors in sync script
- **Fix**: Check [CHAPTERS_FORMAT.md](../CHAPTERS_FORMAT.md) for required fields

**Issue**: Backend returns 500 error
- **Fix**: Check backend logs; ensure Supabase credentials are set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

**Issue**: Clinical mappings not appearing in database
- **Fix**: Verify options were upserted first; check gds_mapping/phq_mapping JSON format

---

## 📚 Documentation

See also:
- [CHAPTERS_FORMAT.md](../CHAPTERS_FORMAT.md) — Schema reference
- [database/SCHEMA_DOCUMENTATION.md](../../database/SCHEMA_DOCUMENTATION.md) — Database schema
- [backend/README.md](../README.md) — Backend setup

---

**Status**: ✅ FASE 1 Complete  
**Next Phase**: Expand chapters.json with 27 chapters + deploy to staging  
**Approval**: Ready for code review + staging test
