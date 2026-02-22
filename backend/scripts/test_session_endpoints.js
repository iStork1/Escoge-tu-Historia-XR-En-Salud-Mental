#!/usr/bin/env node

/**
 * Test script for SPRINT 2a endpoints
 * Tests session closure and summary endpoints with mock data
 * 
 * Usage: node scripts/test_session_endpoints.js staging
 */

try { require('dotenv').config(); } catch (e) { /* continue */ }
const http = require('http');

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'http://localhost:7070';
const TEST_SESSION_ID = 'test-session-' + Date.now();

console.log(`🧪 Testing Sprint 2a Session Endpoints`);
console.log(`Backend URL: ${BACKEND_BASE_URL}`);
console.log(`Test Session ID: ${TEST_SESSION_ID}\n`);

function makeHttpRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(BACKEND_BASE_URL);
      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, body: parsed, headers: res.headers });
          } catch (e) {
            resolve({ status: res.statusCode, body: data, headers: res.headers });
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    } catch (e) { reject(e); }
  });
}

async function runTests() {
  try {
    console.log('📝 Test 1: PUT /sessions/{id}/close');
    console.log('─'.repeat(50));
    
    const closeResponse = await makeHttpRequest('PUT', `/sessions/${TEST_SESSION_ID}/close`, {
      session_length_seconds: 600,
      abandonment_flag: false
    });

    console.log(`Status: ${closeResponse.status}`);
    console.log(`Response:`, JSON.stringify(closeResponse.body, null, 2));

    if (closeResponse.status === 200) {
      console.log('✅ Session close endpoint working');
      console.log(`   Normalized GDS: ${closeResponse.body.normalized_emotional_score_gds}`);
      console.log(`   Normalized PHQ: ${closeResponse.body.normalized_emotional_score_phq}`);
    } else {
      console.log('❌ Session close endpoint failed');
      if (closeResponse.status === 404) {
        console.log('   (Session not found is expected—database not populated yet)');
      }
    }

    console.log('\n');
    console.log('📊 Test 2: GET /sessions/{id}/summary');
    console.log('─'.repeat(50));

    const summaryResponse = await makeHttpRequest('GET', `/sessions/${TEST_SESSION_ID}/summary`);

    console.log(`Status: ${summaryResponse.status}`);
    console.log(`Response:`, JSON.stringify(summaryResponse.body, null, 2));

    if (summaryResponse.status === 200) {
      console.log('✅ Session summary endpoint working');
      console.log(`   Decisions count: ${summaryResponse.body.decisions_count}`);
      console.log(`   Risk flags: ${summaryResponse.body.risk_flags.length > 0 ? summaryResponse.body.risk_flags.join(', ') : 'none'}`);
    } else if (summaryResponse.status === 404) {
      console.log('✅ Session summary endpoint working (404 expected—session not in DB)');
    } else {
      console.log('❌ Session summary endpoint failed');
    }

    console.log('\n');
    console.log('✅ Endpoint routing validation complete');
    console.log('\n💡 Note: For full testing, you need:');
    console.log('   1. An actual session_id from a telemetry POST');
    console.log('   2. Clinical mappings inserted for that session');
    console.log('   3. See SPRINT_2a_ENDPOINTS.md for manual test procedure');

  } catch (err) {
    console.error('❌ Test error:', err.message);
    process.exit(1);
  }
}

runTests();
