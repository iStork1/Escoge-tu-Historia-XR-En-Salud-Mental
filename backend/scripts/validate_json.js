// Phase 1: JSON integrity validation for LATAM story files
const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, '../content/latam');
const OUTPUT_FILE = path.join(__dirname, 'output/validation_json.txt');

const STORY_FILES = [
  'story_alberto_ajedrez.json',
  'story_ernesto_taller.json',
  'story_mariana_huerto.json',
  'story_tatiana_taller.json',
];

const REQUIRED_SCENE_FIELDS = ['scene_id', 'text', 'options'];
const REQUIRED_OPTION_FIELDS = [
  'option_id', 'option_text', 'consequence',
  'next_scene_id', 'next_chapter_id', 'gds_mapping', 'phq_mapping',
];

// Scenes that are referenced but don't exist because they're chapter-end markers
// (the last scene of each chapter points to {chapterId}-s{N+1} to signal chapter completion)
// These are detected dynamically per story file.

function validateStoryFile(filePath, storyName) {
  const errors = [];
  const warnings = [];
  const infos = [];

  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    errors.push(`CANNOT_READ: ${e.message}`);
    return { errors, warnings, infos };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    errors.push(`INVALID_JSON: ${e.message}`);
    return { errors, warnings, infos };
  }

  if (!data.chapters || !Array.isArray(data.chapters)) {
    errors.push('MISSING_CHAPTERS_ARRAY: root.chapters not found or not an array');
    return { errors, warnings, infos };
  }

  const allSceneIds = new Set();
  const allSceneIdsList = [];

  // First pass: collect all scene_ids and build chapter-end markers
  const chapterEndRefs = new Set(); // intentional "next" refs that don't exist
  for (const chapter of data.chapters) {
    if (!chapter.scenes || !Array.isArray(chapter.scenes)) continue;
    let maxSceneNum = 0;
    for (const scene of chapter.scenes) {
      if (scene.scene_id) {
        allSceneIdsList.push(scene.scene_id);
        allSceneIds.add(scene.scene_id);
        const m = scene.scene_id.match(/-s(\d+)$/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxSceneNum) maxSceneNum = n;
        }
      }
    }
    // The scene one past the last existing scene is the chapter-end marker
    if (chapter.chapter_id && maxSceneNum > 0) {
      const nextNum = String(maxSceneNum + 1).padStart(2, '0');
      chapterEndRefs.add(`${chapter.chapter_id}-s${nextNum}`);
      chapterEndRefs.add(`${chapter.chapter_id}-s${maxSceneNum + 1}`);
    }
  }

  // Check scene_id uniqueness
  const seen = new Set();
  for (const sid of allSceneIdsList) {
    if (seen.has(sid)) {
      errors.push(`DUPLICATE_SCENE_ID: "${sid}"`);
    }
    seen.add(sid);
  }

  // Second pass: full validation
  for (const chapter of data.chapters) {
    const chapterId = chapter.chapter_id || 'UNKNOWN_CHAPTER';

    if (!chapter.chapter_id) {
      errors.push(`${chapterId}: missing chapter_id`);
    }
    if (!chapter.scenes || !Array.isArray(chapter.scenes)) {
      errors.push(`${chapterId}: missing or invalid scenes array`);
      continue;
    }

    for (const scene of chapter.scenes) {
      const sceneId = scene.scene_id || `${chapterId}-UNKNOWN`;

      // Required scene fields
      for (const field of REQUIRED_SCENE_FIELDS) {
        if (scene[field] === undefined || scene[field] === null) {
          errors.push(`${sceneId}: missing field "${field}"`);
        }
      }

      // options must be non-empty array
      if (!Array.isArray(scene.options) || scene.options.length === 0) {
        errors.push(`${sceneId}: options is empty or not an array`);
        continue;
      }

      for (const opt of scene.options) {
        const optId = opt.option_id || `${sceneId}-UNKNOWN_OPT`;

        // Required option fields
        for (const field of REQUIRED_OPTION_FIELDS) {
          if (opt[field] === undefined) {
            errors.push(`${optId}: missing field "${field}"`);
          }
        }

        // next_scene_id chain validation
        if (opt.next_scene_id !== null && opt.next_scene_id !== undefined) {
          if (!opt.next_chapter_id) {
            // Should resolve within same story
            if (chapterEndRefs.has(opt.next_scene_id)) {
              infos.push(`${optId}: next_scene_id="${opt.next_scene_id}" is intentional chapter/story endpoint`);
            } else if (!allSceneIds.has(opt.next_scene_id)) {
              errors.push(`${optId}: next_scene_id="${opt.next_scene_id}" does not exist in this story`);
            }
          }
        }

        // gds_mapping must be array
        if (!Array.isArray(opt.gds_mapping)) {
          errors.push(`${optId}: gds_mapping is not an array`);
        }
        // phq_mapping must be array (can be empty)
        if (!Array.isArray(opt.phq_mapping)) {
          errors.push(`${optId}: phq_mapping is not an array`);
        }
      }
    }
  }

  return { errors, warnings, infos };
}

function run() {
  const lines = [];
  const timestamp = new Date().toISOString();
  lines.push(`VALIDATION REPORT — Phase 1: JSON Integrity`);
  lines.push(`Generated: ${timestamp}`);
  lines.push(`Stories directory: ${CONTENT_DIR}`);
  lines.push('='.repeat(70));

  let globalErrorCount = 0;

  for (const file of STORY_FILES) {
    const filePath = path.join(CONTENT_DIR, file);
    const storyName = file.replace('.json', '');
    lines.push('');
    lines.push(`Story: ${storyName}`);
    lines.push('-'.repeat(50));

    const { errors, warnings, infos } = validateStoryFile(filePath, storyName);

    if (errors.length === 0) {
      lines.push(`STATUS: ✓ VALID`);
    } else {
      lines.push(`STATUS: ✗ INVALID (${errors.length} errors)`);
      globalErrorCount += errors.length;
    }

    if (infos.length > 0) {
      lines.push(`INFO (${infos.length}):`);
      infos.forEach(m => lines.push(`  [INFO] ${m}`));
    }
    if (warnings.length > 0) {
      lines.push(`WARNINGS (${warnings.length}):`);
      warnings.forEach(m => lines.push(`  [WARN] ${m}`));
    }
    if (errors.length > 0) {
      lines.push(`ERRORS (${errors.length}):`);
      errors.forEach(m => lines.push(`  [ERROR] ${m}`));
    }
  }

  lines.push('');
  lines.push('='.repeat(70));
  if (globalErrorCount === 0) {
    lines.push('RESULT: All files valid — proceed to Phase 2');
  } else {
    lines.push(`RESULT: BLOCKED — ${globalErrorCount} total errors found. Fix before proceeding.`);
  }

  const output = lines.join('\n');
  fs.writeFileSync(OUTPUT_FILE, output, 'utf8');
  console.log(output);
  process.exit(globalErrorCount > 0 ? 1 : 0);
}

run();
