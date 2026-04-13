/**
 * SSML Helpers for Alexa Narrative Immersion
 * 
 * Helper functions to easily apply SSML markup for emotional immersion
 * in Alexa storytelling. These functions keep the code clean while adding
 * powerful narrative control through voice modulation.
 * 
 * Usage:
 *   const { pause, whisper, slow, emphasize, emotional } = require('./ssml-helpers');
 *   const response = `${pause(500)} Hoy, ${whisper('después de desayunar')}, comes en silencio.`;
 */

/**
 * Create a pause break in narration
 * @param {number} ms - milliseconds (default: 500ms)
 * @returns {string} SSML break tag
 */
const pause = (ms = 500) => `<break time="${ms}ms"/>`;

/**
 * Transform text to whispered voice for intimacy and vulnerability
 * @param {string} text - text to whisper
 * @returns {string} whispered SSML markup
 */
const whisper = (text) => `<amazon:effect name="whispered">${text}</amazon:effect>`;

/**
 * Slow down narration for dramatic moments, reflection, or tension
 * @param {string} text - text to slow
 * @param {number} rate - speech rate percentage (default: 85%, range 20-200)
 * @returns {string} SSML prosody markup for rate
 */
const slow = (text, rate = 85) => `<prosody rate="${rate}%">${text}</prosody>`;

/**
 * Speed up narration for action, urgency, or energy
 * @param {string} text - text to accelerate
 * @param {number} rate - speech rate percentage (default: 120%, range 20-200)
 * @returns {string} SSML prosody markup for rate
 */
const fast = (text, rate = 120) => `<prosody rate="${rate}%">${text}</prosody>`;

/**
 * Emphasize words or phrases - make them stand out emotionally
 * @param {string} text - text to emphasize
 * @param {string} level - 'strong', 'moderate' (default), 'reduced'
 * @returns {string} SSML emphasis markup
 */
const emphasize = (text, level = 'moderate') => `<emphasis level="${level}">${text}</emphasis>`;

/**
 * Lower pitch for somber, heavy, or sad moments
 * @param {string} text - text to lower pitch
 * @param {number} semitones - adjustment in semitones (default: -6, range ±20)
 * @returns {string} SSML prosody markup for pitch
 */
const darker = (text, semitones = -6) => `<prosody pitch="${semitones > 0 ? '+' : ''}${semitones}%">${text}</prosody>`;

/**
 * Raise pitch for lightness, surprise, or joy
 * @param {string} text - text to raise pitch
 * @param {number} semitones - adjustment in semitones (default: +5, range ±20)
 * @returns {string} SSML prosody markup for pitch
 */
const lighter = (text, semitones = 5) => `<prosody pitch="+${semitones}%">${text}</prosody>`;

/**
 * Lower volume for private thoughts or intimate moments
 * @param {string} text - text to quiet
 * @param {string} level - volume level (default: 'soft', 'x-soft', 'medium', 'loud', 'x-loud')
 * @returns {string} SSML prosody markup for volume
 */
const quiet = (text, level = 'soft') => `<prosody volume="${level}">${text}</prosody>`;

/**
 * Increase volume for emphasis or urgency
 * @param {string} text - text to amplify
 * @param {string} level - volume level (default: 'loud')
 * @returns {string} SSML prosody markup for volume
 */
const loud = (text, level = 'loud') => `<prosody volume="${level}">${text}</prosody>`;

/**
 * Apply multiple emotional effects to a phrase
 * Useful for complex emotional moments
 * 
 * @param {object} config - configuration object
 *   - text: string (required)
 *   - speed: 'slow', 'normal', 'fast' or percentage (affects rate)
 *   - tone: 'dark', 'light', or semitone number (affects pitch)
 *   - volume: 'quiet', 'normal', 'loud' or specific level (affects volume)
 *   - emphasis: false or 'strong', 'moderate', 'reduced'
 *   - effect: false or 'whisper'
 * @returns {string} SSML with combined markups
 */
const emotional = (config) => {
  const { text, speed, tone, volume, emphasis: emph, effect } = config;
  let result = text;

  // Apply effect (whisper)
  if (effect === 'whisper') {
    result = whisper(result);
  }

  // Apply speed (rate)
  if (speed) {
    let rate;
    if (speed === 'slow') rate = 80;
    else if (speed === 'normal') rate = 100;
    else if (speed === 'fast') rate = 120;
    else rate = speed;
    result = `<prosody rate="${rate}%">${result}</prosody>`;
  }

  // Apply tone (pitch)
  if (tone) {
    let pitch;
    if (tone === 'dark') pitch = -8;
    else if (tone === 'light') pitch = 5;
    else pitch = tone;
    result = `<prosody pitch="${pitch > 0 ? '+' : ''}${pitch}%">${result}</prosody>`;
  }

  // Apply volume
  if (volume) {
    let vol;
    if (volume === 'quiet') vol = 'soft';
    else if (volume === 'normal') vol = 'medium';
    else if (volume === 'loud') vol = 'loud';
    else vol = volume;
    result = `<prosody volume="${vol}">${result}</prosody>`;
  }

  // Apply emphasis
  if (emph) {
    result = `<emphasis level="${emph}">${result}</emphasis>`;
  }

  return result;
};

