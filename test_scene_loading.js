const fs = require('fs');
const path = require('path');

function testStoryLoading() {
  console.log('=== Test de carga de historias ===\n');
  
  const contentDir = path.join(__dirname, 'backend', 'content', 'latam');
  const storyFiles = fs.readdirSync(contentDir).filter(f => f.startsWith('story_') && f.endsWith('.json'));
  
  for (const file of storyFiles) {
    const filePath = path.join(contentDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const story = JSON.parse(content);
      
      // Simulate server loading
      if (!story.chapters || !Array.isArray(story.chapters)) {
        console.error(`✗ ${file}: No chapters array`);
        continue;
      }
      
      // Check first chapter
      const ch = story.chapters[0];
      if (!ch) {
        console.error(`✗ ${file}: No first chapter`);
        continue;
      }
      
      // Check first and second scenes
      const s1 = ch.scenes && ch.scenes[0];
      const s2 = ch.scenes && ch.scenes[1];
      
      if (!s1 || !s2) {
        console.error(`✗ ${file}: Missing scenes in chapter 1`);
        continue;
      }
      
      // Validate options in scene 2
      const opts = s2.options || [];
      if (opts.length === 0) {
        console.warn(`⚠ ${file}: Scene c01-s02 has no options`);
        continue;
      }
      
      // Check each option
      let hasError = false;
      for (let i = 0; i < opts.length; i++) {
        const opt = opts[i];
        if (!opt.option_id || !opt.option_text) {
          console.error(`✗ ${file}: Scene c01-s02 option ${i} missing id or text`);
          hasError = true;
        }
        if (!opt.next_scene_id && !opt.next_chapter_id) {
          console.error(`✗ ${file}: Scene c01-s02 option ${i} missing navigation`);
          hasError = true;
        }
        // Check if next scene exists
        if (opt.next_scene_id) {
          const nextScene = ch.scenes.find(s => s.scene_id === opt.next_scene_id);
          if (!nextScene) {
            console.warn(`⚠ ${file}: Scene c01-s02 option ${i} → ${opt.next_scene_id} NOT FOUND in chapter`);
          }
        }
      }
      
      if (!hasError) {
        console.log(`✓ ${file}: Scene c01-s02 estructura OK (${opts.length} options)`);
        opts.forEach((opt, i) => {
          const nav = opt.next_scene_id ? `→ ${opt.next_scene_id}` : `→ ${opt.next_chapter_id}`;
          console.log(`    ${i + 1}. "${opt.option_text.substring(0, 40)}" ${nav}`);
        });
      }
      
    } catch (error) {
      console.error(`✗ ${file}: ${error.message}`);
    }
  }
}

testStoryLoading();
