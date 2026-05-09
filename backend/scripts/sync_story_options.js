#!/usr/bin/env node
/**
 * Sync story options to Supabase database
 * 
 * This script reads all story JSON files and ensures all options
 * are registered in the database for foreign key constraints.
 */

try { require('dotenv').config(); } catch (e) { /* dotenv not installed; continue */ }

const fs = require('fs');
const path = require('path');

// Import Supabase
let createClient;
try {
  ({ createClient } = require('@supabase/supabase-js'));
} catch (e) {
  console.error('❌ @supabase/supabase-js not installed');
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function syncOptions() {
  console.log('=== Sincronizando opciones a Supabase ===\n');

  const latamDir = path.join(__dirname, '..', 'content', 'latam');
  const spainDir = path.join(__dirname, '..', 'content', 'spain');

  const allOptions = [];
  let processedChapters = 0;
  let processedScenes = 0;

  // Helper to collect options from a story
  function collectFromStory(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const story = JSON.parse(content);
      const fileName = path.basename(filePath);

      if (!story.chapters || !Array.isArray(story.chapters)) {
        console.warn(`⚠ ${fileName}: sin capítulos`);
        return;
      }

      story.chapters.forEach((chapter) => {
        processedChapters++;
        if (!chapter.scenes || !Array.isArray(chapter.scenes)) return;

        chapter.scenes.forEach((scene) => {
          processedScenes++;
          if (!scene.options || !Array.isArray(scene.options)) return;

          scene.options.forEach((option) => {
            allOptions.push({
              option_id: option.option_id,
              option_text: option.option_text,
              consequence: option.consequence || null,
              gds_mapping: option.gds_mapping || [],
              phq_mapping: option.phq_mapping || []
            });
          });
        });
      });

      console.log(`✓ ${fileName}: ${story.chapters.length} capítulos procesados`);
    } catch (error) {
      console.error(`✗ ${path.basename(filePath)}: ${error.message}`);
    }
  }

  // Collect from both directories
  const latamFiles = fs.readdirSync(latamDir).filter(f => f.endsWith('.json'));
  const spainFiles = fs.readdirSync(spainDir).filter(f => f.endsWith('.json'));

  console.log('Leyendo archivos...\n');
  latamFiles.forEach(f => collectFromStory(path.join(latamDir, f)));
  spainFiles.forEach(f => collectFromStory(path.join(spainDir, f)));

  console.log(`\n✓ Recolectadas ${allOptions.length} opciones de ${processedChapters} capítulos y ${processedScenes} escenas\n`);

  // Remove duplicates (options might be in both latam and spain versions)
  const uniqueOptions = {};
  allOptions.forEach(opt => {
    uniqueOptions[opt.option_id] = opt;
  });

  const optionsToSync = Object.values(uniqueOptions);
  console.log(`📦 ${optionsToSync.length} opciones únicas para sincronizar\n`);

  // Upsert options to database
  console.log('Sincronizando a Supabase...\n');

  const { data, error } = await supabase
    .from('options')
    .upsert(
      optionsToSync.map(opt => ({
        option_id: opt.option_id,
        option_text: opt.option_text,
        consequence: opt.consequence,
        gds_mapping: opt.gds_mapping,
        phq_mapping: opt.phq_mapping
      })),
      { onConflict: 'option_id' }
    );

  if (error) {
    console.error(`❌ Error al sincronizar: ${error.message}`);
    console.error(error);
    process.exit(1);
  }

  console.log(`✅ Sincronización completada`);
  console.log(`   - ${optionsToSync.length} opciones procesadas`);
  
  if (data) {
    console.log(`   - Registros: ${data.length}`);
  }

  // Verify
  const { count, error: countError } = await supabase
    .from('options')
    .select('*', { count: 'exact', head: true });

  if (!countError && count) {
    console.log(`   - Total en BD: ${count} opciones`);
  }

  console.log('\n✅ Sincronización exitosa');
  process.exit(0);
}

syncOptions().catch(error => {
  console.error('❌ Error fatal:', error.message);
  process.exit(1);
});
