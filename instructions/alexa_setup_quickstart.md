**Alexa Quickstart**
- **Create .env**: open `backend/.env` and set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (keep the key secret).
- **Run backend**:

```powershell
cd backend
npm install
npm run start
```

- **Expose local server with ngrok** (HTTPS required by Alexa):

```powershell
ngrok http 7070
```

- **Alexa Developer Console**:
  - In your Skill's Endpoint settings, choose HTTPS and set the endpoint to `https://<your-ngrok-id>.ngrok.io/telemetry`.
  - Upload the interaction model from `alexa/interaction_model_minimal.json` (JSON Editor → Replace model) and build the model.

- **Test flow**:
  - Use the Test tab in Alexa Developer Console (or an Echo device linked to your developer account) to say "Alexa, abre elige historia" (invocation name) then use the sample utterances for `StartChapterIntent` and `ChooseOptionIntent`.
  - Alternatively, send the one-chapter payload to the backend with:

```powershell
$p = Get-Content -Raw twine\payload_examples\one_chapter_payload.json
Invoke-RestMethod -Uri http://localhost:7070/telemetry -Method Post -Body $p -ContentType 'application/json'
```

**Notes**:
- For production or external testing, deploy the backend to a reachable HTTPS host and configure proper RLS and secrets in Supabase.
- Do NOT commit the service role key into version control; use CI secrets or local environment variables.
