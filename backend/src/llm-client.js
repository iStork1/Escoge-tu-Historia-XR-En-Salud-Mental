/**
 * LLM Client for Ollama Integration
 * Supports: Mistral, Llama2, Neural-Chat
 * Sprint 2c: LLM Mapping Computation
 */

const axios = require('axios');

const OLLAMA_BASE = process.env.OLLAMA_BASE || 'http://localhost:11434/api';
const MODELS = {
  mistral: { name: 'mistral', displayName: 'Mistral 7B', timeout: 30000 },
  llama2: { name: 'llama2', displayName: 'Llama 2 7B', timeout: 35000 },
  neural_chat: { name: 'neural-chat', displayName: 'Neural Chat 7B', timeout: 30000 }
};

/**
 * Call Ollama API with a single model
 * @param {string} model - Model key (mistral, llama2, neural_chat)
 * @param {string} prompt - Prompt to send
 * @param {number} temperature - Creativity (0-1)
 * @returns {Promise<{response: string, model: string, time_ms: number}>}
 */
async function callOllama(model, prompt, temperature = 0.7) {
  if (!MODELS[model]) {
    throw new Error(`Unknown model: ${model}. Available: ${Object.keys(MODELS).join(', ')}`);
  }

  const modelName = MODELS[model].name;
  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${OLLAMA_BASE}/generate`,
      {
        model: modelName,
        prompt,
        stream: false,
        temperature,
        num_ctx: 2048, // context window
        num_predict: 1024 // max tokens in response
      },
      {
        timeout: MODELS[model].timeout,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const time_ms = Date.now() - startTime;
    return {
      response: response.data.response?.trim() || '',
      model,
      time_ms,
      model_display: MODELS[model].displayName
    };
  } catch (err) {
    const time_ms = Date.now() - startTime;
    console.error(`[LLM Error] ${modelName}:`, err.message);
    
    return {
      response: null,
      model,
      error: err.message,
      time_ms,
      model_display: MODELS[model].displayName
    };
  }
}

/**
 * Call all 3 models in parallel for comparison
 * @param {string} prompt - Clinical prompt
 * @returns {Promise<Object>} Results from all models
 */
async function callAllModels(prompt) {
  console.log('[LLM] Calling 3 models in parallel...');
  
  const startTime = Date.now();
  const results = await Promise.all([
    callOllama('mistral', prompt),
    callOllama('llama2', prompt),
    callOllama('neural_chat', prompt)
  ]);

  const totalTime = Date.now() - startTime;

  return {
    results: results.reduce((acc, r) => {
      acc[r.model] = r;
      return acc;
    }, {}),
    total_time_ms: totalTime,
    parallel: true
  };
}

/**
 * Health check: verify Ollama is running
 * @returns {Promise<boolean>}
 */
async function checkOllamaHealth() {
  try {
    const response = await axios.get(`${OLLAMA_BASE}/tags`, {
      timeout: 5000
    });
    return {
      ok: true,
      models: response.data.models?.map(m => m.name) || []
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message
    };
  }
}

/**
 * Parse LLM JSON response for clinical mappings
 * Expected format: { "mappings": [...], "confidence": 0.0-1.0, "rationale": "..." }
 * @param {string} responseText - Raw LLM response
 * @returns {Object}
 */
function parseClinicianResponse(responseText) {
  if (!responseText) {
    return { mappings: [], confidence: 0, error: 'Empty response' };
  }

  // Try to extract JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    return {
      mappings: [],
      confidence: 0,
      raw_text: responseText,
      note: 'Could not extract JSON from response'
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      mappings: Array.isArray(parsed.mappings) ? parsed.mappings : [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      rationale: parsed.rationale || '',
      primary_construct: parsed.primary_construct || null
    };
  } catch (err) {
    return {
      mappings: [],
      confidence: 0,
      error: `JSON parse error: ${err.message}`,
      raw_text: responseText
    };
  }
}

/**
 * Compare mappings from 2 models
 * @param {Array} designerMappings - Pre-authored mappings from content
 * @param {Array} llmMappings - LLM-generated mappings
 * @returns {Object} Divergence analysis
 */
function compareMappings(designerMappings = [], llmMappings = []) {
  if (!llmMappings.length) {
    return {
      divergence_percentage: 100,
      recommendation: 'LLM produced no mappings',
      agreement: [],
      designer_only: designerMappings,
      llm_only: []
    };
  }

  const designerItems = new Set(designerMappings.map(m => `${m.scale}_${m.item}`));
  const llmItems = new Set(llmMappings.map(m => `${m.scale}_${m.item}`));

  const agreement = designerMappings.filter(m => llmItems.has(`${m.scale}_${m.item}`));
  const designerOnly = designerMappings.filter(m => !llmItems.has(`${m.scale}_${m.item}`));
  const llmOnly = llmMappings.filter(m => !designerItems.has(`${m.scale}_${m.item}`));

  const totalUnique = new Set([...designerItems, ...llmItems]).size;
  const divergence = totalUnique > 0 ? ((designerOnly.length + llmOnly.length) / totalUnique * 100) : 0;

  return {
    divergence_percentage: parseFloat(divergence.toFixed(2)),
    agreement_count: agreement.length,
    designer_only_count: designerOnly.length,
    llm_only_count: llmOnly.length,
    total_union: totalUnique,
    agreement,
    designer_only: designerOnly,
    llm_only: llmOnly,
    recommendation: divergence > 30 ? 'High divergence - review recommended' : 'Low divergence - acceptable'
  };
}

module.exports = {
  callOllama,
  callAllModels,
  checkOllamaHealth,
  parseClinicianResponse,
  compareMappings,
  MODELS
};
