/**
 * LLM Client - Unified Interface
 * Abstracts multiple LLM providers (Ollama, OpenAI, Claude)
 * Sprint 2c: LLM Mapping Computation
 * 
 * Provider selection via environment:
 *   LLM_PROVIDER=ollama  (free, local)
 *   LLM_PROVIDER=openai  ($, cloud)
 *   LLM_PROVIDER=claude  ($, cloud)
 */

const { createLLMProvider } = require('./llm-providers');

let provider = null;
let isInitialized = false;

/**
 * Initialize LLM client with configured provider
 */
async function initializeLLMClient() {
  try {
    provider = createLLMProvider();
    await provider.initialize();
    isInitialized = true;
    console.log(`✅ LLM Client initialized with provider: ${provider.name}`);
    return true;
  } catch (err) {
    console.error('[LLM] Initialization error:', err.message);
    return false;
  }
}

/**
 * Call LLM with a single model
 * @param {string} model - Model identifier
 * @param {string} prompt - Input prompt
 * @param {Object} options - { temperature, max_tokens }
 * @returns {Promise<Object>}
 */
async function callLLM(model, prompt, options = {}) {
  if (!provider) {
    throw new Error('LLM provider not initialized. Call initializeLLMClient() first.');
  }
  
  return await provider.generate(model, prompt, options);
}

/**
 * Call all available models in parallel (for comparison)
 * @param {string} prompt - Input prompt
 * @param {Object} options - { temperature, max_tokens }
 * @returns {Promise<{results: Object, total_time_ms: number}>}
 */
async function callAllModels(prompt, options = {}) {
  if (!provider) {
    throw new Error('LLM provider not initialized. Call initializeLLMClient() first.');
  }
  
  const availableModels = await provider.getAvailableModels();
  console.log(`[LLM] Calling ${availableModels.length} model(s) in parallel: ${availableModels.join(', ')}`);
  
  return await provider.generateParallel(availableModels, prompt, options);
}

/**
 * Health check: verify provider is running
 * @returns {Promise<Object>}
 */
async function checkHealth() {
  if (!provider) {
    return { ok: false, error: 'LLM provider not initialized' };
  }
  
  return await provider.healthCheck();
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
 * Compare mappings from 2 sources
 * @param {Array} designerMappings - Pre-authored mappings
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

/**
 * Get provider information
 * @returns {Object}
 */
function getProviderInfo() {
  if (!provider) {
    return { provider: null, initialized: false };
  }
  
  return {
    provider: provider.name,
    initialized: isInitialized,
    model: provider.model || 'unknown'
  };
}

module.exports = {
  initializeLLMClient,
  callLLM,
  callAllModels,
  checkHealth,
  parseClinicianResponse,
  compareMappings,
  getProviderInfo
};
