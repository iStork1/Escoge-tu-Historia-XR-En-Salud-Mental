const fs = require('fs');
const path = require('path');

try {
  const dotenv = require('dotenv');
  const envCandidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '..', '..', '.env')
  ];
  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: false });
    }
  }
} catch (e) { /* dotenv not installed in this environment; continue */ }
// Use native http server to avoid heavy external dependencies in local tests
const http = require('http');
let createClient;
try {
  ({ createClient } = require('@supabase/supabase-js'));
} catch (e) {
  // Supabase SDK failed to load — continuing in local/mock mode without noisy stack
  // console.debug('Supabase load error:', e && e.message);
}
const { v4: uuidv4, validate: uuidValidate } = require('uuid');
const crypto = require('crypto');
const { sanitizeSsml, longForm } = require('./ssml-helpers');
const { validateTelemetryPayload, verifyAlexaRequest, verifyOperationalAccess, summarizeRiskEvents, computeRiskSlaState } = require('./p0-helpers');
let jsonRepair = null;
try {
  ({ jsonrepair: jsonRepair } = require('jsonrepair'));
} catch (_jsonRepairErr) {
  jsonRepair = null;
}

const MAX_INPUT_TOKENS = Number(process.env.MAX_INPUT_TOKENS || 800);
const MAX_OUTPUT_TOKENS = Number(process.env.MAX_OUTPUT_TOKENS || 1200);
const PATH_WINDOW_SIZE = Number(process.env.PATH_WINDOW_SIZE || 3);
const PROMPT_VERSION = process.env.PROMPT_VERSION || 'arc_scene_v2';
const WEEK_CHAPTER_COUNT = Math.max(1, Number(process.env.WEEK_CHAPTER_COUNT || 7));
const AUTO_CONTINUE_CHAPTER_COUNT = Math.max(1, Number(process.env.AUTO_CONTINUE_CHAPTER_COUNT || WEEK_CHAPTER_COUNT || 7));
const AUTO_MISSING_SCENE_CHAPTER_COUNT = Math.max(1, Number(process.env.AUTO_MISSING_SCENE_CHAPTER_COUNT || 1));
const DISABLE_LAZY_SCENE_GENERATION = String(process.env.DISABLE_LAZY_SCENE_GENERATION || 'true').toLowerCase() !== 'false';

const STATIC_CRITICAL_NODES = {
  3: 'social_event',
  5: 'emotional_crisis',
  7: 'resolution'
};

function hashObject(value) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value || {});
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function clampWindow(arr, windowSize = PATH_WINDOW_SIZE) {
  const source = Array.isArray(arr) ? arr : [];
  return source.slice(-Math.max(1, Number(windowSize) || PATH_WINDOW_SIZE));
}

function getGeographicSetting(locale) {
  const loc = String(locale || '').toLowerCase();
  if (loc === 'es-es') {
    return {
      country: 'España',
      city: 'un pueblo del norte de España',
      neighborhood: 'casco viejo',
      community_space: 'huerto comunitario',
      plaza: 'plaza del pueblo',
      cafe: 'bar del barrio',
      drink: 'café con leche',
      food: 'bocadillo',
      nature: 'pinos, robles, lluvia atlántica',
      architecture: 'casas de piedra, soportales, callejón empedrado',
      expressions: 'venga, anda, madre mía, jolines',
      setting_note: 'Ambientado en España. Usa topónimos, arquitectura, gastronomía y expresiones coloquiales españolas. Rosa vive en un barrio antiguo de pueblo o ciudad española.'
    };
  }
  return {
    country: 'Colombia',
    city: 'una ciudad colombiana',
    neighborhood: 'barrio popular',
    community_space: 'jardín comunitario',
    plaza: 'parque del barrio',
    cafe: 'tienda de barrio',
    drink: 'tinto',
    food: 'arepa',
    nature: 'buganvilias, heliconias, lluvia de las tres',
    architecture: 'casas de ladrillo rojo, patios interiores, rejas coloniales',
    expressions: 'listo, chévere, bacano, ay Dios mío',
    setting_note: 'Ambientado en Colombia. Usa topónimos, arquitectura, gastronomía y expresiones coloquiales colombianas. Rosa vive en un barrio popular de ciudad colombiana.'
  };
}

function normalizeUnitScore(value, fallback = null) {
  if (value === null || typeof value === 'undefined') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(1, Math.max(0, num));
}

function normalizeClinicalMappingSource(source, fallback = 'llm') {
  const allowed = new Set(['designer', 'llm', 'heuristic']);
  const value = String(source || '').toLowerCase().trim();
  if (allowed.has(value)) return value;
  const safeFallback = String(fallback || 'llm').toLowerCase().trim();
  return allowed.has(safeFallback) ? safeFallback : 'llm';
}

function parseEnvList(value = '') {
  if (!value || typeof value !== 'string') return [];
  return value.split(',').map(v => v.trim()).filter(Boolean);
}

const POSITIVE_KEYWORDS = [
  'salir', 'caminar', 'hablar', 'visitar', 'llamar', 'aceptar', 'acompan', 'ayuda',
  'participar', 'compartir', 'unirse', 'actividad'
];

const NEGATIVE_KEYWORDS = [
  'quedar', 'aislar', 'evitar', 'rechazar', 'encerrar', 'nada', 'no quiero',
  'no puedo', 'dormir', 'aislamiento'
];

const MILD_KEYWORDS = [
  'un poco', 'algo', 'tal vez', 'quizas', 'mas o menos', 'ligero', 'dudo'
];

const STRONG_KEYWORDS = [
  'desesper', 'crisis', 'llanto', 'agot', 'terrible', 'insoportable', 'abrum'
];

const SELF_HARM_KEYWORDS = [
  'suicid', 'matarme', 'quitarme la vida', 'morir', 'no quiero vivir'
];

const NEGATIVE_GDS_ITEMS = new Set([2, 3, 8, 9, 12, 14, 15]);
const NEGATIVE_PHQ_ITEMS = new Set([1, 2, 4, 6, 9]);

function countKeywordHits(text, keywords = []) {
  if (!text) return 0;
  const source = text.toLowerCase();
  return keywords.reduce((total, keyword) => (source.includes(keyword) ? total + 1 : total), 0);
}

function classifyOptionTone(text) {
  const negativeScore = countKeywordHits(text, NEGATIVE_KEYWORDS);
  const positiveScore = countKeywordHits(text, POSITIVE_KEYWORDS);
  const mild = countKeywordHits(text, MILD_KEYWORDS) > 0;
  const strong = countKeywordHits(text, STRONG_KEYWORDS) > 0;
  const selfHarm = countKeywordHits(text, SELF_HARM_KEYWORDS) > 0;

  let tone = 'neutral';
  if (selfHarm || negativeScore > positiveScore) tone = 'negative';
  else if (positiveScore > 0) tone = 'positive';

  return {
    tone,
    negativeScore,
    positiveScore,
    mild,
    strong,
    selfHarm
  };
}

function getClinicalScoreThresholds() {
  const low = normalizeUnitScore(process.env.CLINICAL_SCORE_THRESHOLD_LOW, 0.30);
  const moderate = normalizeUnitScore(process.env.CLINICAL_SCORE_THRESHOLD_MODERATE, 0.55);
  const high = normalizeUnitScore(process.env.CLINICAL_SCORE_THRESHOLD_HIGH, 0.78);
  return { low, moderate, high };
}

function buildClinicalScoreSummary(mappings = []) {
  const items = Array.isArray(mappings) ? mappings : [];
  let total = 0;
  let weightSum = 0;
  let count = 0;

  for (const m of items) {
    const weight = normalizeUnitScore(m && m.weight, 0.5);
    const confidence = normalizeUnitScore(m && m.confidence, 0.75);
    total += weight * confidence;
    weightSum += weight;
    count += 1;
  }

  const normalized = weightSum ? Number((total / weightSum).toFixed(3)) : 0;
  const avgWeight = count ? Number((weightSum / count).toFixed(3)) : 0;
  const thresholds = getClinicalScoreThresholds();
  const level = normalized >= thresholds.high
    ? 'high'
    : (normalized >= thresholds.moderate
      ? 'moderate'
      : (normalized >= thresholds.low ? 'low' : 'minimal'));

  return {
    total: Number(total.toFixed(3)),
    normalized,
    avg_weight: avgWeight,
    count,
    level,
    thresholds
  };
}

function getOptionRuleSettings() {
  return {
    maxOptions: Math.max(1, Number(process.env.MAX_OPTIONS_PER_SCENE || 3)),
    mildWeightCap: normalizeUnitScore(process.env.MILD_WEIGHT_CAP, 0.6),
    strongWeightCap: normalizeUnitScore(process.env.STRONG_WEIGHT_CAP, 0.9),
    phq9MinScore: normalizeUnitScore(process.env.PHQ9_ITEM9_MIN_SCORE, 0.4)
  };
}

function sanitizeMappings(mappings = [], context = {}) {
  const rules = getOptionRuleSettings();
  const items = Array.isArray(mappings) ? mappings : [];
  const flags = [];

  const sanitized = items.filter(m => {
    if (context.scale === 'PHQ' && Number(m.item) === 9 && !context.allowItem9) {
      flags.push('phq9_item9_removed');
      return false;
    }
    return true;
  }).map(m => {
    const weight = normalizeUnitScore(m.weight, 0.5);
    const confidence = normalizeUnitScore(m.confidence, 0.75);
    let adjustedWeight = weight;

    if (context.mild && adjustedWeight > rules.mildWeightCap) {
      adjustedWeight = rules.mildWeightCap;
      flags.push('weight_capped_mild');
    }

    if (!context.strong && adjustedWeight > rules.strongWeightCap) {
      adjustedWeight = rules.strongWeightCap;
      flags.push('weight_capped_strong');
    }

    return {
      ...m,
      weight: adjustedWeight,
      confidence
    };
  });

  return { mappings: sanitized, flags };
}

function hasContradictoryMappings(tone, gdsMappings = [], phqMappings = []) {
  if (tone !== 'positive') return false;
  const gdsConflict = (gdsMappings || []).some(m => NEGATIVE_GDS_ITEMS.has(Number(m.item)) && normalizeUnitScore(m.weight, 0) >= 0.7);
  const phqConflict = (phqMappings || []).some(m => NEGATIVE_PHQ_ITEMS.has(Number(m.item)) && normalizeUnitScore(m.weight, 0) >= 0.7);
  return gdsConflict || phqConflict;
}

