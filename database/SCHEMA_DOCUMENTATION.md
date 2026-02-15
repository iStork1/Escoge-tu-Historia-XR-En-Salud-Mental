# Escoje tu Historia — Database Schema Documentation

Resumen
- Propósito: almacenar telemetría de sesiones de juego, decisiones del usuario, mapeos clínicos (GDS/PHQ), eventos de riesgo y métricas agregadas, preservando privacidad.
- Stack recomendado: Supabase (Postgres), Supabase Storage (audio), Edge Functions para llamadas LLM.

Contenido del repositorio (carpeta `database/`)
- `schema.sql` — definición de tablas, extensiones y columnas principales.
- `indexes.sql` — índices recomendados para consultas y filtros comunes.
- `views.sql` — vistas para dashboards (`dashboard_sessions`, `risk_overview`).
- `audit_triggers.sql` — triggers para detección PHQ‑9#9, actualización de métricas agregadas y población de `decision_audit`.
- `decision_payload_schema.json` — JSON Schema (draft‑07) para validar payloads de sesión.

Tablas principales (descripción breve)
- `sessions` — fila por sesión de juego. Campos clave: `session_id` (UUID), `pseudonym`, `started_at`, `ended_at`, `consent_given`, `privacy_mode`, `abandonment_flag`, `normalized_emotional_score_gds`, `normalized_emotional_score_phq`, `source`, `ingest_batch_id`, `metadata`.
- `decisions` — cada elección tomada por el usuario. Campos clave: `decision_id`, `session_id` (FK), `timestamp`, `chapter_id`, `scene_id`, `option_id`, `option_text`, `time_to_decision_ms`, `mapping_confidence`, `raw_mapping`.
- `clinical_mappings` — denormalización de los mapeos clínicos por decisión. Campos clave: `mapping_id`, `decision_id` (FK), `scale` (GDS/PHQ), `item`, `weight`, `confidence`, `mapping_source` (designer|llm|heuristic), `source_confidence`, `validated`, `primary_construct`, `rationale`.
- `users` — identidad pseudonimada de participantes: `user_id`, `pseudonym`, `created_at`, `metadata`.
- `chapters`, `scenes`, `options` — estructura canonical de la narrativa; `options` debe contener `designer_mapping` como mapping maestro.
- `decision_ratings` — valores concretos por `decision` para items GDS/PHQ (item, value). Facilita cálculo de `session_scores`.
- `session_scores` — agregados por sesión (`gds_total`, `phq_total`, `computed_at`) para lecturas rápidas.
- `clinical_mappings` — ahora puede asociarse tanto a `options` (mapping maestro) como a `decisions` (LLM/audit), campos: `mapping_id`, `option_id`, `decision_id`, `scale`, `item`, `weight`, `confidence`, `mapping_source`, `source_confidence`.
- `decision_audit` — guarda request/response LLM, resultado de validación y flags. Útil para trazabilidad y revisión clínica.
- `risk_events` — eventos de riesgo detectados (PHQ‑9#9, cambios bruscos). Campos: `risk_event_id`, `session_id`, `decision_id`, `risk_type`, `score`, `threshold_used`, `action_taken`, `notified`, `resolved`, `notes`.
- `user_metrics_aggregated` — métricas por pseudónimo (longitudinales) para reporting.
- `audio_metrics` — (opcional) métricas derivadas del audio; almacenar solo si `consent_given=true`. Guardar audio en Supabase Storage y referenciar `audio_path`.

Decisiones de diseño importantes
- Mapeos primarios: Las opciones deben estar pre‑mapeadas por el equipo narrativo (`designer_mapping`) cuando sea posible. El LLM actúa como fallback o verificador.
- Registro de fuentes: `clinical_mappings.mapping_source` identifica si el mapeo proviene de `designer`, `llm` o `heuristic`.
- Consentimiento: `sessions.consent_given` controla (via RLS) la inserción en `audio_metrics` y el almacenamiento de audio en Storage.
- RISK_FLAG: PHQ‑9 #9 → si `weight * confidence >= 0.2` crear `risk_events` y notificar operador; evitar acciones automatizadas sin revisión humana.
- Auditoría: `decision_audit` almacena el `llm_request`, `llm_response` y `validation_result` para revisión clínica y debugging.

Políticas de seguridad y RLS (sugerencias)
- Habilitar RLS en tablas sensibles (`audio_metrics`, `decision_audit` si contiene más datos) y crear políticas que permitan inserts solo cuando `sessions.consent_given = true` o desde el role de servicio.
- Nunca exponer `service_role` al cliente. Usar Edge Functions o backend para operaciones con la key.
- Cifrado: proteger `audio_hash` o cualquier token sensible. Configurar backups y retención conforme a regulación.

Índices y rendimiento
- Índices incluidos: `idx_sessions_pseudonym`, `idx_decisions_session_id_timestamp`, `idx_clinical_mappings_scale_item`, `idx_clinical_mappings_source`, `idx_risk_events_timestamp`.
- Materializar vistas de reportes pesados (si el dataset crece) y usar jobs nocturnos para recalcular agregados.

Triggers y jobs automatizados
- `fn_clinical_mappings_after_insert` (trigger): detecta PHQ‑9#9 y crea `risk_events` automáticamente.
- `fn_sessions_after_update` (trigger): cuando `ended_at` queda definido, actualiza/mergea datos en `user_metrics_aggregated`.
- Programar tareas de retención/expurgo (pg_cron o Edge Function + Scheduler) para borrar audio y LLM responses antiguos según políticas.

API de ingestión recomendada
- Endpoint: `POST /telemetry` (protegido). Payload: conforme a `decision_payload_schema.json`.
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
2. En SQL Editor, ejecutar `database/schema.sql` → `indexes.sql` → `views.sql` → `audit_triggers.sql`.
3. Crear bucket privado en Storage para audio; configurar políticas y signed URLs.
4. Subir Edge Functions para LLM calls y `POST /telemetry` (si usas Edge Functions no necesitas backend externo).
5. Configurar RLS policies desde la consola o con SQL (ver `schema.sql` comentarios).

Retención y cumplimiento
- Definir TTL para LLM raw responses y audio (por ejemplo 180 días) y establecer job para borrar o mover a almacenamiento frío.
- Mantener `decision_audit` con records necesarios para auditoría clínica, exportables a S3 si se requiere retención a largo plazo.

Próximos pasos recomendados
1. Revisar `decision_payload_schema.json` con el equipo clínico para asegurar que `item`/`weight` correspondan a mapeos validados.
2. Ejecutar migrations en un entorno de staging y correr scripts de generación de sesiones sintéticas.
3. Integrar la skill Alexa con el endpoint `POST /telemetry` (o Edge Function) y validar flujo end‑to‑end con 5 usuarios de prueba.

---
Archivo generado automáticamente por el asistente técnico. Pregunta si quieres que genere un `README` con comandos psql o un script de migración `deploy.sh`.
