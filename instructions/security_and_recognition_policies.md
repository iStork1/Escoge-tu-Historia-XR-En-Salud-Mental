# Políticas de Reconocimiento y Seguridad — Flujo de la Skill

Objetivo
- Definir reglas, controles y procedimientos para reconocimiento de usuario, captura de audio, manejo de datos clínicos (GDS‑15 / PHQ‑9), detección de riesgo y seguridad operativa dentro del flujo de la Skill.

Alcance
- Esta política aplica al backend (Edge Functions / API), la base de datos en Supabase, y al almacenamiento de audio en Supabase Storage. No aplica al comportamiento de voz en el dispositivo del usuario salvo consentimiento informado.

1. Consentimiento y entrada en flujo
- Consentimiento explícito: antes de grabar audio o almacenar segmentos identificables, la Skill debe pedir y registrar `consent_given=true` en `sessions`.
- Consentimiento granular: ofrecer opción para:
  - Analizar solamente texto (ASR) sin almacenar audio.
  - Analizar audio y almacenar métricas anónimas (si `consent_given=true`).
  - Almacenamiento de audio para revisión clínica (opción separada).
- Registro: cada decisión de consentimiento se registra en `sessions.consent_given`, `sessions.consent_timestamp` y `sessions.consent_details`.

2. Captura y retención de audio
- Minimizar: grabar solo cuando sea necesario. Preferir ASR en el dispositivo y enviar solo texto cuando sea posible.
- Almacenamiento: guardar audio en bucket privado en Supabase Storage; usar `audio_path` y `audio_hash` en `audio_metrics`.
- Retención: política default 180 días; borrar automáticamente con job programado (pg_cron o Scheduler). Archivar a largo plazo sólo si justificado clínicamente.

3. Anonimización y pseudonimización
- Pseudónimo: usar `pseudonym` en `sessions` en lugar de PII; separar tabla `users` si se requiere mapping con controles adicionales.
- Tokens: cualquier identificador correlacionable (emails, phone) no se debe almacenar en texto plano.

4. Roles y credenciales
- Service role: solo en backend servidor (Edge Function). Nunca exponer `service_role` al cliente.
- Roles DB:
  - `anon`: solo lectura limitada y permite insert de `sessions` sin audio.
  - `authenticated` (client): acceso restringido mediante RLS.
  - `service_role` (server): uso para migraciones, jobs y operaciones administrativas.

5. Row Level Security (RLS) — reglas recomendadas
- Habilitar RLS en tablas sensibles: `audio_metrics`, `decision_audit`, `clinical_mappings` (si contiene PII).
- Ejemplos de políticas (resumidas):
  - Permitir `insert` en `audio_metrics` solo si `EXISTS (SELECT 1 FROM sessions s WHERE s.session_id = new.session_id AND s.consent_given = true)`.
  - Permitir `select` en `decision_audit` solo a roles con claim `role = 'clinician'` o a `service_role`.

6. Detección de riesgo y flujos de respuesta
- Regla PHQ‑9#9: si el mapping produce una puntuación para el ítem 9 tal que `weight * confidence >= 0.2`, crear `risk_events` con `risk_type = 'PHQ9_ITEM9'` y `notified = false`.
- Escalamiento humano: notificar a un operador/clínico designado; no ejecutar acciones automáticas de intervención sin revisión humana.
- Time to respond: definir SLA interno (ej. 24 horas para revisión inicial; 4 horas para casos señalados como alto riesgo).
- Registro de notificación: `risk_events.notified_at`, `risk_events.action_taken`, `risk_events.resolution_notes`.

7. Auditoría y trazabilidad
- Guardar `llm_request`, `llm_response` y `validation_result` en `decision_audit` (acceso restringido).
- Retener logs de auditoría por 720 días o según regulación local; permitir export a almacenamiento seguro para auditoría clínica.

8. Seguridad de LLM y datos derivados
- Criterio de confidencialidad: no enviar campos PII a LLM sin consentimiento y sin pasar por un sanitizador. Preferir mapping descriptores (labels) en vez de texto libre.
- Fallbacks: si `designer_mapping` existe, usarlo; si se usa LLM, registrar `mapping_source = 'llm'` y `source_confidence`.

9. Acceso, monitoreo y alertas
- Monitor: métricas de ingest, latencia LLM, tasa de detecciones de riesgo por día.
- Alertas: alta tasa de PHQ9#9 (p.ej > X por día) dispara alerta a canal de operación.

10. Incidentes y respuesta
- Procedimiento: triage → notificación responsable clínico → registro en `risk_events` → auditoría del caso en `decision_audit`.
- Comunicación al usuario: según política de comunicación y consentimiento, enviar información y recursos (no consejo clínico automatizado).

11. Pruebas y validación
- Test suites:
  - Payloads sintéticos con PHQ/GDS edge cases.
  - Inserciones con/without consent para validar RLS.
  - Simular LLM mappings con baja confianza para validar `source_confidence` handling.

12. Despliegue y checklist
- Revisar variables de entorno: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LLM_API_KEY`.
- Verificar buckets y políticas Storage (privado, signed URLs).
- Ejecutar migraciones en staging y validar RLS.

Anexos rápidos
- Sugerencia SQL RLS (ejemplo):

```sql
-- Permitir insert audio_metrics solo si la sesión tiene consentimiento
CREATE POLICY insert_audio_if_consented ON audio_metrics
FOR INSERT USING (
  EXISTS (
    SELECT 1 FROM sessions s WHERE s.session_id = audio_metrics.session_id AND s.consent_given = true
  )
);
```

Próximos pasos
- Generar versión .docx de este documento y revisar con el equipo clínico. Luego aplicar políticas RLS en staging.

---
Archivo generado por el asistente: `instructions/security_and_recognition_policies.md`.
