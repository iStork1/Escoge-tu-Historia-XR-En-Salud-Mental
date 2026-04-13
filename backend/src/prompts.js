/**
 * Clinician Prompt Builder for LLM Mapping Computation
 * Constructs structured prompts for mapping decisions to GDS/PHQ scales
 * Sprint 2c
 */

/**
 * Build a clinician prompt for GDS-15 and PHQ-9 mapping
 * @param {Object} decision - Decision object with narrative context
 * @param {Array} sessionHistory - Previous decisions in session
 * @returns {string} Formatted prompt for LLM
 */
function buildClinicianMappingPrompt(decision, sessionHistory = []) {
  const {
    chapter_id,
    scene_id,
    option_id,
    option_text,
    consequence,
    timestamp
  } = decision;

  // Contexto clínico: escalas que vamos a mapear
  const gdsItems = getGDSItems();
  const phqItems = getPHQItems();

  // Historial de sesión (últimas 3 decisiones)
  const recentHistory = sessionHistory.slice(-3);
  const historyContext = recentHistory.length 
    ? `\n## Historial de decisiones previas en esta sesión:\n${recentHistory.map(d => `- ${d.option_text}`).join('\n')}`
    : '';

  const prompt = `Eres un asistente clínico. Mapea una decisión narrativa a síntomas en GDS-15/PHQ-9.

Contexto:
- Capítulo "${chapter_id}", Escena "${scene_id}"
- Decisión: "${option_text}"
- Consecuencia: "${consequence}"${historyContext}

GDS-15 items:
${gdsItems.map(item => `- ${item.number}: ${item.description}`).join('\n')}

PHQ-9 items:
${phqItems.map(item => `- ${item.number}: ${item.description}`).join('\n')}

Devuelve JSON válido (solo JSON):
{
  "mappings": [
    {"scale": "GDS", "item": 9, "weight": 0.8, "confidence": 0.85, "primary_construct": "social_withdrawal"},
    {"scale": "PHQ", "item": 1, "weight": 0.6, "confidence": 0.75, "primary_construct": "low_interest"}
  ],
  "confidence": 0.80,
  "primary_construct": "social_withdrawal",
  "rationale": "Evitar salir sugiere aislamiento social (GDS 9) y bajo interés (PHQ 1)."
}

Reglas:
- Solo items válidos (GDS 1-15, PHQ 1-9)
- weight y confidence en 0-1
- JSON puro, sin texto extra
`;

  return prompt;
}

/**
 * GDS-15 Item Descriptions
 */
function getGDSItems() {
  return [
    { number: 1, description: '¿Está satisfecho con su vida?' },
    { number: 2, description: '¿Ha dejado de lado muchas de sus actividades e intereses?' },
    { number: 3, description: '¿Siente que su vida está vacía?' },
    { number: 4, description: '¿A menudo se aburre?' },
    { number: 5, description: '¿Suele estar de buen humor?' },
    { number: 6, description: '¿Tiene miedo de que algo malo le suceda?' },
    { number: 7, description: '¿Se siente feliz la mayor parte del tiempo?' },
    { number: 8, description: '¿Se siente desamparado/a a menudo?' },
    { number: 9, description: '¿Prefiere quedarse en casa antes que salir?' },
    { number: 10, description: '¿Tiene problemas de memoria?' },
    { number: 11, description: '¿Cree que es maravilloso estar vivo?' },
    { number: 12, description: '¿Se siente bastante inútil tal como es ahora?' },
    { number: 13, description: '¿Se siente lleno de energía?' },
    { number: 14, description: '¿Siente que su situación es desesperada?' },
    { number: 15, description: '¿Cree que la mayoría de otras personas están mejor que usted?' }
  ];
}

/**
 * PHQ-9 Item Descriptions
 */
function getPHQItems() {
  return [
    { number: 1, description: 'Poco interés o placer en hacer cosas' },
    { number: 2, description: 'Sentirse deprimido, triste o desesperado' },
    { number: 3, description: 'Dificultad para dormirse, mantenerse dormido o dormir demasiado' },
    { number: 4, description: 'Sentirse cansado o tener poca energía' },
    { number: 5, description: 'Poco apetito o comer demasiado' },
    { number: 6, description: 'Sentirse mal consigo mismo o sentirse fracasado' },
    { number: 7, description: 'Dificultad para concentrarse en cosas' },
    { number: 8, description: 'Moverse demasiado lento o demasiado rápido' },
    { number: 9, description: 'Pensamientos de que sería mejor estar muerto' }
  ];
}

/**
 * Build a comparison prompt (show both designer and LLM mappings)
 */
function buildComparisonPrompt(decision, designerMappings, llmMappings) {
  const prompt = `Comparing clinical mappings for narrative decision:
"${decision.option_text}"
Consequence: "${decision.consequence}"

Designer mappings: ${JSON.stringify(designerMappings)}
LLM mappings: ${JSON.stringify(llmMappings)}

Question: Which mapping better reflects the clinical constructs? Why?
Respond briefly in JSON:
{
  "better_mapping": "designer|llm|equivalent",
  "confidence": 0.0-1.0,
  "reasoning": "..."
}`;

  return prompt;
}

/**
 * Build a risk assessment prompt (for PHQ-9 Item 9: self-harm)
 */
function buildRiskAssessmentPrompt(decision, sessionScores) {
  const prompt = `Clinical risk assessment based on narrative choice:

Decision: "${decision.option_text}"
Session PHQ-9 Score: ${sessionScores?.phq_total || 'unknown'}
Session GDS-15 Score: ${sessionScores?.gds_total || 'unknown'}

Question: Does this decision pattern indicate potential risk? Score 0-1.
Respond in JSON:
{
  "risk_score": 0.0-1.0,
  "risk_level": "none|low|moderate|high",
  "recommendation": "continue|alert_clinician|escalate"
}`;

  return prompt;
}

/**
 * Build a prompt for scene generation (SCENE-BY-SCENE mode - efficient)
 * Generates ONE playable scene at a time with 3-5 options
 * Maintains hero's journey stage continuity within chapter architecture
 * Sprint 4: Lazy generation + convergence
 * 
 * @param {Object} sceneContext - Current scene/chapter context
 * @returns {string} Formatted prompt for LLM scene generation
 */