function normalizeNarrativeValue(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function enforceOptionConsequenceConsistency(optionText, consequenceText) {
  const opt = normalizeNarrativeValue(optionText);
  const cons = String(consequenceText || '').trim();
  const consNorm = normalizeNarrativeValue(cons);

  const wantsGoHome = /rechazar|irse a casa|volver a casa|retirarse/.test(opt);
  const wantsJoinGroup = /aceptar|unirse|sumarse|quedarse con el grupo/.test(opt);
  const wantsExploreAlone = /explorar.*por su cuenta|explorar sola|recorrer sola/.test(opt);

  const mentionsGroupDinner = /durante la cena|con el grupo|la mesa compartida|charla grupal|entre todos/.test(consNorm);
  const mentionsGoHome = /se va a casa|regresa a casa|vuelve a casa/.test(consNorm);

  if (wantsGoHome && mentionsGroupDinner) {
    return 'Rosa rechaza la invitacion y regresa a casa. Se siente aliviada por tener espacio, aunque nota una punzada de soledad al cerrar la puerta.';
  }

  if (wantsJoinGroup && mentionsGoHome) {
    return 'Rosa acepta quedarse con el grupo y comparte la cena. Al conversar, su tension baja y empieza a sentirse parte del lugar.';
  }

  if (wantsExploreAlone && mentionsGroupDinner) {
    return 'Rosa decide explorar el jardin por su cuenta. Recorre los bancales en silencio, observa detalles nuevos y gana confianza sin unirse aun al grupo.';
  }

  return cons || consequenceText;
}

function applyOptionRulesToScene(options = [], context = {}) {
  const rules = getOptionRuleSettings();
  const baseOptions = Array.isArray(options) ? options : [];
  const summary = {
    max_options: rules.maxOptions,
    trimmed: false,
    trimmed_count: 0,
    negative_present: false,
    phq9_removed: 0,
    contradictions: 0,
    forced_negative: false,
    warnings: []
  };

  const processed = baseOptions.map(opt => {
    const text = `${opt.option_text || ''} ${opt.consequence || ''}`.toLowerCase();
    const toneInfo = classifyOptionTone(text);
    const phq9Allowed = Boolean(toneInfo.selfHarm) || (toneInfo.tone === 'negative' && Number(context.phq9Score || 0) >= rules.phq9MinScore);

    const gdsResult = sanitizeMappings(opt.gds_mapping || [], {
      scale: 'GDS',
      mild: toneInfo.mild,
      strong: toneInfo.strong,
      allowItem9: true
    });

    const phqResult = sanitizeMappings(opt.phq_mapping || [], {
      scale: 'PHQ',
      mild: toneInfo.mild,
      strong: toneInfo.strong,
      allowItem9: phq9Allowed
    });

    const contradiction = hasContradictoryMappings(toneInfo.tone, gdsResult.mappings, phqResult.mappings);
    if (contradiction) summary.contradictions += 1;

    const gdsScore = buildClinicalScoreSummary(gdsResult.mappings);
    const phqScore = buildClinicalScoreSummary(phqResult.mappings);
    const combinedNormalized = Number(((gdsScore.normalized + phqScore.normalized) / 2).toFixed(3));
    const combinedLevel = combinedNormalized >= 0.75 ? 'high' : (combinedNormalized >= 0.5 ? 'moderate' : (combinedNormalized >= 0.25 ? 'low' : 'minimal'));

    const validationFlags = [
      ...gdsResult.flags,
      ...phqResult.flags
    ];
    if (contradiction) validationFlags.push('tone_mapping_contradiction');

    if (phqResult.flags.includes('phq9_item9_removed')) summary.phq9_removed += 1;

    const correctedConsequence = enforceOptionConsequenceConsistency(opt.option_text, opt.consequence);

    const metadata = Object.assign({}, opt.metadata || {}, {
      option_tone: toneInfo.tone,
      clinical_scores: {
        gds: gdsScore,
        phq: phqScore,
        combined: {
          normalized: combinedNormalized,
          level: combinedLevel
        }
      },
      validation_flags: validationFlags
    });

    return {
      ...opt,
      consequence: correctedConsequence,
      gds_mapping: gdsResult.mappings,
      phq_mapping: phqResult.mappings,
      metadata
    };
  });

  const adjusted = [...processed];
  let negativeOptions = adjusted.filter(o => (o.metadata && o.metadata.option_tone) === 'negative');
  summary.negative_present = negativeOptions.length > 0;

  if (!summary.negative_present && adjusted.length) {
    adjusted.sort((a, b) => {
      const aScore = a.metadata?.clinical_scores?.combined?.normalized || 0;
      const bScore = b.metadata?.clinical_scores?.combined?.normalized || 0;
      return aScore - bScore;
    });
    const forced = adjusted[0];
    if (forced) {
      forced.metadata = Object.assign({}, forced.metadata || {}, {
        option_tone: 'negative',
        validation_flags: [...(forced.metadata?.validation_flags || []), 'forced_negative_option']
      });
      summary.negative_present = true;
      summary.forced_negative = true;
      summary.warnings.push('forced_negative_option');
    }
  }

  negativeOptions = adjusted.filter(o => (o.metadata && o.metadata.option_tone) === 'negative');
  if (!summary.negative_present) summary.warnings.push('missing_negative_option');

  const ordered = adjusted.filter(o => (o.metadata && o.metadata.option_tone) !== 'negative')
    .concat(negativeOptions.sort((a, b) => {
      const aScore = a.metadata?.clinical_scores?.combined?.normalized || 0;
      const bScore = b.metadata?.clinical_scores?.combined?.normalized || 0;
      return bScore - aScore;
    }));

  let trimmed = ordered;
  if (ordered.length > rules.maxOptions) {
    trimmed = ordered.slice(0, rules.maxOptions);
    summary.trimmed = true;
    summary.trimmed_count = ordered.length - trimmed.length;
  }

  const trimmedHasNegative = trimmed.some(o => (o.metadata && o.metadata.option_tone) === 'negative');
  if (!trimmedHasNegative && negativeOptions.length && trimmed.length) {
    trimmed[trimmed.length - 1] = negativeOptions[0];
  
    let upsertedChapters = 0;
    let insertedMappings = 0;
    summary.warnings.push('negative_option_injected');
  }

  return { options: trimmed, summary };
}

function validateContinuityState(continuityState) {
  const required = ['last_scene_summary', 'emotional_state', 'clinical_flags', 'top_choice', 'current_goal'];
  const missing = required.filter(k => typeof continuityState === 'undefined' || continuityState === null || typeof continuityState[k] === 'undefined');
  if (!continuityState || typeof continuityState !== 'object') {
    return { ok: false, missing: required };
  }
  if (!Array.isArray(continuityState.clinical_flags)) {
    missing.push('clinical_flags(array)');
  }
  return { ok: missing.length === 0, missing };
}

function normalizeSegment(segment = {}) {
  return {
    clinical_level: segment.clinical_level || 'medium',
    user_pattern: segment.user_pattern || 'engaged',
    age_group: segment.age_group || 'adult'
  };
}

function resolveCriticalNode(arcDay, dayInfo = {}) {
  const dayNum = Number(arcDay);
  return dayInfo.narrative_trigger || STATIC_CRITICAL_NODES[dayNum] || null;
}

function computeDeterministicPathKey(params = {}) {
  const {
    arc_id,
    chapter_id,
    last_choices = [],
    segment = {},
    critical_node = null,
    prompt_version = PROMPT_VERSION
  } = params;

  const payload = {
    arc_id: arc_id || null,
    chapter_id: chapter_id || null,
    last_choices: clampWindow(last_choices),
    segment: normalizeSegment(segment),
    critical_node: critical_node || null,
    prompt_version
  };
  return hashObject(payload);
}

function compressNarrativeMemory(generated) {
  try {
    const chapter = (generated && Array.isArray(generated.chapters)) ? (generated.chapters[0] || {}) : {};
    const scenes = Array.isArray(chapter.scenes) ? chapter.scenes : [];
    const firstScene = scenes[0] || {};
    const text = String(firstScene.text || '').toLowerCase();
    let event = 'daily_progress';
    if (text.includes('rechazo') || text.includes('invit')) event = 'social_rejection';
    if (text.includes('llamada') || text.includes('amig') || text.includes('famil')) event = 'social_connection';
    if (text.includes('crisis') || text.includes('llanto') || text.includes('desbord')) event = 'emotional_crisis';

    const emotionalState = chapter.continuity_state && chapter.continuity_state.emotional_state
      ? chapter.continuity_state.emotional_state
      : (firstScene.emotional_beat || 'resistance');

    return {
      event,
      emotion: emotionalState,
      impact: emotionalState === 'apathy' ? 0.8 : (emotionalState === 'hope' ? 0.4 : 0.6)
    };
  } catch (e) {
    return { event: 'daily_progress', emotion: 'resistance', impact: 0.6 };
  }
}

function maxMappingConfidence(items = []) {
  return (Array.isArray(items) ? items : []).reduce((m, x) => Math.max(m, Number(x && x.confidence ? x.confidence : 0)), 0);
}

function applyDeterministicClinicalRules(generated, context = {}) {
  const out = JSON.parse(JSON.stringify(generated || {}));
  const chapters = Array.isArray(out.chapters) ? out.chapters : [];
  for (const ch of chapters) {
    const scenes = Array.isArray(ch.scenes) ? ch.scenes : [];
    for (const sc of scenes) {
      const options = Array.isArray(sc.options) ? sc.options : [];
      const ruleResult = applyOptionRulesToScene(options, context);
      sc.options = ruleResult.options;

      const patchedOptions = Array.isArray(sc.options) ? sc.options : [];
      for (const opt of patchedOptions) {
        const text = `${opt.option_text || ''} ${opt.consequence || ''}`.toLowerCase();
        const gdsConf = maxMappingConfidence(opt.gds_mapping || []);
        const phqConf = maxMappingConfidence(opt.phq_mapping || []);
        const shouldPatch = (gdsConf < 0.65 && phqConf < 0.65) || ((!opt.gds_mapping || !opt.gds_mapping.length) && (!opt.phq_mapping || !opt.phq_mapping.length));
        if (!shouldPatch) continue;

        if (text.includes('casa') || text.includes('evitar') || text.includes('aisla') || text.includes('quedarme')) {
          opt.gds_mapping = [{ item: 9, weight: 0.8, confidence: 0.9, primary_construct: 'social_withdrawal', rationale: 'Regla: evitacion/aislamiento social', mapping_source: 'rule' }];
        } else if (text.includes('salir') || text.includes('amig') || text.includes('llamar') || text.includes('aceptar')) {
          opt.gds_mapping = [{ item: 2, weight: 0.7, confidence: 0.85, primary_construct: 'activity_engagement', rationale: 'Regla: activacion social', mapping_source: 'rule' }];
        } else if (text.includes('cans') || text.includes('energia') || text.includes('agot')) {
          opt.phq_mapping = [{ item: 4, weight: 0.75, confidence: 0.9, primary_construct: 'fatigue_low_energy', rationale: 'Regla: baja energia', mapping_source: 'rule' }];
        } else if (text.includes('culpa') || text.includes('inutil') || text.includes('fracaso')) {
          opt.phq_mapping = [{ item: 6, weight: 0.75, confidence: 0.88, primary_construct: 'self_worth', rationale: 'Regla: autovaloracion negativa', mapping_source: 'rule' }];
        }
      }
    }
  }
  return out;
}

async function getBestCachedPathVariant(basePathKey) {
  try {
    const { data, error } = await supabase
      .from('narrative_path_cache')
      .select('*')
      .eq('base_path_key', basePathKey)
      .eq('is_active', true)
      .order('quality_score', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn('narrative_path_cache lookup warning:', error.message || error);
      return null;
    }
    return data || null;
  } catch (e) {
    return null;
  }
}

async function upsertNarrativePathCache(record) {
  try {
    const { error } = await supabase
      .from('narrative_path_cache')
      .upsert([record], { onConflict: 'variant_key' });
    if (error) {
      console.warn('narrative_path_cache upsert warning:', error.message || error);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

async function persistNarrativeCacheEvent(event) {
  try {
    const { error } = await supabase
      .from('narrative_cache_events')
      .insert([event]);
    if (error) {
      console.warn('narrative_cache_events insert warning:', error.message || error);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

// ============= SPRINT 2c: LLM Client for Ollama Integration =============
let llmClient, prompts;
try {
  llmClient = require('./llm-client');
  prompts = require('./prompts');
  console.log('✅ LLM client and prompts loaded (Ollama integration ready)');
  
  // Initialize LLM provider
  (async () => {
    await llmClient.initializeLLMClient();
  })().catch(e => console.warn('⚠️ LLM initialization warning:', e.message));
  
} catch (e) {
  console.warn('⚠️ LLM modules not available:', e && e.message);
  // Continue without LLM if modules not loaded
}

// ============= SPRINT 2b: Payload Validation with AJV =============
let Ajv, addFormats;
let validatePayloadSchema = null;

try {
  Ajv = require('ajv');
  addFormats = require('ajv-formats');
  const ajv = new Ajv({ strict: true, useDefaults: false });
  addFormats.default(ajv);
  
  // Load and compile decision payload schema
  const schemaPath = path.join(__dirname, '..', '..', 'database', 'decision_payload_schema.json');
  const schemaData = fs.readFileSync(schemaPath, 'utf8');
  const schema = JSON.parse(schemaData);
  
  validatePayloadSchema = ajv.compile(schema);
  console.log('✅ Payload validation schema loaded from database/ and compiled');
} catch (e) {
  console.warn('⚠️ AJV validation not available:', e && e.message);
  // Continue without validation if ajv not installed
}

// Middleware: Validate payload against schema
function validatePayload(payload) {
  if (!validatePayloadSchema) {
    return { valid: true, errors: null }; // Skip if schema not loaded
  }
  
  const valid = validatePayloadSchema(payload);
  if (!valid) {
    return {
      valid: false,
      errors: validatePayloadSchema.errors.map(err => ({
        path: err.instancePath || '/',
        message: err.message,
        keyword: err.keyword
      }))
    };
  }
  
  return { valid: true, errors: null };
}

// Parse JSON object from plain LLM text responses
function extractJsonObject(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  const cleaned = rawText.trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : cleaned;
  try { return JSON.parse(jsonStr); } catch (e) { return null; }
}

function getArcWorkflowStatePath() {
  return path.join(__dirname, '..', 'content', 'arc_workflow_state.json');
}

function loadArcWorkflowState() {
  const statePath = getArcWorkflowStatePath();
  if (!fs.existsSync(statePath)) {
    return { latest_arc_id: null, latest_transition: null, arcs: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (e) {
    console.warn('arc workflow state parse warning:', e && e.message);
    return { latest_arc_id: null, latest_transition: null, arcs: {} };
  }
}

function saveArcWorkflowState(state) {
  const statePath = getArcWorkflowStatePath();
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
}

function getArcStorageDir() {
  return path.join(__dirname, '..', 'content', 'arcs');
}

function resolveModelForWorkflow(kind = 'architect') {
  if (kind === 'architect') {
    return process.env.LLM_ARCHITECT_MODEL || process.env.LLM_NARRATIVE_MODEL || process.env.OLLAMA_MODEL || 'orca-mini';
  }
  return process.env.LLM_GENERATOR_MODEL || process.env.LLM_NARRATIVE_MODEL || process.env.OLLAMA_MODEL || 'orca-mini';
}

function estimateTokensFromText(text) {
  if (!text || typeof text !== 'string') return 0;
  // Practical approximation for mixed Spanish JSON/text payloads.
  return Math.max(1, Math.ceil(text.length / 4));
}

function estimateCostUsd(inputTokens, outputTokens) {
  const inPer1K = Number(process.env.LLM_INPUT_COST_PER_1K || 0);
  const outPer1K = Number(process.env.LLM_OUTPUT_COST_PER_1K || 0);
  if (!Number.isFinite(inPer1K) || !Number.isFinite(outPer1K) || (inPer1K <= 0 && outPer1K <= 0)) {
    return null;
  }
  const cost = ((inputTokens || 0) / 1000) * inPer1K + ((outputTokens || 0) / 1000) * outPer1K;
  return Number(cost.toFixed(6));
}

function buildArcDayMetrics(generated) {
  const chapters = Array.isArray(generated && generated.chapters) ? generated.chapters : [];
  const chapter = chapters[0] || {};
  const scenes = Array.isArray(chapter.scenes) ? chapter.scenes : [];

  let playable = 0;
  let narrated = 0;
  let optionsCount = 0;
  let gdsMappings = 0;
  let phqMappings = 0;

  for (const sc of scenes) {
    if (sc && sc.type === 'playable') playable += 1;
    if (sc && sc.type === 'narrated') narrated += 1;
    const opts = Array.isArray(sc && sc.options) ? sc.options : [];
    optionsCount += opts.length;
    for (const opt of opts) {
      gdsMappings += Array.isArray(opt && opt.gds_mapping) ? opt.gds_mapping.length : 0;
      phqMappings += Array.isArray(opt && opt.phq_mapping) ? opt.phq_mapping.length : 0;
    }
  }

  return {
    scenes_total: scenes.length,
    scenes_playable: playable,
    scenes_narrated: narrated,
    options_total: optionsCount,
    gds_mappings_total: gdsMappings,
    phq_mappings_total: phqMappings,
    clinical_mappings_total: gdsMappings + phqMappings,
    has_arc_transition: !!(chapter && chapter.arc_transition)
  };
}

async function persistArcWeekToDb(record) {
  try {
    const { error } = await supabase
      .from('arc_weeks')
      .upsert([record], { onConflict: 'arc_id' });
    if (error) {
      console.warn('arc_weeks upsert warning:', error.message || error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('arc_weeks persist exception:', e && e.message);
    return false;
  }
}

async function persistArcDayToDb(record) {
  try {
    const { error } = await supabase
      .from('arc_days')
      .upsert([record], { onConflict: 'arc_id,arc_day' });
    if (error) {
      console.warn('arc_days upsert warning:', error.message || error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('arc_days persist exception:', e && e.message);
    return false;
  }
}

async function persistArcTransitionToDb(record) {
  try {
    const { error } = await supabase
      .from('arc_transitions')
      .upsert([record], { onConflict: 'from_arc_id' });
    if (error) {
      console.warn('arc_transitions upsert warning:', error.message || error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('arc_transitions persist exception:', e && e.message);
    return false;
  }
}

/**
 * Persist generated arc content into canonical tables used by clinical analytics:
 * chapters, scenes, options, clinical_mappings.
 * This keeps arc-days aligned with existing chapter metrics pipeline.
 */
async function persistGeneratedArcContentToCanonical(generated, context = {}) {
  const chapters = Array.isArray(generated && generated.chapters) ? generated.chapters : [];
  if (!chapters.length) return { ok: false, reason: 'no_chapters' };

  const {
    arc_id = null,
    arc_day = null,
    provider = null,
    model = null,
    mappingSource = 'llm'
  } = context;

  let upsertedChapters = 0;
  let upsertedScenes = 0;
  let upsertedOptions = 0;
  let insertedMappings = 0;

  try {
    // Pre-upsert all chapter rows and valid forward references before inserting options.
    // This avoids FK failures on options.next_chapter_id when chapter N points to chapter N+1.
    const chapterRows = [];
    const knownChapterIds = new Set();
    const normalizeChapterId = (value) => {
      const raw = String(value || '').trim();
      if (!raw) return null;
      if (/^c\d{2}$/i.test(raw)) return raw.toLowerCase();
      const m = raw.match(/^c(\d{1,3})$/i);
      if (!m) return null;
      return `c${String(parseInt(m[1], 10)).padStart(2, '0')}`;
    };

    for (const chapter of chapters) {
      const chapterId = normalizeChapterId(chapter && chapter.chapter_id);
      if (!chapterId) continue;
      knownChapterIds.add(chapterId);
      const chapterOrder = parseInt(String(chapterId).replace('c', ''), 10) || null;
      chapterRows.push({
        chapter_id: chapterId,
        title: chapter.title || `Arc ${arc_id || ''} Day ${arc_day || ''}`.trim(),
        order: chapterOrder,
        metadata: {
          narrative: chapter && chapter.narrative ? chapter.narrative : null,
          arc_id,
          arc_day,
          generated_by: provider,
          generated_model: model,
          generated_at: new Date().toISOString()
        }
      });
    }

    for (const chapter of chapters) {
      const scenes = Array.isArray(chapter && chapter.scenes) ? chapter.scenes : [];
      for (const sc of scenes) {
        const options = Array.isArray(sc && sc.options) ? sc.options : [];
        for (const opt of options) {
          const refId = normalizeChapterId(opt && opt.next_chapter_id);
          if (!refId || knownChapterIds.has(refId)) continue;
          knownChapterIds.add(refId);
          chapterRows.push({
            chapter_id: refId,
            title: `Capítulo ${parseInt(String(refId).replace('c', ''), 10) || ''}`.trim(),
            order: parseInt(String(refId).replace('c', ''), 10) || null,
            metadata: {
              placeholder: true,
              arc_id,
              arc_day,
              generated_by: provider,
              generated_model: model,
              generated_at: new Date().toISOString()
            }
          });
        }
      }
    }

    if (chapterRows.length) {
      const { error: chBatchErr } = await supabase
        .from('chapters')
        .upsert(chapterRows, { onConflict: 'chapter_id' });
      if (chBatchErr) throw chBatchErr;
    }

    for (const chapter of chapters) {
      const chapterId = normalizeChapterId(chapter && chapter.chapter_id) || null;
      if (!chapterId) continue;
      upsertedChapters += 1;

      const scenes = Array.isArray(chapter.scenes) ? chapter.scenes : [];
      const sceneRows = [];
      const optionRows = [];
      const optionIds = [];
      const mappingRows = [];

      for (let sIdx = 0; sIdx < scenes.length; sIdx += 1) {
        const sc = scenes[sIdx] || {};
        const sceneId = sc.scene_id || `${chapterId}-s${String(sIdx + 1).padStart(2, '0')}`;

        sceneRows.push({
          scene_id: sceneId,
          chapter_id: chapterId,
          title: sc.title || sceneId,
          order: Number(sc.order || (sIdx + 1)),
          metadata: {
            type: sc.type || null,
            scene_text: sc.text || null,
            text: sc.text || null,
            hero_stage: sc.hero_stage || null,
            emotional_beat: sc.emotional_beat || null,
            arc_id,
            arc_day
          }
        });

        const options = Array.isArray(sc.options) ? sc.options : [];
        for (let oIdx = 0; oIdx < options.length; oIdx += 1) {
          const opt = options[oIdx] || {};
          const optionId = opt.option_id || `${sceneId}-o${oIdx + 1}`;
          optionIds.push(optionId);

          const baseMeta = (opt.metadata && typeof opt.metadata === 'object') ? opt.metadata : {};

          optionRows.push({
            option_id: optionId,
            scene_id: sceneId,
            option_text: opt.option_text || `Opcion ${oIdx + 1}`,
            consequence: opt.consequence || null,
            next_chapter_id: (() => {
              const normalized = normalizeChapterId(opt && opt.next_chapter_id);
              return normalized && knownChapterIds.has(normalized) ? normalized : null;
            })(),
            next_scene_id: opt.next_scene_id || null,
            gds_mapping: opt.gds_mapping || [],
            metadata: Object.assign({}, baseMeta, {
              phq_mapping: opt.phq_mapping || baseMeta.phq_mapping || [],
              risk_flag: opt.risk_flag || baseMeta.risk_flag || null,
              arc_id,
              arc_day,
              generated_by: provider,
              generated_model: model,
              generated_at: new Date().toISOString()
            })
          });

          for (const gdsMap of (opt.gds_mapping || [])) {
            mappingRows.push({
              option_id: optionId,
              scale: 'GDS',
              item: gdsMap.item || null,
              weight: gdsMap.weight || null,
              confidence: gdsMap.confidence || null,
              primary_construct: gdsMap.primary_construct || gdsMap.rationale || null,
              rationale: gdsMap.rationale || null,
              mapping_source: gdsMap.mapping_source || mappingSource,
              source_confidence: gdsMap.confidence || null,
              validated: false
            });
          }

          for (const phqMap of (opt.phq_mapping || [])) {
            mappingRows.push({
              option_id: optionId,
              scale: 'PHQ',
              item: phqMap.item || null,
              weight: phqMap.weight || null,
              confidence: phqMap.confidence || null,
              primary_construct: phqMap.primary_construct || phqMap.rationale || null,
              rationale: phqMap.rationale || null,
              mapping_source: phqMap.mapping_source || mappingSource,
              source_confidence: phqMap.confidence || null,
              validated: false
            });
          }
        }
      }

      if (sceneRows.length) {
        const { error: sErr } = await supabase
          .from('scenes')
          .upsert(sceneRows, { onConflict: 'scene_id' });
        if (sErr) throw sErr;
        upsertedScenes += sceneRows.length;
      }

      if (optionRows.length) {
        const { error: oErr } = await supabase
          .from('options')
          .upsert(optionRows, { onConflict: 'option_id' });
        if (oErr) throw oErr;
        upsertedOptions += optionRows.length;
      }

      // Replace static mappings for these options to keep latest generated metrics consistent.
      if (optionIds.length) {
        try {
          const { error: delErr } = await supabase
            .from('clinical_mappings')
            .delete()
            .in('option_id', optionIds)
            .is('decision_id', null);
          if (delErr) console.warn('clinical_mappings delete warning', delErr.message || delErr);
        } catch (e) {
          console.warn('clinical_mappings delete exception', e && e.message);
        }
      }

      if (mappingRows.length) {
        try {
          const { error: mErr } = await supabase
            .from('clinical_mappings')
            .insert(mappingRows);
          if (mErr) {
            if (!String(mErr.message || '').includes('duplicate')) {
              console.warn('clinical_mappings insert warning', mErr.message || mErr);
            }
          } else {
            insertedMappings += mappingRows.length;
          }
        } catch (e) {
          console.warn('clinical_mappings insert exception', e && e.message);
        }
      }
    }

    return {
      ok: true,
      upserted_chapters: upsertedChapters,
      upserted_scenes: upsertedScenes,
      upserted_options: upsertedOptions,
      inserted_mappings: insertedMappings
    };
  } catch (err) {
    console.warn('persistGeneratedArcContentToCanonical error', err && err.message);
    return { ok: false, reason: err && err.message ? err.message : String(err) };
  }
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — running in local/mock mode');
}

// Provide a noop supabase client for local development when real credentials are missing
function makeNoopClient() {
  const createQueryBuilder = () => {
    const builder = {
      select: function () { return this; },
      in: function () { return this; },
      eq: function () { return this; },
      update: function () { return this; },
      match: function () { return this; },
      neq: function () { return this; },
      gt: function () { return this; },
      lt: function () { return this; },
      gte: function () { return this; },
      lte: function () { return this; },
      like: function () { return this; },
      contains: function () { return this; },
      is: function () { return this; },
      filter: function () { return this; },
      order: function () { return this; },
      limit: function () { return this; },
      range: function () { return this; },
      single: async function () { return { data: null, error: null }; },
      maybeSingle: async function () { return { data: null, error: null }; },
      // Proper Promise .then(onFulfilled, onRejected) implementation
      then: function (onFulfilled, onRejected) {
        try {
          const result = { data: null, error: null };
          return Promise.resolve(onFulfilled ? onFulfilled(result) : result);
        } catch (err) {
          return Promise.reject(onRejected ? onRejected(err) : err);
        }
      },
      catch: function (onRejected) {
        return Promise.reject(onRejected ? onRejected(new Error('noop')) : new Error('noop'));
      }
    };
    return builder;
  };

  return {
    from: (table) => {
      const builder = createQueryBuilder();
      builder.table = table;
      builder._payload = null;
      builder.insert = async function (payload) {
        console.log('[noop] insert into', table, payload);
        return { data: null, error: null };
      };
      builder.upsert = function (payload, options) {
        this._payload = payload;
        return {
          select: () => ({
            single: async () => ({ data: payload, error: null })
          })
        };
      };
      builder.delete = function () { return this; };
      return builder;
    }
  };
}

const supabase = (createClient && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : makeNoopClient();

// Latam story catalog (4 stories, c01-c14 each)
const STORY_CATALOG = [
  { id: 'mariana', file: 'story_mariana_huerto.json',  title: 'El huerto de Mariana',  protagonist: 'Mariana', description: 'Mariana descubre un huerto comunitario en Bogotá' },
  { id: 'tatiana', file: 'story_tatiana_taller.json',  title: 'El taller de Tatiana',  protagonist: 'Tatiana', description: 'Tatiana aprende a hacer almojábanas en Medellín' },
  { id: 'ernesto', file: 'story_ernesto_taller.json',  title: 'El taller de Ernesto',  protagonist: 'Ernesto', description: 'Ernesto trabaja madera en un taller de carpintería en Cali' },
  { id: 'alberto', file: 'story_alberto_ajedrez.json', title: 'El ajedrez de Alberto', protagonist: 'Alberto', description: 'Alberto juega ajedrez en el Parque Nacional de Bogotá' },
];

const STORIES = {};
for (const entry of STORY_CATALOG) {
  try {
    const p = path.join(__dirname, '..', 'content', 'latam', entry.file);
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      STORIES[entry.id] = { ...entry, chapters: data.chapters || [] };
      console.log(`Loaded story ${entry.id}: ${STORIES[entry.id].chapters.length} chapters`);
    } else { console.warn(`Story file not found: ${p}`); }
  } catch (e) { console.warn(`Failed to load story ${entry.id}:`, e && e.message); }
}

const DB_CHAPTER_CACHE = new Map();

function findChapter(chapter_id, story_id = null) {
  if (story_id && STORIES[story_id]) {
    return (STORIES[story_id].chapters || []).find(c => c.chapter_id === chapter_id) || null;
  }
  for (const story of Object.values(STORIES)) {
    const found = (story.chapters || []).find(c => c.chapter_id === chapter_id);
    if (found) return found;
  }
  return DB_CHAPTER_CACHE.get(chapter_id) || null;
}

async function hydrateChapterFromDb(chapter_id) {
  try {
    if (!chapter_id) return null;
    const { data: chapterRow, error: chErr } = await supabase
      .from('chapters')
      .select('*')
      .eq('chapter_id', chapter_id)
      .maybeSingle();
    if (chErr || !chapterRow) return null;

    const { data: scenes, error: scErr } = await supabase
      .from('scenes')
      .select('*')
      .eq('chapter_id', chapter_id)
      .order('order', { ascending: true });
    if (scErr || !scenes || !scenes.length) return null;

    const sceneIds = scenes.map(s => s.scene_id).filter(Boolean);
    const { data: options, error: optErr } = await supabase
      .from('options')
      .select('*')
      .in('scene_id', sceneIds);
    if (optErr) return null;

    const optionsByScene = new Map();
    (options || []).forEach((opt) => {
      if (!optionsByScene.has(opt.scene_id)) optionsByScene.set(opt.scene_id, []);
      optionsByScene.get(opt.scene_id).push(opt);
    });
    for (const [sceneId, opts] of optionsByScene.entries()) {
      opts.sort((a, b) => String(a.option_id || '').localeCompare(String(b.option_id || '')));
      optionsByScene.set(sceneId, opts);
    }

    const chapterObj = {
      chapter_id: chapterRow.chapter_id,
      title: chapterRow.title || null,
      order: chapterRow.order || null,
      scenes: scenes.map(sc => ({
        scene_id: sc.scene_id,
        title: sc.title || null,
        order: sc.order || null,
        text: (sc.metadata && sc.metadata.scene_text) ? sc.metadata.scene_text : (sc.title || ''),
        options: (optionsByScene.get(sc.scene_id) || []).map(opt => ({
          option_id: opt.option_id,
          option_text: opt.option_text,
          consequence: opt.consequence || null,
          next_scene_id: opt.next_scene_id || null,
          next_chapter_id: opt.next_chapter_id || null
        }))
      }))
    };

    DB_CHAPTER_CACHE.set(chapter_id, chapterObj);

    return chapterObj;
  } catch (e) {
    console.warn('hydrateChapterFromDb error', e && e.message);
    return null;
  }
}

function findScene(chapter_id, scene_id, story_id = null) {
  const ch = findChapter(chapter_id, story_id);
  if (!ch) return null;
  return (ch.scenes || []).find(s => s.scene_id === scene_id) || null;
}

function getStoryMeta(story_id) {
  return STORY_CATALOG.find(s => s.id === story_id) || null;
}

function getStorySelectionSpeech() {
  return 'Tenemos cuatro historias. ' +
    'Uno: Mariana descubre un huerto comunitario en Bogotá. ' +
    'Dos: Tatiana aprende a hacer almojábanas en Medellín. ' +
    'Tres: Ernesto trabaja madera en un taller de carpintería en Cali. ' +
    'Cuatro: Alberto juega ajedrez en el Parque Nacional de Bogotá. ' +
    '¿Cuál quieres escuchar? Di uno, dos, tres o cuatro.';
}

async function getUserStoryProgress(pseudonym) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('metadata')
      .eq('pseudonym', pseudonym)
      .maybeSingle();
    if (error || !data) return null;
    return (data.metadata && data.metadata.story_progress) || null;
  } catch (e) { return null; }
}

async function saveUserStoryProgress(pseudonym, story_id, chapter_id, completed_story_id = null) {
  if (!pseudonym) return;
  try {
    const { data: existing } = await supabase
      .from('users').select('metadata').eq('pseudonym', pseudonym).maybeSingle();
    const current = (existing && existing.metadata) || {};
    const progress = (current.story_progress) || {};
    const updated = {
      ...current,
      story_progress: {
        current_story_id: story_id,
        current_chapter_id: chapter_id,
        stories_completed: completed_story_id
          ? [...new Set([...(progress.stories_completed || []), completed_story_id])]
          : (progress.stories_completed || [])
      }
    };
    await supabase.from('users').update({ metadata: updated }).eq('pseudonym', pseudonym);
  } catch (e) { console.warn('saveUserStoryProgress error', e && e.message); }
}

async function insertSceneWithSchemaFallback(sceneRow) {
  const source = Object.assign({}, sceneRow || {});
  const mergedMetadata = Object.assign({}, source.metadata || {});

  // Persist dynamic scene fields inside metadata to stay compatible with minimal schemas.
  if (source.text && !mergedMetadata.scene_text) mergedMetadata.scene_text = source.text;
  if (source.type && !mergedMetadata.type) mergedMetadata.type = source.type;
  if (source.hero_stage && !mergedMetadata.hero_stage) mergedMetadata.hero_stage = source.hero_stage;
  if (source.emotional_direction && !mergedMetadata.emotional_direction) mergedMetadata.emotional_direction = source.emotional_direction;
  if (source.clinical_priority && !mergedMetadata.clinical_priority) mergedMetadata.clinical_priority = source.clinical_priority;
  if (source.raw_scene && !mergedMetadata.raw_scene) mergedMetadata.raw_scene = source.raw_scene;

  // Base payload uses canonical schema columns first.
  let payload = {
    scene_id: source.scene_id,
    chapter_id: source.chapter_id,
    title: source.title || source.scene_id || null,
    order: source.order,
    metadata: mergedMetadata
  };

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { error } = await supabase.from('scenes').insert([payload]);
    if (!error) return payload;

    const errMsg = String(
      (error && (error.message || error.details || error.hint)) || error || ''
    );
    const missingColMatch = errMsg.match(/Could not find the '([^']+)' column of 'scenes'/i);

    if (missingColMatch && missingColMatch[1]) {
      const missingCol = String(missingColMatch[1]);
      if (Object.prototype.hasOwnProperty.call(payload, missingCol)) {
        console.warn(`⚠️ scenes.${missingCol} not available in current schema; retrying insert without it`);
        delete payload[missingCol];
        continue;
      }

      // If metadata itself is missing, try minimal insert with only required identifiers.
      if (missingCol === 'metadata' && Object.prototype.hasOwnProperty.call(payload, 'metadata')) {
        console.warn('⚠️ scenes.metadata not available in current schema; retrying minimal scene insert');
        delete payload.metadata;
        continue;
      }
    }

    throw error;
  }

  throw new Error('insertSceneWithSchemaFallback failed after schema fallback attempts');
}

async function upsertOptionsWithSchemaFallback(optionRows = []) {
  let payloads = (Array.isArray(optionRows) ? optionRows : [])
    .filter(Boolean)
    .map(r => Object.assign({}, r));

  if (!payloads.length) return [];

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { error } = await supabase.from('options').upsert(payloads, { onConflict: 'option_id' });
    if (!error) return payloads;

    const errMsg = String((error && (error.message || error.details || error.hint)) || error || '');
    const missingColMatch = errMsg.match(/Could not find the '([^']+)' column of 'options'/i);

    if (missingColMatch && missingColMatch[1]) {
      const missingCol = String(missingColMatch[1]);
      let removedAny = false;
      payloads = payloads.map((row) => {
        if (Object.prototype.hasOwnProperty.call(row, missingCol)) {
          removedAny = true;
          const copy = Object.assign({}, row);
          delete copy[missingCol];
          return copy;
        }
        return row;
      });

      if (removedAny) {
        console.warn(`⚠️ options.${missingCol} not available in current schema; retrying upsert without it`);
        continue;
      }
    }

    throw error;
  }

  throw new Error('upsertOptionsWithSchemaFallback failed after schema fallback attempts');
}

function mapAlexaOptions(rawOptions = []) {
  return (rawOptions || []).slice(0, 3).map((o, idx) => ({
    option_id: o.option_id,
    option_text: o.option_text,
    index: idx + 1,
    next_chapter_id: o.next_chapter_id || null,
    next_scene_id: o.next_scene_id || null
  }));
}

function getSequentialSceneId(chapter_id, scene) {
  if (!chapter_id || !scene) return null;

  const orderFromField = Number(scene.order);
  if (Number.isFinite(orderFromField) && orderFromField > 0) {
    return `${chapter_id}-s${String(orderFromField + 1).padStart(2, '0')}`;
  }

  const m = String(scene.scene_id || '').match(/-s(\d{1,2})/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${chapter_id}-s${String(n + 1).padStart(2, '0')}`;
}

async function advanceToPlayableScene(session_id, chapter_id, initialScene, initialChapter = null, maxHops = 5, story_id = null) {
  let nextChapter = initialChapter || (chapter_id ? findChapter(chapter_id, story_id) : null);
  if (!nextChapter && chapter_id && !story_id) {
    nextChapter = await hydrateChapterFromDb(chapter_id);
  }

  let nextScene = initialScene || null;
  const traversedScenes = [];
  const visited = new Set();
  let hops = 0;

  while (nextScene && hops <= maxHops) {
    const sid = String(nextScene.scene_id || '');
    if (!sid || visited.has(sid)) break;
    visited.add(sid);
    traversedScenes.push(nextScene);

    const nextOpts = mapAlexaOptions(nextScene.options || []);
    if (nextOpts.length > 0) {
      return { nextChapter, nextScene, nextOpts, traversedScenes, exhausted: false };
    }

    const chapterRef = (nextChapter && nextChapter.chapter_id) || chapter_id;
    const seqSceneId = getSequentialSceneId(chapterRef, nextScene);
    if (!seqSceneId || !chapterRef) break;

    const resolved = await resolveOrGenerateNextScene(session_id || null, chapterRef, seqSceneId, { story_id });
    if (!resolved.nextScene) break;
    nextChapter = resolved.nextChapter || nextChapter;
    nextScene = resolved.nextScene;
    hops += 1;
  }

  return {
    nextChapter,
    nextScene,
    nextOpts: mapAlexaOptions((nextScene && nextScene.options) || []),
    traversedScenes,
    exhausted: true
  };
}

async function resolveOrGenerateNextScene(session_id, chapter_id, nextSceneId, options = {}) {
  const allowGeneration = options.allowGeneration !== false;
  if (!chapter_id || !nextSceneId) return { nextChapter: null, nextScene: null };

  const requestedSceneId = String(nextSceneId || '').trim();
  const canonicalSceneId = requestedSceneId.replace(/^(c\d{2}-s\d{2})[a-z]$/i, '$1');
  const sceneIdCandidates = requestedSceneId === canonicalSceneId
    ? [requestedSceneId]
    : [requestedSceneId, canonicalSceneId];

  // 1) Try in-memory chapter first (story-scoped if story_id provided).
  let nextChapter = findChapter(chapter_id, options.story_id || null);
  let nextScene = (nextChapter && nextChapter.scenes)
    ? nextChapter.scenes.find(s => sceneIdCandidates.includes(String(s.scene_id || '')))
    : null;
  if (nextScene) return { nextChapter, nextScene };

  // For latam JSON stories, skip DB hydration and LLM generation.
  if (options.story_id && STORIES[options.story_id]) {
    return { nextChapter: null, nextScene: null };
  }

  // 2) Try DB hydration.
  nextChapter = await hydrateChapterFromDb(chapter_id);
  nextScene = (nextChapter && nextChapter.scenes)
    ? nextChapter.scenes.find(s => sceneIdCandidates.includes(String(s.scene_id || '')))
    : null;
  if (nextScene) return { nextChapter, nextScene };

  // 3) When content is missing, pre-generate the full upcoming week (no lazy mode by default).
  if (!allowGeneration) {
    return { nextChapter, nextScene: null };
  }

  const m = String(nextSceneId).match(/-s(\d{1,2})[a-z]?$/i);
  const targetSceneNum = m ? Number(m[1]) : null;
  if (!targetSceneNum || !session_id) return { nextChapter, nextScene: null };

  try {
    if (DISABLE_LAZY_SCENE_GENERATION) {
      await generateNextWeekForSession(session_id, chapter_id, {
        chapter_count: AUTO_MISSING_SCENE_CHAPTER_COUNT,
        start_chapter_id: chapter_id,
        update_session_chapter: false,
        trigger_source: 'auto_missing_scene_resolution'
      });
    } else {
      // Legacy fallback for environments that still require lazy scene generation.
      const currentSceneOrder = Math.max(0, targetSceneNum - 1);
      await generateNextSceneForSession(session_id, chapter_id, currentSceneOrder);
    }

    nextChapter = await hydrateChapterFromDb(chapter_id);
    nextScene = (nextChapter && nextChapter.scenes)
      ? nextChapter.scenes.find(s => s.scene_id === nextSceneId)
      : null;
  } catch (e) {
    console.warn('resolveOrGenerateNextScene error', e && e.message ? e.message : e);
  }

  return { nextChapter, nextScene };
}

function chapterNamespaceLooksValid(chapter) {
  if (!chapter || !chapter.chapter_id) return false;
  const scenes = Array.isArray(chapter.scenes) ? chapter.scenes : [];
  if (!scenes.length) return false;
  const prefix = `${chapter.chapter_id}-s`;
  return scenes.every(sc => String(sc && sc.scene_id || '').startsWith(prefix));
}

async function ensureOptionsUpsert() {
  try {
    const allChapters = Object.values(STORIES).flatMap(s => s.chapters || []);
    // PASS 1: Insert ALL chapters first (to satisfy FK from options.next_chapter_id)
    for (const ch of allChapters) {
      try {
        const chapterRow = { chapter_id: ch.chapter_id, title: ch.title || null, order: ch.order || null };
        const { error: cerr } = await supabase.from('chapters').upsert([chapterRow], { onConflict: 'chapter_id' }).select();
        if (cerr) console.warn('chapters upsert error', cerr);
        else console.log('ensured chapter', ch.chapter_id);
      } catch (e) {
        console.warn('chapters ensure exception', e && e.message);
      }
    }

    // PASS 2: Insert ALL scenes (to satisfy FK from options.scene_id)
    for (const ch of allChapters) {
      for (const sc of (ch.scenes || [])) {
        try {
          const sceneRow = {
            scene_id: sc.scene_id,
            chapter_id: ch.chapter_id,
            title: sc.title || sc.scene_id,
            order: sc.order || null,
            metadata: (sc.metadata && typeof sc.metadata === 'object') ? sc.metadata : {}
          };
          const { error: serr } = await supabase.from('scenes').upsert([sceneRow], { onConflict: 'scene_id' }).select();
          if (serr) console.warn('scenes upsert error', serr);
        } catch (e) {
          console.warn('scene ensure exception', e && e.message);
        }
      }
    }

    // PASS 3: Insert ALL options (now all chapters and scenes exist for FKs)
    for (const ch of allChapters) {
      for (const sc of (ch.scenes || [])) {
        for (const opt of (sc.options || [])) {
          const optRow = {
            option_id: opt.option_id,
            scene_id: sc.scene_id,
            option_text: opt.option_text,
            consequence: opt.consequence || null,
            next_chapter_id: opt.next_chapter_id || null,
            next_scene_id: opt.next_scene_id || null,
            gds_mapping: opt.gds_mapping || null,
            metadata: opt.metadata || null
          };
          try {
            try {
              await upsertOptionsWithSchemaFallback([optRow]);
            } catch (oerr) {
              console.warn('options upsert error', oerr);
            }
          } catch (e) { console.warn('options upsert exception', e && e.message); }
        }
      }
    }

    // PASS 4: Insert clinical mappings
    for (const ch of allChapters) {
      for (const sc of (ch.scenes || [])) {
        for (const opt of (sc.options || [])) {
          const gdsMappings = opt.gds_mapping || [];
          const phqMappings = opt.phq_mapping || [];
          
          for (const gdsMap of gdsMappings) {
            const cmRow = {
              option_id: opt.option_id,
              scale: 'GDS',
              item: gdsMap.item || null,
              weight: gdsMap.weight || null,
              confidence: gdsMap.confidence || null,
              primary_construct: gdsMap.rationale || null,
              rationale: gdsMap.rationale || null,
              mapping_source: 'designer',
              source_confidence: gdsMap.confidence || null,
              validated: true
            };
            try {
              const { error: merr } = await supabase.from('clinical_mappings').insert([cmRow]);
              if (merr && !merr.message?.includes('duplicate')) console.warn('clinical_mappings (GDS) insert error', merr);
            } catch (e) { console.warn('clinical_mappings error', e && e.message); }
          }

          for (const phqMap of phqMappings) {
            const cmRow = {
              option_id: opt.option_id,
              scale: 'PHQ',
              item: phqMap.item || null,
              weight: phqMap.weight || null,
              confidence: phqMap.confidence || null,
              primary_construct: phqMap.rationale || null,
              rationale: phqMap.rationale || null,
              mapping_source: 'designer',
              source_confidence: phqMap.confidence || null,
              validated: true
            };
            try {
              const { error: merr } = await supabase.from('clinical_mappings').insert([cmRow]);
              if (merr && !merr.message?.includes('duplicate')) console.warn('clinical_mappings (PHQ) insert error', merr);
            } catch (e) { console.warn('clinical_mappings error', e && e.message); }
          }
        }
      }
    }
  } catch (e) {
    console.warn('ensureOptionsUpsert failed', e && e.message);
  }
}

// Lightweight validator
function ensureSessionPayload(p) {
  return validateTelemetryPayload(p).valid;
}

function validateSessionPayloadDetails(p) {
  return validateTelemetryPayload(p);
}

function parseRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// Helpers to call Alexa Reminders API using native https
const https = require('https');
// Toggle reminders (true = enabled)
const REMINDERS_ENABLED = true;
// Toggle local reminder persistence (set to "true" to enable)
const REMINDERS_LOCAL_PERSIST = String(process.env.REMINDERS_LOCAL_PERSIST || '').toLowerCase() === 'true';
// Toggle auto-continue to the next chapter at end-of-chapter (set to "false" to disable)
const AUTO_CONTINUE_NEXT_CHAPTER = String(process.env.ALEXA_AUTO_CONTINUE_NEXT_CHAPTER || '').toLowerCase() !== 'false';
// Optional fallback: set to true to allow scene-by-scene bootstrap when weekly generation fails.
const PREFER_SCENE_BY_SCENE_NEXT_CHAPTER = String(process.env.PREFER_SCENE_BY_SCENE_NEXT_CHAPTER || 'false').toLowerCase() === 'true';

// Test mode: auto-select first option in each scene (set to "true" to enable for testing)
const SKIP_SCENES = String(process.env.SKIP_SCENES || 'false').toLowerCase() === 'true';

// Schedule reminder by appending to a local JSON file (demo persistence)
function scheduleReminderLocal(pseudonym, session_id, remindAtISO) {
  try {
    if (!REMINDERS_LOCAL_PERSIST) return null;
    const dd = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dd)) fs.mkdirSync(dd, { recursive: true });
    const fp = path.join(dd, 'reminders.json');
    let list = [];
    if (fs.existsSync(fp)) {
      try { list = JSON.parse(fs.readFileSync(fp, 'utf8')) || []; } catch (e) { list = []; }
    }
    const entry = { reminder_id: uuidv4(), pseudonym: pseudonym || null, session_id: session_id || null, remind_at: remindAtISO, created_at: new Date().toISOString() };
    list.push(entry);
    fs.writeFileSync(fp, JSON.stringify(list, null, 2), 'utf8');
    console.log('scheduled reminder locally', entry);
    return entry;
  } catch (e) {
    console.warn('failed to schedule reminder locally', e && e.message);
    return null;
  }
}

function alexaGetTimeZone(apiEndpoint, apiAccessToken, deviceId) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(`${apiEndpoint}/v2/devices/${deviceId}/settings/System.timeZone`);
      const options = { method: 'GET', headers: { Authorization: `Bearer ${apiAccessToken}` } };
      const req = https.request(url, options, (res) => {
        let body = '';
        res.on('data', (c) => body += c.toString());
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve(body.replace(/"/g, ''));
          return reject(new Error(`timezone lookup failed ${res.statusCode} ${body}`));
        });
      });
      req.on('error', reject);
      req.end();
    } catch (e) { reject(e); }
  });
}

function alexaCreateReminder(apiEndpoint, apiAccessToken, payload) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(`${apiEndpoint}/v1/alerts/reminders`);
      const body = JSON.stringify(payload);
      const options = {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiAccessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body, 'utf8')
        }
      };
      const req = https.request(url, options, (res) => {
        let resp = '';
        res.on('data', (c) => resp += c.toString());
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve({ status: res.statusCode, body: resp });
          return reject({ status: res.statusCode, body: resp });
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    } catch (e) { reject(e); }
  });
}

async function handleTelemetry(req, res) {
  try {
    const payload = await parseJsonBody(req);
    
    // ============= SPRINT 2b: Payload Validation =============
    // Validate against JSON schema
    const validation = validatePayload(payload);
    if (!validation.valid) {
      console.warn('❌ Telemetry payload validation failed:', validation.errors);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: 'payload validation failed',
        details: validation.errors,
        hint: 'Ensure payload has required fields: session_id, decision_id, timestamp, payload with chapter_id, scene_id, option_id'
      }));
    }
    
    // Additional semantic validation (after schema validation passes)
    const semanticValidation = validateSessionPayloadDetails(payload);
    if (!semanticValidation.valid) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: 'invalid payload structure',
        details: semanticValidation.errors,
        hint: 'Expected a telemetry payload with a valid session_id, optional pseudonym/consent fields, and decisions[] entries containing timestamp, scene_id, and option_id when decisions are present.'
      }));
    }
    
    const result = await processTelemetryPayload(payload, req.headers);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(result));
  } catch (err) {
    console.error('telemetry error', err && err.message, err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

async function handleIdentify(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { pseudonym } = body || {};
    if (!pseudonym) { res.writeHead(400, {'Content-Type':'application/json'}); return res.end(JSON.stringify({ error: 'pseudonym required' })); }

    const token = uuidv4();
    const expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(); // 24h

    const { error: insErr } = await supabase.from('auth_tokens').insert([{ token, pseudonym, expires_at }]);
    if (insErr) throw insErr;

    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ ok: true, token, expires_at }));
  } catch (err) {
    console.error('identify error', err);
    res.writeHead(500, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

async function handleAlexa(req, res) {
  try {
    const rawBody = await parseRawBody(req);
    let body;
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr.message);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const errorResp = {
        version: '1.0',
        response: {
          outputSpeech: { type: 'PlainText', text: 'Error al procesar la solicitud. Por favor intenta de nuevo.' },
          shouldEndSession: true
        },
        sessionAttributes: {}
      };
      return res.end(JSON.stringify(errorResp));
    }

    console.log('alexa request received');
    console.log(JSON.stringify(body));
    try { console.log('alexa headers:', JSON.stringify(req.headers)); } catch (e) {}
    if (!body || !body.request) {
      console.warn('Invalid Alexa request structure');
      res.writeHead(200, {'Content-Type':'application/json'});
      const errorResp = {
        version: '1.0',
        response: {
          outputSpeech: { type: 'PlainText', text: 'No se reconoce como solicitud válida.' },
          shouldEndSession: true
        },
        sessionAttributes: {}
      };
      return res.end(JSON.stringify(errorResp));
    }

    // In dev mode, skip verification
    const DISABLE_ALEXA_VERIFICATION = String(process.env.DISABLE_ALEXA_VERIFICATION || 'false').toLowerCase() === 'true';
    if (!DISABLE_ALEXA_VERIFICATION) {
      const hasSignatureHeader = Boolean(req.headers?.signature || req.headers?.['x-amzn-signature']);
      const hasCertChainHeader = Boolean(
        req.headers?.signaturecertchainurl ||
        req.headers?.['x-amzn-signature-cert-chain-url'] ||
        req.headers?.['x-amzn-signature-certchainurl']
      );
      console.log('[alexa] signature headers present:', {
        signature: hasSignatureHeader,
        certChainUrl: hasCertChainHeader
      });
      const verification = await verifyAlexaRequest({ headers: req.headers, rawBody });
      if (!verification.valid) {
        console.warn('Alexa verification failed:', verification.error);
        // Always return 200 with valid Alexa response, even on verification failure
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const errorResp = {
          version: '1.0',
          response: {
            outputSpeech: { type: 'PlainText', text: 'No se pudo verificar tu solicitud. Por favor intenta de nuevo.' },
            shouldEndSession: true
          },
          sessionAttributes: {}
        };
        return res.end(JSON.stringify(errorResp));
      }
    } else {
      console.log('⚠️  DISABLE_ALEXA_VERIFICATION is true; skipping signature verification for testing');
    }

    const noResponsePrompt = 'Si quieres continuar, responde ahora. Si no, vuelve pronto.';
    const MAX_ALEXA_TEXT_CHARS = Math.max(400, Number(process.env.MAX_ALEXA_TEXT_CHARS || 1200));
    const MAX_REPROMPT_CHARS = Math.max(120, Number(process.env.MAX_ALEXA_REPROMPT_CHARS || 220));

    function compactNarrativeSegments(segments = [], maxSegments = 2) {
      const list = Array.isArray(segments) ? segments : [];
      const seen = new Set();
      const out = [];
      for (const raw of list) {
        const text = String(raw || '').replace(/\s+/g, ' ').trim();
        if (!text) continue;
        const fingerprint = text
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (!fingerprint || seen.has(fingerprint)) continue;
        seen.add(fingerprint);
        out.push(text);
        if (out.length >= maxSegments) break;
      }
      return out;
    }

    function trimAlexaText(value, maxChars = MAX_ALEXA_TEXT_CHARS) {
      const text = String(value || '').replace(/\s+/g, ' ').trim();
      if (text.length <= maxChars) return text;
      const cut = text.slice(0, maxChars);
      const punctuationIdx = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
      if (punctuationIdx >= 120) return cut.slice(0, punctuationIdx + 1).trim();
      return `${cut.trim()}...`;
    }
    function buildAlexaSceneSpeech(sceneText = '', options = [], extraTail = '', maxChars = MAX_ALEXA_TEXT_CHARS) {
      const labels = ['uno', 'dos', 'tres'];
      const optionLines = (options || []).slice(0, 3).map((o, i) => `${labels[i]}. ${o.option_text}`);
      const tailText = String(extraTail || '').trim();
      const reservedForOptions = optionLines.join('. ').length + (tailText ? tailText.length + 1 : 0) + 40;
      const narrativeBudget = Math.max(180, maxChars - reservedForOptions);
      const safeNarrative = trimAlexaText(sceneText, narrativeBudget);
      let speech = safeNarrative;
      if (optionLines.length > 0) {
        speech += (speech ? ' ' : '') + optionLines.join('. ');
      }
      if (tailText) {
        speech += (speech ? ' ' : '') + tailText;
      }
      return trimAlexaText(speech, maxChars);
    }

    function normalizeSceneIdFallback(sceneId) {
      const raw = String(sceneId || '').trim();
      if (!raw) return null;
      const base = raw.replace(/[ab]$/i, '');
      return base !== raw ? base : null;
    }

    // Helpers for Alexa responses
    function alexaResponse(text, sessionAttributes = {}, shouldEndSession = false, isNarrative = true, repromptText = null) {
      const stripSsml = (value) => String(value || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/([a-záéíóúñ])([A-Z][a-z])/g, '$1 $2')
        .replace(/\bStill\b/gi, 'Aun así')
        .replace(/\s+/g, ' ')
        .trim();

      const plainText = trimAlexaText(stripSsml(text), MAX_ALEXA_TEXT_CHARS);
      const resp = { version: '1.0', response: { outputSpeech: { type: 'PlainText', text: plainText }, shouldEndSession }, sessionAttributes };

      if (!shouldEndSession && repromptText) {
        resp.response.reprompt = { outputSpeech: { type: 'PlainText', text: trimAlexaText(stripSsml(repromptText), MAX_REPROMPT_CHARS) } };
      }
      try { console.log('alexa response =>', JSON.stringify(resp)); } catch (e) { console.log('alexa response (err stringify)'); }
      return resp;
    }

    function alexaElicitPseudonym(text, sessionAttributes = {}, repromptText = null) {
      const stripSsml = (value) => String(value || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const plainText = trimAlexaText(stripSsml(text), MAX_ALEXA_TEXT_CHARS);
      const resp = {
        version: '1.0',
        response: {
          outputSpeech: { type: 'PlainText', text: plainText },
          shouldEndSession: false,
          directives: [
            {
              type: 'Dialog.ElicitSlot',
              slotToElicit: 'pseudonym',
              updatedIntent: {
                name: 'PseudonymIntent',
                confirmationStatus: 'NONE',
                slots: {
                  pseudonym: {
                    name: 'pseudonym',
                    confirmationStatus: 'NONE'
                  }
                }
              }
            }
          ]
        },
        sessionAttributes
      };

      if (repromptText) {
        resp.response.reprompt = {
          outputSpeech: { type: 'PlainText', text: trimAlexaText(stripSsml(repromptText), MAX_REPROMPT_CHARS) }
        };
      }

      try { console.log('alexa response (elicit pseudonym) =>', JSON.stringify(resp)); } catch (e) { console.log('alexa response (elicit pseudonym, err stringify)'); }
      return resp;
    }

    const sessionAttrs = (body.session && body.session.attributes) ? body.session.attributes : {};
    const requestLocale = String((body.request && body.request.locale) || sessionAttrs.locale || 'es-MX');
    const geoSetting = getGeographicSetting(requestLocale);
    try { console.log('alexa request summary', { type: body.request && body.request.type ? body.request.type : null, intent: (body.request && body.request.intent && body.request.intent.name) ? body.request.intent.name : null, inputTranscript: body.request && body.request.inputTranscript ? body.request.inputTranscript : null, sessionAttrs }); } catch (e) {}

    if (body.request.type === 'SessionEndedRequest') {
      try {
        const reason = String((body.request && body.request.reason) || '').toUpperCase();
        const endedPayload = {
          session_id: sessionAttrs.session_id || null,
          source: 'alexa',
          pseudonym: sessionAttrs.pseudonym || null,
          chapter_id: sessionAttrs.chapter_id || null,
          ended_at: (body.request && body.request.timestamp) || new Date().toISOString(),
          abandonment_flag: reason === 'ERROR' || reason === 'EXCEEDED_MAX_REPROMPTS',
          consent_given: typeof sessionAttrs.consent_given === 'boolean' ? sessionAttrs.consent_given : undefined,
          metadata: {
            alexa_end_reason: reason || null
          }
        };

        if (endedPayload.session_id) {
          await processTelemetryPayload(endedPayload, req.headers);
        }
      } catch (e) {
        console.warn('session end telemetry warning', e && e.message ? e.message : e);
      }

      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({ ok: true }));
    }

    // Flow states: 'login', 'confirm_pseudonym', 'consent', 'scene'
    if (body.request.type === 'LaunchRequest') {
      // Start mini-login flow
      const sa = Object.assign({}, sessionAttrs, { stage: 'login', locale: requestLocale });
      const speech = 'Bienvenido a Escoge tu Historia. Para comenzar, dime tu pseudónimo.';
      const loginReprompt = 'Dime tu pseudónimo, por ejemplo Felipe.';
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify(alexaElicitPseudonym(speech, sa, loginReprompt)));
    }

    if (body.request.type === 'IntentRequest') {
      const intentName = (body.request.intent && body.request.intent.name) || 'UnknownIntent';

      // Stop / Cancel: always handle first, before any stage logic
      if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
        const goodbyeSpeech = '¡Vuelve pronto! Aquí estaremos cuando quieras continuar tu historia.';
        if (sessionAttrs.session_id) {
          try {
            await supabase.from('sessions').update({ ended_at: new Date().toISOString(), is_closed: true, abandonment_flag: false }).eq('session_id', sessionAttrs.session_id);
          } catch (e) { console.warn('session close on stop error', e && e.message); }
        }
        res.writeHead(200, {'Content-Type':'application/json'});
        return res.end(JSON.stringify(alexaResponse(goodbyeSpeech, {}, true)));
      }

      // User provided pseudonym (expect slot named 'pseudonym')
      if (sessionAttrs.stage === 'login') {
        // Debug logs for login stage: show raw inputTranscript and provided slots
        try { console.log('login debug - inputTranscript:', body.request.inputTranscript || '(none)'); } catch (e) {}
        try { console.log('login debug - intent.slots:', JSON.stringify((body.request.intent && body.request.intent.slots) || {})); } catch (e) {}
        // Robust extraction: prefer explicit `pseudonym` slot, otherwise take first non-empty slot,
        // otherwise fall back to `inputTranscript` (useful when Alexa maps to Fallback/Resume intents).
        const slots = (body.request.intent && body.request.intent.slots) || {};
        let pseudonym = null;
        if (slots.pseudonym && (slots.pseudonym.value || (slots.pseudonym.resolutions && slots.pseudonym.resolutions.resolutionsPerAuthority && slots.pseudonym.resolutions.resolutionsPerAuthority[0] && slots.pseudonym.resolutions.resolutionsPerAuthority[0].values && slots.pseudonym.resolutions.resolutionsPerAuthority[0].values[0].value && slots.pseudonym.resolutions.resolutionsPerAuthority[0].values[0].value.name))) {
          pseudonym = slots.pseudonym.value || (slots.pseudonym.resolutions && slots.pseudonym.resolutions.resolutionsPerAuthority && slots.pseudonym.resolutions.resolutionsPerAuthority[0] && slots.pseudonym.resolutions.resolutionsPerAuthority[0].values && slots.pseudonym.resolutions.resolutionsPerAuthority[0].values[0].value.name) || null;
        }
        if (!pseudonym) {
          for (const k of Object.keys(slots || {})) {
            const s = slots[k];
            if (s && s.value) { pseudonym = s.value; break; }
          }
        }
        if (!pseudonym && body.request && body.request.inputTranscript) {
          pseudonym = String(body.request.inputTranscript).trim();
        }
        if (pseudonym) {
          const pn = String(pseudonym).slice(0,64);
          const sa = Object.assign({}, sessionAttrs, { stage: 'confirm_pseudonym', pending_pseudonym: pn });
          const speech = `Dijiste ${pn}. ¿Es correcto tu pseudónimo? Di sí o no.`;
          const confirmReprompt = 'Responde sí para confirmar tu pseudónimo, o no para cambiarlo.';
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse(speech, sa, false, true, confirmReprompt)));
        }
        // If no pseudonym provided, reprompt
        const loginReprompt = 'Dime tu pseudónimo, por ejemplo Felipe.';
        res.writeHead(200, {'Content-Type':'application/json'});
        return res.end(JSON.stringify(alexaElicitPseudonym('No entendí tu pseudónimo. Por favor dilo de nuevo.', sessionAttrs, loginReprompt)));
      }

      if (sessionAttrs.stage === 'confirm_pseudonym') {
        const consentSlots = (body.request.intent && body.request.intent.slots) || {};
        const slotValues = Object.keys(consentSlots).map(k => (consentSlots[k] && consentSlots[k].value) || '').filter(Boolean).map(s => String(s).toLowerCase());
        const intentNorm = String(intentName || '').toLowerCase();
        const isYes = intentName === 'AMAZON.YesIntent' || intentNorm.endsWith('yesintent') || slotValues.some(v => ['si', 'sí', 'si.', 'sí.','yes','y'].includes(v));
        const isNo = intentName === 'AMAZON.NoIntent' || intentNorm.endsWith('nointent') || slotValues.some(v => ['no','nop','no.'].includes(v));

        const pending = sessionAttrs.pending_pseudonym || null;
        if (!pending) {
          const sa = Object.assign({}, sessionAttrs, { stage: 'login', pending_pseudonym: null, pseudonym: null });
          const speech = 'No tengo tu pseudónimo. Por favor dilo de nuevo.';
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse(speech, sa, false, true, noResponsePrompt)));
        }

        if (isNo) {
          const sa = Object.assign({}, sessionAttrs, { stage: 'login', pending_pseudonym: null, pseudonym: null });
          const speech = 'De acuerdo. Dime tu pseudónimo de nuevo.';
          const loginReprompt = 'Dime tu pseudónimo, por ejemplo Felipe.';
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaElicitPseudonym(speech, sa, loginReprompt)));
        }

        if (isYes) {
          const pn = String(pending).slice(0,64);
          // Ensure user exists before asking for consent
          try {
            const { error: userErr } = await supabase
              .from('users')
              .upsert({ pseudonym: pn, created_at: new Date().toISOString() }, { onConflict: 'pseudonym' })
              .select();
            if (userErr) console.warn('user upsert error (login stage):', userErr);
          } catch (e) { console.warn('user upsert exception (login stage)', e && e.message); }

          const sa = Object.assign({}, sessionAttrs, { stage: 'consent', pseudonym: pn, pending_pseudonym: null });
          const speech = `Hola ${pn}. Antes de continuar, das tu consentimiento para registrar tu progreso? Di sí o no.`;
          const consentReprompt = 'Responde sí para dar consentimiento, o no para salir.';
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse(speech, sa, false, true, consentReprompt)));
        }

        const confirmReprompt = 'Responde sí para confirmar tu pseudónimo, o no para cambiarlo.';
        res.writeHead(200, {'Content-Type':'application/json'});
        return res.end(JSON.stringify(alexaResponse('Por favor responde sí o no.', sessionAttrs, false, true, confirmReprompt)));
      }

      // Scheduling decision: handle reminder confirmation
      if (sessionAttrs.stage === 'schedule_reminder') {
        const consentSlots = (body.request.intent && body.request.intent.slots) || {};
        const slotValues = Object.keys(consentSlots).map(k => (consentSlots[k] && consentSlots[k].value) || '').filter(Boolean).map(s => String(s).toLowerCase());
        const intentNorm = String(intentName || '').toLowerCase();
        const isYes = intentName === 'AMAZON.YesIntent' || intentNorm.endsWith('yesintent') || slotValues.some(v => ['si', 'sí', 'si.', 'sí.','yes','y'].includes(v));
        const isNo = intentName === 'AMAZON.NoIntent' || intentNorm.endsWith('nointent') || slotValues.some(v => ['no','nop','no.'].includes(v));
        if (isYes) {
            // Check system tokens for Reminders API and user consent
            const sys = (body.context && body.context.System) ? body.context.System : null;
            const apiAccessToken = sys && sys.apiAccessToken ? sys.apiAccessToken : null;
            const apiEndpoint = sys && sys.apiEndpoint ? sys.apiEndpoint : null;
            const deviceId = sys && sys.device && sys.device.deviceId ? sys.device.deviceId : null;
            const consentToken = sys && sys.user && sys.user.permissions && sys.user.permissions.consentToken ? sys.user.permissions.consentToken : null;
            if (!consentToken || !apiAccessToken || !apiEndpoint || !deviceId) {
              // Ask for permission via card (consentToken required)
              const speech = 'Necesito permiso para crear recordatorios. Por favor, revisa la app de Alexa.';
              const resp = { version: '1.0', response: { outputSpeech: { type: 'PlainText', text: speech }, shouldEndSession: true, card: { type: 'AskForPermissionsConsent', permissions: ['alexa::alerts:reminders:skill:readwrite'] } } };
              res.writeHead(200, {'Content-Type':'application/json'});
              return res.end(JSON.stringify(resp));
            }

            // Ask user when they want the reminder
            const sa = Object.assign({}, sessionAttrs, { stage: 'reminder_time' });
            const speech = '¿Para cuándo quieres el recordatorio? Di por ejemplo "mañana", "pasado mañana" o una fecha como "31 de marzo", o di "mañana a las 10".';
            res.writeHead(200, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse(speech, sa, false, true, noResponsePrompt)));
        }
        if (isNo) {
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse('De acuerdo. No programaré un recordatorio. Hasta luego.', {}, true)));
        }
        res.writeHead(200, {'Content-Type':'application/json'});
        return res.end(JSON.stringify(alexaResponse('No entendí. ¿Quieres que te recuerde mañana para continuar? Di sí o no.', sessionAttrs, false, true, noResponsePrompt)));
      }

      // Consent handling (be tolerant to different intent names and slot values)
      // Reminder time handling: parse when the user wants the reminder and create it
      if (sessionAttrs.stage === 'reminder_time') {
        try {
          const sys = (body.context && body.context.System) ? body.context.System : null;
          const apiAccessToken = sys && sys.apiAccessToken ? sys.apiAccessToken : null;
          const apiEndpoint = sys && sys.apiEndpoint ? sys.apiEndpoint : null;
          const deviceId = sys && sys.device && sys.device.deviceId ? sys.device.deviceId : null;
          if (!apiAccessToken || !apiEndpoint || !deviceId) {
            const speech = 'Para programar recordatorios necesito permiso. Revisa la app de Alexa.';
            const resp = { version: '1.0', response: { outputSpeech: { type: 'PlainText', text: speech }, shouldEndSession: true, card: { type: 'AskForPermissionsConsent', permissions: ['alexa::alerts:reminders:skill:readwrite'] } } };
            res.writeHead(200, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(resp));
          }

          const slots = (body.request.intent && body.request.intent.slots) || {};
          const slotDate = slots.date && slots.date.value ? String(slots.date.value).toLowerCase() : '';
          const slotTime = slots.time && slots.time.value ? String(slots.time.value).toLowerCase() : '';
          const utter = Object.keys(slots).map(k => (slots[k] && slots[k].value) || '').filter(Boolean).join(' ').toLowerCase();

          // Basic parsing: support 'mañana', 'hoy', explicit YYYY-MM-DD, and optional hour like 'a las 10' or 'diez'
          let target = new Date();
          let hour = 9, minute = 0;
          function extractHourFromUtterance(text) {
            if (!text) return null;
            const lower = String(text).toLowerCase();
            const hm = lower.match(/\b(\d{1,2})(?::(\d{2}))?\b/);
            if (hm) {
              let hour = parseInt(hm[1], 10);
              let minute = hm[2] ? parseInt(hm[2], 10) : 0;
              const isPm = /\b(pm|p\.m\.|tarde|noche)\b/.test(lower);
              const isAm = /\b(am|a\.m\.|mañana|manana)\b/.test(lower);
              if (isPm && hour >= 1 && hour <= 11) hour += 12;
              else if (isAm && hour === 12) hour = 0;
              return { hour, minute };
            }
            const wordMap = {
              una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
              seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12
            };
            const minuteMap = {
              cinco: 5,
              diez: 10,
              quince: 15,
              cuarto: 15,
              veinte: 20,
              veinticinco: 25,
              media: 30,
              treinta: 30,
              cuarenta: 40,
              cuarenta_y_cinco: 45
            };
            const wordMatch = lower.match(/\b(una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/);
            if (wordMatch) {
              let minutes = 0;
              if (/\bcuarenta\s+y\s+cinco\b/.test(lower)) {
                minutes = 45;
              } else {
                const minuteMatch = lower.match(/\by\s+(media|cuarto|quince|cinco|diez|veinte|veinti\s*cinco|treinta|cuarenta)\b/);
                if (minuteMatch) {
                  const key = minuteMatch[1].replace(/\s+/g, '') === 'veinticinco'
                    ? 'veinticinco'
                    : minuteMatch[1].replace(/\s+/g, '_');
                  minutes = minuteMap[key] || 0;
                }
              }
              let hour = wordMap[wordMatch[1]];
              const isPm = /\b(pm|p\.m\.|tarde|noche)\b/.test(lower);
              const isAm = /\b(am|a\.m\.|mañana|manana)\b/.test(lower);
              if (isPm && hour >= 1 && hour <= 11) hour += 12;
              else if (isAm && hour === 12) hour = 0;
              return { hour, minute: minutes };
            }
            return null;
          }
          if (slotTime) {
            const timeMatch = slotTime.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) {
              hour = parseInt(timeMatch[1], 10);
              minute = parseInt(timeMatch[2], 10);
            }
          }

          if (slotDate && /\d{4}-\d{2}-\d{2}/.test(slotDate)) {
            const parts = slotDate.split('-').map(n => parseInt(n, 10));
            target = new Date(parts[0], parts[1] - 1, parts[2]);
          } else if (!utter || utter === '') {
            target.setDate(target.getDate() + 1);
          } else if (/mañana|manana/.test(utter)) {
            target.setDate(target.getDate() + 1);
            if (!slotTime) {
              const timeParts = extractHourFromUtterance(utter);
              if (timeParts) { hour = timeParts.hour; minute = timeParts.minute; }
            }
          } else if (/hoy/.test(utter)) {
            if (!slotTime) {
              const timeParts = extractHourFromUtterance(utter);
              if (timeParts) { hour = timeParts.hour; minute = timeParts.minute; }
            }
          } else {
            const dateMatch = utter.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              const parts = dateMatch[1].split('-').map(n => parseInt(n,10));
              target = new Date(parts[0], parts[1]-1, parts[2]);
              if (!slotTime) {
                const timeParts = extractHourFromUtterance(utter);
                if (timeParts) { hour = timeParts.hour; minute = timeParts.minute; }
              }
            } else {
              // fallback: if we detect hour only
              const timeParts = extractHourFromUtterance(utter);
              if (!slotTime && timeParts) { target.setDate(target.getDate() + 1); hour = timeParts.hour; minute = timeParts.minute; }
              else { target.setDate(target.getDate() + 1); }
            }
          }

          target.setHours(hour, minute, 0, 0);

          // convert target to components in user's timezone
          let tz = 'UTC';
          try { tz = await alexaGetTimeZone(apiEndpoint, apiAccessToken, deviceId); } catch (e) { console.warn('timezone lookup failed', e && e.message); }
          const year = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric' }).format(target);
          const month = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: '2-digit' }).format(target);
          const day = new Intl.DateTimeFormat('en-US', { timeZone: tz, day: '2-digit' }).format(target);
          const hh = String(hour).padStart(2,'0');
          const mm = String(minute).padStart(2,'0');
          const scheduledTime = `${year}-${month}-${day}T${hh}:${mm}:00`;

          // Force locale to Spanish (United States) as requested
          const locale = 'es-US';
          const reminderPayload = {
            requestTime: new Date().toISOString(),
            trigger: { type: 'SCHEDULED_ABSOLUTE', scheduledTime, timeZoneId: tz },
            alertInfo: { spokenInfo: { content: [ { locale, text: 'Vuelve a Escoge tu Historia para continuar.' } ] } },
            pushNotification: { status: 'ENABLED' }
          };

          try {
            const apiResp = await alexaCreateReminder(apiEndpoint, apiAccessToken, reminderPayload);
            console.log('reminder created', apiResp && apiResp.status);
            // persist locally as well for demo
            try { scheduleReminderLocal(sessionAttrs.pseudonym, sessionAttrs.session_id, `${scheduledTime}`); } catch (e) { /* ignore */ }
            const reminderSpeech = `He programado el recordatorio para ${year}-${month}-${day} a las ${hh}:${mm}.`;

            // Always try to load and show the next chapter after reminder is set
            let nextChapterIdAuto = null;
            if (/^c\d+$/i.test(sessionAttrs.chapter_id)) {
              const curNum = parseInt(sessionAttrs.chapter_id.substring(1)) || 1;
              nextChapterIdAuto = `c${String(curNum + 1).padStart(2, '0')}`;
            }

            console.log(`[📖 Reminder→Chapter] Starting chapter load: current=${sessionAttrs.chapter_id}, next=${nextChapterIdAuto}`);

            let nextAutoChapter = nextChapterIdAuto ? findChapter(nextChapterIdAuto, sessionAttrs.story_id || null) : null;
            console.log(`[📖 Reminder→Chapter] After findChapter(): found=${!!nextAutoChapter}`);
            
            if (!nextAutoChapter && nextChapterIdAuto) {
              console.log(`[📖 Reminder→Chapter] Hydrating from DB: ${nextChapterIdAuto}`);
              nextAutoChapter = await hydrateChapterFromDb(nextChapterIdAuto);
              console.log(`[📖 Reminder→Chapter] After hydrateChapterFromDb(): found=${!!nextAutoChapter}`);
            }

            if (nextAutoChapter && !chapterNamespaceLooksValid(nextAutoChapter)) {
              console.warn('[📖 Reminder→Chapter] Invalid chapter namespace detected, forcing regeneration', {
                chapter_id: nextAutoChapter.chapter_id,
                first_scene_id: nextAutoChapter.scenes && nextAutoChapter.scenes[0] ? nextAutoChapter.scenes[0].scene_id : null
              });
              nextAutoChapter = null;
            }

            if (!nextAutoChapter && nextChapterIdAuto && sessionAttrs.session_id) {
              if (PREFER_SCENE_BY_SCENE_NEXT_CHAPTER) {
                console.log(`[📖 Reminder→Chapter] Prefer scene-by-scene bootstrap for ${nextChapterIdAuto}`);
                nextAutoChapter = await bootstrapNextChapterFromScene(sessionAttrs.session_id, nextChapterIdAuto);
                console.log(`[📖 Reminder→Chapter] After preferred scene bootstrap: found=${!!nextAutoChapter}`);
              }

              if (!nextAutoChapter) {
                try {
                  console.log(`[📖 Reminder→Chapter] Generating full weekly pack with LLM: session_id=${sessionAttrs.session_id}, current=${sessionAttrs.chapter_id}`);
                  await generateNextChapterForSession(sessionAttrs.session_id, sessionAttrs.chapter_id);
                  console.log(`[📖 Reminder→Chapter] Weekly generation completed, hydrating...`);
                  nextAutoChapter = await hydrateChapterFromDb(nextChapterIdAuto);
                  console.log(`[📖 Reminder→Chapter] After LLM generation & hydration: found=${!!nextAutoChapter}`);
                } catch (e) {
                  console.error(`[❌ Reminder→Chapter] Weekly generation failed: ${e && e.message}`);
                  if (PREFER_SCENE_BY_SCENE_NEXT_CHAPTER) {
                    console.log(`[📖 Reminder→Chapter] Fallback to scene-by-scene bootstrap for ${nextChapterIdAuto}`);
                    nextAutoChapter = await bootstrapNextChapterFromScene(sessionAttrs.session_id, nextChapterIdAuto);
                    console.log(`[📖 Reminder→Chapter] After fallback scene bootstrap: found=${!!nextAutoChapter}`);
                  } else {
                    console.log('[📖 Reminder→Chapter] Scene-by-scene fallback disabled; weekly pre-generation is enforced');
                  }
                }
              }
            }

            if (nextAutoChapter && nextAutoChapter.scenes && nextAutoChapter.scenes.length > 0) {
              const seedNextScene = nextAutoChapter.scenes[0];
              const advancedNext = await advanceToPlayableScene(
                sessionAttrs.session_id || null,
                nextAutoChapter.chapter_id,
                seedNextScene,
                nextAutoChapter,
                5
              );
              const nextAutoScene = advancedNext.nextScene || seedNextScene;
              const nextOpts = (advancedNext.nextOpts && advancedNext.nextOpts.length > 0)
                ? advancedNext.nextOpts
                : mapAlexaOptions(nextAutoScene.options || []);
              const traversedTextsAuto = compactNarrativeSegments(
                (advancedNext.traversedScenes || []).map(s => String((s && s.text) || '').trim()),
                2
              );

              let nextSpeech = `${reminderSpeech} Continuemos. `;
              if (nextAutoChapter.order && nextAutoChapter.title) {
                nextSpeech += `Capítulo ${nextAutoChapter.order}: ${nextAutoChapter.title}. `;
              } else if (nextAutoChapter.title) {
                nextSpeech += `Siguiente capítulo: ${nextAutoChapter.title}. `;
              } else if (nextAutoChapter.order) {
                nextSpeech += `Capítulo ${nextAutoChapter.order}. `;
              }
              if (traversedTextsAuto.length > 0) {
                nextSpeech += `${traversedTextsAuto.join(' ')} `;
              } else {
                nextSpeech += `${nextAutoScene.text} `;
              }
              if (nextOpts.length > 0) {
                const labels = ['uno', 'dos', 'tres'];
                nextSpeech += nextOpts.map((o, i) => `${labels[i]}. ${o.option_text}`).join('. ');
              }

              const saNew = Object.assign({}, sessionAttrs, {
                chapter_id: nextAutoChapter.chapter_id,
                current_scene_id: nextAutoScene.scene_id,
                current_options: nextOpts,
                stage: 'scene'
              });
              res.writeHead(200, {'Content-Type':'application/json'});
              const repromptNext = nextOpts.length > 0 ? 'Elige una opción. Di uno, dos o tres.' : noResponsePrompt;
              return res.end(JSON.stringify(alexaResponse(nextSpeech, saNew, false, true, repromptNext)));
            }

            // Fallback: if next chapter not available, end session and remind user to continue tomorrow
            res.writeHead(200, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse(reminderSpeech + ' Vuelve mañana para continuar.', sessionAttrs, true)));
          } catch (apiErr) {
            console.warn('reminders api error', apiErr);
            if (apiErr && apiErr.status && (apiErr.status === 401 || apiErr.status === 403)) {
              const speech = 'Para programar recordatorios necesito permiso. Revisa la app de Alexa.';
              const resp = { version: '1.0', response: { outputSpeech: { type: 'PlainText', text: speech }, shouldEndSession: true, card: { type: 'AskForPermissionsConsent', permissions: ['alexa::alerts:reminders:skill:readwrite'] } } };
              res.writeHead(200, {'Content-Type':'application/json'});
              return res.end(JSON.stringify(resp));
            }
            // fallback to local scheduling
            scheduleReminderLocal(sessionAttrs.pseudonym, sessionAttrs.session_id, scheduledTime);
            const speech = 'No pude crear el recordatorio en el dispositivo, pero lo guardé localmente.';
            res.writeHead(200, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse(speech, {}, true)));
          }
        } catch (e) {
          console.warn('reminder_time handler failed', e && e.message);
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse('No entendí cuándo quieres el recordatorio. Vuelve a intentarlo más tarde.', sessionAttrs, true)));
        }
      }
      if (sessionAttrs.stage === 'consent') {
        const consentSlots = (body.request.intent && body.request.intent.slots) || {};
        const slotValues = Object.keys(consentSlots).map(k => (consentSlots[k] && consentSlots[k].value) || '').filter(Boolean).map(s => String(s).toLowerCase());
        const intentNorm = String(intentName || '').toLowerCase();
        const isYes = intentName === 'AMAZON.YesIntent' || intentNorm.endsWith('yesintent') || slotValues.some(v => ['si', 'sí', 'si.', 'sí.','yes','y'].includes(v));
        const isNo = intentName === 'AMAZON.NoIntent' || intentNorm.endsWith('nointent') || slotValues.some(v => ['no','nop','no.'].includes(v));
        console.log('consent check', { intentName, slotValues, isYes, isNo });

        if (isYes) {
          // Create a session row now and present first scene
          const pseudonym = sessionAttrs.pseudonym || ((body.session && body.session.user && body.session.user.userId) ? String(body.session.user.userId).slice(0,64) : `anon_${Date.now()}`);
          // Enforce one chapter per day per pseudonym
          try {
            // Ensure user exists for this pseudonym (create if new)
            try {
              const { error: userErr } = await supabase
                .from('users')
                .upsert({ pseudonym, created_at: new Date().toISOString() }, { onConflict: 'pseudonym' })
                .select();
              if (userErr) console.warn('user upsert error (consent stage):', userErr);
            } catch (e) { console.warn('user upsert exception (consent stage)', e && e.message); }

            // Daily limit: 1 chapter per day per pseudonym. "felipe" is exempt (developer).
            const isDeveloper = pseudonym && pseudonym.toLowerCase() === 'felipe';
            if (!isDeveloper) {
              const today = new Date().toISOString().slice(0, 10);
              let recent = null;
              try {
                const { data: rdata, error: rerr } = await supabase
                  .from('sessions')
                  .select('session_id, started_at')
                  .eq('pseudonym', pseudonym)
                  .order('started_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();
                if (rerr) console.warn('recent session lookup error', rerr);
                recent = rdata;
              } catch (e) { console.warn('recent session exception', e && e.message); }
              if (recent && recent.started_at) {
                const recentDate = new Date(recent.started_at).toISOString().slice(0, 10);
                if (recentDate === today) {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  return res.end(JSON.stringify(alexaResponse(
                    'Hoy ya has jugado un capítulo. Vuelve mañana para continuar con tu historia.',
                    sessionAttrs,
                    true
                  )));
                }
              }
            }

            // Check if user has an active story to resume
            const progress = await getUserStoryProgress(pseudonym);
            if (progress && progress.current_story_id && STORIES[progress.current_story_id] && progress.current_chapter_id !== 'completed') {
              const meta = getStoryMeta(progress.current_story_id);
              const chNum = parseInt((progress.current_chapter_id || 'c01').substring(1)) || 1;
              const sa = Object.assign({}, sessionAttrs, {
                stage: 'story_continue_or_new',
                pseudonym,
                consent_given: true,
                locale: requestLocale,
                resume_story_id: progress.current_story_id,
                resume_chapter_id: progress.current_chapter_id || 'c01'
              });
              const speech = `Bienvenido de nuevo. Estás en el capítulo ${chNum} de la historia de ${meta ? meta.protagonist : 'tu historia'}. ¿Quieres continuar, o empezar una historia diferente? Di continuar o nueva.`;
              res.writeHead(200, {'Content-Type':'application/json'});
              return res.end(JSON.stringify(alexaResponse(speech, sa, false, true, 'Di continuar o nueva.')));
            } else {
              // New user or completed all stories: go to story selection
              const sa = Object.assign({}, sessionAttrs, { stage: 'story_select', pseudonym, consent_given: true, locale: requestLocale });
              res.writeHead(200, {'Content-Type':'application/json'});
              return res.end(JSON.stringify(alexaResponse(getStorySelectionSpeech(), sa, false, true, 'Di uno, dos, tres o cuatro.')));
            }
          } catch (err) {
            console.error('error creating session from consent', err);
            res.writeHead(500, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse('Hubo un error al crear la sesión.', sessionAttrs, true)));
          }
        }
        if (isNo) {
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse('Entiendo. Si cambias de opinión, vuelve cuando quieras.', {}, true)));
        }
        // Reprompt for consent
        const consentReprompt = 'Responde sí para dar consentimiento, o no para salir.';
        res.writeHead(200, {'Content-Type':'application/json'});
        return res.end(JSON.stringify(alexaResponse('Por favor responde sí o no.', sessionAttrs, false, true, consentReprompt)));
      }

      // Story selection: user picks one of the 4 available stories
      if (sessionAttrs.stage === 'story_select') {
        const ssInput = (body.request && body.request.inputTranscript) ? String(body.request.inputTranscript).toLowerCase().trim() : '';
        const ssSlots = (body.request.intent && body.request.intent.slots) || {};
        let ssNum = '';
        const ssOptSlot = ssSlots.option;
        if (ssOptSlot) {
          if (ssOptSlot.value) {
            ssNum = String(ssOptSlot.value).toLowerCase().trim();
          } else if (ssOptSlot.resolutions && ssOptSlot.resolutions.resolutionsPerAuthority &&
                     ssOptSlot.resolutions.resolutionsPerAuthority[0] &&
                     ssOptSlot.resolutions.resolutionsPerAuthority[0].values &&
                     ssOptSlot.resolutions.resolutionsPerAuthority[0].values[0]) {
            ssNum = String(ssOptSlot.resolutions.resolutionsPerAuthority[0].values[0].value.name).toLowerCase().trim();
          }
        }
        if (!ssNum && ssSlots.chapterNumber && ssSlots.chapterNumber.value) {
          ssNum = String(ssSlots.chapterNumber.value).trim();
        }
        const storyMap = { '1': 'mariana', 'uno': 'mariana', '2': 'tatiana', 'dos': 'tatiana', '3': 'ernesto', 'tres': 'ernesto', '4': 'alberto', 'cuatro': 'alberto' };
        let selectedStoryId = storyMap[ssNum] || storyMap[ssInput];
        if (!selectedStoryId) {
          for (const [key, val] of Object.entries(storyMap)) {
            if (ssInput.includes(key)) { selectedStoryId = val; break; }
          }
        }
        if (!selectedStoryId) {
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse('No entendí tu elección. ' + getStorySelectionSpeech(), sessionAttrs, false, true, 'Di uno, dos, tres o cuatro.')));
        }
        try {
          const ssPseudonym = sessionAttrs.pseudonym;
          const ssChapterId = 'c01';
          const ssSessionPayload = { source: 'alexa', pseudonym: ssPseudonym, consent_given: true, chapter_id: ssChapterId, metadata: { locale: requestLocale, story_id: selectedStoryId } };
          console.log('📖 story_select: starting story', selectedStoryId, 'payload:', ssSessionPayload);
          
          let ssPersist = null;
          try {
            console.log('📖 calling processTelemetryPayload...');
            ssPersist = await processTelemetryPayload(ssSessionPayload, req.headers);
            console.log('📖 processTelemetryPayload returned:', ssPersist);
          } catch (persistErr) {
            console.error('❌ processTelemetryPayload error:', persistErr);
            // Generate a session ID anyway in mock mode
            ssPersist = { ok: true, session_id: uuidv4(), decisions_inserted: 0 };
            console.log('⚠️  Using fallback session_id:', ssPersist.session_id);
          }
          
          const ssSessionId = (ssPersist && ssPersist.session_id) ? ssPersist.session_id : uuidv4();
          console.log('✅ session_id assigned:', ssSessionId);
          
          try {
            console.log('📖 calling saveUserStoryProgress...');
            await saveUserStoryProgress(ssPseudonym, selectedStoryId, ssChapterId);
            console.log('✅ saveUserStoryProgress completed');
          } catch (saveErr) {
            console.warn('⚠️  saveUserStoryProgress warning:', saveErr && saveErr.message ? saveErr.message : String(saveErr));
          }
          
          console.log('📖 calling findChapter for', ssChapterId, selectedStoryId);
          const ssChapter = findChapter(ssChapterId, selectedStoryId);
          console.log('📖 found chapter:', ssChapter ? `${ssChapter.chapter_id} with ${ssChapter.scenes ? ssChapter.scenes.length : 0} scenes` : 'NOT FOUND');
          
          if (!ssChapter) {
            console.error('❌ Chapter not found!');
            res.writeHead(500, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse('No se encontró el capítulo inicial.', sessionAttrs, true)));
          }
          
          const ssFirstScene = ssChapter && ssChapter.scenes && ssChapter.scenes[0] ? ssChapter.scenes[0] : null;
          if (!ssFirstScene) {
            console.error('❌ No first scene found in chapter');
            res.writeHead(500, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse('No se encontró la escena inicial.', sessionAttrs, true)));
          }
          
          console.log('📖 building options from scene...');
          const ssRawOpts = ssFirstScene.options || [];
          const ssOpts = ssRawOpts.slice(0, 3).map((o, idx) => ({ option_id: o.option_id, option_text: o.option_text, index: idx + 1, next_chapter_id: o.next_chapter_id || null, next_scene_id: o.next_scene_id || null }));
          console.log('📖 built', ssOpts.length, 'options');
          
          const ssTail = ssOpts.length === 1 ? 'Di uno para elegir.' : ssOpts.length === 2 ? 'Di uno o dos para elegir.' : 'Di uno, dos o tres para elegir.';
          
          console.log('📖 getting story meta...');
          const ssMeta = getStoryMeta(selectedStoryId);
          console.log('📖 story meta:', ssMeta);
          
          const ssIntro = ssMeta ? `Comenzamos la historia de ${ssMeta.protagonist}. ` : '';
          console.log('📖 building scene speech...');
          const ssSpeech = buildAlexaSceneSpeech(ssIntro + ssFirstScene.text, ssOpts, ssTail, MAX_ALEXA_TEXT_CHARS);
          console.log('📖 speech length:', ssSpeech.length);
          
          const saSS = Object.assign({}, sessionAttrs, { stage: 'scene', session_id: ssSessionId, pseudonym: ssPseudonym, consent_given: true, chapter_id: ssChapterId, story_id: selectedStoryId, locale: requestLocale, current_scene_id: ssFirstScene.scene_id, current_options: ssOpts });
          
          console.log('✅ story_select complete - sending response with', ssOpts.length, 'options');
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse(ssSpeech, saSS, false, true, noResponsePrompt)));
        } catch (err) {
          console.error('❌ error starting story from story_select', err);
          res.writeHead(500, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse('Hubo un error al iniciar la historia.', sessionAttrs, true)));
        }
      }

      // Returning user: continue current story or pick a new one
      if (sessionAttrs.stage === 'story_continue_or_new') {
        const scInput = (body.request && body.request.inputTranscript) ? String(body.request.inputTranscript).toLowerCase().trim() : '';
        const scIntentNorm = String((body.request.intent && body.request.intent.name) || '').toLowerCase();
        const isContinue = intentName === 'ResumeIntent' || scIntentNorm.endsWith('yesintent') || scInput === 'continuar' || scInput.includes('continuar') || scInput === 'sí' || scInput === 'si';
        const isNewStory = intentName === 'NuevaHistoriaIntent' || scIntentNorm.endsWith('nointent') || scInput === 'nueva' || scInput.includes('nueva') || scInput === 'no';

        if (isContinue) {
          try {
            const scPseudonym = sessionAttrs.pseudonym;
            const scStoryId = sessionAttrs.resume_story_id;
            const scChapterId = sessionAttrs.resume_chapter_id || 'c01';
            const scSessionPayload = { source: 'alexa', pseudonym: scPseudonym, consent_given: true, chapter_id: scChapterId, metadata: { locale: requestLocale, story_id: scStoryId } };
            const scPersist = await processTelemetryPayload(scSessionPayload, req.headers);
            const scSessionId = scPersist.session_id;
            await saveUserStoryProgress(scPseudonym, scStoryId, scChapterId);
            const scChapter = findChapter(scChapterId, scStoryId);
            const scFirstScene = scChapter && scChapter.scenes && scChapter.scenes[0] ? scChapter.scenes[0] : null;
            if (!scFirstScene) {
              res.writeHead(500, {'Content-Type':'application/json'});
              return res.end(JSON.stringify(alexaResponse('No se encontró la escena.', sessionAttrs, true)));
            }
            const scRawOpts = scFirstScene.options || [];
            const scOpts = scRawOpts.slice(0, 3).map((o, idx) => ({ option_id: o.option_id, option_text: o.option_text, index: idx + 1, next_chapter_id: o.next_chapter_id || null, next_scene_id: o.next_scene_id || null }));
            const scTail = scOpts.length === 1 ? 'Di uno para elegir.' : scOpts.length === 2 ? 'Di uno o dos para elegir.' : 'Di uno, dos o tres para elegir.';
            const scSpeech = buildAlexaSceneSpeech(scFirstScene.text, scOpts, scTail, MAX_ALEXA_TEXT_CHARS);
            const saSC = Object.assign({}, sessionAttrs, { stage: 'scene', session_id: scSessionId, pseudonym: scPseudonym, consent_given: true, chapter_id: scChapterId, story_id: scStoryId, locale: requestLocale, current_scene_id: scFirstScene.scene_id, current_options: scOpts });
            res.writeHead(200, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse(scSpeech, saSC, false, true, noResponsePrompt)));
          } catch (err) {
            console.error('error resuming story from story_continue_or_new', err);
            res.writeHead(500, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse('Hubo un error al retomar la historia.', sessionAttrs, true)));
          }
        }
        if (isNewStory) {
          const saNewStory = Object.assign({}, sessionAttrs, { stage: 'story_select' });
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse(getStorySelectionSpeech(), saNewStory, false, true, 'Di uno, dos, tres o cuatro.')));
        }
        res.writeHead(200, {'Content-Type':'application/json'});
        return res.end(JSON.stringify(alexaResponse('Por favor di continuar para seguir tu historia, o nueva para elegir una diferente.', sessionAttrs, false, true, 'Di continuar o nueva.')));
      }

      // Scene interaction: expect an intent that selects an option (we accept any intent name as option)
      if (sessionAttrs.stage === 'scene') {
        const slots = (body.request.intent && body.request.intent.slots) || {};
        const opts = sessionAttrs.current_options || [];

        // Guard: if StartChapterIntent fired (AMAZON.NUMBER slot captured a bare digit),
        // rewrite inputTranscript so the option-matching logic picks it up correctly.
        if (intentName === 'StartChapterIntent') {
          const chapNum = slots.chapterNumber && slots.chapterNumber.value ? String(slots.chapterNumber.value).trim() : null;
          if (chapNum && /^[123]$/.test(chapNum)) {
            const wordMap = { '1': 'uno', '2': 'dos', '3': 'tres' };
            try { console.log('scene: StartChapterIntent intercepted in scene stage, chapterNumber=', chapNum); } catch (e) {}
            body.request.inputTranscript = wordMap[chapNum];
          }
        }

        const inputTranscript = (body.request && body.request.inputTranscript) ? String(body.request.inputTranscript).toLowerCase().trim() : null;
        const intentNorm = String(intentName || '').toLowerCase();
        const isYes = intentName === 'AMAZON.YesIntent' || intentNorm.endsWith('yesintent');
        const isNo = intentName === 'AMAZON.NoIntent' || intentNorm.endsWith('nointent');

        function buildOptionsSpeech(options) {
          const labels = ['uno', 'dos', 'tres'];
          return (options || []).slice(0, 3).map((o, i) => `${labels[i]}. ${o.option_text}`).join('. ');
        }

        const sceneRepromptText = opts.length > 0
          ? 'Di uno, dos o tres.'
          : noResponsePrompt;
        
        try { console.log('scene debug - inputTranscript:', inputTranscript || '(none)'); } catch (e) {}
        try { console.log('scene debug - intent.slots:', JSON.stringify(slots || {})); } catch (e) {}
        try { console.log('scene debug - current_options count:', opts.length); } catch (e) {}

        // Auto-continue when session is positioned at a narrated scene (no options available).
        if (opts.length === 0 && sessionAttrs.current_scene_id && sessionAttrs.chapter_id) {
          try {
            let chapterRef = findChapter(sessionAttrs.chapter_id, sessionAttrs.story_id || null);
            if (!chapterRef && !sessionAttrs.story_id) chapterRef = await hydrateChapterFromDb(sessionAttrs.chapter_id);
            const currentScene = (chapterRef && chapterRef.scenes)
              ? chapterRef.scenes.find(s => s.scene_id === sessionAttrs.current_scene_id)
              : null;

            if (currentScene) {
              const seqSceneId = getSequentialSceneId(sessionAttrs.chapter_id, currentScene);
              if (seqSceneId) {
                const resolved = await resolveOrGenerateNextScene(
                  sessionAttrs.session_id || null,
                  sessionAttrs.chapter_id,
                  seqSceneId,
                  { allowGeneration: false, story_id: sessionAttrs.story_id || null }
                );
                if (resolved && resolved.nextScene) {
                  const advanced = await advanceToPlayableScene(
                    sessionAttrs.session_id || null,
                    sessionAttrs.chapter_id,
                    resolved.nextScene,
                    resolved.nextChapter,
                    5,
                    sessionAttrs.story_id || null
                  );
                  const autoNextScene = advanced.nextScene;
                  const autoNextChapter = advanced.nextChapter;
                  const autoOpts = advanced.nextOpts || [];
                  const traversedTexts = compactNarrativeSegments((advanced.traversedScenes || [])
                    .map(s => String(s && s.text || '').trim())
                    .filter(Boolean), 2);

                  if (autoNextScene) {
                    let autoSpeech = 'Continuemos. ';
                    if (traversedTexts.length > 0) autoSpeech += `${traversedTexts.join(' ')} `;
                    if (autoOpts.length > 0) {
                      const labels = ['uno', 'dos', 'tres'];
                      autoSpeech += autoOpts.map((o, i) => `${labels[i]}. ${o.option_text}`).join('. ');
                    }

                    const nextChapterIdForSession = autoNextChapter ? autoNextChapter.chapter_id : sessionAttrs.chapter_id;
                    const saAuto = Object.assign({}, sessionAttrs, {
                      stage: 'scene',
                      chapter_id: nextChapterIdForSession,
                      current_scene_id: autoNextScene.scene_id,
                      current_options: autoOpts
                    });
                    res.writeHead(200, {'Content-Type':'application/json'});
                    const repromptAuto = autoOpts.length > 0 ? 'Di uno, dos o tres.' : noResponsePrompt;
                    return res.end(JSON.stringify(alexaResponse(autoSpeech, saAuto, false, true, repromptAuto)));
                  }
                }
              }
            }
          } catch (e) {
            console.warn('auto-continue from narrated scene failed', e && e.message ? e.message : e);
          }
        }

        // If user says "sí" (YesIntent) during option selection, repeat the choices instead of delegating.
        if (isNo) {
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse('De acuerdo. Vuelve pronto.', sessionAttrs, true)));
        }
        if (isYes && opts.length > 1) {
          const speech = `Perfecto. ${sceneRepromptText} ${buildOptionsSpeech(opts)}`;
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse(speech, sessionAttrs, false, true, sceneRepromptText)));
        }
        
        // If only one option exists, auto-select it (useful for "Continuar" scenes)
        if (opts.length === 1) {
          try { console.log('scene: only 1 option available, auto-selecting'); } catch (e) {}
          // Jump directly to processing that single option
          const chosenOpt = opts[0];
          const session_id = sessionAttrs.session_id || uuidv4();
          const current_scene_id = sessionAttrs.current_scene_id || 'unknown';
          const decisionPayload = {
            session_id,
            source: 'alexa',
            pseudonym: sessionAttrs.pseudonym || null,
            chapter_id: sessionAttrs.chapter_id || null,
            decisions: [ { 
              timestamp: new Date().toISOString(), 
              scene_id: current_scene_id, 
              option_id: chosenOpt.option_id, 
              option_text: chosenOpt.option_text 
            } ]
          };
          try {
            console.log('scene: processing auto-selected option:', chosenOpt.option_id);
            const persist = await processTelemetryPayload(decisionPayload, req.headers);
            console.log('scene: telemetry persisted for auto-selected option');
            
            // Look up consequence text from content for fluid narration between scenes
            let consequence = null;
            try {
              const curChapterId = sessionAttrs.chapter_id || null;
              const curSceneId = current_scene_id;
              const ch = curChapterId ? findChapter(curChapterId, sessionAttrs.story_id || null) : null;
              const sc = (ch && ch.scenes) ? ch.scenes.find(s => s.scene_id === curSceneId) : null;
              if (sc && sc.options) {
                const optDef = sc.options.find(o => o.option_id === chosenOpt.option_id);
                if (optDef) consequence = optDef.consequence || null;
              }
            } catch (e) { console.warn('consequence lookup error', e && e.message); }

            // Determine navigation: next_scene_id (intra-chapter) or next_chapter_id (inter-chapter)
            const nextSceneId = chosenOpt.next_scene_id || null;
            const nextChapterId = chosenOpt.next_chapter_id || null;

            let nextScene = null;
            let nextChapter = null;
            if (nextSceneId) {
              const ch = findChapter(sessionAttrs.chapter_id, sessionAttrs.story_id || null);
              nextScene = (ch && ch.scenes) ? ch.scenes.find(s => s.scene_id === nextSceneId) : null;
            }
            if (!nextScene && nextChapterId) {
              nextChapter = findChapter(nextChapterId, sessionAttrs.story_id || null);
              nextScene = (nextChapter && nextChapter.scenes && nextChapter.scenes[0]) ? nextChapter.scenes[0] : null;
            }

            if (nextScene) {
              if (nextSceneId) {
                // Intra-chapter navigation: resolve next scene or generate on-demand.
                const resolved = await resolveOrGenerateNextScene(sessionAttrs.session_id || null, sessionAttrs.chapter_id, nextSceneId, { story_id: sessionAttrs.story_id || null });
                nextChapter = resolved.nextChapter;
                nextScene = resolved.nextScene;
                if (!nextScene) {
                  const fallbackSceneId = normalizeSceneIdFallback(nextSceneId);
                  if (fallbackSceneId) {
                    const fallbackResolved = await resolveOrGenerateNextScene(sessionAttrs.session_id || null, sessionAttrs.chapter_id, fallbackSceneId, { story_id: sessionAttrs.story_id || null });
                    if (fallbackResolved && fallbackResolved.nextScene) {
                      console.warn('scene fallback used for missing branch id', { requested: nextSceneId, fallback: fallbackSceneId });
                      nextChapter = fallbackResolved.nextChapter;
                      nextScene = fallbackResolved.nextScene;
                    }
                  }
                }
              }

              const advanced = await advanceToPlayableScene(
                sessionAttrs.session_id || null,
                (nextChapter && nextChapter.chapter_id) || sessionAttrs.chapter_id,
                nextScene,
                nextChapter,
                5,
                sessionAttrs.story_id || null
              );
              nextChapter = advanced.nextChapter;
              nextScene = advanced.nextScene;
              const nextOpts = advanced.nextOpts || [];
              const traversedTexts = (advanced.traversedScenes || [])
                .map(s => String(s && s.text || '').trim())
                .filter(Boolean);

              const nextSpeechBase = [
                consequence || '',
                nextChapterId && nextChapter ? `Capítulo ${nextChapter.order || ''}: ${nextChapter.title}.` : '',
                traversedTexts.length > 0 ? traversedTexts.join(' ') : ''
              ].filter(Boolean).join(' ');
              const nextSpeech = buildAlexaSceneSpeech(nextSpeechBase, nextOpts, '', MAX_ALEXA_TEXT_CHARS);

              const chapterId = nextChapter ? nextChapter.chapter_id : sessionAttrs.chapter_id;
              const sa3 = Object.assign({}, sessionAttrs, { chapter_id: chapterId, stage: 'scene', current_scene_id: nextScene.scene_id, current_options: nextOpts, last_decision: chosenOpt.option_id });
              res.writeHead(200, {'Content-Type':'application/json'});
              const reprompt = nextOpts.length > 0 ? 'Di uno, dos o tres.' : noResponsePrompt;
              return res.end(JSON.stringify(alexaResponse(nextSpeech, sa3, false, true, reprompt)));
            } else {
              const finalSpeech = consequence || 'Continuamos...';
              res.writeHead(200, {'Content-Type':'application/json'});
              return res.end(JSON.stringify(alexaResponse(finalSpeech, sessionAttrs, true)));
            }
          } catch (err) {
            console.error('error in auto-select single option', err);
            res.writeHead(200, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse('Hubo un error al procesar. Intenta de nuevo.', sessionAttrs, false, true, sceneRepromptText)));
          }
        }
        
        // Extract chosen value - prioritize inputTranscript since it's most reliable
        let chosenVal = null;
        
        // SKIP_SCENES test mode: auto-select first option
        if (SKIP_SCENES) {
          chosenVal = 'uno';
          console.log('🧪 [SKIP_SCENES] Auto-selecting option 1 (uno)');
        }
        
        // FIRST priority: inputTranscript (what the user actually said)
        if (!chosenVal && inputTranscript) {
          chosenVal = inputTranscript;
          try { console.log('scene: got chosenVal from inputTranscript:', chosenVal); } catch (e) {}
        }
        
        // Fallback: try to extract from slots (in case Alexa parsed it)
        if (!chosenVal) {
          if (slots.option && slots.option.value) {
            chosenVal = String(slots.option.value).toLowerCase();
            try { console.log('scene: got chosenVal from option slot:', chosenVal); } catch (e) {}
          } else if (slots.option && slots.option.resolutions && slots.option.resolutions.resolutionsPerAuthority && slots.option.resolutions.resolutionsPerAuthority[0] && slots.option.resolutions.resolutionsPerAuthority[0].values && slots.option.resolutions.resolutionsPerAuthority[0].values[0]) {
            // Extract from custom slot type resolution
            chosenVal = String(slots.option.resolutions.resolutionsPerAuthority[0].values[0].value.name).toLowerCase();
            try { console.log('scene: got chosenVal from option slot resolutions:', chosenVal); } catch (e) {}
          } else if (slots.optionText && slots.optionText.value) {
            chosenVal = String(slots.optionText.value).toLowerCase();
            try { console.log('scene: got chosenVal from optionText slot:', chosenVal); } catch (e) {}
          } else {
            // Scan all other slots
            for (const k of Object.keys(slots || {})) {
              const s = slots[k];
              if (s && s.value) {
                chosenVal = String(s.value).toLowerCase();
                try { console.log('scene: got chosenVal from slot', k, ':', chosenVal); } catch (e) {}
                break;
              }
            }
          }
        }
        
        // If still no value, do NOT Delegate (it can loop). Reprompt with explicit 1/2/3 guidance.
        if (!chosenVal) {
          try { console.log('scene: no chosenVal from any source; reprompting without Delegate'); } catch (e) {}
          const speech = opts.length > 0
            ? `No entendí tu elección. ${sceneRepromptText} ${buildOptionsSpeech(opts)}`
            : `No entendí. ${noResponsePrompt}`;
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse(speech, sessionAttrs, false, true, sceneRepromptText)));
        }
        
        // Normalizer for comparing option text (keep letters and numbers)
        function normalizeText(t) {
          return String(t || '').toLowerCase().replace(/[^\p{L}0-9]+/gu, ' ').replace(/\s+/g, ' ').trim();
        }
        
        // Match chosen value to one of the available options
        let chosenOpt = null;
        const wordNums = { 'uno': 1, 'dos': 2, 'tres': 3 };
        const raw = String(chosenVal || '').trim().toLowerCase();
        let asNum = NaN;
        
        try { console.log('scene: attempt to match raw input:', { raw, chosenVal }); } catch (e) {}
        
        // First, try exact match on wordNums (for "uno", "dos", "tres")
        if (wordNums[raw]) asNum = wordNums[raw];
        
        // If not exact, search for Spanish number words IN the string (more lenient)
        if (isNaN(asNum)) {
          if (raw.includes('uno') || raw.includes('1')) asNum = 1;
          else if (raw.includes('dos') || raw.includes('2')) asNum = 2;
          else if (raw.includes('tres') || raw.includes('3')) asNum = 3;
        }
        
        // If still no match, try to parse numeric characters only
        if (isNaN(asNum)) {
          const parsed = parseInt(raw.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(parsed) && parsed >= 1 && parsed <= 3) asNum = parsed;
        }
        
        try { console.log('scene: after matching, asNum =', asNum); } catch (e) {}
        
        // Try to find option by index
        if (!isNaN(asNum)) chosenOpt = opts.find(o => o.index === asNum);
        
        // If not found, try to match by option text
        if (!chosenOpt) {
          const nVal = normalizeText(chosenVal);
          chosenOpt = opts.find(o => normalizeText(o.option_text) === nVal);
        }
        
        // If still not found, try match by intentName to option id or text
        if (!chosenOpt) {
          const normIntent = (intentName || '').toLowerCase();
          chosenOpt = opts.find(o => (o.option_id && o.option_id.toLowerCase() === normIntent) || (o.option_text && o.option_text.toLowerCase() === normIntent));
        }
        
        try { console.log('scene: final chosenOpt =', chosenOpt ? chosenOpt.option_id : 'NOT FOUND'); } catch (e) {}
        
        // If still not matched, do NOT Delegate (it can loop). Reprompt with explicit 1/2/3 guidance.
        if (!chosenOpt) {
          try { console.log('scene: chosenOpt not found; reprompting without Delegate'); } catch (e) {}
          const speech = `No entendí tu elección. ${sceneRepromptText} ${buildOptionsSpeech(opts)}`;
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse(speech, sessionAttrs, false, true, sceneRepromptText)));
        }

        // Prevent processing the same decision twice if user repeats the same option
        try {
          if (sessionAttrs.last_decision && chosenOpt && sessionAttrs.last_decision === chosenOpt.option_id) {
            res.writeHead(200, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse('Ya registré esa opción. ¿Quieres hacer otra cosa o continuar?', sessionAttrs, false, true, noResponsePrompt)));
          }
        } catch (e) { console.warn('duplicate decision check error', e && e.message); }

        // Persist decision with option_id and option_text
        const session_id = sessionAttrs.session_id || uuidv4();
        const current_scene_id = sessionAttrs.current_scene_id || 'unknown';
        const decisionPayload = {
          session_id,
          source: 'alexa',
          pseudonym: sessionAttrs.pseudonym || null,
          chapter_id: sessionAttrs.chapter_id || null,
          decisions: [ { 
            timestamp: new Date().toISOString(), 
            scene_id: current_scene_id, 
            option_id: chosenOpt.option_id, 
            option_text: chosenOpt.option_text 
          } ]
        };
        try {
          console.log('scene: processing selected option:', chosenOpt.option_id, 'from scene:', current_scene_id);
          const persist = await processTelemetryPayload(decisionPayload, req.headers);
          console.log('scene: decision persisted successfully');
          
          // Look up consequence text from content for fluid narration between scenes
          let consequence = null;
          try {
            const curChapterId = sessionAttrs.chapter_id || null;
            const curSceneId = current_scene_id;
            const ch = curChapterId ? findChapter(curChapterId, sessionAttrs.story_id || null) : null;
            const sc = (ch && ch.scenes) ? ch.scenes.find(s => s.scene_id === curSceneId) : null;
            if (sc && sc.options) {
              const optDef = sc.options.find(o => o.option_id === chosenOpt.option_id);
              if (optDef) consequence = optDef.consequence || null;
            }
          } catch (e) { console.warn('consequence lookup error', e && e.message); }

          // Determine navigation: next_scene_id (intra-chapter) or next_chapter_id (inter-chapter)
          const nextSceneId = chosenOpt.next_scene_id || null;
          const nextChapterId = chosenOpt.next_chapter_id || null;

          let nextScene = null;
          let nextChapter = null;

          if (nextSceneId) {
            // Intra-chapter navigation: resolve next scene or generate on-demand.
            const resolved = await resolveOrGenerateNextScene(sessionAttrs.session_id || null, sessionAttrs.chapter_id, nextSceneId, { story_id: sessionAttrs.story_id || null });
            nextChapter = resolved.nextChapter;
            nextScene = resolved.nextScene;
            if (!nextScene) {
              const fallbackSceneId = normalizeSceneIdFallback(nextSceneId);
              if (fallbackSceneId) {
                const fallbackResolved = await resolveOrGenerateNextScene(sessionAttrs.session_id || null, sessionAttrs.chapter_id, fallbackSceneId, { story_id: sessionAttrs.story_id || null });
                if (fallbackResolved && fallbackResolved.nextScene) {
                  console.warn('scene fallback used for missing branch id', { requested: nextSceneId, fallback: fallbackSceneId });
                  nextChapter = fallbackResolved.nextChapter;
                  nextScene = fallbackResolved.nextScene;
                }
              }
            }
          } else if (nextChapterId) {
            // Inter-chapter navigation: move to first scene of next chapter
            nextChapter = findChapter(nextChapterId, sessionAttrs.story_id || null);
            if (nextChapter && nextChapter.scenes && nextChapter.scenes.length > 0) {
              nextScene = nextChapter.scenes[0];
            }
          }
          
          // If no next scene found: end of story / end of chapter
          if (!nextScene) {
            console.log('🛑 END OF CHAPTER DETECTED:', { currentChapter: sessionAttrs.chapter_id, currentScene: sessionAttrs.current_scene_id });
            let speech = consequence ? String(consequence) : `Has seleccionado ${chosenOpt.option_text}.`;
            speech += ' Fin del capítulo.';

            const curChapterId = sessionAttrs.chapter_id || null;
            let nextChapterIdAuto = null;
            if (curChapterId && /^c\d+$/i.test(curChapterId)) {
              const curNum = parseInt(curChapterId.substring(1)) || 1;
              nextChapterIdAuto = `c${String(curNum + 1).padStart(2, '0')}`;
            }
            console.log('⏭️  AUTO_CONTINUE_NEXT_CHAPTER:', AUTO_CONTINUE_NEXT_CHAPTER, 'nextChapterIdAuto:', nextChapterIdAuto);

            let nextAutoChapter = null;
            if (AUTO_CONTINUE_NEXT_CHAPTER) {
              nextAutoChapter = nextChapterIdAuto ? findChapter(nextChapterIdAuto, sessionAttrs.story_id || null) : null;
              console.log('🔍 First lookup (findChapter):', nextAutoChapter ? 'FOUND in memory' : 'not found');
              if (!nextAutoChapter && nextChapterIdAuto && !sessionAttrs.story_id) {
                nextAutoChapter = await hydrateChapterFromDb(nextChapterIdAuto);
                console.log('🔍 Second lookup (hydrateChapterFromDb):', nextAutoChapter ? 'FOUND in DB' : 'not found');
              }
              if (nextAutoChapter && !chapterNamespaceLooksValid(nextAutoChapter)) {
                console.warn('⚠️ Invalid chapter namespace detected, forcing regeneration:', {
                  chapter_id: nextAutoChapter.chapter_id,
                  first_scene_id: nextAutoChapter.scenes && nextAutoChapter.scenes[0] ? nextAutoChapter.scenes[0].scene_id : null
                });
                nextAutoChapter = null;
              }
            }

            if (AUTO_CONTINUE_NEXT_CHAPTER && !nextAutoChapter && nextChapterIdAuto && sessionAttrs.session_id) {
              console.log('⚙️  Chapter not found, attempting to GENERATE:', nextChapterIdAuto);
              if (PREFER_SCENE_BY_SCENE_NEXT_CHAPTER) {
                console.log('⚙️  Preferring scene-by-scene bootstrap:', nextChapterIdAuto);
                nextAutoChapter = await bootstrapNextChapterFromScene(sessionAttrs.session_id, nextChapterIdAuto);
                console.log('🔍 After preferred scene bootstrap lookup:', nextAutoChapter ? 'FOUND in DB' : 'still not found');
              }

              if (!nextAutoChapter) {
                try {
                  const genResult = await generateNextChapterForSession(sessionAttrs.session_id, curChapterId, {
                    chapter_count: AUTO_CONTINUE_CHAPTER_COUNT
                  });
                  console.log('✅ Generate succeeded, result keys:', genResult ? Object.keys(genResult) : 'null');
                  nextAutoChapter = await hydrateChapterFromDb(nextChapterIdAuto);
                  console.log('🔍 After generation lookup:', nextAutoChapter ? 'FOUND in DB' : 'still not found');
                } catch (e) {
                  console.warn('❌ auto-generate weekly chapters failed', e && e.message);
                  if (PREFER_SCENE_BY_SCENE_NEXT_CHAPTER) {
                    console.log('⚙️  Falling back to scene-by-scene bootstrap:', nextChapterIdAuto);
                    nextAutoChapter = await bootstrapNextChapterFromScene(sessionAttrs.session_id, nextChapterIdAuto);
                    console.log('🔍 After scene bootstrap lookup:', nextAutoChapter ? 'FOUND in DB' : 'still not found');
                  } else {
                    console.log('⚙️  Scene-by-scene fallback disabled; weekly pre-generation remains enforced');
                  }
                }
              }
            }

            // End-of-latam-story: c14 completed, no next chapter exists
            if (sessionAttrs.story_id && STORIES[sessionAttrs.story_id] && !nextAutoChapter) {
              const curChapterNum = parseInt((curChapterId || 'c01').substring(1)) || 0;
              const storyChapters = STORIES[sessionAttrs.story_id].chapters || [];
              const maxChapterNum = storyChapters.reduce((max, c) => {
                const n = parseInt((c.chapter_id || 'c01').substring(1)) || 0;
                return n > max ? n : max;
              }, 0);
              if (curChapterNum >= maxChapterNum) {
                const endMeta = getStoryMeta(sessionAttrs.story_id);
                await saveUserStoryProgress(sessionAttrs.pseudonym || null, sessionAttrs.story_id, 'completed', sessionAttrs.story_id);
                const completionSpeech = `${speech} ¡Felicidades! Has completado la historia de ${endMeta ? endMeta.protagonist : 'esta historia'}. ¿Quieres comenzar una nueva historia? Di uno, dos, tres o cuatro para elegir.`;
                const saEnd = Object.assign({}, sessionAttrs, { stage: 'story_select', last_decision: chosenOpt.option_id });
                res.writeHead(200, {'Content-Type':'application/json'});
                return res.end(JSON.stringify(alexaResponse(completionSpeech, saEnd, false, true, getStorySelectionSpeech())));
              }
            }

            if (AUTO_CONTINUE_NEXT_CHAPTER && nextAutoChapter && nextAutoChapter.scenes && nextAutoChapter.scenes.length > 0) {
              console.log('✅ AUTO-CONTINUING TO NEXT CHAPTER:', { fromChapter: curChapterId, toChapter: nextAutoChapter.chapter_id, toScene: nextAutoChapter.scenes[0].scene_id });
              const seedNextScene = nextAutoChapter.scenes[0];
              const advancedNext = await advanceToPlayableScene(
                sessionAttrs.session_id || null,
                nextAutoChapter.chapter_id,
                seedNextScene,
                nextAutoChapter,
                5,
                sessionAttrs.story_id || null
              );
              const nextAutoScene = advancedNext.nextScene || seedNextScene;
              const nextOpts = (advancedNext.nextOpts && advancedNext.nextOpts.length > 0)
                ? advancedNext.nextOpts
                : mapAlexaOptions(nextAutoScene.options || []);
              const traversedTextsAuto = compactNarrativeSegments(
                (advancedNext.traversedScenes || []).map(s => String((s && s.text) || '').trim()),
                2
              );

              await saveUserStoryProgress(sessionAttrs.pseudonym || null, sessionAttrs.story_id || null, nextAutoChapter.chapter_id);

              let nextSpeech = `${speech} `;
              if (nextAutoChapter.order && nextAutoChapter.title) {
                nextSpeech += `Capítulo ${nextAutoChapter.order}: ${nextAutoChapter.title}. `;
              } else if (nextAutoChapter.title) {
                nextSpeech += `Siguiente capítulo: ${nextAutoChapter.title}. `;
              } else if (nextAutoChapter.order) {
                nextSpeech += `Capítulo ${nextAutoChapter.order}. `;
              }
              if (traversedTextsAuto.length > 0) {
                nextSpeech += `${traversedTextsAuto.join(' ')} `;
              } else {
                nextSpeech += `${nextAutoScene.text} `;
              }
              if (nextOpts.length > 0) {
                const labels = ['uno', 'dos', 'tres'];
                nextSpeech += nextOpts.map((o, i) => `${labels[i]}. ${o.option_text}`).join('. ');
              }

              const saNew = Object.assign({}, sessionAttrs, {
                stage: 'scene',
                chapter_id: nextAutoChapter.chapter_id,
                current_scene_id: nextAutoScene.scene_id,
                current_options: nextOpts,
                last_decision: chosenOpt.option_id
              });
              res.writeHead(200, {'Content-Type':'application/json'});
              const repromptNext = nextOpts.length > 0 ? 'Di uno, dos o tres.' : noResponsePrompt;
              return res.end(JSON.stringify(alexaResponse(nextSpeech, saNew, false, true, repromptNext)));
            }

            console.log('⏰ FALLING BACK TO REMINDER (auto-continue not possible):', { AUTO_CONTINUE_NEXT_CHAPTER, hasNextAutoChapter: !!nextAutoChapter });
            const sa = Object.assign({}, sessionAttrs, { last_decision: chosenOpt.option_id, stage: 'schedule_reminder' });
            const prompt = `${speech} ¿Quieres que te recuerde mañana para continuar? Di sí o no.`;
            res.writeHead(200, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse(prompt, sa, false, true, noResponsePrompt)));
          }
          
          // Build speech: consequence narration + chapter transition + next scene text + options
          const advanced = await advanceToPlayableScene(
            sessionAttrs.session_id || null,
            (nextChapter && nextChapter.chapter_id) || sessionAttrs.chapter_id,
            nextScene,
            nextChapter,
            5,
            sessionAttrs.story_id || null
          );
          nextChapter = advanced.nextChapter;
          nextScene = advanced.nextScene;
          const nextOpts = advanced.nextOpts || [];
          const traversedTexts = compactNarrativeSegments((advanced.traversedScenes || [])
            .map(s => String(s && s.text || '').trim())
            .filter(Boolean), 2);
          
          let nextSpeech = '';
          // Include consequence for fluid narration between scenes
          if (consequence) nextSpeech += `${consequence} `;
          // Add chapter transition narration if moving to a new chapter
          if (nextChapterId && nextChapter) nextSpeech += `Capítulo ${nextChapter.order || ''}: ${nextChapter.title}. `;
          if (traversedTexts.length > 0) nextSpeech += `${traversedTexts.join(' ')} `;
          
          if (nextOpts.length > 0) {
            const labels = ['uno', 'dos', 'tres'];
            nextSpeech += nextOpts.map((o, i) => `${labels[i]}. ${o.option_text}`).join('. ');
          }
          
          const chapterId = nextChapter ? nextChapter.chapter_id : sessionAttrs.chapter_id;
          const saNew = Object.assign({}, sessionAttrs, { stage: 'scene', current_scene_id: nextScene.scene_id, current_options: nextOpts, chapter_id: chapterId, last_decision: chosenOpt.option_id });
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse(nextSpeech, saNew, false, true, noResponsePrompt)));
        } catch (err) {
          console.error('error persisting decision', err);
          res.writeHead(500, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse('No se pudo registrar tu acción.', sessionAttrs, false, true, noResponsePrompt)));
        }
      }

      // Fallback: echo intent name
      const speech = `Recibido intent ${intentName}.`;
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify(alexaResponse(speech, sessionAttrs, false, true, noResponsePrompt)));
    }

    // Unknown request type
    res.writeHead(400, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ error: 'unsupported Alexa request type' }));
  } catch (err) {
    console.error('alexa error', err);
    res.writeHead(500, {'Content-Type':'application/json'});
     const errorResp = {
       version: '1.0',
       response: {
         outputSpeech: {
           type: 'PlainText',
           text: 'Lo sentimos, hubo un error. Por favor intenta de nuevo más tarde.'
         },
         shouldEndSession: true
       },
       sessionAttributes: {}
     };
     return res.end(JSON.stringify(errorResp));
  }
}

// Reusable processing function so other handlers (e.g. Alexa) can persist telemetry
async function processTelemetryPayload(payload, headers) {
        if (!ensureSessionPayload(payload)) throw new Error('invalid payload');
        // clone to avoid mutating original
        const p = JSON.parse(JSON.stringify(payload || {}));
        console.log('processing telemetry payload:', p);
  const _client_session_id = p.session_id;
        delete p.session_id;
        if (Array.isArray(p.decisions)) {
          for (const d of p.decisions) { delete d.decision_id; }
        }
        const userToken = (headers && headers['x-user-token']) || p.user_token || null;
        let pseudonym = p.pseudonym || null;

        if (userToken) {
          const { data: tokenRow, error: tokenErr } = await supabase
            .from('auth_tokens')
            .select('token, pseudonym, expires_at')
            .eq('token', userToken)
            .maybeSingle();
          if (tokenErr) console.warn('token lookup error', tokenErr);
          if (!tokenRow) throw new Error('invalid or expired user token');
          if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) throw new Error('user token expired');
          pseudonym = tokenRow.pseudonym;
        }

        const session_id = (_client_session_id && uuidValidate(_client_session_id)) ? _client_session_id : uuidv4();
        pseudonym = pseudonym || `anon_${session_id.slice(0,8)}`;

        const { data: existingSession, error: existingSessionErr } = await supabase
          .from('sessions')
          .select('session_id, user_id, consent_given, privacy_mode, metadata, chapter_id, source, started_at, ended_at, abandonment_flag, is_closed')
          .eq('session_id', session_id)
          .maybeSingle();
        if (existingSessionErr) {
          console.warn('existing session lookup warning', existingSessionErr.message || existingSessionErr);
        }

        const { data: userRow, error: userLookupErr } = await supabase
          .from('users')
          .select('user_id')
          .eq('pseudonym', pseudonym)
          .maybeSingle();
        if (userLookupErr) {
          console.warn('user lookup warning', userLookupErr.message || userLookupErr);
        }

        const startedAt = p.started_at || existingSession?.started_at || new Date().toISOString();
        const endedAt = p.ended_at || null;
        const derivedSessionLength = endedAt
          ? Math.max(0, Math.floor((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000))
          : null;

        const consentGiven = typeof p.consent_given === 'boolean'
          ? p.consent_given
          : (typeof existingSession?.consent_given === 'boolean' ? existingSession.consent_given : false);

        const sessionRow = {
          session_id,
          user_id: userRow?.user_id || existingSession?.user_id || null,
          pseudonym,
          started_at: startedAt,
          ended_at: endedAt || existingSession?.ended_at || null,
          session_length_seconds: Number.isFinite(Number(p.session_length_seconds))
            ? Number(p.session_length_seconds)
            : derivedSessionLength,
          consent_given: consentGiven,
          privacy_mode: p.privacy_mode || existingSession?.privacy_mode || 'anonymous',
          abandonment_flag: (existingSession?.is_closed && !existingSession?.abandonment_flag)
            ? false
            : ((typeof p.abandonment_flag === 'boolean') ? p.abandonment_flag : !!existingSession?.abandonment_flag),
          chapter_id: p.chapter_id || existingSession?.chapter_id || null,
          metadata: (p.metadata && typeof p.metadata === 'object')
            ? p.metadata
            : ((existingSession?.metadata && typeof existingSession.metadata === 'object') ? existingSession.metadata : {}),
          source: p.source || existingSession?.source || 'alexa',
          is_closed: endedAt ? true : !!existingSession?.is_closed
        };

        console.log('sessionRow to upsert:', sessionRow);
        const { data: upsertSession, error: upsertErr } = await supabase
          .from('sessions')
          .upsert(sessionRow, { onConflict: 'session_id' })
          .select()
          .single();
        if (upsertErr) {
          console.error('upsert sessions error detail:', upsertErr);
          throw upsertErr;
        }

        const decisions = p.decisions || [];
        const optionIds = Array.from(new Set(decisions.map(d => d.option_id).filter(Boolean)));
        const optionMap = {};
        if (optionIds.length) {
          const { data: optionRows, error: optionErr } = await supabase
            .from('options')
            .select('option_id, option_text, consequence, gds_mapping, metadata')
            .in('option_id', optionIds);
          if (optionErr) {
            console.warn('options lookup warning', optionErr.message || optionErr);
          } else {
            for (const row of (optionRows || [])) {
              optionMap[row.option_id] = row;
            }
          }
        }

        const decisionRows = [];
        const decisionContexts = [];
        for (const d of decisions) {
          const decisionId = (d.decision_id && uuidValidate(d.decision_id)) ? d.decision_id : uuidv4();
          const optionRef = d.option_id ? optionMap[d.option_id] : null;
          const parsedClinical = (d.parsed_mapping && d.parsed_mapping.clinical_mapping) || (d.raw_mapping && d.raw_mapping.clinical_mapping) || [];
          const designerMappings = d.designer_mapping || (d.raw_mapping && d.raw_mapping.designer_mapping) || [];

          let resolvedMappings = Array.isArray(parsedClinical) ? [...parsedClinical] : [];
          let inferredFromOption = false;
          if (!resolvedMappings.length && optionRef) {
            const inferred = [];
            const gdsMappings = Array.isArray(optionRef.gds_mapping) ? optionRef.gds_mapping : [];
            const phqMappings = Array.isArray(optionRef.metadata && optionRef.metadata.phq_mapping) ? optionRef.metadata.phq_mapping : [];
            for (const gm of gdsMappings) inferred.push({ ...gm, scale: 'GDS', mapping_source: gm.mapping_source || 'designer' });
            for (const pm of phqMappings) inferred.push({ ...pm, scale: 'PHQ', mapping_source: pm.mapping_source || 'designer' });
            if (inferred.length) {
              resolvedMappings = inferred;
              inferredFromOption = true;
            }
          }

          const confidencePool = [];
          const explicitConfidence = normalizeUnitScore(d.mapping_confidence, null);
          if (explicitConfidence !== null) confidencePool.push(explicitConfidence);
          const parsedConfidence = normalizeUnitScore(d.parsed_mapping && d.parsed_mapping.mapping_confidence, null);
          if (parsedConfidence !== null) confidencePool.push(parsedConfidence);
          for (const m of resolvedMappings) {
            const c = normalizeUnitScore(m && m.confidence, null);
            if (c !== null) confidencePool.push(c);
          }
          for (const m of designerMappings) {
            const c = normalizeUnitScore((m && (m.confidence || m.source_confidence)), null);
            if (c !== null) confidencePool.push(c);
          }

          const computedMappingConfidence = confidencePool.length
            ? Number((confidencePool.reduce((a, b) => a + b, 0) / confidencePool.length).toFixed(3))
            : null;

          const validationSteps = Array.isArray(d.validation_steps)
            ? d.validation_steps
            : (inferredFromOption ? ['fallback_option_mappings'] : []);
          const riskFlags = Array.isArray(d.risk_flags) ? d.risk_flags : [];

          const normalizedRawMapping = d.parsed_mapping || d.raw_mapping || (
            resolvedMappings.length
              ? {
                  mapping_confidence: computedMappingConfidence,
                  clinical_mapping: resolvedMappings,
                  inferred_from_option: inferredFromOption
                }
              : null
          );

          const rawMappingWithConsequence = (() => {
            const base = normalizedRawMapping && typeof normalizedRawMapping === 'object'
              ? { ...normalizedRawMapping }
              : null;
            const consequence = (d.raw_mapping && d.raw_mapping.consequence)
              || d.consequence
              || (optionRef && optionRef.consequence)
              || null;
            if (!base && !consequence) return null;
            return { ...(base || {}), consequence };
          })();

          decisionRows.push({
            decision_id: decisionId,
            session_id,
            timestamp: d.timestamp || new Date().toISOString(),
            chapter_id: d.chapter_id || sessionRow.chapter_id,
            scene_id: d.scene_id || null,
            option_id: d.option_id || null,
            option_text: d.option_text || (optionRef && optionRef.option_text) || null,
            time_to_decision_ms: Number.isFinite(Number(d.time_to_decision_ms)) ? Number(d.time_to_decision_ms) : null,
            mapping_confidence: computedMappingConfidence,
            validation_steps: validationSteps,
            risk_flags: riskFlags,
            raw_mapping: rawMappingWithConsequence
          });

          decisionContexts.push({
            decision_id: decisionId,
            designerMappings,
            resolvedMappings,
            inferredFromOption,
            validationSteps,
            riskFlags,
            rawMapping: normalizedRawMapping,
            rawMappingWithConsequence,
            mappingConfidence: computedMappingConfidence
          });
        }

        if (decisionRows.length > 0) {
          console.log('decisionRows to insert:', decisionRows);
            // Ensure referenced chapters exist to satisfy FK constraint on decisions.chapter_id
            const chapterIds = Array.from(new Set(decisionRows.map(r => r.chapter_id).filter(Boolean)));
            for (const cid of chapterIds) {
              try {
                const { data: existingCh, error: chExistErr } = await supabase.from('chapters').select('chapter_id').eq('chapter_id', cid).maybeSingle();
                if (chExistErr) console.warn('chapter lookup error', chExistErr);
                if (!existingCh) {
                  const chOrder = parseInt(String(cid).replace('c', ''), 10) || null;
                  const { error: chInsErr } = await supabase.from('chapters').upsert(
                    [{ chapter_id: cid, title: `Capítulo ${chOrder || ''}`.trim(), order: chOrder }],
                    { onConflict: 'chapter_id' }
                  ).select();
                  if (chInsErr) console.warn('failed to upsert chapter', cid, chInsErr);
                  else console.log('upserted missing chapter:', cid);
                }
              } catch (e) { console.warn('chapter ensure error', cid, e && e.message); }
            }

            // Ensure referenced scenes exist to satisfy foreign key constraints.
            const sceneIds = Array.from(new Set(decisionRows.map(r => r.scene_id).filter(Boolean)));
            for (const sid of sceneIds) {
              try {
                const { data: existing, error: existErr } = await supabase.from('scenes').select('scene_id').eq('scene_id', sid).maybeSingle();
                if (existErr) console.warn('scene lookup error', existErr);
                if (!existing) {
                  try {
                    const { data: insData, error: insErr } = await supabase.from('scenes').upsert([{ scene_id: sid, chapter_id: sessionRow.chapter_id || null, title: sid, metadata: {} }], { onConflict: 'scene_id' }).select();
                    if (insErr) {
                      console.warn('failed to upsert scene', sid, insErr);
                    } else {
                      console.log('upserted missing scene:', sid, insData);
                    }
                  } catch (insertSceneErr) {
                    console.warn('failed to upsert scene', sid, insertSceneErr && insertSceneErr.message ? insertSceneErr.message : insertSceneErr);
                  }
                }
              } catch (e) {
                console.warn('scene ensure error', sid, e && e.message);
              }
            }

            // Ensure referenced options exist to satisfy foreign key constraints.
            // NOTE: use upsertOptionsWithSchemaFallback — direct upsert with phq_mapping fails
            // because phq_mapping is not a column (it lives in options.metadata->'phq_mapping').
            const optionIds = Array.from(new Set(decisionRows.map(r => r.option_id).filter(Boolean)));
            for (const oid of optionIds) {
              try {
                const { data: existing, error: existErr } = await supabase.from('options').select('option_id').eq('option_id', oid).maybeSingle();
                if (existErr) console.warn('option lookup error', existErr);
                if (!existing) {
                  try {
                    await upsertOptionsWithSchemaFallback([{ option_id: oid, option_text: oid, consequence: null, gds_mapping: [] }]);
                    console.log('upserted missing option:', oid);
                  } catch (insertOptionErr) {
                    console.warn('failed to upsert option', oid, insertOptionErr && insertOptionErr.message ? insertOptionErr.message : insertOptionErr);
                  }
                }
              } catch (e) {
                console.warn('option ensure error', oid, e && e.message);
              }
            }

            const { error: decErr } = await supabase.from('decisions').insert(decisionRows);
            if (decErr) {
              console.error('decisions insert error detail:', decErr);
              throw decErr;
            }
        }

        const clinicalRows = [];
        for (let i = 0; i < decisionContexts.length; i++) {
          const dctx = decisionContexts[i] || {};
          const decision_id = dctx.decision_id;
          const designerMappings = dctx.designerMappings || [];
          for (const m of designerMappings) {
            clinicalRows.push({
              mapping_id: (m.mapping_id && uuidValidate(m.mapping_id)) ? m.mapping_id : uuidv4(),
              decision_id,
              scale: m.scale || null,
              item: m.item || null,
              weight: normalizeUnitScore(m.weight, 0.5),
              confidence: normalizeUnitScore(m.confidence || m.source_confidence, 0.75),
              primary_construct: m.primary_construct || null,
              rationale: m.rationale || null,
              mapping_source: 'designer',
              source_confidence: normalizeUnitScore(m.source_confidence || m.confidence, 0.75),
              validated: m.validated || false
            });
          }
          const mappings = dctx.resolvedMappings || [];
          for (const m of mappings) {
            clinicalRows.push({
              mapping_id: (m.mapping_id && uuidValidate(m.mapping_id)) ? m.mapping_id : uuidv4(),
              decision_id,
              scale: m.scale || null,
              item: m.item || null,
              weight: normalizeUnitScore(m.weight, 0.5),
              confidence: normalizeUnitScore(m.confidence, 0.75),
              primary_construct: m.primary_construct || null,
              rationale: m.rationale || null,
              mapping_source: normalizeClinicalMappingSource(m.mapping_source, dctx.inferredFromOption ? 'heuristic' : 'llm'),
              source_confidence: normalizeUnitScore(m.source_confidence || m.confidence, 0.75),
              validated: m.validated || false
            });
          }
        }

          if (clinicalRows.length > 0) {
          console.log('clinicalRows to insert:', clinicalRows);
          const { error: cmErr } = await supabase.from('clinical_mappings').insert(clinicalRows);
          if (cmErr) {
            console.error('clinical_mappings insert error detail:', cmErr);
            throw cmErr;
          }

            const ratingRows = clinicalRows
              .filter(r => r.decision_id && r.scale && Number.isFinite(Number(r.item)))
              .map(r => ({
                decision_id: r.decision_id,
                scale: r.scale,
                item: Number(r.item),
                value: Number.isFinite(Number(r.weight)) ? Number(r.weight) : null,
                derived: true,
                created_at: new Date().toISOString()
              }));

            if (ratingRows.length > 0) {
              const { error: drErr } = await supabase.from('decision_ratings').insert(ratingRows);
              if (drErr) {
                console.warn('decision_ratings insert warning', drErr.message || drErr);
              }
            }
        }

        for (let i = 0; i < decisionRows.length; i++) {
          const dRow = decisionRows[i] || {};
          const dCtx = decisionContexts[i] || {};
          const auditRow = {
            session_id,
            decision_id: dRow.decision_id || null,
            llm_request: p.llm_request || {
              source: p.source || null,
              chapter_id: dRow.chapter_id || null,
              scene_id: dRow.scene_id || null,
              option_id: dRow.option_id || null,
              option_text: dRow.option_text || null
            },
            llm_response: p.llm_response || dCtx.rawMapping || null,
            validation_result: {
              mapping_confidence: dCtx.mappingConfidence,
              inferred_from_option: !!dCtx.inferredFromOption,
              mappings_count: Array.isArray(dCtx.resolvedMappings) ? dCtx.resolvedMappings.length : 0,
              validation_steps: dCtx.validationSteps || []
            },
            risk_flags: dCtx.riskFlags || [],
            pseudonym
          };

          const { data: auditRows, error: auditLookupErr } = await supabase
            .from('decision_audit')
            .select('audit_id')
            .eq('session_id', session_id)
            .eq('decision_id', dRow.decision_id)
            .limit(1);
          if (auditLookupErr) {
            console.warn('decision_audit lookup warning', auditLookupErr.message || auditLookupErr);
          }

          if (Array.isArray(auditRows) && auditRows.length > 0) {
            const { error: auditUpdateErr } = await supabase
              .from('decision_audit')
              .update(auditRow)
              .eq('session_id', session_id)
              .eq('decision_id', dRow.decision_id);
            if (auditUpdateErr) {
              console.warn('decision_audit update warning', auditUpdateErr.message || auditUpdateErr);
            }
          } else {
            const { error: auditInsertErr } = await supabase.from('decision_audit').insert(auditRow);
            if (auditInsertErr) {
              console.warn('decision_audit insert warning', auditInsertErr.message || auditInsertErr);
            }
          }
        }

        return { ok: true, session_id, decisions_inserted: decisionRows.length, clinical_mappings_inserted: clinicalRows.length };
      }

// ============= SPRINT 2a: Session Closure & Summary Endpoints =============

/**
 * PUT /sessions/{session_id}/close
 * Closes a session and computes normalized emotion scores from session_scores (GDS max 15, PHQ max 27)
 * Body: { ended_at, session_length_seconds, abandonment_flag }
 */
async function handleSessionClose(req, res) {
  try {
    const sessionId = req.url.match(/^\/sessions\/([^/]+)\/close/)?.[1];
    if (!sessionId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'session_id required' }));
    }

    const body = await parseJsonBody(req);
    const { ended_at, session_length_seconds, abandonment_flag } = body || {};

    // Fetch session scores (pre-computed by trigger)
    const { data: sessionScores, error: scoreErr } = await supabase
      .from('session_scores')
      .select('gds_total, phq_total')
      .eq('session_id', sessionId)
      .maybeSingle();
    
    if (scoreErr) throw scoreErr;

    // Get totals from session_scores or default to 0
    const gdsTotal = sessionScores?.gds_total || 0;
    const phqTotal = sessionScores?.phq_total || 0;

    // Normalize scores to 0-1 range
    // GDS-15: 0-15 max → 0-1 normalized (divide by 15)
    // PHQ-9: 0-27 max range (9 items × 3 points each) → 0-1 normalized (divide by 27)
    const normalizedGds = Math.min(1, Math.max(0, gdsTotal / 15));
    const normalizedPhq = Math.min(1, Math.max(0, phqTotal / 27));

    console.log(`[Session Close] ${sessionId}: GDS total=${gdsTotal} (normalized=${normalizedGds}), PHQ total=${phqTotal} (normalized=${normalizedPhq})`);

    // Update session with closure data
    const updateData = {
      ended_at: ended_at || new Date().toISOString(),
      is_closed: true,
      session_length_seconds: session_length_seconds || null,
      abandonment_flag: abandonment_flag || false
    };

    const { error: updateErr } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('session_id', sessionId);
    
    if (updateErr) throw updateErr;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ok: true,
      session_id: sessionId,
      normalized_emotional_score_gds: normalizedGds,
      normalized_emotional_score_phq: normalizedPhq,
      gds_total: gdsTotal,
      phq_total: phqTotal
    }));
  } catch (err) {
    console.error('session close error', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

/**
 * GET /sessions/{session_id}/summary
 * Returns session summary with scores, risk flags, and decision count
 */
async function handleSessionSummary(req, res) {
  try {
    const sessionId = req.url.match(/^\/sessions\/([^/]+)\/summary/)?.[1];
    if (!sessionId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'session_id required' }));
    }

    // Validate that sessionId looks like a UUID (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'invalid session_id format (must be UUID)' }));
    }

    // Fetch session record
    const { data: sessionRecord, error: sessErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();
    
    if (sessErr) {
      console.error('session fetch error', sessErr);
      throw sessErr;
    }
    
    if (!sessionRecord) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'session not found' }));
    }

    // Count decisions for this session
    const { data: decisions, error: decErr, count: decCount } = await supabase
      .from('decisions')
      .select('decision_id', { count: 'exact', head: true })
      .eq('session_id', sessionId);
    
    if (decErr) {
      console.error('decision count error', decErr);
      throw decErr;
    }

    // Fetch risk events for this session
    const { data: riskEvents, error: riskErr } = await supabase
      .from('risk_events')
      .select('risk_type')
      .eq('session_id', sessionId);
    
    if (riskErr) {
      console.error('risk events fetch error', riskErr);
      throw riskErr;
    }

    const riskFlags = riskEvents ? [...new Set(riskEvents.map(e => e.risk_type))] : [];

    // Fetch session scores for detailed breakdown
    const { data: sessionScores, error: scoresErr } = await supabase
      .from('session_scores')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();
    
    if (scoresErr) {
      console.error('session scores error', scoresErr);
      throw scoresErr;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    const normalizedGds = sessionScores
      ? Math.min(1, Math.max(0, Number(sessionScores.gds_total || 0) / 15))
      : null;
    const normalizedPhq = sessionScores
      ? Math.min(1, Math.max(0, Number(sessionScores.phq_total || 0) / 27))
      : null;

    return res.end(JSON.stringify({
      ok: true,
      session_id: sessionId,
      pseudonym: sessionRecord.pseudonym || null,
      decisions_count: decCount || 0,
      gds_score: normalizedGds,
      phq_score: normalizedPhq,
      risk_flags: riskFlags,
      is_closed: sessionRecord.is_closed || false,
      created_at: sessionRecord.created_at,
      ended_at: sessionRecord.ended_at || null,
      session_length_seconds: sessionRecord.session_length_seconds || null,
      abandonment_flag: sessionRecord.abandonment_flag || false,
      detailed_scores: sessionScores ? {
        gds_total: sessionScores.gds_total,
        phq_total: sessionScores.phq_total,
        computed_at: sessionScores.computed_at
      } : null
    }));
  } catch (err) {
    console.error('session summary error', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

// ============= SPRINT 2c: LLM Mapping Computation =============

// Handle POST /decisions/{id}/compute-mapping: Generate mappings using all 3 LLM models
async function handleComputeMapping(req, res) {
  try {
    if (!llmClient || !prompts) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'LLM service not available' }));
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { decision_id } = payload;

        if (!decision_id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'decision_id required' }));
        }

        // Fetch decision
        const { data: decision, error: decErr } = await supabase
          .from('decisions')
          .select('*')
          .eq('decision_id', decision_id)
          .single();

        if (decErr || !decision) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'decision not found' }));
        }

        // Build prompt
        const prompt = prompts.buildClinicianMappingPrompt(decision);

        // Call all available models
        const coreProviders = [];
        const primaryCore = process.env.LLM_PROVIDER_CORE || process.env.LLM_PROVIDER || null;
        const secondaryCore = process.env.LLM_PROVIDER_CORE_SECONDARY || null;
        if (primaryCore) {
          coreProviders.push({
            name: primaryCore,
            models: parseEnvList(process.env.LLM_CORE_MODELS)
          });
        }
        if (secondaryCore) {
          coreProviders.push({
            name: secondaryCore,
            models: parseEnvList(process.env.LLM_CORE_MODELS_SECONDARY)
          });
        }

        const llmResults = await llmClient.callModelsAcrossProviders(prompt, {
          providers: coreProviders.length ? coreProviders : [{ name: primaryCore || 'ollama' }]
        });

        // Parse responses for each model
        const parsedResults = {};
        for (const [model, result] of Object.entries(llmResults.results)) {
          if (result.error) {
            parsedResults[model] = { error: result.error, time_ms: result.time_ms };
          } else {
            const parsed = llmClient.parseClinicianResponse(result.response);
            parsedResults[model] = {
              ...parsed,
              score_summary: buildClinicalScoreSummary(parsed.mappings || []),
              time_ms: result.time_ms,
              provider: result.provider
            };
          }
        }

        // Return comparison
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          ok: true,
          decision_id,
          results: parsedResults,
          total_time_ms: llmResults.total_time_ms,
          timestamp: new Date().toISOString()
        }));

      } catch (err) {
        console.error('compute mapping error', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message || String(err) }));
      }
    });

  } catch (err) {
    console.error('compute mapping handler error', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

// Handle POST /decisions/{id}/compute-mapping/compare: Compare with designer mappings
async function handleComputeMappingCompare(req, res) {
  try {
    if (!llmClient || !prompts) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'LLM service not available' }));
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { decision_id } = payload;

        if (!decision_id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'decision_id required' }));
        }

        // Fetch decision with clinical mappings
        const { data: decision, error: decErr } = await supabase
          .from('decisions')
          .select('*')
          .eq('decision_id', decision_id)
          .single();

        if (decErr || !decision) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'decision not found' }));
        }

        // Fetch designer and LLM mappings
        const { data: allMappings, error: mapErr } = await supabase
          .from('clinical_mappings')
          .select('*')
          .eq('decision_id', decision_id);

        if (mapErr) throw mapErr;

        const designerMappings = (allMappings || []).filter(m => m.mapping_source === 'designer');
        const llmMappings = (allMappings || []).filter(m => m.mapping_source === 'llm');

        // If no LLM mappings exist, generate them
        let finalLLMmappings = llmMappings;
        if (!llmMappings.length) {
          const prompt = prompts.buildClinicianMappingPrompt(decision);
          const coreProviders = [];
          const primaryCore = process.env.LLM_PROVIDER_CORE || process.env.LLM_PROVIDER || null;
          const secondaryCore = process.env.LLM_PROVIDER_CORE_SECONDARY || null;
          if (primaryCore) {
            coreProviders.push({
              name: primaryCore,
              models: parseEnvList(process.env.LLM_CORE_MODELS)
            });
          }
          if (secondaryCore) {
            coreProviders.push({
              name: secondaryCore,
              models: parseEnvList(process.env.LLM_CORE_MODELS_SECONDARY)
            });
          }

          const llmResults = await llmClient.callModelsAcrossProviders(prompt, {
            providers: coreProviders.length ? coreProviders : [{ name: primaryCore || 'ollama' }]
          });
          
          // Use the best response (first model available)
          for (const [model, result] of Object.entries(llmResults.results)) {
            if (!result.error) {
              const parsed = llmClient.parseClinicianResponse(result.response);
              finalLLMmappings = parsed.mappings;
              break;
            }
          }
        }

        // Compare
        const comparison = llmClient.compareMappings(designerMappings, finalLLMmappings);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          ok: true,
          decision_id,
          comparison,
          designer_mappings: designerMappings,
          llm_mappings: finalLLMmappings,
          timestamp: new Date().toISOString()
        }));

      } catch (err) {
        console.error('mapping compare error', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message || String(err) }));
      }
    });

  } catch (err) {
    console.error('mapping compare handler error', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

// Handle GET /admin/llm-health: Check LLM provider connectivity
async function handleLLMHealth(req, res) {
  try {
    if (!llmClient) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'LLM client not loaded' }));
    }

    const health = await llmClient.checkHealth();
    const providerInfo = llmClient.getProviderInfo();
    
    const statusCode = health.ok ? 200 : 503;
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ...health,
      provider: providerInfo
    }));

  } catch (err) {
    console.error('llm health check error', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

// Handle GET /chapters: Get all chapters with their options
async function handleGetChapters(req, res) {
  try {
    const { data: chapters, error: chapErr } = await supabase
      .from('chapters')
      .select('*')
      .order('chapter_id', { ascending: true });

    if (chapErr) throw chapErr;

    // Get all scenes for each chapter
    const enrichedChapters = await Promise.all((chapters || []).map(async (ch) => {
      const { data: scenes } = await supabase
        .from('scenes')
        .select('*')
        .eq('chapter_id', ch.chapter_id)
        .order('order', { ascending: true });

      // Get options for each scene
      const scenesWithOptions = await Promise.all((scenes || []).map(async (scene) => {
        const { data: options } = await supabase
          .from('options')
          .select(`
            *,
            clinical_mappings(*)
          `)
          .eq('scene_id', scene.scene_id)
          .order('order', { ascending: true });

        return { ...scene, options: options || [] };
      }));

      return { ...ch, scenes: scenesWithOptions };
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ok: true,
      chapters: enrichedChapters,
      total: enrichedChapters.length
    }));
  } catch (err) {
    console.error('get chapters error', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

// Handle GET /chapters/display: Pretty display of chapters
async function handleDisplayChapters(req, res) {
  try {
    const { data: chapters, error: chapErr } = await supabase
      .from('chapters')
      .select('*')
      .order('chapter_id', { ascending: true });

    if (chapErr) throw chapErr;

    let html = `
    <html>
    <head>
      <title>Capítulos Generados</title>
      <style>
        body { font-family: Arial; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1000px; margin: 0 auto; }
        .chapter { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .chapter h2 { color: #2c3e50; margin: 0 0 10px 0; }
        .meta { color: #7f8c8d; font-size: 0.9em; margin: 5px 0; }
        .scenes { margin-top: 15px; }
        .scene { background: #ecf0f1; padding: 10px; margin: 10px 0; border-left: 4px solid #3498db; }
        .scene p { margin: 5px 0; }
        .options { margin: 10px 0 0 0; }
        .option { background: white; padding: 8px 12px; margin: 5px 0; border-radius: 4px; border-left: 3px solid #27ae60; }
        .option strong { color: #27ae60; }
        .mappings { font-size: 0.85em; color: #7f8c8d; margin: 5px 0 0 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📚 Capítulos Generados</h1>
        <p>Total de capítulos: <strong>${chapters?.length || 0}</strong></p>
    `;

    for (const chapter of (chapters || [])) {
      const { data: scenes } = await supabase
        .from('scenes')
        .select('*')
        .eq('chapter_id', chapter.chapter_id);

      html += `
        <div class="chapter">
          <h2>${chapter.chapter_id}: ${chapter.title || 'Sin título'}</h2>
          <div class="meta">
            <div>Creado: ${new Date(chapter.created_at).toLocaleString()}</div>
            <div>Generador: ${chapter.metadata?.generated_by || 'Sistema'}</div>
          </div>
      `;

      for (const scene of (scenes || [])) {
        const { data: options } = await supabase
          .from('options')
          .select(`*, clinical_mappings(*)`)
          .eq('scene_id', scene.scene_id);

        html += `
          <div class="scene">
            <p><strong>Escena:</strong> ${scene.narration?.substring(0, 100) || 'Sin descripción'}...</p>
            <div class="options">
              <strong>Opciones (${options?.length || 0}):</strong>
        `;

        for (const opt of (options || [])) {
          html += `
              <div class="option">
                <strong>${opt.option_text}</strong>
                <p style="margin: 5px 0; font-size: 0.9em;">${opt.consequence?.substring(0, 80) || 'Sin consecuencia'}...</p>
                <div class="mappings">Mapeos: ${opt.clinical_mappings?.length || 0}</div>
              </div>
          `;
        }

        html += `
            </div>
          </div>
        `;
      }

      html += `</div>`;
    }

    html += `
      </div>
    </body>
    </html>
    `;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  } catch (err) {
    console.error('display chapters error', err);
    res.writeHead(500, { 'Content-Type': 'text/html' });
    return res.end(`<h1>Error: ${err.message}</h1>`);
  }
}

// Scene-by-scene generation (Sprint 4: token-efficient lazy generation)
async function generateNextSceneForSession(session_id, chapter_id, scene_order) {
  if (!llmClient || !prompts) throw new Error('LLM service not available');
  if (!session_id || !chapter_id || scene_order === null || typeof scene_order === 'undefined') {
    throw new Error('session_id, chapter_id, and scene_order required');
  }

  console.log(`🎬 SCENE GENERATION: chapter=${chapter_id}, scene_order=${scene_order}`);

  // 🔍 STEP 1: Load session state
  const { data: session, error: sessErr } = await supabase
    .from('sessions')
    .select('*')
    .eq('session_id', session_id)
    .single();
  if (sessErr || !session) throw new Error('Session not found');

  const sessionLocale = String((session.metadata && session.metadata.locale) || 'es-MX');
  const sessionGeoSetting = getGeographicSetting(sessionLocale);

  // 🔍 STEP 2: Load decision history for continuity
  const { data: decisions, error: decErr } = await supabase
    .from('decisions')
    .select('*')
    .eq('session_id', session_id)
    .order('timestamp', { ascending: true });
  if (decErr) throw decErr;

  // 🔍 STEP 3: Load clinical scores
  const { data: scores, error: scoreErr } = await supabase
    .from('session_scores')
    .select('*')
    .eq('session_id', session_id)
    .single();
  
  const clinicalLevel = scores 
    ? (scores.gds_total > 10 || scores.phq_total > 15 ? 'high' : 'moderate')
    : 'baseline';

  // 🔍 STEP 4: Build continuity state from last decision
  let lastDecision = null;
  let decisionSummary = '';
  let continuityText = '';
  if (decisions && decisions.length > 0) {
    lastDecision = decisions[decisions.length - 1];
    decisionSummary = lastDecision.option_text || '';
    continuityText = lastDecision.raw_mapping?.consequence || 'El usuario continúa su viaje.';
  }

  // 🔍 STEP 5: Resolve Hero's Journey stage for current scene_order
  // Stage mapping: scene 1→stage 1, scene 2→stage 2, ..., scene 12→stage 12
  const heroStages = [
    'ordinary_world',           // 1
    'call_to_adventure',        // 2
    'refusal_of_call',          // 3
    'meeting_the_mentor',       // 4
    'crossing_the_threshold',   // 5
    'tests_allies_enemies',     // 6 (Day 3 convergence)
    'approach_to_inmost_cave',  // 7
    'ordeal',                   // 8 (Day 5 convergence)
    'reward',                   // 9
    'the_road_back',            // 10
    'resurrection',             // 11
    'return_with_elixir'        // 12 (Day 7 convergence)
  ];
  const currentHeroStageNum = Math.min(scene_order, 12);
  const currentHeroStage = `${currentHeroStageNum}_${heroStages[currentHeroStageNum - 1] || 'unknown'}`;
  const nextHeroStageNum = Math.min(scene_order + 1, 12);
  const nextHeroStage = `${nextHeroStageNum}_${heroStages[nextHeroStageNum - 1] || 'unknown'}`;

  // 🔍 STEP 6: Detect convergence nodes (Days 3, 5, 7 = scenes 6, 8, 12)
  const isConvergenceNode = [6, 8, 12].includes(scene_order);
  console.log(`${isConvergenceNode ? '🔄' : '➡️'} Hero stage: ${currentHeroStage} → ${nextHeroStage}${isConvergenceNode ? ' [CONVERGENCE NODE]' : ''}`);

  // 🔍 STEP 7: Extract emotional state from last decisions
  // Simplified: track escalation/de-escalation through consequence sentiment
  const emotionalState = lastDecision?.raw_mapping?.emotional_direction || 'stable';

  // Load recent chapter material to reduce template repetition across contiguous scenes.
  const targetSceneOrder = Number(scene_order) + 1;
  let recentSceneTexts = [];
  let recentOptionTexts = [];
  try {
    const { data: recentScenes } = await supabase
      .from('scenes')
      .select('scene_id, order, title, metadata')
      .eq('chapter_id', chapter_id)
      .lt('order', targetSceneOrder)
      .order('order', { ascending: false })
      .limit(3);

    const sceneRows = Array.isArray(recentScenes) ? recentScenes : [];
    recentSceneTexts = sceneRows
      .map((s) => (s && s.metadata && s.metadata.scene_text) ? String(s.metadata.scene_text) : '')
      .map((t) => String(t || '').trim())
      .filter(Boolean)
      .slice(0, 3);

    const recentSceneIds = sceneRows.map(s => s && s.scene_id).filter(Boolean);
    if (recentSceneIds.length > 0) {
      const { data: recentOpts } = await supabase
        .from('options')
        .select('option_text')
        .in('scene_id', recentSceneIds)
        .limit(12);
      recentOptionTexts = (Array.isArray(recentOpts) ? recentOpts : [])
        .map(o => String(o && o.option_text || '').trim())
        .filter(Boolean)
        .slice(0, 12);
    }
  } catch (e) {
    console.warn('recent scene context lookup warning', e && e.message ? e.message : e);
  }

  // 🔍 STEP 8: Check path cache before generating
  // Path key = hash(last 3 decisions + clinical_level + chapter_id)
  const pathKey = hashObject({
    chapter_id,
    scene_order: targetSceneOrder,
    clinical_level: clinicalLevel,
    emotional_state: emotionalState,
    last_choices: (decisions || []).slice(-3).map(d => d.option_id || d.option_text || ''),
    prompt_version: PROMPT_VERSION
  });
  const { data: cachedPath, error: cacheErr } = await supabase
    .from('narrative_path_cache')
    .select('stored_scene, quality_score')
    .eq('path_key', pathKey)
    .eq('clinical_segment', clinicalLevel)
    .order('quality_score', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cacheErr && cachedPath) {
    console.log(`✅ CACHE HIT: Using stored scene (quality=${cachedPath.quality_score.toFixed(2)})`);
    const storedScene = cachedPath.stored_scene;
    
    // Insert scene from cache
    await insertSceneWithSchemaFallback({
      scene_id: storedScene.scene_id,
      chapter_id: chapter_id,
      order: scene_order,
      hero_stage: currentHeroStage,
      type: 'playable',
      title: storedScene.title,
      text: storedScene.text,
      emotional_direction: storedScene.emotional_direction,
      clinical_priority: storedScene.clinical_priority,
      raw_scene: storedScene
    });

    // Insert cached options
    const optionsToInsert = (storedScene.options || []).map(opt => ({
      option_id: opt.option_id,
      scene_id: storedScene.scene_id,
      option_text: opt.option_text,
      consequence: opt.consequence,
      next_chapter_id: opt.next_chapter_id || null,
      next_scene_id: opt.next_scene_id,
      gds_mapping: Array.isArray(opt.gds_mapping) ? opt.gds_mapping : [],
      metadata: {
        phq_mapping: Array.isArray(opt.phq_mapping) ? opt.phq_mapping : [],
        risk_flag: opt.risk_flag || null,
        generated_by: 'scene_cache',
        generated_at: new Date().toISOString()
      },
      raw_mapping: opt
    }));
    if (optionsToInsert.length > 0) {
      await upsertOptionsWithSchemaFallback(optionsToInsert);
    }

    return storedScene;
  }

  // 🔍 STEP 9: Generate new scene (cache miss)
  console.log(`⚙️ CACHE MISS: Generating new scene via LLM`);
  
  // Determine clinical flags from scores
  const clinicalFlags = [];
  if (scores?.gds_total > 10) clinicalFlags.push('depression_risk');
  if (scores?.phq_total > 15) clinicalFlags.push('anxiety_risk');
  if (decisions?.length < 2) clinicalFlags.push('early_stage');
  if (decisions && decisions.some(d => d.raw_mapping?.phq_items?.some(i => i.item === 2))) {
    clinicalFlags.push('low_energy');
  }

  const sceneContext = {
    chapter_id: chapter_id,
    current_scene_order: scene_order,
    current_hero_stage: currentHeroStage,
    next_hero_stage: nextHeroStage,
    last_decision_text: decisionSummary,
    last_decision_consequence: continuityText,
    emotional_state: emotionalState,
    clinical_flags: clinicalFlags,
    is_convergence_node: isConvergenceNode,
    recent_scene_snippets: recentSceneTexts,
    recent_option_texts: recentOptionTexts,
    geographic_setting: sessionGeoSetting
  };

  const scenePrompt = prompts.buildSceneGenerationPrompt(sceneContext);
  let sceneJson;

  function normalizeNarrativeText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function lexicalSimilarity(a, b) {
    const stopWords = new Set(['la', 'el', 'los', 'las', 'de', 'del', 'y', 'en', 'con', 'por', 'para', 'que', 'una', 'uno', 'un', 'al', 'a', 'se', 'su', 'sus', 'es']);
    const toTokens = (v) => normalizeNarrativeText(v)
      .split(' ')
      .filter(t => t.length >= 4 && !stopWords.has(t));
    const aSet = new Set(toTokens(a));
    const bSet = new Set(toTokens(b));
    if (!aSet.size || !bSet.size) return 0;
    let inter = 0;
    for (const t of aSet) if (bSet.has(t)) inter += 1;
    const union = new Set([...aSet, ...bSet]).size;
    return union ? (inter / union) : 0;
  }

  function assessSingleSceneNarrativeQuality(candidate) {
    const issues = [];
    const scene = candidate && candidate.scene ? candidate.scene : null;
    const options = Array.isArray(candidate && candidate.options) ? candidate.options : [];
    const text = String(scene && scene.text || '').trim();
    const normalizedSceneText = normalizeNarrativeText(text);

    if (!text) issues.push('Scene text is empty');

    const dialoguePattern = /["“”]|\b(dijo|pregunt[oó]|respondi[oó]|contest[oó]|susurr[oó]|salud[oó]|coment[oó])\b/i;
    if (!dialoguePattern.test(text)) {
      issues.push('Scene lacks character dialogue or spoken exchange');
    }

    const environmentPattern = /\b(jardin|bancal|puerta|ventana|mesa|silla|taza|cafe|suelo|maceta|calle|cocina|telefono|flores)\b/i;
    const interactionVerbPattern = /\b(abri[oó]|cerr[oó]|toc[oó]|movi[oó]|sirvi[oó]|rega[oó]|barri[oó]|camin[oó]|sent[oó]|apoy[oó]|limpi[oó]|entr[oó]|sal[ií]o|levant[oó])\b/i;
    if (!(environmentPattern.test(text) && interactionVerbPattern.test(text))) {
      issues.push('Scene lacks concrete interaction with the physical environment');
    }

    const griefMentions = text.match(/\b(dolor|perdida|duelo|soledad)\b/gi) || [];
    if (griefMentions.length > 1) {
      issues.push('Scene overuses explicit grief terms instead of showing through action');
    }

    const repetitiveBoilerplate = [
      /rosa se siente/gi,
      /se da cuenta de que/gi,
      /lista para enfrentar/gi,
      /nuevo prop[oó]sito/gi
    ];
    const boilerplateHits = repetitiveBoilerplate.reduce((acc, rx) => acc + ((text.match(rx) || []).length), 0);
    if (boilerplateHits >= 3) {
      issues.push('Scene relies on repetitive boilerplate phrasing');
    }

    const repeatedAgainstRecent = (recentSceneTexts || []).some(prev => lexicalSimilarity(text, prev) >= 0.55);
    if (repeatedAgainstRecent) {
      issues.push('Scene is too lexically similar to recent chapter scenes');
    }

    if (options.length !== 3) {
      issues.push(`Expected exactly 3 options, got ${options.length}`);
    } else {
      const stopWords = new Set(['la', 'el', 'los', 'las', 'de', 'del', 'y', 'en', 'con', 'por', 'para', 'que', 'una', 'uno', 'un', 'al', 'a', 'se']);
      for (const opt of options) {
        const optionText = normalizeNarrativeText(opt && opt.option_text || '');
        const consequenceText = normalizeNarrativeText(opt && opt.consequence || '');
        const tokens = optionText.split(' ').filter(t => t.length >= 5 && !stopWords.has(t));
        const hasOverlap = tokens.some(t => consequenceText.includes(t));
        if (!hasOverlap) {
          issues.push(`Consequence appears inconsistent with option: ${String(opt && opt.option_id || 'unknown')}`);
          break;
        }

        const repeatsRecentOption = (recentOptionTexts || []).some(prevOpt => normalizeNarrativeText(prevOpt) === optionText);
        if (repeatsRecentOption) {
          issues.push(`Option text repeats a recent option: ${String(opt && opt.option_id || 'unknown')}`);
          break;
        }

        if (normalizeNarrativeText(opt && opt.consequence || '').includes(normalizedSceneText.slice(0, 90))) {
          issues.push(`Consequence duplicates scene narration instead of advancing action: ${String(opt && opt.option_id || 'unknown')}`);
          break;
        }
      }
    }

    return { ok: issues.length === 0, issues };
  }

  function buildSceneRescuePrompt(basePrompt, qualityReport) {
    const issues = qualityReport && Array.isArray(qualityReport.issues) ? qualityReport.issues : [];
    const issueBlock = issues.length ? issues.map(x => `- ${x}`).join('\n') : '- Escena sin calidad suficiente';
    return `${basePrompt}\n\nCORRECCION OBLIGATORIA (REINTENTO):\nLa escena fue rechazada por calidad narrativa insuficiente.\nProblemas detectados:\n${issueBlock}\n\nDebes corregir especificamente:\n1) Incluye al menos 1 intercambio verbal breve entre dos personas (dialogo natural, no monologo).\n2) Muestra 1 accion concreta con el entorno fisico (objeto o espacio).\n3) Evita repetir explicitamente dolor/perdida/duelo/soledad; maximo 1 mencion en toda la escena.\n4) Cada consecuencia debe corresponder a su opcion, sin contradicciones entre accion elegida y resultado.\n5) Mantén prosa en español neutro, sin listas ni texto genérico.\n\nRESPONDE SOLO JSON valido.`;
  }

  const callSceneModelWithFallback = async (promptToUse) => {
    const sceneModel = process.env.LLM_NARRATIVE_MODEL || process.env.LLM_GENERATOR_MODEL || 'orca-mini';
    const sceneModelFallback = process.env.LLM_NARRATIVE_MODEL_FALLBACK;

    let llmSceneResponse = await llmClient.callLLM(sceneModel, promptToUse, {
      role: 'narrative',
      timeout: 120000,
      max_tokens: Number(process.env.LLM_SCENE_MAX_TOKENS || 1400),
      temperature: Number(process.env.LLM_SCENE_TEMPERATURE || 0.8)
    });

    if ((!llmSceneResponse || !llmSceneResponse.response) && sceneModelFallback) {
      llmSceneResponse = await llmClient.callLLM(sceneModelFallback, promptToUse, {
        role: 'narrative',
        timeout: 120000,
        max_tokens: Number(process.env.LLM_SCENE_MAX_TOKENS || 1400),
        temperature: Number(process.env.LLM_SCENE_TEMPERATURE || 0.8)
      });
    }

    return llmSceneResponse;
  };

  try {
    let activePrompt = scenePrompt;
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const llmSceneResponse = await callSceneModelWithFallback(activePrompt);
      const responseText = llmSceneResponse && llmSceneResponse.response ? String(llmSceneResponse.response) : '';
      if (!responseText) {
        throw new Error('Empty LLM scene response');
      }

      console.log(`📝 LLM Response (${responseText.length} chars)`);
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }

      const candidate = JSON.parse(jsonMatch[0]);
      if (!candidate.scene || !candidate.options || !Array.isArray(candidate.options)) {
        throw new Error('Invalid scene structure from LLM');
      }

      const quality = assessSingleSceneNarrativeQuality(candidate);
      if (quality.ok || attempt === maxAttempts) {
        sceneJson = candidate;
        if (!quality.ok) {
          console.warn(`[Scene Generation Attempt ${attempt}/${maxAttempts}] Quality gate failed, using last attempt: ${quality.issues.join(' | ')}`);
        }
        break;
      }

      console.warn(`[Scene Generation Attempt ${attempt}/${maxAttempts}] Quality gate failed: ${quality.issues.join(' | ')}`);
      activePrompt = buildSceneRescuePrompt(scenePrompt, quality);
    }
  } catch (genErr) {
    console.error('❌ Scene generation failed:', genErr.message);
    throw new Error(`Scene generation failed: ${genErr.message}`);
  }

  // 🔍 STEP 10: Validate generated scene
  if (!sceneJson.scene || !sceneJson.options || !Array.isArray(sceneJson.options)) {
    throw new Error('Invalid scene structure from LLM');
  }

  const generatedScene = sceneJson.scene;
  let generatedOptions = Array.isArray(sceneJson.options) ? sceneJson.options : [];

  const ruleResult = applyOptionRulesToScene(generatedOptions, {
    phq9Score: Number.isFinite(Number(scores?.phq_total)) ? Number(scores.phq_total) / 27 : 0
  });
  generatedOptions = ruleResult.options || generatedOptions;

  for (const opt of generatedOptions) {
    const text = `${opt.option_text || ''} ${opt.consequence || ''}`.toLowerCase();
    const gdsConf = maxMappingConfidence(opt.gds_mapping || []);
    const phqConf = maxMappingConfidence(opt.phq_mapping || []);
    const shouldPatch = (gdsConf < 0.65 && phqConf < 0.65)
      || ((!opt.gds_mapping || !opt.gds_mapping.length) && (!opt.phq_mapping || !opt.phq_mapping.length));
    if (!shouldPatch) continue;

    if (text.includes('casa') || text.includes('evitar') || text.includes('aisla') || text.includes('quedarme')) {
      opt.gds_mapping = [{ item: 9, weight: 0.8, confidence: 0.9, primary_construct: 'social_withdrawal', rationale: 'Regla: evitacion/aislamiento social', mapping_source: 'rule' }];
    } else if (text.includes('salir') || text.includes('amig') || text.includes('llamar') || text.includes('aceptar')) {
      opt.gds_mapping = [{ item: 2, weight: 0.7, confidence: 0.85, primary_construct: 'activity_engagement', rationale: 'Regla: activacion social', mapping_source: 'rule' }];
    } else if (text.includes('cans') || text.includes('energia') || text.includes('agot')) {
      opt.phq_mapping = [{ item: 4, weight: 0.75, confidence: 0.9, primary_construct: 'fatigue_low_energy', rationale: 'Regla: baja energia', mapping_source: 'rule' }];
    } else if (text.includes('culpa') || text.includes('inutil') || text.includes('fracaso')) {
      opt.phq_mapping = [{ item: 6, weight: 0.75, confidence: 0.88, primary_construct: 'self_worth', rationale: 'Regla: autovaloracion negativa', mapping_source: 'rule' }];
    }
  }

  // 🔍 STEP 11: Persist scene to database
  await insertSceneWithSchemaFallback({
    scene_id: generatedScene.scene_id,
    chapter_id: chapter_id,
    order: Number(generatedScene.order) || (Number(scene_order) + 1),
    hero_stage: currentHeroStage,
    type: generatedScene.type || 'playable',
    title: generatedScene.title || generatedScene.scene_id,
    text: generatedScene.text,
    emotional_direction: generatedScene.emotional_direction,
    clinical_priority: generatedScene.clinical_priority,
    raw_scene: generatedScene
  });

  // 🔍 STEP 12: Persist options to database
  const optionsToInsert = generatedOptions.map(opt => ({
    option_id: opt.option_id,
    scene_id: generatedScene.scene_id,
    option_text: opt.option_text,
    consequence: opt.consequence,
    next_chapter_id: opt.next_chapter_id || null,
    next_scene_id: opt.next_scene_id || null,
    gds_mapping: Array.isArray(opt.gds_mapping) ? opt.gds_mapping : [],
    metadata: {
      phq_mapping: Array.isArray(opt.phq_mapping) ? opt.phq_mapping : [],
      risk_flag: opt.risk_flag || null,
      generated_by: 'scene_by_scene_llm',
      generated_at: new Date().toISOString(),
      rule_summary: ruleResult.summary || null
    },
    raw_mapping: opt
  }));
  if (optionsToInsert.length > 0) {
    await upsertOptionsWithSchemaFallback(optionsToInsert);
  }

  // 🔍 STEP 13: Persist clinical mappings for each option
  for (const option of generatedOptions) {
    const clinicalMappings = [];

    // GDS mappings
    if (option.gds_mapping && Array.isArray(option.gds_mapping)) {
      for (const gdsMap of option.gds_mapping) {
        clinicalMappings.push({
          mapping_id: uuidv4(),
          option_id: option.option_id,
          decision_id: null,
          scale: 'GDS',
          item: gdsMap.item,
          weight: gdsMap.weight || 0.5,
          confidence: gdsMap.confidence || 0.75,
          primary_construct: gdsMap.primary_construct || null,
          rationale: gdsMap.rationale || null,
          mapping_source: normalizeClinicalMappingSource(gdsMap.mapping_source, 'llm'),
          source_confidence: normalizeUnitScore(gdsMap.source_confidence || gdsMap.confidence, 0.75),
          validated: false
        });
      }
    }

    // PHQ mappings
    if (option.phq_mapping && Array.isArray(option.phq_mapping)) {
      for (const phqMap of option.phq_mapping) {
        clinicalMappings.push({
          mapping_id: uuidv4(),
          option_id: option.option_id,
          decision_id: null,
          scale: 'PHQ',
          item: phqMap.item,
          weight: phqMap.weight || 0.5,
          confidence: phqMap.confidence || 0.75,
          primary_construct: phqMap.primary_construct || null,
          rationale: phqMap.rationale || null,
          mapping_source: normalizeClinicalMappingSource(phqMap.mapping_source, 'llm'),
          source_confidence: normalizeUnitScore(phqMap.source_confidence || phqMap.confidence, 0.75),
          validated: false
        });
      }
    }

    if (clinicalMappings.length > 0) {
      const { error: mapErr } = await supabase.from('clinical_mappings').insert(clinicalMappings);
      if (mapErr) throw mapErr;
    }
  }

  // 🔍 STEP 14: Write to cache for future reuse
  // Quality score = average confidence * average weight (0.0-1.0)
  const qualityScore = generatedOptions.length > 0
    ? (generatedOptions.reduce((sum, o) => sum + (o.confidence || 0.75) * (o.weight || 0.5), 0) / generatedOptions.length)
    : 0.5;

  const { error: cacheWriteErr } = await supabase.from('narrative_path_cache').insert([{
    path_key: pathKey,
    clinical_segment: clinicalLevel,
    chapter_id: chapter_id,
    scene_order: scene_order,
    stored_scene: generatedScene,
    stored_options: generatedOptions,
    quality_score: Math.max(0, Math.min(1, qualityScore)),
    created_at: new Date().toISOString()
  }]);

  if (cacheWriteErr) {
    console.warn('⚠️ Cache write failed:', cacheWriteErr.message);
    // Don't throw - scene generation succeeded, cache write is optional
  } else {
    console.log(`💾 Scene cached with quality_score=${qualityScore.toFixed(2)}`);
  }

  console.log(`✅ SCENE GENERATED: ${generatedScene.scene_id} (${generatedOptions.length} options)`);
  return generatedScene;
}

function assessChapterNarrativeQuality(generatedChapter) {
  const issues = [];
  const scenes = Array.isArray(generatedChapter && generatedChapter.scenes) ? generatedChapter.scenes : [];
  if (!scenes.length) return { ok: false, issues: ['No scenes found'] };

  const playable = scenes.filter(s => String(s && s.type || '').toLowerCase() === 'playable');
  const narrated = scenes.filter(s => String(s && s.type || '').toLowerCase() === 'narrated');

  if (playable.length < 7) issues.push(`Expected at least 7 playable scenes, got ${playable.length}`);
  if (narrated.length < 5) issues.push(`Expected at least 5 narrated scenes, got ${narrated.length}`);

  let flatListCount = 0;
  let shortSceneCount = 0;
  let weakOptionSetCount = 0;
  let mixedLanguageArtifacts = 0;
  let boilerplateSceneCount = 0;
  let repeatedSceneTextCount = 0;
  let genericConsequenceCount = 0;
  const enumPattern = /\buno\s*[\.:]|\bdos\s*[\.:]|\btres\s*[\.:]/i;
  const englishLeakPattern = /\b(still|however|meanwhile|support\s+group|group\s+support|daily\s+routine)\b/i;
  const malformedJoinPattern = /[a-záéíóúñ]+[A-Z][a-z]/;
  const boilerplateScenePattern = /rosa\s+avanza\s+un\s+paso\s+mas\s+en\s+su\s+proceso|el\s+entorno\s+responde\s+con\s+un\s+detalle\s+concreto|surge\s+una\s+pregunta\s+interna/i;
  const genericConsequencePattern = /rosa\s+toma\s+esta\s+decision\s+y\s+observa\s+un\s+cambio\s+inmediato|la\s+situacion\s+gana\s+matices/i;
  const sceneFingerprints = new Set();

  for (const sc of scenes) {
    const text = String(sc && sc.text || '').trim();
    if (!text) {
      shortSceneCount += 1;
      continue;
    }
    if (text.length < 120) shortSceneCount += 1;
    if (enumPattern.test(text)) flatListCount += 1;
    if (englishLeakPattern.test(text) || malformedJoinPattern.test(text)) mixedLanguageArtifacts += 1;
    if (boilerplateScenePattern.test(text)) boilerplateSceneCount += 1;

    const sceneFingerprint = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (sceneFingerprint) {
      if (sceneFingerprints.has(sceneFingerprint)) repeatedSceneTextCount += 1;
      else sceneFingerprints.add(sceneFingerprint);
    }

    if (String(sc && sc.type || '').toLowerCase() === 'playable') {
      const opts = Array.isArray(sc.options) ? sc.options : [];
      if (opts.length !== 3) {
        weakOptionSetCount += 1;
        continue;
      }

      const optionTexts = opts.map(o => String(o && o.option_text || '').trim().toLowerCase()).filter(Boolean);
      const uniqueCount = new Set(optionTexts).size;
      const genericCount = optionTexts.filter(t => /^opci[oó]n\s*\d+$/i.test(t) || /^responder\s*\d+$/i.test(t) || /^continuar$/i.test(t)).length;
      if (uniqueCount < 3 || genericCount > 0) weakOptionSetCount += 1;

      for (const opt of opts) {
        const consequence = String(opt && opt.consequence || '').trim();
        if (!consequence || genericConsequencePattern.test(consequence)) {
          genericConsequenceCount += 1;
        }
      }
    }
  }

  if (flatListCount > 0) issues.push(`Detected flat list narration in ${flatListCount} scene(s)`);
  if (shortSceneCount > 3) issues.push(`Too many short/empty scenes (${shortSceneCount})`);
  if (weakOptionSetCount > 0) issues.push(`Weak playable option sets in ${weakOptionSetCount} scene(s)`);
  if (mixedLanguageArtifacts > 0) issues.push(`Mixed-language or malformed text artifacts in ${mixedLanguageArtifacts} scene(s)`);
  if (boilerplateSceneCount > 0) issues.push(`Boilerplate scene text detected in ${boilerplateSceneCount} scene(s)`);
  if (repeatedSceneTextCount > 0) issues.push(`Repeated scene prose detected in ${repeatedSceneTextCount} scene(s)`);
  if (genericConsequenceCount > 0) issues.push(`Generic consequences detected in ${genericConsequenceCount} option(s)`);

  return {
    ok: issues.length === 0,
    issues,
    metrics: {
      scenes: scenes.length,
      playable: playable.length,
      narrated: narrated.length,
      flat_list_scenes: flatListCount,
      short_scene_count: shortSceneCount,
      weak_option_sets: weakOptionSetCount,
      mixed_language_artifacts: mixedLanguageArtifacts,
      boilerplate_scene_count: boilerplateSceneCount,
      repeated_scene_text_count: repeatedSceneTextCount,
      generic_consequence_count: genericConsequenceCount
    }
  };
}

function buildChapterRescuePrompt(basePrompt, qualityReport) {
  const issues = qualityReport && Array.isArray(qualityReport.issues) ? qualityReport.issues : [];
  const issueBlock = issues.length ? issues.map(x => `- ${x}`).join('\n') : '- Salida no cumple estándar narrativo';
  return `${basePrompt}\n\nCORRECCION OBLIGATORIA (SEGUNDO INTENTO):\nLa salida anterior fue rechazada por baja calidad narrativa.\nProblemas detectados:\n${issueBlock}\n\nDebes corregir especificamente:\n1) PROHIBIDO escribir enumeraciones en scene.text (nunca usar "uno.", "dos.", "tres.").\n2) Scene text con prosa inmersiva (minimo 120 caracteres por escena, ideal 150-260).\n3) Cada escena playable debe tener exactamente 3 opciones distintas y no genéricas.\n4) Consequences deben ser narrativas y coherentes con la opción elegida.\n5) TODO el contenido debe estar en ESPAÑOL neutro. Prohibido mezclar inglés o tokens como "Still", "however", etc.\n6) Mantén consistencia personaje-acción: si la opción es "mantener rutina", la consecuencia no puede narrar "acercarse a la vecina".\n\nRESPONDE SOLO JSON valido.`;
}

async function bootstrapNextChapterFromScene(session_id, nextChapterId) {
  if (!session_id || !nextChapterId) return null;
  try {
    const nextNum = parseInt(String(nextChapterId).substring(1)) || null;
    const chapterRow = {
      chapter_id: nextChapterId,
      title: `Capítulo ${nextNum || ''}`.trim(),
      order: nextNum || null,
      metadata: {
        generated_by: 'scene_by_scene_fallback',
        generated_at: new Date().toISOString()
      }
    };

    await supabase
      .from('chapters')
      .upsert([chapterRow], { onConflict: 'chapter_id' });

    // scene_order=0 makes the scene prompt target s01 in the response contract.
    await generateNextSceneForSession(session_id, nextChapterId, 0);
    const hydrated = await hydrateChapterFromDb(nextChapterId);
    if (hydrated && chapterNamespaceLooksValid(hydrated)) {
      return hydrated;
    }
  } catch (e) {
    console.warn('bootstrapNextChapterFromScene failed', e && e.message ? e.message : e);
  }
  return null;
}

function parseSceneOrderFromId(sceneId) {
  const m = String(sceneId || '').match(/-s(\d{1,2})$/i);
  return m ? Number(m[1]) : null;
}

function parseLlmJsonWithRecovery(rawResponse) {
  const asObject = extractJsonObject(rawResponse);
  if (asObject) return asObject;

  try {
    const cleanedResponse = String(rawResponse || '').trim();
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : cleanedResponse;
    return JSON.parse(jsonStr);
  } catch (parseErr) {
    try {
      const repaired = String(rawResponse || '')
        .trim()
        .replace(/[\r\n]+/g, ' ')
        .replace(/,\s*]/g, ']')
        .replace(/,\s*}/g, '}');
      return JSON.parse(repaired);
    } catch (repairErr) {
      if (jsonRepair) {
        try {
          const repairedByLibrary = jsonRepair(String(rawResponse || '').trim());
          return JSON.parse(repairedByLibrary);
        } catch (_jsonRepairErr) {
          throw new Error(`failed to parse LLM JSON: ${parseErr.message}`);
        }
      }
      throw new Error(`failed to parse LLM JSON: ${repairErr && repairErr.message ? repairErr.message : parseErr.message}`);
    }
  }
}

function buildWeeklyGenerationRescuePrompt(basePrompt, issues = [], expectedChapterCount = 7) {
  const issueBlock = (Array.isArray(issues) && issues.length)
    ? issues.map(i => `- ${i}`).join('\n')
    : '- Estructura semanal incompleta';

  return `${basePrompt}\n\nCORRECCION OBLIGATORIA (REINTENTO):\nLa salida anterior fue rechazada.\nProblemas detectados:\n${issueBlock}\n\nDebes corregir especificamente:\n1) Entregar EXACTAMENTE ${expectedChapterCount} capitulos en chapters[].\n2) Cada capitulo debe tener EXACTAMENTE 12 escenas.\n3) Escenas jugables: orden 1,3,5,6,8,10,12 con EXACTAMENTE 3 opciones.\n4) IDs canonicos: cNN-sMM y cNN-sMM-oK.\n5) Consequence de cada opcion: exactamente 3 oraciones y coherente con option_text.\n6) Responder SOLO JSON valido.`;
}

function normalizeWeeklyChapter(rawChapter, expectedChapterId, expectedOrder, nextChapterId = null) {
  const playableOrders = new Set([1, 3, 5, 6, 8, 10, 12]);
  const sourceScenes = Array.isArray(rawChapter && rawChapter.scenes) ? rawChapter.scenes : [];

  const byOrder = new Map();
  for (const scene of sourceScenes) {
    const order = Number(scene && scene.order) || parseSceneOrderFromId(scene && scene.scene_id);
    if (order >= 1 && order <= 12 && !byOrder.has(order)) {
      byOrder.set(order, scene || {});
    }
  }

  const sceneRows = [];
  for (let order = 1; order <= 12; order += 1) {
    const rawScene = byOrder.get(order) || sourceScenes[order - 1] || {};
    const sceneId = `${expectedChapterId}-s${String(order).padStart(2, '0')}`;
    const isPlayable = playableOrders.has(order);
    const type = isPlayable ? 'playable' : 'narrated';

    let options = [];
    if (isPlayable) {
      const sourceOptions = Array.isArray(rawScene && rawScene.options) ? rawScene.options : [];
      options = sourceOptions.slice(0, 3).map((opt, idx) => {
        const optionId = `${sceneId}-o${idx + 1}`;
        const optionText = String(opt && opt.option_text || '').trim();
        const consequence = String(opt && opt.consequence || '').trim();
        const nextSceneId = order < 12 ? `${expectedChapterId}-s${String(order + 1).padStart(2, '0')}` : null;
        const rawGds = Array.isArray(opt && opt.gds_mapping) ? opt.gds_mapping : [];
        const rawPhq = Array.isArray(opt && opt.phq_mapping) ? opt.phq_mapping : [];

        return {
          option_id: optionId,
          option_text: optionText,
          consequence,
          next_scene_id: nextSceneId,
          next_chapter_id: order === 12 ? (nextChapterId || null) : null,
          gds_mapping: rawGds,
          phq_mapping: rawPhq,
          risk_flag: opt && opt.risk_flag ? opt.risk_flag : null,
          metadata: Object.assign({}, (opt && opt.metadata) || {})
        };
      });

      while (options.length < 3) {
        const idx = options.length;
        options.push({
          option_id: `${sceneId}-o${idx + 1}`,
          option_text: '',
          consequence: '',
          next_scene_id: order < 12 ? `${expectedChapterId}-s${String(order + 1).padStart(2, '0')}` : null,
          next_chapter_id: order === 12 ? (nextChapterId || null) : null,
          gds_mapping: [],
          phq_mapping: [],
          risk_flag: null,
          metadata: {}
        });
      }
    }

    const rawSceneText = String(rawScene && rawScene.text || '').trim();
    const normalizedSceneText = rawSceneText;

    sceneRows.push({
      scene_id: sceneId,
      type,
      order,
      title: String(rawScene && rawScene.title || '').trim() || `Escena ${order}`,
      text: normalizedSceneText,
      emotional_beat: String(rawScene && rawScene.emotional_beat || '').trim() || 'progreso_tensionado',
      hero_stage: String(rawScene && rawScene.hero_stage || '').trim() || null,
      options
    });
  }

  return {
    chapter_id: expectedChapterId,
    title: String(rawChapter && rawChapter.title || '').trim() || `Capitulo ${expectedOrder}`,
    order: Number(rawChapter && rawChapter.order) || expectedOrder,
    continuity_state: rawChapter && rawChapter.continuity_state ? rawChapter.continuity_state : null,
    arc_transition: rawChapter && rawChapter.arc_transition ? rawChapter.arc_transition : null,
    scenes: sceneRows
  };
}

function summarizeGeneratedChapter(chapter = {}) {
  const scenes = Array.isArray(chapter.scenes) ? chapter.scenes : [];
  const firstPlayable = scenes.find(s => String(s && s.type || '').toLowerCase() === 'playable') || scenes[0] || null;
  const firstOptions = firstPlayable && Array.isArray(firstPlayable.options)
    ? firstPlayable.options.slice(0, 3)
    : [];

  return {
    chapter_id: chapter.chapter_id || null,
    title: chapter.title || null,
    order: chapter.order || null,
    scene_count: scenes.length,
    first_scene: firstPlayable ? {
      scene_id: firstPlayable.scene_id,
      title: firstPlayable.title || null,
      text: firstPlayable.text || null
    } : null,
    options: firstOptions.map(o => ({
      option_id: o.option_id,
      option_text: o.option_text,
      consequence: o.consequence,
      gds_mapping: o.gds_mapping || [],
      phq_mapping: o.phq_mapping || []
    }))
  };
}

async function clearChapterGeneratedContent(chapterId) {
  if (!chapterId) return;
  try {
    const { data: existingScenes, error: existingScenesErr } = await supabase
      .from('scenes')
      .select('scene_id')
      .eq('chapter_id', chapterId);
    if (existingScenesErr) throw existingScenesErr;

    const sceneIds = (existingScenes || []).map(s => s.scene_id).filter(Boolean);
    if (sceneIds.length) {
      const { error: delOptionsErr } = await supabase
        .from('options')
        .delete()
        .in('scene_id', sceneIds);
      if (delOptionsErr) throw delOptionsErr;

      const { error: delScenesErr } = await supabase
        .from('scenes')
        .delete()
        .eq('chapter_id', chapterId);
      if (delScenesErr) throw delScenesErr;
    }
  } catch (cleanupErr) {
    console.warn('weekly chapter cleanup warning', chapterId, cleanupErr && cleanupErr.message ? cleanupErr.message : cleanupErr);
  }
}

async function generateChapterSceneBySceneFallback(session_id, chapterId) {
  if (!session_id || !chapterId) throw new Error('session_id and chapterId required for scene fallback');

  const chapterOrder = parseInt(String(chapterId).replace('c', ''), 10) || null;
  await supabase
    .from('chapters')
    .upsert([{
      chapter_id: chapterId,
      title: `Capitulo ${chapterOrder || ''}`.trim(),
      order: chapterOrder,
      metadata: {
        generated_by: 'scene_by_scene_weekly_fallback',
        generated_at: new Date().toISOString()
      }
    }], { onConflict: 'chapter_id' });

  await clearChapterGeneratedContent(chapterId);

  for (let sceneOrder = 0; sceneOrder < 12; sceneOrder += 1) {
    await generateNextSceneForSession(session_id, chapterId, sceneOrder);
  }

  const chapter = await hydrateChapterFromDb(chapterId);
  if (!chapter) throw new Error(`scene fallback generated no chapter for ${chapterId}`);

  const quality = assessChapterNarrativeQuality(chapter);
  if (!quality.ok) {
    throw new Error(`scene fallback quality failed for ${chapterId}: ${(quality.issues || []).join('; ')}`);
  }

  return chapter;
}

async function generateNextWeekForSession(session_id, chapter_id = null, options = {}) {
  if (!llmClient || !prompts) throw new Error('LLM service not available');
  if (!session_id) throw new Error('session_id required');

  const { data: session, error: sessErr } = await supabase
    .from('sessions')
    .select('*')
    .eq('session_id', session_id)
    .single();
  if (sessErr || !session) throw new Error('session not found');

  const currentChapterId = chapter_id || session.chapter_id || 'c01';
  const currentNum = parseInt(String(currentChapterId).replace('c', ''), 10) || 1;
  const chapterCount = Math.max(1, Number(options.chapter_count || WEEK_CHAPTER_COUNT || 7));
  const explicitStartChapterId = options.start_chapter_id ? String(options.start_chapter_id) : null;
  const parsedStartNum = explicitStartChapterId && /^c\d+$/i.test(explicitStartChapterId)
    ? (parseInt(explicitStartChapterId.substring(1), 10) || null)
    : null;
  const startChapterNum = parsedStartNum || (currentNum + 1);
  const targetChapterIds = Array.from({ length: chapterCount }, (_, idx) => `c${String(startChapterNum + idx).padStart(2, '0')}`);
  const chapterBatchSize = Math.max(1, Number(options.batch_chapter_count || process.env.WEEK_CHAPTERS_PER_LLM_CALL || 1));
  const chapterBatches = [];
  for (let idx = 0; idx < targetChapterIds.length; idx += chapterBatchSize) {
    chapterBatches.push(targetChapterIds.slice(idx, idx + chapterBatchSize));
  }
  const triggerSource = String(options.trigger_source || 'unknown');
  const scenesPerChapter = 12;
  const expectedTotalScenes = chapterCount * scenesPerChapter;
  const generationStartedAt = Date.now();

  console.log('[WEEKLY GEN START]', {
    source: triggerSource,
    session_id,
    current_chapter_id: currentChapterId,
    from_chapter_id: targetChapterIds[0] || null,
    to_chapter_id: targetChapterIds[targetChapterIds.length - 1] || null,
    chapter_count: chapterCount,
    chapter_batch_size: chapterBatchSize,
    llm_call_batches: chapterBatches.length,
    scenes_per_chapter: scenesPerChapter,
    expected_total_scenes: expectedTotalScenes,
    update_session_chapter: options.update_session_chapter !== false
  });

  const { data: decisions, error: decErr } = await supabase
    .from('decisions')
    .select('*')
    .eq('session_id', session_id)
    .order('timestamp', { ascending: true });
  if (decErr) throw decErr;

  const { data: scores, error: scoreErr } = await supabase
    .from('session_scores')
    .select('*')
    .eq('session_id', session_id)
    .maybeSingle();
  if (scoreErr && scoreErr.code !== 'PGRST116') throw scoreErr;

  const clinicalScores = scores
    ? { gds15: Number((scores.gds_total || 0) / 15), phq9: Number((scores.phq_total || 0) / 27) }
    : {};
  const decisionContext = (decisions || []).slice(-8).map(d => ({
    option_text: d.option_text,
    consequence: (d.raw_mapping && d.raw_mapping.consequence)
      ? d.raw_mapping.consequence
      : (d.consequence || 'Consecuencia registrada')
  }));

  const providerInfoAtStart = llmClient.getProviderInfo ? llmClient.getProviderInfo() : {};
  const primaryNarrativeProvider = providerInfoAtStart.narrative_provider || providerInfoAtStart.provider || null;
  const narrativeModel = process.env.LLM_NARRATIVE_MODEL || process.env.LLM_GENERATOR_MODEL || 'orca-mini';
  const narrativeModelFallback = process.env.LLM_NARRATIVE_MODEL_FALLBACK;
  const fallbackNarrativeProvider = process.env.LLM_PROVIDER_NARRATIVE_FALLBACK || null;
  const weekMaxTokens = Math.max(1800, Number(process.env.LLM_WEEK_MAX_TOKENS || 3200));
  const weekTemperature = Number(process.env.LLM_WEEK_TEMPERATURE || 0.7);
  const maxAttempts = Math.max(1, Number(process.env.LLM_WEEK_MAX_ATTEMPTS || 2));

  const normalizedPrimaryProvider = String(primaryNarrativeProvider || '').toLowerCase();
  const normalizedFallbackProvider = String(fallbackNarrativeProvider || '').toLowerCase();
  const canTryCrossProviderFallback = !!(normalizedFallbackProvider && normalizedFallbackProvider !== normalizedPrimaryProvider);
  const canTrySameProviderFallbackModel = !!(narrativeModelFallback && (!normalizedFallbackProvider || normalizedFallbackProvider === normalizedPrimaryProvider));

  const callCrossProviderFallback = async (promptToUse) => {
    if (!canTryCrossProviderFallback) return null;

    const crossProviderResponse = await llmClient.callModelsAcrossProviders(promptToUse, {
      providers: [{
        name: fallbackNarrativeProvider,
        models: narrativeModelFallback ? [narrativeModelFallback] : undefined
      }],
      timeout: 600000,
      max_tokens: weekMaxTokens,
      temperature: weekTemperature
    });

    const crossResults = crossProviderResponse && crossProviderResponse.results
      ? crossProviderResponse.results
      : {};
    const successful = Object.entries(crossResults).find(([, result]) => result && result.response);
    if (successful) {
      const [key, result] = successful;
      const keyParts = String(key || '').split(':');
      return {
        response: result.response,
        provider: result.provider || keyParts[0] || fallbackNarrativeProvider,
        model: result.model || (keyParts.length > 1 ? keyParts.slice(1).join(':') : narrativeModelFallback || null),
        time_ms: result.time_ms || null
      };
    }

    const fallbackError = Object.values(crossResults).find(r => r && r.error);
    throw new Error(fallbackError && fallbackError.error
      ? `fallback provider ${fallbackNarrativeProvider} failed: ${fallbackError.error}`
      : `fallback provider ${fallbackNarrativeProvider} returned empty response`);
  };

  const callNarrativeWithFallback = async (promptToUse) => {
    const errors = [];

    try {
      const primaryResponse = await llmClient.callLLM(narrativeModel, promptToUse, {
        role: 'narrative',
        timeout: 600000,
        max_tokens: weekMaxTokens,
        temperature: weekTemperature
      });

      if (primaryResponse && primaryResponse.response) {
        return primaryResponse;
      }

      errors.push(primaryResponse && primaryResponse.error
        ? `primary narrative failed: ${primaryResponse.error}`
        : 'primary narrative returned empty response');
    } catch (err) {
      errors.push(`primary narrative failed: ${err && err.message ? err.message : err}`);
    }

    if (canTryCrossProviderFallback) {
      try {
        const fallbackResponse = await callCrossProviderFallback(promptToUse);
        if (fallbackResponse && fallbackResponse.response) {
          return fallbackResponse;
        }
      } catch (crossErr) {
        errors.push(`fallback provider ${fallbackNarrativeProvider} failed: ${crossErr && crossErr.message ? crossErr.message : crossErr}`);
      }
    }

    if (canTrySameProviderFallbackModel) {
      try {
        const fallbackResponse = await llmClient.callLLM(narrativeModelFallback, promptToUse, {
          role: 'narrative',
          timeout: 600000,
          max_tokens: weekMaxTokens,
          temperature: weekTemperature
        });

        if (fallbackResponse && fallbackResponse.response) {
          return fallbackResponse;
        }

        errors.push(fallbackResponse && fallbackResponse.error
          ? `fallback narrative model failed: ${fallbackResponse.error}`
          : 'fallback narrative model returned empty response');
      } catch (fallbackErr) {
        errors.push(`fallback narrative model failed: ${fallbackErr && fallbackErr.message ? fallbackErr.message : fallbackErr}`);
      }
    }

    throw new Error(errors.length
      ? errors.join(' | ')
      : 'LLM weekly generation produced no response from all providers');
  };

  let generatedWeek = null;
  let llmMeta = null;
  let lastGenerationError = null;
  let effectiveTargetChapterIds = [...targetChapterIds];
  const generatedChapterBuffer = [];
  let chapterAnchorForPrompt = currentChapterId;

  try {
    for (let batchIdx = 0; batchIdx < chapterBatches.length; batchIdx += 1) {
      const batchChapterIds = chapterBatches[batchIdx] || [];
      if (!batchChapterIds.length) continue;

      const promptPayload = prompts.buildWeeklyChapterGenerationPrompt({
        current_chapter_id: chapterAnchorForPrompt,
        chapter_ids: batchChapterIds,
        chapter_count: batchChapterIds.length,
        session_decisions: decisionContext,
        clinical_scores: clinicalScores,
        session_context: {
          age: session.metadata && session.metadata.age ? session.metadata.age : null,
          severity: 'moderate',
          batch_index: batchIdx + 1,
          batch_total: chapterBatches.length
        }
      });

      let activePrompt = promptPayload.prompt;
      let batchNormalized = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          console.log('[WEEKLY GEN ATTEMPT]', {
            source: triggerSource,
            attempt,
            max_attempts: maxAttempts,
            batch_index: batchIdx + 1,
            batch_count: chapterBatches.length,
            chapter_count: batchChapterIds.length,
            from_chapter_id: batchChapterIds[0] || null,
            to_chapter_id: batchChapterIds[batchChapterIds.length - 1] || null
          });

          const llmResponse = await callNarrativeWithFallback(activePrompt);
          llmMeta = llmResponse || llmMeta;
          let candidate = null;

          try {
            candidate = parseLlmJsonWithRecovery(llmResponse.response);
          } catch (parseErr) {
            if (canTryCrossProviderFallback) {
              console.warn(`[Weekly Generation] parse failed on primary response; retrying parse with fallback provider ${fallbackNarrativeProvider}`);
              const fallbackParsedResponse = await callCrossProviderFallback(activePrompt);
              if (fallbackParsedResponse && fallbackParsedResponse.response) {
                llmMeta = fallbackParsedResponse;
                candidate = parseLlmJsonWithRecovery(fallbackParsedResponse.response);
              } else {
                throw parseErr;
              }
            } else {
              throw parseErr;
            }
          }

          if (!candidate || !Array.isArray(candidate.chapters)) {
            throw new Error('invalid weekly response: expected object with chapters[]');
          }
          if (candidate.chapters.length !== batchChapterIds.length) {
            throw new Error(`expected ${batchChapterIds.length} chapters, got ${candidate.chapters.length}`);
          }

          const normalizedBatch = batchChapterIds.map((chapterId, idx) => {
            const chapterRaw = candidate.chapters[idx] || {};
            const globalIdx = targetChapterIds.indexOf(chapterId);
            const nextChapterId = (globalIdx >= 0 && globalIdx < targetChapterIds.length - 1)
              ? targetChapterIds[globalIdx + 1]
              : null;
            const chapterOrder = parseInt(String(chapterId).replace('c', ''), 10) || (startChapterNum + Math.max(0, globalIdx));
            const normalized = normalizeWeeklyChapter(chapterRaw, chapterId, chapterOrder, nextChapterId);
            if (!Array.isArray(normalized.scenes) || normalized.scenes.length !== 12) {
              throw new Error(`chapter ${chapterId} does not contain 12 scenes`);
            }
            return normalized;
          });

          const batchQualityIssues = [];
          for (const chapter of normalizedBatch) {
            const quality = assessChapterNarrativeQuality(chapter);
            if (!quality.ok) {
              batchQualityIssues.push(`${chapter.chapter_id}: ${(quality.issues || []).join('; ')}`);
            }
          }
          if (batchQualityIssues.length) {
            throw new Error(`quality gate failed: ${batchQualityIssues.join(' | ')}`);
          }

          batchNormalized = normalizedBatch;
          break;
        } catch (attemptErr) {
          lastGenerationError = attemptErr;
          console.warn(`[Weekly Generation Attempt ${attempt}/${maxAttempts}] ${attemptErr.message}`);
          if (attempt < maxAttempts) {
            activePrompt = buildWeeklyGenerationRescuePrompt(promptPayload.prompt, [attemptErr.message], batchChapterIds.length);
          }
        }
      }

      if (!batchNormalized || !batchNormalized.length) {
        throw new Error(lastGenerationError ? lastGenerationError.message : `weekly generation failed for batch ${batchIdx + 1}`);
      }

      generatedChapterBuffer.push(...batchNormalized);
      chapterAnchorForPrompt = batchChapterIds[batchChapterIds.length - 1];
    }

    generatedWeek = {
      week_summary: {
        from_chapter: targetChapterIds[0] || null,
        to_chapter: targetChapterIds[targetChapterIds.length - 1] || null,
        chapter_count: chapterCount,
        continuity_anchor: `weekly_batch_${chapterBatches.length}`
      },
      chapters: generatedChapterBuffer
    };
    generatedWeek = applyDeterministicClinicalRules(generatedWeek, { phq9Score: Number(clinicalScores.phq9 || 0) });
  } catch (weeklyErr) {
    lastGenerationError = weeklyErr;
  }

  if (!generatedWeek) {
    const sceneFallbackChapters = Math.max(0, Number(process.env.WEEKLY_SCENE_FALLBACK_CHAPTERS || 1));
    if (sceneFallbackChapters > 0) {
      const fallbackChapterIds = targetChapterIds.slice(0, sceneFallbackChapters);
      const fallbackGenerated = [];
      try {
        console.warn('[WEEKLY GEN] entering scene-by-scene fallback', {
          source: triggerSource,
          session_id,
          requested_chapters: chapterCount,
          fallback_chapters: fallbackChapterIds,
          root_error: lastGenerationError ? lastGenerationError.message : 'unknown error'
        });

        for (const fallbackChapterId of fallbackChapterIds) {
          const chapter = await generateChapterSceneBySceneFallback(session_id, fallbackChapterId);
          fallbackGenerated.push(chapter);
        }

        if (fallbackGenerated.length) {
          generatedWeek = {
            week_summary: {
              from_chapter: fallbackGenerated[0].chapter_id,
              to_chapter: fallbackGenerated[fallbackGenerated.length - 1].chapter_id,
              chapter_count: fallbackGenerated.length,
              continuity_anchor: 'scene_by_scene_weekly_fallback'
            },
            chapters: fallbackGenerated
          };
          effectiveTargetChapterIds = fallbackGenerated.map(ch => ch.chapter_id).filter(Boolean);
          generatedWeek = applyDeterministicClinicalRules(generatedWeek, { phq9Score: Number(clinicalScores.phq9 || 0) });
          console.warn('[WEEKLY GEN] scene-by-scene fallback succeeded', {
            generated_chapters: effectiveTargetChapterIds.length,
            from_chapter_id: effectiveTargetChapterIds[0] || null,
            to_chapter_id: effectiveTargetChapterIds[effectiveTargetChapterIds.length - 1] || null
          });
        }
      } catch (sceneFallbackErr) {
        lastGenerationError = sceneFallbackErr;
      }
    }

    if (!generatedWeek) {
      console.error('[WEEKLY GEN FAILED]', {
        source: triggerSource,
        session_id,
        from_chapter_id: targetChapterIds[0] || null,
        to_chapter_id: targetChapterIds[targetChapterIds.length - 1] || null,
        chapter_count: chapterCount,
        expected_total_scenes: expectedTotalScenes,
        error: lastGenerationError ? lastGenerationError.message : 'unknown error'
      });
      throw new Error(`LLM weekly generation failed quality/parse checks: ${lastGenerationError ? lastGenerationError.message : 'unknown error'}`);
    }
  }

  for (const chapterId of effectiveTargetChapterIds) {
    await clearChapterGeneratedContent(chapterId);
  }

  const providerInfo = llmClient.getProviderInfo ? llmClient.getProviderInfo() : {};
  const providerName = (llmMeta && llmMeta.provider) || providerInfo.narrative_provider || providerInfo.provider || null;
  const modelUsed = (llmMeta && llmMeta.model) || providerInfo.narrative_model || providerInfo.model || narrativeModel;

  const canonicalPersistence = await persistGeneratedArcContentToCanonical(generatedWeek, {
    arc_id: null,
    arc_day: null,
    provider: providerName,
    model: modelUsed,
    mappingSource: 'hybrid_llm_rule'
  });

  for (const chapterId of effectiveTargetChapterIds) {
    await hydrateChapterFromDb(chapterId);
  }

  const firstChapterId = effectiveTargetChapterIds[0] || targetChapterIds[0];
  let firstChapter = findChapter(firstChapterId);
  if (!firstChapter) firstChapter = await hydrateChapterFromDb(firstChapterId);
  if (!firstChapter) firstChapter = (generatedWeek.chapters || [])[0] || null;

  if (options.update_session_chapter !== false) {
    const { error: updateErr } = await supabase
      .from('sessions')
      .update({ chapter_id: firstChapterId })
      .eq('session_id', session_id);
    if (updateErr) console.warn('session week update warning', updateErr.message || updateErr);
  }

  const generatedChapters = Array.isArray(generatedWeek.chapters) ? generatedWeek.chapters : [];
  const generatedChapterCount = generatedChapters.length;
  let generatedTotalScenes = 0;
  let playableScenes = 0;
  for (const chapter of generatedChapters) {
    const scenes = Array.isArray(chapter && chapter.scenes) ? chapter.scenes : [];
    generatedTotalScenes += scenes.length;
    playableScenes += scenes.filter((s) => String(s && s.type || '').toLowerCase() === 'playable').length;
  }
  const narratedScenes = Math.max(0, generatedTotalScenes - playableScenes);
  const generationDurationMs = Date.now() - generationStartedAt;

  console.log('[WEEKLY GEN DONE]', {
    source: triggerSource,
    session_id,
    from_chapter_id: effectiveTargetChapterIds[0] || null,
    to_chapter_id: effectiveTargetChapterIds[effectiveTargetChapterIds.length - 1] || null,
    generated_chapters: generatedChapterCount,
    requested_chapters: chapterCount,
    generated_total_scenes: generatedTotalScenes,
    expected_total_scenes: expectedTotalScenes,
    playable_scenes: playableScenes,
    narrated_scenes: narratedScenes,
    provider: providerName || 'unknown',
    model: modelUsed || 'unknown',
    duration_ms: generationDurationMs
  });

  return {
    week: {
      start_chapter_id: targetChapterIds[0],
      end_chapter_id: effectiveTargetChapterIds[effectiveTargetChapterIds.length - 1] || targetChapterIds[targetChapterIds.length - 1],
      chapter_count: effectiveTargetChapterIds.length,
      chapter_ids: effectiveTargetChapterIds
    },
    first_chapter: summarizeGeneratedChapter(firstChapter || {}),
    chapters: (generatedWeek.chapters || []).map(ch => summarizeGeneratedChapter(ch)),
    generated_by: providerName,
    model: modelUsed,
    canonical_persistence: canonicalPersistence,
    timestamp: new Date().toISOString()
  };
}

async function generateNextChapterForSession(session_id, chapter_id = null, options = {}) {
  if (!llmClient || !prompts) throw new Error('LLM service not available');
  if (!session_id) throw new Error('session_id required');

  const effectiveChapterCount = Math.max(1, Number(options.chapter_count || WEEK_CHAPTER_COUNT || 7));

  const weeklyResult = await generateNextWeekForSession(session_id, chapter_id, {
    chapter_count: effectiveChapterCount,
    trigger_source: 'generate_next_chapter_flow'
  });

  return {
    chapter: weeklyResult.first_chapter,
    chapter_id: weeklyResult.first_chapter && weeklyResult.first_chapter.chapter_id
      ? weeklyResult.first_chapter.chapter_id
      : null,
    generated_by: weeklyResult.generated_by,
    week: weeklyResult.week,
    timestamp: weeklyResult.timestamp
  };

  // Legacy single-chapter flow retained below for compatibility fallback.

  const { data: session, error: sessErr } = await supabase
    .from('sessions')
    .select('*')
    .eq('session_id', session_id)
    .single();

  if (sessErr || !session) throw new Error('session not found');

  const currentChapterId = chapter_id || session.chapter_id || 'c01';
  const currentNum = parseInt(currentChapterId.substring(1)) || 1;
  const nextChapterId = `c${String(currentNum + 1).padStart(2, '0')}`;

  const { data: decisions, error: decErr } = await supabase
    .from('decisions')
    .select('*')
    .eq('session_id', session_id)
    .order('timestamp', { ascending: true });
  if (decErr) throw decErr;

  const { data: scores, error: scoreErr } = await supabase
    .from('session_scores')
    .select('*')
    .eq('session_id', session_id)
    .single();
  if (scoreErr && scoreErr.code !== 'PGRST116') throw scoreErr;

  const clinicalScores = scores
    ? { gds15: scores.gds_total / 15, phq9: scores.phq_total / 27 }
    : {};
  const decisionContext = (decisions || []).map(d => ({
    option_text: d.option_text,
    consequence: d.raw_mapping?.consequence || 'Consecuencia registrada'
  }));

  const prompt = prompts.buildChapterGenerationPrompt(
    currentChapterId,
    decisionContext,
    clinicalScores,
    { age: session.metadata?.age, severity: 'moderate' }
  );

  const narrativeModel = process.env.LLM_NARRATIVE_MODEL || process.env.LLM_GENERATOR_MODEL || 'orca-mini';
  const narrativeModelFallback = process.env.LLM_NARRATIVE_MODEL_FALLBACK;
  const chapterMaxTokens = Math.max(1800, Number(process.env.LLM_CHAPTER_MAX_TOKENS || Math.max(MAX_OUTPUT_TOKENS, 3600)));
  const chapterTemperature = Number(process.env.LLM_CHAPTER_TEMPERATURE || 0.8);

  const callNarrativeWithFallback = async (promptToUse) => {
    let llmResponse = null;
    try {
      llmResponse = await llmClient.callLLM(narrativeModel, promptToUse, {
        role: 'narrative',
        timeout: 300000,
        max_tokens: chapterMaxTokens,
        temperature: chapterTemperature
      });

      if (!llmResponse || !llmResponse.response) {
        if (narrativeModelFallback) {
          console.warn(`[LLM Fallback] Primary model returned empty response, trying fallback: ${narrativeModelFallback}`);
          llmResponse = await llmClient.callLLM(narrativeModelFallback, promptToUse, {
            role: 'narrative',
            timeout: 300000,
            max_tokens: chapterMaxTokens,
            temperature: chapterTemperature
          });
        }
      }
    } catch (err) {
      if (narrativeModelFallback) {
        console.warn(`[LLM Fallback] Primary provider failed (${err.message}), retrying with fallback: ${narrativeModelFallback}`);
        llmResponse = await llmClient.callLLM(narrativeModelFallback, promptToUse, {
          role: 'narrative',
          timeout: 300000,
          max_tokens: chapterMaxTokens,
          temperature: chapterTemperature
        });
      } else {
        throw new Error(`LLM generation failed: ${err.message || err}`);
      }
    }

    if (!llmResponse || !llmResponse.response) {
      throw new Error('LLM generation produced no response from all providers');
    }
    return llmResponse.response;
  };

  const parseGeneratedChapter = (rawResponse) => {
    try {
      const cleanedResponse = rawResponse.trim();
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      let jsonStr = jsonMatch ? jsonMatch[0] : cleanedResponse;

      jsonStr = jsonStr.replace(/"([^"\\]|\\.)*"/g, (match) => {
        return match
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
      });

      return JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error(`[JSON Parse Error] Response length: ${rawResponse.length}, error at position: ${parseErr.message}`);
      console.error(`[JSON Debug] Last 500 chars: ${rawResponse.slice(-500)}`);

      try {
        let fixed = rawResponse
          .trim()
          .replace(/[\r\n]+/g, ' ')
          .replace(/,\s*]/g, ']')
          .replace(/,\s*}/g, '}');

        const lastBrace = fixed.lastIndexOf('}');
        if (lastBrace > 0 && lastBrace < fixed.length - 1) {
          fixed = fixed.substring(0, lastBrace + 1);
          console.log('[JSON Recovery] Truncated to last valid }');
        }

        const parsed = JSON.parse(fixed);
        console.log('[JSON Recovery] Fixed with aggressive sanitization');
        return parsed;
      } catch (fallbackErr) {
        try {
          const chapterMatch = rawResponse.match(/"chapter"\s*:\s*(\{[^}]*\})/);
          const scenesMatch = rawResponse.match(/"scenes"\s*:\s*(\[[\s\S]*\])/);
          if (chapterMatch && scenesMatch) {
            const reconstructed = `{"chapter":${chapterMatch[1]},"scenes":${scenesMatch[1]}}`;
            const parsed = JSON.parse(reconstructed);
            console.log('[JSON Recovery] Reconstructed chapter from regex matches');
            return parsed;
          }
          throw fallbackErr;
        } catch (_finalErr) {
          throw new Error(`failed to parse LLM response (all recovery methods failed): ${parseErr.message}`);
        }
      }
    }
  };

  let generatedChapter = null;
  let activePrompt = prompt;
  let lastGenerationError = null;
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const rawResponse = await callNarrativeWithFallback(activePrompt);
      const candidate = parseGeneratedChapter(rawResponse);

      if (!candidate.chapter || !candidate.scenes || !Array.isArray(candidate.scenes)) {
        throw new Error('invalid LLM response structure: expected chapter and scenes array (12 scenes for complete chapter)');
      }
      if (candidate.scenes.length !== 12) {
        throw new Error(`Expected 12 scenes per chapter, got ${candidate.scenes.length}`);
      }

      const quality = assessChapterNarrativeQuality(candidate);
      if (!quality.ok) {
        throw new Error(`Narrative quality gate failed: ${quality.issues.join('; ')}`);
      }

      generatedChapter = candidate;
      break;
    } catch (attemptErr) {
      lastGenerationError = attemptErr;
      console.warn(`[Chapter Generation Attempt ${attempt}/${maxAttempts}] ${attemptErr.message}`);
      if (attempt < maxAttempts) {
        activePrompt = buildChapterRescuePrompt(prompt, {
          issues: [attemptErr.message]
        });
      }
    }
  }

  if (!generatedChapter) {
    throw new Error(`LLM chapter generation failed quality/parse checks: ${lastGenerationError ? lastGenerationError.message : 'unknown error'}`);
  }

  const chapter = generatedChapter.chapter;
  const scenes = generatedChapter.scenes;

  // Normalize generated IDs so chapter_id, scene_id and option_id stay in the same namespace.
  const parseSceneOrderFromId = (sceneId) => {
    const m = String(sceneId || '').match(/-s(\d{1,2})$/i);
    return m ? Number(m[1]) : null;
  };
  const oldToNewSceneId = new Map();
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i] || {};
    const orderNum = Number(sc.order) || parseSceneOrderFromId(sc.scene_id) || (i + 1);
    const canonicalSceneId = `${nextChapterId}-s${String(orderNum).padStart(2, '0')}`;
    if (sc.scene_id) oldToNewSceneId.set(sc.scene_id, canonicalSceneId);
    sc.order = orderNum;
    sc.scene_id = canonicalSceneId;

    if (Array.isArray(sc.options)) {
      for (let j = 0; j < sc.options.length; j++) {
        const opt = sc.options[j] || {};
        opt.option_id = `${canonicalSceneId}-o${j + 1}`;
      }
    }
  }

  for (const sc of scenes) {
    if (!Array.isArray(sc.options)) continue;
    for (const opt of sc.options) {
      if (!opt) continue;
      if (!opt.next_scene_id) continue;

      // Prefer explicit remap from generated ids; fallback to inferred order.
      if (oldToNewSceneId.has(opt.next_scene_id)) {
        opt.next_scene_id = oldToNewSceneId.get(opt.next_scene_id);
      } else {
        const nextOrder = parseSceneOrderFromId(opt.next_scene_id);
        opt.next_scene_id = nextOrder
          ? `${nextChapterId}-s${String(nextOrder).padStart(2, '0')}`
          : null;
      }
    }
  }

  chapter.chapter_id = nextChapterId;
  const providerInfo = llmClient.getProviderInfo();
  const modelUsed = providerInfo.narrative_model || providerInfo.model;

  // Insert chapter
  const chapterRow = {
    chapter_id: chapter.chapter_id,
    title: chapter.title,
    order: chapter.order || parseInt(chapter.chapter_id.substring(1)) || 1,
    metadata: {
      generated_by: providerInfo.provider,
      generated_at: new Date().toISOString(),
      model: modelUsed,
      hero_journey: 'complete_12_stages'
    }
  };

  const { error: chErr } = await supabase
    .from('chapters')
    .upsert([chapterRow], { onConflict: 'chapter_id' });
  if (chErr) throw chErr;

  // Remove previous generated content for this chapter to avoid duplicate order rows
  // and mixed namespaces (e.g., chapter c02 with scene ids c03-sXX).
  try {
    const { data: existingScenes, error: existingScenesErr } = await supabase
      .from('scenes')
      .select('scene_id')
      .eq('chapter_id', chapter.chapter_id);
    if (existingScenesErr) throw existingScenesErr;

    const existingSceneIds = (existingScenes || []).map(s => s.scene_id).filter(Boolean);
    if (existingSceneIds.length) {
      const { error: delOptionsErr } = await supabase
        .from('options')
        .delete()
        .in('scene_id', existingSceneIds);
      if (delOptionsErr) throw delOptionsErr;

      const { error: delScenesErr } = await supabase
        .from('scenes')
        .delete()
        .eq('chapter_id', chapter.chapter_id);
      if (delScenesErr) throw delScenesErr;
    }
  } catch (cleanupErr) {
    console.warn('chapter cleanup warning', cleanupErr && cleanupErr.message ? cleanupErr.message : cleanupErr);
  }

  // Insert all 12 scenes and their options
  const sceneRows = [];
  const optionRows = [];
  const clinicalMappingRows = [];
  const ruleContext = { phq9Score: Number(clinicalScores.phq9 || 0) };

  for (const scene of scenes) {
    // Validate and fix scene IDs
    const sceneId = scene.scene_id || `${nextChapterId}-s${String(scene.order || 0).padStart(2, '0')}`;
    const fallbackTitle = scene.hero_stage
      ? String(scene.hero_stage).replace(/^\d+_/, '').replace(/_/g, ' ')
      : sceneId;
    
    sceneRows.push({
      scene_id: sceneId,
      chapter_id: chapter.chapter_id,
      title: scene.title || fallbackTitle,
      order: scene.order,
      metadata: {
        hero_stage: scene.hero_stage,
        type: scene.type,
        scene_text: scene.text
      }
    });

    // Process options for playable scenes
    if (scene.type === 'playable' && Array.isArray(scene.options) && scene.options.length > 0) {
      const ruleResult = applyOptionRulesToScene(scene.options, ruleContext);
      const processedOptions = (ruleResult.options || []).map((opt, idx) => ({
        option_id: opt.option_id || `${sceneId}-o${idx + 1}`,
        scene_id: sceneId,
        option_text: opt.option_text,
        consequence: opt.consequence,
        next_chapter_id: opt.next_chapter_id || null,
        next_scene_id: opt.next_scene_id || null,
        gds_mapping: opt.gds_mapping || [],
        metadata: {
          phq_mapping: opt.phq_mapping || [],
          generated_by: providerInfo.provider,
          generated_at: new Date().toISOString(),
          model: modelUsed
        }
      }));

      optionRows.push(...processedOptions);

      // Collect clinical mappings from options
      for (const opt of processedOptions) {
        for (const mapping of (opt.gds_mapping || [])) {
          clinicalMappingRows.push({
            option_id: opt.option_id,
            scale: 'GDS',
            item: mapping.item,
            weight: mapping.weight || 0.5,
            confidence: mapping.confidence || 0.75,
            primary_construct: mapping.primary_construct || 'unknown',
            rationale: mapping.rationale || '',
            mapping_source: 'llm',
            source_confidence: providerInfo.initialized ? 0.85 : 0.5,
            validated: false
          });
        }
        for (const mapping of (opt.phq_mapping || [])) {
          clinicalMappingRows.push({
            option_id: opt.option_id,
            scale: 'PHQ',
            item: mapping.item,
            weight: mapping.weight || 0.5,
            confidence: mapping.confidence || 0.75,
            primary_construct: mapping.primary_construct || 'unknown',
            rationale: mapping.rationale || '',
            mapping_source: 'llm',
            source_confidence: providerInfo.initialized ? 0.85 : 0.5,
            validated: false
          });
        }
      }
    }
  }

  // Batch insert: scenes
  if (sceneRows.length > 0) {
    const { error: sceneErr } = await supabase
      .from('scenes')
      .upsert(sceneRows, { onConflict: 'scene_id' });
    if (sceneErr) throw sceneErr;
  }

  // Batch insert: options
  if (optionRows.length > 0) {
    const { error: optErr } = await supabase
      .from('options')
      .upsert(optionRows, { onConflict: 'option_id' });
    if (optErr) throw optErr;
  }

  // Batch insert: clinical mappings
  if (clinicalMappingRows.length > 0) {
    const { error: mapErr } = await supabase
      .from('clinical_mappings')
      .insert(clinicalMappingRows);
    if (mapErr) console.warn('clinical mappings insert warning', mapErr);
  }

  // Update session to new chapter (first playable scene)
  const { error: updateErr } = await supabase
    .from('sessions')
    .update({ chapter_id: chapter.chapter_id })
    .eq('session_id', session_id);
  if (updateErr) console.warn('session update warning', updateErr);

  // Return first playable scene for Alexa response
  const firstPlayableScene = scenes.find(s => s.type === 'playable');
  const firstPlayableOptions = firstPlayableScene && Array.isArray(firstPlayableScene.options) 
    ? firstPlayableScene.options.slice(0, 5) 
    : [];

  return {
    chapter: {
      chapter_id: chapter.chapter_id,
      title: chapter.title,
      order: chapter.order,
      scene_count: scenes.length,
      first_scene: firstPlayableScene ? {
        scene_id: firstPlayableScene.scene_id,
        title: firstPlayableScene.title,
        text: firstPlayableScene.text
      } : null,
      options: firstPlayableOptions.map(o => ({
        option_id: o.option_id,
        option_text: o.option_text,
        consequence: o.consequence,
        gds_mapping: o.gds_mapping,
        phq_mapping: o.phq_mapping
      }))
    },
    generated_by: providerInfo.provider,
    chapter_id: chapter.chapter_id,
    timestamp: new Date().toISOString()
  };
}

// Handle POST /chapters/generate: Generate full next-week chapter pack (7 chapters)
async function handleChapterGenerate(req, res) {
  try {
    if (!llmClient || !prompts) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'LLM service not available' }));
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const {
          session_id,
          chapter_id,
          chapter_count
        } = payload;

        if (!session_id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'session_id is required' }));
        }

        const effectiveCount = Math.max(1, Number(chapter_count || WEEK_CHAPTER_COUNT || 7));
        console.log(`📚 WEEKLY GENERATION REQUEST: session=${session_id}, from=${chapter_id || 'session.current'}, chapters=${effectiveCount}`);

        const weeklyResult = await generateNextWeekForSession(session_id, chapter_id || null, {
          chapter_count: effectiveCount,
          trigger_source: 'api_chapters_generate'
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          ok: true,
          mode: 'weekly_pre_generation',
          week: weeklyResult.week,
          first_chapter: weeklyResult.first_chapter,
          chapters: weeklyResult.chapters,
          generated_by: weeklyResult.generated_by,
          model: weeklyResult.model,
          canonical_persistence: weeklyResult.canonical_persistence,
          timestamp: weeklyResult.timestamp
        }));

      } catch (err) {
        console.error('❌ chapter generate error', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message || String(err) }));
      }
    });

  } catch (err) {
    console.error('❌ chapter generate handler error', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

// Handle POST /llm/arcs/plan: Prompt 1 (Architect)
async function handleArcPlanGenerate(req, res) {
  try {
    if (!llmClient || !prompts) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'LLM service not available' }));
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const {
          arc_id,
          week_number,
          arc_theme,
          title,
          chapter_id_range,
          entry_hook,
          previous_emotional_state_end,
          previous_watch_constructs,
          constructos,
          allow_phq9_item9_policy,
          model,
          locale: arcPlanLocale
        } = payload;

        if (!arc_id || !week_number || !arc_theme || !title || !Array.isArray(chapter_id_range) || chapter_id_range.length !== 2) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            error: 'Missing required fields: arc_id, week_number, arc_theme, title, chapter_id_range[2]'
          }));
        }

        const state = loadArcWorkflowState();
        const effectiveEntryHook = typeof entry_hook !== 'undefined'
          ? entry_hook
          : (state.latest_transition && state.latest_transition.next_arc_hook) || null;
        const effectivePrevEmotional = typeof previous_emotional_state_end !== 'undefined'
          ? previous_emotional_state_end
          : (state.latest_transition && state.latest_transition.emotional_state_end) || null;
        const effectivePrevWatch = Array.isArray(previous_watch_constructs)
          ? previous_watch_constructs
          : ((state.latest_transition && state.latest_transition.clinical_carry_over && state.latest_transition.clinical_carry_over.watch) || []);

        const p = prompts.buildArcArchitectPrompt({
          arc_id,
          week_number,
          arc_theme,
          title,
          chapter_id_range,
          entry_hook: effectiveEntryHook,
          previous_emotional_state_end: effectivePrevEmotional,
          previous_watch_constructs: effectivePrevWatch,
          constructos: Array.isArray(constructos) ? constructos : [],
          allow_phq9_item9_policy: allow_phq9_item9_policy || 'no en ningun dia',
          geographic_setting: getGeographicSetting(arcPlanLocale || 'es-MX')
        });

        const settings = prompts.getArcWorkflowModelSettings();
        const llmModel = model || resolveModelForWorkflow('architect');
        const llmResponse = await llmClient.callLLM(llmModel, p.prompt, { ...settings.architect, role: 'narrative' });
        if (!llmResponse || !llmResponse.response) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'LLM returned empty response' }));
        }

        const architecture = extractJsonObject(llmResponse.response);
        if (!architecture || !architecture.arc_id || !Array.isArray(architecture.days) || architecture.days.length !== 7) {
          res.writeHead(422, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            error: 'Invalid architecture JSON from LLM',
            llm_preview: llmResponse.response.slice(0, 500)
          }));
        }

        const arcDir = getArcStorageDir();
        fs.mkdirSync(arcDir, { recursive: true });
        const architecturePath = path.join(arcDir, `${architecture.arc_id}.architecture.json`);
        fs.writeFileSync(architecturePath, JSON.stringify(architecture, null, 2), 'utf8');

        const inputTokens = estimateTokensFromText(p.prompt);
        const outputTokens = estimateTokensFromText(llmResponse.response);
        const estimatedCostUsd = estimateCostUsd(inputTokens, outputTokens);

        state.latest_arc_id = architecture.arc_id;
        state.arcs[architecture.arc_id] = state.arcs[architecture.arc_id] || { generated_days: {} };
        state.arcs[architecture.arc_id].architecture = architecture;
        state.arcs[architecture.arc_id].planned_at = new Date().toISOString();
        if (architecture.arc_transition) {
          state.latest_transition = architecture.arc_transition;
          state.arcs[architecture.arc_id].arc_transition = architecture.arc_transition;
        }
        saveArcWorkflowState(state);

        // Optional DB persistence (if arc tables exist)
        const weekRecord = {
          arc_id: architecture.arc_id,
          week_number: Number(architecture.week_number || week_number),
          arc_theme: architecture.arc_theme || arc_theme,
          title: architecture.title || title,
          chapter_start_id: Array.isArray(chapter_id_range) ? chapter_id_range[0] : null,
          chapter_end_id: Array.isArray(chapter_id_range) ? chapter_id_range[1] : null,
          status: 'planned',
          architecture_json: architecture,
          entry_hook: architecture.entry_hook || effectiveEntryHook,
          opening_scene: architecture.opening_scene || null,
          clinical_theme: architecture.clinical_theme || null,
          transition_json: architecture.arc_transition || null,
          planned_with_provider: llmResponse.provider || null,
          planned_with_model: llmModel,
          prompt_version: 'arc_v1',
          prompt_compact_level: process.env.PROMPT_COMPACT_LEVEL || 'balanced',
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          estimated_cost_usd: estimatedCostUsd
        };
        await persistArcWeekToDb(weekRecord);

        if (architecture.arc_transition) {
          await persistArcTransitionToDb({
            from_arc_id: architecture.arc_id,
            to_arc_id: null,
            emotional_state_end: architecture.arc_transition.emotional_state_end || null,
            next_arc_hook: architecture.arc_transition.next_arc_hook || 'continuidad_pendiente',
            clinical_carry_over: architecture.arc_transition.clinical_carry_over || null
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          ok: true,
          mode: 'architect',
          model: llmModel,
          settings: settings.architect,
          architecture,
          saved_to: architecturePath
        }));
      } catch (err) {
        console.error('arc plan error', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message || String(err) }));
      }
    });
  } catch (err) {
    console.error('arc plan handler error', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

// Handle POST /llm/arcs/generate-day: Prompt 2 (Generator)
async function handleArcDayGenerate(req, res) {
  try {
    if (!llmClient || !prompts) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'LLM service not available' }));
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const {
          arc_id,
          arc_day,
          chapter_id,
          order,
          architecture,
          previous_day_summary,
          previous_day_top_option,
          next_arc_theme,
          model,
          continuity_state,
          generation_mode,
          narrative_intensity,
          segment,
          last_choices,
          force_regenerate,
          force_reset_narrative,
          user_skip_velocity,
          user_rating,
          locale: arcDayLocale
        } = payload;

        if (!arc_id || !arc_day) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'arc_id and arc_day are required' }));
        }

        const state = loadArcWorkflowState();
        let arcArchitecture = architecture || (state.arcs[arc_id] && state.arcs[arc_id].architecture) || null;
        if (!arcArchitecture) {
          const architecturePath = path.join(getArcStorageDir(), `${arc_id}.architecture.json`);
          if (fs.existsSync(architecturePath)) {
            arcArchitecture = JSON.parse(fs.readFileSync(architecturePath, 'utf8'));
          }
        }

        if (!arcArchitecture || !Array.isArray(arcArchitecture.days)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Architecture not found for arc_id. Run /llm/arcs/plan first.' }));
        }

        const dayInfo = (arcArchitecture.days || []).find(d => Number(d.arc_day) === Number(arc_day));
        const effectiveChapterId = chapter_id || (dayInfo && dayInfo.chapter_id);
        const effectiveOrder = Number(order || (effectiveChapterId ? parseInt(String(effectiveChapterId).replace('c', ''), 10) : 0));
        const criticalNode = resolveCriticalNode(arc_day, dayInfo || {});
        const normalizedSegment = normalizeSegment(segment || {});
        const continuityState = continuity_state || {
          last_scene_summary: previous_day_summary || '',
          emotional_state: 'resistance',
          clinical_flags: [],
          top_choice: previous_day_top_option || '',
          current_goal: criticalNode || 'social_activation'
        };

        const continuityCheck = validateContinuityState(continuityState);
        if (!continuityCheck.ok) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            error: 'Invalid continuity_state; required fields missing',
            missing: continuityCheck.missing
          }));
        }

        if (!effectiveChapterId || !effectiveOrder) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Unable to resolve chapter_id/order for this day' }));
        }

        const settings = prompts.getArcWorkflowModelSettings();
        const llmModel = model || resolveModelForWorkflow('generator');
        const pathChoices = clampWindow(last_choices || [], PATH_WINDOW_SIZE);
        const basePathKey = computeDeterministicPathKey({
          arc_id,
          chapter_id: effectiveChapterId,
          last_choices: pathChoices,
          segment: normalizedSegment,
          critical_node: criticalNode,
          prompt_version: PROMPT_VERSION
        });

        const shouldFallbackMini = Boolean(force_reset_narrative) || Number(user_skip_velocity || 0) >= 3;
        let effectiveMode = generation_mode || 'scene_by_scene';
        if (shouldFallbackMini) effectiveMode = 'mini_chapter';

        const cached = force_regenerate ? null : await getBestCachedPathVariant(basePathKey);
        if (cached && cached.output_json) {
          await persistNarrativeCacheEvent({
            base_path_key: basePathKey,
            variant_key: cached.variant_key || null,
            event_type: 'hit',
            savings_usd: cached.estimated_cost_usd || null,
            latency_ms: 0,
            metadata: {
              arc_id,
              arc_day: Number(arc_day),
              chapter_id: effectiveChapterId,
              segment: normalizedSegment,
              critical_node: criticalNode
            }
          });

          const cachedOutput = cached.output_json;
          const dayMetricsCache = {
            ...buildArcDayMetrics(cachedOutput),
            cache_hit: true,
            cache_path_key: basePathKey,
            path_reuse: true,
            cache_savings_usd: cached.estimated_cost_usd || null,
            critical_node: criticalNode,
            continuity_complete: true,
            narrative_intensity: cached.narrative_intensity || (narrative_intensity || 'medium')
          };

          const arcDir = getArcStorageDir();
          fs.mkdirSync(arcDir, { recursive: true });
          const dayPath = path.join(arcDir, `${arc_id}.day${arc_day}.${effectiveChapterId}.cached.json`);
          fs.writeFileSync(dayPath, JSON.stringify(cachedOutput, null, 2), 'utf8');

          await persistArcDayToDb({
            arc_id,
            arc_day: Number(arc_day),
            chapter_id: effectiveChapterId,
            chapter_order: effectiveOrder,
            generation_mode: 'on_demand',
            payload_mode: 'full',
            chapter_template_id: effectiveChapterId,
            day_context_json: {
              continuity_state: continuityState,
              segment: normalizedSegment,
              critical_node: criticalNode,
              previous_day_summary: previous_day_summary || null,
              previous_day_top_option: previous_day_top_option || null,
              next_arc_theme: next_arc_theme || null,
              arc_day_info: dayInfo || null,
              path_key: basePathKey,
              cache_hit: true
            },
            output_json: cachedOutput,
            delta_json: null,
            summary_text: continuityState.last_scene_summary || previous_day_summary || null,
            top_option_id: continuityState.top_choice || previous_day_top_option || null,
            transition_json: null,
            generated_with_provider: 'cache',
            generated_with_model: cached.generated_with_model || 'cache',
            input_tokens: 0,
            output_tokens: 0,
            estimated_cost_usd: 0,
            latency_ms: 0,
            generated_metrics: dayMetricsCache
          });

          await upsertNarrativePathCache({
            ...cached,
            usage_count: Number(cached.usage_count || 0) + 1,
            rating_count: Number(cached.rating_count || 0) + (user_rating ? 1 : 0),
            avg_rating: user_rating
              ? Number((((Number(cached.avg_rating || 0) * Number(cached.rating_count || 0)) + Number(user_rating)) / (Number(cached.rating_count || 0) + 1)).toFixed(2))
              : cached.avg_rating,
            quality_score: user_rating
              ? Number((((Number(cached.quality_score || 0.5) * 0.7) + (Number(user_rating) / 5) * 0.3)).toFixed(3))
              : cached.quality_score,
            updated_at: new Date().toISOString()
          });

          if (user_rating) {
            await persistNarrativeCacheEvent({
              base_path_key: basePathKey,
              variant_key: cached.variant_key || null,
              event_type: 'rating',
              savings_usd: null,
              latency_ms: null,
              metadata: { rating: Number(user_rating) }
            });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            ok: true,
            mode: 'generator',
            cache_hit: true,
            path_key: basePathKey,
            output: cachedOutput,
            saved_to: dayPath,
            generated_metrics: dayMetricsCache
          }));
        }

        await persistNarrativeCacheEvent({
          base_path_key: basePathKey,
          variant_key: null,
          event_type: 'miss',
          savings_usd: null,
          latency_ms: null,
          metadata: {
            arc_id,
            arc_day: Number(arc_day),
            chapter_id: effectiveChapterId,
            segment: normalizedSegment,
            critical_node: criticalNode,
            force_regenerate: !!force_regenerate
          }
        });

        const arcDayGeoSetting = getGeographicSetting(arcDayLocale || 'es-MX');
        let effectiveIntensity = narrative_intensity || 'medium';
        let p = prompts.buildArcDayGenerationPrompt({
          arcArchitecture,
          arc_day: Number(arc_day),
          chapter_id: effectiveChapterId,
          order: effectiveOrder,
          previous_day_summary: previous_day_summary || null,
          previous_day_top_option: previous_day_top_option || null,
          next_arc_theme: next_arc_theme || null,
          continuity_state: continuityState,
          generation_mode: effectiveMode,
          narrative_intensity: effectiveIntensity,
          critical_node: criticalNode,
          geographic_setting: arcDayGeoSetting
        });

        let promptInputTokens = estimateTokensFromText(p.prompt);
        let budgetFallbackApplied = false;
        if (promptInputTokens > MAX_INPUT_TOKENS) {
          budgetFallbackApplied = true;
          effectiveIntensity = 'low';
          const compactArchitecture = {
            arc_id: arcArchitecture.arc_id,
            arc_theme: arcArchitecture.arc_theme,
            title: arcArchitecture.title,
            week_number: arcArchitecture.week_number,
            chapter_id_range: arcArchitecture.chapter_id_range,
            day_current: dayInfo || null
          };
          p = prompts.buildArcDayGenerationPrompt({
            arcArchitecture: compactArchitecture,
            arc_day: Number(arc_day),
            chapter_id: effectiveChapterId,
            order: effectiveOrder,
            previous_day_summary: previous_day_summary || null,
            previous_day_top_option: previous_day_top_option || null,
            next_arc_theme: next_arc_theme || null,
            continuity_state: continuityState,
            generation_mode: effectiveMode,
            narrative_intensity: effectiveIntensity,
            critical_node: criticalNode,
            geographic_setting: arcDayGeoSetting
          });
          promptInputTokens = estimateTokensFromText(p.prompt);
        }

        const runtimeGeneratorSettings = {
          ...settings.generator,
          max_tokens: Math.min(Number(settings.generator.max_tokens || MAX_OUTPUT_TOKENS), MAX_OUTPUT_TOKENS),
          role: 'narrative'
        };

        let llmResponse = await llmClient.callLLM(llmModel, p.prompt, runtimeGeneratorSettings);
        if (!llmResponse || !llmResponse.response) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'LLM returned empty response' }));
        }

        let generated = extractJsonObject(llmResponse.response);
        if (!generated || !Array.isArray(generated.chapters) || !generated.chapters.length) {
          // Fallback to mini-chapter on parse or structure failures.
          effectiveMode = 'mini_chapter';
          const fallbackPrompt = prompts.buildArcDayGenerationPrompt({
            arcArchitecture,
            arc_day: Number(arc_day),
            chapter_id: effectiveChapterId,
            order: effectiveOrder,
            previous_day_summary: previous_day_summary || null,
            previous_day_top_option: previous_day_top_option || null,
            next_arc_theme: next_arc_theme || null,
            continuity_state: continuityState,
            generation_mode: 'mini_chapter',
            narrative_intensity: 'low',
            critical_node: criticalNode,
            geographic_setting: arcDayGeoSetting
          });
          llmResponse = await llmClient.callLLM(llmModel, fallbackPrompt.prompt, runtimeGeneratorSettings);
          generated = llmResponse && llmResponse.response ? extractJsonObject(llmResponse.response) : null;
          if (!generated || !Array.isArray(generated.chapters) || !generated.chapters.length) {
            res.writeHead(422, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              error: 'Invalid chapter JSON from LLM after fallback',
              llm_preview: (llmResponse && llmResponse.response ? llmResponse.response.slice(0, 500) : null)
            }));
          }
        }

        const phq9Score = Number(payload?.phq9_score || payload?.phq9Score || continuityState?.phq9_score || 0);
        generated = applyDeterministicClinicalRules(generated, { phq9Score });

        const arcDir = getArcStorageDir();
        fs.mkdirSync(arcDir, { recursive: true });
        const dayPath = path.join(arcDir, `${arc_id}.day${arc_day}.${effectiveChapterId}.json`);
        fs.writeFileSync(dayPath, JSON.stringify(generated, null, 2), 'utf8');

        const inputTokens = estimateTokensFromText(p.prompt);
        const outputTokens = estimateTokensFromText(llmResponse.response);
        const estimatedCostUsd = estimateCostUsd(inputTokens, outputTokens);
        const dayMetrics = {
          ...buildArcDayMetrics(generated),
          cache_hit: false,
          path_key: basePathKey,
          path_reuse: false,
          cache_savings_usd: null,
          critical_node: criticalNode,
          continuity_complete: true,
          narrative_intensity: effectiveIntensity,
          token_budget_input_max: MAX_INPUT_TOKENS,
          token_budget_output_max: MAX_OUTPUT_TOKENS,
          budget_fallback_applied: budgetFallbackApplied,
          prompt_input_tokens: promptInputTokens
        };

        const chapterOut = generated.chapters[0] || {};
        chapterOut.continuity_state = chapterOut.continuity_state || continuityState;
        if (criticalNode) {
          chapterOut.convergence = {
            node: criticalNode,
            source: dayInfo && dayInfo.narrative_trigger ? 'architect' : 'static'
          };
        }
        generated.chapters[0] = chapterOut;

        state.arcs[arc_id] = state.arcs[arc_id] || { generated_days: {} };
        state.arcs[arc_id].generated_days[String(arc_day)] = {
          chapter_id: effectiveChapterId,
          generated_at: new Date().toISOString(),
          file: dayPath
        };

        const firstChapter = generated.chapters[0] || {};
        if (Number(arc_day) === 7 && firstChapter.arc_transition) {
          state.latest_transition = firstChapter.arc_transition;
          state.arcs[arc_id].arc_transition = firstChapter.arc_transition;
        }
        saveArcWorkflowState(state);

        // Optional DB persistence (if arc tables exist)
        const dayRecord = {
          arc_id,
          arc_day: Number(arc_day),
          chapter_id: effectiveChapterId,
          chapter_order: effectiveOrder,
          generation_mode: effectiveMode === 'scene_by_scene' ? 'on_demand' : 'partial',
          payload_mode: 'full',
          chapter_template_id: effectiveChapterId,
          day_context_json: {
            continuity_state: continuityState,
            segment: normalizedSegment,
            critical_node: criticalNode,
            previous_day_summary: previous_day_summary || null,
            previous_day_top_option: previous_day_top_option || null,
            next_arc_theme: next_arc_theme || null,
            arc_day_info: dayInfo || null,
            path_key: basePathKey,
            path_window_size: PATH_WINDOW_SIZE
          },
          output_json: generated,
          delta_json: null,
          summary_text: continuityState.last_scene_summary || previous_day_summary || null,
          top_option_id: continuityState.top_choice || previous_day_top_option || null,
          transition_json: firstChapter.arc_transition || null,
          generated_with_provider: llmResponse.provider || null,
          generated_with_model: llmModel,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          estimated_cost_usd: estimatedCostUsd,
          latency_ms: Number(llmResponse.time_ms || 0),
          generated_metrics: dayMetrics
        };
        await persistArcDayToDb(dayRecord);

        const canonicalPersistence = await persistGeneratedArcContentToCanonical(generated, {
          arc_id,
          arc_day: Number(arc_day),
          provider: llmResponse.provider || null,
          model: llmModel,
          mappingSource: 'hybrid_llm_rule'
        });

        const baseVariantKey = hashObject({ basePathKey, mode: effectiveMode, intensity: effectiveIntensity });
        await upsertNarrativePathCache({
          variant_key: baseVariantKey,
          base_path_key: basePathKey,
          path_window_size: PATH_WINDOW_SIZE,
          segment_json: normalizedSegment,
          generation_mode: effectiveMode,
          continuity_snapshot: continuityState,
          critical_node: criticalNode,
          narrative_intensity: effectiveIntensity,
          output_json: generated,
          compressed_memory: compressNarrativeMemory(generated),
          generated_with_provider: llmResponse.provider || null,
          generated_with_model: llmModel,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          estimated_cost_usd: estimatedCostUsd,
          quality_score: Number(user_rating ? (Number(user_rating) / 5).toFixed(3) : 0.5),
          usage_count: 1,
          rating_count: user_rating ? 1 : 0,
          avg_rating: user_rating ? Number(Number(user_rating).toFixed(2)) : null,
          is_active: true,
          prompt_version: PROMPT_VERSION,
          updated_at: new Date().toISOString()
        });

        await persistNarrativeCacheEvent({
          base_path_key: basePathKey,
          variant_key: baseVariantKey,
          event_type: 'write',
          savings_usd: null,
          latency_ms: Number(llmResponse.time_ms || 0),
          metadata: {
            arc_id,
            arc_day: Number(arc_day),
            chapter_id: effectiveChapterId,
            segment: normalizedSegment,
            critical_node: criticalNode,
            generation_mode: effectiveMode,
            narrative_intensity: effectiveIntensity
          }
        });

        if (Number(arc_day) === 7 && firstChapter.arc_transition) {
          await persistArcTransitionToDb({
            from_arc_id: arc_id,
            to_arc_id: null,
            emotional_state_end: firstChapter.arc_transition.emotional_state_end || null,
            next_arc_hook: firstChapter.arc_transition.next_arc_hook || 'continuidad_pendiente',
            clinical_carry_over: firstChapter.arc_transition.clinical_carry_over || null
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          ok: true,
          mode: 'generator',
          model: llmModel,
          settings: runtimeGeneratorSettings,
          path_key: basePathKey,
          cache_hit: false,
          continuity_state: continuityState,
          segment: normalizedSegment,
          critical_node: criticalNode,
          generation_mode: effectiveMode,
          output: generated,
          saved_to: dayPath,
          canonical_persistence: canonicalPersistence,
          generated_metrics: dayMetrics
        }));
      } catch (err) {
        console.error('arc day generate error', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message || String(err) }));
      }
    });
  } catch (err) {
    console.error('arc day generate handler error', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

// Handle GET /llm/arcs/state: inspect current continuity chain
async function handleArcWorkflowState(req, res) {
  try {
    const state = loadArcWorkflowState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, state }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

async function handleNarrativeCacheKpis(req, res) {
  try {
    const { data, error } = await supabase
      .from('v_narrative_cache_kpis')
      .select('*')
      .maybeSingle();
    if (error) throw error;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, kpis: data || null }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

async function handleDashboardSessions(req, res) {
  try {
    const { data, error } = await supabase
      .from('dashboard_sessions')
      .select('*')
      .order('total_sessions', { ascending: false });
    if (error) throw error;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, rows: data || [] }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

async function handleRiskOverview(req, res) {
  try {
    const { data, error } = await supabase
      .from('risk_overview')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, rows: data || [] }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

async function handleReviewQueue(req, res) {
  try {
    const access = verifyOperationalAccess(req.headers);
    if (!access.valid) {
      res.writeHead(access.statusCode || 401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: access.error || 'unauthorized' }));
    }

    const reqUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const limit = Math.max(1, Math.min(200, Number(reqUrl.searchParams.get('limit') || 50)));
    const onlyPending = String(reqUrl.searchParams.get('pending_only') || '').toLowerCase() === 'true';

    const { data, error } = await supabase
      .from('v_mapping_review_queue')
      .select('*')
      .order('review_count', { ascending: true })
      .order('last_review_at', { ascending: true, nullsFirst: true })
      .order('timestamp', { ascending: true })
      .limit(limit);
    if (error) throw error;

    const rows = (data || []).map(row => {
      const queueState = row.review_count > 0
        ? (row.has_reject ? 'needs_clinical_attention' : (row.has_adjust ? 'needs_adjustment' : (row.training_ready ? 'ready_for_training' : 'in_review')))
        : 'pending_review';
      return {
        ...row,
        queue_state: queueState,
        priority: row.has_reject ? 'high' : (row.has_adjust ? 'medium' : 'normal')
      };
    }).filter(row => (onlyPending ? row.queue_state !== 'in_review' && row.queue_state !== 'ready_for_training' : true));

    const summary = rows.reduce((acc, row) => {
      acc.total += 1;
      acc.by_state[row.queue_state] = (acc.by_state[row.queue_state] || 0) + 1;
      return acc;
    }, { total: 0, by_state: {} });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, authenticated: access.authenticated, limit, summary, rows }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

async function handleClinicalReports(req, res) {
  try {
    const access = verifyOperationalAccess(req.headers);
    if (!access.valid) {
      res.writeHead(access.statusCode || 401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: access.error || 'unauthorized' }));
    }

    const reqUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const sessionId = reqUrl.searchParams.get('session_id');
    const pseudonym = reqUrl.searchParams.get('pseudonym');
    const limit = Math.max(1, Math.min(100, Number(reqUrl.searchParams.get('limit') || 20)));

    if (sessionId) {
      const { data: sessionRow, error: sessionErr } = await supabase
        .from('sessions')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();
      if (sessionErr) throw sessionErr;
      if (!sessionRow) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'session not found' }));
      }

      const { data: sessionScores, error: scoreErr } = await supabase
        .from('session_scores')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();
      if (scoreErr) throw scoreErr;

      const { data: decisions, error: decisionErr } = await supabase
        .from('decisions')
        .select('decision_id,timestamp,chapter_id,scene_id,option_id,option_text,time_to_decision_ms,mapping_confidence,validation_steps,risk_flags')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });
      if (decisionErr) throw decisionErr;

      const decisionIds = (decisions || []).map(item => item.decision_id).filter(Boolean);
      const { data: clinicalMappings, error: mappingErr } = decisionIds.length
        ? await supabase
          .from('clinical_mappings')
          .select('*')
          .in('decision_id', decisionIds)
          .order('created_at', { ascending: true })
        : { data: [], error: null };
      if (mappingErr) throw mappingErr;

      const mappingIds = (clinicalMappings || []).map(item => item.mapping_id).filter(Boolean);
      const { data: mappingReviews, error: reviewErr } = mappingIds.length
        ? await supabase
          .from('clinical_mapping_reviews')
          .select('*')
          .in('mapping_id', mappingIds)
          .order('created_at', { ascending: true })
        : { data: [], error: null };
      if (reviewErr) throw reviewErr;

      const { data: riskEvents, error: riskErr } = await supabase
        .from('risk_events')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });
      if (riskErr) throw riskErr;

      const riskSummary = summarizeRiskEvents(riskEvents || []);
      const currentRiskStates = (riskEvents || []).map(event => ({ ...event, operational_state: computeRiskSlaState(event) }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        ok: true,
        authenticated: access.authenticated,
        report_type: 'session_clinical_report',
        session: sessionRow,
        session_scores: sessionScores || null,
        decisions: decisions || [],
        clinical_mappings: clinicalMappings || [],
        reviews: mappingReviews || [],
        risk_summary: riskSummary,
        risk_events: currentRiskStates,
        risk_targets: {
          notification_minutes: riskSummary.rows.length ? riskSummary.rows[0].sla_policy.notificationMinutes : null,
          first_action_minutes: riskSummary.rows.length ? riskSummary.rows[0].sla_policy.firstActionMinutes : null,
          closure_minutes: riskSummary.rows.length ? riskSummary.rows[0].sla_policy.closureMinutes : null
        }
      }));
    }

    const [dashboardSessions, riskOverview, reviewStats, reviewQueue, trainingReady] = await Promise.all([
      supabase.from('dashboard_sessions').select('*').order('total_sessions', { ascending: false }).limit(limit),
      supabase.from('risk_overview').select('*').order('date', { ascending: false }).limit(limit),
      supabase.from('v_mapping_review_stats').select('*').order('review_date', { ascending: false }).limit(limit),
      supabase.from('v_mapping_review_queue').select('*').order('review_count', { ascending: true }).limit(limit),
      supabase.from('v_mapping_training_ready').select('*').order('created_at', { ascending: false }).limit(limit)
    ]);

    const queryErrors = [dashboardSessions.error, riskOverview.error, reviewStats.error, reviewQueue.error, trainingReady.error].filter(Boolean);
    if (queryErrors.length) throw queryErrors[0];

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ok: true,
      authenticated: access.authenticated,
      report_type: 'dashboard_clinical_report',
      filters: { pseudonym, limit },
      dashboard_sessions: dashboardSessions.data || [],
      risk_overview: riskOverview.data || [],
      review_stats: reviewStats.data || [],
      review_queue: reviewQueue.data || [],
      training_ready: trainingReady.data || [],
      summary: {
        dashboard_sessions_count: (dashboardSessions.data || []).length,
        risk_overview_count: (riskOverview.data || []).length,
        review_queue_count: (reviewQueue.data || []).length,
        training_ready_count: (trainingReady.data || []).length
      }
    }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

async function handleReviewAction(req, res) {
  try {
    const access = verifyOperationalAccess(req.headers);
    if (!access.valid) {
      res.writeHead(access.statusCode || 401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: access.error || 'unauthorized' }));
    }

    const body = await parseJsonBody(req);
    const mappingId = String(body && body.mapping_id || '').trim();
    const verdict = String(body && body.verdict || '').trim().toLowerCase();
    const reviewerId = body && body.reviewer_id ? String(body.reviewer_id).trim() : null;
    const reviewerConfidence = typeof body?.reviewer_confidence === 'number' ? body.reviewer_confidence : null;
    const reason = body && body.reason ? String(body.reason).trim() : null;
    const suggestedMapping = typeof body?.suggested_mapping === 'undefined' ? null : body.suggested_mapping;
    const reviewTags = Array.isArray(body?.review_tags) ? body.review_tags.map(tag => String(tag).trim()).filter(Boolean) : null;
    const trainingReady = typeof body?.training_ready === 'boolean' ? body.training_ready : verdict === 'approve';

    const allowedVerdicts = new Set(['approve', 'reject', 'adjust', 'unclear']);
    if (!mappingId || !allowedVerdicts.has(verdict)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'mapping_id and valid verdict are required' }));
    }

    const { data: mappingRow, error: mappingErr } = await supabase
      .from('clinical_mappings')
      .select('*')
      .eq('mapping_id', mappingId)
      .maybeSingle();
    if (mappingErr) throw mappingErr;
    if (!mappingRow) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'clinical mapping not found' }));
    }

    const { data: insertedReview, error: reviewErr } = await supabase
      .from('clinical_mapping_reviews')
      .insert([{
        mapping_id: mappingId,
        decision_id: mappingRow.decision_id,
        option_id: mappingRow.option_id,
        reviewer_id: reviewerId,
        verdict,
        reviewer_confidence: reviewerConfidence,
        reason,
        suggested_mapping: suggestedMapping,
        review_tags: reviewTags,
        training_ready: trainingReady
      }])
      .select('*')
      .maybeSingle();
    if (reviewErr) throw reviewErr;

    const mappingUpdates = {
      validated: verdict === 'approve' || verdict === 'adjust'
    };

    if (verdict === 'reject') {
      mappingUpdates.validated = false;
    }

    const { error: updateErr } = await supabase
      .from('clinical_mappings')
      .update(mappingUpdates)
      .eq('mapping_id', mappingId);
    if (updateErr) throw updateErr;

    res.writeHead(201, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ok: true,
      authenticated: access.authenticated,
      review: insertedReview || null,
      mapping: {
        mapping_id: mappingId,
        validated: mappingUpdates.validated,
        verdict
      }
    }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

function buildOperationalDashboardHtml() {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Panel Operativo Clínico</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #0b1020;
      --bg-soft: #111831;
      --panel: rgba(15, 23, 42, 0.82);
      --panel-2: rgba(30, 41, 59, 0.8);
      --line: rgba(148, 163, 184, 0.22);
      --text: #e5eefc;
      --muted: #9fb0cf;
      --accent: #7dd3fc;
      --accent-2: #a78bfa;
      --good: #4ade80;
      --warn: #fbbf24;
      --bad: #fb7185;
      --shadow: 0 24px 60px rgba(2, 6, 23, 0.45);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(125, 211, 252, 0.16), transparent 30%),
        radial-gradient(circle at 90% 10%, rgba(167, 139, 250, 0.18), transparent 28%),
        linear-gradient(180deg, #050816 0%, #0b1020 40%, #0f172a 100%);
      color: var(--text);
    }
    .wrap {
      max-width: 1400px;
      margin: 0 auto;
      padding: 28px;
    }
    .hero {
      display: grid;
      grid-template-columns: 1.3fr 0.7fr;
      gap: 18px;
      align-items: stretch;
      margin-bottom: 20px;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 22px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(16px);
    }
    .hero-main { padding: 28px; position: relative; overflow: hidden; }
    .hero-main::after {
      content: "";
      position: absolute;
      inset: auto -80px -100px auto;
      width: 280px;
      height: 280px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(125, 211, 252, 0.22), transparent 68%);
      pointer-events: none;
    }
    .eyebrow { color: var(--accent); text-transform: uppercase; letter-spacing: 0.18em; font-size: 12px; font-weight: 700; }
    h1 {
      margin: 10px 0 8px;
      font-size: clamp(28px, 4vw, 48px);
      line-height: 1.02;
    }
    .subtitle { max-width: 760px; color: var(--muted); font-size: 15px; line-height: 1.6; }
    .meta-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid var(--line);
      color: var(--text);
      font-size: 13px;
    }
    .chip strong { color: white; }
    .hero-side { padding: 18px; display: grid; gap: 12px; }
    .control-grid { display: grid; gap: 10px; }
    .field {
      display: grid;
      gap: 6px;
      padding: 12px;
      border-radius: 16px;
      background: rgba(15, 23, 42, 0.72);
      border: 1px solid var(--line);
    }
    .field label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
    .field input, .field select {
      width: 100%;
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 12px;
      padding: 11px 12px;
      background: rgba(2, 6, 23, 0.6);
      color: var(--text);
      outline: none;
    }
    .field input:focus, .field select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(125, 211, 252, 0.15); }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    button {
      border: 0;
      border-radius: 12px;
      padding: 11px 14px;
      cursor: pointer;
      font-weight: 700;
      color: #08111f;
      background: linear-gradient(135deg, var(--accent), #f8fafc);
    }
    button.secondary { color: var(--text); background: rgba(148, 163, 184, 0.15); border: 1px solid var(--line); }
    .grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 16px;
      margin-top: 18px;
    }
    .metric {
      grid-column: span 3;
      padding: 18px;
      border-radius: 18px;
      background: var(--panel-2);
      border: 1px solid var(--line);
    }
    .metric .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
    .metric .value { margin-top: 10px; font-size: 30px; font-weight: 800; }
    .metric .hint { margin-top: 8px; color: var(--muted); font-size: 13px; line-height: 1.5; }
    .section {
      grid-column: span 12;
      padding: 18px;
      border-radius: 20px;
      background: var(--panel);
      border: 1px solid var(--line);
      box-shadow: var(--shadow);
    }
    .section h2 { margin: 0 0 12px; font-size: 20px; }
    .section-header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .section-header p { margin: 0; color: var(--muted); }
    table { width: 100%; border-collapse: collapse; overflow: hidden; }
    th, td {
      text-align: left;
      padding: 12px 10px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
      vertical-align: top;
      font-size: 13px;
    }
    th { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
    tr:hover td { background: rgba(125, 211, 252, 0.05); }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
    }
    .badge.high, .badge.needs_clinical_attention, .badge.overdue_closure { background: rgba(251, 113, 133, 0.18); color: #fecdd3; }
    .badge.medium, .badge.needs_adjustment, .badge.overdue_action { background: rgba(251, 191, 36, 0.18); color: #fde68a; }
    .badge.normal, .badge.pending_review, .badge.in_review, .badge.ready_for_training, .badge.open, .badge.notified { background: rgba(125, 211, 252, 0.16); color: #bae6fd; }
    .badge.closed, .badge.resolved { background: rgba(74, 222, 128, 0.16); color: #bbf7d0; }
    .action-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }
    .action-group button {
      padding: 8px 10px;
      font-size: 12px;
      border-radius: 10px;
    }
    .action-group button.approve { background: linear-gradient(135deg, #4ade80, #dcfce7); }
    .action-group button.reject { background: linear-gradient(135deg, #fb7185, #ffe4e6); }
    .action-group button.adjust { background: linear-gradient(135deg, #fbbf24, #fef3c7); }
    .action-group button.neutral { color: var(--text); background: rgba(148, 163, 184, 0.15); border: 1px solid var(--line); }
    .subgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .list {
      display: grid;
      gap: 10px;
    }
    .list-item {
      padding: 14px;
      border-radius: 16px;
      background: rgba(15, 23, 42, 0.74);
      border: 1px solid rgba(148, 163, 184, 0.16);
    }
    .list-item strong { display: block; margin-bottom: 6px; }
    .muted { color: var(--muted); }
    .footer-note { margin-top: 18px; color: var(--muted); font-size: 12px; }
    .error { color: #fecaca; }
    .loading {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 0 6px rgba(125, 211, 252, 0.12);
    }
    @media (max-width: 1080px) {
      .hero, .subgrid { grid-template-columns: 1fr; }
      .metric { grid-column: span 6; }
    }
    @media (max-width: 680px) {
      .wrap { padding: 16px; }
      .metric { grid-column: span 12; }
      .hero-main, .hero-side, .section { padding: 16px; }
      th, td { font-size: 12px; padding: 10px 8px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <div class="panel hero-main">
        <div class="eyebrow">Panel operativo clínico</div>
        <h1>Revisión manual, reportes clínicos y riesgo en una sola vista.</h1>
        <p class="subtitle">Este tablero consume la cola de revisión, los reportes clínicos y el estado SLA de riesgo desde el backend existente. Está pensado para supervisión rápida del dashboard, con autenticación por token y un modo visual que prioriza lectura clínica.</p>
        <div class="meta-row">
          <div class="chip"><strong>Endpoint</strong> /admin/dashboard</div>
          <div class="chip"><strong>Queue</strong> /admin/review-queue</div>
          <div class="chip"><strong>Reports</strong> /admin/clinical-reports</div>
          <div class="chip"><strong>Auth</strong> Bearer o x-api-key</div>
        </div>
      </div>
      <div class="panel hero-side">
        <div class="control-grid">
          <div class="field">
            <label for="token">Token operativo</label>
            <input id="token" type="password" placeholder="OPERATIONS_API_KEY o DASHBOARD_API_KEY" autocomplete="off" />
          </div>
          <div class="field">
            <label for="sessionId">Session ID</label>
            <input id="sessionId" type="text" placeholder="550e8400-e29b-41d4-a716-446655440000" autocomplete="off" />
          </div>
          <div class="field">
            <label for="pseudonym">Pseudónimo</label>
            <input id="pseudonym" type="text" placeholder="user_123" autocomplete="off" />
          </div>
          <div class="field">
            <label for="limit">Límite</label>
            <select id="limit">
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50" selected>50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
        <div class="actions">
          <button id="refreshBtn">Actualizar panel</button>
          <button class="secondary" id="saveTokenBtn">Guardar token</button>
          <button class="secondary" id="clearTokenBtn">Limpiar</button>
        </div>
      </div>
    </section>

    <section class="grid" id="metricsGrid">
      <div class="metric"><div class="label">Review queue</div><div class="value" id="metricQueue">—</div><div class="hint">Candidatos pendientes y en revisión.</div></div>
      <div class="metric"><div class="label">Training ready</div><div class="value" id="metricTraining">—</div><div class="hint">Mapeos listos para reutilización.</div></div>
      <div class="metric"><div class="label">Riesgo abierto</div><div class="value" id="metricRisk">—</div><div class="hint">Eventos pendientes o en escalamiento.</div></div>
      <div class="metric"><div class="label">Reporte clínico</div><div class="value" id="metricReports">—</div><div class="hint">Filas agregadas para lectura rápida.</div></div>

      <section class="section">
        <div class="section-header">
          <div>
            <h2>Cola de revisión manual</h2>
            <p>Ordenada por prioridad operativa y estado de feedback.</p>
          </div>
          <div class="loading" id="queueStatus"><span class="dot"></span><span class="muted">Esperando actualización</span></div>
        </div>
        <div style="overflow:auto; margin-top: 10px;">
          <table>
            <thead>
              <tr>
                <th>Prioridad</th>
                <th>Mapa</th>
                <th>Contexto</th>
                <th>Estado</th>
                <th>Última revisión</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="queueBody">
              <tr><td colspan="6" class="muted">No hay datos cargados todavía.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <h2>Reporte clínico</h2>
            <p>Resumen por sesión con scores, decisiones, reviews y SLA de riesgo.</p>
          </div>
          <div class="loading" id="reportStatus"><span class="dot"></span><span class="muted">Esperando actualización</span></div>
        </div>
        <div class="subgrid" style="margin-top: 12px;">
          <div class="list" id="reportSummary">
            <div class="list-item muted">Ingresa un session ID o pseudónimo y actualiza el panel.</div>
          </div>
          <div class="list" id="riskSummary"></div>
        </div>
      </section>
    </section>

    <p class="footer-note">El dashboard se sirve desde el backend existente y reutiliza las rutas operativas ya autenticadas. Los botones de revisión manual deben ejecutarse desde un cliente con acceso al token operativo.</p>
  </div>

  <script>
    const tokenInput = document.getElementById('token');
    const sessionInput = document.getElementById('sessionId');
    const pseudonymInput = document.getElementById('pseudonym');
    const limitInput = document.getElementById('limit');
    const queueBody = document.getElementById('queueBody');
    const reportSummary = document.getElementById('reportSummary');
    const riskSummary = document.getElementById('riskSummary');
    const queueStatus = document.getElementById('queueStatus');
    const reportStatus = document.getElementById('reportStatus');
    const metricQueue = document.getElementById('metricQueue');
    const metricTraining = document.getElementById('metricTraining');
    const metricRisk = document.getElementById('metricRisk');
    const metricReports = document.getElementById('metricReports');

    const params = new URLSearchParams(location.search);
    const savedToken = localStorage.getItem('ops_token') || params.get('token') || '';
    if (savedToken) tokenInput.value = savedToken;
    if (params.get('session_id')) sessionInput.value = params.get('session_id');
    if (params.get('pseudonym')) pseudonymInput.value = params.get('pseudonym');
    if (params.get('limit')) limitInput.value = params.get('limit');

    function authHeaders() {
      const token = tokenInput.value.trim();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      return headers;
    }

    function fmt(value) {
      if (value === null || typeof value === 'undefined' || value === '') return '—';
      return String(value);
    }

    function badge(value) {
      return '<span class="badge ' + String(value || 'normal') + '">' + String(value || 'normal') + '</span>';
    }

    function setStatus(el, text, error = false) {
      el.innerHTML = '<span class="dot"></span><span class="muted ' + (error ? 'error' : '') + '">' + text + '</span>';
    }

    async function submitReviewAction(mappingId, verdict, row) {
      const reason = window.prompt('Motivo o nota clínica para ' + verdict + ':', '');
      if (reason === null) return;
      const reviewerConfidence = verdict === 'approve' ? 0.9 : verdict === 'adjust' ? 0.7 : 0.6;
      const payload = {
        mapping_id: mappingId,
        verdict,
        reviewer_confidence: reviewerConfidence,
        reason: reason.trim() || null,
        suggested_mapping: verdict === 'adjust' ? { scale: row.scale, item: row.item, note: reason.trim() || 'Ajuste manual desde dashboard' } : null,
        review_tags: ['dashboard', verdict],
        training_ready: verdict === 'approve'
      };

      try {
        const response = await fetch('/admin/review-actions', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload)
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'No se pudo guardar la revisión');
        setStatus(queueStatus, 'Revisión guardada: ' + verdict);
        await loadDashboard();
      } catch (error) {
        setStatus(queueStatus, error.message, true);
        alert(error.message);
      }
    }

    function renderQueue(rows = []) {
      if (!rows.length) {
        queueBody.innerHTML = '<tr><td colspan="6" class="muted">La cola está vacía.</td></tr>';
        return;
      }
      queueBody.innerHTML = rows.map(row => {
        const actionButtons = '<div class="action-group">' +
          '<button class="approve" data-mapping="' + fmt(row.mapping_id) + '">Aprobar</button>' +
          '<button class="reject" data-mapping="' + fmt(row.mapping_id) + '">Rechazar</button>' +
          '<button class="adjust" data-mapping="' + fmt(row.mapping_id) + '">Ajustar</button>' +
          '</div>';
        return '<tr>' +
          '<td>' + badge(row.priority || 'normal') + '</td>' +
          '<td><strong>' + fmt(row.scale) + ' ' + fmt(row.item) + '</strong><div class="muted">' + fmt(row.primary_construct) + '</div></td>' +
          '<td><div><strong>' + fmt(row.pseudonym) + '</strong></div><div class="muted">' + fmt(row.option_text) + '</div></td>' +
          '<td>' + badge(row.queue_state || 'pending_review') + '<div class="muted" style="margin-top:6px;">reviews: ' + fmt(row.review_count) + '</div></td>' +
          '<td class="muted">' + fmt(row.last_review_at || row.timestamp) + '</td>' +
          '<td>' + actionButtons + '</td>' +
        '</tr>';
      }).join('');

      queueBody.querySelectorAll('button[data-mapping]').forEach(button => {
        button.addEventListener('click', () => {
          const mappingId = button.getAttribute('data-mapping');
          const row = rows.find(item => String(item.mapping_id) === String(mappingId));
          const verdict = button.classList.contains('approve') ? 'approve' : button.classList.contains('reject') ? 'reject' : 'adjust';
          submitReviewAction(mappingId, verdict, row || {});
        });
      });
    }

    function renderReport(payload) {
      const sections = [];
      if (payload?.session) {
        sections.push('<div class="list-item"><strong>Sesión</strong><div class="muted">' + fmt(payload.session.session_id) + '</div><div class="muted">' + fmt(payload.session.pseudonym) + '</div></div>');
      }
      if (payload?.session_scores) {
        sections.push('<div class="list-item"><strong>Scores</strong><div class="muted">GDS: ' + fmt(payload.session_scores.gds_total) + ' | PHQ: ' + fmt(payload.session_scores.phq_total) + '</div><div class="muted">Calculado: ' + fmt(payload.session_scores.computed_at) + '</div></div>');
      }
      if (payload?.decisions) {
        sections.push('<div class="list-item"><strong>Decisiones</strong><div class="muted">' + fmt(payload.decisions.length) + ' entradas registradas</div></div>');
      }
      if (payload?.reviews) {
        sections.push('<div class="list-item"><strong>Reviews</strong><div class="muted">' + fmt(payload.reviews.length) + ' revisiones asociadas</div></div>');
      }
      if (payload?.risk_summary) {
        sections.push('<div class="list-item"><strong>Riesgo</strong><div class="muted">Total: ' + fmt(payload.risk_summary.total) + ' | Notificados: ' + fmt(payload.risk_summary.notified) + ' | Cerrados: ' + fmt(payload.risk_summary.closed) + '</div></div>');
      }
      reportSummary.innerHTML = sections.join('') || '<div class="list-item muted">Sin datos de reporte.</div>';

      const rows = payload?.risk_events || [];
      riskSummary.innerHTML = rows.length ? rows.slice(0, 6).map(event => {
        const state = event.operational_state || {};
        return '<div class="list-item"><strong>' + fmt(event.risk_type) + '</strong><div class="muted">' + fmt(event.session_id) + '</div><div style="margin-top:8px;">' + badge(state.status || event.status || 'open') + '</div><div class="muted" style="margin-top:8px;">Notificado: ' + fmt(state.notified_at || event.notified_at) + ' · Acción: ' + fmt(state.first_action_at || event.first_action_at) + ' · Cierre: ' + fmt(state.closed_at || event.closed_at) + '</div></div>';
      }).join('') : '<div class="list-item muted">No hay eventos de riesgo para mostrar.</div>';
    }

    async function loadDashboard() {
      const limit = limitInput.value || '50';
      const token = tokenInput.value.trim();
      localStorage.setItem('ops_token', token);
      const headers = authHeaders();

      queueStatus.innerHTML = '<span class="dot"></span><span class="muted">Cargando cola...</span>';
      reportStatus.innerHTML = '<span class="dot"></span><span class="muted">Cargando reporte...</span>';

      try {
        const queueResp = await fetch('/admin/review-queue?limit=' + encodeURIComponent(limit) + '&pending_only=true', { headers });
        const queueJson = await queueResp.json();
        if (!queueResp.ok) throw new Error(queueJson.error || 'No se pudo cargar la cola');

        renderQueue(queueJson.rows || []);
        metricQueue.textContent = fmt(queueJson.summary?.total || 0);
        metricTraining.textContent = fmt(queueJson.summary?.by_state?.ready_for_training || 0);
        setStatus(queueStatus, 'Cola actualizada');
      } catch (error) {
        queueBody.innerHTML = '<tr><td colspan="5" class="error">' + error.message + '</td></tr>';
        setStatus(queueStatus, error.message, true);
      }

      try {
        const params = new URLSearchParams();
        params.set('limit', limit);
        if (sessionInput.value.trim()) params.set('session_id', sessionInput.value.trim());
        else if (pseudonymInput.value.trim()) params.set('pseudonym', pseudonymInput.value.trim());
        const reportResp = await fetch('/admin/clinical-reports?' + params.toString(), { headers });
        const reportJson = await reportResp.json();
        if (!reportResp.ok) throw new Error(reportJson.error || 'No se pudo cargar el reporte');

        renderReport(reportJson);
        metricRisk.textContent = fmt(reportJson.risk_summary?.overdue || 0);
        metricReports.textContent = fmt((reportJson.review_queue || []).length + (reportJson.training_ready || []).length);
        setStatus(reportStatus, 'Reporte actualizado');
      } catch (error) {
        reportSummary.innerHTML = '<div class="list-item error">' + error.message + '</div>';
        riskSummary.innerHTML = '<div class="list-item error">' + error.message + '</div>';
        setStatus(reportStatus, error.message, true);
      }
    }

    document.getElementById('refreshBtn').addEventListener('click', loadDashboard);
    document.getElementById('saveTokenBtn').addEventListener('click', () => {
      localStorage.setItem('ops_token', tokenInput.value.trim());
      loadDashboard();
    });
    document.getElementById('clearTokenBtn').addEventListener('click', () => {
      localStorage.removeItem('ops_token');
      tokenInput.value = '';
      loadDashboard();
    });

    loadDashboard();
  </script>
</body>
</html>`;
}

