# Sistema de Puntuación — Escoge Tu Historia XR

**Autor**: Felipe Jaimes Meza
**Fecha**: Febrero 2026  
**Estado**: Decisión activa


## 1. Estructura narrativa: Viaje del Héroe semanal (12 etapas)

Cada semana se publica un capítulo sobre el mismo tema (ej. soledad, rutina, pérdida). El capítulo sigue las 12 etapas del Viaje del Héroe (Campbell/Vogler) adaptadas a la vida cotidiana de adultos mayores.

No todas las etapas son escenas jugables — algunas se narran automáticamente. Las escenas con decisión (marcadas con 🎮) presentan **3 opciones** cada una.

| # | Etapa del Viaje del Héroe | Rol en el capítulo | Emoción/constructo que se mide |
|---|---|---|---|
| 1 | **Mundo ordinario** | 🎮 Escena jugable: rutina del día | Estado basal (ánimo, energía, satisfacción) |
| 2 | **Llamada a la aventura** | 🎮 Escena jugable: evento que rompe la rutina | Motivación, interés, apertura al cambio |
| 3 | **Rechazo de la llamada** | 🎮 Escena jugable: tentación de evitar o quedarse | Evitación, fatiga, miedo al cambio |
| 4 | **Encuentro con el mentor** | Narrada: un personaje ofrece consejo o apoyo | Confianza, soporte social percibido |
| 5 | **Cruce del umbral** | 🎮 Escena jugable: decide comprometerse o no | Compromiso, autoeficacia, vulnerabilidad |
| 6 | **Pruebas, aliados, enemigos** | 🎮 Escena jugable: interacción con otros | Engagement social, frustración, resiliencia |
| 7 | **Acercamiento a la cueva** | Narrada: tensión emocional crece | Ansiedad anticipatoria, preocupación |
| 8 | **Ordalía (prueba central)** | 🎮 Escena jugable: momento de mayor reto emocional | Desesperanza, vacío, rumiación |
| 9 | **Recompensa** | Narrada: consecuencia positiva o aprendizaje | Alivio, conexión, logro |
| 10 | **Camino de regreso** | 🎮 Escena jugable: reflexión sobre lo vivido | Integración emocional, perspectiva |
| 11 | **Resurrección** | Narrada: momento de transformación interna | Esperanza, resignificación |
| 12 | **Regreso con el elixir** | 🎮 Escena jugable: cierre del día y proyección | Perspectiva futura, bienestar, ideación (⚠️ solo aquí PHQ-9#9) |

**Resultado**: cada capítulo tiene **~8 escenas jugables** (con 3 opciones c/u = 24 decisiones máximo por capítulo) y **~4 escenas narradas** que mantienen el ritmo sin sobrecargar.

> **Nota**: si 8 escenas jugables es excesivo para un capítulo de 10-20 min, el diseñador puede reducir a 5-6 escenas jugables fusionando etapas adyacentes (ej. fusionar 6+7, o 9+10). Lo importante es respetar el arco emocional.


## 2. Mapeo de decisiones a escalas clínicas

### 2.1 Escalas usadas

| Escala | Ítems | Población | Uso en el proyecto |
|---|---|---|---|
| **GDS-15** (Yesavage) | 15 ítems binarios (sí/no) | Adultos mayores (≥60) | Escala primaria — detecta señales depresivas geriátricas |
| **PHQ-9** (Kroenke) | 9 ítems (0-3 Likert) | General (complementaria) | Escala secundaria — captura severidad y riesgo suicida (ítem 9) |

### 2.2 Cómo se mapea cada opción

Cada opción en `chapters.json` tiene un array `gds_mapping` y `phq_mapping`:

```json
{
  "option_id": "c01-s01-o3",
  "option_text": "Sentarte solo en el banco",
  "gds_mapping": [
    { "item": 7, "weight": 0.9, "confidence": 0.85, "rationale": "social_isolation" }
  ],
  "phq_mapping": [
    { "item": 1, "weight": 0.6, "confidence": 0.8, "rationale": "depressed_mood" }
  ]
}
```

| Campo | Qué significa | Rango |
|---|---|---|
| `item` | Número del ítem en la escala (GDS 1-15, PHQ 1-9) | entero |
| `weight` | Intensidad con que esta opción refleja ese constructo (asignado por el **diseñador**) | 0.0 – 1.0 |
| `confidence` | Certeza del diseñador en que el mapeo es válido | 0.0 – 1.0 |
| `rationale` | Constructo clínico en texto libre | string |

### 2.2.1 ¿Quién asigna el `weight`? — Guía para el diseñador narrativo

El `weight` lo define el diseñador de la historia (con supervisión del psicólogo). Representa qué tanto esa opción conductual refleja el constructo clínico del ítem. No es un puntaje del usuario — es una propiedad fija de la opción.

**Escala de weight (guía de asignación)**:

| Weight | Significado | Ejemplo concreto |
|---|---|---|
| **0.0** | No refleja el constructo en absoluto | Opción neutra sin relación con el ítem |
| **0.1 – 0.3** | Relación débil/indirecta | "Cambiar de tema" → GDS-10 (memory): relación débil, podría ser por otra razón |
| **0.4 – 0.6** | Relación moderada | "Jugar tranquilamente sin comprometerte" → GDS-9 (quedarse en casa): refleja algo de aislamiento pero no es extremo |
| **0.7 – 0.8** | Relación fuerte | "Sentarte solo en el banco" → GDS-7 (aislamiento social): claramente indica tendencia al aislamiento |
| **0.9 – 1.0** | Reflejo directo/total del constructo | "Quedarte mirando a la gente sin hacer nada" → GDS-3 (vida vacía): la conducta es exactamente lo que mide el ítem |

**Reglas clave**:
- Un `weight = 1.0` significa que **si el GDS preguntara directamente sobre eso, esta conducta sería un "sí" rotundo**.
- El `weight` es **independiente** del `confidence`. Puedes tener weight alto (la opción refleja mucho el constructo) con confidence baja (no estás seguro de que ese sea el ítem correcto).
- Cuando una opción refleja **conducta positiva/protectora**, el weight debe ser bajo (≤ 0.3) o simplemente no incluir el mapping.
- Cada opción puede mapear a **múltiples ítems** con weights distintos (ej. sentarse solo puede ser GDS-7 weight 0.9 + PHQ-1 weight 0.6).

**¿Y el `confidence`?** Lo asigna el diseñador como autocrítica:

| Confidence | Significado |
|---|---|
| **0.5 – 0.6** | "Creo que aplica pero no estoy seguro" |
| **0.7 – 0.8** | "Estoy razonablemente seguro de este mapeo" |
| **0.9 – 1.0** | "Esto es un mapeo claro y directo, un clínico lo validaría" |

### 2.3 Constructos GDS-15 mapeados

| GDS Ítem | Constructo | Ejemplo de opción que lo activa |
|---|---|---|
| 1 | `life_satisfaction` | "Contarle que te has sentido bien" |
| 2 | `anhedonia` / `social_engagement` | "Acercarte a Carmen" |
| 3 | `life_feels_empty` | "Quedarte mirando a la gente pasar sin hacer nada" |
| 4 | `boredom` | Inactividad prolongada |
| 5 | `positive_mood` | Disfrutar una actividad nueva |
| 6 | `bothered_by_thoughts` | Confesiones sobre preocupaciones |
| 7 | `social_engagement` / `isolation` | "Sentarte solo en el banco" (⚠️ trigger riesgo si w×c ≥ 0.3) |
| 8 | `feeling_helpless` | Mirar fotos antiguas con nostalgia |
| 9 | `preference_staying_home` | Rechazar salir o comprometerse |
| 10 | `memory_difficulties` | Cambiar de tema, evadir preguntas |
| 14 | `living_in_past` | Quedarse en recuerdos |
| 15 | `suicidal_ideation` | ⚠️ **RISK_FLAG** — manejo de seguridad inmediato |

### 2.4 Constructos PHQ-9 mapeados

| PHQ Ítem | Constructo | Ejemplo |
|---|---|---|
| 1 | `loss_of_interest` | No querer participar |
| 2 | `depressed_mood` | Confesiones de tristeza o soledad |
| 4 | `fatigue` / `low_energy` | Rechazar actividades por cansancio |
| 5 | `appetite_change` | Ignorar comida o bebida en escena |
| 7 | `difficulty_concentrating` | Evadir conversaciones |
| 9 | `self_harm_ideation` | ⚠️ **RISK_FLAG** — si w×c ≥ 0.2, escalar inmediatamente |


## 3. Fórmula de puntuación por sesión

### 3.1 Score por decisión individual

Para cada decisión que el usuario toma, se acumula la contribución:

$$\text{contribution}_{d,i} = \text{weight}_i \times \text{confidence}_i$$

donde $d$ = decisión, $i$ = cada mapping (GDS o PHQ) asociado a la opción elegida.

### 3.2 Score total por sesión (un capítulo)

$$\text{GDS\_total} = \sum_{d \in \text{decisiones}} \sum_{m \in \text{gds\_mappings}(d)} w_m \times c_m$$

$$\text{PHQ\_total} = \sum_{d \in \text{decisiones}} \sum_{m \in \text{phq\_mappings}(d)} w_m \times c_m$$

Esto se calcula automáticamente por el trigger `fn_compute_session_scores()` en la tabla `session_scores`.

### 3.3 Score normalizado (para comparar entre sesiones)

$$\text{GDS\_norm} = \frac{\text{GDS\_total}}{\text{GDS\_max\_posible\_capítulo}}$$

Donde `GDS_max_posible` es la suma de los pesos máximos si el usuario eligiera siempre la opción más "depresiva" en cada escena.

### 3.4 Interpretación de scores por sesión

| GDS_norm | Interpretación | Acción |
|---|---|---|
| 0.0 – 0.3 | Sin indicadores significativos | Continuar normalmente |
| 0.3 – 0.6 | Indicadores leves/moderados | Monitorear tendencia longitudinal |
| 0.6 – 0.8 | Indicadores moderados/altos | Alerta al clínico supervisor |
| 0.8 – 1.0 | Indicadores altos | Revisión clínica prioritaria |


## 4. Detección de riesgo (automática)

Dos triggers automáticos en la base de datos:

| Evento | Condición | Acción |
|---|---|---|
| `PHQ9_ITEM9_SELFHARM` | PHQ ítem 9 con $w \times c \geq 0.2$ | Crear `risk_event`, notificar clínico |
| `GDS7_SOCIAL_ISOLATION` | GDS ítem 7 con $w \times c \geq 0.3$ | Crear `risk_event`, marcar sesión |

Estos operan en la tabla `clinical_mappings` vía el trigger `fn_clinical_mappings_after_insert()`.


## 5. Análisis longitudinal (semana a semana)

### 5.1 Métricas clave por usuario (pseudónimo)

Almacenadas en `user_metrics_aggregated`:

| Métrica | Cálculo | Para qué sirve |
|---|---|---|
| `avg_emotional_score_gds` | Promedio de `GDS_norm` de las últimas N sesiones | Tendencia general del estado emocional |
| `avg_emotional_score_phq` | Promedio de `PHQ_norm` | Complemento de severidad |
| `total_sessions` | Conteo de sesiones completadas | Engagement y adherencia |
| `abandonment_rate` | % de sesiones no terminadas | Indicador de frustración o malestar |
| `frequency_of_use_days` | Días entre sesiones | Caída abrupta puede indicar episodio |

### 5.2 Detección de cambio abrupto

$$\text{abrupt\_change} = |\text{score}_{\text{actual}} - \text{score}_{\text{promedio\_últimas\_4}}| > \max(2\sigma, 0.3 \times \text{promedio})$$

Si se detecta → `abrupt_change_flag = true` → alerta para revisión clínica.

### 5.3 Visualización longitudinal recomendada

```
Semana 1  ████░░░░░░  GDS_norm: 0.35
Semana 2  █████░░░░░  GDS_norm: 0.42
Semana 3  ███░░░░░░░  GDS_norm: 0.28  ← mejora
Semana 4  ████████░░  GDS_norm: 0.72  ← alerta: cambio abrupto
```

El clínico revisa la serie temporal completa + las decisiones específicas de la semana 4 para contextualizar.


## 6. Viaje del Héroe (12 etapas) × Escalas: Guía de autoría

Tabla de referencia rápida para el diseñador narrativo al crear nuevos capítulos:

| # | Etapa | GDS ítems típicos | PHQ ítems típicos | Qué medir | Weights esperados |
|---|---|---|---|---|---|
| 1 | **Mundo ordinario** | 1 (satisfacción), 5 (ánimo) | 4 (energía) | Estado basal: ¿cómo empieza el día? | 0.4–0.7 |
| 2 | **Llamada a la aventura** | 2 (interés), 12 (actividad) | 1 (interés) | ¿Se motiva o rechaza la oportunidad? | 0.5–0.8 |
| 3 | **Rechazo de la llamada** | 7 (engagement), 9 (quedarse en casa) | 4 (fatiga), 6 (autoestima) | ¿Evita o enfrenta? | 0.6–0.9 |
| 4 | **Encuentro con el mentor** | 11 (soporte social) | — | (Narrada) Escena de apoyo | N/A |
| 5 | **Cruce del umbral** | 4 (aburrimiento), 13 (interés) | 1 (interés), 4 (energía) | ¿Se compromete o se retira? | 0.5–0.8 |
| 6 | **Pruebas, aliados, enemigos** | 3 (vacío), 6 (preocupaciones), 14 (pasado) | 2 (ánimo), 7 (concentración) | ¿Se conecta o se aísla en la interacción? | 0.5–0.9 |
| 7 | **Acercamiento a la cueva** | 6 (pensamientos), 10 (memoria) | 7 (concentración) | (Narrada) Tensión emocional crece | N/A |
| 8 | **Ordalía** | 3 (vacío), 8 (desesperanza), 14 (pasado) | 2 (ánimo), 6 (autoestima) | Momento más difícil: ¿se derrumba o resiste? | 0.7–1.0 |
| 9 | **Recompensa** | 5 (ánimo positivo), 2 (interés) | — | (Narrada) Alivio y conexión | N/A |
| 10 | **Camino de regreso** | 1 (satisfacción), 9 (quedarse en casa) | 4 (fatiga) | Reflexión: ¿valió la pena? | 0.4–0.7 |
| 11 | **Resurrección** | 8 (desesperanza), 15 (⚠️ solo si extremo) | — | (Narrada) Transformación interna | N/A |
| 12 | **Regreso con el elixir** | 8 (desesperanza), 11 (soporte) | 1 (interés futuro), 9 (⚠️ ideación) | ¿Perspectiva positiva o negativa del futuro? | 0.5–1.0 |

### Reglas de autoría
- Cada opción jugable debe tener **al menos 1 mapping GDS** con weight ≥ 0.3.
- Mapeos PHQ son opcionales pero recomendados para escenas emocionalmente intensas (etapas 3, 6, 8, 12).
- Nunca usar GDS-15 (ideación suicida) excepto en etapa 11 y solo como opción de máximo riesgo.
- PHQ-9 ítem 9 solo se usa en etapa 12 y en opciones extremas que reflejen desesperanza severa.
- Las **etapas narradas** (4, 7, 9, 11) no tienen opciones y por tanto no tienen mappings — sirven como ritmo emocional.
- El **weight** sube progresivamente: etapas tempranas (1-3) usan 0.4–0.7; la ordalía (8) llega hasta 1.0; el regreso (10-12) vuelve a 0.5–0.8 excepto opciones extremas.


## 7. Conclusiones

1. **Historias semanales** sobre un mismo tema, estructuradas con el **Viaje del Héroe de 12 etapas** (~8 escenas jugables × 3 opciones + ~4 narradas).
2. **Cada opción** mapea indirectamente a ítems de **GDS-15** (primaria) y **PHQ-9** (complementaria).
3. **El `weight` lo asigna el diseñador narrativo**: 0.0 (sin relación) → 1.0 (reflejo total del constructo). Un weight alto + confidence alta = señal fuerte si el usuario elige esa opción.
4. **Score por sesión**: suma de (weight × confidence) de todas las opciones elegidas → `session_scores`.
5. **Detección de riesgo**: PHQ-9#9 (w×c ≥ 0.2) y GDS-7 (w×c ≥ 0.3) generan alertas automáticas.
6. **Análisis longitudinal**: promedios semanales + detección de cambio abrupto (2σ o 30%) → dashboard clínico.
7. **Principio fundamental**: el usuario juega una historia divertida; el sistema mide sin preguntar directamente.
