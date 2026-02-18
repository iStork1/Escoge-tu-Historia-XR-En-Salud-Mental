---
8-prompt-decisions

Fecha: 2 de Febrero de 2026
Autor: Felipe Jaimes Meza

PROPUESTA: Detección temprana de depresión en adultos mayores mediante asistentes virtuales

Resumen rápido
- Objetivo: Crear una Skill de Alexa que integre de forma orgánica GDS‑15 y PHQ‑9 dentro de una narrativa interactiva para detectar señales de depresión sin cuestionarios explícitos.
- Enfoque: mapeo contextual por opción, scores separados (GDS y PHQ), auditoría mínima y batching por escena para reducir costos.

1. Alcance técnico
- Entregables canonicos: JSON por capítulo conteniendo `chapter -> scenes -> options -> mappings {scale,item,weight,confidence,rationale}`.
- Metadatos guardados: `decision_audit` (timestamps, session_id, parsed_mapping, validation_steps, risk_flags) — sin PII.

2. Arquitectura (componentes y decisiones clave)
- Motor narrativo (generación por capítulo): controla cobertura y permite una llamada LLM por escena.
- Sistema de mapeo clínico (asignación contextual): decide si mapear a GDS, PHQ o BOTH según la señal del texto.
- Módulo de evaluación continua: mantiene `session_state.gds_scores` y `session_state.phq_scores` separados.
- Skill Alexa: UX con consentimiento vocal y presentación no intrusiva.
- Panel clínico: vista resumida con scores, items detectados y registros `decision_audit`.

3. Fases de desarrollo (duración y entregables)
- Fase 1 — Diseño clínico‑narrativo (2w): tabla GDS↔PHQ, 28 capítulos Twine mapeados manualmente.
- Fase 2 — Prototipo (4w): JSON canónico, backend mínimo, skill Alexa, piloto N≈10 para ajustar pesos.
- Fase 3 — Automatización IA (4w): prompts consolidados por escena, validadores clínicos automáticos.
- Fase 4 — Producción (4w): pipeline generación→validación→despliegue, dashboard y auditoría.
- Fase 5 — Personalización (4w): ajustes de sensibilidad por perfil de usuario.
- Fase 6 — Evaluación longitudinal (2w): estudio correlacional y recalibración.

4. Validación y métricas
- Métrica principal: Pearson r entre score narrativo y GDS‑15/PHQ‑9 clínicos inicial/final.
- Métricas operativas: tasa `uncertain` (<10% objetivo), tasa `RISK_FLAG`, mapping_confidence medio (>=0.65), retención de usuarios.

5. Decisiones técnicas (qué, por qué, impacto)
- Esquema JSON obligatorio:
  - Por qué: interoperabilidad y validación.
  - Impacto: facilita tests automáticos y auditoría.
- Umbrales de confianza (`default_confidence_threshold = 0.6`):
  - Por qué: equilibrar sensibilidad vs falsos positivos.
  - Impacto: reduce ruido y minimiza acciones incorrectas.
- PHQ‑9 item 9 → `RISK_FLAG` y bloqueo:
  - Por qué: alto riesgo ético/legislativo.
  - Impacto: activa revisión humana inmediata y registro auditable.
- Batching por escena + heurísticos locales:
  - Por qué: minimizar llamadas LLM y tokens.
  - Impacto: reducción de coste ≈3x por capítulo; menor latencia.
- Scoring separado y regla de agregación (`increment = weight * confidence`):
  - Por qué: preservar señales específicas de cada escala.
  - Impacto: reportes clínicos más interpretables.
- Auditoría mínima y privacidad by design:
  - Por qué: seguridad y ética.
  - Impacto: trazabilidad sin PII.

6. Pruebas y criterios de aceptación (MVP)
- Unit tests: schema parsing, thresholds, PHQ/GDS calculation, RISK_FLAG.
- Pilot: N=50 with concurrent GDS‑15 and PHQ‑9.
- Acceptance: end‑to‑end working; mapping_confidence mean >= 0.65; RISK_FLAG auditable.

