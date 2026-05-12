# VALIDATION_REPORT — Historias LATAM
**Generado:** 2026-05-12T01:01:54.859Z
**Veredicto:** ⚠️ Ready to sync — review warnings before production

---

## Resumen Ejecutivo

| Fase | Estado | Detalle |
|------|--------|---------|
| Fase 1: Integridad JSON | ✅ PASS | Todos los archivos válidos |
| Fase 2: Consecuencias | ⚠️ WARNING | 32 consecuencias fuera de [2-4] oraciones de 951 (96.6% OK) — no bloqueante |
| Fase 3: Mappings clínicos | ✅ PASS | 0 errores de rango, 35 risk triggers (0 PHQ9-item9) |

---

## Fase 1: Integridad JSON

```
VALIDATION REPORT — Phase 1: JSON Integrity
Generated: 2026-05-12T00:22:44.727Z
Stories directory: C:\Users\Sebastian\Desktop\Escoge-tu-Historia-XR-En-Salud-Mental\backend\content\latam
======================================================================

Story: story_alberto_ajedrez
--------------------------------------------------
STATUS: ✓ VALID
INFO (30):
  [INFO] c05-s05-o1: next_scene_id="c05-s06" is intentional chapter/story endpoint
  [INFO] c05-s05-o2: next_scene_id="c05-s06" is intentional chapter/story endpoint
  [INFO] c05-s05-o3: next_scene_id="c05-s06" is intentional chapter/story endpoint
  [INFO] c06-s04-o1: next_scene_id="c06-s05" is intentional chapter/story endpoint
  [INFO] c06-s04-o2: next_scene_id="c06-s05" is intentional chapter/story endpoint
  [INFO] c06-s04-o3: next_scene_id="c06-s05" is intentional chapter/story endpoint
  [INFO] c07-s04-o1: next_scene_id="c07-s05" is intentional chapter/story endpoint
  [INFO] c07-s04-o2: next_scene_id="c07-s05" is intentional chapter/story endpoint
  [INFO] c07-s04-o3: next_scene_id="c07-s05" is intentional chapter/story endpoint
  [INFO] c08-s04-o1: next_scene_id="c08-s05" is intentional chapter/story endpoint
  [INFO] c08-s04-o2: next_scene_id="c08-s05" is intentional chapter/story endpoint
  [INFO] c08-s04-o3: next_scene_id="c08-s05" is intentional chapter/story endpoint
  [INFO] c09-s04-o1: next_scene_id="c09-s05" is intentional chapter/story endpoint
  [INFO] c09-s04-o2: next_scene_id="c09-s05" is intentional chapter/story endpoint
  [INFO] c09-s04-o3: next_scene_id="c09-s05" is intentional chapter/story endpoint
  [INFO] c10-s04-o1: next_scene_id="c10-s05" is intentional chapter/story endpoint
  [INFO] c10-s04-o2: next_scene_id="c10-s05" is intentional chapter/story endpoint
  [INFO] c10-s04-o3: next_scene_id="c10-s05" is intentional chapter/story endpoint
  [INFO] c11-s04-o1: next_scene_id="c11-s05" is intentional chapter/story endpoint
  [INFO] c11-s04-o2: next_scene_id="c11-s05" is intentional chapter/story endpoint
  [INFO] c11-s04-o3: next_scene_id="c11-s05" is intentional chapter/story endpoint
  [INFO] c12-s04-o1: next_scene_id="c12-s05" is intentional chapter/story endpoint
  [INFO] c12-s04-o2: next_scene_id="c12-s05" is intentional chapter/story endpoint
  [INFO] c12-s04-o3: next_scene_id="c12-s05" is intentional chapter/story endpoint
  [INFO] c13-s04-o1: next_scene_id="c13-s05" is intentional chapter/story endpoint
  [INFO] c13-s04-o2: next_scene_id="c13-s05" is intentional chapter/story endpoint
  [INFO] c13-s04-o3: next_scene_id="c13-s05" is intentional chapter/story endpoint
  [INFO] c14-s04-o1: next_scene_id="c14-s05" is intentional chapter/story endpoint
  [INFO] c14-s04-o2: next_scene_id="c14-s05" is intentional chapter/story endpoint
  [INFO] c14-s04-o3: next_scene_id="c14-s05" is intentional chapter/story endpoint

Story: story_ernesto_taller
--------------------------------------------------
STATUS: ✓ VALID
INFO (30):
  [INFO] c05-s04-o1: next_scene_id="c05-s05" is intentional chapter/story endpoint
  [INFO] c05-s04-o2: next_scene_id="c05-s05" is intentional chapter/story endpoint
  [INFO] c05-s04-o3: next_scene_id="c05-s05" is intentional chapter/story endpoint
  [INFO] c06-s04-o1: next_scene_id="c06-s05" is intentional chapter/story endpoint
  [INFO] c06-s04-o2: next_scene_id="c06-s05" is intentional chapter/story endpoint
  [INFO] c06-s04-o3: next_scene_id="c06-s05" is intentional chapter/story endpoint
  [INFO] c07-s04-o1: next_scene_id="c07-s05" is intentional chapter/story endpoint
  [INFO] c07-s04-o2: next_scene_id="c07-s05" is intentional chapter/story endpoint
  [INFO] c07-s04-o3: next_scene_id="c07-s05" is intentional chapter/story endpoint
  [INFO] c08-s04-o1: next_scene_id="c08-s05" is intentional chapter/story endpoint
  [INFO] c08-s04-o2: next_scene_id="c08-s05" is intentional chapter/story endpoint
  [INFO] c08-s04-o3: next_scene_id="c08-s05" is intentional chapter/story endpoint
  [INFO] c09-s04-o1: next_scene_id="c09-s05" is intentional chapter/story endpoint
  [INFO] c09-s04-o2: next_scene_id="c09-s05" is intentional chapter/story endpoint
  [INFO] c09-s04-o3: next_scene_id="c09-s05" is intentional chapter/story endpoint
  [INFO] c10-s04-o1: next_scene_id="c10-s05" is intentional chapter/story endpoint
  [INFO] c10-s04-o2: next_scene_id="c10-s05" is intentional chapter/story endpoint
  [INFO] c10-s04-o3: next_scene_id="c10-s05" is intentional chapter/story endpoint
  [INFO] c11-s04-o1: next_scene_id="c11-s05" is intentional chapter/story endpoint
  [INFO] c11-s04-o2: next_scene_id="c11-s05" is intentional chapter/story endpoint
  [INFO] c11-s04-o3: next_scene_id="c11-s05" is intentional chapter/story endpoint
  [INFO] c12-s04-o1: next_scene_id="c12-s05" is intentional chapter/story endpoint
  [INFO] c12-s04-o2: next_scene_id="c12-s05" is intentional chapter/story endpoint
  [INFO] c12-s04-o3: next_scene_id="c12-s05" is intentional chapter/story endpoint
  [INFO] c13-s04-o1: next_scene_id="c13-s05" is intentional chapter/story endpoint
  [INFO] c13-s04-o2: next_scene_id="c13-s05" is intentional chapter/story endpoint
  [INFO] c13-s04-o3: next_scene_id="c13-s05" is intentional chapter/story endpoint
  [INFO] c14-s04-o1: next_scene_id="c14-s05" is intentional chapter/story endpoint
  [INFO] c14-s04-o2: next_scene_id="c14-s05" is intentional chapter/story endpoint
  [INFO] c14-s04-o3: next_scene_id="c14-s05" is intentional chapter/story endpoint

Story: story_mariana_huerto
--------------------------------------------------
STATUS: ✓ VALID
INFO (27):
  [INFO] c06-s04-o1: next_scene_id="c06-s05" is intentional chapter/story endpoint
  [INFO] c06-s04-o2: next_scene_id="c06-s05" is intentional chapter/story endpoint
  [INFO] c06-s04-o3: next_scene_id="c06-s05" is intentional chapter/story endpoint
  [INFO] c07-s04-o1: next_scene_id="c07-s05" is intentional chapter/story endpoint
  [INFO] c07-s04-o2: next_scene_id="c07-s05" is intentional chapter/story endpoint
  [INFO] c07-s04-o3: next_scene_id="c07-s05" is intentional chapter/story endpoint
  [INFO] c08-s04-o1: next_scene_id="c08-s05" is intentional chapter/story endpoint
  [INFO] c08-s04-o2: next_scene_id="c08-s05" is intentional chapter/story endpoint
  [INFO] c08-s04-o3: next_scene_id="c08-s05" is intentional chapter/story endpoint
  [INFO] c09-s04-o1: next_scene_id="c09-s05" is intentional chapter/story endpoint
  [INFO] c09-s04-o2: next_scene_id="c09-s05" is intentional chapter/story endpoint
  [INFO] c09-s04-o3: next_scene_id="c09-s05" is intentional chapter/story endpoint
  [INFO] c10-s04-o1: next_scene_id="c10-s05" is intentional chapter/story endpoint
  [INFO] c10-s04-o2: next_scene_id="c10-s05" is intentional chapter/story endpoint
  [INFO] c10-s04-o3: next_scene_id="c10-s05" is intentional chapter/story endpoint
  [INFO] c11-s04-o1: next_scene_id="c11-s05" is intentional chapter/story endpoint
  [INFO] c11-s04-o2: next_scene_id="c11-s05" is intentional chapter/story endpoint
  [INFO] c11-s04-o3: next_scene_id="c11-s05" is intentional chapter/story endpoint
  [INFO] c12-s04-o1: next_scene_id="c12-s05" is intentional chapter/story endpoint
  [INFO] c12-s04-o2: next_scene_id="c12-s05" is intentional chapter/story endpoint
  [INFO] c12-s04-o3: next_scene_id="c12-s05" is intentional chapter/story endpoint
  [INFO] c13-s04-o1: next_scene_id="c13-s05" is intentional chapter/story endpoint
  [INFO] c13-s04-o2: next_scene_id="c13-s05" is intentional chapter/story endpoint
  [INFO] c13-s04-o3: next_scene_id="c13-s05" is intentional chapter/story endpoint
  [INFO] c14-s04-o1: next_scene_id="c14-s05" is intentional chapter/story endpoint
  [INFO] c14-s04-o2: next_scene_id="c14-s05" is intentional chapter/story endpoint
  [INFO] c14-s04-o3: next_scene_id="c14-s05" is intentional chapter/story endpoint

Story: story_tatiana_taller
--------------------------------------------------
STATUS: ✓ VALID
INFO (27):
  [INFO] c06-s04-o1: next_scene_id="c06-s05" is intentional chapter/story endpoint
  [INFO] c06-s04-o2: next_scene_id="c06-s05" is intentional chapter/story endpoint
  [INFO] c06-s04-o3: next_scene_id="c06-s05" is intentional chapter/story endpoint
  [INFO] c07-s05-o1: next_scene_id="c07-s06" is intentional chapter/story endpoint
  [INFO] c07-s05-o2: next_scene_id="c07-s06" is intentional chapter/story endpoint
  [INFO] c07-s05-o3: next_scene_id="c07-s06" is intentional chapter/story endpoint
  [INFO] c08-s04-o1: next_scene_id="c08-s05" is intentional chapter/story endpoint
  [INFO] c08-s04-o2: next_scene_id="c08-s05" is intentional chapter/story endpoint
  [INFO] c08-s04-o3: next_scene_id="c08-s05" is intentional chapter/story endpoint
  [INFO] c09-s04-o1: next_scene_id="c09-s05" is intentional chapter/story endpoint
  [INFO] c09-s04-o2: next_scene_id="c09-s05" is intentional chapter/story endpoint
  [INFO] c09-s04-o3: next_scene_id="c09-s05" is intentional chapter/story endpoint
  [INFO] c10-s04-o1: next_scene_id="c10-s05" is intentional chapter/story endpoint
  [INFO] c10-s04-o2: next_scene_id="c10-s05" is intentional chapter/story endpoint
  [INFO] c10-s04-o3: next_scene_id="c10-s05" is intentional chapter/story endpoint
  [INFO] c11-s04-o1: next_scene_id="c11-s05" is intentional chapter/story endpoint
  [INFO] c11-s04-o2: next_scene_id="c11-s05" is intentional chapter/story endpoint
  [INFO] c11-s04-o3: next_scene_id="c11-s05" is intentional chapter/story endpoint
  [INFO] c12-s04-o1: next_scene_id="c12-s05" is intentional chapter/story endpoint
  [INFO] c12-s04-o2: next_scene_id="c12-s05" is intentional chapter/story endpoint
  [INFO] c12-s04-o3: next_scene_id="c12-s05" is intentional chapter/story endpoint
  [INFO] c13-s04-o1: next_scene_id="c13-s05" is intentional chapter/story endpoint
  [INFO] c13-s04-o2: next_scene_id="c13-s05" is intentional chapter/story endpoint
  [INFO] c13-s04-o3: next_scene_id="c13-s05" is intentional chapter/story endpoint
  [INFO] c14-s05-o1: next_scene_id="c14-s06" is intentional chapter/story endpoint
  [INFO] c14-s05-o2: next_scene_id="c14-s06" is intentional chapter/story endpoint
  [INFO] c14-s05-o3: next_scene_id="c14-s06" is intentional chapter/story endpoint

======================================================================
RESULT: All files valid — proceed to Phase 2
```

