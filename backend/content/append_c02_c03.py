
import json
import os

filepath = r"C:\Users\Felipe Jaimes\Desktop\Escoge Tu Historia XR En Salud Mental\backend\content\chapters.json"

with open(filepath, "r", encoding="utf-8") as f:
    data = json.load(f)

# Need to make sure c02 is very positive and uplifting.
c02 = {
  "chapter_id": "c02",
  "title": "Nuevas flores, nuevos amores",
  "order": 2,
  "scenes": [
    {
      "scene_id": "c02-s01",
      "title": "La sonrisa de la mañana",
      "hero_stage": "1_ordinary_world",
      "type": "playable",
      "order": 1,
      "text": "Es martes por la mañana. <break time=\"400ms\"/> El sol entra cálido por la ventana y Rosa siente una energía diferente. <break time=\"300ms\"/> Al llegar al jardín comunitario, huele a jazmín fresco. <break time=\"500ms\"/> <prosody rate=\"85%\">¿Qué hace Rosa hoy al comenzar su día?</prosody>",
      "options": [
        {
          "option_id": "c02-s01-o1",
          "text": "Saludar a todos con alegría y un abrazo.",
          "consequence": "Rosa reparte abrazos. Sofía sonríe y le dice que se le ve radiante. El ambiente se llena de calidez y buena energía.",
          "next_scene_id": "c02-s02",
          "gds_mapping": [{ "item": 7, "weight": 0.8, "confidence": 0.9, "rationale": "felicidad_activa" }],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s01-o2",
          "text": "Ir directo a regar las flores con calma.",
          "consequence": "Rosa disfruta la paz de la mañana. El sonido del agua sobre las hojas le da una sensación de serenidad profunda.",
          "next_scene_id": "c02-s02",
          "gds_mapping": [{ "item": 5, "weight": 0.7, "confidence": 0.8, "rationale": "buen_humor_sereno" }],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s01-o3",
          "text": "Sentarse un momento a tomar café y observar.",
          "consequence": "Rosa observa a sus vecinos conversar animadamente. Siente que por fin pertenece a un grupo hermoso y lleno de vida.",
          "next_scene_id": "c02-s02",
          "gds_mapping": [{ "item": 1, "weight": 0.6, "confidence": 0.8, "rationale": "satisfaccion_vital" }],
          "phq_mapping": []
        }
      ]
    },
    {
      "scene_id": "c02-s02",
      "title": "Una visita inesperada",
      "hero_stage": "2_call_to_adventure",
      "type": "narrated",
      "order": 2,
      "text": "Mientras riega las plantas, entra un señor nuevo al jardín. <break time=\"300ms\"/> Es don Arturo, un hombre de cabello canoso y sonrisa amable que acaba de mudarse al barrio. <break time=\"400ms\"/> Se acerca despacio, apreciando el lugar. <break time=\"300ms\"/> <prosody pitch=\"+3%\">\"Buenos días, qué hermoso tienen esto. ¿Alguien podría enseñarme un poco?\"</prosody> <break time=\"400ms\"/>",
      "options": [{
        "option_id": "c02-s02-o1", "text": "Continuar.", "consequence": "Don Arturo mira directamente a Rosa, y ella siente un ligero rubor en las mejillas.", "next_scene_id": "c02-s03", "gds_mapping": [], "phq_mapping": []
      }]
    },
    {
      "scene_id": "c02-s03",
      "title": "La sorpresa",
      "hero_stage": "3_refusal_of_call",
      "type": "playable",
      "order": 3,
      "text": "Rosa se siente halagada, pero a la vez un poco nerviosa. <break time=\"400ms\"/> Hace mucho tiempo que un hombre no la miraba con tanta dulzura. <break time=\"500ms\"/> <prosody rate=\"90%\">¿Cómo le responde Rosa a don Arturo?</prosody>",
      "options": [
        {
          "option_id": "c02-s03-o1",
          "text": "Ofrecerse a mostrarle todo el jardín personalmente.",
          "consequence": "Rosa le enseña cada rincón. Don Arturo la escucha fascinado, haciendo preguntas y elogiando su conocimiento.",
          "next_scene_id": "c02-s04",
          "gds_mapping": [{ "item": 2, "weight": 0.7, "confidence": 0.8, "rationale": "interes_social_nuevo" }],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s03-o2",
          "text": "Llamar a Camilo para que le explique mejor los tecnicismos.",
          "consequence": "Rosa busca ayuda porque se siente tímida. Arturo sonríe, comprendiendo su pudor, pero no le quita la mirada de encima.",
          "next_scene_id": "c02-s04",
          "gds_mapping": [{ "item": 15, "weight": 0.5, "confidence": 0.7, "rationale": "timidez_social_leve" }],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s03-o3",
          "text": "Responderle amablemente, pero seguir con su trabajo.",
          "consequence": "Rosa es cortés pero mantiene su distancia. Sin embargo, se sorprende sonriendo mientras él le cuenta de dónde viene.",
          "next_scene_id": "c02-s04",
          "gds_mapping": [{ "item": 13, "weight": 0.4, "confidence": 0.7, "rationale": "energia_positiva" }],
          "phq_mapping": []
        }
      ]
    },
    {
      "scene_id": "c02-s04",
      "title": "Consejo de amiga",
      "hero_stage": "4_meeting_mentor",
      "type": "narrated",
      "order": 4,
      "text": "Sofía se acerca con disimulo y le da un codazo suave a Rosa. <break time=\"200ms\"/> <prosody rate=\"90%\">\"¡Vaya, Rosa! Creo que le encantaste a don Arturo. ¿Ves? La vida siempre da sorpresas hermosas.\"</prosody> <break time=\"400ms\"/>",
      "options": [{
        "option_id": "c02-s04-o1", "text": "Continuar.", "consequence": "Sofía le guiña un ojo. Rosa ríe, sintiéndose viva y con mariposas en el estómago.", "next_scene_id": "c02-s05", "gds_mapping": [], "phq_mapping": []
      }]
    },
    {
      "scene_id": "c02-s05",
      "title": "Compartiendo la tierra",
      "hero_stage": "5_crossing_threshold",
      "type": "playable",
      "order": 5,
      "text": "Más tarde, están escarbando la tierra en bancales cercanos. <break time=\"300ms\"/> Arturo le cuenta de su gusto por la poesía. <break time=\"400ms\"/> <prosody rate=\"85%\">¿Cómo participa Rosa en la conversación?</prosody>",
      "options": [
        {
          "option_id": "c02-s05-o1",
          "text": "Contarle que a ella también le gusta leer mucho.",
          "consequence": "Descubren que comparten el gusto por los mismos autores. Arturo le promete prestarle un libro a la mañana siguiente.",
          "next_scene_id": "c02-s06",
          "gds_mapping": [{ "item": 5, "weight": 0.8, "confidence": 0.9, "rationale": "animo_excelente_compartiendo_gustos" }],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s05-o2",
          "text": "Escucharlo con asombro y dejar que hable.",
          "consequence": "Rosa lo escucha atenta. Arturo tiene una voz muy suave que la relaja y la hace olvidar cualquier dolor del pasado.",
          "next_scene_id": "c02-s06",
          "gds_mapping": [{ "item": 1, "weight": 0.6, "confidence": 0.8, "rationale": "paz_interior" }],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s05-o3",
          "text": "Hacerle una broma sobre si los poetas saben de jardines.",
          "consequence": "Ambos ríen a carcajadas. La broma rompe cualquier tensión que quedaba y genera una complicidad hermosa.",
          "next_scene_id": "c02-s06",
          "gds_mapping": [{ "item": 7, "weight": 0.9, "confidence": 0.9, "rationale": "felicidad_expresiva" }],
          "phq_mapping": []
        }
      ]
    },
    {
      "scene_id": "c02-s06",
      "title": "Un pequeño contratiempo",
      "hero_stage": "6_tests_allies_enemies",
      "type": "playable",
      "order": 6,
      "text": "De pronto, empieza a chispear. <break time=\"300ms\"/> Las nubes se juntan rápidamente y todos corren bajo el techito de lona. <break time=\"400ms\"/> Quedan muy juntos, resguardándose de la lluvia. <break time=\"300ms\"/> <prosody rate=\"85%\">¿Cómo vive Rosa este momento con la lluvia?</prosody>",
      "options": [
        {
          "option_id": "c02-s06-o1",
          "text": "Mirar a Arturo, riendo por la carrera.",
          "consequence": "Arturo le sonríe mientras se sacude las gotas, ofreciéndole su pañuelo para secarse el rostro. Es un gesto tierno.",
          "next_scene_id": "c02-s07",
          "gds_mapping": [{ "item": 11, "weight": 0.8, "confidence": 0.8, "rationale": "disfruta_de_estar_viva" }],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s06-o2",
          "text": "Preocuparse un poco por si las albahacas se dañan.",
          "consequence": "Arturo nota su preocupación y la tranquiliza, asegurando que la lluvia es una bendición para las plantas nuevas.",
          "next_scene_id": "c02-s07",
          "gds_mapping": [{ "item": 15, "weight": 0.4, "confidence": 0.6, "rationale": "preocupacion_ligera" }],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s06-o3",
          "text": "Disfrutar del olor a tierra mojada cerrando los ojos.",
          "consequence": "La lluvia refresca el alma de Rosa. Siente que hoy todo es posible, todo es nuevo y todo es hermoso.",
          "next_scene_id": "c02-s07",
          "gds_mapping": [{ "item": 1, "weight": 0.85, "confidence": 0.9, "rationale": "satisfaccion_vital_plena" }],
          "phq_mapping": []
        }
      ]
    },
    {
      "scene_id": "c02-s07",
      "title": "La charla bajo la lluvia",
      "hero_stage": "7_approach_to_inmost_cave",
      "type": "narrated",
      "order": 7,
      "text": "Bajo la lona, el sonido del aguacero aísla al grupo. <break time=\"300ms\"/> Don Arturo y Rosa quedan un poco apartados del resto. <break time=\"400ms\"/> Él le comenta lo bonito que es empezar de cero a esta edad. <break time=\"500ms\"/>",
      "options": [{
        "option_id": "c02-s07-o1", "text": "Continuar.", "consequence": "La honestidad de don Arturo le toca el corazón a Rosa. Se da cuenta de que él también busca sanar soledades.", "next_scene_id": "c02-s08", "gds_mapping": [], "phq_mapping": []
      }]
    },
    {
      "scene_id": "c02-s08",
      "title": "Un sentimiento profundo",
      "hero_stage": "8_ordeal",
      "type": "playable",
      "order": 8,
      "text": "Arturo le pregunta. <break time=\"300ms\"/> <prosody rate=\"90%\">\"Rosa, me encantaría tomar un café contigo algún día fuera del jardín. ¿Te gustaría?\"</prosody> <break time=\"500ms\"/> La invitación es directa y respetuosa. <break time=\"400ms\"/> <prosody pitch=\"+2%\">¿Cuál es la respuesta de Rosa?</prosody>",
      "options": [
        {
          "option_id": "c02-s08-o1",
          "text": "Aceptar con una sonrisa enorme.",
          "consequence": "Rosa siente una alegría desbordante. Ya es hora de permitirse disfrutar de la compañía de alguien especial. Arturo se ilumina.",
          "next_scene_id": "c02-s09",
          "gds_mapping": [{ "item": 5, "weight": 0.9, "confidence": 0.9, "rationale": "esperanza_ilusion_positiva" }],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s08-o2",
          "text": "Aceptar diciendo que sí, pero ponerse tímida.",
          "consequence": "A Arturo le parece adorable su timidez. Acuerdan verse el próximo jueves en la panadería del barrio.",
          "next_scene_id": "c02-s09",
          "gds_mapping": [{ "item": 7, "weight": 0.6, "confidence": 0.7, "rationale": "ilusion_y_cautela" }],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s08-o3",
          "text": "Dudar un momento antes de decir que sí.",
          "consequence": "El vértigo de algo nuevo la asusta unos segundos, pero al final dice que sí. Sabe que las cosas buenas requieren valentía.",
          "next_scene_id": "c02-s09",
          "gds_mapping": [{ "item": 2, "weight": 0.7, "confidence": 0.8, "rationale": "abrirse_socialmente_venciendo_miedos" }],
          "phq_mapping": []
        }
      ]
    },
    {
      "scene_id": "c02-s09",
      "title": "Salió el sol",
      "hero_stage": "9_reward",
      "type": "narrated",
      "order": 9,
      "text": "La lluvia escampó rápido, dejando un arcoíris tenue encima de los techos rojos. <break time=\"400ms\"/> El grupo comenzó a secar las herramientas. <break time=\"300ms\"/> Rosa sentía que ese arcoíris saludaba su nuevo comienzo.",
      "options": [{
        "option_id": "c02-s09-o1", "text": "Continuar.", "consequence": "Guarda sus guantes canturreando por primera vez en años.", "next_scene_id": "c02-s10", "gds_mapping": [], "phq_mapping": []
      }]
    },
    {
      "scene_id": "c02-s10",
      "title": "Despedida prometedora",
      "hero_stage": "10_road_back",
      "type": "playable",
      "order": 10,
      "text": "A la hora de despedirse, Arturo se acerca nuevamente. <break time=\"300ms\"/> <prosody rate=\"90%\">\"Nos vemos mañana, mi querida Rosa.\"</prosody> le dice. <break time=\"500ms\"/> <prosody rate=\"85%\">¿Cómo se despide Rosa?</prosody>",
      "options": [
        {
          "option_id": "c02-s10-o1",
          "text": "Despedirse con la mano y desearle buena tarde.",
          "consequence": "Se despiden amigablemente. Rosa siente a lo largo de todo el camino a casa que no camina, sino que flota.",
          "next_scene_id": "c02-s11",
          "gds_mapping": [{ "item": 1, "weight": 0.8, "confidence": 0.9, "rationale": "satisfaccion_afectiva" }],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s10-o2",
          "text": "Regalarle una de las flores de su bancal.",
          "consequence": "Arturo se emociona por el detalle, la guarda en el bolsillo de su camisa y le guiña un ojo. Fue un momento mágico.",
          "next_scene_id": "c02-s11",
          "gds_mapping": [{ "item": 7, "weight": 0.9, "confidence": 0.95, "rationale": "generosidad_y_amor" }],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s10-o3",
          "text": "Decir \"hasta mañana\" con un pequeño abrazo.",
          "consequence": "Un abrazo corto pero muy dulce que les ilumina a ambos la tarde. Es la primera muestra física de afecto sincero.",
          "next_scene_id": "c02-s11",
          "gds_mapping": [{ "item": 5, "weight": 0.85, "confidence": 0.9, "rationale": "conexion_fisica_positiva" }],
          "phq_mapping": []
        }
      ]
    },
    {
      "scene_id": "c02-s11",
      "title": "El camino a casa",
      "hero_stage": "11_resurrection",
      "type": "playable",
      "order": 11,
      "text": "Rosa vuelve a su apartamento. <break time=\"400ms\"/> Entra, y en lugar del silencio opresivo de antaño, siente que la sala está llena de posibilidades. <break time=\"500ms\"/> <prosody rate=\"85%\">¿Qué hace al llegar?</prosody>",
      "options": [
        {
          "option_id": "c02-s11-o1",
          "text": "Llamar a su hija para contarle emocionada su día.",
          "consequence": "Su hija la escucha contentísima, alegrándose genuinamente de oír a su madre tan animada e ilusionada.",
          "next_scene_id": "c02-s12",
          "gds_mapping": [{ "item": 11, "weight": 0.9, "confidence": 0.9, "rationale": "compartir_alegria_vital" }],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s11-o2",
          "text": "Poner algo de música romántica y preparar la cena.",
          "consequence": "La música de boleros inunda la casa. Rosa baila un poco en la cocina, celebrando que el corazón no envejece.",
          "next_scene_id": "c02-s12",
          "gds_mapping": [{ "item": 13, "weight": 0.1, "confidence": 0.9, "rationale": "energia_vital_positiva_inversa" }],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s11-o3",
          "text": "Mirarse al espejo y acomodarse el cabello.",
          "consequence": "Se ve al espejo y reconoce a la mujer hermosa que siempre ha sido. La autoestima florece tan rápido como las albahacas.",
          "next_scene_id": "c02-s12",
          "gds_mapping": [{ "item": 14, "weight": 0.1, "confidence": 0.9, "rationale": "autoestima_y_esperanza_inversa" }],
          "phq_mapping": []
        }
      ]
    },
    {
      "scene_id": "c02-s12",
      "title": "Un nuevo futuro",
      "hero_stage": "12_return_with_elixir",
      "type": "playable",
      "order": 12,
      "text": "La noche cae sobre la ciudad. <break time=\"300ms\"/> Rosa se sirve una taza de té y se sienta en el balcón, mirando las estrellas. <break time=\"400ms\"/> Está feliz. La vida todavía le tenía preparadas grandes sorpresas. <break time=\"500ms\"/> <prosody rate=\"85%\">¿Qué pensamiento tiene antes de dormir?</prosody>",
      "options": [
        {
          "option_id": "c02-s12-o1",
          "text": "Agradecer por el día tan hermoso.",
          "consequence": "Duerme profundamente, soñando con rosas y cafés en buena compañía, ansiosa de que amanezca.",
          "next_scene_id": null,
          "next_chapter_id": "c03",
          "gds_mapping": [{ "item": 11, "weight": 0.95, "confidence": 0.95, "rationale": "gratitud_y_felicidad_plena" }],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s12-o2",
          "text": "Pensar en la poesía de don Arturo.",
          "consequence": "Vuelve a leer un poco antes de dormir, reconectando con esos placeres que había dejado olvidados.",
          "next_scene_id": null,
          "next_chapter_id": "c03",
          "gds_mapping": [{ "item": 2, "weight": 0.8, "confidence": 0.9, "rationale": "interes_recuperado" }],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s12-o3",
          "text": "Sentirse orgullosa de la mujer nueva que es.",
          "consequence": "El duelo por fin dio paso a la esperanza. Ahora tiene un jardín, amigos, y quién sabe, quizás una nueva gran historia de amor.",
          "next_scene_id": null,
          "next_chapter_id": "c03",
          "gds_mapping": [{ "item": 1, "weight": 0.9, "confidence": 0.95, "rationale": "satisfaccion_total" }],
          "phq_mapping": []
        }
      ]
    }
  ]
}

# Add c02
existingIndex = next((i for i, c in enumerate(data["chapters"]) if c["chapter_id"] == "c02"), -1)
if existingIndex != -1:
    data["chapters"][existingIndex] = c02
else:
    data["chapters"].append(c02)

with open(filepath, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Done")

