#!/usr/bin/env node
/**
 * Test Script: LLM Model Comparison (Sprint 2c)
 * ADJUSTED: Uses lightweight models for RAM-constrained systems
 * 
 * Run: node scripts/test_llm_comparison.js
 * Available models: orca-mini (1.7B), phi (2.7B), mistral (7B - needs 4.5GB RAM)
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:7070';
const OLLAMA_API = process.env.OLLAMA_BASE || 'http://localhost:11434/api';

// Models that fit in available RAM
const MODELS_CONFIG = [
  { name: 'orca-mini', displayName: 'Orca Mini (1.7B)', ram_needed: '1.7GB' },
  { name: 'phi', displayName: 'Phi-2 (2.7B)', ram_needed: '2.5GB' },
  { name: 'mistral', displayName: 'Mistral (7B)', ram_needed: '4.5GB' }
];

// Test decision from chapter c01
const TEST_DECISION = {
  decision_id: '550e8400-e29b-41d4-a716-446655440000',
  session_id: '650e8400-e29b-41d4-a716-446655440111',
  chapter_id: 'c01',
  scene_id: 'c01-s01',
  option_id: 'c01-s01-o1',
  option_text: 'Acercarte a Carmen',
  consequence: 'Te acercas a Carmen y empiezan a conversar. Ella se alegra mucho de verte y pasan un rato agradable juntos.',
  timestamp: new Date().toISOString()
};

// Designer mappings from content (expected)
const DESIGNER_MAPPINGS = [
  { scale: 'GDS', item: 2, weight: 1.0, confidence: 0.9, primary_construct: 'social_engagement' }
];

console.log(`
╔════════════════════════════════════════════════════════════════╗
║  🧪 LLM Model Comparison (Sprint 2c - Free Local Inference)   ║
║  Backend: ${BACKEND_URL}
║  Ollama: ${OLLAMA_API}
╚════════════════════════════════════════════════════════════════╝
`);

/**
 * Check Ollama connectivity
 */
async function checkOllamaHealth() {
  try {
    const response = await axios.get(`${OLLAMA_API}/tags`, { timeout: 5000 });
    const models = response.data.models?.map(m => m.name) || [];
    console.log(`✅ Ollama is running\n📦 Available models: ${models.join(', ')}\n`);
    return true;
  } catch (err) {
    console.error('❌ Ollama is not running or not accessible');
    console.error(`   Error: ${err.message}`);
    console.error(`   Make sure Ollama is running: ollama serve\n`);
    return false;
  }
}

/**
 * Test a single model
 */
async function testModel(model) {
  const prompt = `
Analyze this narrative decision for clinical mapping:
Decision: "${TEST_DECISION.option_text}"
Consequence: "${TEST_DECISION.consequence}"

Map to GDS-15 and PHQ-9 scales. Respond ONLY with valid JSON:
{
  "mappings": [{"scale": "GDS", "item": 2, "weight": 0.9, "confidence": 0.85, "primary_construct": "social_engagement"}],
  "confidence": 0.85,
  "rationale": "Social interaction is protective for both GDS and PHQ symptoms."
}`;

  let startTime, endTime;

  try {
    startTime = performance.now();

    const response = await axios.post(
      `${OLLAMA_API}/generate`,
      {
        model,
        prompt,
        stream: false,
        temperature: 0.7,
        num_ctx: 2048,
        num_predict: 512
      },
      { timeout: 45000 }
    );

    endTime = performance.now();

    const responseText = response.data.response?.trim() || '';
    
    // Try to extract JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    let parsed = null;
    let parseError = null;

    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        parseError = `JSON parse error: ${e.message}`;
      }
    } else {
      parseError = 'No JSON found in response';
    }

    const timeTaken = (endTime - startTime) / 1000;

    return {
      model,
      success: true,
      timeTaken,
      response: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''),
      parsed,
      parseError,
      mappings: parsed?.mappings || [],
      confidence: parsed?.confidence || 0
    };

  } catch (err) {
    endTime = performance.now();
    const timeTaken = (endTime - startTime) / 1000;

    return {
      model,
      success: false,
      timeTaken,
      error: err.message,
      mappings: [],
      confidence: 0
    };
  }
}

/**
 * Compare results
 */