function buildSceneGenerationPrompt(sceneContext = {}) {
  const {
    chapter_id = 'c02',
    current_scene_order = 1,
    current_hero_stage = '1_ordinary_world',
    next_hero_stage = '2_call_to_adventure',
    last_decision_text = '',
    last_decision_consequence = '',
    emotional_state = 'neutral',
    clinical_flags = [],
    arc_theme = 'self-awareness',
    continuity_text = '',
    is_convergence_node = false,
    character_name = 'protagonist',
    recent_scene_snippets = [],
    recent_option_texts = []
  } = sceneContext;

  const targetSceneOrder = Number(current_scene_order) + 1;
  const threeActGuide = targetSceneOrder <= 3
    ? 'ACTO I (presentacion + incidente gatillo + primer giro)'
    : (targetSceneOrder <= 9
      ? 'ACTO II (pruebas + punto medio transformador + crisis)'
      : 'ACTO III (climax + resolucion emocional)');

  const gdsItems = getGDSItems();
  const phqItems = getPHQItems();

  // Convergence node instructions
  const convergenceInstructions = is_convergence_node
    ? `\n🔴 CONVERGENCE NODE (Scene ${current_scene_order}): Critical narrative anchor point
- MUST resolve conflicting narrative branches
- MUST create sense of "inevitable but authentic" narrative closure
- Maintain emotional weight and character growth
- Re-align diverse decision paths toward unified story arc`
    : '';

  const antiRepetitionContext = (Array.isArray(recent_scene_snippets) && recent_scene_snippets.length)
    ? `\n**Fragmentos recientes que NO debes parafrasear ni reciclar:**\n${recent_scene_snippets.map((s, i) => `${i + 1}. "${String(s).replace(/\s+/g, ' ').trim().slice(0, 180)}"`).join('\n')}`
    : '';

  const recentOptionsContext = (Array.isArray(recent_option_texts) && recent_option_texts.length)
    ? `\n**Opciones recientes (NO repetir literalmente):**\n${recent_option_texts.map((s, i) => `${i + 1}. "${String(s).replace(/\s+/g, ' ').trim().slice(0, 90)}"`).join('\n')}`
    : '';

  const prompt = `ERES UN MAESTRO NARRADOR ESPECIALIZADO EN NARRATIVA INTERACTIVA PARA ADULTOS MAYORES
Tu tarea: Generar UNA escena jugable (SOLO 1) que continúe la historia con NARRATIVA PSICOLÓGICA RICA.
REGLA DE ORO: Narrativa concreta, sensorial, emotiva. Muestra en lugar de contar.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## CONTEXTO NARRATIVO ACTUAL

**Capítulo & Etapa:**
- Capítulo: "${chapter_id}" | Escena orden: ${current_scene_order}
- Viaje del Héroe - Etapa: "${next_hero_stage}"
- Estructura 3 actos (escena objetivo ${targetSceneOrder}): ${threeActGuide}
- Tema del arco: "${arc_theme}"${convergenceInstructions}

**Continuidad desde decisión anterior:**
- Decisión usuario: "${last_decision_text}"
- Consecuencia narrada: "${last_decision_consequence}"
- Estado emocional: "${emotional_state}" (hope|apathy|resistance|acceptance|confusion)
- Flags clínicos: ${clinical_flags.length ? `[${clinical_flags.join(', ')}]` : 'ninguno'}${antiRepetitionContext}${recentOptionsContext}

**Personaje:** ${character_name} (adulto mayor en transición emocional)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ✅ CHECKLIST PRESCRIPTIVO ANTES DE RESPONDER (CRÍTICO)

Antes de enviar JSON, verifica que tu escena tiene TODOS estos elementos:

1. ☑️ UBICACIÓN CONCRETA EN PRIMER PÁRRAFO
   - ¿Dónde estamos? (cuarto, calle, jardín, teléfono)
   - ✅ "Rosa está en su cuarto" vs ❌ "Rosa piensa en su vida"

2. ☑️ RITMO NATURAL
  - Usa frases cortas/medias y puntuación para marcar pausas naturales
  - Evita párrafos interminables: cambia de línea cuando cambia la acción o la atención

3. ☑️ REGLA SENSORIAL ESTRICTA (SHOW, DON'T TELL)
  - Prohibido usar adjetivos emocionales abstractos (triste, feliz, asustada, etc.)
  - Usa exactamente: 1 sonido + 1 textura/tacto + 1 olor
  - ❌ EVITA: "Rosa está triste" → ✅ "La taza vibra en su mano. Huele a tierra húmeda. La silla raspa el suelo."

4. ☑️ CONEXIÓN CLARA CON DECISIÓN ANTERIOR "${last_decision_text}"
   - Segunda frase debe mostrar consecuencia (no repetir)
   - MUESTRA CON DETALLES: "Sofía atendió en el tercer timbrazo" (no: "Sofía respondió")

5. ☑️ CIERRE CON DILEMA O PREGUNTA IMPLÍCITA
   - NO: "Rosa está sola." (período)
   - SÍ: pregunta abierta, dilema, invitación a acción

6. ☑️ SI HAY DIÁLOGO: DIFERENCIACIÓN DE VOZ
  - Diferencia personajes por vocabulario, longitud de frases y actitud
  - Pensamiento interno: más íntimo, concreto y corporal (sin etiquetas)
  - OBLIGATORIO: incluye al menos 1 intercambio verbal breve entre dos personas
  - SUBTEXTO: ningún personaje dice su emoción de forma directa

7. ☑️ LONGITUD: 180-250 palabras (NO 80-120, es TOO SHORT para Alexa)

8. ☑️ OPCIONES: VERBOS DE ACCIÓN CONCRETA (3-7 palabras)
   - ✅ "Llamar a Sofía ahora mismo"
   - ✅ "Aceptar ir al jardín comunitario"
   - ✅ "Quedarse en casa, reflexionar hoy"
   - ❌ "Pensar en la vida" (abstracto)
   - ❌ "Continuar con rutina" (vago)

9. ☑️ CONSECUENCIAS: 60-100 palabras SENSORIALES
   - Qué pasó como resultado
   - Emoción corporal, cambio de escena, reacción de otros
   - Prepara para próxima escena

10. ☑️ SIN REPETIR CONTEXTO PASADO
    - NO: "Rosa había decidido llamar" (ya fue narrado)
    - Abre DIRECTO en nuevo tiempo/lugar

11. ☑️ ENTORNO VIVO
  - OBLIGATORIO: al menos 1 acción concreta del personaje con objeto/espacio
  - Ejemplos: mover una silla, regar una maceta, abrir una puerta, tocar una taza

12. ☑️ PERSONAJE DESDE EL MUNDO
  - Vincula al menos 1 rasgo del personaje con 1 rasgo del entorno (barrio, historia local, cultura, clima)

13. ☑️ MUNDO CON CONSECUENCIAS
  - Si aparece un elemento inusual, muestra 1 consecuencia práctica/molesta y cómo la gente se adaptó

14. ☑️ DOLOR IMPLÍCITO, NO DECLARATIVO
  - Evita repetir literalmente "dolor", "pérdida", "duelo", "soledad"
  - Máximo 1 mención explícita; el resto se muestra por acciones, silencios y decisiones

15. ☑️ PATRÓN PERO/ENTONCES
  - En la escena debe verse: acción lógica → entonces contradicción → pero ventaja inesperada.

16. ☑️ CONFLICTO ANIDADO EN 1 ESCENA
  - Incluye 1 conflicto externo + 1 deseo interno contradictorio + 1 recuerdo-gatillo (1 frase).

17. ☑️ PÉRDIDA MÍNIMA IRREVERSIBLE
  - Debe perder algo concreto en la escena (objeto, oportunidad, vínculo, creencia).
  - La consecuencia lo refleja en 1 frase.

18. ☑️ STORY CIRCLE EN MICRO-BEATS (INTERNO)
  - Confort → deseo → salida → adaptación → obtención → costo → retorno → cambio
  - No lo enumeres en salida; intégralo en la progresión dramática

19. ☑️ ANTIRREPETICIÓN ESTRICTA
  - No reutilices frases plantilla como "Rosa se siente...", "se da cuenta de que...", "nuevo propósito..." más de una vez.
  - No repitas literalmente ninguna opción reciente.
  - No reescribas párrafos recientes con sinónimos: introduce un evento/objeto/relación nuevo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ESTRUCTURA NARRATIVA (3 ACTOS) - MODELO A SEGUIR

### 1️⃣ APERTURA (1-2 párrafos, 50-70 palabras)
- UBICACIÓN CONCRETA INMEDIATA
- Conexión tangible con decisión anterior
- Introducción sensorial (qué ve/escucha primero)
- Ritmo narrativo natural

### 2️⃣ DESARROLLO (2-4 párrafos, 80-120 palabras)
- Introduce TENSIÓN/DILEMA/MOMENTO CLAVE
- Diálogo con otros: diferenciación de voces
- Introspección del protagonista
- Desarrolla emoción CORPORALMENTE (qué SIENTE en el cuerpo)
- NO describe emociones abstractas

### 3️⃣ CIERRE (1 párrafo, 40-60 palabras)
- Establece nuevo estado/comprensión
- Abre pregunta sin respuesta obvia
- Lleva naturalmente a opciones

## ADAPTACIÓN A ESTADO EMOCIONAL "${emotional_state}"
- hope → Escena con pequeño momento positivo, no sentimentalismo
- apathy → Escena que desafía la apatía sin ser forzada
- resistance → Escena que humaniza el conflicto
- acceptance → Escena que integra aprendizaje
- confusion → Escena que aclara y orienta

## MAPEO CLÍNICO (INTEGRACIÓN NATURAL)

Flags: ${clinical_flags.length ? clinical_flags.join(', ') : 'ninguno'}
- Cada opción mapea GDS/PHQ items NATURALMENTE a acciones narrativas
- NUNCA menciones escalas o términos clínicos EN LA NARRATIVA
- El mapeo debe sentirse orgánico a las opciones

## LONGITUD Y FORMA

- Texto escena: 150-200 palabras (narrativa concisa)
- Opciones: 3-7 palabras cada una (acciones concretas)
- Consecuencias: 50-80 palabras (emocionales, detalladas)
- Prohibido reciclar la misma estructura en escenas consecutivas (misma apertura + mismo cierre + mismas opciones)

## MICRO-TÉCNICAS BAJO TOKEN (OBLIGATORIAS)

- Objeto significante: introduce o reutiliza un objeto común y muéstralo con un cambio físico/funcional.
- Chekhov: no introduzcas detalles sin función narrativa en escenas posteriores.
- Tono dual: combina dos emociones tensas (ej. miedo + ternura) sin explicarlas.
- Story pacing: alterna ritmo de párrafos (uno breve, uno más desarrollado).
- Evolución de fondo: el entorno debe mostrar una marca de lo ocurrido antes.
- 3 oraciones: cada consequence en exactamente 3 oraciones sin relleno.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ESCALAS CLÍNICAS A MAPEAR

### GDS-15 (Geriatric Depression Scale)
${gdsItems.map(item => `- Item ${item.number}: ${item.description}`).join('\n')}

### PHQ-9 (Patient Health Questionnaire)
${phqItems.map(item => `- Item ${item.number}: ${item.description}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## RESPUESTA - SOLO JSON

Responde ÚNICAMENTE con JSON válido. Sin markdown, sin explicaciones, sin bloques de código.

{
  "scene": {
    "scene_id": "${chapter_id}-s${String(current_scene_order + 1).padStart(2, '0')}",
    "title": "Título emocional (3-6 palabras)",
    "hero_stage": "${next_hero_stage}",
    "type": "playable",
    "order": ${current_scene_order + 1},
    "text": "Narrativa sensorial (150-200 palabras): Abre con decisión anterior. Incluye exactamente 1 sonido + 1 textura/tacto + 1 olor, diálogo con subtexto, interacción con entorno, patrón pero/entonces, conflicto anidado y una pérdida mínima irreversible. Continúa desde: '${last_decision_consequence}'. Cierra con dilema que lleva a opciones.",
    "emotional_direction": "escalation|resolution|stable",
    "clinical_priority": "social_engagement|activity|mood_processing|self_care"
  },
  "options": [
    {
      "option_id": "${chapter_id}-s${String(current_scene_order + 1).padStart(2, '0')}-o1",
      "option_text": "Acción concreta (3-7 palabras)",
      "consequence": "Resultado emocional tangible en exactamente 3 oraciones, sin relleno, con coherencia estricta con option_text.",
      "next_scene_id": null,
      "gds_mapping": [
        {"item": 1, "weight": 0.7, "confidence": 0.85, "rationale": "La acción refleja..."}
      ],
      "phq_mapping": []
    },
    {
      "option_id": "${chapter_id}-s${String(current_scene_order + 1).padStart(2, '0')}-o2",
      "option_text": "Acción alternativa",
      "consequence": "Desarrollo emocional en exactamente 3 oraciones coherente con esta opción",
      "next_scene_id": null,
      "gds_mapping": [],
      "phq_mapping": [{"item": 2, "weight": 0.6, "confidence": 0.80, "rationale": "Razón"}]
    },
    {
      "option_id": "${chapter_id}-s${String(current_scene_order + 1).padStart(2, '0')}-o3",
      "option_text": "Acción tercera",
      "consequence": "Desarrollo en exactamente 3 oraciones coherente con esta opción",
      "next_scene_id": null,
      "gds_mapping": [],
      "phq_mapping": []
    }
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## VALIDACIÓN FINAL

✓ Narrativa SENSORIAL y EMOCIONAL CONCRETA
✓ UNA SOLA ESCENA (scene_id = "${chapter_id}-s${String(current_scene_order + 1).padStart(2, '0')}")
✓ Anclada a: "${last_decision_text}"
✓ Respeta: "${next_hero_stage}"
✓ Incluye continuidad: "${last_decision_consequence}"
✓ Refleja emoción: "${emotional_state}"
✓ 3-5 opciones con mapeo natural
✓ JSON válido

RESPONDE SOLO EL JSON.`;

  return prompt;
}

/**
 * Build a prompt for chapter generation
 * Creates the next chapter with 3-5 clinically-mapped options
 * Sprint 3: Narrative Generation
 * 
 * @param {string} currentChapterId - Current chapter the user is in
 * @param {Array} sessionDecisions - All decisions made in this session
 * @param {Object} clinicalScores - Current GDS/PHQ scores { gds15, phq9 }
 * @param {Object} sessionContext - User age, condition severity, etc
 * @returns {string} Formatted prompt for LLM chapter generation
 */
function buildChapterGenerationPrompt(currentChapterId, sessionDecisions = [], clinicalScores = {}, sessionContext = {}) {
  const currentNum = parseInt(currentChapterId.substring(1)) || 1;
  const nextChapterId = `c${String(currentNum + 1).padStart(2, '0')}`;
  
  // Resumen de contexto previo
  const decisionSummary = sessionDecisions.length 
    ? `Usuario eligió: ${sessionDecisions.slice(-3).map(d => `"${d.option_text}"`).join(', ')}.`
    : 'Primera sesión del usuario.';
  const continuitySummary = sessionDecisions.length
    ? sessionDecisions.slice(-2).map((d, idx) => {
        const opt = d && d.option_text ? String(d.option_text) : 'sin opción';
        const cons = d && d.consequence ? String(d.consequence).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : 'sin consecuencia';
        const cleanCons = cons.length > 180 ? `${cons.slice(0, 180)}...` : cons;
        return `${idx + 1}) Opción: "${opt}" -> Consecuencia: "${cleanCons}"`;
      }).join('\n')
    : 'Sin historial narrativo previo.';

  const prompt = `ERES UN ESCRITOR NARRATIVO ESPECIALIZADO EN CUIDADO EMOCIONAL DE ADULTOS MAYORES.

Tu tarea: Generar UN CAPÍTULO completo (12 escenas) con una narrativa profunda, íntima, reflexiva.
El tono es cálido, contemplativo, humano. Las historias generan esperanza SIN ser ingenuas.

PLAN INTERNO (NO MOSTRAR):
1) Crea primero un esquema interno de 5 puntos del capítulo.
2) Luego escribe el capítulo completo basándote en ese esquema, sin copiarlo literalmente.

