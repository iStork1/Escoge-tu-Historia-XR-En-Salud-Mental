import json
import codecs

new_text = 'A sus 72 años, Rosa despierta con la luz cálida que se filtra por la ventana de su apartamento en un tradicional barrio de Medellín. Como maestra jubilada, sus mañanas han pasado de tener el bullicio emocionante de los salones de clase a una quietud muy silenciosa, tal vez demasiado. Mientras cuela el primer tinto del día en su pequeña cocina, escucha a lo lejos el murmullo de los transeúntes y el cantar de los pájaros en los árboles de la cuadra. Últimamente, los días se sienten todos iguales y en el fondo sabe que le hace falta una motivación nueva. Al acercarse a la mesa de la entrada, nota una colorida tarjeta que alguien deslizó ayer por debajo de su puerta: es una invitación afectuosa de la junta de acción comunal para unirse al proyecto de recuperación del jardín vecinal. Rosa se sienta en su mecedora favorita, sosteniendo la tarjeta mientras el aroma a café recién hecho inunda la sala. ¿Cómo decide comenzar este día?'

def update_file(filepath):
    with codecs.open(filepath, 'r', 'utf-8') as f:
        data = json.load(f)
    
    chapter = data['chapters'][0]
    if chapter['chapter_id'] == 'c01':
        scene_1 = chapter['scenes'][0]
        if scene_1['scene_id'] == 'c01-s01':
            scene_1['text'] = new_text
            
    with codecs.open(filepath, 'w', 'utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

update_file('backend/content/chapters.json')
update_file('backend/content/chapters_expanded.json')

print('Contexto de la primera escena actualizado (v2).')