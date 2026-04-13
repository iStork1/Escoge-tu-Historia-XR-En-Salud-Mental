/**
 * Cohere Provider Implementation
 * Cloud-based LLM (Command A models)
 *
 * Prerequisites:
 *   1. Set COHERE_API_KEY in .env
 *   2. Optional: COHERE_MODEL (defaults to command-a-03-2025)
 */

const BaseProvider = require('./base');
const axios = require('axios');

class CohereProvider extends BaseProvider {
  constructor() {
    super('cohere');
    this.apiKey = process.env.COHERE_API_KEY;
    this.model = process.env.COHERE_MODEL || 'command-a-03-2025';
    this.baseURL = process.env.COHERE_BASE_URL || 'https://api.cohere.ai/v1';
  }

  async initialize() {
    if (!this.apiKey) {
      console.warn('⚠️ Cohere provider: COHERE_API_KEY not set');
      return;
    }

    try {
      const health = await this.healthCheck();
      if (health.ok) {
        this.initialized = true;
        console.log(`✅ Cohere provider initialized. Model: ${this.model}`);
      } else {
        console.warn(`⚠️ Cohere health check failed: ${health.error}`);
      }
    } catch (err) {
      console.warn(`⚠️ Cohere initialization error: ${err.message}`);
    }
  }

  async healthCheck() {
    if (!this.apiKey) {
      return { ok: false, error: 'Cohere API key not set' };
    }

    try {
      await this.generate(this.model, 'Hi', { max_tokens: 5 });
      return { ok: true, models: [this.model] };
    } catch (err) {
      return {
        ok: false,
        error: `Cohere API error: ${err.message}`
      };
    }
  }

  async generate(model = null, prompt, options = {}) {
    if (!this.apiKey) {
      return {
        response: null,
        error: 'Cohere API key not set',
        model: model || this.model,
        time_ms: 0,
        provider: 'cohere'
      };
    }

    const {
      temperature = 0.7,
      max_tokens = 1024,
      timeout
    } = options;

    const modelToUse = model || this.model;
    const startTime = Date.now();

    try {
      const response = await axios.post(
        `${this.baseURL}/chat`,
        {
          model: modelToUse,
          message: prompt,
          temperature,
          max_tokens
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: Number.isFinite(Number(timeout)) ? Number(timeout) : undefined
        }
      );

      const timeTaken = Date.now() - startTime;
      const responseText = response.data?.text || response.data?.message || '';

      return {
        response: responseText,
        model: modelToUse,
        time_ms: timeTaken,
        tokens_used: response.data?.meta?.tokens?.input_tokens || null,
        provider: 'cohere'
      };

    } catch (err) {
      const timeTaken = Date.now() - startTime;
      const errorMsg = err.response?.data?.message || err.message;
      console.error('[Cohere] Error:', errorMsg);

      return {
        response: null,
        error: errorMsg,
        model: modelToUse,
        time_ms: timeTaken,
        provider: 'cohere'
      };
    }
  }

  async getAvailableModels() {
    return [this.model];
  }
}

module.exports = CohereProvider;
