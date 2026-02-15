# Phase 1 — Integración con Twine (28 capítulos)

Resumen rápido
- Objetivo: crear un prototipo con 28 capítulos y un flujo sencillo que permita exportar la estructura de Twine hacia el API de telemetría para pruebas iniciales.

Archivos añadidos
- `twine/game_structure.json` — estructura canonical con 28 capítulos (placeholders).
- `twine/28_chapters_story.html` — stub HTML con lista de capítulos (para referencia o import en Twine editor).
- `scripts/twine_to_payload.py` — genera `twine/payload_examples/phase1_payload_example.json` con un `session` y decisiones por escena.

Pasos para usar localmente
1. Abrir `twine/game_structure.json` y editar títulos/escenas/opciones según la narrativa.
2. Generar payload de prueba:

```bash
python scripts/twine_to_payload.py
```

3. El payload quedará en `twine/payload_examples/phase1_payload_example.json` y puede `POST` a `backend` o a `POST /telemetry` si tienes la URL protegida.

Ejemplo de POST (cURL):

```bash
curl -X POST https://your-backend.example/telemetry \
  -H "Content-Type: application/json" \
  -d @twine/payload_examples/phase1_payload_example.json
```

Notas de integración
- Mantén `chapter_id` y `scene_id` consistentes entre Twine y la base de datos para facilitar el análisis y mapeo clínico.
- Para producción, exporta tu historia desde Twine (HTML) y mantén `game_structure.json` como canonical source-of-truth para el equipo narrativo.

Próximos pasos sugeridos
- Mapear `designer_mapping` por capítulo/escena y añadirlo al `game_structure.json`.
- Crear script que tome Twine HTML y extraiga passages para poblar `game_structure.json` automáticamente.