async function handleOperationalDashboard(req, res) {
  try {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(buildOperationalDashboardHtml());
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<h1>Error: ${String(err && err.message ? err.message : err)}</h1>`);
  }
}

async function handleNarrativeDebugState(req, res) {
  try {
    const reqUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const sessionId = reqUrl.searchParams.get('session_id');
    const chapterIdParam = reqUrl.searchParams.get('chapter_id');
    const sceneOrderParam = reqUrl.searchParams.get('scene_order');

    if (!sessionId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'session_id query param required' }));
    }

    const { data: sessionRow, error: sessErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (sessErr) throw sessErr;
    if (!sessionRow) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'session not found' }));
    }

    const chapter_id = chapterIdParam || sessionRow.chapter_id || 'c01';

    const { data: decisions, error: decErr } = await supabase
      .from('decisions')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });
    if (decErr) throw decErr;

    const { data: scores } = await supabase
      .from('session_scores')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    const clinicalLevel = scores
      ? (scores.gds_total > 10 || scores.phq_total > 15 ? 'high' : 'moderate')
      : 'baseline';

    let sceneOrder = Number(sceneOrderParam);
    if (!Number.isFinite(sceneOrder)) {
      const currentSceneId = String(sessionRow.current_scene_id || '');
      const m = currentSceneId.match(/-s(\d{1,2})/i);
      sceneOrder = m ? Number(m[1]) : 1;
    }

    const emotionalState = (decisions && decisions.length)
      ? (decisions[decisions.length - 1]?.raw_mapping?.emotional_direction || 'stable')
      : 'stable';

    const nextSceneOrder = Math.max(1, Number(sceneOrder) + 1);
    const recentChoices = (decisions || []).slice(-3).map(d => d.option_id || d.option_text || '');

    const scenePathKey = hashObject({
      chapter_id,
      scene_order: nextSceneOrder,
      clinical_level: clinicalLevel,
      emotional_state: emotionalState,
      last_choices: recentChoices,
      prompt_version: PROMPT_VERSION
    });

    const { data: recentScenes } = await supabase
      .from('scenes')
      .select('scene_id, order, title, metadata')
      .eq('chapter_id', chapter_id)
      .lt('order', nextSceneOrder)
      .order('order', { ascending: false })
      .limit(3);

    const recentSceneTexts = (Array.isArray(recentScenes) ? recentScenes : [])
      .map((s) => (s && s.metadata && s.metadata.scene_text) ? String(s.metadata.scene_text) : '')
      .map((t) => String(t || '').trim())
      .filter(Boolean)
      .slice(0, 3);

    const recentSceneIds = (Array.isArray(recentScenes) ? recentScenes : []).map(s => s && s.scene_id).filter(Boolean);
    let recentOptionTexts = [];
    if (recentSceneIds.length > 0) {
      const { data: recentOpts } = await supabase
        .from('options')
        .select('option_text')
        .in('scene_id', recentSceneIds)
        .limit(12);
      recentOptionTexts = (Array.isArray(recentOpts) ? recentOpts : [])
        .map(o => String(o && o.option_text || '').trim())
        .filter(Boolean)
        .slice(0, 12);
    }

    // Best-effort checks for both legacy and new cache schemas.
    let cacheLegacy = null;
    let cacheVariant = null;
    try {
      const { data } = await supabase
        .from('narrative_path_cache')
        .select('*')
        .eq('path_key', scenePathKey)
        .order('quality_score', { ascending: false })
        .limit(1)
        .maybeSingle();
      cacheLegacy = data || null;
    } catch (e) {
      cacheLegacy = null;
    }

    try {
      const basePathKey = computeDeterministicPathKey({
        arc_id: null,
        chapter_id,
        last_choices: clampWindow(recentChoices, PATH_WINDOW_SIZE),
        segment: { clinical_level: clinicalLevel, user_pattern: 'engaged', age_group: 'adult' },
        critical_node: resolveCriticalNode(nextSceneOrder, {}),
        prompt_version: PROMPT_VERSION
      });

      const { data } = await supabase
        .from('narrative_path_cache')
        .select('*')
        .eq('base_path_key', basePathKey)
        .eq('is_active', true)
        .order('quality_score', { ascending: false })
        .limit(1)
        .maybeSingle();

      cacheVariant = {
        base_path_key: basePathKey,
        hit: Boolean(data),
        record: data || null
      };
    } catch (e) {
      cacheVariant = { error: e && e.message ? e.message : String(e) };
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ok: true,
      session_id: sessionId,
      chapter_id,
      scene_order_current: Number(sceneOrder),
      scene_order_next: Number(nextSceneOrder),
      generation_controls: {
        auto_continue_next_chapter: AUTO_CONTINUE_NEXT_CHAPTER,
        prefer_scene_by_scene_next_chapter: PREFER_SCENE_BY_SCENE_NEXT_CHAPTER,
        disable_lazy_scene_generation: DISABLE_LAZY_SCENE_GENERATION,
        week_chapter_count: WEEK_CHAPTER_COUNT,
        prompt_version: PROMPT_VERSION,
        path_window_size: PATH_WINDOW_SIZE
      },
      continuity: {
        emotional_state: emotionalState,
        clinical_level: clinicalLevel,
        last_choices: recentChoices
      },
      anti_repetition_context: {
        recent_scene_snippets: recentSceneTexts,
        recent_option_texts: recentOptionTexts
      },
      cache_probe: {
        scene_path_key: scenePathKey,
        legacy_path_key_hit: Boolean(cacheLegacy),
        legacy_record: cacheLegacy,
        variant_lookup: cacheVariant
      }
    }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

// Start HTTP server and route requests
const PORT = process.env.PORT || 7070;
const HOST = process.env.HOST || '127.0.0.1';

const server = http.createServer(async (req, res) => {
  const url = (req.url || '').split('?')[0];
  try {
    if (req.method === 'POST' && url === '/telemetry') return await handleTelemetry(req, res);
    if (req.method === 'POST' && url === '/identify') return await handleIdentify(req, res);
    if (req.method === 'POST' && url === '/alexa') return await handleAlexa(req, res);
if (req.method === 'PUT' && url.startsWith('/sessions/') && url.endsWith('/close')) return await handleSessionClose(req, res);
    if (req.method === 'GET' && url.startsWith('/sessions/') && url.endsWith('/summary')) return await handleSessionSummary(req, res);
    // SPRINT 2c: LLM Mapping endpoints
    if (req.method === 'POST' && url.startsWith('/decisions/') && url.includes('/compute-mapping') && url.endsWith('/compare')) return await handleComputeMappingCompare(req, res);
    if (req.method === 'POST' && url.startsWith('/decisions/') && url.endsWith('/compute-mapping')) return await handleComputeMapping(req, res);
    // SPRINT 3: Chapter generation endpoints
    if (req.method === 'GET' && url === '/chapters') return await handleGetChapters(req, res);
    if (req.method === 'GET' && url === '/chapters/display') return await handleDisplayChapters(req, res);
    if (req.method === 'POST' && url === '/chapters/generate') return await handleChapterGenerate(req, res);
    if (req.method === 'POST' && url === '/chapters/generate-week') return await handleChapterGenerate(req, res);
    // Prompt 1 + Prompt 2 workflow endpoints
    if (req.method === 'POST' && url === '/llm/arcs/plan') return await handleArcPlanGenerate(req, res);
    if (req.method === 'POST' && url === '/llm/arcs/generate-day') return await handleArcDayGenerate(req, res);
    if (req.method === 'GET' && url === '/llm/arcs/state') return await handleArcWorkflowState(req, res);
    if (req.method === 'GET' && url === '/llm/arcs/cache-kpis') return await handleNarrativeCacheKpis(req, res);
    if (req.method === 'GET' && url === '/analytics/dashboard-sessions') return await handleDashboardSessions(req, res);
    if (req.method === 'GET' && url === '/analytics/risk-overview') return await handleRiskOverview(req, res);
    if (req.method === 'GET' && url === '/admin/dashboard') return await handleOperationalDashboard(req, res);
    if (req.method === 'GET' && url === '/admin/review-queue') return await handleReviewQueue(req, res);
    if (req.method === 'POST' && url === '/admin/review-actions') return await handleReviewAction(req, res);
    if (req.method === 'GET' && url === '/admin/clinical-reports') return await handleClinicalReports(req, res);
    if (req.method === 'POST' && url === '/admin/sync-content') {
      try {
        await ensureOptionsUpsert();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, message: 'Content sync complete' }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: e && e.message }));
      }
    }
    if (req.method === 'GET' && url === '/debug/narrative-state') return await handleNarrativeDebugState(req, res);
    if (req.method === 'GET' && url === '/admin/llm-health') return await handleLLMHealth(req, res);
    if (req.method === 'GET' && (url === '/' || url === '/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, uptime_seconds: Math.floor(process.uptime()) }));
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'not found' }));
  } catch (err) {
    console.error('server handler error', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err && err.message ? err.message : String(err) }));
  }
});

// Ensure options and mappings are upserted from content, then start server
(async () => {
  try {
    // Disabled to prevent massive rate limits (502 Bad Gateway) on startup.
    // Use python scripts/supabase_direct_ingest.py instead!
    // await ensureOptionsUpsert();
  } catch (e) {
    console.warn('ensureOptionsUpsert failed at startup', e && e.message);
  }
  server.listen(PORT, HOST, () => console.log(`Telemetry API listening on ${PORT}`));
})();

process.on('uncaughtException', (err) => { console.error('uncaughtException', err); });
process.on('unhandledRejection', (r) => { console.error('unhandledRejection', r); });