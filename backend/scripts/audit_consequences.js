// Phase 2: Consequence audit — verify 3-sentence rule across all options
const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, '../content/latam');
const OUTPUT_FILE = path.join(__dirname, 'output/audit_consequences.json');

const STORY_FILES = [
  'story_alberto_ajedrez.json',
  'story_ernesto_taller.json',
  'story_mariana_huerto.json',
  'story_tatiana_taller.json',
];

const MIN_SENTENCES = 2;
const MAX_SENTENCES = 4;

function countSentences(text) {
  if (!text || text.trim().length === 0) return 0;
  // Strip quoted dialogue before counting — periods inside dialogue quotes
  // ('...', “...”, «...») are part of one narrative sentence, not multiple
  const stripped = text
    .replace(/'[^']{1,200}'/g, 'X')
    .replace(/‘[^’]{1,200}’/g, 'X')
    .replace(/”[^”]{1,200}”/g, 'X')
    .replace(/“[^”]{1,200}”/g, 'X')
    .replace(/«[^»]{1,200}»/g, 'X');
  return (stripped.match(/\./g) || []).length;
}

function auditStory(filePath, storyName) {
  const violations = [];
  let totalOptions = 0;

  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);

  for (const chapter of data.chapters) {
    const chapterId = chapter.chapter_id;
    for (const scene of chapter.scenes) {
      const sceneId = scene.scene_id;
      for (const opt of scene.options) {
        totalOptions++;
        const consequence = opt.consequence || '';
        const count = countSentences(consequence);
        if (count < MIN_SENTENCES || count > MAX_SENTENCES) {
          violations.push({
            story: storyName,
            chapter_id: chapterId,
            scene_id: sceneId,
            option_id: opt.option_id,
            sentence_count: count,
            consequence_preview: consequence.substring(0, 120) + (consequence.length > 120 ? '...' : ''),
          });
        }
      }
    }
  }

  return { totalOptions, violations };
}

function run() {
  const results = {
    generated: new Date().toISOString(),
    phase: 'Phase 2: Consequence Audit',
    rule: `sentences in [${MIN_SENTENCES}, ${MAX_SENTENCES}]`,
    summary: {},
    violations: [],
  };

  let grandTotal = 0;
  let grandViolations = 0;

  for (const file of STORY_FILES) {
    const storyName = file.replace('.json', '');
    const filePath = path.join(CONTENT_DIR, file);
    const { totalOptions, violations } = auditStory(filePath, storyName);

    grandTotal += totalOptions;
    grandViolations += violations.length;

    results.summary[storyName] = {
      total_options: totalOptions,
      violations: violations.length,
      pass_rate: `${(((totalOptions - violations.length) / totalOptions) * 100).toFixed(1)}%`,
    };

    results.violations.push(...violations);

    const status = violations.length === 0 ? '✓ PASS' : `✗ ${violations.length} violations`;
    console.log(`${storyName}: ${status} (${totalOptions} options audited)`);
  }

  results.totals = {
    total_options_audited: grandTotal,
    total_violations: grandViolations,
    overall_pass_rate: `${(((grandTotal - grandViolations) / grandTotal) * 100).toFixed(1)}%`,
    result: grandViolations === 0 ? 'PASS — proceed to Phase 3' : `VIOLATIONS FOUND — review before proceeding`,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nTotal: ${grandViolations} violations out of ${grandTotal} options`);
  console.log(`Output: ${OUTPUT_FILE}`);
  process.exit(grandViolations > 0 ? 1 : 0);
}

run();
