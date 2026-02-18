# Phase 1 — Run & Test (local)

Prereqs
- Node.js installed. Run `npm install` inside `backend/`.
- Python 3.8+ with `requests` and `python-docx` if needed. Create and activate `.venv` in project root if you prefer.
- Supabase project (optional) for remote testing. For local prototype you can run backend against a Supabase staging project.

Steps
1. Start backend (from project root run):

```powershell
cd backend
npm install
npm run start
```

2. Ensure `backend/.env` or environment has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

3. Generate payload example (already included):

```powershell
python scripts\twine_to_payload.py
```

4. Run identify + post payload test:

```powershell
python scripts\post_payload_with_token.py
```

Rebuild database (clean start)
- If you want to drop and recreate the schema (you said there is little data), run these steps in the Supabase SQL editor in this order:

1) (Optional) Drop tables (use with caution):

```sql
-- drop dependent tables (run only if you intend to wipe data)
DROP TABLE IF EXISTS decision_ratings, session_scores, clinical_mappings, decisions, options, scenes, chapters, audio_metrics, risk_events, decision_audit, sessions, users, auth_tokens CASCADE;
```

2) Run migrations in sequence:

```sql
-- in Supabase SQL editor, run in order
-- 1. database/schema.sql
-- 2. database/indexes.sql
-- 3. database/views.sql
-- 4. database/audit_triggers.sql
-- 5. database/deploy.sql
-- 6. database/seed_data.sql
```

What to expect
- The `identify` call returns a short token. The POST to `/telemetry` uses that token and the backend will upsert `sessions`, `decisions` and `clinical_mappings` into Supabase.

Notes
- This is a prototype login flow. For production use, replace with proper OAuth / account linking and secure token handling.
