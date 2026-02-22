#!/usr/bin/env node
/**
 * Sync chapters.json → Supabase database
 *
 * Usage:
 *   npm run sync-chapters [staging|production]
 *
 *   or directly:
 *   node scripts/sync_chapters.js staging
 *   node scripts/sync_chapters.js production
 *
 * Prerequisites:
 *   - Backend server running on PORT (default: 7070)
 *   - chapters.json in content/ directory
 *   - Admin endpoint /admin/sync-chapters available
 *
 * Output:
 *   - Summary of upserted/inserted records
 *   - Success/error messages
 */

// Load .env variables
try { require('dotenv').config(); } catch (e) { /* dotenv not installed; continue */ }

const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration
const BACKEND_HOST = process.env.BACKEND_HOST || 'localhost';
const BACKEND_PORT = process.env.BACKEND_PORT || 7070;
const BACKEND_PROTOCOL = process.env.BACKEND_PROTOCOL || 'http';
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL; // Priority: use full URL if provided (for ngrok)

const endpoint = BACKEND_BASE_URL ? `${BACKEND_BASE_URL}/admin/sync-chapters` : `${BACKEND_PROTOCOL}://${BACKEND_HOST}:${BACKEND_PORT}/admin/sync-chapters`;

// Parse environment (staging or production)
const env = process.argv[2] || 'staging';
if (!['staging', 'production'].includes(env)) {
  console.error(`❌ Invalid environment: ${env}. Use 'staging' or 'production'.`);
  process.exit(1);
}

console.log(`📚 Syncing chapters to ${env}`);
console.log(`Endpoint: ${endpoint}\n`);

/**
 * Validate chapters.json structure
 */
function validateChapters(data) {
  const errors = [];

  if (!data.chapters || !Array.isArray(data.chapters)) {
    errors.push('chapters array missing or not an array');
    return errors;
  }

  data.chapters.forEach((chapter, chIdx) => {
    if (!chapter.chapter_id) errors.push(`Chapter [${chIdx}]: missing chapter_id`);
    if (!chapter.scenes || !Array.isArray(chapter.scenes)) {
      errors.push(`Chapter ${chapter.chapter_id}: missing scenes array`);
      return;
    }

    chapter.scenes.forEach((scene, sIdx) => {
      const scenePath = `Chapter ${chapter.chapter_id} Scene [${sIdx}]`;
      if (!scene.scene_id) errors.push(`${scenePath}: missing scene_id`);
      if (!scene.options || !Array.isArray(scene.options)) {
        errors.push(`${scenePath}: missing options array`);
        return;
      }

      scene.options.forEach((option, oIdx) => {
        const optionPath = `${scenePath} Option [${oIdx}]`;
        if (!option.option_id) errors.push(`${optionPath}: missing option_id`);
        if (!option.option_text) errors.push(`${optionPath}: missing option_text`);
        if (option.consequence === undefined) errors.push(`${optionPath}: missing consequence`);

        // Validate mappings
        const gdsMaps = option.gds_mapping || [];
        const phqMaps = option.phq_mapping || [];

        gdsMaps.forEach((m, mIdx) => {
          const mapPath = `${optionPath} GDS mapping [${mIdx}]`;
          if (!m.item) errors.push(`${mapPath}: missing item`);
          if (m.weight === undefined) errors.push(`${mapPath}: missing weight`);
          if (m.confidence === undefined) errors.push(`${mapPath}: missing confidence`);
          if (!m.rationale) errors.push(`${mapPath}: missing rationale`);
          if (m.item && (m.item < 1 || m.item > 15)) {
            errors.push(`${mapPath}: GDS item must be 1-15, got ${m.item}`);
          }
        });

        phqMaps.forEach((m, mIdx) => {
          const mapPath = `${optionPath} PHQ mapping [${mIdx}]`;
          if (!m.item) errors.push(`${mapPath}: missing item`);
          if (m.weight === undefined) errors.push(`${mapPath}: missing weight`);
          if (m.confidence === undefined) errors.push(`${mapPath}: missing confidence`);
          if (!m.rationale) errors.push(`${mapPath}: missing rationale`);
          if (m.item && (m.item < 1 || m.item > 9)) {
            errors.push(`${mapPath}: PHQ item must be 1-9, got ${m.item}`);
          }
        });
      });
    });
  });

  return errors;
}

/**
 * Make POST request to backend
 */
async function callSyncEndpoint() {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const protocolModule = url.protocol === 'https:' ? require('https') : http;
    const req = protocolModule.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify({})); // Empty body; endpoint reads chapters.json from file
    req.end();
  });
}

/**
 * Main execution
 */
(async () => {
  try {
    // Load and validate chapters.json
    const chaptersPath = path.join(__dirname, '..', 'content', 'chapters.json');
    if (!fs.existsSync(chaptersPath)) {
      console.error(`❌ chapters.json not found at ${chaptersPath}`);
      process.exit(1);
    }

    console.log(`📖 Loading chapters.json...`);
    const chaptersData = JSON.parse(fs.readFileSync(chaptersPath, 'utf8'));

    console.log(`✅ Loaded ${chaptersData.chapters.length} chapter(s)`);

    // Validate
    const errors = validateChapters(chaptersData);
    if (errors.length > 0) {
      console.error(`\n❌ Validation errors found:\n`);
      errors.forEach(e => console.error(`  - ${e}`));
      process.exit(1);
    }

    console.log(`✅ Validation passed\n`);

    // Count items
    let scenesCount = 0;
    let optionsCount = 0;
    let mappingsCount = 0;
    chaptersData.chapters.forEach(ch => {
      ch.scenes.forEach(sc => {
        scenesCount++;
        sc.options.forEach(opt => {
          optionsCount++;
          mappingsCount += (opt.gds_mapping || []).length + (opt.phq_mapping || []).length;
        });
      });
    });

    console.log(`📊 Summary of content:`);
    console.log(`  - Chapters:           ${chaptersData.chapters.length}`);
    console.log(`  - Scenes:             ${scenesCount}`);
    console.log(`  - Options:            ${optionsCount}`);
    console.log(`  - Clinical Mappings:  ${mappingsCount}\n`);

    // Call sync endpoint
    console.log(`🔄 Calling sync endpoint: ${endpoint}`);
    const response = await callSyncEndpoint();

    if (response.status === 200 && response.body.ok) {
      console.log(`\n✅ Sync successful!\n`);
      console.log(`📈 Results:`);
      console.log(`  - Chapters upserted:           ${response.body.chapters_upserted}`);
      console.log(`  - Scenes upserted:             ${response.body.scenes_upserted}`);
      console.log(`  - Options upserted:            ${response.body.options_upserted}`);
      console.log(`  - Clinical mappings inserted:  ${response.body.clinical_mappings_inserted}\n`);

      console.log(`🎉 All done! Your chapters are now in the database.`);
      process.exit(0);
    } else {
      console.error(`\n❌ Sync failed!`);
      console.error(`Status: ${response.status}`);
      console.error(`Response:`, JSON.stringify(response.body, null, 2));
      process.exit(1);
    }
  } catch (err) {
    console.error(`\n❌ Error:`, err.message);
    console.error(`\nTroubleshooting:`);
    console.error(`  - Is the backend running? (npm run dev on port ${BACKEND_PORT})`);
    console.error(`  - Is chapters.json valid JSON?`);
    console.error(`  - Are you on the right network/host?`);
    process.exit(1);
  }
})();
