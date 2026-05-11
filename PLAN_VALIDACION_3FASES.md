# Plan de Validación — Historias Alberto, Ernesto, Mariana, Tatiana

**Fecha:** 11 de mayo de 2026  
**Estado:** Post-depuración sensorial (154 reemplazos completados)

---

## Objetivo General

Validar integridad técnica y narrativa de las 4 historias después de la limpieza de repeticiones sensoriales. Tres fases secuenciales.

---

## Fase 1: Validación de Integridad JSON

### Tareas

1. **Verificar estructura de archivos** — Confirmar que cada JSON sea parseado correctamente
   - Alberto: `story_alberto_ajedrez.json`
   - Ernesto: `story_ernesto_taller.json`
   - Mariana: `story_mariana_huerto.json`
   - Tatiana: `story_tatiana_taller.json`

2. **Checklist técnico por archivo:**
   - ✓ Apertura/cierre de brackets correctos
   - ✓ Todas las propiedades requeridas presentes: `scene_id`, `text`, `options`, `consequence`
   - ✓ Arrays de `options` no vacíos
   - ✓ IDs de escena únicos dentro de cada capítulo
   - ✓ Encadenamiento `next_scene_id` válido

3. **Herramienta:** Script Node.js que recorra cada JSON y reporte errores

4. **Output esperado:** Reporte tipo "All files valid" o lista de errores por archivo/escena

---

## Fase 2: Auditoría de Consecuencias

### Tareas

1. **Validar regla de 3 oraciones:**
   - Recorrer todas las escenas de todas las historias
   - Contar puntos (`.`) en cada campo `consequence`
   - Reportar escenas que NO cumplan exactamente 3 oraciones

2. **Validar formato de oración:**
   - Primera oración debe describir impacto inmediato (sensorial o emocional)
   - Segunda debe reforzar irreversibilidad
   - Tercera debe cerrar con peso narrativo

3. **Casos especiales a revisar:**
   - Escenas sin `consequence` (¿deben tenerla?)
   - Consecuencias que mencionen "Los yemas de sus dedos..." o variantes (verificar que sea contextual)

4. **Herramienta:** Script Node.js que analice estructura de oraciones

5. **Output esperado:** 
   - Total de consecuencias auditadas
   - Número de violaciones (no = 3 oraciones)
   - Lista de escenas problemáticas por historia

---

## Fase 3: Validación de Mappings Clínicos

### Tareas

1. **Verificar presencia de mappings:**
   - Cada `option` debe tener `gds_mapping` y/o `phq_mapping` (arrays)
   - Validar que no estén vacíos sin justificación

2. **Estructura de mapping:**
   - Campo `item`: número entre 1-15 (GDS-15) o 1-9 (PHQ-9)
   - Campo `weight`: valor entre 0 y 1
   - Campo `confidence`: valor entre 0 y 1
   - Validar thresholds calibrados (GDS7: 0.26, PHQ9_ITEM9: 0.18)

3. **Consistencia narrativo-clínica:**
   - ¿Las opciones que mapean a "aislamiento social" (GDS-7) son coherentes con la narrativa?
   - ¿Las opciones que mapean a "autolesiones" (PHQ-9#9) tienen weight ≥ 0.18?
   - Verificar que no haya mappings contradictorios (ej: opción que refuerza esperanza mapeada a depresión)

4. **Herramienta:** Script Node.js que valide rangos y thresholds

5. **Output esperado:**
   - Distribución de mappings por historia
   - Escenas con mappings anómalos o faltantes
   - Estadísticas de weight/confidence promedio por historia

---

## Secuencia de Ejecución

```
[Fase 1: JSON válido?]
          ↓
[Sí] → [Fase 2: 3 oraciones correctas?]
          ↓
[Sí] → [Fase 3: Mappings válidos?]
          ↓
[Reporte final integrado]
```

Si en cualquier fase hay violaciones, **detener y reportar** antes de pasar a la siguiente.

---

## Entregables

| Fase | Entregable | Formato |
|------|-----------|---------|
| 1 | Reporte de validación JSON | `validation_json.txt` |
| 2 | Auditoría de consecuencias | `audit_consequences.json` |
| 3 | Análisis de mappings clínicos | `audit_mappings.json` |
| — | **Reporte consolidado** | `VALIDATION_REPORT.md` |

---

## Notas

- **Alberto**: 14 capítulos, ~126 escenas
- **Ernesto**: 14 capítulos, ~126 escenas
- **Mariana**: 14 capítulos, ~126 escenas
- **Tatiana**: 14 capítulos, ~126 escenas

**Total estimado:** ~504 escenas a auditar

---

## Próximos pasos tras validación

- Sincronización a Supabase (si todo valida)
- Testing end-to-end con Alexa Simulator
- Ingesta de mappings en tabla `clinical_mappings`