---

## Fase 2: Auditoría de Consecuencias

### Totales por historia

| Historia | Opciones | Violaciones | Pass Rate |
|----------|----------|-------------|-----------|
| story_alberto_ajedrez | 231 | ⚠️ 5 | 97.8% |
| story_ernesto_taller | 228 | ⚠️ 5 | 97.8% |
| story_mariana_huerto | 243 | ⚠️ 10 | 95.9% |
| story_tatiana_taller | 249 | ⚠️ 12 | 95.2% |

### Violaciones (≠ 3 oraciones)

| Option ID | # Oraciones | Preview |
|-----------|-------------|---------|
| c03-s08-o1 | 6 | Alberto mueve el rey con calma. La posición se complica pero no se pierde. Mora asiente. «Correcto». El juego sigue abie... |
| c04-s04-o1 | 5 | Alberto le muestra la primera jugada de la Siciliana. Elena pregunta por qué. Él explica. Llevan quince minutos hablando... |
| c04-s09-o3 | 5 | Alberto juega en silencio. Nadie comenta la apertura directamente. La partida avanza. La semana de estudio queda sin nom... |
| c13-s02-o2 | 5 | Alberto dice que bien, y saca el libro un momento. Lo abre. Busca algo. Lo cierra. Le hace un gesto a Don Jairo para que... |
| c13-s03-o1 | 7 | Alberto sostiene el sacrificio. Don Jairo busca la respuesta. La encuentra en el movimiento treinta y uno. Tablas â€” em... |
| c04-s03-o2 | 5 | Ernesto recoge la pata sin decir nada. La reencaja, agarra otra, y hace la demostración de nuevo. Más lento. Miguel lo i... |
| c04-s09-o2 | 6 | Ernesto recoge su bolso. No dice más. Sale al andén. El sol de mediodía calienta la Calle 5. Camina despacio. Hay algo e... |
| c12-s03-o3 | 6 | Ernesto pone el celular en el bolsillo. Ya habrá tiempo. La exposición termina al mediodía. Después. La tarde. El mensaj... |
| c13-s04-o3 | 5 | Ernesto decide que no. Que él no es profesor de nada. Que es mejor quedarse donde está. La sala sigue callada. La butaca... |
| c14-s03-o1 | 5 | Ernesto la pone sobre el banco y la mira. No es perfecta. Las tablillas tienen un leve ángulo. Pero es suya. Completamen... |
| c02-s07-o3 | 5 | Las gotas son gordas y rápidas. Mariana no se mueve. Paco la mira desde el tejado. Rosita viene a buscarla. 'Mariana, ve... |
| c03-s07-o3 | 5 | Mariana guarda las bolsitas en el bolso. 'La tierra todavía no está lista.' Rosita la mira, pero no discute. Mariana rec... |
| c04-s03-o2 | 5 | Rosita planta tres semillas mientras Mariana mira. 'Así, sin apretar.' Mariana observa cada detalle. Después lo hace sol... |
| c04-s04-o1 | 5 | Mariana lo mira de frente. '¿Y cómo se mejora, don Hernando?' Él se sorprende. Explica a regañadientes algo sobre arena ... |
| c04-s06-o1 | 5 | Mariana trabaja despacio pero sin parar. Cuando termina la fila, mira el lote y cuenta: dieciséis semillas. Ella sola. R... |
| c04-s08-o1 | 5 | El cilantro de Mariana queda en tres montoncitos en lugar de esparcido. Se ríen juntas. 'Quedó en racimos', dice Rosita.... |
| c04-s09-o2 | 5 | Las dos riegan juntas. Rosita le cuenta de sus nietos. Mariana escucha y añade algo de Lucía. El agua cae pareja. La tar... |
| c05-s01-o3 | 5 | Mariana mira el teléfono sonar. Dos timbres, tres. 'Sí, ya voy.' Contesta al cuarto. 'Hola.' La voz le sale plana. El lo... |
| c05-s08-o3 | 5 | Mariana deja el teléfono boca abajo. Apaga la luz. En la oscuridad, el silencio del apartamento es más completo que de c... |
| c05-s09-o3 | 5 | Mariana deja el mensaje sin contestar. Se hace el tinto y lo toma viendo el noticiero. No va al huerto. No le escribe a ... |
| c01-s03-o3 | 5 | Tatiana se sienta al lado del celular con las manos sobre las piernas. Pasan diez minutos. La pantalla no se enciende. E... |
| c02-s09-o2 | 5 | Tatiana desenvuelve la almojábana en la puerta del edificio. Está tibia y suave. La come de pie, mirando la calle de Ara... |
| c03-s05-o1 | 5 | Tatiana moja el dedo en agua y lo deja caer sobre el aceite caliente. Chisporrotea fuerte y el vapor le sube a la cara. ... |
| c03-s08-o3 | 1 | Tatiana baja la mirada: 'No creo que estén bien. Los míos son los peores del grupo.' Doña Esperanza la contradice pero T... |
| c04-s05-o1 | 1 | Tatiana dice que la versión original es más ligera, pero que la de Doña Carmen tiene más sabor. 'Las dos sirven para cos... |
| c04-s09-o2 | 5 | Tatiana toma la almojábana y la come sin hablar. Carmen tampoco habla. El gesto quedó hecho. Yolanda sonríe desde el otr... |
| c05-s02-o1 | 1 | 'Rodrigo, metí al taller de panadería de la Casa Comunal. Llevo dos meses, he aprendido almojábanas, buñuelos, pandeyuca... |
| c05-s03-o1 | 1 | 'Venga, Rodrigo, que yo le tengo almojábana hecha el día que llegue.' Rodrigo se ríe: 'A ver, mamá, a ver.' Tatiana envu... |
| c09-s04-o1 | 1 | Tatiana saca el celular y le escribe: 'Llegué bien. El jueves la espero.' Yolanda contesta en menos de un minuto con un ... |
| c11-s02-o1 | 1 | Tatiana pone sus manos sobre las de Paula desde atrás y le dice: 'Siente cómo responde. Tiene que quedar suave como lóbu... |
| c13-s04-o2 | 1 | Tatiana escribe: 'Valentina, acepto. Gracias por confiar.' Valentina contesta con tres corazones y le dice que el vierne... |
| c14-s04-o1 | 1 | Tatiana cuenta desde el festival de Manrique, la propuesta de Valentina, la llamada con Yolanda. Doña Esperanza la escuc... |

