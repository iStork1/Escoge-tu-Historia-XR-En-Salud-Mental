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

  const prompt = `Eres un asistente clínico especializado en psicología geriátrica y depresión en adultos. Tu tarea es mapear una decisión narrativa a síntomas en escalas clínicas validadas.

## Contexto del usuario
- Narrativa: Capítulo "${chapter_id}", Escena "${scene_id}"
- Decisión tomada: "${option_text}"
- Consecuencia en la historia: "${consequence}"${historyContext}

## Escalas Clínicas Disponibles

### GDS-15 (Geriatric Depression Scale - 15 items)
Medir depresión en adultos mayores. Items clave:
${gdsItems.map(item => `- Item ${item.number}: ${item.description}`).join('\n')}

### PHQ-9 (Patient Health Questionnaire - 9 items)
Medir depresión en adultos. Items clave:
${phqItems.map(item => `- Item ${item.number}: ${item.description}`).join('\n')}

## Tarea
Analiza la decisión narrativa. ¿Qué síntomas clínicos refleja? Proporciona un mapeo JSON con:
1. Items de GDS/PHQ que se alinean con la decisión
2. Peso (0-1) de cuán fuerte es la alineación
3. Confianza (0-1) en tu mapeo
4. Justificación clínica

## Formato esperado
Responde ÚNICAMENTE con JSON válido en este formato:
{
  "mappings": [
    {"scale": "GDS", "item": 7, "weight": 0.8, "confidence": 0.85, "primary_construct": "social_engagement"},
    {"scale": "PHQ", "item": 1, "weight": 0.6, "confidence": 0.75, "primary_construct": "depressed_mood"}
  ],
  "confidence": 0.80,
  "primary_construct": "social_engagement",
  "rationale": "La decisión de socializar mapea al ítem 7 de GDS (depresión por aislamiento) y al ítem 1 de PHQ (ánimo deprimido). La interacción social es un factor protector en ambas escalas."
}

## Restricciones
- Solo items de GDS (1-15) o PHQ (1-9)
- Confianza: 0.0-1.0
- Peso: 0.0-1.0
- Respuesta = JSON puro, sin explicación adicional
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
    { number: 8, description: '¿Siente que su situación es desesperada?' },
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

module.exports = {
  buildClinicianMappingPrompt,
  buildComparisonPrompt,
  buildRiskAssessmentPrompt,
  getGDSItems,
  getPHQItems
};