7. Evolución y escalabilidad
- Recalibración post‑pilot: ajustar pesos y thresholds usando ground truth.
- Posible siguiente paso: entrenar un modelo supervisado que prediga score y riesgo a partir de secuencias de decisiones.

8. Conclusión
- Decisión estratégica: priorizar detección temprana no intrusiva, validez clínica y sostenibilidad económica. Las decisiones técnicas propuestas (mapeo contextual, scores separados, batching por escena, auditoría mínima) apuntan a maximizar el valor clínico con mínimo riesgo operativo.

---
Apéndice: ejemplos, payloads y prompts (mantener como referencia operativa)



1) Principales decisiones y reglas operativas

- Mapeo probabilístico y umbral de confianza:
  - Las opciones devuelven `clinical_mapping` con `scale`, `item`, `weight` y `confidence`.
  - `default_confidence_threshold = 0.60`. Solo se incorporan al score si `confidence >= threshold`.

- No forzar mapeos artificiales:
  - Permitir `clinical_mapping: []` cuando no hay señal clínica clara.

- Tratamiento especial PHQ‑9#9 (ideación suicida):
  - Criterio de `RISK_FLAG`: `scale=="PHQ" && item==9 && (weight * confidence) >= 0.20`.
  - Acción: bloquear agregado automático al score, generar `decision_audit`, notificar operador y activar protocolo clínico.

- Output schema rígido (obligatorio):
  - Validar estructura JSON antes de usar datos. Ver sección "Esquema de salida".

- Parámetros LLM:
  - Para mapeos: temperatura 0.0–0.3. Para narrativa: 0.2–0.6.
  - `max_tokens` según tarea (200–400 tokens por escena típica).

- Few-shot y validadores:
  - Incluir 3–5 ejemplos en prompts de `map_choice` y `validate_mapping`.

- Reintentos y fallback:
  - `retry_policy`: reintentar 1 vez si `mapping_confidence < threshold` o JSON inválido.
  - Si persiste, marcar `uncertain`, no sumar a score y registrar para revisión.

2) Mapeo sugerido GDS‑15 ↔ constructos (para revisión clínica)

GDS_1: `low_mood`
GDS_2: `anhedonia`
GDS_3: `fatigue`
GDS_4: `sleep_disturbance`
GDS_5: `appetite_change`
GDS_6: `cognitive_concern`
GDS_7: `social_engagement`
GDS_8: `health_anxiety`
GDS_9: `safety_perception`
GDS_10: `mood_variability`
GDS_11: `social_support`
GDS_12: `activity_level`
GDS_13: `interest_engagement`
GDS_14: `hopelessness`
GDS_15: `suicidal_ideation` (tratar como `RISK_FLAG` si aplica)

3) Tabla de umbrales (ejemplo)

```json
{
  "PHQ_9": 0.9,
  "GDS_15": 0.85,
  "default": 0.6
}
```

4) Esquema de salida obligatorio (JSON)

Versión mínima esperada por la capa de validación:

```json
{
  "chapter_number": 1,
  "chapter_title": "",
  "scenes": [
    {
      "scene_number": 1,
      "narration": "...",
      "options": [
        {
          "option_number": 1,
          "text": "...",
          "clinical_mapping": [
            {"scale":"GDS","item":2,"weight":0.6,"confidence":0.78,"primary_construct":"social_engagement"}
          ],
          "mapping_confidence": 0.75,
          "primary_construct": "social_engagement"
        }
      ]
    }
  ],
  "clinical_summary": {"gds_coverage":[],"phq_coverage":[],"balance_score":0.0}
}
```

Campos clave: `clinical_mapping` (scale,item,weight,confidence,primary_construct), `mapping_confidence` (agregado por opción).

## Apéndice: Ejemplos y payloads

5) Ejemplos few-shot (para prompt)

- Ejemplo sin mapeo clínico relevante:

```json
{"option_number":1,"text":"Ir a comprar frutas al mercado","clinical_mapping":[],"mapping_confidence":0.12}
```

- Ejemplo con señal clínica moderada:

```json
{"option_number":2,"text":"Quedar en casa sin hablar con nadie","clinical_mapping":[{"scale":"GDS","item":2,"weight":0.5,"confidence":0.8,"primary_construct":"social_withdrawal"}],"mapping_confidence":0.8}
```

