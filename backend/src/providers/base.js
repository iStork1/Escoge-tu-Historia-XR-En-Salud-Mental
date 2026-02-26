/**
 * Base Provider Class
 * All LLM providers (Ollama, OpenAI, Claude) must implement this interface
 */

class BaseProvider {
  constructor(name) {
    this.name = name;
    this.initialized = false;
  }
  
  /**
   * Initialize provider (connect to API, validate keys, etc)
   * Called on server startup
   */
  async initialize() {
    throw new Error('initialize() must be implemented');
  }

  /**
   * Check if provider is healthy and accessible
   * @returns {Object} { ok: boolean, models?: string[], error?: string }
   */
  async healthCheck() {
    throw new Error('healthCheck() must be implemented');
  }

  /**
   * Generate text from a single model
   * @param {string} model - Model name (e.g. 'orca-mini', 'gpt-4-turbo')
   * @param {string} prompt - Input prompt
   * @param {Object} options - Generation options (temperature, timeout, etc)
   * @returns {Object} { response: string, model: string, tokens?: {input, output}, provider: string }
   */
  async generate(model, prompt, options = {}) {
    throw new Error('generate() must be implemented');
  }

  /**
   * Generate from multiple models in parallel
   * @param {string[]} models - List of models to query
   * @param {string} prompt - Input prompt
   * @param {Object} options - Generation options
   * @returns {Object} { results: { [model]: response }, timestamp: ISO string }
   */
  async generateParallel(models, prompt, options = {}) {
    // Default implementation: call generate sequentially
    const results = {};
    
    for (const model of models) {
      try {
        const response = await this.generate(model, prompt, options);
        results[model] = response;
      } catch (err) {
        results[model] = { error: err.message || String(err) };
      }
    }
    
    return {
      results,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get list of available models for this provider
   * @returns {string[]} Array of model names
   */
  async getAvailableModels() {
    throw new Error('getAvailableModels() must be implemented');
  }

  /**
   * Validate provider is properly configured
   * @throws {Error} If configuration is invalid
   */
  validateConfig() {
    // Override in subclasses for provider-specific validation
  }
}

module.exports = BaseProvider;
