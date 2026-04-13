# Chapter Generation Fix - Viaje del Héroe Completo

## Problema Identificado ⚠️

La generación de capítulos estaba **quebrada completamente**:

```
Salida anterior (INCORRECTA):
Hoy, seis meses después... Rosa... uno. Pensar en qué... dos. Sentir que hoy...
[MEZCLA DE ROSA, ANA, MARÍA EN UNA RESPUESTA]
[OPCIONES NUMERADAS SIN ESTRUCTURA]
[MÚLTIPLES CAPÍTULOS PARCIALES]
```

**Causas:**
1. ❌ El prompt solo generaba **1 escena con 3 opciones** (no un capítulo completo)
2. ❌ No respetaba estructura de **12 etapas del Viaje del Héroe**
3. ❌ El parser en index.js esperaba `scene` + `options` (singular)
4. ❌ La LLM interpretaba mal y generaba múltiples capítulos parciales

---

## Solución Implementada ✅

### 1. NUEVO PROMPT (backend/src/prompts.js)

**Antes:**
```javascript
// Generaba UNA escena con 3 opciones
"Generar el próximo capítulo con una sola escena playable"
```

**Ahora:**
```javascript
// Genera UN CAPÍTULO COMPLETO con 12 escenas estructuradas
"ESTRUCTURA OBLIGATORIA POR CAPÍTULO:

- Escenas JUGABLES (7): etapas 1, 3, 5, 6, 8, 10, 12
- Escenas NARRADAS (5): etapas 2, 4, 7, 9, 11

Las 12 etapas del Viaje del Héroe:
1. Mundo ordinario (🎮 JUGABLE)
2. Llamada a la aventura (NARRADA)
3. Rechazo de la llamada (🎮 JUGABLE)
4. Encuentro con el mentor (NARRADA)
5. Cruce del umbral (🎮 JUGABLE)
6. Pruebas, aliados, enemigos (🎮 JUGABLE)
7. Acercamiento a la cueva (NARRADA)
8. Ordalía - prueba central (🎮 JUGABLE)
9. Recompensa (NARRADA)
10. Camino de regreso (🎮 JUGABLE)
11. Resurrección (NARRADA)
12. Regreso con el elixir (🎮 JUGABLE)"
```

**JSON Output Format (NUEVO):**
```json
{
  "chapter": {
    "chapter_id": "c02",
    "title": "Título del capítulo completo",
    "order": 2
  },
  "scenes": [
    {
      "scene_id": "c02-s01",
      "title": "Mundo ordinario",
      "hero_stage": "1_ordinary_world",
      "type": "playable",
      "order": 1,
      "text": "...",
      "options": [
        {"option_id": "c02-s01-o1", "option_text": "...", ...},
        {"option_id": "c02-s01-o2", "option_text": "...", ...},
        {"option_id": "c02-s01-o3", "option_text": "...", ...}
      ]
    },
    {
      "scene_id": "c02-s02",
      "title": "Llamada a la aventura",
      "hero_stage": "2_call_to_adventure",
      "type": "narrated",
      "order": 2,
      "text": "...",
      "options": []  // NARRATED scenes have no options
    },
    // ... s03 a s12
  ]
}
```

**Key Requirements in Prompt:**
- ✅ "CAPÍTULO ÚNICO" - una sola chapter_id
- ✅ "12 ESCENAS EXACTAS" - s01 hasta s12, sin omitir
- ✅ "scene_id FORMAT" - c02-s01, c02-s02, etc.
- ✅ "option_id FORMAT" - c02-s01-o1, c02-s01-o2, c02-s01-o3
- ✅ "ORDEN LINEAR" - cada opción apunta a next_scene_id = siguiente escena exacta
- ✅ Escenas narradas: `"options": []` (vacío)
- ✅ Escenas jugables: `"options": [{3+ objetos}]`

---

### 2. NUEVO PARSER (backend/src/index.js - generateNextChapterForSession)

**Antes:**
```javascript
// Parseaba UNA sola escena
const { chapter, scene, options } = generatedChapter;

// Insertaba:
- 1 capítulo ✓
- 1 escena ✗
- 3 opciones ✗
```

**Ahora:**
```javascript
// Parsea TODAS las 12 escenas
const chapter = generatedChapter.chapter;
const scenes = generatedChapter.scenes;  // Array de 12

// Valida estructura
if (scenes.length !== 12) {
  throw new Error(`Expected 12 scenes, got ${scenes.length}`);
}

// Inserta en batch:
const sceneRows = [];      // 12 filas
const optionRows = [];     // 36+ filas (3+ opciones x 7 escenas jugables)
const clinicalMappingRows = []; // Múltiples mappings por escena

for (const scene of scenes) {
  // Inserta escena
  sceneRows.push({scene_id, hero_stage, type, ...});
  
  // Si es jugable: inserta sus opciones
  if (scene.type === 'playable' && scene.options.length > 0) {
    optionRows.push(...scene.options);
  }
  
  // Inserta clinical mappings para esas opciones
  for (const opt of scene.options) {
    for (const mapping of opt.gds_mapping) {
      clinicalMappingRows.push({...});
    }
    for (const mapping of opt.phq_mapping) {
      clinicalMappingRows.push({...});
    }
  }
}

// Batch inserts
await supabase.from('scenes').upsert(sceneRows);
await supabase.from('options').upsert(optionRows);
await supabase.from('clinical_mappings').insert(clinicalMappingRows);
```

