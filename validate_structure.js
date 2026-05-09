const fs = require('fs');
const path = require('path');

function validateStoryStructure(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const story = JSON.parse(content);
    const fileName = path.basename(filePath);
    const errors = [];
    const warnings = [];

    // Check chapters structure
    if (!Array.isArray(story.chapters)) {
      errors.push('Root "chapters" is not an array');
    } else {
      story.chapters.forEach((chapter, chIdx) => {
        if (!chapter.chapter_id) errors.push(`Chapter ${chIdx}: missing chapter_id`);
        if (!chapter.title) errors.push(`Chapter ${chIdx}: missing title`);
        if (!Array.isArray(chapter.scenes)) {
          errors.push(`Chapter ${chIdx} (${chapter.chapter_id}): scenes is not an array`);
        } else {
          chapter.scenes.forEach((scene, scIdx) => {
            if (!scene.scene_id) errors.push(`Scene ${scIdx} in chapter ${chapter.chapter_id}: missing scene_id`);
            if (!scene.title) errors.push(`Scene ${scIdx} in chapter ${chapter.chapter_id}: missing title`);
            if (!scene.text) warnings.push(`Scene ${scIdx} in chapter ${chapter.chapter_id}: missing text`);
            
            if (!Array.isArray(scene.options)) {
              errors.push(`Scene ${scIdx} (${scene.scene_id}) in chapter ${chapter.chapter_id}: options is not an array`);
            } else {
              if (scene.options.length === 0) {
                warnings.push(`Scene ${scIdx} (${scene.scene_id}) in chapter ${chapter.chapter_id}: no options available`);
              } else if (scene.options.length > 3) {
                warnings.push(`Scene ${scIdx} (${scene.scene_id}) in chapter ${chapter.chapter_id}: has ${scene.options.length} options (Alexa max is 3)`);
              }

              scene.options.forEach((opt, optIdx) => {
                if (!opt.option_id) errors.push(`Option ${optIdx} in scene ${scene.scene_id}: missing option_id`);
                if (!opt.option_text) errors.push(`Option ${optIdx} in scene ${scene.scene_id}: missing option_text`);
                if (!opt.consequence) warnings.push(`Option ${optIdx} in scene ${scene.scene_id}: missing consequence`);
                if (!opt.next_scene_id && !opt.next_chapter_id) {
                  warnings.push(`Option ${optIdx} in scene ${scene.scene_id}: neither next_scene_id nor next_chapter_id defined`);
                }
              });
            }
          });
        }
      });
    }

    // Report
    if (errors.length === 0 && warnings.length === 0) {
      console.log(`✓ ${fileName} - Estructura válida`);
      return true;
    } else {
      if (errors.length > 0) {
        console.error(`✗ ${fileName} - ERRORES CRÍTICOS:`);
        errors.forEach(e => console.error(`  - ${e}`));
      }
      if (warnings.length > 0) {
        console.warn(`⚠ ${fileName} - Advertencias:`);
        warnings.slice(0, 5).forEach(w => console.warn(`  - ${w}`));
        if (warnings.length > 5) console.warn(`  ... y ${warnings.length - 5} advertencias más`);
      }
      return errors.length === 0;
    }
  } catch (error) {
    console.error(`✗ ${path.basename(filePath)} - ERROR: ${error.message}`);
    return false;
  }
}

console.log('=== Validación de estructura de historias ===\n');

const latamDir = path.join(__dirname, 'backend', 'content', 'latam');
const spainDir = path.join(__dirname, 'backend', 'content', 'spain');

const files = [
  ...fs.readdirSync(latamDir).filter(f => f.endsWith('.json')).map(f => path.join(latamDir, f)),
  ...fs.readdirSync(spainDir).filter(f => f.endsWith('.json')).map(f => path.join(spainDir, f))
];

let valid = 0;
for (const file of files) {
  if (validateStoryStructure(file)) {
    valid++;
  }
}

console.log(`\n=== RESUMEN ===`);
console.log(`Válidos: ${valid}/${files.length}`);
