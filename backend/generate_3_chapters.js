/**
 * Generate 3 chapters rapidly using Free LLM (Mock provider)
 * Expected time: ~3-5 seconds total (sub-1 second per chapter)
 */

const http = require('http');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

function generateUUID() {
  return crypto.randomUUID();
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || "https://yibyszcsmncrmvkalvbz.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_1RkeVWFsuZnUaxo7aXXCPg_eOhtHb7-"
);

async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 7070,
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
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('🚀 Generating 3 chapters with free LLM...\n');

  try {
    // 1. Health check
    console.log('📋 1. Checking LLM provider...');
    const health = await request('GET', '/admin/llm-health');
    if (!health.ok) {
      console.error('❌ LLM provider not ready:', health);
      process.exit(1);
    }
    console.log('✅ Provider ready! Model:', health.models?.[0] || 'mock\n');

    // 2. Create test sessions in Supabase
    console.log('📋 2. Creating 3 test sessions in database...');
    const sessionIds = [];
    for (let i = 0; i < 3; i++) {
      const sessionId = generateUUID();
      const { error: sessionErr } = await supabase.from('sessions').insert([{
        session_id: sessionId,
        pseudonym: `User_${i + 1}`,
        chapter_id: 'c01',
        metadata: { created_by: 'generator', batch: 'test' }
      }]);
      
      if (sessionErr) {
        console.error(`❌ Session ${i + 1} creation failed:`, sessionErr.message);
        continue;
      }
      sessionIds.push(sessionId);
      console.log(`   ✅ Session ${i + 1}: ${sessionId}`);
    }
    console.log();

    if (sessionIds.length === 0) {
      console.error('❌ No sessions created!');
      process.exit(1);
    }

    // 3. Generate 3 chapters sequentially from c01
    console.log(`📋 3. Generating ${sessionIds.length} chapters sequentially (c02, c03, c04)...\n`);
    
    const chapters = [];
    const startTime = Date.now();

    // Generate chapters sequentially (not in parallel) to maintain order
    for (let i = 0; i < sessionIds.length; i++) {
      const sessionId = sessionIds[i];
      const chapterNum = i + 2; // c02, c03, c04
      
      console.log(`   ⏳ Generating chapter c0${chapterNum}...`);
      
      const result = await request('POST', '/chapters/generate', {
        session_id: sessionId,
        user_decision: 'Acercarte a Carmen',
        clinical_context: {
          gds_score: 8,
          phq_score: 12
        }
      }).catch(e => ({ error: e.message }));

      if (result.error) {
        console.log(`   ❌ Chapter c0${chapterNum}: Error - ${result.error}`);
      } else if (result.ok) {
        const chapter = result.chapter;
        const options = result.chapter.options || [];
        const mappings = options.length * 2; // GDS + PHQ per option
        console.log(`   ✅ Chapter ${chapter.chapter_id}: ${chapter.title}`);
        console.log(`      Options: ${options.length}, Clinical Mappings: ${mappings}`);
        chapters.push(chapter);
      } else {
        console.log(`   ❌ Chapter c0${chapterNum}: Unexpected response`);
      }
    }
    
    const totalTime = Date.now() - startTime;

    console.log(`⏱️  Total time for ${sessionIds.length} chapters: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
    console.log(`📊 Average: ${(totalTime / sessionIds.length).toFixed(0)}ms per chapter`);
    
    if (chapters.length === sessionIds.length) {
      console.log(`\n✅ SUCCESS! All ${chapters.length} chapters generated`);
      console.log('💰 Cost: $0 (100% FREE)');
    } else {
      console.log(`\n⚠️ Only ${chapters.length}/${sessionIds.length} chapters generated successfully`);
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

// Give server time to start, then run test
setTimeout(main, 2000);
