// Phase 3: Clinical mappings validation — ranges, thresholds, risk triggers
const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, '../content/latam');
const OUTPUT_FILE = path.join(__dirname, 'output/audit_mappings.json');

const STORY_FILES = [
  'story_alberto_ajedrez.json',
  'story_ernesto_taller.json',
  'story_mariana_huerto.json',
  'story_tatiana_taller.json',
];

// Calibrated thresholds v2026_04
const GDS7_RISK_THRESHOLD = 0.26;
const PHQ9_ITEM9_RISK_THRESHOLD = 0.18;

function validateMapping(mapping, scale, optId, errors, riskTriggers) {
  const maxItem = scale === 'GDS' ? 15 : 9;
  for (const m of mapping) {
    if (m.item === undefined || m.item < 1 || m.item > maxItem) {
      errors.push({ option_id: optId, issue: `${scale} item "${m.item}" out of range [1,${maxItem}]` });
    }
    if (m.weight === undefined || m.weight < -1 || m.weight > 1) {
      errors.push({ option_id: optId, issue: `${scale} item ${m.item}: weight "${m.weight}" out of range [-1,1]` });
    }
    if (m.confidence === undefined || m.confidence < 0 || m.confidence > 1) {
      errors.push({ option_id: optId, issue: `${scale} item ${m.item}: confidence "${m.confidence}" out of range [0,1]` });
    }

    const score = (m.weight || 0) * (m.confidence || 0);

    if (scale === 'GDS' && m.item === 7 && score >= GDS7_RISK_THRESHOLD) {
      riskTriggers.push({
        option_id: optId, scale: 'GDS', item: 7,
        weight: m.weight, confidence: m.confidence,
        score: parseFloat(score.toFixed(4)),
        threshold: GDS7_RISK_THRESHOLD,
        label: 'SOCIAL_ISOLATION_TRIGGER',
      });
    }
    if (scale === 'PHQ' && m.item === 9 && score >= PHQ9_ITEM9_RISK_THRESHOLD) {
      riskTriggers.push({
        option_id: optId, scale: 'PHQ', item: 9,
        weight: m.weight, confidence: m.confidence,
        score: parseFloat(score.toFixed(4)),
        threshold: PHQ9_ITEM9_RISK_THRESHOLD,
        label: 'SELFHARM_TRIGGER — REVIEW REQUIRED',
      });
    }
  }
}

function auditStory(filePath, storyName) {
  const errors = [];
  const riskTriggers = [];
  const stats = {
    total_options: 0,
    options_with_gds: 0,
    options_with_phq: 0,
    options_with_empty_phq: 0,
    gds_item_distribution: {},
    phq_item_distribution: {},
    gds_weights: [],
    phq_weights: [],
    gds_confidences: [],
    phq_confidences: [],
  };

  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);

  for (const chapter of data.chapters) {
    for (const scene of chapter.scenes) {
      for (const opt of scene.options) {
        stats.total_options++;
        const optId = opt.option_id;

        // GDS mapping
        if (Array.isArray(opt.gds_mapping) && opt.gds_mapping.length > 0) {
          stats.options_with_gds++;
          validateMapping(opt.gds_mapping, 'GDS', optId, errors, riskTriggers);
          for (const m of opt.gds_mapping) {
            const key = `GDS-${m.item}`;
            stats.gds_item_distribution[key] = (stats.gds_item_distribution[key] || 0) + 1;
            if (typeof m.weight === 'number') stats.gds_weights.push(m.weight);
            if (typeof m.confidence === 'number') stats.gds_confidences.push(m.confidence);
          }
        }

        // PHQ mapping
        if (Array.isArray(opt.phq_mapping)) {
          if (opt.phq_mapping.length > 0) {
            stats.options_with_phq++;
            validateMapping(opt.phq_mapping, 'PHQ', optId, errors, riskTriggers);
            for (const m of opt.phq_mapping) {
              const key = `PHQ-${m.item}`;
              stats.phq_item_distribution[key] = (stats.phq_item_distribution[key] || 0) + 1;
              if (typeof m.weight === 'number') stats.phq_weights.push(m.weight);
              if (typeof m.confidence === 'number') stats.phq_confidences.push(m.confidence);
            }
          } else {
            stats.options_with_empty_phq++;
          }
        }
      }
    }
  }

  const avg = arr => arr.length === 0 ? null : parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(4));

  return {
    errors,
    riskTriggers,
    stats: {
      total_options: stats.total_options,
      options_with_gds: stats.options_with_gds,
      options_with_phq: stats.options_with_phq,
      options_with_empty_phq: stats.options_with_empty_phq,
      gds_item_distribution: stats.gds_item_distribution,
      phq_item_distribution: stats.phq_item_distribution,
      avg_gds_weight: avg(stats.gds_weights),
      avg_phq_weight: avg(stats.phq_weights),
      avg_gds_confidence: avg(stats.gds_confidences),
      avg_phq_confidence: avg(stats.phq_confidences),
    },
  };
}

function run() {
  const results = {
    generated: new Date().toISOString(),
    phase: 'Phase 3: Clinical Mappings Validation',
    thresholds: { GDS7_RISK: GDS7_RISK_THRESHOLD, PHQ9_ITEM9_RISK: PHQ9_ITEM9_RISK_THRESHOLD },
    per_story: {},
    all_errors: [],
    all_risk_triggers: [],
    summary: {},
  };

  let grandErrors = 0;
  let grandTriggers = 0;
  let phq9Selfharm = 0;

  for (const file of STORY_FILES) {
    const storyName = file.replace('.json', '');
    const filePath = path.join(CONTENT_DIR, file);
    const { errors, riskTriggers, stats } = auditStory(filePath, storyName);

    grandErrors += errors.length;
    grandTriggers += riskTriggers.length;
    phq9Selfharm += riskTriggers.filter(t => t.label.includes('SELFHARM')).length;

    results.per_story[storyName] = { stats, errors, risk_triggers: riskTriggers };
    results.all_errors.push(...errors);
    results.all_risk_triggers.push(...riskTriggers);

    const statusParts = [];
    if (errors.length === 0) statusParts.push('✓ No range errors');
    else statusParts.push(`✗ ${errors.length} range errors`);
    if (riskTriggers.length > 0) statusParts.push(`⚠ ${riskTriggers.length} risk triggers`);
    console.log(`${storyName}: ${statusParts.join(' | ')} (${stats.total_options} options)`);
  }

  results.summary = {
    total_range_errors: grandErrors,
    total_risk_triggers: grandTriggers,
    phq9_selfharm_triggers: phq9Selfharm,
    result: grandErrors === 0
      ? (phq9Selfharm === 0 ? 'PASS — clinical mappings valid' : `WARNING — ${phq9Selfharm} PHQ9-item9 selfharm triggers found, review required`)
      : `BLOCKED — ${grandErrors} range errors found`,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nRange errors: ${grandErrors} | Risk triggers: ${grandTriggers} (PHQ9-item9 selfharm: ${phq9Selfharm})`);
  console.log(`Output: ${OUTPUT_FILE}`);
  process.exit(grandErrors > 0 ? 1 : 0);
}

run();