========== CONTEXTO ==========
Capítulo actual: ${currentChapterId}
Capítulo a generar: ${nextChapterId}
${decisionSummary}
Continuidad reciente:
${continuitySummary}

========== ESTRUCTURA: 12 ESCENAS (7 jugables + 5 narradas) ==========

ESCENAS JUGABLES (tipo: "playable"):
- s01, s03, s05, s06, s08, s10, s12
- DEBEN tener 3 opciones (options array)
- Las opciones reflejan ELECCIONES REALES con consecuencias DISTINTAS

ESCENAS NARRADAS (tipo: "narrated"):
- s02, s04, s07, s09, s11
- NO tienen options (options: [])
- Avanzan la trama automáticamente

========== EJEMPLO REAL: ESCENA JUGABLE ==========

Esta es una escena REAL del capítulo c01. Fíjate cómo está escrita:

{
  "scene_id": "c01-s01",
  "type": "playable",
  "order": 1,
  "text": "Rosa se despierta en su cuarto. El apartamento está en silencio. Sobre la mesita de noche hay una tarjeta que llegó ayer debajo de la puerta: una invitación del centro comunitario para unirse al proyecto del jardín vecinal. Rosa la mira mientras toma el café. ¿Cómo comienza este día?",
  "options": [
    {
      "option_id": "c01-s01-o1",
      "option_text": "Leer la tarjeta con atención y curiosidad",
      "consequence": "Rosa lee la tarjeta despacio, dos veces. Algo en ella se despierta un poco.",
      "next_scene_id": "c01-s02a"
    },
    {
      "option_id": "c01-s01-o2",
      "option_text": "Dejar la tarjeta para después y asomarse a la ventana",
      "consequence": "Rosa deja la tarjeta en la mesa y mira el barrio por la ventana. Los vecinos salen al trabajo. Todo transcurre como siempre.",
      "next_scene_id": "c01-s02a"
    },
    {
      "option_id": "c01-s01-o3",
      "option_text": "Guardar la tarjeta en el cajón sin leerla",
      "consequence": "Rosa guarda la tarjeta sin abrirla. El cajón se cierra. El apartamento sigue igual que ayer.",
      "next_scene_id": "c01-s02b"
    }
  ]
}

