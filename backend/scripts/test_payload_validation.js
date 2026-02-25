#!/usr/bin/env node

/**
 * Test script for SPRINT 2b validation middleware
 * Tests valid and invalid payloads against decision_payload_schema.json
 * 
 * Usage: node scripts/test_payload_validation.js staging
 */

try { require('dotenv').config(); } catch (e) { /* continue */ }
const http = require('http');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'http://localhost:7070';

console.log(`🧪 Testing Sprint 2b Payload Validation`);
console.log(`Backend URL: ${BACKEND_BASE_URL}\n`);

function makeHttpRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(BACKEND_BASE_URL);
      const protocol = url.protocol === 'https:' ? https : http;
      const defaultPort = url.protocol === 'https:' ? 443 : 80;
      
      const options = {
        hostname: url.hostname,
        port: url.port || defaultPort,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Sprint2bTestClient/1.0'
        }
      };

      const req = protocol.request(options, (res) => {
        if (res.statusCode === 307 || res.statusCode === 301 || res.statusCode === 302) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            resolve(makeHttpRequest(method, new URL(redirectUrl).pathname + (new URL(redirectUrl).search || ''), body));
            return;
          }
        }
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
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
    // Test 1: Valid payload
    console.log('TEST 1: Valid Payload');
    console.log('─'.repeat(60));
    
    const validPayload = {
      session_id: uuidv4(),
      decision_id: uuidv4(),
      timestamp: new Date().toISOString(),
      pseudonym: 'test_user',
      device_id: 'alexa_test',
      payload: {
        chapter_id: 'c01',
        scene_id: 'c01-s01',
        option_id: 'c01-s01-o1',
        option_text: 'Test option',
        consequence: 'Test consequence',
        time_to_decision_ms: 2500
      }
    };
    
    console.log('Sending:', JSON.stringify(validPayload, null, 2));
    const res1 = await makeHttpRequest('POST', '/telemetry', validPayload);
    console.log(`Status: ${res1.status}`);
    console.log(`Response:`, JSON.stringify(res1.body, null, 2));
    
    if (res1.status === 200 || res1.status === 201) {
      console.log('✅ Valid payload accepted\n');
    } else {
      console.log('⚠️  Unexpected status (might be OK if database empty)\n');
    }

    // Test 2: Missing required field (session_id)
    console.log('\nTEST 2: Missing Required Field (session_id)');
    console.log('─'.repeat(60));
    
    const invalidPayload1 = {
      decision_id: uuidv4(),
      timestamp: new Date().toISOString(),
      payload: {
        chapter_id: 'c01',
        scene_id: 'c01-s01',
        option_id: 'c01-s01-o1'
      }
    };
    
    const res2 = await makeHttpRequest('POST', '/telemetry', invalidPayload1);
    console.log(`Status: ${res2.status}`);
    console.log(`Response:`, JSON.stringify(res2.body, null, 2));
    
    if (res2.status === 400 && res2.body.error === 'payload validation failed') {
      console.log('✅ Missing field caught by validation\n');
    } else {
      console.log('❌ Validation should reject missing field\n');
    }

    // Test 3: Invalid UUID format
    console.log('\nTEST 3: Invalid UUID Format');
    console.log('─'.repeat(60));
    
    const invalidPayload2 = {
      session_id: 'not-a-uuid',
      decision_id: uuidv4(),
      timestamp: new Date().toISOString(),
      payload: {
        chapter_id: 'c01',
        scene_id: 'c01-s01',
        option_id: 'c01-s01-o1'
      }
    };
    
    const res3 = await makeHttpRequest('POST', '/telemetry', invalidPayload2);
    console.log(`Status: ${res3.status}`);
    console.log(`Response:`, JSON.stringify(res3.body, null, 2));
    
    if (res3.status === 400 && res3.body.error === 'payload validation failed') {
      console.log('✅ Invalid UUID caught by validation\n');
    } else {
      console.log('❌ Validation should reject invalid UUID\n');
    }

    // Test 4: Invalid chapter_id pattern
    console.log('\nTEST 4: Invalid Chapter ID Pattern');
    console.log('─'.repeat(60));
    
    const invalidPayload3 = {
      session_id: uuidv4(),
      decision_id: uuidv4(),
      timestamp: new Date().toISOString(),
      payload: {
        chapter_id: 'chapter-01',  // Should be c01
        scene_id: 'c01-s01',
        option_id: 'c01-s01-o1'
      }
    };
    
    const res4 = await makeHttpRequest('POST', '/telemetry', invalidPayload3);
    console.log(`Status: ${res4.status}`);
    console.log(`Response:`, JSON.stringify(res4.body, null, 2));
    
    if (res4.status === 400 && res4.body.error === 'payload validation failed') {
      console.log('✅ Invalid pattern caught by validation\n');
    } else {
      console.log('❌ Validation should reject invalid pattern\n');
    }

    // Test 5: Invalid timestamp format
    console.log('\nTEST 5: Invalid Timestamp Format');
    console.log('─'.repeat(60));
    
    const invalidPayload4 = {
      session_id: uuidv4(),
      decision_id: uuidv4(),
      timestamp: '2026/02/23',  // Bad format
      payload: {
        chapter_id: 'c01',
        scene_id: 'c01-s01',
        option_id: 'c01-s01-o1'
      }
    };
    
    const res5 = await makeHttpRequest('POST', '/telemetry', invalidPayload4);
    console.log(`Status: ${res5.status}`);
    console.log(`Response:`, JSON.stringify(res5.body, null, 2));
    
    if (res5.status === 400 && res5.body.error === 'payload validation failed') {
      console.log('✅ Invalid timestamp caught by validation\n');
    } else {
      console.log('❌ Validation should reject invalid timestamp\n');
    }

    console.log('\n✅ Validation middleware testing complete');
    console.log('📊 Summary:');
    console.log('  - Valid payloads should be accepted (200/201)');
    console.log('  - Invalid payloads should return 400 with error details');
    console.log('  - AJV catches format, pattern, and required field violations');

  } catch (err) {
    console.error('❌ Test error:', err.message);
    process.exit(1);
  }
}

runTests();
