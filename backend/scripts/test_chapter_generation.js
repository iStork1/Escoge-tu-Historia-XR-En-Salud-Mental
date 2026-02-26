#!/usr/bin/env node

/**
 * Test script for chapter generation endpoint
 * Tests the complete flow: session → chapter generation → database
 * Sprint 3: Narrative Generation
 */

const axios = require('axios');
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  cyan: '\x1b[36m'
};

const BASE_URL = 'http://localhost:7070';

async function test(name, fn) {
  try {
    console.log(`\n${colors.cyan}→${colors.reset} ${name}`);
    await fn();
    console.log(`${colors.green}✓${colors.reset} PASS`);
    return true;
  } catch (err) {
    console.log(`${colors.red}✗${colors.reset} FAIL: ${err.message}`);
    if (err.response?.data) {
      console.log(`   Details: ${JSON.stringify(err.response.data)}`);
    }
    return false;
  }
}

async function testChapterGeneration() {
  console.log(`\n${colors.blue}╔════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║      Chapter Generation System Tests        ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════╝${colors.reset}`);
  console.log(`\nAPI Base URL: ${BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  let passCount = 0;
  let failCount = 0;

  // Test 1: Health Check
  if (await test('1. Health Check - Verify LLM is ready', async () => {
    const response = await axios.get(`${BASE_URL}/admin/llm-health`);
    if (!response.data.ok) throw new Error('Health check failed');
    if (!response.data.provider) throw new Error('No provider info');
    console.log(`   Provider: ${response.data.provider.provider}`);
    console.log(`   Models available: ${(response.data.models || []).join(', ')}`);
  })) passCount++; else failCount++;

  // Test 2: Create Session (for testing)
  let sessionId = null;
  let sessionData = null;
  
  if (await test('2. Create Test Session - Generate session for chapter test', async () => {
    const timestamp = new Date().toISOString();
    const decisionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    
    const payload = {
      schema_version: "1.0.0",
      session_id: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      }),
      pseudonym: "test-user-001",
      consent_given: true,
      privacy_mode: "anonymous",
      started_at: timestamp,
      decisions: [
        {
          decision_id: decisionId,
          timestamp: timestamp,
          chapter_id: "c01",
          chapter_title: "Paseo por el parque",
          scene_id: "c01-s01",
          scene_narration: "Encuentro en el parque",
          option_selected: {
            option_id: "c01-s01-o1",
            option_text: "Acercarte a Carmen",
            time_to_decision_ms: 5000
          },
          mapping_results: {
            mapping_confidence: 0.85,
            clinical_mappings: [
              {
                scale: "GDS",
                item: 2,
                weight: 1.0,
                confidence: 0.9,
                primary_construct: "social_engagement",
                rationale: "Decision to engage socially reduces isolation"
              }
            ]
          }
        }
      ]
    };

    const response = await axios.post(`${BASE_URL}/telemetry`, payload);
    
    if (!response.data.session_id) throw new Error('No session ID returned');
    
    sessionId = response.data.session_id;
    sessionData = response.data;
    
    console.log(`   Session ID: ${sessionId}`);
    console.log(`   Chapter: ${sessionData.chapter_id}`);
  })) passCount++; else failCount++;

  if (!sessionId) {
    console.log(`\n${colors.yellow}⚠${colors.reset}  Skipping chapter generation tests - no session created`);
    return;
  }

  // Test 3: Chapter Generation Request - Valid
  if (await test('3. Chapter Generation - Valid Request', async () => {
    const payload = { session_id: sessionId };
    
    const response = await axios.post(`${BASE_URL}/chapters/generate`, payload);
    
    if (!response.data.ok) throw new Error('Response not ok');
    if (!response.data.chapter) throw new Error('No chapter in response');
    if (!response.data.chapter.chapter_id) throw new Error('No chapter_id');
    if (!response.data.chapter.scene) throw new Error('No scene');
    if (!Array.isArray(response.data.chapter.options)) throw new Error('No options array');
    
    const chapter = response.data.chapter;
    console.log(`   Generated: ${chapter.chapter_id}`);
    console.log(`   Title: ${chapter.title}`);
    console.log(`   Scene: ${chapter.scene.scene_id}`);
    console.log(`   Options: ${chapter.options.length}`);
    console.log(`   Provider: ${response.data.generated_by}`);
  })) passCount++; else failCount++;

  // Test 4: Option Structure Validation
  if (await test('4. Option Structure - Validate clinical mappings', async () => {
    const payload = { session_id: sessionId };
    const response = await axios.post(`${BASE_URL}/chapters/generate`, payload);
    
    const options = response.data.chapter.options || [];
    
    if (options.length < 3) {
      console.log(`   ${colors.yellow}⚠${colors.reset} Only ${options.length} options (expected 3-5)`);
    }
    
    options.forEach((opt, idx) => {
      if (!opt.option_id) throw new Error(`Option ${idx} missing option_id`);
      if (!opt.option_text) throw new Error(`Option ${idx} missing option_text`);
      if (!opt.consequence) throw new Error(`Option ${idx} missing consequence`);
      
      const totalMappings = (opt.gds_mapping || []).length + (opt.phq_mapping || []).length;
      console.log(`   Option ${idx + 1} (${opt.option_id}): ${totalMappings} clinical mappings`);
    });
  })) passCount++; else failCount++;

  // Test 5: Clinical Mapping Validation
  if (await test('5. Clinical Mappings - Validate GDS/PHQ items', async () => {
    const payload = { session_id: sessionId };
    const response = await axios.post(`${BASE_URL}/chapters/generate`, payload);
    
    const options = response.data.chapter.options || [];
    const gdsItems = [];
    const phqItems = [];
    
    options.forEach(opt => {
      (opt.gds_mapping || []).forEach(m => {
        if (m.item < 1 || m.item > 15) throw new Error(`Invalid GDS item: ${m.item}`);
        if (m.weight < 0 || m.weight > 1) throw new Error(`Invalid weight: ${m.weight}`);
        if (m.confidence < 0 || m.confidence > 1) throw new Error(`Invalid confidence: ${m.confidence}`);
        gdsItems.push(m.item);
      });
      
      (opt.phq_mapping || []).forEach(m => {
        if (m.item < 1 || m.item > 9) throw new Error(`Invalid PHQ item: ${m.item}`);
        if (m.weight < 0 || m.weight > 1) throw new Error(`Invalid weight: ${m.weight}`);
        if (m.confidence < 0 || m.confidence > 1) throw new Error(`Invalid confidence: ${m.confidence}`);
        phqItems.push(m.item);
      });
    });
    
    console.log(`   GDS items mapped: ${new Set(gdsItems).size} unique`);
    console.log(`   PHQ items mapped: ${new Set(phqItems).size} unique`);
  })) passCount++; else failCount++;

  // Test 6: Missing Session ID
  if (await test('6. Error Handling - Missing session_id', async () => {
    try {
      await axios.post(`${BASE_URL}/chapters/generate`, {});
      throw new Error('Should have failed');
    } catch (err) {
      if (err.response?.status !== 400) throw new Error(`Expected 400, got ${err.response?.status}`);
      if (!err.response?.data?.error) throw new Error('No error message in response');
      console.log(`   Error message: "${err.response.data.error}"`);
    }
  })) passCount++; else failCount++;

  // Test 7: Invalid Session ID
  if (await test('7. Error Handling - Invalid session_id', async () => {
    try {
      await axios.post(`${BASE_URL}/chapters/generate`, {
        session_id: '00000000-0000-0000-0000-000000000000'
      });
      throw new Error('Should have failed');
    } catch (err) {
      if (err.response?.status !== 404) throw new Error(`Expected 404, got ${err.response?.status}`);
      if (!err.response?.data?.error?.includes('not found')) throw new Error('Wrong error message');
      console.log(`   Error message: "${err.response.data.error}"`);
    }
  })) passCount++; else failCount++;

  // Test 8: Sequential Chapter Generation
  if (await test('8. Sequential Chapters - Generate multiple in sequence', async () => {
    const payload = { session_id: sessionId };
    
    const response1 = await axios.post(`${BASE_URL}/chapters/generate`, payload);
    const chapter1 = response1.data.chapter.chapter_id;
    
    const response2 = await axios.post(`${BASE_URL}/chapters/generate`, payload);
    const chapter2 = response2.data.chapter.chapter_id;
    
    console.log(`   Chapter 1: ${chapter1}`);
    console.log(`   Chapter 2: ${chapter2}`);
    
    // Chapters should be different (incrementing)
    if (chapter1 === chapter2) {
      console.log(`   ${colors.yellow}⚠${colors.reset} Chapters are same (may be cached)`);
    }
  })) passCount++; else failCount++;

  // Summary
  console.log(`\n${colors.blue}╔════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║                  Summary                     ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════╝${colors.reset}`);
  console.log(`${colors.green}✓ Passed: ${passCount}${colors.reset}`);
  console.log(`${colors.red}✗ Failed: ${failCount}${colors.reset}`);
  console.log(`Total: ${passCount + failCount}`);

  if (failCount === 0) {
    console.log(`\n${colors.green}🎉 All tests passed!${colors.reset}`);
  } else {
    console.log(`\n${colors.red}⚠️  Some tests failed.${colors.reset}`);
  }

  process.exit(failCount > 0 ? 1 : 0);
}

// Run tests
testChapterGeneration().catch(err => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