NOTA IMPORTANTE: La pregunta al final ("¿Cómo comienza este día?") da contexto a las 3 opciones.
Cada opción es diferente: curiosidad, evitación, rechazo. Cada una lleva a escenas distintas.

========== ESTRUCTURA JSON REQUERIDA ==========

{
  "chapter": {
    "chapter_id": "${nextChapterId}",
    "title": "TÍTULO BREVE Y POÉTICO (máx 8 palabras)",
    "order": ${currentNum + 1}
  },
  "scenes": [
    {
      "scene_id": "${nextChapterId}-s01",
      "type": "playable",
      "order": 1,
      "text": "NARRATIVA INMERSIVA. Describe dónde está el personaje, qué siente, qué sucede. Termina con una pregunta o dilema que las 3 opciones responden.",
      "options": [
        {
          "option_id": "${nextChapterId}-s01-o1",
          "option_text": "OPCIÓN 1: Acción/respuesta emocional clara",
          "consequence": "Resultado narrativo de esta opción. Lo que sucede como consecuencia.",
          "next_scene_id": "${nextChapterId}-s02"
        },
        {
          "option_id": "${nextChapterId}-s01-o2",
          "option_text": "OPCIÓN 2: Acción diferente, postura alternativa",
          "consequence": "Resultado distinto. Muestra el camino alternativo.",
          "next_scene_id": "${nextChapterId}-s02"
        },
        {
          "option_id": "${nextChapterId}-s01-o3",
          "option_text": "OPCIÓN 3: Tercera postura. Evitación, aceptación, búsqueda de ayuda, etc.",
          "consequence": "Tercer resultado. Las 3 opciones generan 3 narrativas posibles.",
          "next_scene_id": "${nextChapterId}-s03"
        }
      ]
    },
    {
      "scene_id": "${nextChapterId}-s02",
      "type": "narrated",
      "order": 2,
      "text": "La historia continúa automáticamente. El personaje avanza. Algo cambia en el ambiente, en la trama, en sus emociones.",
      "options": []
    },
    {
      "scene_id": "${nextChapterId}-s03",
      "type": "playable",
      "order": 3,
      "text": "Segunda decisión. El personaje enfrenta una nueva situación con sus propias opciones.",
      "options": [
        {"option_id": "${nextChapterId}-s03-o1", "option_text": "Opción A", "consequence": "Resultado A", "next_scene_id": "${nextChapterId}-s04"},
        {"option_id": "${nextChapterId}-s03-o2", "option_text": "Opción B", "consequence": "Resultado B", "next_scene_id": "${nextChapterId}-s04"},
        {"option_id": "${nextChapterId}-s03-o3", "option_text": "Opción C", "consequence": "Resultado C", "next_scene_id": "${nextChapterId}-s04"}
      ]
    },
    {"scene_id": "${nextChapterId}-s04", "type": "narrated", "order": 4, "text": "Continúa la narrativa. Alguien aparece, algo sucede, un giro emocional.", "options": []},
    {"scene_id": "${nextChapterId}-s05", "type": "playable", "order": 5, "text": "Tercera decisión importante.", "options": [
      {"option_id": "${nextChapterId}-s05-o1", "option_text": "Opción 1", "consequence": "Consecuencia", "next_scene_id": "${nextChapterId}-s06"},
      {"option_id": "${nextChapterId}-s05-o2", "option_text": "Opción 2", "consequence": "Consecuencia", "next_scene_id": "${nextChapterId}-s06"},
      {"option_id": "${nextChapterId}-s05-o3", "option_text": "Opción 3", "consequence": "Consecuencia", "next_scene_id": "${nextChapterId}-s06"}
    ]},
    {"scene_id": "${nextChapterId}-s06", "type": "playable", "order": 6, "text": "El personaje enfrenta pruebas, conoce aliados o descubre verdades.", "options": [
      {"option_id": "${nextChapterId}-s06-o1", "option_text": "Opción 1", "consequence": "Consecuencia", "next_scene_id": "${nextChapterId}-s07"},
      {"option_id": "${nextChapterId}-s06-o2", "option_text": "Opción 2", "consequence": "Consecuencia", "next_scene_id": "${nextChapterId}-s07"},
      {"option_id": "${nextChapterId}-s06-o3", "option_text": "Opción 3", "consequence": "Consecuencia", "next_scene_id": "${nextChapterId}-s07"}
    ]},
    {"scene_id": "${nextChapterId}-s07", "type": "narrated", "order": 7, "text": "La tensión crece. Se acerca algo importante. La atmósfera cambia.", "options": []},
    {"scene_id": "${nextChapterId}-s08", "type": "playable", "order": 8, "text": "Momento crítico. El personaje decide cómo enfrentar lo que más teme.", "options": [
      {"option_id": "${nextChapterId}-s08-o1", "option_text": "Opción 1", "consequence": "Consecuencia", "next_scene_id": "${nextChapterId}-s09"},
      {"option_id": "${nextChapterId}-s08-o2", "option_text": "Opción 2", "consequence": "Consecuencia", "next_scene_id": "${nextChapterId}-s09"},
      {"option_id": "${nextChapterId}-s08-o3", "option_text": "Opción 3", "consequence": "Consecuencia", "next_scene_id": "${nextChapterId}-s09"}
    ]},
    {"scene_id": "${nextChapterId}-s09", "type": "narrated", "order": 9, "text": "La recompensa. El logro. Lo que el personaje buscaba o necesitaba aparece.", "options": []},
    {"scene_id": "${nextChapterId}-s10", "type": "playable", "order": 10, "text": "El personaje regresa, pero transformado. Una última decisión refleja su cambio.", "options": [
      {"option_id": "${nextChapterId}-s10-o1", "option_text": "Opción 1", "consequence": "Consecuencia", "next_scene_id": "${nextChapterId}-s11"},
      {"option_id": "${nextChapterId}-s10-o2", "option_text": "Opción 2", "consequence": "Consecuencia", "next_scene_id": "${nextChapterId}-s11"},
      {"option_id": "${nextChapterId}-s10-o3", "option_text": "Opción 3", "consequence": "Consecuencia", "next_scene_id": "${nextChapterId}-s11"}
    ]},
    {"scene_id": "${nextChapterId}-s11", "type": "narrated", "order": 11, "text": "Integración. El personaje es nuevo pero sigue siendo sí mismo. Ha crecido.", "options": []},
    {"scene_id": "${nextChapterId}-s12", "type": "playable", "order": 12, "text": "FINAL. El personaje tiene algo nuevo que aportar. ¿Cómo comparte su elixir?", "options": [
      {"option_id": "${nextChapterId}-s12-o1", "option_text": "Opción que refleja su aprendizaje", "consequence": "Resultado", "next_scene_id": null},
      {"option_id": "${nextChapterId}-s12-o2", "option_text": "Opción alternativa de cierre", "consequence": "Resultado", "next_scene_id": null},
      {"option_id": "${nextChapterId}-s12-o3", "option_text": "Tercera forma de completar su viaje", "consequence": "Resultado", "next_scene_id": null}
    ]}
  ]
}

