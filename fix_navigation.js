const fs = require('fs');
const path = require('path');

function fixMissingNavigation(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const story = JSON.parse(content);
    let fixCount = 0;

    story.chapters.forEach((chapter, chIdx) => {
      if (Array.isArray(chapter.scenes)) {
        chapter.scenes.forEach((scene, scIdx) => {
          if (Array.isArray(scene.options)) {
            scene.options.forEach((option, optIdx) => {
              // Check if option has neither next_scene_id nor next_chapter_id
              const hasNextSceneId = option.next_scene_id !== null && option.next_scene_id !== undefined && option.next_scene_id !== '';
              const hasNextChapterId = option.next_chapter_id !== null && option.next_chapter_id !== undefined && option.next_chapter_id !== '';

              if (!hasNextSceneId && !hasNextChapterId) {
                // This is the issue - no navigation defined
                // Extract scene number from scene_id (e.g., "c01-s09" -> 09)
                const sceneMatch = scene.scene_id.match(/s(\d+)$/);
                if (sceneMatch) {
                  const sceneNum = parseInt(sceneMatch[1]);
                  // Assume if it's the last playable scene, move to next chapter
                  // Otherwise, move to next scene
                  if (sceneNum === 9 || sceneNum >= 9) {
                    // End of chapter - move to next chapter
                    const chapMatch = chapter.chapter_id.match(/c(\d+)$/);
                    if (chapMatch) {
                      const chapNum = parseInt(chapMatch[1]);
                      const nextCha = `c${String(chapNum + 1).padStart(2, '0')}`;
                      option.next_chapter_id = nextCha;
                      fixCount++;
                      console.log(`  Fixed: ${scene.scene_id} option ${optIdx} → next_chapter_id: ${nextCha}`);
                    }
                  } else {
                    // Move to next scene
                    const nextSceneNum = sceneNum + 1;
                    const nextSceneId = scene.scene_id.replace(/s\d+$/, `s${String(nextSceneNum).padStart(2, '0')}`);
                    option.next_scene_id = nextSceneId;
                    fixCount++;
                    console.log(`  Fixed: ${scene.scene_id} option ${optIdx} → next_scene_id: ${nextSceneId}`);
                  }
                }
              }
            });
          }
        });
      }
    });

    if (fixCount > 0) {
      fs.writeFileSync(filePath, JSON.stringify(story, null, 2), 'utf8');
      console.log(`✓ ${path.basename(filePath)}: ${fixCount} opciones arregladas\n`);
    } else {
      console.log(`✓ ${path.basename(filePath)}: sin cambios necesarios\n`);
    }
    return fixCount;
  } catch (error) {
    console.error(`✗ ${path.basename(filePath)} - ERROR: ${error.message}\n`);
    return 0;
  }
}

console.log('=== Arreglando navegación faltante en opciones ===\n');

const latamDir = path.join(__dirname, 'backend', 'content', 'latam');
const spainDir = path.join(__dirname, 'backend', 'content', 'spain');

const files = [
  ...fs.readdirSync(latamDir).filter(f => f.endsWith('.json')).map(f => path.join(latamDir, f)),
  ...fs.readdirSync(spainDir).filter(f => f.endsWith('.json')).map(f => path.join(spainDir, f))
];

let totalFixed = 0;
for (const file of files) {
  totalFixed += fixMissingNavigation(file);
}

console.log(`=== RESUMEN ===`);
console.log(`Total de opciones arregladas: ${totalFixed}`);