---

## Resultado Esperado ✅

**POST /chapters/generate con c01 → c02:**

```json
{
  "ok": true,
  "chapter": {
    "chapter_id": "c02",
    "title": "Nuevos Horizontes",
    "order": 2,
    "scene_count": 12,
    "first_scene": {
      "scene_id": "c02-s01",
      "title": "Mundo ordinario",
      "text": "Rosa se despierta..."
    },
    "options": [
      {
        "option_id": "c02-s01-o1",
        "option_text": "Opción 1",
        "consequence": "...",
        "gds_mapping": [...],
        "phq_mapping": [...]
      },
      // ... más opciones
    ]
  },
  "generated_by": "groq",
  "chapter_id": "c02",
  "timestamp": "2026-03-31T..."
}
```

**Base de Datos:**
- ✅ chapters: 1 fila (c02)
- ✅ scenes: 12 filas (c02-s01...c02-s12)
- ✅ options: ~36 filas (3-5 opciones × 7 escenas jugables)
- ✅ clinical_mappings: múltiples mappings (GDS + PHQ por opción)

---

## Files Modified

| File | Changes |
|------|---------|
| `backend/src/prompts.js` | Reescrito `buildChapterGenerationPrompt()` - ahora pide 12 escenas con estructura Hero's Journey |
| `backend/src/index.js` | Actualizado `generateNextChapterForSession()` - parsea array de 12 escenas, batch inserts |

---

## How to Test

### 1. Start Server
```powershell
cd backend
npm run dev
```

Wait for: `✅ LLM Client initialized. Default: mock, core: openrouter, narrative: groq`

### 2. Generate Chapter
```powershell
$payload = @{
    session_id = "existing-session-id"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:7070/chapters/generate" `
  -Method POST `
  -Headers @{"Content-Type" = "application/json"} `
  -Body $payload `
  -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### 3. Expected Output
```
✅ chapter_id: c02
✅ title: [Título generado]
✅ scene_count: 12 (no menos)
✅ options: 3-5 (no 24 opciones de múltiples capítulos)
✅ hero_stages: 1_ordinary_world, 2_call_to_adventure, ... 12_return_with_elixir
```

### 4. Verify in Database
```sql
-- Check c02 created with 12 scenes
SELECT chapter_id, COUNT(*) as scene_count 
FROM scenes 
WHERE chapter_id = 'c02' 
GROUP BY chapter_id;

-- Should return: c02 | 12

-- Check options distributed across 7 playable scenes
SELECT scene_id, COUNT(*) as option_count 
FROM options 
WHERE scene_id LIKE 'c02-s%'
GROUP BY scene_id
ORDER BY scene_id;

-- Should show:
-- c02-s01 | 3
-- c02-s03 | 3
-- c02-s05 | 3
-- c02-s06 | 3
-- c02-s08 | 3
-- c02-s10 | 3
-- c02-s12 | 3
```

---

## Why This Matters

| Issue | Before | After |
|-------|--------|-------|
| **Capítulos por generación** | Múltiples/parciales | 1 completo ✅ |
| **Escenas por capítulo** | 1 | 12 (obligatorio) ✅ |
| **Etapas del Viaje del Héroe** | Ignoradas | Todas 12 incluidas ✅ |
| **Opciones jugables** | Todas en s01 | Distribuidas s01,s03,s05,s06,s08,s10,s12 ✅ |
| **Escenas narradas** | Ninguna | 5 incluidas (s02,s04,s07,s09,s11) ✅ |
| **Mapeo clínico** | Débil | Distribuido a lo largo del capítulo ✅ |
| **Continuidad narrativa** | Fragmentada | Arco completo con tensión y resolución ✅ |

---

## Validación de Restricciones

El nuevo prompt asegura:
- ✅ No múltiples capítulos en una respuesta
- ✅ 12 escenas exactas (no 6, no 20)
- ✅ hero_stage: 1_ordinary_world → 12_return_with_elixir consecutivos
- ✅ Escenas narradas con options: []
- ✅ Escenas jugables solo en etapas 1, 3, 5, 6, 8, 10, 12
- ✅ GDS items 1-15 ONLY
- ✅ PHQ items 1-9 ONLY
- ✅ Weight/confidence 0.0-1.0
- ✅ Español latino, accesible, respetuoso
- ✅ JSON válido (validación pre-respuesta en prompt)

---

## Si Hay Errores

**Error: "Expected 12 scenes, got X"**
- Significa LLM no siguió el prompt
- Solución: Modelo muy pequeño (Ollama orca-mini?), cambiar a Groq o Claude

**Error: "invalid scene_id format"**
- Escenas numeradas mal (c02-s01a en lugar de c02-s01)
- Solución: Groq respeta mejor el formato JSON

**Error: "invalid LLM response structure"**
- JSON no tiene `scenes` array
- Solución: Groq está mejor entrenado que OpenRouter para JSON estricto

---

Ahora el sistema genera capítulos **completos y estructurados** según las reglas clínicas del Viaje del Héroe. 🎯