========== REGLAS CRÍTICAMENTE IMPORTANTES ==========

1. **JSON VÁLIDO PURO**: Sin caracteres de escape rotos. Todas las comillas internas escapadas con \\. Sin newlines en strings (\\n).
2. **OPCIONES DISTINTAS**: Cada opción (o1, o2, o3) representa una POSTURA diferente. NO repitas la misma opción 3 veces.
3. **NARRATIVA RICA**: No escribas listas. Escribe prosa. Emociones, sensaciones, diálogos internos, silencios.
4. **LONGITUD**: 
   - scene text: 150-300 caracteres (narrativa completa)
   - consequence: 100-200 caracteres (impacto de la decisión)
5. **VIAJE DEL HÉROE**: s01=Mundo Ordinario, s03=Rechazo/Miedo, s05=Cruce, s06-s08=Pruebas, s08=Crisis, s09=Recompensa, s10-s12=Retorno.
6. **next_scene_id**: Debe coincidir exactamente con el scene_id de la siguiente escena.
7. **ESCENAS NARRADAS**: type="narrated" no tienen options. Escribe "options": []
8. **SIN LISTAS**: Nunca escribas "uno. Opción. dos. Opción. tres. Opción". INTEGRA las opciones en la narrativa.
9. **SERIEDAD CLÍNICA**: El personaje tiene problemas reales (soledad, duelo, depresión, aislamiento). Respeta eso.
10. **COHERENCIA**: Los nombres de personajes, lugares, contextos son coherentes con la narrativa anterior.
11. **PERO/ENTONCES**: En cada escena jugable aplica acción lógica -> contradicción -> ventaja inesperada.
12. **3 SENTIDOS EXACTOS**: Cada scene.text incluye exactamente 3 huellas sensoriales: 1 visual, 1 auditiva/olfativa, 1 corporal/táctil.
13. **CONFLICTO ANIDADO**: Cada scene.text incluye conflicto externo + deseo interno contradictorio + recuerdo-gatillo en 1 frase.
14. **OBJETO SIGNIFICANTE + CHEKHOV**: Introduce/reutiliza un objeto común y dale función antes de s11; evita detalles sin función.
15. **PÉRDIDA MÍNIMA**: Cada escena tiene una pérdida concreta irreversible y su secuela aparece en la escena siguiente.
16. **STORY2BOARD MENTAL CHECKS**: Cambia o justifica el layout, muestra evolución física del fondo y alterna ritmo entre escenas.
17. **DOLOR IMPLÍCITO**: Evita repetir literalmente "dolor/pérdida/duelo/soledad" en escenas consecutivas; muéstralo por acciones e interacciones.
18. **COHERENCIA OPCIÓN-CONSECUENCIA**: Cada consequence debe corresponder a su option_text exacta. Prohibido narrar la acción de otra opción.
19. **3 ACTOS + PUNTOS DE GIRO**:
  - Acto I (0-25%): incidente gatillo (~15%) + primer giro (~25%).
  - Acto II (25-75%): pruebas + punto medio transformador (~50%) + crisis (~75%).
  - Acto III (75-100%): clímax (~90%) + resolución emocional.