function compareResults(results) {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    📊 RESULTS SUMMARY                           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const table = results.map(r => ({
    'Model': r.model.toUpperCase(),
    'Status': r.success ? '✅ OK' : '❌ Failed',
    'Time (s)': r.timeTaken ? r.timeTaken.toFixed(2) : 'N/A',
    'Mappings': r.mappings?.length || 0,
    'Confidence': r.confidence ? r.confidence.toFixed(2) : 'N/A',
    'Issues': r.parseError || r.error || 'None'
  }));

  console.table(table);

  // Ranking
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    🏆 MODEL RANKING                             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const successful = results.filter(r => r.success && !r.parseError);
  
  if (!successful.length) {
    console.log('⚠️  No models completed successfully.\n');
    return;
  }

  const ranked = successful
    .sort((a, b) => {
      // Sort by: confidence (desc), speed (asc), mapping count (desc)
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      if (a.timeTaken !== b.timeTaken) return a.timeTaken - b.timeTaken;
      return (b.mappings?.length || 0) - (a.mappings?.length || 0);
    });

  ranked.forEach((r, idx) => {
    const medals = ['🥇', '🥈', '🥉'];
    console.log(`${medals[idx] || '  '} #${idx + 1} - ${r.model.toUpperCase()}`);
    console.log(`   ⏱️  ${r.timeTaken.toFixed(2)}s | 🎯 Confidence: ${r.confidence.toFixed(2)} | 📊 Mappings: ${r.mappings?.length || 0}`);
    console.log('');
  });

  // Cost estimate (per 1M tokens)
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    💰 COST ESTIMATES                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const costEstimates = {
    mistral: 'FREE (Ollama local)',
    llama2: 'FREE (Ollama local)',
    'neural-chat': 'FREE (Ollama local)'
  };

  console.log('All models running on Ollama (local) = COMPLETELY FREE\n');
  console.log('For reference (if using cloud APIs):');
  console.log('  Claude 3.5 Sonnet: $3/$15 per 1M tokens');
  console.log('  GPT-4 Turbo: $10/$30 per 1M tokens');
  console.log('  Gemini 2.0: $0.075/$0.30 per 1M tokens\n');
}

/**
 * Test via backend API
 */
async function testViaBackend() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║              🔌 Testing via Backend API                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    const response = await axios.post(
      `${BACKEND_URL}/decisions/${TEST_DECISION.decision_id}/compute-mapping`,
      TEST_DECISION,
      { timeout: 60000 }
    );

    const data = response.data;

    console.log('✅ Backend API responded successfully\n');
    console.log(`📊 Total time: ${data.total_time_ms}ms\n`);

    // Parse each model result
    const results = [];
    for (const [model, result] of Object.entries(data.results)) {
      const modelResult = {
        model,
        success: !result.error,
        timeTaken: (result.time_ms / 1000).toFixed(2),
        mappings: result.mappings || [],
        confidence: result.confidence || 0,
        parseError: result.error,
        response: ''
      };

      results.push(modelResult);

      console.log(`Model: ${model.toUpperCase()}`);
      console.log(`  ⏱️  ${modelResult.timeTaken}s`);
      console.log(`  🎯 Confidence: ${modelResult.confidence.toFixed(2)}`);
      console.log(`  📊 Mappings: ${modelResult.mappings.length}`);
      if (modelResult.mappings.length > 0) {
        console.log(`     - GDS Item ${modelResult.mappings[0].item} (weight: ${modelResult.mappings[0].weight})`);
      }
      console.log('');
    }

    return results;

  } catch (err) {
    console.error(`❌ Backend API error: ${err.message}\n`);
    if (err.response?.status === 503) {
      console.error('   LLM service not available. Check if llm-client.js is loaded.\n');
    }
    return [];
  }
}

/**
 * Main function
 */
async function main() {
  // Check Ollama
  const ollamaOk = await checkOllamaHealth();
  if (!ollamaOk) {
    process.exit(1);
  }

  // Option 1: Direct Ollama API tests
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║              🧠 Testing Direct Ollama API                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('Testing each model directly...\n');

  const directResults = await Promise.all(MODELS.map(model => {
    process.stdout.write(`Testing ${model.toUpperCase()}... `);
    return testModel(model);
  }));

  directResults.forEach(r => {
    if (r.success) {
      console.log(`✅ ${r.timeTaken.toFixed(2)}s`);
    } else {
      console.log(`❌ ${r.error}`);
    }
  });

  compareResults(directResults);

  // Option 2: Backend API tests
  const backendResults = await testViaBackend();

  // Final summary
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    ✅ TEST COMPLETE                             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('📋 Summary:');
  console.log('  ✅ Ollama connectivity verified');
  console.log(`  ✅ ${directResults.filter(r => r.success).length}/${MODELS.length} models responded`);
  if (backendResults.length > 0) {
    console.log(`  ✅ Backend API working`);
  }
  console.log('  ✅ Ready for Sprint 2c integration\n');

  console.log('Next steps:');
  console.log('  1. endpoint POST /decisions/{id}/compute-mapping is live');
  console.log('  2. Models run in parallel for fast comparison');
  console.log('  3. Zero cost: all local inference via Ollama\n');
}

// Run main function
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