- Ejemplo que dispara riesgo (PHQ‑9#9):

```json
{"option_number":3,"text":"Desear no estar vivo","clinical_mapping":[{"scale":"PHQ","item":9,"weight":1.0,"confidence":0.95,"primary_construct":"suicidal_ideation"}],"mapping_confidence":0.95}
```

6) Payloads de prueba (guardar en `instructions/payloads`)

- Caso A — confianza alta:

```json
{
  "session_id":"test-001",
  "chapter_number":1,
  "scene_number":2,
  "option_selected":1,
  "parsed_mapping": { "clinical_mapping":[{"scale":"GDS","item":7,"weight":0.6,"confidence":0.84}], "mapping_confidence":0.84 }
}
```

- Caso B — incertidumbre (RETRY):

```json
{
  "session_id":"test-002",
  "chapter_number":1,
  "scene_number":3,
  "option_selected":2,
  "parsed_mapping": { "clinical_mapping":[], "mapping_confidence":0.18 },
  "action":"RETRY_PROMPT"
}
```

- Caso C — riesgo crítico (RISK_FLAG):

```json
{
  "session_id":"test-003",
  "chapter_number":1,
  "scene_number":5,
  "option_selected":3,
  "parsed_mapping": { "clinical_mapping":[{"scale":"PHQ","item":9,"weight":1.0,"confidence":0.92}], "mapping_confidence":0.92 },
  "action":"RISK_FLAG",
  "escalation": {"notified":true,"method":"operator_dashboard"}
}
```

7) Algoritmo de scoring sugerido

- Para cada item validado (confidence >= threshold): `increment = weight * confidence`.
- `session_state.scores[scale] += adjusted_weight(increment)` (aplicar descuento por repetición si aplica).

Función de descuento por repetición (ejemplo):

```python
def adjusted_weight(base_weight, repetition_count):
    if repetition_count > 3:
        return base_weight * (0.8 ** (repetition_count - 3))
    return base_weight
```

8) Manejo de `RISK_FLAG` y escalado

- Criterio primario: PHQ‑9 item 9 con `weight*confidence >= 0.2` → `RISK_FLAG`.
- Acciones automáticas: bloquear agregado al score, persistir `decision_audit`, notificar operador y activar protocolo.

9) Auditoría mínima (registro de decisión)

Ejemplo de `decision_audit`:

```json
{ "decision_audit": { "timestamp":"...","session_id":"...","option_selected":"...","parsed_mapping":[],"validation_steps":[],"final_score_delta":0.0 }}
```

10) Checklist de implementación (developer)

1. Añadir variables de entorno: `LLM_API_KEY`, `LLM_ENDPOINT`, `LLM_MODEL`, `AUDIT_DB_URL`.
2. Implementar `build_map_choice_prompt(context, few_shot_examples)` y `validate_response_schema(response)`.
3. Llamar al LLM con temperatura baja y parsear JSON.
4. Aplicar `retry_policy` si `mapping_confidence < threshold`.
5. Calcular score y actualizar `session_state`.
6. Persistir `decision_audit` (sin PII) y metadatos.
7. Manejar `RISK_FLAG` y notificar operator dashboard.
8. Escribir tests unitarios para parsing, umbrales y `RISK_FLAG`.

11) Pruebas piloto y métricas

- Tamaño sugerido: N=50–100 con evaluación paralela GDS‑15/PHQ‑9.
- Métricas: correlación (Pearson r), sensibilidad/especificidad, tasa de `uncertain`, tasa de `RISK_FLAG` y falsos positivos críticos.

12) Notas de privacidad y consentimiento

- Solicitar consentimiento explícito antes de almacenar metadatos de interacción.
- No persistir transcripciones ni PII en la base de auditoría.

13) Archivos recomendados a crear

- `instructions/payloads/*.json` — payloads de prueba.
- `lambda/llm/prompts_map_choice.txt` — plantilla de prompt con few-shot.
- `lambda/llm/validate_schema.json` — output_schema para validación.

