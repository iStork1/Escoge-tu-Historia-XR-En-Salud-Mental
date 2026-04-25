# Telemetry API for "Escoje tu Historia"

Simple Node.js service that ingests telemetry from Alexa frontend and persists to Supabase.

Setup
1. Copy `.env.example` to `.env` and set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (use service role key server-side only).
  - The backend loads env from `backend/.env` or repository root `.env`.
2. Install deps:

```bash
cd backend
npm install
```

Run locally

```bash
npm run start
```

Run with ngrok (for Alexa integration development)

For testing with Alexa Developer Console, expose the backend via ngrok with security:

```bash
# Start backend
npm run start

# In another terminal, create secure ngrok tunnel (1-hour session example)
# Replace YOUR_TOKEN with your ngrok authtoken
ngrok http 3000 --authtoken YOUR_TOKEN --bind-tls=true --auth="devuser:StrongPassword123" --inspect=false

# Update Alexa endpoint in Developer Console with the HTTPS URL (e.g., https://abcd1234.ngrok.io/alexa)
```

**Security notes for ngrok:**
- Always use `--bind-tls=true` for HTTPS (Alexa required)
- Use `--auth` for HTTP Basic auth layer on top of verification
- Set `--inspect=false` to disable public inspection panel unless debugging
- Implement Alexa signature verification in the skill (see [Alexa Request Verification](#alexa-request-verification))
- Session expiry: ngrok free tier sessions close after inactivity; for stable testing use reserved domains or paid ngrok plan

API
- POST `/telemetry` — accepts a JSON payload with `session` fields and `decisions` array. Example minimal payload:

Operational dashboard endpoints
- GET `/admin/dashboard` — visual operator panel that renders the review queue and clinical report data in a single page.
- GET `/admin/review-queue` — returns the clinician review queue from `v_mapping_review_queue`. Requires `Authorization: Bearer <token>` or `x-api-key` when `OPERATIONS_API_KEY`, `DASHBOARD_API_KEY`, `ADMIN_API_KEY`, or `CLINICAL_DASHBOARD_TOKEN` is set.
- POST `/admin/review-actions` — stores a clinician review for a mapping and updates `clinical_mappings.validated` based on the verdict.
- GET `/admin/clinical-reports` — returns aggregate clinical dashboard data. Add `session_id=<uuid>` to get a per-session clinical report. Same authentication as the review queue.

Risk worker
- `npm run risk:worker:once` — processes pending `risk_events`, writes notification attempts, and updates SLA state.
- `npm run risk:worker` — runs the worker in polling mode.

Recommended SLA env vars
- `RISK_NOTIFICATION_SLA_MINUTES`
- `RISK_FIRST_ACTION_SLA_MINUTES`
- `RISK_CLOSURE_SLA_MINUTES`
- `OPERATIONS_API_KEY` or `DASHBOARD_API_KEY` for dashboard access

Psychometric validation pipeline (P2)
- `npm run psychometrics:run` executes a reproducible pilot analysis over `backend/content/validation/pilot_validation_dataset.v1.json`.
- Output JSON artifact: `backend/content/validation/psychometric_metrics.latest.json`.
- The report includes:
  - Correlation (Pearson), sensitivity, specificity, precision, accuracy.
  - Confusion matrix (`TP`, `TN`, `FP`, `FN`) per cohort and model version.
  - Run traceability fields (`run_id`, `pipeline_version`, `rules_version`, `threshold_version`, `model_version`).
- Override paths:

```bash
npm run psychometrics:run -- --dataset ./content/validation/pilot_validation_dataset.v1.json --output ./content/validation/psychometric_metrics.custom.json
```

P2 schema/migration assets
- `database/migrations/011_psychometric_pipeline_and_threshold_calibration.sql`
  - Adds versioned pipeline tables and traceability (`psychometric_pipeline_versions`, datasets, runs, results).
  - Adds threshold versioning (`clinical_thresholds`, `active_threshold_versions`) for risk detection and score banding.
  - Applies calibrated pilot thresholds in SQL for risk detection and score classification consistency.

Calibrated pilot thresholds (v2026_04)
- Risk detection (SQL + dataset + pipeline report):
  - `PHQ9_ITEM9_SELFHARM = 0.18`
  - `GDS7_SOCIAL_ISOLATION = 0.26`
- Score levels (backend defaults + SQL score_banding domain):
  - `low = 0.30`
  - `moderate = 0.55`
  - `high = 0.78`

LLM Arc Workflow (Prompt 1 + Prompt 2)

- POST `/llm/arcs/plan`
  - Purpose: Run Prompt 1 (Arquitecto) once per week.
  - Fixed generation settings: `temperature=0.25`, `max_tokens=3000`.
  - Input example:

```json
{
  "arc_id": "arc_001",
  "week_number": 1,
  "arc_theme": "soledad_y_reconexion",
  "title": "Soledad y Reconexión",
  "chapter_id_range": ["c01", "c07"],
  "constructos": ["social_isolation", "anhedonia"],
  "allow_phq9_item9_policy": "no en ningun dia"
}
```

- POST `/llm/arcs/generate-day`
  - Purpose: Run Prompt 2 (Generador) for one day/chapter (run 7 times per arc).
  - Fixed generation settings: `temperature=0.40`, `max_tokens=8000`.
  - Input example:

```json
{
  "arc_id": "arc_001",
  "arc_day": 1
}
```

- GET `/llm/arcs/state`
  - Purpose: Inspect continuity and generated artifacts for all arcs.

Continuity between weeks
- `next_arc_hook` from day 7 is persisted in `backend/content/arc_workflow_state.json`.
- If you omit `entry_hook` in `/llm/arcs/plan`, the backend auto-uses the last persisted `next_arc_hook`.
- Architecture and generated day files are stored in `backend/content/arcs/`.

Alexa Request Verification

All Alexa requests to the skill must be verified for authenticity. The backend validates:
1. Request signature (X-Alexa-Signature header)
2. Certificate chain validity (X-Alexa-Signature-Certificate-Chain-Url)
3. Timestamp freshness (within ±150 seconds)

Currently, the `/alexa` endpoint uses the `alexaResponse()` helper which wraps responses in SSML tags to support audio effects (breaks, prosody, whispered). **Note:** The verification middleware should be enforced before processing intent logic in production.

Example Alexa-enabled response format (now automatically wrapped in SSML):
```json
{
  "version": "1.0",
  "response": {
    "outputSpeech": {
      "type": "SSML",
      "ssml": "<speak>Rosa se despierta <break time=\"400ms\"/> en silencio.</speak>"
    },
    "shouldEndSession": false,
    "sessionAttributes": { "stage": "scene", "pseudonym": "user1" }
  }
}
```

- POST `/telemetry` — accepts a JSON payload with `session` fields and `decisions` array. Example minimal payload:

```json
{
  "pseudonym": "user_test_1",
  "consent_given": true,
  "chapter_id": "cap1",
  "decisions": [
    {
      "option_id": "leer_carta",
      "option_text": "Leer la carta",
      "time_to_decision_ms": 4200,
      "parsed_mapping": { "clinical_mapping": [{"scale":"GDS","item":3,"weight":0.6,"confidence":0.8}], "mapping_confidence": 0.8 }
    }
  ],
  "llm_request": {"prompt":"..."},
  "llm_response": {"parsed_mapping":"..."}
}
```

Deployment
- Deploy to Vercel / Render / Railway or convert to Supabase Edge Function. Keep `SUPABASE_SERVICE_ROLE_KEY` secret.

Notes
- This is a minimal example for prototyping. Add authentication, stricter validation and transactional handling before production.
