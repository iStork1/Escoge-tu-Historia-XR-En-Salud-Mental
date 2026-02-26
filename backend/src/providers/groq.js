/**
 * Groq Provider Implementation
 * FREE - Ultra-fast inference, no credit card required
 * Supports: Mixtral, Llama, etc.
 * 
 * Prerequisites:
 *   1. Free account: https://console.groq.com
 *   2. Get API key from dashboard
 *   3. Set GROQ_API_KEY in .env
 */

const BaseProvider = require('./base');

let Groq;
try {
  Groq = require('groq-sdk');
} catch (e) {
  console.warn('⚠️ Groq SDK not installed. Run: npm install groq-sdk');
}

class GroqProvider extends BaseProvider {
  constructor() {
    super('groq');
    this.apiKey = process.env.GROQ_API_KEY;
    this.model = process.env.GROQ_MODEL || 'mixtral-8x7b-32768';
    this.client = null;
    
    if (this.apiKey && Groq) {
      try {
        this.client = new Groq({ apiKey: this.apiKey });
      } catch (err) {
        console.warn(`⚠️ Groq client initialization failed: ${err.message}`);
      }
    }
  }

  async initialize() {
    if (!this.apiKey) {
      console.warn('⚠️ Groq provider: GROQ_API_KEY not set');
      return;
    }

    if (!this.client) {
      console.warn('⚠️ Groq client not initialized');
      return;
    }

    try {
      const health = await this.healthCheck();
      if (health.ok) {
        this.initialized = true;
        console.log(`✅ Groq provider initialized. Model: ${this.model}`);
      } else {
        console.warn(`⚠️ Groq health check failed: ${health.error}`);
      }
    } catch (err) {
      console.warn(`⚠️ Groq initialization error: ${err.message}`);
    }
  }

  async healthCheck() {
    if (!this.client) {
      return { ok: false, error: 'Groq client not initialized' };
    }

    try {
      // Simple test call to verify API works
      await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10
      });
      return { ok: true, models: [this.model] };
    } catch (err) {
      return {
        ok: false,
        error: `Groq API error: ${err.message}`
      };
    }
  }

  /**
   * Generate response from Groq model
   * Ultra-fast: typically <1 second
   */
  async generate(model = null, prompt, options = {}) {
    if (!this.client) {
      return {
        response: null,
        error: 'Groq client not initialized',
        model: model || this.model,
        time_ms: 0,
        provider: 'groq'
      };
    }

    const {
      temperature = 0.7,
      max_tokens = 2048
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
        provider: 'groq'
      };

    } catch (err) {
      const timeTaken = Date.now() - startTime;
      console.error(`[Groq] Error:`, err.message);

      return {
        response: null,
        error: err.message,
        model: modelToUse,
        time_ms: timeTaken,
        provider: 'groq'
      };
    }
  }

  async getAvailableModels() {
    return [this.model];
  }
}

module.exports = GroqProvider;
