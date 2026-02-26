/**
 * OpenAI Provider Implementation
 * Cloud-based LLM - PAID ($0.01 - $0.10 per 1K tokens)
 * Supports: gpt-4, gpt-4-turbo, gpt-3.5-turbo
 * 
 * Prerequisites:
 *   1. npm install openai
 *   2. Set OPENAI_API_KEY in .env
 *   3. OPENAI_MODEL env var (defaults to gpt-4-turbo)
 */

const BaseProvider = require('./base');

let OpenAI;
try {
  const OpenAIModule = require('openai');
  // Handle both default export and named export
  OpenAI = OpenAIModule.default || OpenAIModule;
} catch (e) {
  console.warn('⚠️ OpenAI SDK not installed. Run: npm install openai');
}

class OpenAIProvider extends BaseProvider {
  constructor() {
    super('openai');
    this.apiKey = process.env.OPENAI_API_KEY;
    this.model = process.env.OPENAI_MODEL || 'gpt-4-turbo';
    this.client = null;
    
    if (this.apiKey) {
      try {
        this.client = new OpenAI({ apiKey: this.apiKey });
      } catch (err) {
        console.warn(`⚠️ OpenAI client initialization failed: ${err.message}`);
      }
    }
  }
  
  async initialize() {
    if (!this.apiKey) {
      console.warn('⚠️ OpenAI provider: OPENAI_API_KEY not set');
      return;
    }
    
    if (!this.client) {
      console.warn('⚠️ OpenAI client not initialized');
      return;
    }
    
    try {
      const health = await this.healthCheck();
      if (health.ok) {
        this.initialized = true;
        console.log(`✅ OpenAI provider initialized. Model: ${this.model}`);
      } else {
        console.warn(`⚠️ OpenAI health check failed: ${health.error}`);
      }
    } catch (err) {
      console.warn(`⚠️ OpenAI initialization error: ${err.message}`);
    }
  }
  
  async healthCheck() {
    if (!this.client) {
      return { ok: false, error: 'OpenAI client not initialized' };
    }
    
    try {
      // Try a simple list models call
      await this.client.models.list();
      return { ok: true, models: [this.model] };
    } catch (err) {
      return {
        ok: false,
        error: `OpenAI API error: ${err.message}`
      };
    }
  }
  
  /**
   * Generate response from OpenAI model
   */
  async generate(model = null, prompt, options = {}) {
    if (!this.client) {
      return {
        response: null,
        error: 'OpenAI client not initialized',
        model: model || this.model,
        time_ms: 0,
        provider: 'openai'
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
        provider: 'openai'
      };
      
    } catch (err) {
      const timeTaken = Date.now() - startTime;
      console.error(`[OpenAI] Error:`, err.message);
      
      return {
        response: null,
        error: err.message,
        model: modelToUse,
        time_ms: timeTaken,
        provider: 'openai'
      };
    }
  }
  
  async getAvailableModels() {
    return [this.model];
  }
}

module.exports = OpenAIProvider;
