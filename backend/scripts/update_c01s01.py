import json
import codecs

new_text = 'A sus 72 años, Rosa siente que los días se han vuelto copias exactas unos de otros. Se despierta, rodeada de muebles que guardan la memoria de una vida entera. El apartamento está sumido en un silencio profundo, un silencio que tiene un peso real desde que Alberto, su compañero de toda la vida, falleció hace dos años. Son las siete de la mañana, la hora en que solían compartir el primer tinto del día. Al buscar en su mesita de noche, roza una tarjeta colorida que alguien deslizó ayer debajo de su puerta: es una invitación cálida del centro comunitario para unirse al proyecto de recuperación del jardín vecinal. Rosa se sienta al borde de la cama, sosteniendo la tarjeta mientras el aroma a café recién colado inunda la habitación. ¿Cómo decide comenzar este largo día?'

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

print('Contexto de la primera escena actualizado.')