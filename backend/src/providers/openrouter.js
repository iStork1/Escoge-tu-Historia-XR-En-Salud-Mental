/**
 * OpenRouter Provider Implementation
 * OpenAI-compatible API via OpenRouter
 *
 * Prerequisites:
 *   1. npm install openai
 *   2. Set OPENROUTER_API_KEY in .env
 *   3. Optional: OPENROUTER_MODEL, OPENROUTER_APP_URL, OPENROUTER_APP_TITLE
 */

const BaseProvider = require('./base');

let OpenAI;
try {
  const OpenAIModule = require('openai');
  OpenAI = OpenAIModule.default || OpenAIModule;
} catch (e) {
  console.warn('⚠️ OpenAI SDK not installed. Run: npm install openai');
}

class OpenRouterProvider extends BaseProvider {
  constructor() {
    super('openrouter');
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.model = process.env.OPENROUTER_MODEL || process.env.LLM_NARRATIVE_MODEL || 'google/gemma-3-27b-it:free';
    this.baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.appUrl = process.env.OPENROUTER_APP_URL || null;
    this.appTitle = process.env.OPENROUTER_APP_TITLE || null;
    this.client = null;

    if (this.apiKey && OpenAI) {
      try {
        const defaultHeaders = {};
        if (this.appUrl) defaultHeaders['HTTP-Referer'] = this.appUrl;
        if (this.appTitle) defaultHeaders['X-Title'] = this.appTitle;
        this.client = new OpenAI({
          apiKey: this.apiKey,
          baseURL: this.baseURL,
          defaultHeaders
        });
      } catch (err) {
        console.warn(`⚠️ OpenRouter client initialization failed: ${err.message}`);
      }
    }
  }

  async initialize() {
    if (!this.apiKey) {
      console.warn('⚠️ OpenRouter provider: OPENROUTER_API_KEY not set');
      return;
    }

    if (!this.client) {
      console.warn('⚠️ OpenRouter client not initialized');
      return;
    }

    try {
      const health = await this.healthCheck();
      if (health.ok) {
        this.initialized = true;
        console.log(`✅ OpenRouter provider initialized. Model: ${this.model}`);
      } else {
        console.warn(`⚠️ OpenRouter health check failed: ${health.error}`);
      }
    } catch (err) {
      console.warn(`⚠️ OpenRouter initialization error: ${err.message}`);
    }
  }

  async healthCheck() {
    if (!this.client) {
      return { ok: false, error: 'OpenRouter client not initialized' };
    }

    try {
      await this.client.models.list();
      return { ok: true, models: [this.model] };
    } catch (err) {
      return {
        ok: false,
        error: `OpenRouter API error: ${err.message}`
      };
    }
  }

  async generate(model = null, prompt, options = {}) {
    if (!this.client) {
      return {
        response: null,
        error: 'OpenRouter client not initialized',
        model: model || this.model,
        time_ms: 0,
        provider: 'openrouter'
      };
    }

    const {
      temperature = 0.7,
      max_tokens = 1024
    } = options;

    const modelToUse = model || this.model;
    const startTime = Date.now();

    try {
      const response = await this.client.chat.completions.create({
        model: modelToUse,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature,
        max_tokens
      });

      const timeTaken = Date.now() - startTime;
      const responseText = response.choices[0]?.message?.content || '';

      return {
        response: responseText,
        model: modelToUse,
        time_ms: timeTaken,
        tokens_used: response.usage?.total_tokens,
        provider: 'openrouter'
      };

    } catch (err) {
      const timeTaken = Date.now() - startTime;
      console.error('[OpenRouter] Error:', err.message);

      return {
        response: null,
        error: err.message,
        model: modelToUse,
        time_ms: timeTaken,
        provider: 'openrouter'
      };
    }
  }

  async getAvailableModels() {
    const raw = process.env.OPENROUTER_AVAILABLE_MODELS || '';
    const list = raw.split(',').map(m => m.trim()).filter(Boolean);
    return list.length ? list : [this.model];
  }
}

module.exports = OpenRouterProvider;
