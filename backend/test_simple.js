#!/usr/bin/env node

/**
 * Minimal test - just test chapter generation directly
 */

const axios = require('axios');

async function test() {
  try {
    // Step 1: Health check
    console.log('1. Health check...');
    const health = await axios.get('http://localhost:7070/admin/llm-health');
    console.log('   ✓ Health:', health.data.ok ? 'OK' : 'FAIL');

    // Step 2: Create session
    console.log('\n2. Creating test session...');
    const telemetryPayload = {
      schema_version: '1.0.0',
      session_id: require('crypto').randomUUID(),
      pseudonym: 'test-user',
      consent_given: true,
      privacy_mode: 'anonymous',
      started_at: new Date().toISOString(),
      decisions: []
    };
    
    const telemetryRes = await axios.post('http://localhost:7070/telemetry', telemetryPayload);
    const sessionId = telemetryRes.data.session_id;
    console.log('   ✓ Session created:', sessionId);

    // Step 3: Generate chapter (THIS IS THE KEY TEST)
    console.log('\n3. Generating chapter...');
    console.log('   Calling POST /chapters/generate with session_id:', sessionId);
    
    const startTime = Date.now();
    const genRes = await axios.post('http://localhost:7070/chapters/generate', {
      session_id: sessionId
    });
    
    const genTime = Date.now() - startTime;
    console.log(`   ✓ Chapter generation succeeded in ${genTime}ms`);
    console.log('   Response keys:', Object.keys(genRes.data));
    console.log('   Generated chapter ID:', genRes.data.chapter_id);
    
    if (genRes.data.chapter) {
      console.log('   Chapter narrative:', genRes.data.chapter.narration?.substring(0, 100) + '...');
    }
    
    console.log('\n✅ ALL TESTS PASSED!');

  } catch (err) {
    console.error('\n❌ Test failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

test();
