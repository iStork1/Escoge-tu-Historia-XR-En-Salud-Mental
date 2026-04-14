#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json
import os
import codecs

# Load the data
with open('backend/content/chapters_expanded.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Output directory
out_dir = 'docs_evaluacion'
os.makedirs(out_dir, exist_ok=True)

# GDS-15 Item Descriptions (from backend/src/prompts.js)
GDS_ITEMS = {
    1: "¿Está basicamente satisfecho con su vida?",
    2: "¿Ha dejado de lado muchas de sus actividades e intereses?",
    3: "¿Siente que su vida está vacía?",
    4: "¿A menudo se aburre?",
    5: "¿Suele estar de buen humor?",
    6: "¿Tiene miedo de que algo malo le suceda?",
    7: "¿Se siente feliz la mayor parte del tiempo?",
    8: "¿Se siente desamparado/a a menudo?",
    9: "¿Prefiere quedarse en casa antes que salir?",
    10: "¿Tiene problemas de memoria?",
    11: "¿Cree que es maravilloso estar vivo?",
    12: "¿Se siente bastante inútil tal como es ahora?",
    13: "¿Se siente lleno de energía?",
    14: "¿Siente que su situación es desesperada?",
    15: "¿Cree que la mayoría de otras personas están mejor que usted?"
}

# PHQ-9 Item Descriptions (from backend/src/prompts.js)
PHQ_ITEMS = {
    1: "Poco interés o placer en hacer cosas",
    2: "Sentirse deprimido, triste o desesperado",
    3: "Dificultad para dormirse, mantenerse dormido o dormir demasiado",
    4: "Sentirse cansado o tener poca energía",
    5: "Poco apetito o comer demasiado",
    6: "Sentirse mal consigo mismo o sentirse fracasado",
    7: "Dificultad para concentrarse en cosas",
    8: "Moverse demasiado lento o demasiado rápido",
    9: "Pensamientos de que sería mejor estar muerto"
}

def get_gds_desc(item_key):
    """Get GDS item description"""
    try:
        if isinstance(item_key, str):
            item_num = int(item_key.split('_')[-1]) if '_' in item_key else int(item_key)
        else:
            item_num = int(item_key)
        return GDS_ITEMS.get(item_num, f'Ítem GDS {item_num}')
    except:
        return f'Ítem GDS {item_key}'

def get_phq_desc(item_key):
    """Get PHQ item description"""
    try:
        if isinstance(item_key, str):
            item_num = int(item_key.split('_')[-1]) if '_' in item_key else int(item_key)
        else:
            item_num = int(item_key)
        return PHQ_ITEMS.get(item_num, f'Ítem PHQ {item_num}')
    except:
        return f'Ítem PHQ {item_key}'

# Generate general evaluation form
general_form = r"""# FORMULARIO GENERAL DE EVALUACIÓN CLÍNICA

> 🚨 **INSTRUCCIÓN:** Este formulario es para que psicólogos clínicos evalúen la **coherencia narrativa y validez del mapeo psicológico** de la intervención "Escoge Tu Historia XR En Salud Mental"

## PROTOCOLO DE EVALUACIÓN

### Sección 1: Datos del Evaluador
- **Nombre del Evaluador:** ____________________________________
- **Fecha de Evaluación:** ____________________________________
- **Institución:** ____________________________________
- **Años de experiencia clínica:** ____________________________________

### Sección 2: Evaluación Global - Coherencia Narrativa

**Instrucciones:** Para cada capítulo, valore la coherencia general de la historia usando la siguiente escala:

"""

q_num = 4
for chap_num in range(1, 15):
    general_form += f"\n### {q_num}. Capítulo {chap_num} - Coherencia Narrativa\n"
    general_form += "**¿El desarrollo narrativo del capítulo es coherente y clínicamente apropiado para el perfil de la paciente?**\n\n"
    general_form += "- [ ] **1** Inadecuado\n"
    general_form += "- [ ] **2** Poco adecuado\n"
    general_form += "- [ ] **3** Neutro/Aceptable\n"
    general_form += "- [ ] **4** Adecuado\n"
    general_form += "- [ ] **5** Muy adecuado/Preciso\n\n"
    q_num += 1
    general_form += f"**Observaciones del Capítulo {chap_num}:**\n\n"
    general_form += "____________________________________________________________________________________\n\n"
    general_form += "____________________________________________________________________________________\n\n"
    q_num += 1

# Write forms
out_file_txt = os.path.join(out_dir, 'FORMULARIO_GENERAL_EVALUACION.txt')
with codecs.open(out_file_txt, 'w', 'utf-8') as f:
    f.write(general_form)

out_file_md = os.path.join(out_dir, 'FORMULARIO_GENERAL_EVALUACION.md')
with codecs.open(out_file_md, 'w', 'utf-8') as f:
    f.write(general_form)

# Generate chapter documentation with improved formatting
for chapter in data['chapters']:
    chap_num = chapter.get('order', chapter.get('chapter_id'))
    chap_title = chapter.get('title', 'Sin Título')
    chap_filename = f'Capitulo_{chap_num}.md'
    filepath = os.path.join(out_dir, chap_filename)

    with codecs.open(filepath, 'w', 'utf-8') as f:
        # Title
        f.write(f"# Capítulo {chap_num}: {chap_title}\n\n")
        
        # Introduction
        f.write("📖 **Descripción:**\n\n")
        f.write("Este documento contiene el desglose narrativo de las escenas y sus respectivas opciones, junto con el mapeo hacia las escalas psicológicas evaluadas.\n\n")
        
        # Important instruction
        f.write("> 🚨 **INSTRUCCIÓN IMPORTANTE:** Solo se deben evaluar en el formulario las **escenas de tipo PLAYABLE (Jugables)**. Las escenas *Narradas* son contexto y transición únicamente.\n\n")
        f.write("---\n\n")
        
        # Scenes
        for idx, scene in enumerate(chapter.get('scenes', []), 1):
            scene_title = scene.get('title', f'Escena {idx}')
            scene_type = scene.get('type', 'playable')
            scene_id = scene.get('scene_id', f'c{chap_num:02d}-s{idx:02d}')
            
            # Scene header
            if scene_type.lower() == 'playable':
                f.write(f"## Escena {idx}: {scene_title}\n\n")
                f.write(f"**ID:** `{scene_id}` | **TIPO:** 🎮 **PLAYABLE**\n\n")
            else:
                f.write(f"## Escena {idx}: {scene_title}\n\n")
                f.write(f"**ID:** `{scene_id}` | **TIPO:** 📖 **NARRATED**\n\n")
            
            # Narrative context in blockquote
            context_text = scene.get('text', '').strip()
            f.write(f"> {context_text}\n\n")
            
            options = scene.get('options', [])
            
            if not options or scene_type.lower() == 'narrated':
                f.write("🚫 **Nota:** Es una escena narrativa - el usuario NO toma decisiones aquí.\n\n")
            else:
                f.write("### 🎯 Opciones del Jugador\n\n")
                
                for opt_idx, opt in enumerate(options, 1):
                    opt_text = opt.get('option_text', '')
                    f.write(f"#### Opción {opt_idx}\n\n")
                    f.write(f"**📝 Texto:** \"{opt_text}\"\n\n")
                    
                    gds_maps = opt.get('gds_mapping', [])
                    phq_maps = opt.get('phq_mapping', [])
                    
                    if not gds_maps and not phq_maps:
                        f.write("**🧠 Mapeo Psicológico:** Sin mapeo asignado a esta opción.\n\n")
                    else:
                        if gds_maps:
                            f.write("**🧠 Evaluación GDS (Geriatric Depression Scale):**\n\n")
                            for gm in gds_maps:
                                item_key = gm.get('item', 'N/A')
                                item_desc = get_gds_desc(item_key)
                                weight = gm.get('weight', 0)
                                rationale = gm.get('rationale', 'N/A').strip()
                                
                                f.write(f"- **Variable:** `{item_key}` — {item_desc}\n")
                                f.write(f"  - **⚖️ Peso:** {weight}\n")
                                f.write(f"  - **💬 Justificación:** {rationale}\n\n")
                        
                        if phq_maps:
                            f.write("**🧠 Evaluación PHQ-9:**\n\n")
                            for pm in phq_maps:
                                item_key = pm.get('item', 'N/A')
                                item_desc = get_phq_desc(item_key)
                                weight = pm.get('weight', 0)
                                rationale = pm.get('rationale', 'N/A').strip()
                                
                                f.write(f"- **Variable:** `{item_key}` — {item_desc}\n")
                                f.write(f"  - **⚖️ Peso:** {weight}\n")
                                f.write(f"  - **💬 Justificación:** {rationale}\n\n")
                    
                    f.write("\n")
            
            f.write("---\n\n")

print(f"✅ ÉXITO: Se actualizaron {16} documentos en docs_evaluacion/ con formato mejorado para GitHub.")
print(f"   - 14 archivos Capitulo_#.md")
print(f"   - 2 archivos FORMULARIO_GENERAL_EVALUACION (MD + TXT)")
