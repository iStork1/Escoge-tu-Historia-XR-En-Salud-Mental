const fs = require('fs');
const path = require('path');

// 1. Cargar reglas narrativas para el system prompt
const RULES_PATH = path.join(__dirname, '../../instructions/TECNICAS_NARRATIVAS_COMPLETAS.md');
const NARRATIVE_RULES = fs.existsSync(RULES_PATH) ? fs.readFileSync(RULES_PATH, 'utf8') : 'Aplica la regla de show dont tell y frases cortas.';

const SYSTEM_PROMPT = `Eres un escritor experto en literatura inmersiva para adultos mayores. 
Tu tarea es reescribir textos narrativos (escenas y consecuencias) de un archivo JSON interactivo para maximizar la inmersión emocional y la calidad literaria, SIN tocar estructuras de datos.

REGLAS ESTRICTAS:
1. No alterar ni inventar id, chapter_id, next_scene_id, ni gds_mapping/phq_mapping.
2. Cada texto narrado ("text") debe tener entre 50 y 80 palabras si es Narrada, u 80 y 120 si es Jugable (con opciones).
3. Aplicar "Show, Don't Tell": 1 sonido puntual, 1 textura/sensación, 1 olor (si aplica). Nunca nombrar la emoción directamente (ej. "está triste").
4. Consecuencias ("consequence") de las opciones DEBEN tener exactamente 3 oraciones cortas (Acción física, Reacción emocional implícita, Respuesta del entorno).
5. PROHIBIDO hablar de muertes, traumas explícitos o palabras clínicas. Las historias son sobre el día a día.

Se te entregará un JSON de una escena. Devuelve ÚNICAMENTE el JSON válido con los campos literarios ("title", "text", "option_text", "consequence") reescritos siguiendo estas reglas mágicas de calidad. No uses bloques \`\`\`json si puedes evitarlo, solo el JSON puro.`;

// Este es el esqueleto para que lo conectes a OpenAI o OpenRouter. 
// Como actualmente .env tiene LLM_PROVIDER=mock, este script está preparado para cuando configures tu KEY.
async function callLLM(sceneData, apiKey) {
  // Aquí integrarías Fetch a OpenRouter / OpenAI
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "qwen/qwen-3-next-80b", // o anthropic/claude-3-haiku
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Mejora este JSON de escena:\n\n${JSON.stringify(sceneData, null, 2)}` }
      ],
      temperature: 0.4
    })
  });
  
  const data = await response.json();
  const content = data.choices[0].message.content;
  
  // Limpiar posible bloque de backticks del LLM
  return JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim());
}

async function processStory(filename) {
    console.log(`Iniciando upgrade narrativo de ${filename}...`);
    const filepath = path.join(__dirname, '../content/latam', filename);
    const storyData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    
    const apiKey = process.env.OPENROUTER_API_KEY;
    if(!apiKey) {
        console.error("❌ No se encontró OPENROUTER_API_KEY en .env. Configúrala para procesar masivamente.");
        return;
    }

    // Recorrer los capítulos (se puede paralizar o iterar)
    for (let c = 0; c < storyData.length; c++) {
        let chapter = storyData[c];
        console.log(`Procesando Capítulo ${chapter.chapter_id}...`);
        
        for (let s = 0; s < chapter.scenes.length; s++) {
            let scene = chapter.scenes[s];
            console.log(`  - Escena ${scene.scene_id}`);
            
            try {
                // Enviar la escena al LLM
                let enhancedScene = await callLLM(scene, apiKey);
                
                // Sobrescribir SOLO los campos narrativos, protegiendo mappings
                chapter.scenes[s].title = enhancedScene.title || scene.title;
                chapter.scenes[s].text = enhancedScene.text || scene.text;
                
                if (scene.options && enhancedScene.options) {
                    for(let o = 0; o < scene.options.length; o++) {
                        if (enhancedScene.options[o]) {
                            scene.options[o].option_text = enhancedScene.options[o].option_text || scene.options[o].option_text;
                            if (scene.options[o].consequence) {
                                scene.options[o].consequence = enhancedScene.options[o].consequence || scene.options[o].consequence;
                            }
                        }
                    }
                }
            } catch (err) {
                console.error(`    ⚠️ Error en escena ${scene.scene_id}: ${err.message}`);
            }
            
            // Pausa de cortesía para rate limits
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    
    // Guardar backup y sobrescribir
    fs.writeFileSync(filepath + '.bak', JSON.stringify(storyData, null, 2));
    fs.writeFileSync(filepath, JSON.stringify(storyData, null, 2));
    console.log(`✅ Upgrade narrativo de ${filename} completado exitosamente.`);
}

// Ejecutar
// processStory('story_alberto_ajedrez.json');
