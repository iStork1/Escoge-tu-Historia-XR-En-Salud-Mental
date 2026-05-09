# CLAUDE.md — Escoge tu Historia XR En Salud Mental

## INSTRUCCIÓN OBLIGATORIA — Leer al inicio de cada conversación

**Al comenzar cualquier conversación sobre este proyecto, lee siempre el archivo de memoria del proyecto:**

```
C:\Users\Sebastian\.claude\projects\C--Users-Sebastian-Desktop-Escoge-tu-Historia-XR-En-Salud-Mental\memory\MEMORY.md
```

Este archivo contiene el índice de memorias persistentes (estado del proyecto, tareas en progreso, decisiones importantes). Lee también los archivos referenciados en él antes de responder al usuario. El estado del proyecto cambia entre sesiones — no asumas que recuerdas el estado actual sin leer la memoria primero.

---

## Qué es este proyecto

Experiencia narrativa interactiva por voz (Amazon Alexa, español) diseñada para adultos mayores (60+). La protagonista es **Rosa**, una viuda que recibe una invitación al jardín comunitario de su barrio. Las decisiones del usuario parecen elecciones narrativas pero mapean simultáneamente a ítems del **GDS-15** (Geriatric Depression Scale) y el **PHQ-9** (Patient Health Questionnaire), permitiendo detección temprana de señales de riesgo de salud mental sin que el usuario perciba una evaluación clínica.

**Objetivo dual:**
1. Experiencia de entretenimiento inmersiva con técnicas de prosodía SSML y personalidades de personajes
2. Sistema de evaluación psicométrica validado con detección automática de riesgo (suicidio, aislamiento social)

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Voz | Amazon Alexa Skill (es-ES, es-MX) |
| Backend | Node.js + Express (`backend/src/index.js`, 7,386 líneas) |
| Base de datos | PostgreSQL vía Supabase (15+ tablas, triggers automáticos) |
| LLM | OpenRouter (Qwen3-Next-80B) → Cohere → Groq → Mock (fallback chain) |
| Contenido | `backend/content/chapters.json` (407KB, Capítulo 1 completo) |
| Puerto | 7070 (local), ngrok para Alexa Developer Console |

---

## Estructura de directorios clave

```
/
├── alexa/models/es-ES.json       — Interaction model (intents: StartChapter, ChooseOption, Standard)
├── backend/
│   ├── src/
│   │   ├── index.js              — Servidor principal, TODOS los endpoints
│   │   ├── p0-helpers.js         — Verificación Alexa, validación telemetría, SLA
│   │   ├── ssml-helpers.js       — Prosodía, voces de personajes, tensión narrativa
│   │   ├── llm-client.js         — Abstracción multi-proveedor LLM
│   │   ├── llm-providers.js      — Registro de proveedores
│   │   └── prompts.js            — Templates de prompts (48KB)
│   ├── content/
│   │   ├── chapters.json         — Capítulo 1: ~20 escenas, ~60 decisiones
│   │   └── validation/           — Dataset de validación psicométrica
│   ├── tests/
│   │   ├── p0-regression.test.js — Tests de regresión core
│   │   └── p1-operational.test.js — Tests operacionales
│   └── scripts/                  — Utilidades de sync, consultas debug
├── database/
│   ├── schema.sql                — Schema base (281 líneas)
│   ├── migrations/001..011       — 11 migraciones en orden
│   └── DEPLOYMENT_ORDER.md      — Secuencia segura de despliegue
├── Important decisions/          — ADRs (Architecture Decision Records)
├── ESTADO_TECNICO_ACTUAL.md     — Estado técnico actual detallado
└── instructions/                 — Guías SSML e inmersión
```

---

## Endpoints del backend

| Endpoint | Método | Función |
|----------|--------|---------|
| `/alexa` | POST | Maneja intents de Alexa (StartChapter, ChooseOption, Help…) |
| `/telemetry` | POST | Ingesta telemetría con mappings clínicos |
| `/admin/dashboard` | GET | Panel visual del operador |
| `/admin/review-queue` | GET | Cola de revisión para clínicos |
| `/admin/review-actions` | POST | Feedback del clínico sobre mappings |
| `/admin/clinical-reports` | GET | Reportes clínicos agregados |
| `/sessions/{id}/close` | PUT | Cierra sesión y dispara cálculo de scores |
| `/sessions/{id}/consent` | PUT | Actualiza consentimiento (CRÍTICO: se resetea por sesión) |
| `/llm/arcs/plan` | POST | Ejecuta Prompt 1 (Arquitecto — arco semanal) |
| `/llm/arcs/generate-day` | POST | Ejecuta Prompt 2 (Generador — escenas diarias) |
| `/llm/arcs/state` | GET | Inspecciona artefactos de continuidad |

---

## Sistema de mappings clínicos

Cada opción narrativa tiene mappings a ítems de GDS-15 y/o PHQ-9:

```json
{
  "option_id": "c01-s01-o3",
  "option_text": "Guardar la tarjeta en el cajón sin leerla",
  "gds_mapping": [
    {"item": 3, "weight": 0.75, "confidence": 0.90},
    {"item": 9, "weight": 0.80, "confidence": 0.90}
  ]
}
```

**Detección automática de riesgo (triggers SQL):**
- `PHQ9_ITEM9_SELFHARM`: `weight × confidence ≥ 0.18` → crea `risk_event`
- `GDS7_SOCIAL_ISOLATION`: `weight × confidence ≥ 0.26` → crea `risk_event`

