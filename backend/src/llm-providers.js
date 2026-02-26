/**
 * LLM Provider Factory
 * Unified interface for multiple LLM providers
 * Supports: Ollama (local, free), OpenAI (cloud, $), Claude (cloud, $)
 * 
 * Usage:
 *   const provider = createLLMProvider('ollama');
 *   const response = await provider.generate(prompt);
 */

const BaseProvider = require('./providers/base');

/**
 * Create LLM provider based on environment configuration
 * Uses lazy requires to avoid circular dependencies
 * @returns {Object} Provider instance with unified interface
 */
function createLLMProvider() {
  const providerType = (process.env.LLM_PROVIDER || 'ollama').toLowerCase();
  
  console.log(`[LLM] Initializing provider: ${providerType}`);
  
  switch (providerType) {
    case 'ollama': {
      const OllamaProvider = require('./providers/ollama');
      return new OllamaProvider();
    }
    case 'openai': {
      const OpenAIProvider = require('./providers/openai');
      return new OpenAIProvider();
    }
    case 'claude':
    case 'anthropic': {
      const ClaudeProvider = require('./providers/claude');
      return new ClaudeProvider();
    }
    case 'groq': {
      const GroqProvider = require('./providers/groq');
      return new GroqProvider();
    }
    case 'mock':
    case 'test': {
      const MockProvider = require('./providers/mock');
      return new MockProvider();
    }
    default:
      console.warn(`[LLM] Unknown provider '${providerType}', defaulting to Ollama`);
      const OllamaProvider = require('./providers/ollama');
      return new OllamaProvider();
  }
}

module.exports = {
  createLLMProvider,
  BaseProvider
};

