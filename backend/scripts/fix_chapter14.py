#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json

# Chapter 14 corrected content
chapter_14_fixed = {
    "chapter_id": "c14",
    "title": "El nuevo amanecer",
    "order": 14,
    "scenes": [
        {
            "scene_id": "c14-s01",
            "title": "Catorce días después",
            "hero_stage": "1_ordinary_world",
            "type": "playable",
            "order": 1,
            "text": "Han pasado catorce días desde que Rosa conoció a Arturo en el taller de pintura. Esta mañana, despierta en su apartamento con una sensación diferente: el sol entra por la ventana, y lo primero que piensa es en estar con él. Arturo la espera en la cafetería cercana, el mismo lugar donde tomaron café aquella primera tarde. Rosa se mira en el espejo, sonríe, y sale de casa con paso seguro.",
            "options": [
                {
                    "option_id": "c14-s01-o1",
                    "option_text": "Abraza a Arturo con confianza y alegría.",
                    "consequence": "Rosa reconoce el amor renaciente en su vida.",
                    "next_scene_id": "c14-s02",
                    "gds_mapping": [{"item": 11, "weight": 0.8, "confidence": 0.9, "rationale": "valora_estar_viva_con_propósito"}],
                    "phq_mapping": [{"item": 1, "weight": 0.7, "confidence": 0.85, "rationale": "interés_renovado_en_relación_significativa"}]
                },
                {
                    "option_id": "c14-s01-o2",
                    "option_text": "Se sientan tranquilamente y comparten el desayuno.",
                    "consequence": "Rosa aprecia la paz de la compañía compartida.",
                    "next_scene_id": "c14-s02",
                    "gds_mapping": [{"item": 7, "weight": 0.75, "confidence": 0.9, "rationale": "felicidad_en_momentos_ordinarios"}],
                    "phq_mapping": [{"item": 2, "weight": 0.3, "confidence": 0.8, "rationale": "tristeza_transformada_en_contentamiento"}]
                },
                {
                    "option_id": "c14-s01-o3",
                    "option_text": "Toman café mientras hablan de planes futuros.",
                    "consequence": "Rosa proyecta vida más allá del presente inmediato.",
                    "next_scene_id": "c14-s02",
                    "gds_mapping": [{"item": 2, "weight": 0.15, "confidence": 0.85, "rationale": "reenganche_con_planes_y_actividades"}],
                    "phq_mapping": [{"item": 1, "weight": 0.5, "confidence": 0.85, "rationale": "esperanza_en_futuro_compartido"}]
                }
            ]
        },
        {
            "scene_id": "c14-s02",
            "title": "El desayuno perfecto",
            "hero_stage": "2_call_to_adventure",
            "type": "playable",
            "order": 2,
            "text": "La cafetería está llena de luz matinal. Arturo pide arepas y café. Rosa elige jugo de naranja. Mientras comen, suena el teléfono de Arturo: es su hija Elena, que llama desde la ciudad. Ella quiere visitarlos este fin de semana. Arturo mira a Rosa buscando su aprobación. Rosa siente el peso de una decisión importante: permitir que la vida de Arturo se cruce más profundamente con la suya.",
            "options": [
                {
                    "option_id": "c14-s02-o1",
                    "option_text": "Anima a Arturo a invitar a Elena con entusiasmo.",
                    "consequence": "Rosa abre su corazón al círculo familiar de Arturo.",
                    "next_scene_id": "c14-s03",
                    "gds_mapping": [{"item": 11, "weight": 0.8, "confidence": 0.9, "rationale": "celebra_ampliación_de_vínculos"}],
                    "phq_mapping": [{"item": 1, "weight": 0.3, "confidence": 0.8, "rationale": "interés_activo_en_vida_social_expandida"}]
                },
                {
                    "option_id": "c14-s02-o2",
                    "option_text": "Sonríe pero pide tiempo para conocerla previamente.",
                    "consequence": "Rosa avanza con cautela pero confianza.",
                    "next_scene_id": "c14-s03",
                    "gds_mapping": [{"item": 6, "weight": 0.4, "confidence": 0.8, "rationale": "prudencia_sin_parálisis"}],
                    "phq_mapping": [{"item": 4, "weight": 0.35, "confidence": 0.75, "rationale": "cansancio_moderado_manejado_con_límites"}]
                },
                {
                    "option_id": "c14-s02-o3",
                    "option_text": "Sugiere otro día menos apresurado.",
                    "consequence": "Rosa protege su espacio pero no se aísla.",
                    "next_scene_id": "c14-s03",
                    "gds_mapping": [{"item": 9, "weight": 0.2, "confidence": 0.75, "rationale": "preferencia_por_hogar_no_es_aislamiento"}],
                    "phq_mapping": [{"item": 7, "weight": 0.15, "confidence": 0.7, "rationale": "dificultad_leve_para_iniciativa_en_contexto_nuevo"}]
                }
            ]
        },
        {
            "scene_id": "c14-s03",
            "title": "Elena se presenta",
            "hero_stage": "3_refusal_of_call",
            "type": "narrated",
            "order": 3,
            "text": "El viernes por la tarde, Elena llega. Es una mujer de cuarenta años, con los ojos amables de Arturo. Viene con su esposo Miguel y sus dos nietos. Rosa los recibe en el apartamento, que ha limpiado y adornado con flores del jardín comunitario. Elena abraza a su padre. Luego se acerca a Rosa: 'Papá ha hablado tanto de ti. Es... es bueno verlo sonreír así'.",
            "options": []
        },
        {
            "scene_id": "c14-s04",
            "title": "El bucle se cierra",
            "hero_stage": "4_meeting_mentor",
            "type": "playable",
            "order": 4,
            "text": "En el parque comunitario, Rosa, Arturo y Elena caminan entre los senderos. Arturo la toma del brazo a Rosa. Elena observa esto con una sonrisa. De repente, ven a una mujer mayor sentada sola en una banca, con expresión perdida. Rosa la reconoce: es como ella era hace meses. Los ojos de ambas se encuentran. Rosa recuerda a Doña Esther, aquella primera mujer sola que vio llegar al jardín.",
            "options": [
                {
                    "option_id": "c14-s04-o1",
                    "option_text": "Rosa va hacia ella y la invita al jardín.",
                    "consequence": "Rosa completa su ciclo de mentor.",
                    "next_scene_id": "c14-s05",
                    "gds_mapping": [{"item": 11, "weight": 0.85, "confidence": 0.95, "rationale": "Rosa_es_ahora_quien_ofrece_oportunidad"}],
                    "phq_mapping": [{"item": 1, "weight": 0.2, "confidence": 0.8, "rationale": "propósito_de_ayudar_fortalece_interés"}]
                },
                {
                    "option_id": "c14-s04-o2",
                    "option_text": "Rosa comparte la mirada, sin intervenir aún.",
                    "consequence": "Rosa respeta el timing de cada persona.",
                    "next_scene_id": "c14-s05",
                    "gds_mapping": [{"item": 7, "weight": 0.7, "confidence": 0.85, "rationale": "compasión_sin_imposición"}],
                    "phq_mapping": [{"item": 2, "weight": 0.25, "confidence": 0.75, "rationale": "empatía_madura_basada_en_experiencia"}]
                },
                {
                    "option_id": "c14-s04-o3",
                    "option_text": "Pide a Elena que hable con la mujer mientras ella observa.",
                    "consequence": "Rosa amplía el círculo de ayuda.",
                    "next_scene_id": "c14-s05",
                    "gds_mapping": [{"item": 2, "weight": 0.3, "confidence": 0.8, "rationale": "integra_su_círculo_en_su_misión"}],
                    "phq_mapping": []
                }
            ]
        },
        {
            "scene_id": "c14-s05",
            "title": "Reflejos compartidos",
            "hero_stage": "5_crossing_threshold",
            "type": "playable",
            "order": 5,
            "text": "La mujer se llama Gloria. Rosa le habla suavemente sobre el jardín. Gloria, tímida al principio, escucha. Arturo añade: 'El jardín cambió mi vida también'. Su hija Elena, sorprendida, pregunta: '¿Papá, tú también estabas...?' Arturo asiente: 'Estaba solo, perdido. Rosa y este lugar me mostraron que la vida seguía'.",
            "options": [
                {
                    "option_id": "c14-s05-o1",
                    "option_text": "Rosa toma la mano de Gloria con calidez.",
                    "consequence": "Rosa transmite seguridad a través del contacto.",
                    "next_scene_id": "c14-s06",
                    "gds_mapping": [{"item": 11, "weight": 0.85, "confidence": 0.9, "rationale": "generosidad_tangible"}],
                    "phq_mapping": []
                },
                {
                    "option_id": "c14-s05-o2",
                    "option_text": "Rosa invita a Gloria a desayunar con ellos mañana.",
                    "consequence": "Rosa ofrece acción concreta.",
                    "next_scene_id": "c14-s06",
                    "gds_mapping": [{"item": 2, "weight": 0.25, "confidence": 0.85, "rationale": "Rosa_actúa_como_agente_activo_de_cambio"}],
                    "phq_mapping": [{"item": 1, "weight": 0.3, "confidence": 0.8, "rationale": "propósito_de_mentoría"}]
                },
                {
                    "option_id": "c14-s05-o3",
                    "option_text": "Sonríe y le deja su número de teléfono.",
                    "consequence": "Rosa respeta autonomía pero abre puerta.",
                    "next_scene_id": "c14-s06",
                    "gds_mapping": [{"item": 7, "weight": 0.65, "confidence": 0.85, "rationale": "Rosa_actúa_con_empatía_y_respeto"}],
                    "phq_mapping": []
                }
            ]
        },
        {
            "scene_id": "c14-s06",
            "title": "Testigo del milagro",
            "hero_stage": "6_tests_allies_enemies",
            "type": "narrated",
            "order": 6,
            "text": "Esa noche, en el apartamento de Rosa, Elena habla con su padre a solas. 'Papá, no te había visto así en años. Rosa... ella es especial.' Arturo asiente, inundado de gratitud. 'La vida me devolvió la alegría cuando más la necesitaba.' Elena abraza a su padre. Desde la cocina, Rosa escucha estas palabras. Sus ojos se humedecen, pero son lágrimas de paz.",
            "options": []
        },
        {
            "scene_id": "c14-s07",
            "title": "La cosecha madura",
            "hero_stage": "7_approach_inmost_cave",
            "type": "playable",
            "order": 7,
            "text": "El domingo, Rosa y Arturo están en el jardín comunitario. Sofía, Don Hernando, y otros amigos están allí. Hoy es especial: Arturo ofrece un taller de escritura de poesía. Sofía bromea: 'Miren a Rosa, tan feliz... y nosotros que pensábamos que nunca volvería a sonreír.' Rosa abraza a Sofía. Arturo toma su mano. ¿Qué siente Rosa en este momento?",
            "options": [
                {
                    "option_id": "c14-s07-o1",
                    "option_text": "Agradece a todos por haber estado con ella.",
                    "consequence": "Rosa reconoce el poder del apoyo comunitario.",
                    "next_scene_id": "c14-s08",
                    "gds_mapping": [{"item": 11, "weight": 0.8, "confidence": 0.9, "rationale": "valora_estar_viva_y_acompañada"}],
                    "phq_mapping": [{"item": 1, "weight": 0.2, "confidence": 0.85, "rationale": "interés_verdadero_en_comunidad"}]
                },
                {
                    "option_id": "c14-s07-o2",
                    "option_text": "Observa en silencio, asimilando la transformación.",
                    "consequence": "Rosa integra lo vivido en su ser.",
                    "next_scene_id": "c14-s08",
                    "gds_mapping": [{"item": 5, "weight": 0.15, "confidence": 0.85, "rationale": "paz_y_buen_humor_sin_dramatismo"}],
                    "phq_mapping": []
                },
                {
                    "option_id": "c14-s07-o3",
                    "option_text": "Abre el taller de Arturo con su primer poema.",
                    "consequence": "Rosa se expresa creativamente con seguridad.",
                    "next_scene_id": "c14-s08",
                    "gds_mapping": [{"item": 13, "weight": 0.8, "confidence": 0.9, "rationale": "energía_dirigida_a_expresión_creativa"}],
                    "phq_mapping": [{"item": 1, "weight": 0.3, "confidence": 0.85, "rationale": "interés_en_actividad_creativa_compartida"}]
                }
            ]
        },
        {
            "scene_id": "c14-s08",
            "title": "Epilogo luminoso",
            "hero_stage": "8_ordeal",
            "type": "narrated",
            "order": 8,
            "text": "Semanas después, Rosa y Arturo establecen una rutina: desayunan juntos, trabajan en el jardín, asisten a los talleres, y a veces cenan en el balcón viendo la ciudad. Gloria, la mujer del parque, ahora viene regularmente al jardín. Elena y su familia visitan cada quincena. La vida de Rosa, que una vez fue un cuarto silencioso y un café solo, ahora es un concierto constante de voces amadas, risas, y proyectos compartidos.",
            "options": []
        },
        {
            "scene_id": "c14-s09",
            "title": "Un nuevo capítulo",
            "hero_stage": "9_reward",
            "type": "playable",
            "order": 9,
            "text": "Una mañana, Rosa despierta y Arturo ya está haciendo café. Los rayos de sol iluminan el apartamento. Ella piensa en Alberto, su esposo fallecido. Lo recuerda con amor, sin la tristeza abrumadora de antes. Siente que Alberto estaría feliz de verla así: viva, conectada, amada. ¿Cómo procesa Rosa este momento?",
            "options": [
                {
                    "option_id": "c14-s09-o1",
                    "option_text": "Comparte con Arturo lo que siente sobre Alberto.",
                    "consequence": "Rosa integra su pasado con su presente.",
                    "next_scene_id": "c14-s10",
                    "gds_mapping": [{"item": 1, "weight": 0.15, "confidence": 0.85, "rationale": "satisfacción_con_vida_honesta"}],
                    "phq_mapping": [{"item": 2, "weight": 0.25, "confidence": 0.8, "rationale": "trigeza_sana_elaborada"}]
                },
                {
                    "option_id": "c14-s09-o2",
                    "option_text": "Se sienta en silencio, en paz con la memoria.",
                    "consequence": "Rosa respeta el duelo desde la plenitud.",
                    "next_scene_id": "c14-s10",
                    "gds_mapping": [{"item": 11, "weight": 0.8, "confidence": 0.9, "rationale": "valida_estar_viva_honrando_memoria"}],
                    "phq_mapping": []
                },
                {
                    "option_id": "c14-s09-o3",
                    "option_text": "Sale al balcón a contemplar el nuevo día.",
                    "consequence": "Rosa vive el presente plenamente.",
                    "next_scene_id": "c14-s10",
                    "gds_mapping": [{"item": 7, "weight": 0.8, "confidence": 0.9, "rationale": "felicidad_en_lo_cotidiano"}],
                    "phq_mapping": [{"item": 1, "weight": 0.2, "confidence": 0.85, "rationale": "interés_en_vida_renovada"}]
                }
            ]
        },
        {
            "scene_id": "c14-s10",
            "title": "El mentee se convierte en mentor",
            "hero_stage": "10_road_back",
            "type": "playable",
            "order": 10,
            "text": "Gloria ha empezado a venir regularmente al jardín. Hoy trae a su propia hermana, que también está pasando por depresión. Gloria presenta a Rosa como su 'hada madrina'. Los ojos de la hermana se llenan de esperanza al ver la transformación de Gloria. Rosa sonríe: lo que en ella fue caída profunda ahora es escalera para otros.",
            "options": [
                {
                    "option_id": "c14-s10-o1",
                    "option_text": "Recibe a la hermana con genuino interés.",
                    "consequence": "Rosa expande su círculo de mentoría.",
                    "next_scene_id": "c14-s11",
                    "gds_mapping": [{"item": 11, "weight": 0.85, "confidence": 0.95, "rationale": "propósito_de_Rosa_es_ahora_ayudar"}],
                    "phq_mapping": [{"item": 1, "weight": 0.3, "confidence": 0.85, "rationale": "interés_en_vida_de_otros"}]
                },
                {
                    "option_id": "c14-s10-o2",
                    "option_text": "Comparte su propia historia de transformación.",
                    "consequence": "Rosa normaliza la recuperación de depresión.",
                    "next_scene_id": "c14-s11",
                    "gds_mapping": [{"item": 2, "weight": 0.25, "confidence": 0.85, "rationale": "Rosa_es_modelo_vivo"}],
                    "phq_mapping": [{"item": 5, "weight": 0.2, "confidence": 0.8, "rationale": "validación_de_esperanza"}]
                },
                {
                    "option_id": "c14-s10-o3",
                    "option_text": "Le da tareas en el jardín, dejando que la acción hable.",
                    "consequence": "Rosa confía en la naturaleza terapéutica.",
                    "next_scene_id": "c14-s11",
                    "gds_mapping": [{"item": 13, "weight": 0.7, "confidence": 0.85, "rationale": "energía_en_actividad_directa"}],
                    "phq_mapping": []
                }
            ]
        },
        {
            "scene_id": "c14-s11",
            "title": "El atardecer perfecto",
            "hero_stage": "11_resurrection",
            "type": "narrated",
            "order": 11,
            "text": "Esa tarde, Rosa y Arturo se sientan en su banca favorita del parque. El cielo se tiñe de naranja y violeta. Alrededor, el mundo sigue su ritmo. Rosa piensa: 'Hace un año, yo estaba aquí pero no estaba viva. Hoy, respiro cada segundo de esta puesta de sol.' Arturo toma su mano. No necesitan palabras.",
            "options": []
        },
        {
            "scene_id": "c14-s12",
            "title": "Nuevo amanecer",
            "hero_stage": "12_return_with_elixir",
            "type": "playable",
            "order": 12,
            "text": "Mañana es otro día. Rosa se levantará, beberá café con Arturo, irá al jardín, volverá a encontrar a personas que necesitan lo que ella puede ofrecer: esperanza, companía, porque ella también la necesitó una vez y fue salvada. El ciclo se repite, pero ahora ella es parte de él.",
            "options": [
                {
                    "option_id": "c14-s12-o1",
                    "option_text": "Rosa entra en el nuevo amanecer agradecida.",
                    "consequence": "Rosa integra gratitud en su ser transformado.",
                    "next_chapter_id": None,
                    "next_scene_id": None,
                    "gds_mapping": [{"item": 11, "weight": 0.8, "confidence": 0.95, "rationale": "valoración_existencial_completa"}],
                    "phq_mapping": [{"item": 1, "weight": 0.15, "confidence": 0.9, "rationale": "interés_plenamente_restaurado"}]
                },
                {
                    "option_id": "c14-s12-o2",
                    "option_text": "Rosa cierra los ojos, sonriendo en paz.",
                    "consequence": "Rosa encuentra paz interior en completud.",
                    "next_chapter_id": None,
                    "next_scene_id": None,
                    "gds_mapping": [{"item": 5, "weight": 0.1, "confidence": 0.9, "rationale": "buen_humor_profundo_y_estable"}],
                    "phq_mapping": []
                },
                {
                    "option_id": "c14-s12-o3",
                    "option_text": "Rosa se levanta para iniciar el nuevo ciclo.",
                    "consequence": "Rosa vive el retorno como acción constante.",
                    "next_chapter_id": None,
                    "next_scene_id": None,
                    "gds_mapping": [{"item": 13, "weight": 0.8, "confidence": 0.9, "rationale": "energía_de_vida_plenamente_restaurada"}],
                    "phq_mapping": [{"item": 1, "weight": 0.2, "confidence": 0.9, "rationale": "compromiso_existencial_renovado"}]
                }
            ]
        }
    ]
}

# Load the full file
with open('backend/content/chapters_expanded.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Replace chapter 14
data['chapters'] = [c for c in data['chapters'] if c.get('order') != 14]
data['chapters'].append(chapter_14_fixed)

# Sort by order
data['chapters'] = sorted(data['chapters'], key=lambda x: x.get('order', 99))

# Write back
with open('backend/content/chapters_expanded.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

# Also update chapters.json with same fix
with open('backend/content/chapters.json', 'r', encoding='utf-8') as f:
    data2 = json.load(f)

data2['chapters'] = [c for c in data2['chapters'] if c.get('order') != 14]
data2['chapters'].append(chapter_14_fixed)
data2['chapters'] = sorted(data2['chapters'], key=lambda x: x.get('order', 99))

with open('backend/content/chapters.json', 'w', encoding='utf-8') as f:
    json.dump(data2, f, indent=2, ensure_ascii=False)

print("✅ Capítulo 14 actualizado en ambos archivos JSON")
