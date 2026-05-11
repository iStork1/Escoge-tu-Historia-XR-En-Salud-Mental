# Setup — Escoge tu Historia XR En Salud Mental

## Requisitos

- Node.js 18+
- npm

No necesitás cuenta de Supabase ni API keys para correr el backend en modo demo.

---

## Modo demo (sin credenciales)

El servidor corre con base de datos mock (nada se persiste) y LLM mock (respuestas instantáneas sin llamadas de red).

```bash
cd backend
cp .env.example .env
npm install
npm start
```

La consola debe mostrar:
```
Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — running in local/mock mode
[LLM] Initializing provider: mock
Telemetry API listening on 7070
```

### Verificar que funciona

```bash
# Health check
curl http://localhost:7070/health

# Simular LaunchRequest de Alexa
curl -X POST http://localhost:7070/alexa \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "request": {
      "type": "LaunchRequest",
      "requestId": "test-001",
      "timestamp": "2024-01-01T00:00:00Z",
      "locale": "es-MX"
    },
    "session": {
      "sessionId": "session-test",
      "application": { "applicationId": "test-app" },
      "user": { "userId": "user-test" },
      "new": true
    },
    "context": {
      "System": {
        "device": { "deviceId": "device-test" },
        "application": { "applicationId": "test-app" },
        "user": { "userId": "user-test" }
      }
    }
  }'

# Panel de admin (sin token en modo demo)
curl http://localhost:7070/admin/review-queue
```

---

## Usando un proveedor LLM real

Edita tu `.env`, descomentá el proveedor y completá la API key:

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
LLM_CORE_MODEL=qwen/qwen3-next-80b-a3b-instruct:free
```

Proveedores disponibles: `openrouter`, `cohere`, `groq`, `openai`, `claude`, `ollama`.

---

## Conectando a Supabase

Si querés persistencia real, completá en `.env`:

```env
SUPABASE_URL=https://<tu-proyecto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

El schema se aplica con las 11 migraciones en `database/migrations/` siguiendo el orden de `database/DEPLOYMENT_ORDER.md`.
