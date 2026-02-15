# Telemetry API for "Escoje tu Historia"

Simple Node.js service that ingests telemetry from Alexa frontend and persists to Supabase.

Setup
1. Copy `.env.example` to `.env` and set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (use service role key server-side only).
2. Install deps:

```bash
cd backend
npm install
```

Run locally

```bash
npm run start
```

API
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
