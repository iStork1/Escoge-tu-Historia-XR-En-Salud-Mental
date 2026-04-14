import json
import codecs

def update_markdown():
    with codecs.open('backend/content/chapters.json', 'r', 'utf-8') as f:
        data = json.load(f)
    
    chapter = data['chapters'][0]
    out_dir = 'docs_evaluacion'
    filepath = out_dir + '/Capitulo_1.md'
    
    with codecs.open(filepath, 'w', 'utf-8') as f:
        f.write(f'# Capítulo 1: {chapter.get('title')}\\n\\n')
        f.write('Este documento contiene el desglose narrativo de las escenas y sus respectivas opciones, junto con el mapeo hacia las escalas evaluadas (especialmente la Escala de Depresión Geriátrica - GDS 15).\\n\\n')
        f.write('**🚨 INSTRUCCIÓN IMPORTANTE:** Solo se deben evaluar en su formulario correspondiente las **escenas de tipo PLAYABLE (Jugables)**. Las escenas *Narradas* no tienen variables psicológicas medidas, son solo texto de transición.\\n\\n---\\n\\n')
        
        for idx, scene in enumerate(chapter.get('scenes', []), 1):
            f.write(f'## Escena {idx}: {scene.get('title')} (ID: {scene.get('scene_id')}) - TIPO: **{scene.get('type').upper()}**\\n\\n')
            f.write(f'**Contexto Narrativo / Pregunta de la Escena:**\\n> {scene.get('text', '')}\\n\\n')
            options = scene.get('options', [])
            if not options or scene.get('type') == 'narrated':
                f.write('*[Es una escena puramente narrativa de contexto, el usuario no toma decisiones aquí. 🚫 NO EVALUAR EN EL FORMULARIO.]*\\n\\n')
            else:
                f.write('### Opciones del Jugador y Mapeo Asociado\\n\\n')
                for opt_idx, opt in enumerate(options, 1):
                    f.write(f'**Opción {opt_idx}:** {opt.get('option_text', '')}\\n')
                    for mapped in opt.get('gds_mapping', []):
                        f.write(f'- *Ítem GDS Analizado:* {mapped.get('item', '')}\\n')
                        f.write(f'- *Peso asignado (Weight):* **{mapped.get('weight', 0)}**\\n')
                        f.write(f'- *Justificación Clínica (Rationale):* {mapped.get('rationale', 'N/A')}\\n')
                    for mapped in opt.get('phq_mapping', []):
                        f.write(f'- *Ítem PHQ Analizado:* {mapped.get('item', '')}\\n')
                        f.write(f'- *Peso asignado (Weight):* **{mapped.get('weight', 0)}**\\n')
                        f.write(f'- *Justificación Clínica (Rationale):* {mapped.get('rationale', 'N/A')}\\n')
                    f.write('\\n')
            f.write('---\\n\\n')

update_markdown()
print('Capitulo_1.md actualizado.')