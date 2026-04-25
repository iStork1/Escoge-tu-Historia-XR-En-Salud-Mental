#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value, decimals = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function confusionLabel(predictedPositive, referencePositive) {
  if (predictedPositive && referencePositive) return 'TP';
  if (predictedPositive && !referencePositive) return 'FP';
  if (!predictedPositive && referencePositive) return 'FN';
  return 'TN';
}

function computePearson(xs, ys) {
  if (xs.length !== ys.length || xs.length < 2) return null;

  const n = xs.length;
  const meanX = xs.reduce((acc, v) => acc + v, 0) / n;
  const meanY = ys.reduce((acc, v) => acc + v, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  if (denomX === 0 || denomY === 0) return null;
  return numerator / Math.sqrt(denomX * denomY);
}

function buildGroupKey(record) {
  return `${record.cohort}::${record.model_version}`;
}

function validateDataset(dataset) {
  if (!dataset || typeof dataset !== 'object') {
    throw new Error('Dataset JSON is invalid');
  }

  if (!dataset.metadata || !dataset.records) {
    throw new Error('Dataset must include metadata and records fields');
  }

  if (!Array.isArray(dataset.records) || dataset.records.length === 0) {
    throw new Error('Dataset records must be a non-empty array');
  }

  const requiredMetadata = ['dataset_name', 'dataset_version', 'pipeline_version', 'rules_version', 'threshold_version'];
  for (const field of requiredMetadata) {
    if (!dataset.metadata[field]) {
      throw new Error(`Dataset metadata is missing ${field}`);
    }
  }
}

function computeMetrics(records) {
  let tp = 0;
  let tn = 0;
  let fp = 0;
  let fn = 0;

  const predictedScores = [];
  const referenceScores = [];

  for (const row of records) {
    const bucket = confusionLabel(row.predicted_positive, row.reference_positive);
    if (bucket === 'TP') tp += 1;
    if (bucket === 'TN') tn += 1;
    if (bucket === 'FP') fp += 1;
    if (bucket === 'FN') fn += 1;

    predictedScores.push(row.predicted_score);
    referenceScores.push(row.reference_score);
  }

  const sensitivity = (tp + fn) > 0 ? tp / (tp + fn) : null;
  const specificity = (tn + fp) > 0 ? tn / (tn + fp) : null;
  const accuracy = (tp + tn + fp + fn) > 0 ? (tp + tn) / (tp + tn + fp + fn) : null;
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : null;

  return {
    count: records.length,
    confusion_matrix: { tp, tn, fp, fn },
    sensitivity: round(sensitivity),
    specificity: round(specificity),
    accuracy: round(accuracy),
    precision: round(precision),
    pearson_correlation: round(computePearson(predictedScores, referenceScores))
  };
}

function main() {
  const args = parseArgs(process.argv);
  const datasetPath = args.dataset
    ? path.resolve(args.dataset)
    : path.resolve(__dirname, '..', 'content', 'validation', 'pilot_validation_dataset.v1.json');
  const outputPath = args.output
    ? path.resolve(args.output)
    : path.resolve(__dirname, '..', 'content', 'validation', 'psychometric_metrics.latest.json');

  if (!fs.existsSync(datasetPath)) {
    throw new Error(`Dataset file not found: ${datasetPath}`);
  }

  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  validateDataset(dataset);

  const metadata = dataset.metadata;
  const runId = randomUUID();
  const executedAt = new Date().toISOString();

  const enriched = dataset.records.map((record) => {
    const thresholds = metadata.thresholds || {};
    const thresholdUsed = safeNumber(record.threshold_used, safeNumber(thresholds[record.risk_type], 0));
    const predictedScore = safeNumber(record.predicted_score, 0);
    const referenceScore = safeNumber(
      record.reference_score,
      record.reference_positive ? 1 : 0
    );
    const predictedPositive = predictedScore >= thresholdUsed;
    const referencePositive = Boolean(record.reference_positive);

    return {
      run_id: runId,
      pipeline_version: metadata.pipeline_version,
      dataset_name: metadata.dataset_name,
      dataset_version: metadata.dataset_version,
      rules_version: metadata.rules_version,
      threshold_version: metadata.threshold_version,
      model_version: record.model_version || metadata.model_version || 'unknown_model',
      session_id: record.session_id || null,
      pseudonym: record.pseudonym || null,
      cohort: record.cohort || 'all',
      risk_type: record.risk_type || 'UNSPECIFIED',
      predicted_score: predictedScore,
      reference_score: referenceScore,
      threshold_used: thresholdUsed,
      predicted_positive: predictedPositive,
      reference_positive: referencePositive,
      confusion_bucket: confusionLabel(predictedPositive, referencePositive)
    };
  });

  const byCohortAndModel = {};
  for (const row of enriched) {
    const key = buildGroupKey(row);
    if (!byCohortAndModel[key]) {
      byCohortAndModel[key] = [];
    }
    byCohortAndModel[key].push(row);
  }

  const groupedMetrics = Object.entries(byCohortAndModel).map(([key, rows]) => {
    const [cohort, modelVersion] = key.split('::');
    return {
      cohort,
      model_version: modelVersion,
      metrics: computeMetrics(rows)
    };
  });

  const report = {
    run_id: runId,
    executed_at: executedAt,
    run_date: executedAt.slice(0, 10),
    dataset: {
      name: metadata.dataset_name,
      version: metadata.dataset_version
    },
    pipeline: {
      pipeline_version: metadata.pipeline_version,
      rules_version: metadata.rules_version,
      threshold_version: metadata.threshold_version
    },
    thresholds: metadata.thresholds || {},
    score_thresholds: metadata.score_thresholds || {},
    overall_metrics: computeMetrics(enriched),
    metrics_by_cohort_and_model: groupedMetrics,
    traceability: {
      total_results: enriched.length,
      sample_result: enriched[0] || null,
      note: 'Each result carries run_id + pipeline_version + rules_version + threshold_version + model_version'
    }
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');

  process.stdout.write(`Psychometric pipeline run completed\n`);
  process.stdout.write(`run_id: ${runId}\n`);
  process.stdout.write(`dataset: ${metadata.dataset_name}@${metadata.dataset_version}\n`);
  process.stdout.write(`pipeline: ${metadata.pipeline_version}\n`);
  process.stdout.write(`output: ${outputPath}\n\n`);
  process.stdout.write(`Metrics by cohort and model\n`);
  for (const item of groupedMetrics) {
    process.stdout.write(
      `- ${item.cohort} | ${item.model_version} => sens=${item.metrics.sensitivity}, spec=${item.metrics.specificity}, corr=${item.metrics.pearson_correlation}, matrix=${JSON.stringify(item.metrics.confusion_matrix)}\n`
    );
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`Psychometric pipeline failed: ${error.message}\n`);
  process.exitCode = 1;
}