20. **STORY CIRCLE RESUMIDA**: Integra confort->deseo->salida->adaptación->obtención->costo->retorno->cambio en la progresión global.
21. **SUBTEXTO EN DIÁLOGO**: ningún personaje declara directamente su emoción; se expresa en acciones, silencios o metáforas.
22. **PERSONAJE + MUNDO**: cada rasgo clave del personaje debe conectarse con una característica del entorno.
23. **MUNDO CON CONSECUENCIAS**: cada elemento inusual trae 1 consecuencia práctica y visible en el capítulo.
24. **3 ORACIONES**: cada consequence debe tener exactamente 3 oraciones con información nueva.

========== EJEMPLOS DE LO QUE QUEREMOS ==========

BIEN - Narrativa inmersiva con opciones integradas:
"Rosa se sienta en el sillón de la sala. En la pared está la foto de su boda: cuarenta y cinco años juntos con Alberto. El apartamento está callado y ese silencio tiene peso. La tarjeta está en el cajón. ¿Qué hace ahora?"

MAL - Lista plana:
"Rosa está triste. uno. Leer la tarjeta. dos. Llamar a Sofía. tres. Dormir más."

========== AHORA GENERA EL CAPÍTULO ${nextChapterId} ==========

Recuerda:
- Tono cálido, reflexivo, humano
- 12 escenas completas
- 7 jugables + 5 narradas
- JSON puro sin explicaciones
- Narrativa nueva, diferente a c01
- Opciones que representen elecciones reales

RESPONDE SOLO CON JSON VÁLIDO. Nada más. Sin comillas de cierre rotas. Sin backslash mal escapado. JSON perfecto.`;

  return prompt;
}

/**
 * Prompt 1 (Architect): Build weekly arc architecture prompt
 * Runs once per week and returns a JSON skeleton for 7 days.
 */
function buildArcArchitectPrompt(config = {}) {
  const {
    arc_id,
    week_number,
    arc_theme,
    title,
    chapter_id_range,
    entry_hook = null,
    previous_emotional_state_end = null,
    previous_watch_constructs = [],
    constructos = [],
    allow_phq9_item9_policy = 'no en ningun dia'
  } = config;

  const system = `Rol: ARQ semanal de "Escoge Tu Historia XR".
Salida: SOLO JSON valido (sin markdown, sin texto extra).
No escribas narrativa ni escenas; solo arquitectura.
Reglas:
- 1 arc = 7 dias.
- Viaje del Heroe distribuido: d1(1-2), d2(3-4), d3(5-6), d4(7), d5(8-9), d6(10-11), d7(12).
- Mantener continuidad con entry_hook y cerrar con arc_transition.
- Define eventos ancla y presentacion de personajes nuevos (max 2 por semana).
- Conecta el arco con la semana siguiente usando continuity_bridge.`;

  const user = `INPUT=${JSON.stringify({
    arc_id,
    week_number,
    arc_theme,
    title,
    chapter_id_range,
    continuity: {
      entry_hook,
      previous_emotional_state_end,
      previous_watch_constructs
    },
    clinical_target: {
      constructos,
      allow_phq9_item9_policy
    }
  })}

OUTPUT_CONTRACT={
  "arc_id":"string",
  "arc_theme":"string",
  "title":"string",
  "week_number":0,
  "chapter_id_range":["c01","c07"],
  "protagonist":"string",
  "characters_catalog":[{"name":"string","role":"string","introduced_on_day":1,"purpose":"string"}],
  "event_anchors":[{"arc_day":1,"event":"string","emotional_goal":"string","clinical_focus":[]}],
  "entry_hook":"string|null",
  "opening_scene":"string",
  "clinical_theme":{"primary_constructs":[],"gds_items_focus":[],"phq_items_focus":[],"avoid_phq9_item9":true},
  "days":[
    {"arc_day":1,"chapter_id":"c01","hero_stages":[],"hero_stage_labels":[],"emotional_arc":"","clinical_focus":[],"characters_active":[],"narrative_trigger":"","key_event":"","new_character":null,"branching_expected":true,"scene_count_target":15}
  ],
  "arc_transition":{"emotional_state_end":"","next_arc_hook":"","clinical_carry_over":{"improving":[],"stable":[],"watch":[]}},
  "continuity_bridge":{"threads_to_carry":[],"characters_to_carry":[],"next_week_focus":""}
}