**Thresholds calibrados (v2026_04):** PHQ9_ITEM9=0.18, GDS7=0.26

---

## Base de datos — tablas críticas

| Tabla | Propósito |
|-------|-----------|
| `sessions` | Sesiones pseudonimizadas; `consent_given` **siempre se resetea a FALSE** al crear |
| `decisions` | Decisiones del usuario con timestamps |
| `clinical_mappings` | Mappings GDS/PHQ por decisión (fuente: designer \| llm \| heuristic) |
| `session_scores` | Scores agregados (gds_total, phq_total) — auto-calculados por trigger |
| `risk_events` | Señales de riesgo detectadas con SLA tracking |
| `clinical_thresholds` | Thresholds versionados de detección |
| `narrative_path_cache` | Memoización de rutas para reducir costo LLM |

**Triggers clave:**
- `fn_ensure_session_start()`: Resetea `consent_given=FALSE` en cada nueva sesión
- `fn_compute_session_scores()`: Recalcula scores tras cada mapping
- `fn_clinical_mappings_after_insert()`: Detecta riesgo y crea `risk_events`

---

## Arquitectura LLM (dos prompts)

**Prompt 1 — "Arquitecto" (semanal):** Define temas, nodos críticos, continuidad del arco. Temperatura 0.25. OpenRouter/Qwen.

**Prompt 2 — "Generador" (diario):** Genera escenas jugables del día. Temperatura 0.40. Cohere.

**Optimización de costo:** $0.65 → $0.10–0.20 por usuario/semana mediante generación lazy escena-por-escena + path caching + hard token budgets (MAX_INPUT=800, MAX_OUTPUT=1200).

---

## Voces de personajes (SSML)

| Personaje | Rate | Pitch | Volumen | Efecto |
|-----------|------|-------|---------|--------|
| Hernando (Mentor) | 70% | -8 | soft | — |
| Sofia (Compañera) | 110% | +6 | medium | — |
| Rosa Voz Interior | 80% | -2 | x-soft | whisper |

**Tensión narrativa:** Cascada progresiva de 4 líneas: 100%→90%→75%→65% de rate, pitch bajando, efecto whisper al final.

---

## Privacidad y consentimiento

- **Pseudonimización**: No se almacena PII; solo `pseudonym`
- **Consentimiento por sesión**: Alexa pregunta vocalmente antes de almacenar datos; trigger SQL lo resetea a FALSE en cada sesión nueva
- **RLS**: `audio_metrics` y `decision_audit` protegidos por `consent_given`
- **Retención de audio**: 180 días TTL con auto-borrado
- **Verificación Alexa**: Cadena de certificados + timestamp ±150s

---

## Variables de entorno (.env — NO COMMITEAR)

```
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
PORT=7070
LLM_PROVIDER_CORE=openrouter
LLM_PROVIDER_NARRATIVE=cohere
OPENROUTER_API_KEY, COHERE_API_KEY, GROQ_API_KEY
MAX_ALEXA_TEXT_CHARS=1100
PHQ9_ITEM9_MIN_SCORE=0.4
MILD_WEIGHT_CAP=0.6
```

---

## Estado actual del desarrollo (a 2026-05-04)

### Completado
- Skill Alexa con verificación de firma
- Backend Express con todos los endpoints
- Schema PostgreSQL con 11 migraciones
- Sistema de mappings GDS-15 + PHQ-9
- Detección automática de riesgo (PHQ-9#9, GDS-7)
- Técnicas SSML de inmersión
- Abstracción multi-proveedor LLM
- Pipeline de validación psicométrica
- Gestión del ciclo de vida de sesiones
- Protocolo de reclutamiento y matriz de responsabilidades

### Parcialmente implementado
- Capítulos 2-28: diseñados pero no JSONificados
- Dashboard clínico: endpoints OK, falta testing real
- Mappings dinámicos LLM (Prompt 2): requieren validación

### Pendiente
- Testing en dispositivo Alexa real (solo simulador hasta ahora)
- Despliegue de schema en Supabase
- CI/CD pipeline

---

## Convenciones del código

- Lenguaje del código y comentarios: **inglés** (variable names, comments)
- Lenguaje del contenido narrativo y respuestas Alexa: **español**
- Archivos de decisiones arquitecturales en `Important decisions/`
- Tests en `backend/tests/`, correr con `npm test`
- Sync de contenido a BD: `node backend/scripts/sync_chapters.js`
- Pipeline psicométrico: `npm run psychometrics:run` (desde `backend/`)

---

## Token Optimization Rules

1. Caveman Style: No usar frases de cortesía, confirmaciones de "Entendido" ni explicaciones de lo que se va a hacer. Ir directo al código o a la respuesta técnica.

2. Context Reset: Si la sesión supera 15 comandos, sugerir al usuario ejecutar `/clear` para resetear el historial y eliminar el costo de re-lectura de contexto acumulado.

3. Model Tiering: Para edición de texto simple, documentación o análisis de logs, recomendar `claude --model haiku`. Reservar Sonnet para lógica compleja de programación, arquitectura o debugging multisistema.

4. Minimalist Outputs: Al usar herramientas de lectura (Read, Grep, Glob, Bash con ls/cat), limitar el output estrictamente a lo necesario para la tarea actual. No leer archivos completos si solo se necesita una sección.

5. Edit Over Follow-up: Si el usuario pide una corrección sobre un comando anterior, recordarle que es más barato dar una instrucción correctiva directa o editar el archivo que seguir acumulando contexto en el chat.
