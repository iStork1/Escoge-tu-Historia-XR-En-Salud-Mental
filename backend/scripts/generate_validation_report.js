// Consolidator: reads Phase 1-3 outputs and generates VALIDATION_REPORT.md
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'output');
const REPORT_FILE = path.join(__dirname, '../../VALIDATION_REPORT.md');

function readOutput(file) {
  const filePath = path.join(OUTPUT_DIR, file);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function run() {
  const p1Raw = readOutput('validation_json.txt');
  const p2Raw = readOutput('audit_consequences.json');
  const p3Raw = readOutput('audit_mappings.json');

  if (!p1Raw || !p2Raw || !p3Raw) {
    console.error('Missing output files. Run all 3 validation scripts first.');
    process.exit(1);
  }

  const p2 = JSON.parse(p2Raw);
  const p3 = JSON.parse(p3Raw);

  const p1Pass = p1Raw.includes('All files valid');
  const p2Pass = p2.totals.total_violations === 0;
  const p2Violations = p2.totals.total_violations;
  const p3Pass = p3.summary.total_range_errors === 0 && p3.summary.phq9_selfharm_triggers === 0;
  const p3Errors = p3.summary.total_range_errors;
  const p3Triggers = p3.summary.total_risk_triggers;
  const p3Selfharm = p3.summary.phq9_selfharm_triggers;

  // Fase 2 violations are warnings, not blockers (rule relaxed to [2-4])
  const hardBlocked = !p1Pass || p3Errors > 0;
  const hasWarnings = !p2Pass || (p3Triggers > 0 && p3Selfharm === 0);

  const verdict = hardBlocked
    ? '❌ Blocked — fix errors before syncing'
    : hasWarnings
      ? '⚠️ Ready to sync — review warnings before production'
      : '✅ Ready to sync to Supabase';

  const lines = [];
  lines.push(`# VALIDATION_REPORT — Historias LATAM`);
  lines.push(`**Generado:** ${new Date().toISOString()}`);
  lines.push(`**Veredicto:** ${verdict}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Executive summary table
  lines.push('## Resumen Ejecutivo');
  lines.push('');
  lines.push('| Fase | Estado | Detalle |');
  lines.push('|------|--------|---------|');
  lines.push(`| Fase 1: Integridad JSON | ${p1Pass ? '✅ PASS' : '❌ FAIL'} | ${p1Pass ? 'Todos los archivos válidos' : 'Ver validation_json.txt'} |`);
  lines.push(`| Fase 2: Consecuencias | ${p2Pass ? '✅ PASS' : '⚠️ WARNING'} | ${p2Violations} consecuencias fuera de [2-4] oraciones de ${p2.totals.total_options_audited} (${p2.totals.overall_pass_rate} OK) — no bloqueante |`);
  lines.push(`| Fase 3: Mappings clínicos | ${p3Pass ? '✅ PASS' : p3Errors > 0 ? '❌ FAIL' : '⚠️ WARNING'} | ${p3Errors} errores de rango, ${p3Triggers} risk triggers (${p3Selfharm} PHQ9-item9) |`);
  lines.push('');

  // Phase 1 summary
  lines.push('---');
  lines.push('');
  lines.push('## Fase 1: Integridad JSON');
  lines.push('');
  lines.push('```');
  lines.push(p1Raw);
  lines.push('```');
  lines.push('');

  // Phase 2 detail
  lines.push('---');
  lines.push('');
  lines.push('## Fase 2: Auditoría de Consecuencias');
  lines.push('');
  lines.push('### Totales por historia');
  lines.push('');
  lines.push('| Historia | Opciones | Violaciones | Pass Rate |');
  lines.push('|----------|----------|-------------|-----------|');
  for (const [story, s] of Object.entries(p2.summary)) {
    const icon = s.violations === 0 ? '✅' : '⚠️';
    lines.push(`| ${story} | ${s.total_options} | ${icon} ${s.violations} | ${s.pass_rate} |`);
  }
  lines.push('');

  if (p2.violations.length > 0) {
    lines.push('### Violaciones (≠ 3 oraciones)');
    lines.push('');
    lines.push('| Option ID | # Oraciones | Preview |');
    lines.push('|-----------|-------------|---------|');
    for (const v of p2.violations) {
      const preview = v.consequence_preview.replace(/\|/g, '\\|');
      lines.push(`| ${v.option_id} | ${v.sentence_count} | ${preview} |`);
    }
    lines.push('');
  }

  // Phase 3 detail
  lines.push('---');
  lines.push('');
  lines.push('## Fase 3: Mappings Clínicos');
  lines.push('');
  lines.push('### Estadísticas por historia');
  lines.push('');
  lines.push('| Historia | Opciones | Con GDS | Con PHQ | PHQ vacío | Avg GDS Weight | Avg PHQ Weight |');
  lines.push('|----------|----------|---------|---------|-----------|---------------|---------------|');
  for (const [story, d] of Object.entries(p3.per_story)) {
    const s = d.stats;
    lines.push(`| ${story} | ${s.total_options} | ${s.options_with_gds} | ${s.options_with_phq} | ${s.options_with_empty_phq} | ${s.avg_gds_weight ?? 'N/A'} | ${s.avg_phq_weight ?? 'N/A'} |`);
  }
  lines.push('');

  if (p3.all_risk_triggers.length > 0) {
    lines.push('### Risk Triggers detectados');
    lines.push('');
    lines.push('| Option ID | Escala | Ítem | Weight | Confidence | Score | Threshold | Label |');
    lines.push('|-----------|--------|------|--------|------------|-------|-----------|-------|');
    for (const t of p3.all_risk_triggers) {
      lines.push(`| ${t.option_id} | ${t.scale} | ${t.item} | ${t.weight} | ${t.confidence} | ${t.score} | ${t.threshold} | ${t.label} |`);
    }
    lines.push('');
  }

  if (p3.all_errors.length > 0) {
    lines.push('### Errores de rango');
    lines.push('');
    for (const e of p3.all_errors) {
      lines.push(`- \`${e.option_id}\`: ${e.issue}`);
    }
    lines.push('');
  }

  // Verdict
  lines.push('---');
  lines.push('');
  lines.push('## Veredicto Final');
  lines.push('');
  lines.push(`**${verdict}**`);
  lines.push('');
  if (!p1Pass) {
    lines.push('Corregir errores de JSON antes de continuar.');
  } else if (p3Errors > 0) {
    lines.push(`Corregir ${p3Errors} errores de rango en mappings clínicos.`);
  } else if (p3Selfharm > 0) {
    lines.push(`Revisar ${p3Selfharm} opciones con PHQ9-item9 weight×confidence ≥ 0.18 (umbral de riesgo de autolesión).`);
  } else {
    lines.push('Proceder con:');
    lines.push('1. `node backend/scripts/sync_chapters.js` para sincronizar a Supabase');
    lines.push('2. Testing end-to-end con Alexa Simulator');
    if (!p2Pass) {
      lines.push(`\n> **Pendiente opcional:** revisar ${p2Violations} consecuencias con >4 oraciones (ver audit_consequences.json).`);
    }
  }

  const report = lines.join('\n');
  fs.writeFileSync(REPORT_FILE, report, 'utf8');
  console.log(`Report written to: ${REPORT_FILE}`);
  console.log(`\nVeredicto: ${verdict}`);
}

run();
