Biblia del Juego — Telemetría y Diseño (2H)

Propósito
- Documento maestro ("la biblia") que define qué puede y debe hacer el usuario, cuáles son los límites del juego, y la telemetría mínima necesaria para detección clínica y mejora continua.
- Público: product manager, diseñador narrativo, clínico responsable, desarrollador backend.

1. Biblia del juego — guías para el usuario y el equipo
- Experiencia del usuario:
  - El usuario puede: elegir opciones en escenas, pausar/reanudar, pedir aclaraciones al narrador, aceptar o rechazar registro de datos, y solicitar ayuda/soporte.
  - El usuario no debe: recibir preguntas clínicas directas sin consentimiento explícito; el sistema no debe diagnosticar ni ofrecer consejos clínicos automatizados.
- Consentimiento y control:
  - Antes de almacenar cualquier metadato se solicita consentimiento vocal claro; el usuario puede revocar en cualquier momento.
  - Opciones de privacidad: modo "anónimo" (solo métricas agregadas) o modo "con seguimiento" (registro de `decision_audit`).
- Flujo mínimo permitido:
  - Inicio → aviso consentimiento → escena 1 → elecciones → resumen y opción de exportar reporte clínico (solo vía clínico autorizado si aplica).
- Roles y responsabilidades:
  - Diseñador narrativo: mantener mapeo GDS/PHQ por opción.
  - Clínico: validar pesos/umbrales y protocolos RISK_FLAG.
  - Dev backend: asegurar `output_schema`, logs mínimos y export seguro de `decision_audit`.

2. Qué datos se registrarán
- Consentimiento y meta: registrar sólo con consentimiento.
- Datos de sesión (por interacción):
  - `session_id` (pseudonimizado)
  - `timestamp` (ISO)
  - `chapter_id`, `scene_id`, `option_id` (elección tomada)
  - `decision_rationale` (mapping del LLM: scale,item,weight,confidence)
  - `time_to_decision_ms` (latencia desde lectura de la opción hasta la selección)
  - `response_audio_metrics` (si aplica): `voice_tone_scores` (valores de emoción: valencia, arousal, tristeza, ansiedad) — opcional y sujeto a consentimiento explícito)
  - `hesitation_count` / `pause_durations_ms` (si se captura audio)
  - `abandonment_flag` (true si la sesión se cierra sin completar el capítulo)
  - `session_length_seconds`
  - `screen_time` (si aplica)
- Datos agregados por usuario (actividad longitudinal):
  - `frequency_of_use` (sesiones por semana/mes)
  - `avg_time_per_session`
  - `trend_emotional_score` (serie temporal)
- Eventos críticos:
  - `RISK_FLAG` (tipo, trigger_item, weight, confidence, decision_audit_id)
  - `manual_review_requested` (sí/no)

3. Especificación de métricas de detección
- Objetivo: métricas que alimentan señales de riesgo y permiten recalibración clínica.
- Métricas primarias:
  - `emotional_score_accumulated` (float): suma ponderada de `weight * confidence` por ítem relevante (separada por escala: GDS/PHQ).
  - `abrupt_change_flag` (bool): detecta saltos grandes en `emotional_score` entre capítulos/sesiones (p. ej. > 2σ o > 30% cambio relativo).
  - `phq9_item9_risk_score` (float): contador ponderado de triggers relacionados con PHQ‑9#9.
  - `mapping_confidence_mean` (float): promedio de confidencias retornadas por los mappings en una sesión.
- Métricas secundarias / comportamentales:
  - `time_to_decision_mean` (ms): tendencia de lentitud o aceleración en respuestas.
  - `hesitation_rate` (count / options): cambios en pausas y vacilaciones.
  - `abandonment_rate` (percent): porcentaje de sesiones interrumpidas por capítulo.
  - `option_entropy` (float): medida de diversidad en elecciones—baja entropía puede indicar patrón rígido.
- Correlación con escalas clínicas:
  - `pearson_gds_correlation` y `pearson_phq_correlation` (float): correlación entre scores narrativos y GDS/BDI/PHQ estándares (post‑pilot).

4. Tabla de métricas (descripción, tipo de dato y uso en detección)

| Métrica | Descripción | Tipo de dato | Recolección | Uso en detección / Notas |
|---|---:|---|---|---|
| emotional_score_accumulated | Suma ponderada (per scale) de weight*confidence | float | por opción, agregado por sesión | Señal primaria de riesgo; compararse con umbrales clínicos; usar para alertas y reportes |
| phq9_item9_risk_score | Puntuación específica para item 9 PHQ‑9 (ideación suicida) | float | evento por opción | Si >= threshold → `RISK_FLAG` y escalado humano inmediato |
| mapping_confidence_mean | Media de confidencias devueltas por mapping LLM | float (0–1) | por sesión | Control de calidad del mapping; si baja → marcar `uncertain` y pedir revisión |
| abrupt_change_flag | Cambio brusco entre sesiones/capítulos | bool | serie temporal | Detecta deterioro rápido; priorizar para revisión clínica |
| time_to_decision_mean | Tiempo medio de respuesta a opciones (ms) | float | por sesión | Aumentos significativos pueden indicar indecisión o fatiga |
| hesitation_rate | Número de pausas/segundos de silencio antes de elección | float | por opción | Asociado a ansiedad/rumiación; necesita control por ruido de captura audio |
| abandonment_rate | % de sesiones abandonadas antes de completar capítulo | float (0–1) | sesión agregada | Aumento sostenido puede indicar fricción o disconfort clínico |
| frequency_of_use | Sesiones por periodo (semana/mes) | int/float | agregado por usuario | Cambios abruptos (caída o aumento) pueden ser indicador de episodios |
| option_entropy | Entropía de elecciones en un capítulo | float | por capítulo | Baja entropía sostenida puede identificar patrón rígido o evitación |
| sentiment_score | Valor de sentimiento (negativo→positivo) derivado del texto o audio | float (-1..1) | por opción | Contribuye a `emotional_score_accumulated` y tendencias |

Notas sobre tipos y privacidad
- Datos audio/voz y métricas derivadas deben solicitar consentimiento explícito y documentarse en `decision_audit`.
- Guardar solo identificadores pseudonimizados; los exports clínicos deben requerir autorización humana.

5. Umbrales y alertas (sugerencias iniciales)
- `default_confidence_threshold = 0.6` (no sumar incremento si confidence < threshold; marcar como `uncertain`).
- `phq9_item9_risk_threshold = 0.2` (weight*confidence >= threshold → emitir `RISK_FLAG`).
- `abrupt_change` si delta entre sesiones > max(2σ, 30% relativo).
- Revisar y ajustar umbrales tras pilot N=50.

6. Integración técnica mínima requerida
- `decision_audit` schema: {id, session_id, timestamp, chapter_id, scene_id, option_id, mapping:{scale,item,weight,confidence}, validation:[heuristic_checks], risk_flags:[], pseudonym}
- Endpoints/API: POST /telemetry (ingest), GET /reports (agregados), POST /manual_review (escalado).
- Retención: logs clínicos 7 años (o según regulación), pseudonimizado; datos brutos de audio sólo si autorizado y por periodo acotado.