Próximos pasos sugeridos:
1. Revisión clínica de tabla GDS↔constructos y pesos.
2. Implementación backend mínimo + pruebas E2E con payloads de ejemplo.
3. Pilotaje N=50 y recalibración de umbrales.

## Ejemplos explicativos: requerimientos funcionales y propuesta de valor
Esta sección traduce las decisiones técnicas a ejemplos prácticos (UX, API, auditoría y métricas) que sirven para validar la propuesta de valor.

- Flujo de usuario (mínimo viable):
  1. Usuario abre la skill en Alexa y escucha una breve introducción con consentimiento.
  2. Se presenta una escena y 3 opciones narrativas.
  3. Usuario selecciona una opción; Alexa envía `map_choice` al backend.
  4. Backend llama al LLM, valida `dual_clinical_mapping`, actualiza scores y responde con la siguiente narración.
  5. Si surge `RISK_FLAG`, mostrar mensaje de cuidado y enviar `decision_audit` a operador.

- Payload API (ejemplo simplificado que frontend enviaría al backend):

```json
{
  "session_id":"abc-123",
  "user_consent":true,
  "scene": {"chapter":1,"scene_number":2},
  "option_selected":2,
  "recent_context":["previous_choices..."]
}
```

- Respuesta esperada del backend (ejemplo):

```json
{
  "parsed_mapping": {"gds":[{"item":7,"weight":0.6,"confidence":0.8}],"phq":[{"item":1,"weight":0.5,"confidence":0.7}]},
  "mapping_confidence":0.75,
  "next_narration":"Tu vecina sonríe y te propone salir a caminar...",
  "actions":[]
}
```

- Decision audit (ejemplo breve):

```json
{
  "decision_audit":{
    "timestamp":"2026-02-05T10:30:00Z",
    "session_id":"abc-123",
    "option_selected":"Me quedo en casa",
    "parsed_mapping":{...},
    "validation_steps":["schema_ok","confidence_ok"],
    "risk_flag":false
  }
}
```

- Escalado (secuencia mínima):
  1. Detectar `RISK_FLAG` → 2. Crear `decision_audit` con bloque de contexto mínimo → 3. Notificar operador (dashboard) con pseudónimo de usuario → 4. Registrar acción tomada.

- UX / Consentimiento (snippet por voz):
  "Antes de continuar, para mejorar la experiencia necesitamos analizar cómo respondes en algunas escenas. ¿Aceptas que guardemos información anónima sobre tus decisiones para mejorar el servicio?"

- Métricas y KPIs (mínimas para propuesta de valor):
  - Correlación con GDS/PHQ clínicos (Pearson r)
  - Tasa de `uncertain` (objetivo < 10%)
  - Tasa de `RISK_FLAG` y tiempo medio a notificación humana
  - Retención de usuarios/escenas completadas (UX KPI)

- Criterios de aceptación para MVP:
  - End‑to‑end funcionando: Alexa → backend → LLM → respuesta valida JSON
  - `mapping_confidence` medio >= 0.65 en pilot
  - Procesos de `RISK_FLAG` y `decision_audit` operativos

## Actualización: Estrategia dual corregida y optimizada para minimizar llamadas LLM
Objetivo: mantener cobertura GDS + PHQ en todo el sistema pero reducir el número de prompts y llamadas al LLM para controlar costos.

Principio conceptual corregido (resumen):
- Cobertura integral a nivel de capítulo/escenario: no es necesario mapear ambas escalas en cada decisión individual.
- Asignación natural por contexto: cada opción normalmente mapeará a la escala más pertinente (GDS o PHQ), o a `BOTH` solo cuando la señal textual lo requiera.
- Scores separados y acumulación independiente: calcular GDS y PHQ por separado y ejecutar una integración interpretativa al final.

Estrategias clave para reducir llamadas LLM (costos):
1) Generación + mapeo en una sola llamada por escena: pedir al LLM que genere las 3 opciones y entregue el mapeo sugerido (scale + items + weight + confidence) en el mismo output JSON. Evita llamada separada `map_choice` por opción.
2) Batch validation: validar localmente (schema + heurísticos ligeros) y sólo reintentar LLM si `mapping_confidence` agregado por escena < umbral.
3) Reusar few-shot comprimido: mantener 3 ejemplos representativos en el prompt y usar variables en backend para no reinyectarlos cada vez (cache prompt template).
4) Usar prompt de bajo coste para verificación (temperature 0, fewer tokens) o un validador ligero local antes de llamar a modelos más caros.

