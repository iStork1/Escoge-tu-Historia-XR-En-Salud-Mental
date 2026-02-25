# Sprint 2a: Database Migration Guide

## Problem
The `is_closed` and `created_at` columns don't exist in the Supabase `sessions` table yet. Sprint 2a endpoints need these columns to store session closure state.

## Solution
Apply migration: `database/migrations/002_sprint2a_session_columns.sql`

---

## How to Apply

### Option A: Supabase Dashboard (Easiest)

1. Open [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Click **"New Query"**
5. Copy-paste the SQL from `database/migrations/002_sprint2a_session_columns.sql`:
   ```sql
   ALTER TABLE sessions 
   ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE,
   ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
   ```
6. Click **"Run"** (green play button)
7. Wait for success message ✅

### Option B: Supabase CLI (If Installed)

```bash
# First, ensure you have Supabase CLI installed
# npm install -g supabase

# Login to Supabase (if not already)
supabase login

# Link to your project
supabase link --project-ref <your-project-ref>

# Apply migration
supabase migration up

# Verify
supabase db list
```

### Option C: PostgreSQL CLI (Advanced)

```bash
# Using psql directly (if you have PostgreSQL client installed)
psql -h <supabase-host> -U postgres -d postgres -c "$(cat database/migrations/002_sprint2a_session_columns.sql)"
```

---

## Verification

After running the migration, verify the columns exist:

### In Supabase Dashboard:
1. Go to **DB Browser** (left sidebar)
2. Click **"sessions"** table
3. Scroll right to see columns
4. Look for **`is_closed`** and **`created_at`** columns

### Via SQL Query:
```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'sessions' 
ORDER BY ordinal_position;
```

Expected output should include:
- `is_closed` → `boolean` (DEFAULT: false)
- `created_at` → `timestamp with time zone` (DEFAULT: now())

---

## What the Migration Does

```sql
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
```

1. **`is_closed BOOLEAN DEFAULT FALSE`**
   - Tracks whether a session has been closed
   - Used by `PUT /sessions/{id}/close` endpoint
   - Default: false (session active)

2. **`created_at TIMESTAMPTZ DEFAULT now()`**
   - Records when session was created
   - Mirrors `started_at` for both reference points
   - Useful for retention/archival decisions

---

## After Migration

Once applied, run the test again:

```bash
cd backend
node scripts/test_session_endpoints.js staging
```

Expected output:
```
📝 Test 1: PUT /sessions/{id}/close
──────────────────────────────────────────────────
Status: 200  (or 404 if session doesn't exist in DB - that's expected)
Response: { "ok": true, "session_id": "...", ... }
✅ Session close endpoint working
```

---

## Rollback (If Needed)

If you need to undo this migration:

```sql
ALTER TABLE sessions 
DROP COLUMN IF EXISTS is_closed,
DROP COLUMN IF EXISTS created_at;
```

But typically no need—these columns are harmless additions.

---

## Next Steps

1. ✅ Apply the migration (choose Option A/B/C above)
2. ✅ Verify columns exist
3. ✅ Re-run test: `node scripts/test_session_endpoints.js staging`
4. ➡️ Proceed to Sprint 2b: Validation Middleware

