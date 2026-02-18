## Mapeo GDS-15 → Constructos

Propósito
- Registrar una convención clara para mapear items de la escala GDS-15 a constructos clínicos utilizados por el proyecto.
- Facilitar autoría de escenas/opciones en Twine/Twee y la interpretación consistente en la ingesta.

Nota rápida
- Tratar `GDS_15` (`suicidal_ideation`) como una etiqueta de riesgo: marcar como `RISK_FLAG` y manejar con flujo de seguridad/alerta clínica.

Mapeo sugerido (GDS_1..GDS_15)
- `GDS_1`: low_mood
- `GDS_2`: anhedonia
- `GDS_3`: fatigue
- `GDS_4`: sleep_disturbance
- `GDS_5`: appetite_change
- `GDS_6`: cognitive_concern
- `GDS_7`: social_engagement
- `GDS_8`: health_anxiety
- `GDS_9`: safety_perception
- `GDS_10`: mood_variability
- `GDS_11`: social_support
- `GDS_12`: activity_level
- `GDS_13`: interest_engagement
- `GDS_14`: hopelessness
- `GDS_15`: suicidal_ideation  (TRATAR COMO `RISK_FLAG` si aplica)

Formato recomendado para autoría
- Cada `option` en `chapters.json` puede incluir un array `mappings` con objetos que describan la contribución de esa opción a uno o más ítems clínicos.

Campos sugeridos por mapping:
- `scale`: string (ej. "GDS" o "PHQ")
- `item`: número (índice del ítem en la escala, ej. 1..15)
- `score`: número (contribución esperada del autor para ese item, ej. 0..3). Si no existe, el servidor puede asumir `1` como presencia.
- `weight`: número (0..1) que pondera la importancia de este mapping relativo a otros mappings en la misma decisión.
- `confidence`: número (0..1) confianza del autor en este mapeo.
- `metadata`: objeto opcional para contexto adicional.

Ejemplo (fragmento de `chapters.json`):
```
"options": [
  {
    "option_id": "c01-s01-o1",
    "option_text": "Acercarte a Carmen",
    "mappings": [
      { "scale": "GDS", "item": 2, "score": 2, "weight": 0.7, "confidence": 0.9 }
    ]
  }
]
```
