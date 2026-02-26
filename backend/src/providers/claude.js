/**
 * Claude Provider Implementation (Anthropic)
 * Cloud-based LLM - PAID ($3 - $15 per 1M tokens)
 * Supports: claude-3-sonnet, claude-3-opus, claude-3-haiku
 * 
 * Prerequisites:
 *   1. npm install @anthropic-ai/sdk
 *   2. Set ANTHROPIC_API_KEY in .env
 *   3. ANTHROPIC_MODEL env var (defaults to claude-3-sonnet-20240229)
 */

const BaseProvider = require('./base');

let Anthropic;
try {
  Anthropic = require('@anthropic-ai/sdk');
} catch (e) {
  console.warn('⚠️ Anthropic SDK not installed. Run: npm install @anthropic-ai/sdk');
}

class ClaudeProvider extends BaseProvider {
  constructor() {
    super('claude');
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.model = process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229';
    this.client = null;
    
    if (this.apiKey && Anthropic) {
      try {
        this.client = new Anthropic({ apiKey: this.apiKey });
      } catch (err) {
        console.warn(`⚠️ Claude client initialization failed: ${err.message}`);
      }
    }
  }
  
  async initialize() {
    if (!this.apiKey) {
      console.warn('⚠️ Claude provider: ANTHROPIC_API_KEY not set');
      return;
    }
    
    if (!this.client) {
      console.warn('⚠️ Claude client not initialized');
      return;
    }
    
    try {
      const health = await this.healthCheck();
      if (health.ok) {
        this.initialized = true;
        console.log(`✅ Claude provider initialized. Model: ${this.model}`);
      } else {
        console.warn(`⚠️ Claude health check failed: ${health.error}`);
      }
    } catch (err) {
      console.warn(`⚠️ Claude initialization error: ${err.message}`);
    }
  }
  
  async healthCheck() {
    if (!this.client) {
      return { ok: false, error: 'Claude client not initialized' };
    }
    
    try {
      // Make a minimal test request
      await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      });
      return { ok: true, models: [this.model] };
    } catch (err) {
      return {
        ok: false,
        error: `Claude API error: ${err.message}`
      };
    }
  }
  
  /**
   * Generate response from Claude model
   */
  async generate(model = null, prompt, options = {}) {
    if (!this.client) {
      return {
        response: null,
        error: 'Claude client not initialized',
        model: model || this.model,
        time_ms: 0,
        provider: 'claude'
      };
    }
    
    const {
      temperature = 0.7,
      max_tokens = 1024
    } = options;
    
    const modelToUse = model || this.model;
    const startTime = Date.now();
    
    try {
      const response = await this.client.messages.create({
        model: modelToUse,
        max_tokens,
        temperature,
        messages: [
          { role: 'user', content: prompt }
        ]
      });
      
      const timeTaken = Date.now() - startTime;
      const responseText = response.content[0]?.text || '';
      
      return {
        response: responseText,
        model: modelToUse,
        time_ms: timeTaken,
        tokens_used: response.usage?.input_tokens + response.usage?.output_tokens,
        provider: 'claude'
      };
      
    } catch (err) {
      const timeTaken = Date.now() - startTime;
      console.error(`[Claude] Error:`, err.message);
      
      return {
        response: null,
        error: err.message,
        model: modelToUse,
        time_ms: timeTaken,
        provider: 'claude'
      };
    }
  }
  
  async getAvailableModels() {
    return [this.model];
  }
}

module.exports = ClaudeProvider;