Prompt consolidado (ejemplo) — generar opciones + mapeo en una llamada:

```javascript
const SCENE_GEN_AND_MAP_PROMPT = `
Genera 3 opciones narrativas para la escena dada y para cada opción devuelve un mapeo clínico sugerido (scale: GDS|PHQ, items:[], weight:0-1, confidence:0-1, rationale). Responde SOLO en JSON con la siguiente estructura:
{
  "scene": "...",
  "options": [
    {"text":"...","primary_scale":"GDS|PHQ|BOTH|NONE","suggested_mapping": {"gds":[],"phq":[]},"mapping_confidence":0.0}
  ]
}
Use temperature 0.2 for narrative balance; use low verbosity for mapping. Include 2-3 few-shot examples (compactos).`
```

Fallback / retry policy (minimizar reintentos):
- Si `mapping_confidence` por opción >= `default_confidence_threshold` → aceptar sin reintento.
- Si varias opciones en la escena tienen `mapping_confidence` < threshold pero la `scene_level_confidence` (promedio) >= threshold_scene → aceptar y marcar `uncertain_items` para auditoría.
- Solo si `scene_level_confidence < threshold_scene` lanzar 1 reintento de prompt con aclaración (no más de 1).

Heurísticos locales (baratos) para disminuir llamadas al LLM:
- Contador de palabras clave (p. ej. patrones PHQ vs GDS) para preasignación rápida (`select_appropriate_scale`) y para sugerir items, evitando llamar al LLM cuando el heurístico es concluyente (confidence alta local).
- Normalizar mapping weights con factores de contexto antes de enviar a LLM para que el modelo entregue valores más consistentes.

Optimización de few-shot (reducir tokens):
- Usar ejemplos compactos (1 línea por ejemplo) y referenciar un `example_id` alojado en backend si el proveedor lo permite (reducción de tokens repetidos).

Ejemplo de flujo optimizado por escena (mínimo llamadas):
1. Frontend envía `scene_request` al backend.
2. Backend ejecuta heurístico local (`select_appropriate_scale`) sobre la escena; si heurístico concluyente (score delta >= 0.8), generar opciones con plantilla local y omitir LLM.
3. Si heurístico inconcluso, enviar `SCENE_GEN_AND_MAP_PROMPT` al LLM (1 llamada) para generar las 3 opciones + mapping.
4. Validar schema, aplicar `retry` sólo si `scene_level_confidence` baja.
5. Actualizar `CoverageTracker` y `session_state` con los mappings aceptados.

Código de ejemplo (compacto) para elegir escala y evitar llamada LLM cuando sea posible:

```python
def should_call_llm(option_text, heuristics_threshold=0.8):
    gds_score = count_patterns(option_text, gds_patterns)
    phq_score = count_patterns(option_text, phq_patterns)
    if max(gds_score, phq_score) >= heuristics_threshold:
        return False, 'GDS' if gds_score>phq_score else 'PHQ'
    return True, None
```

Métricas de impacto en costos (estimación):
- Llamadas por capítulo con estrategia previa (mapeo por opción): 5 escenas * 3 opciones * 1 mapping = 15 llamadas.
- Llamadas por capítulo con estrategia optimizada (1 llamada por escena): 5 escenas * 1 = 5 llamadas → ≈ 3x reducción de coste en llamadas LLM.

Recomendación final técnica:
- Implementar primero la versión combinada (generación+mapping por escena). Medir `mapping_confidence` y `coverage`. Si la calidad es suficiente, mantener. Si baja, ajustar few-shot y thresholds.

---
Actualicé el documento con la estrategia optimizada para minimizar prompts y costos. Si quieres, regenero el DOCX ahora y/o creo los archivos de payload y la plantilla `lambda/llm/prompts_map_choice.txt` con el prompt consolidado.

