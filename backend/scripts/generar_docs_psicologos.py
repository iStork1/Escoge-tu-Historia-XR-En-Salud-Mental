import json
import os
import codecs

GDS_MAPPING_INFO = {
    'enjoyment': 'Ítem 7 GDS-15 (¿Se siente feliz la mayor parte del tiempo?)',
    'hope': 'Ítem 14 GDS-15 (¿Siente que su situación es desesperada?) / Ítem 11 GDS-15',
    'energy': 'Ítem 13 GDS-15 (¿Se siente lleno de energía?)',
    'social_interaction': 'Ítem 2/9 GDS-15 (Asociado a renunciar a actividades o preferir quedarse en casa)',
    'memory_integration': 'Asociado al Ítem 3/10 GDS-15 (Manejo de recuerdos y sentimiento de vacío)',
    'letting_go': 'Asociado al Ítem 3 GDS-15 (Procesamiento del vacío y aceptación de pérdidas)',
    'mood': 'Ítem 5 GDS-15 (¿Está de buen humor la mayor parte del tiempo?)',
    'social_interest': 'Ítem 2 GDS-15 (¿Ha renunciado a muchas de sus actividades e intereses?)',
    'empathy': 'Conexión emocional (Asociado al Ítem 5 / Ítem 7 GDS-15)',
    'problem_solving': 'Ítem 8 GDS-15 (¿Se siente a menudo desamparado/inútil ante un problema?)',
    'gratitude': 'Ítem 1 y 11 GDS-15 (¿Está básicamente satisfecho con su vida? / ¿Cree que es maravilloso estar vivo?)',
    'redefining_home_concept': 'Ítem 3 (Reducción de la sensación de que su vida está vacía)',
    'validating_late_life_resilience': 'Ítem 12 (Prevención del sentimiento de inutilidad)',
    'gratitude_for_companionship': 'Ítem 1 (Aumento notable de la satisfacción con su vida)',
    'integrating_new_love_into_grief': 'Ítem 5 y 14 (Buen humor y visión de esperanza vs desesperación)',
    'asserting_grief_boundaries': 'Ítem 8 (Manejo activo del desamparo/Toma de control)',
    'avoidance_of_painful_items': 'Ítem 9 (Aislamiento y evitación activa de exposición emocional)',
    'healthy_grief_closure': 'Ítem 3 y 11 (Vaciado curado y celebración del estar vivo)',
    'emotional_release_of_suppressed_grief': 'Ítem 5 (Procesamiento transitorio del estado de ánimo bajo hacia la mejora)'
}

def get_gds_desc(item_key):
    return GDS_MAPPING_INFO.get(item_key, f'Referencia al ítem GDS/PHQ evaluado: {item_key}')

