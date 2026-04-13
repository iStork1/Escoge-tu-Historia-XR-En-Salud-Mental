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
let coreProvider = null;
let narrativeProvider = null;
let isInitialized = false;
const providerCache = new Map();

function parseModelList(raw = '') {
  if (!raw || typeof raw !== 'string') return [];
  return raw.split(',').map(m => m.trim()).filter(Boolean);
}

function resolveProvider(role = null) {
  if (role === 'core') return coreProvider || provider;
  if (role === 'narrative') return narrativeProvider || provider;
  return provider;
}

function registerProvider(name, instance) {
  if (!name || !instance) return;
  providerCache.set(String(name).toLowerCase(), instance);
}

async function ensureProviderByName(name) {
  if (!name) return null;
  const key = String(name).toLowerCase();
  if (providerCache.has(key)) return providerCache.get(key);
  const created = createLLMProvider(name);
  if (!created) return null;
  await created.initialize();
  providerCache.set(key, created);
  return created;
}

function resolveRoleModels(role = null) {
  if (role === 'core') return parseModelList(process.env.LLM_CORE_MODELS || '');
  if (role === 'narrative') return parseModelList(process.env.LLM_NARRATIVE_MODELS || '');
  return parseModelList(process.env.LLM_AVAILABLE_MODELS || '');
}

function resolveRoleModel(role = null, fallbackModel = null) {
  if (role === 'core') return process.env.LLM_CORE_MODEL || fallbackModel || null;
  if (role === 'narrative') return process.env.LLM_NARRATIVE_MODEL || fallbackModel || null;
  return process.env.LLM_MODEL || fallbackModel || null;
}

/**
 * Initialize LLM client with configured provider
 */
async function initializeLLMClient() {
  try {
    provider = createLLMProvider();
    coreProvider = createLLMProvider(process.env.LLM_PROVIDER_CORE || process.env.LLM_PROVIDER || null);
    narrativeProvider = createLLMProvider(process.env.LLM_PROVIDER_NARRATIVE || process.env.LLM_PROVIDER || null);
    const secondaryCoreProvider = createLLMProvider(process.env.LLM_PROVIDER_CORE_SECONDARY || null);

    registerProvider(process.env.LLM_PROVIDER || provider?.name, provider);
    registerProvider(process.env.LLM_PROVIDER_CORE || coreProvider?.name, coreProvider);
    registerProvider(process.env.LLM_PROVIDER_NARRATIVE || narrativeProvider?.name, narrativeProvider);
    registerProvider(process.env.LLM_PROVIDER_CORE_SECONDARY || secondaryCoreProvider?.name, secondaryCoreProvider);

    const providersToInit = [provider, coreProvider, narrativeProvider, secondaryCoreProvider].filter(Boolean);
    for (const p of providersToInit) {
      await p.initialize();
    }

    isInitialized = providersToInit.some(p => p.initialized);
    console.log(`✅ LLM Client initialized. Default: ${provider?.name || 'none'}, core: ${coreProvider?.name || 'none'}, narrative: ${narrativeProvider?.name || 'none'}`);
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
  const { role, providerRole, ...providerOptions } = options || {};
  const resolvedRole = role || providerRole || null;
  const activeProvider = resolveProvider(resolvedRole);

  if (!activeProvider) {
    throw new Error('LLM provider not initialized. Call initializeLLMClient() first.');
  }

  const fallbackModel = activeProvider.model || null;
  const modelToUse = model || resolveRoleModel(resolvedRole, fallbackModel) || fallbackModel;

  return await activeProvider.generate(modelToUse, prompt, providerOptions);
}

/**
 * Call all available models in parallel (for comparison)
 * @param {string} prompt - Input prompt
 * @param {Object} options - { temperature, max_tokens }
 * @returns {Promise<{results: Object, total_time_ms: number}>}
 */
async function callAllModels(prompt, options = {}) {
  const { role, providerRole, models, ...providerOptions } = options || {};
  const resolvedRole = role || providerRole || null;
  const activeProvider = resolveProvider(resolvedRole);

  if (!activeProvider) {
    throw new Error('LLM provider not initialized. Call initializeLLMClient() first.');
  }

  const modelList = (Array.isArray(models) && models.length)
    ? models
    : resolveRoleModels(resolvedRole);

  const availableModels = modelList.length ? modelList : await activeProvider.getAvailableModels();
  console.log(`[LLM] Calling ${availableModels.length} model(s) in parallel: ${availableModels.join(', ')}`);

  return await activeProvider.generateParallel(availableModels, prompt, providerOptions);
}

/**
 * Call models across multiple providers for the same prompt
 * @param {string} prompt - Input prompt
 * @param {Object} options - { providers: [{ name, models }], ...providerOptions }
 * @returns {Promise<{results: Object, total_time_ms: number}>}
 */
async function callModelsAcrossProviders(prompt, options = {}) {
  const { providers, ...providerOptions } = options || {};
  const plan = Array.isArray(providers) ? providers : [];
  const results = {};
  const startTime = Date.now();

  for (const entry of plan) {
    const config = typeof entry === 'string' ? { name: entry } : entry;
    const providerName = config && config.name ? config.name : null;
    const providerInstance = await ensureProviderByName(providerName);
    if (!providerInstance) {
      results[providerName || 'unknown'] = { error: 'Provider not available' };
      continue;
    }

    const modelList = Array.isArray(config.models) && config.models.length
      ? config.models
      : await providerInstance.getAvailableModels();

    try {
      const response = await providerInstance.generateParallel(modelList, prompt, providerOptions);
      for (const [model, result] of Object.entries(response.results || {})) {
        results[`${providerName}:${model}`] = {
          ...result,
          provider: providerName,
          model
        };
      }
    } catch (err) {
      results[providerName || 'unknown'] = { error: err.message || String(err) };
    }
  }

  return {
    results,
    total_time_ms: Date.now() - startTime
  };
}

/**
 * Health check: verify provider is running
 * @returns {Promise<Object>}
 */
async function checkHealth(role = null) {
  const activeProvider = resolveProvider(role);
  if (!activeProvider) {
    return { ok: false, error: 'LLM provider not initialized' };
  }

  return await activeProvider.healthCheck();
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
  if (!provider && !coreProvider && !narrativeProvider) {
    return { provider: null, initialized: false };
  }

  return {
    provider: provider ? provider.name : null,
    core_provider: coreProvider ? coreProvider.name : null,
    narrative_provider: narrativeProvider ? narrativeProvider.name : null,
    initialized: isInitialized,
    model: provider && provider.model ? provider.model : 'unknown',
    core_model: coreProvider && coreProvider.model ? coreProvider.model : null,
    narrative_model: narrativeProvider && narrativeProvider.model ? narrativeProvider.model : null
  };
}

module.exports = {
  initializeLLMClient,
  callLLM,
  callAllModels,
  callModelsAcrossProviders,
  checkHealth,
  parseClinicianResponse,
  compareMappings,
  getProviderInfo
};
