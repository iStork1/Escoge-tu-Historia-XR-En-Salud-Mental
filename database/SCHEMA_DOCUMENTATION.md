# Escoje tu Historia — Database Schema Documentation

## Versionado de Schema
- **Versión actual**: 1.2 (Migration 001-003 applied)
- **Última actualización**: 2026-02-23
- **Estado**: Production-ready with session lifecycle management and data integrity enforcement

Resumen
- Propósito: almacenar telemetría de sesiones de juego, decisiones del usuario, mapeos clínicos (GDS/PHQ), eventos de riesgo y métricas agregadas, preservando privacidad.
- Stack recomendado: Supabase (Postgres), Supabase Storage (audio), Edge Functions para llamadas LLM.

Contenido del repositorio (carpeta `database/`)
- `schema.sql` — definición de tablas, extensiones y columnas principales.
- `indexes.sql` — índices recomendados para consultas y filtros comunes.
- `views.sql` — vistas para dashboards (`dashboard_sessions`, `risk_overview`).
- `audit_triggers.sql` — triggers para detección PHQ‑9#9 y GDS‑7, auto-población de `session_scores`, actualización de métricas agregadas.
- `decision_payload_schema.json` — JSON Schema (draft‑07) para validar payloads de sesión.
- `migrations/001_fix_schema.sql` — Migration script con todos los cambios críticos (Sprint 0a/0b/0c).

Tablas principales (descripción breve)
- `users` — identidad pseudonimada de participantes: `user_id`, `pseudonym`, `created_at`, `metadata`.
- `sessions` — fila por sesión de juego. Campos clave: `session_id` (UUID), `pseudonym`, `started_at` (auto-set on create), `ended_at` (set on session close), `session_length_seconds` (auto-calculated), `consent_given` (reset to FALSE per session, never cached), `privacy_mode`, `abandonment_flag`, `source`, `created_at`, `is_closed`, `metadata`. **REMOVED** (Migration 003): `normalized_emotional_score_gds`, `normalized_emotional_score_phq` (use `session_scores` table instead), `ingest_batch_id` (test-only marker).
- `decisions` — cada elección tomada por el usuario. Campos clave: `decision_id`, `session_id` (FK), `chapter_id` (FK, NEW), `timestamp`, `scene_id` (FK), `option_id` (FK), `option_text`, `time_to_decision_ms`, `mapping_confidence`, `raw_mapping`. **CHANGE**: Ahora con FK constraint en chapter_id y ON CASCADE en scene_id/option_id.
- `chapters`, `scenes` — estructura canonical de la narrativa.
- `options` — opciones disponibles en cada escena. Campos: `option_id`, `scene_id` (FK), `option_text`, `consequence` (NEW), `next_chapter_id` (NEW, FK nullable), `next_scene_id` (NEW, FK nullable), `gds_mapping` (renamed from `designer_mapping`), `metadata`. **CHANGES**: 3 new columns + rename; permite branching narrativo y persistence de desenlaces.
- `clinical_mappings` — denormalización de los mapeos clínicos por decisión. Campos clave: `mapping_id`, `option_id` (FK, designer pre-authored), `decision_id` (FK, LLM post-hoc), `scale` (GDS/PHQ), `item`, `weight`, `confidence`, `mapping_source` (designer|llm|heuristic), `source_confidence`, `validated`, `primary_construct`, `rationale`.
- `reviewers` — cuentas de revisión clínica para el dashboard (nombre, rol, email opcional).
- `clinical_mapping_reviews` — feedback clínico sobre mapeos: `verdict`, `reviewer_confidence`, `suggested_mapping`, `training_ready`.
- `decision_ratings` — valores concretos por `decision` para items GDS/PHQ (item, value). Facilita cálculo de `session_scores`.
- `session_scores` — agregados por sesión (`gds_total`, `phq_total`, `computed_at`) para lecturas rápidas. **NEW TRIGGER**: Auto-populated on decision/mapping insert via `fn_compute_session_scores()`.
- `decision_audit` — guarda request/response LLM, resultado de validación y flags. Útil para trazabilidad y revisión clínica.
- `risk_events` — eventos de riesgo detectados. Tipos soportados: `PHQ9_ITEM9_SELFHARM`, `GDS7_SOCIAL_ISOLATION` (NEW). Campos: `risk_event_id`, `session_id`, `decision_id`, `risk_type`, `score`, `threshold_used`, `action_taken`, `notified`, `resolved`, `notes`.
- `user_metrics_aggregated` — métricas por pseudónimo (longitudinales) para reporting.
- `audio_metrics` — (opcional) métricas derivadas del audio; almacenar solo si `consent_given=true`. Guardar audio en Supabase Storage y referenciar `audio_path`.