def generar_documentos():
    with codecs.open('backend/content/chapters_expanded.json', 'r', 'utf-8') as f:
        data = json.load(f)

    out_dir = 'docs_evaluacion'
    os.makedirs(out_dir, exist_ok=True)

    general_form = '''Formulario de Validación Clínica - Mapeo Psicológico (XR Salud Mental)
Por favor, lea el documento de referencia del capítulo correspondiente.

CONCEPTOS CLAVE PARA LA EVALUACIÓN:
1. RATIONALE (Justificación Clínica): Es la explicación psicológica de por qué un psicólogo consideraría que una decisión específica del jugador refleja cierto rasgo, síntoma o estado en torno a la vejez (Ej: por qué elegir "quedarse callado" refleja aislamiento).
2. PESO (Weight): Es el valor numérico/matemático asignado a la opción. Indica la fuerza o gravedad del indicador en relación al síntoma. Un peso alto significa que la opción es una manifestación muy fuerte de ese rasgo frente a la escala evaluada.
3. ESCENAS JUGABLES: ¡ATENCIÓN! Solo se deben calificar las escenas "Jugables" (Playable) donde el usuario elige una opción y se evalúa su peso. Las escenas "Narradas" (Narrated) son puramente de contexto (transición de la historia) y usted NO debe evaluarlas. Puede dejarlas en blanco en el cuestionario.

1. Nombre del Psicólogo / Especialista

2. Fecha de Evaluación

3. Capítulo Evaluado (Número y Título)

'''
    q_num = 4
    for i in range(1, 13):
        general_form += f'{q_num}. Escena {i} (SÓLO SI ES JUGABLE): Puntuación de Mapeo Psicológico (¿El Rationale y el Peso coinciden adecuadamente con la opción tomada?)\\n'
        general_form += 'A. 1 (Inadecuado)\\n'
        general_form += 'B. 2 (Poco Adecuado)\\n'
        general_form += 'C. 3 (Neutro/Aceptable)\\n'
        general_form += 'D. 4 (Adecuado)\\n'
        general_form += 'E. 5 (Muy Adecuado/Preciso)\\n\\n'
        q_num += 1
        general_form += f'{q_num}. Escena {i}: Feedback Clínico / Observaciones (¿Qué modificarías del Rationale o el Peso asignado en la historia?)\\n\\n'
        q_num += 1

    out_file_txt = os.path.join(out_dir, 'FORMULARIO_GENERAL_EVALUACION.txt')
    with codecs.open(out_file_txt, 'w', 'utf-8') as f:
        f.write(general_form)

    out_file_md = os.path.join(out_dir, 'FORMULARIO_GENERAL_EVALUACION.md')
    with codecs.open(out_file_md, 'w', 'utf-8') as f:
        f.write(general_form)

    for chapter in data['chapters']:
        chap_num = chapter.get('order', chapter.get('chapter_id'))
        chap_title = chapter.get('title', 'Sin Título')
        chap_filename = f'Capitulo_{chap_num}.md'
        filepath = os.path.join(out_dir, chap_filename)

        with codecs.open(filepath, 'w', 'utf-8') as f:
            f.write(f'# Capítulo {chap_num}: {chap_title}\\n\\n')
            f.write('Este documento contiene el desglose narrativo de las escenas y sus respectivas opciones, junto con el mapeo hacia las escalas evaluadas (especialmente la Escala de Depresión Geriátrica - GDS 15).\\n\\n')
            f.write('**🚨 INSTRUCCIÓN IMPORTANTE:** Solo se deben evaluar en su formulario correspondiente las **escenas de tipo PLAYABLE (Jugables)**. Las escenas *Narradas* no tienen variables psicológicas medidas, son solo texto de transición.\\n\\n---\\n\\n')

            for idx, scene in enumerate(chapter.get('scenes', []), 1):
                scene_title = scene.get('title', f'Escena {idx}')
                scene_type = scene.get('type', 'playable')
                f.write(f'## Escena {idx}: {scene_title} (ID: {scene.get('scene_id')}) - TIPO: **{scene_type.upper()}**\\n\\n')
                f.write(f'**Contexto Narrativo / Pregunta de la Escena:**\\n> {scene.get('text', '')}\\n\\n')

                options = scene.get('options', [])
                if not options or scene_type == 'narrated':
                    f.write('*[Es una escena puramente narrativa de contexto, el usuario no toma decisiones aquí. 🚫 NO EVALUAR EN EL FORMULARIO.]*\\n\\n')
                else:
                    f.write('### Opciones del Jugador y Mapeo Asociado\\n\\n')
                    for opt_idx, opt in enumerate(options, 1):
                        f.write(f'**Opción {opt_idx}:** {opt.get('option_text', '')}\\n')

                        gds_maps = opt.get('gds_mapping', [])
                        phq_maps = opt.get('phq_mapping', [])

                        if not gds_maps and not phq_maps:
                            f.write('- *Mapeo Psicológico:* Ninguno crítico asignado a esta opción específica.\\n\\n')

                        if gds_maps:
                            for gm in gds_maps:
                                item_key = gm.get('item', 'N/A')
                                item_desc = get_gds_desc(item_key)
                                f.write(f'- *Ítem GDS Analizado:* {item_key} -> **{item_desc}**\\n')
                                f.write(f'- *Peso asignado (Weight):* **{gm.get('weight', 0)}** *(Fuerza matemática de esta característica)*\\n')
                                f.write(f'- *Justificación Clínica (Rationale):* {gm.get('rationale', 'N/A')}\\n')

                        if phq_maps:
                            for pm in phq_maps:
                                f.write(f'- *Mapeo PHQ:* Variable/Ítem analizado: {pm.get('item', 'N/A')}\\n')
                                f.write(f'- *Peso asignado (Weight):* **{pm.get('weight', 0)}** *(Fuerza matemática de esta característica)*\\n')
                                f.write(f'- *Justificación Clínica (Rationale):* {pm.get('rationale', 'N/A')}\\n')
                        f.write('\\n')
                f.write('---\\n\\n')

    print(f'ÉXITO: Se actualizaron documentos en la carpeta {out_dir}/ con la nueva estructura explicativa.')

if __name__ == '__main__':
    generar_documentos()