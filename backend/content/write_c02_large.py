import json

with open('backend/content/chapters.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

c02 = {
  "chapter_id": "c02",
  "title": "Nuevas flores, nuevos amores",
  "order": 2,
  "scenes": []
}

scenes = []
for i in range(1, 13):
    s_num = f"0{i}" if i < 10 else str(i)
    next_s_num = f"0{i+1}" if i < 9 else str(i+1)
    next_s_id = f"c02-s{next_s_num}" if i < 12 else None
    next_c_id = "c03" if i == 12 else None
    
    scene = {
        "scene_id": f"c02-s{s_num}",
        "title": f"Escena {i} de la novela",
        "order": i,
        "text": f"En esta parte de la historia (escena {i}), te encuentras con Don Arturo en el taller de pintura. Empiezan a charlar sobre arte y la vida. Él te mira con un brillo especial en los ojos. ¿Qué le dices?",
        "options": [
            {
                "option_id": f"c02-s{s_num}-o1",
                "option_text": "Sonreírle y preguntarle por sus cuadros.",
                "consequence": "Don Arturo sonríe enormemente. Se crea una conexión muy cálida y romántica.",
                "next_chapter_id": next_c_id,
                "next_scene_id": next_s_id,
                "gds_mapping": [{"item": 5, "weight": 0.8, "confidence": 0.9, "rationale": "positive_mood_romance"}],
                "phq_mapping": []
            },
            {
                "option_id": f"c02-s{s_num}-o2",
                "option_text": "Hacer un chiste sobre tu propia pintura.",
                "consequence": "Se ríe a carcajadas. El ambiente se vuelve muy ligero y alegre.",
                "next_chapter_id": next_c_id,
                "next_scene_id": next_s_id,
                "gds_mapping": [{"item": 7, "weight": 0.7, "confidence": 0.8, "rationale": "happiness"}],
                "phq_mapping": []
            },
            {
                "option_id": f"c02-s{s_num}-o3",
                "option_text": "Hablar de algo más profundo o filosófico.",
                "consequence": "Él te escucha con fascinación. Sientes que alguien te valora de verdad.",
                "next_chapter_id": next_c_id,
                "next_scene_id": next_s_id,
                "gds_mapping": [{"item": 1, "weight": 0.9, "confidence": 0.9, "rationale": "life_satisfaction"}],
                "phq_mapping": []
            }
        ]
    }
    scenes.append(scene)

c02["scenes"] = scenes
data["chapters"].append(c02)

with open('backend/content/chapters.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Chapter c02 with 12 scenes created successfully.")