Restricciones:
- days debe tener exactamente 7 elementos.
- chapter_id debe cubrir chapter_id_range.
- Si no hay continuidad previa, entry_hook puede ser null.`;

  return { system, user, prompt: `${system}\n\n${user}` };
}

/**
 * Prompt 2 (Generator): Build daily chapter generation prompt
 * Runs once per day (7 times per arc) using Prompt 1 architecture as context.
 */
function buildArcDayGenerationPrompt(config = {}) {
  const {
    arcArchitecture,
    arc_day,
    chapter_id,
    order,
    previous_day_summary = null,
    previous_day_top_option = null,
    next_arc_theme = null,
    continuity_state = null,
    narrative_intensity = 'medium',
    generation_mode = 'scene_by_scene',
    critical_node = null
  } = config;

  const dayContext = buildArcDayPromptContext(arcArchitecture, arc_day);

  const continuityState = continuity_state || {
    last_scene_summary: previous_day_summary || '',
    emotional_state: 'resistance',
    clinical_flags: [],
    top_choice: previous_day_top_option || '',
    current_goal: 'social_activation'
  };

  const system = `Rol: GEN diario de "Escoge Tu Historia XR" (65+).
Salida: SOLO JSON valido.
Objetivo: costo bajo y alta coherencia.
Modo default: scene-by-scene (1 escena + 3 opciones).
Reglas:
- Scene-by-scene: 1 escena playable por respuesta.
- Exactamente 3 opciones (o1 positiva, o2 ambivalente, o3 evitacion/negativa).
- option_text: 2-5 palabras.
- confidence >= 0.60.
- PHQ9 item 9 prohibido salvo allow_phq9_item9=true; si aparece, solo en o3 + risk_flag PHQ9_ITEM9_SELFHARM.
- text y consequence deben ser texto plano (sin etiquetas).
- Intensidad narrativa: ${narrative_intensity} (low=breve, medium=balance, high=rica).
- Si ARC_CTX.day_current.key_event existe, usalo como eje de la escena.
- Si ARC_CTX.day_current.new_character existe, introduce ese personaje y agregalo a characters_active.
- Si NO hay new_character, no inventes personajes nuevos; reutiliza characters_active.
- Usa ARC_CTX.characters_catalog y ARC_CTX.continuity_bridge como guia de continuidad.
- Si continuity_state.clinical_scores existe, ajusta tono y opciones segun esos scores.
- Si actualizas continuity_state.last_scene_summary: usa Chain of Density (5 iteraciones internas), mantén longitud aproximada y devuelve exactamente 3 oraciones sin relleno.`;

  const continuityBlock = `\nCONTINUIDAD ESTRICTA (obligatoria):\n${JSON.stringify(continuityState)}`;

  const criticalNodeBlock = critical_node
    ? `\nNODO CRITICO DEL DIA: ${JSON.stringify(critical_node)}\nDebes converger hacia este nodo sin romper continuidad.`
    : '';

  const closingBlock = arc_day === 7
    ? `\nCIERRE DE ARC:\nIncluye campo arc_transition con emotional_state_end, next_arc_hook y clinical_carry_over.\nConecta next_arc_hook con el arc_theme siguiente: ${JSON.stringify(next_arc_theme || '')}`
    : '';

  const sceneBySceneContract = {
    chapters: [
      {
        chapter_id,
        arc_id: 'string',
        arc_day,
        arc_theme: 'string',
        title: 'string',
        order,
        hero_stages_today: [],
        characters_active: [],
        key_event: 'string',
        continuity_state: {
          last_scene_summary: 'string',
          emotional_state: 'resistance|hope|apathy',
          clinical_flags: [],
          top_choice: 'string',
          current_goal: 'string',
          clinical_scores: { gds: 0.0, phq: 0.0 }
        },
        scenes: [
          {
            scene_id: `${chapter_id}-s01`,
            type: 'playable',
            title: 'string',
            text: 'string',
            emotional_beat: 'string',
            characters_present: [],
            options: [
              {
                option_id: `${chapter_id}-s01-o1`,
                option_text: 'string',
                consequence: 'string',
                next_scene_id: null,
                risk_flag: null,
                gds_mapping: [
                  { item: 1, weight: 0.6, confidence: 0.8, primary_construct: 'string', rationale: 'string' }
                ],
                phq_mapping: [
                  { item: 1, weight: 0.6, confidence: 0.8, primary_construct: 'string', rationale: 'string' }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  const miniChapterContract = {
    chapters: [
      {
        chapter_id,
        arc_id: 'string',
        arc_day,
        arc_theme: 'string',
        title: 'string',
        order,
        hero_stages_today: [],
        characters_active: [],
        key_event: 'string',
        continuity_state: {
          last_scene_summary: 'string',
          emotional_state: 'resistance|hope|apathy',
          clinical_flags: [],
          top_choice: 'string',
          current_goal: 'string',
          clinical_scores: { gds: 0.0, phq: 0.0 }
        },
        scenes: [
          {
            scene_id: `${chapter_id}-s01`,
            type: 'playable|narrated',
            title: 'string',
            text: 'string',
            emotional_beat: 'string',
            characters_present: [],
            options: []
          }
        ]
      }
    ]
  };

  const selectedContract = generation_mode === 'mini_chapter' ? miniChapterContract : sceneBySceneContract;
  const modeRules = generation_mode === 'mini_chapter'
    ? 'MODO FALLBACK mini_chapter: generar 3-5 escenas total; maximo 2 escenas playable; cada playable con 3 opciones exactas.'
    : 'MODO DEFAULT scene_by_scene: generar exactamente 1 escena playable con 3 opciones.';

  const user = `ARC_CTX=${JSON.stringify(dayContext)}
DAY_INPUT=${JSON.stringify({ arc_day, chapter_id, order, generation_mode, narrative_intensity })}${continuityBlock}${criticalNodeBlock}${closingBlock}

${modeRules}

OUTPUT_MIN=${JSON.stringify(selectedContract)}