Custodia separada de reclutamiento y contacto
- Los datos de contacto usados para convocatoria, consentimiento informado y seguimiento logístico deben vivir fuera del motor narrativo.
- El backend narrativo solo debe operar con `pseudonym` y datos de sesión mínimos.
- La tabla o repositorio de contacto debe tener acceso restringido y retención independiente.
- Ver protocolos operativos: [P3-01_protocolo_reclutamiento_contacto_custodia.md](../Important%20decisions/P3-01_protocolo_reclutamiento_contacto_custodia.md) y [P3-02_matriz_responsabilidades.md](../Important%20decisions/P3-02_matriz_responsabilidades.md).

Decisiones de diseño importantes
- **Mapeos primarios (Designer)**: Las opciones deben estar pre‑mapeadas con `gds_mapping` JSONB cuando sea posible. Estructura: `[{ "item": 7, "weight": 0.8, "confidence": 0.9, "rationale": "social_engagement" }]`
- **Mapeos secundarios (LLM)**: Llamadas post-hoc que se persisten en `clinical_mappings` con `mapping_source='llm'` y se comparan vs designer mappings.
- **Registro de fuentes**: `clinical_mappings.mapping_source` identifica si el mapeo proviene de `designer` (pre-authored), `llm` (computed), o `heuristic` (rules-based).
- **Consentimiento**: `sessions.consent_given` controla (via RLS) la inserción en `audio_metrics` y el almacenamiento de audio en Storage.
- **RISK_FLAG Detection**: 
  - PHQ‑9 #9 (self-harm) → si `weight * confidence >= 0.2` crear `risk_events` (AUTO, NO confirmation needed)
  - GDS‑15 #7 (social isolation) → si `weight * confidence >= 0.3` crear `risk_events` (AUTO)
  - Evitar acciones automatizadas sin revisión humana; alerts + clinician dashboard.
- **Auditoría**: `decision_audit` almacena el `llm_request`, `llm_response` y `validation_result` para revisión clínica y debugging.

Políticas de seguridad y RLS (sugerencias)
- Habilitar RLS en tablas sensibles (`audio_metrics`, `decision_audit`) y crear políticas que permitan inserts solo cuando `sessions.consent_given = true` o desde el role de servicio.
- Nunca exponer `service_role` al cliente. Usar Edge Functions o backend para operaciones con la key.
- Cifrado: proteger `audio_hash` o cualquier token sensible. Configurar backups y retención conforme a regulación (GDPR: 90 días mínimo para audit trail).

Índices y rendimiento
- **Críticos**: `idx_decisions_session_id_timestamp`, `idx_clinical_mappings_scale_item`, `idx_risk_events_timestamp`, `idx_decisions_chapter_id` (NEW).
- **Narrative queries**: `idx_options_next_chapter`, `idx_options_next_scene` (NEW).
- Materializar vistas de reportes pesados (si el dataset crece) y usar jobs nocturnos para recalcular agregados.

Vistas para dashboard clinico
- `v_mapping_review_queue` — cola de mapeos pendientes con contexto de decision/opcion
- `v_mapping_review_stats` — volumen diario por verdict y confianza promedio
- `v_mapping_training_ready` — feedback marcado como listo para entrenamiento

Triggers y jobs automatizados
- `fn_clinical_mappings_after_insert()`: Detecta PHQ‑9#9 y GDS‑7 risk items; crea `risk_events` automáticamente.
- `fn_compute_session_scores()` (Migration 001): Cuando decision o mapping se inserta, recalcula `session_scores.gds_total` y `phq_total`.
- `fn_ensure_session_start()` (Migration 003): Garantiza que `started_at` siempre esté poblado y **`consent_given` se reinicia a FALSE en cada nueva sesión** (nunca cachea de sesiones previas). Crítico para privacidad y cumplimiento de consentimiento informado.
  - Trigger: `trg_ensure_session_start` (ON INSERT en `sessions`)
  - Behavior: Si `started_at` es NULL, se establece a `now()`; si `consent_given` es NULL, se establece a FALSE
  - Backend responsibility: Llamar `PUT /sessions/{id}/consent` explícitamente después de que el usuario haya autorizado
- `fn_calculate_session_length()` (Migration 003): Auto-calcula `session_length_seconds` cuando `ended_at` se define (resta `started_at` de `ended_at`). Actualiza `is_closed = TRUE` al mismo tiempo.
  - Trigger: `trg_calculate_session_length` (ON UPDATE en `sessions`)
  - Behavior: Se activa solo cuando `NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL` (transición a sesión cerrada)
  - Backend responsibility: Llamar `PUT /sessions/{id}/close` cuando Alexa cierre la sesión
- `fn_ensure_decision_timestamp()` (Migration 003): Garantiza que `created_at` siempre esté poblado en nuevas decisiones.
  - Trigger: `trg_ensure_decision_timestamp` (ON INSERT en `decisions`)
  - Behavior: Si `created_at` es NULL, se establece a `now()`