/**
 * CHARACTER VOICE PROFILES
 * Define distinct voices for different characters using prosody modulation
 * This creates theatrical quality without changing TTS engine
 * 
 * Usage: characterSays('Don Hernando', 'Un momento de paz')
 */
const characterVoices = {
  // Rosa: introspective, vulnerable, often quiet
  rosa: { rate: 85, pitch: 0, volume: 'medium', emphasis: false },
  
  // Don Hernando: wise elder, reflective, slow and measured
  hernando: { rate: 70, pitch: -8, volume: 'soft', emphasis: false },
  
  // Sofía: optimistic, energetic, higher pitch
  sofia: { rate: 110, pitch: 6, volume: 'medium', emphasis: 'moderate' },
  
  // Camilo: knowledgeable, enthusiastic
  camilo: { rate: 105, pitch: 3, volume: 'medium', emphasis: false },
  
  // Amparo: warm, caring, motherly
  amparo: { rate: 90, pitch: 2, volume: 'medium', emphasis: false },
  
  // Rosa's inner voice: very quiet, intimate, dark
  rosa_inner: { rate: 80, pitch: -2, volume: 'x-soft', effect: 'whisper' },
};

/**
 * Apply character voice to spoken dialogue
 * @param {string} character - character name (must exist in characterVoices)
 * @param {string} dialogue - what the character says
 * @returns {string} SSML with character voice applied
 */
const characterSays = (character, dialogue) => {
  const voice = characterVoices[character.toLowerCase()];
  if (!voice) {
    console.warn(`Character '${character}' not found in characterVoices`);
    return dialogue;
  }

  let result = dialogue;

  // Apply effect first if present
  if (voice.effect === 'whisper') {
    result = whisper(result);
  }

  // Apply prosody (rate, pitch, volume)
  const prosodyAttrs = [];
  if (voice.rate) prosodyAttrs.push(`rate="${voice.rate}%"`);
  if (voice.pitch) prosodyAttrs.push(`pitch="${voice.pitch > 0 ? '+' : ''}${voice.pitch}%"`);
  if (voice.volume) prosodyAttrs.push(`volume="${voice.volume}"`);

  if (prosodyAttrs.length > 0) {
    result = `<prosody ${prosodyAttrs.join(' ')}>${result}</prosody>`;
  }

  // Apply emphasis if specified
  if (voice.emphasis) {
    result = `<emphasis level="${voice.emphasis}">${result}</emphasis>`;
  }

  return result;
};

/**
 * Predefined emotional patterns for common narrative moments
 */
const patterns = {
  // When character is experiencing loss or deep sadness
  grief: (text) => emotional({
    text,
    speed: 'slow',
    tone: 'dark',
    volume: 'quiet',
  }),

  // When character is uncertain or afraid
  anxiety: (text) => emotional({
    text,
    speed: 'slow',
    tone: 'dark',
    emphasis: 'reduced',
  }),

  // When character discovers something shocking
  shock: (text) => emotional({
    text,
    speed: 'fast',
    tone: 'light',
    emphasis: 'strong',
  }),

  // When character is joyful or hopeful
  joy: (text) => emotional({
    text,
    speed: 'normal',
    tone: 'light',
    emphasis: 'moderate',
  }),

  // When character is reflecting or thinking deeply
  reflection: (text) => emotional({
    text,
    speed: 'normal',
    volume: 'quiet',
    effect: 'whisper',
  }),

  // When character speaks with quiet determination
  resolve: (text) => emotional({
    text,
    speed: 'slow',
    emphasis: 'moderate',
  }),

  // When there's tension or suspense building
  tension: (text) => emotional({
    text,
    speed: 'slow',
    tone: 'dark',
    emphasis: 'strong',
  }),

  // When something tender or intimate is happening
  intimate: (text) => emotional({
    text,
    effect: 'whisper',
    volume: 'quiet',
    tone: 'light',
  }),
};