---

## Fase 3: Mappings Clínicos

### Estadísticas por historia

| Historia | Opciones | Con GDS | Con PHQ | PHQ vacío | Avg GDS Weight | Avg PHQ Weight |
|----------|----------|---------|---------|-----------|---------------|---------------|
| story_alberto_ajedrez | 231 | 231 | 139 | 92 | 0.2927 | 0.2376 |
| story_ernesto_taller | 228 | 228 | 139 | 89 | 0.2624 | 0.2071 |
| story_mariana_huerto | 243 | 243 | 156 | 87 | 0.3061 | 0.2207 |
| story_tatiana_taller | 249 | 249 | 131 | 118 | 0.3237 | 0.1894 |

### Risk Triggers detectados

| Option ID | Escala | Ítem | Weight | Confidence | Score | Threshold | Label |
|-----------|--------|------|--------|------------|-------|-----------|-------|
| c01-s01-o3 | GDS | 7 | 0.65 | 0.85 | 0.5525 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c01-s03-o3 | GDS | 7 | 0.7 | 0.9 | 0.63 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c01-s09-o3 | GDS | 7 | 0.65 | 0.85 | 0.5525 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c02-s01-o3 | GDS | 7 | 0.65 | 0.85 | 0.5525 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c02-s02-o3 | GDS | 7 | 0.5 | 0.8 | 0.4 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c02-s09-o3 | GDS | 7 | 0.65 | 0.85 | 0.5525 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c01-s01-o3 | GDS | 7 | 0.55 | 0.85 | 0.4675 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c01-s04-o3 | GDS | 7 | 0.65 | 0.85 | 0.5525 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c01-s09-o3 | GDS | 7 | 0.6 | 0.85 | 0.51 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c02-s09-o3 | GDS | 7 | 0.6 | 0.85 | 0.51 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c04-s09-o3 | GDS | 7 | 0.62 | 0.83 | 0.5146 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c01-s02-o3 | GDS | 7 | 0.7 | 0.9 | 0.63 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c01-s04-o3 | GDS | 7 | 0.65 | 0.85 | 0.5525 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c01-s05-o3 | GDS | 7 | 0.6 | 0.85 | 0.51 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c01-s09-o3 | GDS | 7 | 0.65 | 0.85 | 0.5525 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c05-s01-o3 | GDS | 7 | 0.55 | 0.8 | 0.44 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c05-s03-o3 | GDS | 7 | 0.58 | 0.8 | 0.464 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c05-s07-o3 | GDS | 7 | 0.6 | 0.82 | 0.492 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c01-s04-o3 | GDS | 7 | 0.6 | 0.85 | 0.51 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c01-s09-o3 | GDS | 7 | 0.6 | 0.85 | 0.51 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c02-s03-o3 | GDS | 7 | 0.55 | 0.8 | 0.44 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c02-s04-o3 | GDS | 7 | 0.5 | 0.8 | 0.4 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c02-s05-o3 | GDS | 7 | 0.6 | 0.85 | 0.51 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c02-s09-o3 | GDS | 7 | 0.65 | 0.85 | 0.5525 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c03-s04-o3 | GDS | 7 | 0.68 | 0.84 | 0.5712 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c03-s09-o3 | GDS | 7 | 0.55 | 0.8 | 0.44 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c04-s04-o3 | GDS | 7 | 0.65 | 0.84 | 0.546 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c04-s07-o3 | GDS | 7 | 0.68 | 0.85 | 0.578 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c04-s08-o3 | GDS | 7 | 0.55 | 0.8 | 0.44 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c04-s09-o3 | GDS | 7 | 0.65 | 0.84 | 0.546 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c05-s01-o3 | GDS | 7 | 0.52 | 0.8 | 0.416 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c05-s02-o3 | GDS | 7 | 0.65 | 0.84 | 0.546 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c05-s04-o3 | GDS | 7 | 0.6 | 0.83 | 0.498 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c05-s06-o3 | GDS | 7 | 0.62 | 0.83 | 0.5146 | 0.26 | SOCIAL_ISOLATION_TRIGGER |
| c05-s08-o3 | GDS | 7 | 0.62 | 0.83 | 0.5146 | 0.26 | SOCIAL_ISOLATION_TRIGGER |

---

## Veredicto Final

**⚠️ Ready to sync — review warnings before production**

Proceder con:
1. `node backend/scripts/sync_chapters.js` para sincronizar a Supabase
2. Testing end-to-end con Alexa Simulator

> **Pendiente opcional:** revisar 32 consecuencias con >4 oraciones (ver audit_consequences.json).