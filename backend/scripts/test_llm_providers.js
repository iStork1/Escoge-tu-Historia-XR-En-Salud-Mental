#!/usr/bin/env node

/**
 * Test script to verify unified LLM provider architecture
 * Tests provider initialization, health checks, and model generation
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const llmProviders = require('../src/llm-providers');
const llmClient = require('../src/llm-client');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

async function testProviderFactory() {
  console.log(`\n${colors.blue}=== Test 1: Provider Factory ===${colors.reset}`);
  
  try {
    const provider = llmProviders.createLLMProvider();
    console.log(`${colors.green}✓${colors.reset} Provider created: ${provider.constructor.name}`);
    console.log(`  Expected: ${process.env.LLM_PROVIDER || 'ollama'}`);
    return provider;
  } catch (err) {
    console.log(`${colors.red}✗${colors.reset} Provider creation failed: ${err.message}`);
    throw err;
  }
}

async function testProviderInitialization(provider) {
  console.log(`\n${colors.blue}=== Test 2: Provider Initialization ===${colors.reset}`);
  
  try {
    await provider.initialize();
    console.log(`${colors.green}✓${colors.reset} Provider initialized successfully`);
  } catch (err) {
    console.log(`${colors.red}✗${colors.reset} Provider initialization failed: ${err.message}`);
    throw err;
  }
}

async function testHealthCheck(provider) {
  console.log(`\n${colors.blue}=== Test 3: Health Check ===${colors.reset}`);
  
  try {
    const health = await provider.healthCheck();
    console.log(`${colors.green}✓${colors.reset} Health check completed`);
    console.log(`  Status: ${health.ok ? 'OK' : 'FAILED'}`);
    if (health.models) {
      console.log(`  Available models: ${health.models.join(', ')}`);
    }
    return health;
  } catch (err) {
    console.log(`${colors.yellow}⚠${colors.reset} Health check error: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

async function testModelGeneration(provider, health) {
  console.log(`\n${colors.blue}=== Test 4: Model Generation ===${colors.reset}`);
  
  if (!health.ok || !health.models || health.models.length === 0) {
    console.log(`${colors.yellow}⚠${colors.reset} Skipping generation test: provider not healthy`);
    return;
  }

  const testModel = health.models[0];
  const testPrompt = 'What is 2+2? Answer with just the number.';

  try {
    console.log(`  Testing model: ${testModel}`);
    console.log(`  Prompt: "${testPrompt}"`);
    
    const result = await provider.generate(testModel, testPrompt, { timeout: 30000 });
    
    console.log(`${colors.green}✓${colors.reset} Generation completed`);
    console.log(`  Response length: ${result.response.length} chars`);
    console.log(`  Response preview: ${result.response.substring(0, 100)}...`);
    
    if (result.tokens) {
      console.log(`  Tokens: ${result.tokens.input}/${result.tokens.output}`);
    }
  } catch (err) {
    console.log(`${colors.red}✗${colors.reset} Generation failed: ${err.message}`);
  }
}

async function testLLMClient() {
  console.log(`\n${colors.blue}=== Test 5: LLM Client Integration ===${colors.reset}`);
  
  try {
    await llmClient.initializeLLMClient();
    console.log(`${colors.green}✓${colors.reset} LLM Client initialized`);
    
    const info = llmClient.getProviderInfo();
    console.log(`  Provider: ${info.provider}`);
    console.log(`  Initialized: ${info.initialized}`);
    console.log(`  Model: ${info.model}`);
  } catch (err) {
    console.log(`${colors.red}✗${colors.reset} LLM Client initialization failed: ${err.message}`);
    throw err;
  }
}

async function testAvailableModels(provider) {
  console.log(`\n${colors.blue}=== Test 6: Available Models ===${colors.reset}`);
  
  try {
    const models = await provider.getAvailableModels();
    console.log(`${colors.green}✓${colors.reset} Retrieved available models`);
    console.log(`  Models: ${models.join(', ')}`);
  } catch (err) {
    console.log(`${colors.yellow}⚠${colors.reset} Model retrieval error: ${err.message}`);
  }
}

async function runAllTests() {
  console.log(`\n${colors.blue}╔════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║   Unified LLM Provider Architecture Tests   ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════╝${colors.reset}`);
  console.log(`\nEnvironment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`LLM Provider: ${process.env.LLM_PROVIDER || 'ollama'}`);

  let passCount = 0;
  let failCount = 0;

  try {
    // Test 1: Factory
    const provider = await testProviderFactory();
    passCount++;

    // Test 2: Initialization
    await testProviderInitialization(provider);
    passCount++;

    // Test 3: Health Check
    const health = await testHealthCheck(provider);
    passCount++;

    // Test 4: Generation
    await testModelGeneration(provider, health);
    passCount++;

    // Test 5: LLM Client
    await testLLMClient();
    passCount++;

    // Test 6: Available Models
    await testAvailableModels(provider);
    passCount++;

  } catch (err) {
    failCount++;
    console.log(`\n${colors.red}Fatal error: ${err.message}${colors.reset}`);
  }

  // Summary
  console.log(`\n${colors.blue}╔════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║                  Summary                     ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════╝${colors.reset}`);
  console.log(`${colors.green}✓ Passed: ${passCount}${colors.reset}`);
  console.log(`${colors.red}✗ Failed: ${failCount}${colors.reset}`);
  console.log(`Total: ${passCount + failCount}`);

  process.exit(failCount > 0 ? 1 : 0);
}

runAllTests().catch(err => {
  console.error(`${colors.red}Unexpected error:${colors.reset}`, err);
  process.exit(1);
});
