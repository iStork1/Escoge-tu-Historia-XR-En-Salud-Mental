/**
 * Ollama Provider Implementation
 * Local LLM inference - FREE, runs on your machine
 * 
 * Prerequisites:
 *   1. Install Ollama: https://ollama.ai
 *   2. ollama serve (in separate terminal)
 *   3. ollama pull orca-mini (or mistral, llama2, etc)
 */

const axios = require('axios');
const BaseProvider = require('./base');

class OllamaProvider extends BaseProvider {
  constructor() {
    super('ollama');
    this.baseUrl = process.env.OLLAMA_BASE || 'http://localhost:11434/api';
    this.defaultModels = ['orca-mini', 'phi', 'mistral'];
    // Timeout for CPU-based inference can be very long
    // Use env var or default to 5 minutes (300 seconds)
    this.timeout = parseInt(process.env.OLLAMA_TIMEOUT || '300000');
  }
  
  async initialize() {
    try {
      const health = await this.healthCheck();
      if (health.ok) {
        this.initialized = true;
        console.log(`✅ Ollama provider initialized. Available: ${health.models?.join(', ') || 'unknown'}`);
      } else {
        console.warn(`⚠️ Ollama health check failed: ${health.error}`);
      }
    } catch (err) {
      console.warn(`⚠️ Ollama provider initialization failed: ${err.message}`);
    }
  }
  
  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseUrl}/tags`, { timeout: 5000 });
      const models = response.data.models?.map(m => m.name.replace(':latest', '')) || [];
      return { ok: true, models };
    } catch (err) {
      return {
        ok: false,
        error: `Ollama not accessible at ${this.baseUrl}: ${err.message}`
      };
    }
  }
  
  /**
   * Generate response from Ollama model
   */
  async generate(model, prompt, options = {}) {
    const {
      temperature = 0.7,
      max_tokens = 1024,
      num_ctx = 2048
    } = options;
    
    const startTime = Date.now();
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/generate`,
        {
          model,
          prompt,
          stream: false,
          temperature,
          num_ctx,
          num_predict: max_tokens
        },
        { timeout: this.timeout }
      );
      
      const timeTaken = Date.now() - startTime;
      
      return {
        response: response.data.response?.trim() || '',
        model,
        time_ms: timeTaken,
        provider: 'ollama'
      };
      
    } catch (err) {
      const timeTaken = Date.now() - startTime;
      console.error(`[Ollama] Error with model ${model}:`, err.message);
      
      return {
        response: null,
        error: err.message,
        model,
        time_ms: timeTaken,
        provider: 'ollama'
      };
    }
  }
  
  /**
   * Get available models
   */
  async getAvailableModels() {
    const health = await this.healthCheck();
    return health.models || this.defaultModels;
  }
}

module.exports = OllamaProvider;