- `fn_sessions_after_update()`: Cuando `ended_at` queda definido, actualiza/mergea datos en `user_metrics_aggregated`.
- Programar tareas de retención/expurgo (pg_cron o Edge Function + Scheduler) para borrar audio y LLM responses antiguos según políticas.

API de ingestión recomendada
- Endpoint: `POST /telemetry` (protegido). Payload: conforme a `decision_payload_schema.json`.
- Endpoint: `PUT /sessions/{session_id}/close` (NEW) — finalizar sesión y trigger score computation.
- Endpoint: `GET /sessions/{session_id}/summary` (NEW) — retornar scores y risk flags.
- Comportamiento: upsert en `sessions`, insertar `decisions`, persistir `clinical_mappings` (primero `designer_mapping` si existe, luego `llm`), crear/actualizar `decision_audit` si hay LLM data.
- Control transaccional: agrupar inserts por batch (ingest_batch_id) para tolerancia a fallos y reconexión.

Validación y pruebas
- Validar payloads con `decision_payload_schema.json` antes de persistir.
- Generar sesiones sintéticas (1000) para probar índices, retención y triggers.
- Tests unitarios sugeridos: parsing de payload, persistencia transaccional, trigger PHQ‑9, RLS behavior.

Ejemplos de consultas útiles
- Últimas decisiones por usuario:
```sql
SELECT * FROM decisions WHERE session_id = '...' ORDER BY timestamp;
```
- Resumen de riesgo por día:
```sql
SELECT date(timestamp) as day, risk_type, count(*) as events
FROM risk_events GROUP BY day, risk_type ORDER BY day DESC;
```

Despliegue en Supabase (pasos rápidos)
1. Crear proyecto en Supabase.
2. En SQL Editor, ejecutar en este orden:
   1. `database/schema.sql` — Base schema
   2. `database/migrations/001_fix_schema.sql` — Sprint 0 fixes
   3. `database/migrations/002_sprint2a_session_columns.sql` — Sprint 2a session columns
   4. `database/migrations/003_fix_data_capture.sql` — Sprint 2b data integrity (NEW)
   5. `database/indexes.sql` — Performance indexes
   6. `database/views.sql` — Dashboards
   7. `database/audit_triggers.sql` — Triggers and functions
   8. `database/seed_data.sql` — Test data
   9. `database/deploy.sql` — Users and auth
3. Crear bucket privado en Storage para audio; configurar políticas y signed URLs.
4. Subir Edge Functions para LLM calls y `POST /telemetry` (si usas Edge Functions no necesitas backend externo).
5. Configurar RLS policies desde la consola o con SQL (ver `schema.sql` comentarios).
6. **Backend integration required** (see migrations/README.md for details):
   - Handle consent prompting (trigger enforces FALSE; backend must prompt and call `PUT /sessions/{id}/consent`)
   - Call `PUT /sessions/{id}/close` when session ends (triggers auto-calculation of session_length_seconds)

Retención y cumplimiento
- Definir TTL para LLM raw responses y audio (por ejemplo 180 días) y establecer job para borrar o mover a almacenamiento frío.
- Mantener `decision_audit` con records necesarios para auditoría clínica, exportables a S3 si se requiere retención a largo plazo.

Próximos pasos recomendados
1. **Backend Integration** (Required):
   - Implement consent prompting in Alexa handler: Ask user "¿Autoriza el almacenamiento de datos?" at every session start (trigger enforces reset to FALSE per session)
   - Implement session close endpoint call: When Alexa session ends, call `PUT /sessions/{id}/close` to trigger auto-calculation of `session_length_seconds`
   - Populate decision payload fields: `time_to_decision_ms`, `mapping_confidence`, `validation_steps`, `risk_flags` (schema fields exist; backend must fill them)
   
2. **Database Testing**:
   - Run validation queries from `migrations/README.md` after each migration deployment
   - Test consent reset: Create new session via API, verify `consent_given = FALSE` automatically
   - Test session length calculation: Create session, End session (call endpoint), verify `session_length_seconds` auto-calculated
   - Monitor trigger execution in CloudWatch or Supabase Query Logs
   
3. **Schema Review**:
   - Revisar `decision_payload_schema.json` con el equipo clínico para asegurar que `item`/`weight` correspondan a mapeos validados.
   
4. **Staging Deployment**:
   - Ejecutar migrations en un entorno de staging y correr scripts de generación de sesiones sintéticas.
   - Integrar la skill Alexa con el endpoint `POST /telemetry` (o Edge Function) y validar flujo end‑to‑end con 5 usuarios de prueba.
   - Test the new triggers with real data

5. **Production Rollout**:
   - Follow `DEPLOYMENT_ORDER.md` for complete deployment sequence
   - Have rollback scripts ready for each migration (see migration files for rollback SQL)

---
Archivo generado automáticamente por el asistente técnico. Pregunta si quieres que genere un `README` con comandos psql o un script de migración `deploy.sh`.
