import json
import os

def load_json(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(data, filepath):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def fix_c10(chapter):
    for i, scene in enumerate(chapter.get('scenes', [])):
        if i >= len(chapter['scenes']) - 3:
            if 'mudanza' in scene.get('text', '').lower() or 'empaca' in scene.get('text', '').lower():
                scene['text'] = scene['text'].replace('mudanza', 'plática de mudarnos').replace('empacando', 'midiendo los espacios').replace('cajas', 'cuadernos con medidas')
            for opt in scene.get('options', []):
                opt['option_text'] = opt['option_text'].replace('empacar', 'medir').replace('mudarnos', 'planear juntos').replace('mudanza', 'planeación')
                if 'consequence' in opt:
                    opt['consequence'] = opt['consequence'].replace('mudanza', 'planeación').replace('empacar', 'medir')

def fix_c12(chapter):
    scenes_text = [
        "Arturo encuentra una caja vieja en el clóset. 'Rosita, creo que esta es ropa de Alberto', me dice suavemente.",
        "Miro las camisas de franela que tanto le gustaban. Todavía tienen un leve aroma a su loción. ¿Qué hago con esto?",
        "Arturo me coge la mano. 'Podemos guardarlas si quieres, o donarlas a la parroquia. Lo que te dicte el corazón'.",
        "Saco una chaqueta de cuero. Recuerdo la vez que fuimos a Villa de Leyva y él no se la quitó por el frío.",
        "De repente, siento un nudo en la garganta. Es difícil soltar estas cosas, son pedazos de mi vida con él.",
        "'Llora si necesitas, mi amor. Aquí estoy', me dice Arturo, pasándome un pañuelo. Me siento acompañada.",
        "Decidimos separar unas pocas prendas para conservar y el resto ponerlas en bolsas para donación.",
        "Encuentro el reloj de bolsillo de Alberto en el bolsillo de un abrigo. Se había perdido hace años.",
        "Me quedo mirando el reloj. Marca las tres, la misma hora en la que siempre tomábamos el tinto.",
        "Guardar ropa vieja no lo traerá de vuelta. El amor sigue vivo en mis recuerdos, no en estas telas.",
        "Cerramos las bolsas. Me siento más ligera, como si me hubiera quitado un peso inmenso de encima.",
        "Arturo y yo nos sentamos a tomar agua aromática. Mirando las cajas, sonrío. El pasado está en paz."
    ]
    for i, scene in enumerate(chapter.get('scenes', [])):
        if i < len(scenes_text):
            scene['text'] = scenes_text[i]
        for j, opt in enumerate(scene.get('options', [])):
            if j == 0:
                opt['option_text'] = "Afrontar los recuerdos del pasado."
                opt['consequence'] = "Me siento fuerte al recordar lo bonito."
            elif j == 1:
                opt['option_text'] = "Tomarme mi tiempo, sin afán."
                opt['consequence'] = "Avanzo a mi propio ritmo, sanando poco."
            else:
                opt['option_text'] = "Hablar con Arturo de cómo estoy."
                opt['consequence'] = "El apoyo de Arturo me reconforta."

def fix_c13(chapter):
    scenes_text = [
        "Las vecinas del barrio nos proponen armar un invernadero en el lote comunal. A Arturo le brillan los ojos.",
        "Llegamos al terreno. Está lleno de maleza, pero imagino tomates y orquídeas creciendo aquí. ¿Por dónde empezamos?",
        "Don Pacho nos trae unas guaduas y plástico. 'Pa que armemos la estructura', dice orgulloso. El barrio entero ayuda.",
        "Tengo que decidir qué voy a sembrar. Siempre se me dieron bien las aromáticas, pero unas flores adornarían mucho.",
        "Arturo se pone a clavar estacas y yo le paso las herramientas. Hacemos muy buen equipo.",
        "Las semillas necesitan tierra buena. Me voy con doña Marta a conseguir buen abono orgánico donde el vivero.",
        "El sol nos pega fuerte, pero el tinto que trajo la señora del frente nos da energía para seguir trabajando.",
        "Ya quedó armado el armazón. Se ve rústico pero firme. Es nuestro rinconcito de vida entre tanto ladrillo.",
        "Plantamos cilantro, manzanilla y astromelias. Con las manos en la tierra, siento una conexión especial y bonita.",
        "Arturo me mira con la cara sucia de tierra y sonríe. 'Nos quedó bello, mi Rosita'. Siento una paz inmensa.",
        "Llega la tarde y nos sentamos a descansar. Ver a toda la comunidad unida me llena el corazón de esperanza.",
        "Miramos el invernadero terminado bajo la luz del atardecer. Es un nuevo comienzo para todos, lleno de vida."
    ]
    for i, scene in enumerate(chapter.get('scenes', [])):
        if i < len(scenes_text):
            scene['text'] = scenes_text[i]
        for j, opt in enumerate(scene.get('options', [])):
            if j == 0:
                opt['option_text'] = "Trabajar duro en el jardín comunal."
                opt['consequence'] = "Disfruto trabajando activamente con la tierra pura."
            elif j == 1:
                opt['option_text'] = "Ayudar a los vecinos organizando todo."
                opt['consequence'] = "Me siento útil trabajando en familia comunitaria."
            else:
                opt['option_text'] = "Tomar pausas platicando con mis amigos."
                opt['consequence'] = "Cuido mi energía y me siento feliz."

def fix_c14(chapter):
    scenes_text = [
        "Hoy es domingo. Me despierto temprano y escucho a los pajaritos. Arturo ya está colando el café.",
        "Salgo a la cocina. El aroma a café fresco me llena de alegría. 'Buenos días, mi amor', dice mimándome.",
        "Hoy cumplimos un mes de novios formales. Queremos celebrar con un almuerzo especial. ¿Qué preparamos para nosotros?",
        "Hacemos un ajiaco bien sabroso. Mientras pico la papa criolla, noto cuánto ha cambiado para bien mi vida.",
        "Arturo pone música, unos boleros de esos que nos gustan. Nos ponemos a cantar alegres mientras guisamos.",
        "Pongo la mesa con el mantel bonito del estante. Hoy no hay prisas, solo nosotros disfrutando el presente feliz.",
        "El ajiaco quedó en su punto. Nos sentamos, comemos rico y brindamos con jugo por esta nueva oportunidad divina.",
        "Después de almuerzo nos sentamos en la sala. La luz de la tarde entra iluminando. Siento una inmensa gratitud.",
        "Miro a mi Arturo. Quién iba a pensar que después de tanta tristeza y duelo, volvería a tener amor.",
        "La vida tiene sus ciclos propios. Aprendí a soltar el dolor profundo para dejar entrar luz dorada a mí.",
        "Llega la noche, serena y bien estrellada. No necesito afanes. Tengo salud de hierro, buena compañía y vida.",
        "Cierro los ojos, agradecida por este nuevo y pleno amanecer en mi vida. El futuro ya no me asusta nada."
    ]
    for i, scene in enumerate(chapter.get('scenes', [])):
        if i < len(scenes_text):
            scene['text'] = scenes_text[i]
        for j, opt in enumerate(scene.get('options', [])):
            if j == 0:
                opt['option_text'] = "Dar gracias por esta vida nueva."
                opt['consequence'] = "Siento mucha plenitud y amor por hoy."
            elif j == 1:
                opt['option_text'] = "Arruncharme a mi amor un ratico."
                opt['consequence'] = "Fortalezco nuestro bello y sincero vínculo juntos."
            else:
                opt['option_text'] = "Pensar en lo mucho que sané."
                opt['consequence'] = "Reconozco y valoro toda mi fuerza interior."

def process_file(filepath):
    data = load_json(filepath)
    for index, chapter in enumerate(data.get('chapters', [])):
        cid = chapter.get('chapter_id')
        if cid == 'C10' or cid == 'C11':
            fix_c10(chapter)
        elif cid == 'C12':
            fix_c12(chapter)
        elif cid == 'C13':
            fix_c13(chapter)
        elif cid == 'C14':
            fix_c14(chapter)
    save_json(data, filepath)

files_to_fix = [
    'backend/content/chapters.json',
    'backend/content/chapters_expanded.json'
]

for f in files_to_fix:
    if os.path.exists(f):
        process_file(f)
        print(f"Fixed {f}")
    else:
        print(f"File not found: {f}")