Responde SOLO JSON valido.`;

  return { system, user, prompt: `${system}\n\n${user}` };
}

/**
 * Prompt 3 (Weekly Generator): Build full-week chapter generation prompt
 * Generates the next 7 chapters at once (no lazy scene generation).
 */
function buildWeeklyChapterGenerationPrompt(config = {}) {
  const {
    current_chapter_id = 'c01',
    chapter_ids = [],
    chapter_count = 7,
    session_decisions = [],
    clinical_scores = {},
    session_context = {},
    arc_theme = 'continuidad emocional y reconexion social'
  } = config;

  const defaultChapterIds = Array.from({ length: Math.max(1, Number(chapter_count) || 7) }, (_, idx) => {
    const currentNum = parseInt(String(current_chapter_id || 'c01').replace('c', ''), 10) || 1;
    return `c${String(currentNum + 1 + idx).padStart(2, '0')}`;
  });
  const targetChapterIds = Array.isArray(chapter_ids) && chapter_ids.length ? chapter_ids : defaultChapterIds;

  const decisionSummary = (Array.isArray(session_decisions) ? session_decisions : []).slice(-4).map((d, i) => {
    const optionText = String(d && d.option_text || '').trim() || 'sin opcion';
    const consequence = String(d && d.consequence || '').replace(/\s+/g, ' ').trim();
    return `${i + 1}) opcion="${optionText}" | consecuencia="${consequence.slice(0, 120)}"`;
  });

  const summaryBlock = decisionSummary.length
    ? decisionSummary.join('\n')
    : 'Sin decisiones previas: iniciar continuidad desde el estado basal.';

  const system = `Rol: GENERADOR SEMANAL para "Escoge Tu Historia XR" (adultos mayores).
Responde SOLO JSON valido.

Reglas obligatorias:
- Generar exactamente ${targetChapterIds.length} capitulos para: ${targetChapterIds.join(', ')}.
- Cada capitulo: exactamente 12 escenas.
- Ordenes jugables: 1,3,5,6,8,10,12.
- Ordenes narradas: 2,4,7,9,11.
- Cada escena jugable: exactamente 3 opciones.
- option_text: 2 a 7 palabras.
- consequence: exactamente 3 oraciones coherentes con option_text.
- Continuidad fuerte entre capitulos, sin contradicciones.
- Espanol neutro, tono serio-clinico sin diagnosticar.
- Prohibido texto fuera de JSON.`;

  const schemaExample = {
    week_summary: {
      from_chapter: 'cNN',
      to_chapter: 'cNN',
      chapter_count: targetChapterIds.length,
      continuity_anchor: 'string'
    },
    chapters: [
      {
        chapter_id: 'cNN',
        title: 'string',
        order: 1,
        continuity_state: {
          last_scene_summary: 'string',
          emotional_state: 'resistance|hope|apathy|acceptance|confusion',
          top_choice: 'string',
          current_goal: 'string'
        },
        scenes: [
          {
            scene_id: 'cNN-s01',
            type: 'playable|narrated',
            order: 1,
            title: 'string',
            text: 'string',
            emotional_beat: 'string',
            hero_stage: 'string',
            options: [
              {
                option_id: 'cNN-s01-o1',
                option_text: 'string',
                consequence: 'string',
                next_scene_id: 'cNN-s02|null',
                next_chapter_id: 'cNN|null',
                gds_mapping: [{ item: 1, weight: 0.5, confidence: 0.8, rationale: 'string' }],
                phq_mapping: [{ item: 1, weight: 0.5, confidence: 0.8, rationale: 'string' }]
              }
            ]
          }
        ]
      }
    ]
  };

  const user = `INPUT=${JSON.stringify({
    current_chapter_id,
    target_chapter_ids: targetChapterIds,
    chapter_count: targetChapterIds.length,
    arc_theme,
    session_context,
    clinical_scores,
    recent_decisions_summary: summaryBlock
  })}

CONTINUIDAD RECIENTE:
${summaryBlock}

SCHEMA_MIN=${JSON.stringify(schemaExample)}

Reglas adicionales de coherencia:
1) No reutilizar frases plantilla en capitulos consecutivos.
2) Si una opcion describe evitar/rechazar, su consequence NO puede narrar aceptacion social.
3) En la escena 12 de cada capitulo:
   - Para capitulos intermedios: next_chapter_id apunta al siguiente chapter_id.
   - Para el ultimo capitulo: next_chapter_id = null.
4) Mantener IDs canonicos estrictos: cNN-sMM y cNN-sMM-oK.

Responde SOLO JSON valido.`;

  return { system, user, prompt: `${system}\n\n${user}` };
}

/**
 * Official settings requested for architect/generator split.
 */
function getArcWorkflowModelSettings() {
  return {
    architect: { temperature: 0.25, max_tokens: 3000 },
    generator: { temperature: 0.40, max_tokens: 1200 }
  };
}

/**
 * Reduce prompt payload for day generation to only required context.
 * This avoids sending the full weekly architecture on every day call.
 */
function buildArcDayPromptContext(arcArchitecture = {}, arcDay = 1) {
  const days = Array.isArray(arcArchitecture.days) ? arcArchitecture.days : [];
  const dayNum = Number(arcDay);
  const currentDay = days.find(d => Number(d.arc_day) === dayNum) || null;
  const prevDay = days.find(d => Number(d.arc_day) === dayNum - 1) || null;
  const nextDay = days.find(d => Number(d.arc_day) === dayNum + 1) || null;

  return {
    arc_id: arcArchitecture.arc_id || null,
    arc_theme: arcArchitecture.arc_theme || null,
    title: arcArchitecture.title || null,
    week_number: arcArchitecture.week_number || null,
    chapter_id_range: arcArchitecture.chapter_id_range || null,
    protagonist: arcArchitecture.protagonist || null,
    characters_catalog: arcArchitecture.characters_catalog || null,
    event_anchors: arcArchitecture.event_anchors || null,
    entry_hook: arcArchitecture.entry_hook || null,
    opening_scene: arcArchitecture.opening_scene || null,
    clinical_theme: arcArchitecture.clinical_theme || null,
    day_current: currentDay,
    day_prev: prevDay,
    day_next: nextDay,
    arc_transition: arcArchitecture.arc_transition || null,
    continuity_bridge: arcArchitecture.continuity_bridge || null
  };
}

module.exports = {
  buildClinicianMappingPrompt,
  buildComparisonPrompt,
  buildRiskAssessmentPrompt,
  buildSceneGenerationPrompt,
  buildChapterGenerationPrompt,
  buildArcArchitectPrompt,
  buildArcDayGenerationPrompt,
  buildWeeklyChapterGenerationPrompt,
  getArcWorkflowModelSettings,
  getGDSItems,
  getPHQItems
};