## Implementación detallada: PHQ‑9
Esta sección describe pasos concretos para implementar PHQ‑9 en el backend, incluyendo normalización, thresholds, heurísticos y ejemplos para pruebas unitarias.

1) Objetivo PHQ‑9
- Capturar síntomas somáticos y conductuales relevantes a través de decisiones narrativas; sumarizar en un `phq_score` 0–27 separado de GDS.

2) Estructura de mapeo PHQ (por opción)
- `phq_mapping`: lista de objetos { item: 1..9, weight: -1..1, confidence: 0.0..1.0, rationale }
- `weight` puede ser negativo para opciones que reduzcan la probabilidad de síntoma (ej. negar fatiga).

Ejemplo de opción mappeada a PHQ:

```json
{
  "option_number": 2,
  "text": "Me duele todo y no tengo energía para levantarme",
  "phq_mapping": [
    {"item":4,"weight":0.8,"confidence":0.9,"rationale":"describe fatiga y baja energía"},
    {"item":3,"weight":0.5,"confidence":0.7,"rationale":"problemas de sueño implícitos"}
  ],
  "mapping_confidence": 0.85
}
```

3) Cálculo PHQ (sugerido)
- Por cada `phq_mapping` válido (confidence >= `default_confidence_threshold`): `increment = weight * confidence * item_scale_factor`
- Sumar increments por item para obtener `phq_raw_total`.
- Normalizar: `phq_normalized = clamp(round(phq_raw_total,2), 0, 27)` (opcional escala lineal o mapeo por tabla según validación clínica).

Código de ejemplo (Python):

```python
def calculate_phq_score(phq_mappings, threshold=0.6):
    total = 0.0
    for m in phq_mappings:
        if m['confidence'] >= threshold:
            total += m['weight'] * m['confidence']
    # Escalar a 0-27; aquí asumimos pesos y confidencias ya en rango compatible
    normalized = max(0.0, min(total, 27.0))
    severity = (
        "none" if normalized < 5 else
        "mild" if normalized < 10 else
        "moderate" if normalized < 15 else
        "moderately_severe" if normalized < 20 else "severe"
    )
    return {"score": round(normalized,2), "severity": severity}
```

4) Tratamiento especial PHQ‑9 item 9
- Evaluar `phq_item9_signal = any(m for m in phq_mapping if m['item']==9 and m['weight']*m['confidence'] >= 0.2)`.
- Si `phq_item9_signal` → marcar `RISK_FLAG_PHQ9=true`, bloquear agregado automático al score final hasta revisión humana, generar `decision_audit` con `escalation_needed=true`.

5) Thresholds y calibración
- `default_confidence_threshold = 0.6` (revisable por piloto clínico).
- `phq_item9_risk_threshold = 0.2` (weight * confidence).
- Durante pilotaje, compare `phq_normalized` con PHQ‑9 clínico para ajustar factor de escala y pesos.

6) Heurísticos y preasignación (para reducir LLM calls)
- Usar `phq_patterns` (palabras clave) para detectar con alta confianza items somáticos antes de llamar al LLM.
- Ejemplo: si option_text contiene "dolor" o "cansado" → preasignar PHQ-4 con confidence local 0.9.

7) Tests unitarios sugeridos
- `test_phq_score_single_high_confidence()` — mapea item 4 con weight 1.0, confidence 0.9 → score ≈ 0.9
- `test_phq_item9_risk_flag()` — prover mapping con item9 weight 1.0 conf 0.95 → `RISK_FLAG_PHQ9` true
- `test_phq_thresholding()` — mapping below confidence threshold should be ignored

8) Ejemplo de respuesta backend con PHQ integrado

```json
{
  "parsed_mapping": {
    "phq": [{"item":4,"weight":0.8,"confidence":0.9}],
    "phq_score": {"score":7.2,"severity":"moderate"}
  },
  "actions": []
}
```

9) Integración final con scoring dual
- Mantener `session_state.phq_scores` y `session_state.gds_scores` por separado.
- En reporte final, presentar ambos scores con `integrated_interpretation`.

10) Registro y auditoría
- Incluir `phq_mappings` en `decision_audit` (sin PII). Registrar `phq_score` y si `RISK_FLAG_PHQ9` activado.

