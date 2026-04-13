
const fs = require("fs");
const path = require("path");

const chaptersPath = path.join(__dirname, "chapters.json");
const data = JSON.parse(fs.readFileSync(chaptersPath, "utf8"));

const c02 = {
  "chapter_id": "c02",
  "title": "Reconstruyendo lazos",
  "order": 2,
  "scenes": [
    {
      "scene_id": "c02-s01",
      "title": "Mañana en el jardín",
      "hero_stage": "1_ordinary_world",
      "type": "playable",
      "order": 1,
      "text": "Es martes por la mañana. <break time=\"400ms\"/> El olor a tierra húmeda inunda el pequeño vivero comunitario. <break time=\"300ms\"/> Rosa acomoda unas macetas de albahaca cuando nota a Doña Esther, de setenta y dos años, mirando sus manos temblorosas frente a unos semilleros vacíos. <break time=\"500ms\"/> <prosody rate=\"85%\">¿Qué hace Rosa en este momento?</prosody>",
      "options": [
        {
          "option_id": "c02-s01-o1",
          "text": "Acercarse despacio y ofrecerle ayuda con los semilleros.",
          "consequence": "Rosa se aproxima y, sin decir mucho, toma un puñado de tierra. Esther suspira, aliviada de no tener que pedir auxilio, y comienzan a trabajar codo a codo en silencio.",
          "next_scene_id": "c02-s02",
          "gds_mapping": [
            { "item": 7, "weight": 0.8, "confidence": 0.9, "rationale": "iniciativa_social_activa" }
          ],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s01-o2",
          "text": "Saludarla desde lejos para no interrumpir su espacio.",
          "consequence": "Rosa alza la mano con un buenos días rápido. Esther asiente, pero sus hombros caen un poco. Se queda a solas con su frustración frente a las macetas.",
          "next_scene_id": "c02-s02",
          "gds_mapping": [
            { "item": 9, "weight": 0.4, "confidence": 0.7, "rationale": "evitacion_contacto_profundo" }
          ],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s01-o3",
          "text": "Seguir concentrada en sus albahacas, ignorando la situación.",
          "consequence": "Rosa aparta la mirada, centrada en lo suyo. El miedo a involucrarse de más la paraliza un momento, dejando a Esther lidiando sola con el temblor de sus manos.",
          "next_scene_id": "c02-s02",
          "gds_mapping": [
            { "item": 3, "weight": 0.6, "confidence": 0.85, "rationale": "aislamiento_emocional" }
          ],
          "phq_mapping": [
            { "item": 4, "weight": 0.5, "confidence": 0.75, "rationale": "falta_de_energia_social" }
          ]
        }
      ]
    },
    {
      "scene_id": "c02-s02",
      "title": "La petición inesperada",
      "hero_stage": "2_call_to_adventure",
      "type": "narrated",
      "order": 2,
      "text": "Poco después, se acerca Mateo, el coordinador del jardín. Es un muchacho de veintitantos, siempre con las botas manchadas de barro. <break time=\"300ms\"/> <prosody pitch=\"+3%\">\"Doña Rosa, necesitamos a alguien que guíe a los nuevos esta semana. ¿Le gustaría encargarse de Esther y el señor Julián?\"</prosody> <break time=\"400ms\"/> La propuesta queda flotando en el aire fresco de la mañana.",
      "options": [
        {
          "option_id": "c02-s02-o1",
          "text": "Continuar.",
          "consequence": "Rosa duda. Una cosa es cuidar plantas, otra muy distinta es hacerse responsable de enseñar a otros.",
          "next_scene_id": "c02-s03",
          "gds_mapping": [],
          "phq_mapping": []
        }
      ]
    },
    {
      "scene_id": "c02-s03",
      "title": "Reticencia interna",
      "hero_stage": "3_refusal_of_call",
      "type": "playable",
      "order": 3,
      "text": "El corazón de Rosa da un vuelco. <break time=\"400ms\"/> <emphasis level=\"moderate\">Enseñar implica paciencia</emphasis>, y hace años que siente que apenas tiene energía para ella misma. Mira a Julián, un hombre alto de ceño fruncido, y a Esther. <break time=\"500ms\"/> <prosody rate=\"90%\">¿Cómo responde a Mateo?</prosody>",
      "options": [
        {
          "option_id": "c02-s03-o1",
          "text": "Aceptar el reto, aunque con algo de nerviosismo.",
          "consequence": "Rosa asiente lentamente. \"Lo intentaré, Mateo\", dice. Sentir que alguien confía en ella le devuelve una chispa de propósito que creía apagada.",
          "next_scene_id": "c02-s04",
          "gds_mapping": [
            { "item": 5, "weight": 0.9, "confidence": 0.85, "rationale": "esperanza_y_proposito" }
          ],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s03-o2",
          "text": "Pedirle que sea otra persona, argumentando cansancio.",
          "consequence": "Mateo comprende y no insiste, pero la mirada de decepción en el rostro de Esther le pesa a Rosa como una piedra en el estómago durante el resto del día.",
          "next_scene_id": "c02-s04",
          "gds_mapping": [
            { "item": 13, "weight": 0.7, "confidence": 0.9, "rationale": "falta_de_energia" }
          ],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s03-o3",
          "text": "Sugerir que compartan la tarea entre varios veteranos.",
          "consequence": "Es un término medio. Mateo acepta que Rosa lo haga junto con Sofía. Esto alivia la presión inmediata, manteniendo la puerta abierta a la participación.",
          "next_scene_id": "c02-s04",
          "gds_mapping": [
            { "item": 7, "weight": 0.5, "confidence": 0.8, "rationale": "compromiso_con_precaucion" }
          ],
          "phq_mapping": []
        }
      ]
    },
    {
      "scene_id": "c02-s04",
      "title": "El empujón de Sofía",
      "hero_stage": "4_meeting_mentor",
      "type": "narrated",
      "order": 4,
      "text": "Sofía se acerca, secándose el sudor de la frente. <break time=\"300ms\"/> <prosody rate=\"90%\">\"Rosa, no te asustes. No se trata de dar clases de botánica, es solo conversar mientras movemos la tierra. Esther enviudó hace poco, lo sé por su sobrina.\"</prosody> <break time=\"500ms\"/> Ese dato cambia la perspectiva de Rosa de inmediato.",
      "options": [
        {
          "option_id": "c02-s04-o1",
          "text": "Continuar.",
          "consequence": "La palabra enviudó hace eco en su propia historia. Rosa entiende de pronto por qué a Esther le tiemblan las manos.",
          "next_scene_id": "c02-s05",
          "gds_mapping": [],
          "phq_mapping": []
        }
      ]
    },
    {
      "scene_id": "c02-s05",
      "title": "Aceptando el rol",
      "hero_stage": "5_crossing_threshold",
      "type": "playable",
      "order": 5,
      "text": "Rosa se dirige hacia la mesa de trabajo donde están Esther y Julián. <break time=\"400ms\"/> Tienen varios sobres de semillas mezclados y no saben por dónde empezar. <break time=\"500ms\"/> <prosody rate=\"85%\">¿Cómo inicia Rosa esta nueva etapa?</prosody>",
      "options": [
        {
          "option_id": "c02-s05-o1",
          "text": "Presentarse con calidez y contarles un poco de ella.",
          "consequence": "La apertura de Rosa rompe el hielo. Julián relaja el ceño y Esther sonríe por primera vez en toda la mañana. El ambiente se vuelve ligero.",
          "next_scene_id": "c02-s06",
          "gds_mapping": [
            { "item": 7, "weight": 0.8, "confidence": 0.9, "rationale": "apertura_social" }
          ],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s05-o2",
          "text": "Ir directo al grano y explicar cómo organizar las semillas.",
          "consequence": "Rosa es eficiente pero distante. Logran organizar las semillas rápido, aunque la conversación se mantiene estrictamente sobre jardinería.",
          "next_scene_id": "c02-s06",
          "gds_mapping": [
            { "item": 3, "weight": 0.4, "confidence": 0.7, "rationale": "relacion_funcional" }
          ],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s05-o3",
          "text": "Preguntarles en qué estaban teniendo problemas.",
          "consequence": "Al darles la palabra, Julián explica que no lee las letras pequeñas de los sobres. Rosa se da cuenta de que las barreras eran más simples de lo que creía.",
          "next_scene_id": "c02-s06",
          "gds_mapping": [
            { "item": 5, "weight": 0.6, "confidence": 0.85, "rationale": "empatia_activa" }
          ],
          "phq_mapping": []
        }
      ]
    },
    {
      "scene_id": "c02-s06",
      "title": "El roce con Julián",
      "hero_stage": "6_tests_allies_enemies",
      "type": "playable",
      "order": 6,
      "text": "A media mañana, <emphasis level=\"strong\">Julián tira por accidente una maceta</emphasis>, derramando tierra sobre los zapatos de Esther. <break time=\"400ms\"/> Él murmura una excusa ronca y se aparta, molesto consigo mismo. Esther se queda paralizada. <break time=\"500ms\"/> <prosody rate=\"85%\">¿Qué hace Rosa ante el incidente?</prosody>",
      "options": [
        {
          "option_id": "c02-s06-o1",
          "text": "Restarle importancia con una broma para calmar a ambos.",
          "consequence": "Rosa bromea diciendo que la tierra llama a la tierra. Esther suelta una carcajada nerviosa y Julián esboza una media sonrisa, regresando a ayudar.",
          "next_scene_id": "c02-s07",
          "gds_mapping": [
            { "item": 5, "weight": 0.7, "confidence": 0.9, "rationale": "manejo_positivo_estres" }
          ],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s06-o2",
          "text": "Llamar la atención a Julián por su torpeza.",
          "consequence": "Julián se ofende y murmura que él no sirve para estas cosas, alejándose del grupo por el resto del día. El ambiente queda tenso y frío.",
          "next_scene_id": "c02-s07",
          "gds_mapping": [
            { "item": 9, "weight": 0.6, "confidence": 0.8, "rationale": "irritabilidad_aislamiento" }
          ],
          "phq_mapping": [
            { "item": 3, "weight": 0.5, "confidence": 0.7, "rationale": "reaccion_hostil" }
          ]
        },
        {
          "option_id": "c02-s06-o3",
          "text": "Limpiar el desastre en silencio, sin decir nada a ninguno.",
          "consequence": "Rosa barre la tierra mientras los otros dos observan incómodos. Nadie resuelve el pequeño choque emocional, dejando una sensación de pesadez.",
          "next_scene_id": "c02-s07",
          "gds_mapping": [
            { "item": 1, "weight": 0.5, "confidence": 0.85, "rationale": "evitacion_del_conflicto_pasiva" }
          ],
          "phq_mapping": []
        }
      ]
    },
    {
      "scene_id": "c02-s07",
      "title": "La hora del té",
      "hero_stage": "7_approach_to_inmost_cave",
      "type": "narrated",
      "order": 7,
      "text": "Llega el receso del mediodía. <break time=\"300ms\"/> Mateo reparte vasos con té de manzanilla. <break time=\"400ms\"/> Rosa se sienta junto a Esther en una banqueta de madera bajo la sombra de un limonero. <break time=\"300ms\"/> <prosody rate=\"85%\">El murmullo de la calle queda lejos, amortiguado por las plantas.</prosody>",
      "options": [
        {
          "option_id": "c02-s07-o1",
          "text": "Continuar.",
          "consequence": "Esther sostiene el vaso tibio con ambas manos, mirando hacia la nada, como buscando valor para hablar.",
          "next_scene_id": "c02-s08",
          "gds_mapping": [],
          "phq_mapping": []
        }
      ]
    },
    {
      "scene_id": "c02-s08",
      "title": "La confesión de Esther",
      "hero_stage": "8_ordeal",
      "type": "playable",
      "order": 8,
      "text": "Esther voltea hacia Rosa, con los ojos brillosos. <break time=\"400ms\"/> <prosody rate=\"90%\">\"Mi marido cuidaba las plantas de casa. Desde que se fue, se me secaron todas. Yo no soy capaz de mantener vivo algo tan delicado\".</prosody> <break time=\"600ms\"/> La vulnerabilidad de su voz es cruda y directa.",
      "options": [
        {
          "option_id": "c02-s08-o1",
          "text": "Compartirle que a ella también le costó volver a empezar tras enviudar.",
          "consequence": "Rosa le cuenta lo difícil que fue para ella retomar la rutina. Esther llora en silencio, sintiéndose por fin comprendida por alguien que realmente sabe lo que duele.",
          "next_scene_id": "c02-s09",
          "gds_mapping": [
            { "item": 7, "weight": 0.9, "confidence": 0.95, "rationale": "conexion_emocional_profunda" }
          ],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s08-o2",
          "text": "Darle ánimos superficiales diciendo que las plantas de aquí crecerán bien.",
          "consequence": "Rosa intenta animarla rápido para cambiar de tema. Esther asiente con una sonrisa débil, pero cierra la puerta a seguir compartiendo sus emociones.",
          "next_scene_id": "c02-s09",
          "gds_mapping": [
            { "item": 3, "weight": 0.6, "confidence": 0.85, "rationale": "evitacion_vulnerabilidad" }
          ],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s08-o3",
          "text": "Quedarse callada, bajando la mirada hacia su vaso de té.",
          "consequence": "El silencio pesa. Rosa siente un nudo en la garganta al recordar su propia duelo, incapaz de articular palabra, dejando a Esther en soledad con su tristeza.",
          "next_scene_id": "c02-s09",
          "gds_mapping": [
            { "item": 1, "weight": 0.7, "confidence": 0.8, "rationale": "bloqueo_emocional_por_duelo" }
          ],
          "phq_mapping": [
            { "item": 2, "weight": 0.6, "confidence": 0.8, "rationale": "desesperanza_compartida" }
          ]
        }
      ]
    },
    {
      "scene_id": "c02-s09",
      "title": "La siembra de la esperanza",
      "hero_stage": "9_reward",
      "type": "narrated",
      "order": 9,
      "text": "Tras esa pausa, Rosa toma un pequeño brote de romero y se lo entrega a Esther. <break time=\"400ms\"/> <prosody rate=\"95%\">\"Las plantas perdonan. Si una se seca, plantamos otra\"</prosody>, le dice. <break time=\"500ms\"/> Juntas entierran el brote en una maceta nueva, afirmando la tierra con cuidado.",
      "options": [
        {
          "option_id": "c02-s09-o1",
          "text": "Continuar.",
          "consequence": "Esther mira la planta pequeña y por primera vez en la mañana, sus manos dejan de temblar tanto.",
          "next_scene_id": "c02-s10",
          "gds_mapping": [],
          "phq_mapping": []
        }
      ]
    },
    {
      "scene_id": "c02-s10",
      "title": "Despedida del jardín",
      "hero_stage": "10_road_back",
      "type": "playable",
      "order": 10,
      "text": "La jornada termina. <break time=\"300ms\"/> Mientras Rosa se limpia las manos, Julián se acerca con torpeza. <break time=\"400ms\"/> Trae una bolsa de tierra negra y se la ofrece. <prosody rate=\"90%\">\"Para sus plantas... en casa\",</prosody> murmura rápido, mirando al suelo.",
      "options": [
        {
          "option_id": "c02-s10-o1",
          "text": "Agradecerle cálidamente, valorando el gesto.",
          "consequence": "Rosa le sonríe y le da las gracias de verdad. Julián se marcha más rápido de lo habitual, pero Rosa nota que camina más erguido.",
          "next_scene_id": "c02-s11",
          "gds_mapping": [
            { "item": 5, "weight": 0.8, "confidence": 0.9, "rationale": "recepcion_positiva_afecto" }
          ],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s10-o2",
          "text": "Aceptar la bolsa rápidamente, sin hacer mucho caso.",
          "consequence": "Rosa murmura un gracias rutinario. Julián se va enseguida, dejando la sensación de que se perdió una oportunidad de conexión genuina.",
          "next_scene_id": "c02-s11",
          "gds_mapping": [
            { "item": 9, "weight": 0.4, "confidence": 0.7, "rationale": "indiferencia_social" }
          ],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s10-o3",
          "text": "Rechazarla amablemente, diciendo que ya tiene suficiente en casa.",
          "consequence": "Julián frunce el ceño, avergonzado, y se lleva la bolsa. Rosa siente al instante que cometió un error al no aceptar su pequeña ofrenda de paz.",
          "next_scene_id": "c02-s11",
          "gds_mapping": [
            { "item": 1, "weight": 0.6, "confidence": 0.8, "rationale": "rechazo_de_apoyo" }
          ],
          "phq_mapping": []
        }
      ]
    },
    {
      "scene_id": "c02-s11",
      "title": "El camino de vuelta",
      "hero_stage": "11_resurrection",
      "type": "playable",
      "order": 11,
      "text": "Rosa camina de regreso al apartamento. <break time=\"400ms\"/> El sol de la tarde ilumina las fachadas del barrio. <break time=\"300ms\"/> Siente un ligero dolor en la espalda baja por el esfuerzo, <emphasis level=\"moderate\">pero es un dolor bueno</emphasis>, un dolor de estar viva. <break time=\"500ms\"/> <prosody rate=\"85%\">Al pasar por la panadería, huele el pan recién horneado.</prosody>",
      "options": [
        {
          "option_id": "c02-s11-o1",
          "text": "Comprar pan dulce para ella y para Sofía, para celebrar el día.",
          "consequence": "Rosa entra animada. Sabe que Sofía apreciará el detalle. El simple acto de comprar algo para compartir le mejora el humor rotundamente.",
          "next_scene_id": "c02-s12",
          "gds_mapping": [
            { "item": 5, "weight": 1.0, "confidence": 0.95, "rationale": "estado_de_animo_elevado_prosocial" }
          ],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s11-o2",
          "text": "Ignorar la panadería y seguir directo a casa a descansar.",
          "consequence": "El cansancio físico gana. Rosa acelera el paso con ganas de encerrarse. La tarde se siente gris a pesar del sol.",
          "next_scene_id": "c02-s12",
          "gds_mapping": [
            { "item": 13, "weight": 0.6, "confidence": 0.85, "rationale": "priorizar_aislamiento_por_fatiga" }
          ],
          "phq_mapping": [
            { "item": 4, "weight": 0.5, "confidence": 0.8, "rationale": "fatiga_leve" }
          ]
        },
        {
          "option_id": "c02-s11-o3",
          "text": "Detenerse a mirar la vitrina, sintiendo que no merece un capricho.",
          "consequence": "Rosa suspira, convenciéndose de que no vale la pena el gasto. Retoma su camino con una leve sensación de pesadumbre irracional.",
          "next_scene_id": "c02-s12",
          "gds_mapping": [
            { "item": 11, "weight": 0.7, "confidence": 0.85, "rationale": "baja_autoestima_sensacion_de_no_merecer" }
          ],
          "phq_mapping": [
            { "item": 6, "weight": 0.6, "confidence": 0.9, "rationale": "culpa_o_desvalorizacion" }
          ]
        }
      ]
    },
    {
      "scene_id": "c02-s12",
      "title": "Cierre del día",
      "hero_stage": "12_return_with_elixir",
      "type": "playable",
      "order": 12,
      "text": "Ya en su apartamento, Rosa deja las llaves en la mesa. <break time=\"400ms\"/> Hay tierra bajo sus uñas, evidencia concreta de que el día no pasó en balde. <break time=\"500ms\"/> Piensa en Esther, en Julián y en el pequeño brote de romero. <break time=\"600ms\"/> <prosody rate=\"85%\">Frente al espejo del pasillo, Rosa reflexiona sobre su jornada.</prosody>",
      "options": [
        {
          "option_id": "c02-s12-o1",
          "text": "Sonreír a su reflejo, sabiendo que mañana volverá al jardín.",
          "consequence": "Rosa se lava las manos tarareando una canción vieja. Hay algo firme en su interior ahora: la certeza de que tiene un lugar al que pertenece.",
          "next_scene_id": null,
          "next_chapter_id": "c03",
          "gds_mapping": [
            { "item": 5, "weight": 0.9, "confidence": 0.95, "rationale": "vision_positiva_del_futuro_inmediato" },
            { "item": 11, "weight": 0.8, "confidence": 0.9, "rationale": "sensacion_de_utilidad" }
          ],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s12-o2",
          "text": "Sentir que hizo lo correcto, aunque mañana no esté segura de ir.",
          "consequence": "Se acuesta en el sofá. Hoy estuvo bien, pero la idea de tener que cumplir con ellos todos los días le genera un poco de ansiedad.",
          "next_scene_id": null,
          "next_chapter_id": "c03",
          "gds_mapping": [
            { "item": 15, "weight": 0.4, "confidence": 0.85, "rationale": "incertidumbre_leve_anticipatoria" }
          ],
          "phq_mapping": []
        },
        {
          "option_id": "c02-s12-o3",
          "text": "Dudar de si su presencia realmente le importa a alguien allí.",
          "consequence": "Rosa mira la foto de Alberto y siente que nadie podrá reemplazar ese vacío. Quizás el jardín es solo una distracción temporal y vacía.",
          "next_scene_id": null,
          "next_chapter_id": "c03",
          "gds_mapping": [
            { "item": 1, "weight": 0.8, "confidence": 0.9, "rationale": "insatisfaccion_vital_persistente" },
            { "item": 13, "weight": 0.7, "confidence": 0.85, "rationale": "desesperanza" }
          ],
          "phq_mapping": [
            { "item": 9, "weight": 0.2, "confidence": 0.8, "rationale": "vacío_existencial_riesgo_leve" }
          ]
        }
      ]
    }
  ]
};

// Check if chapter c02 exists
const existingIndex = data.chapters.findIndex(c => c.chapter_id === "c02");
if (existingIndex !== -1) {
  data.chapters[existingIndex] = c02;
} else {
  data.chapters.push(c02);
}

fs.writeFileSync(chaptersPath, JSON.stringify(data, null, 2), "utf8");
console.log("c02 appended successfully.");