/**
 * Create a complete narrative response with controlled emotional flow
 * 
 * Structure your narrative with emotional stages:
 * - setup: establishes context (normal pace)
 * - conflict: introduces the problem (varied pace)
 * - climax: emotional peak (maximum variation)
 * - resolution: winds down (calming)
 * 
 * @param {object} segment - narrative segment configuration
 *   - setup: string (normal pace)
 *   - conflict: string or {text, pattern}
 *   - climax: string or {text, pattern}
 *   - resolution: string (calming)
 *   - breakBefore: milliseconds before setup
 *   - breakAfter: milliseconds after resolution
 * @returns {string} complete SSML-marked response
 */
const narrativeSegment = (segment) => {
  const {
    setup,
    conflict,
    climax,
    resolution,
    breakBefore = 300,
    breakAfter = 500,
  } = segment;

  let result = '';

  if (breakBefore) result += pause(breakBefore);
  if (setup) result += setup;

  if (conflict) {
    result += pause(300);
    if (typeof conflict === 'string') {
      result += conflict;
    } else {
      const { text, pattern = 'tension' } = conflict;
      result += patterns[pattern](text);
    }
  }

  if (climax) {
    result += pause(400);
    if (typeof climax === 'string') {
      result += climax;
    } else {
      const { text, pattern = 'shock' } = climax;
      result += patterns[pattern](text);
    }
  }

  if (resolution) {
    result += pause(300);
    result += slow(resolution, 85);
  }

  if (breakAfter) result += pause(breakAfter);

  return result;
};

/**
 * LONG-FORM NARRATIVE DOMAIN
 * Wraps content in Amazon's neural TTS long-form domain for storytelling
 * This makes narration sound significantly more natural and theatrical
 * 
 * @param {string} content - SSML content or plain text
 * @returns {string} Wrapped in <amazon:domain name="long-form">
 */
const longForm = (content) => {
  const isAlreadyWrapped = content.includes('<speak') || content.includes('amazon:domain');
  if (isAlreadyWrapped) return content;
  return `<amazon:domain name="long-form">${content}</amazon:domain>`;
};

/**
 * NARRATIVE TENSION CASCADE
 * Creates emotional progression through pitch/rate/volume reduction
 * Perfect for discovery moments or emotional climaxes
 * 
 * Example: User finds a photo of their dead spouse in the garden
 * 
 * @param {object} cascade - configuration
 *   - line1: text (normal)
 *   - line2: text (slight slow down)
 *   - line3: text (moderate slow down)
 *   - line4: text (climax - very slow, very dark, whisper)
 *   - pausesBetween: array of ms (default: [400, 300, 600])
 * @returns {string} SSML with emotional escalation
 */
const narrativeTensionCascade = (cascade) => {
  const {
    line1,
    line2,
    line3,
    line4,
    pausesBetween = [400, 300, 600, 1500],
  } = cascade;

  let result = '';

  if (line1) {
    result += line1;
    result += pause(pausesBetween[0] || 400);
  }

  if (line2) {
    result += slow(line2, 90);
    result += pause(pausesBetween[1] || 300);
  }

  if (line3) {
    result += slow(line3, 75);
    result += pause(pausesBetween[2] || 600);
  }

  if (line4) {
    result += quiet(slow(darker(line4, -8), 65), 'x-soft');
    result += pause(pausesBetween[3] || 1500);
  }

  return result;
};

module.exports = {
  // Basic functions
  pause,
  whisper,
  slow,
  fast,
  emphasize,
  darker,
  lighter,
  quiet,
  loud,

  // Advanced functions
  emotional,
  narrativeSegment,
  characterSays,
  longForm,
  narrativeTensionCascade,

  // Pre-built patterns
  patterns,
  characterVoices,

  // Validation and sanitization
  sanitizeSsml,
};

/**
 * Sanitize and validate SSML to ensure Alexa compatibility
 * Fixes invalid SSML attributes and tag values
 * 
 * @param {string} ssml - Raw SSML text (may contain invalid values)
 * @returns {string} Validated SSML safe for Alexa
 */
function sanitizeSsml(ssml) {
  if (!ssml || typeof ssml !== 'string') return ssml;

  let result = ssml;

  // Fix invalid emphasis levels: high → strong, low → reduced, others → moderate
  result = result.replace(/<emphasis level="([^"]*)">/gi, (match, level) => {
    const validLevels = ['strong', 'moderate', 'reduced'];
    const normalized = level.toLowerCase().trim();
    
    if (validLevels.includes(normalized)) return match;
    
    // Map invalid values to valid ones
    if (normalized === 'high' || normalized === 'very' || normalized === 'max') {
      return `<emphasis level="strong">`;
    } else if (normalized === 'low' || normalized === 'min' || normalized === 'subtle') {
      return `<emphasis level="reduced">`;
    }
    
    // Default to moderate for unknown values
    return `<emphasis level="moderate">`;
  });

  return result;
}

