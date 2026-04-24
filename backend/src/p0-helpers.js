const crypto = require('crypto');
const https = require('https');
const { URL } = require('url');

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isIsoDateTime(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const time = Date.parse(value);
  return Number.isFinite(time);
}

function isIntegerInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function makeError(path, message, keyword = 'validation') {
  return { path, message, keyword };
}

function validateTelemetryPayload(payload) {
  const errors = [];

  if (!isPlainObject(payload)) {
    return { valid: false, errors: [makeError('/', 'payload must be an object', 'type')] };
  }

  if (typeof payload.session_id !== 'undefined' && !isUuid(payload.session_id)) {
    errors.push(makeError('/session_id', 'must be a UUID', 'format'));
  }

  if (typeof payload.pseudonym !== 'undefined') {
    if (typeof payload.pseudonym !== 'string' || !payload.pseudonym.trim()) {
      errors.push(makeError('/pseudonym', 'must be a non-empty string', 'type'));
    } else if (payload.pseudonym.length > 64) {
      errors.push(makeError('/pseudonym', 'must not exceed 64 characters', 'maxLength'));
    }
  }

  if (typeof payload.consent_given !== 'undefined' && typeof payload.consent_given !== 'boolean') {
    errors.push(makeError('/consent_given', 'must be a boolean', 'type'));
  }

  if (typeof payload.privacy_mode !== 'undefined' && !['anonymous', 'tracking'].includes(payload.privacy_mode)) {
    errors.push(makeError('/privacy_mode', 'must be anonymous or tracking', 'enum'));
  }

  if (typeof payload.started_at !== 'undefined' && !isIsoDateTime(payload.started_at)) {
    errors.push(makeError('/started_at', 'must be an ISO 8601 date-time string', 'format'));
  }

  if (typeof payload.ended_at !== 'undefined' && payload.ended_at !== null && !isIsoDateTime(payload.ended_at)) {
    errors.push(makeError('/ended_at', 'must be an ISO 8601 date-time string or null', 'format'));
  }

  if (typeof payload.session_length_seconds !== 'undefined') {
    if (!Number.isInteger(payload.session_length_seconds) || payload.session_length_seconds < 0) {
      errors.push(makeError('/session_length_seconds', 'must be a non-negative integer', 'type'));
    }
  }

  if (typeof payload.device_id !== 'undefined' && typeof payload.device_id !== 'string') {
    errors.push(makeError('/device_id', 'must be a string', 'type'));
  }

  if (typeof payload.device_type !== 'undefined' && typeof payload.device_type !== 'string') {
    errors.push(makeError('/device_type', 'must be a string', 'type'));
  }

  if (typeof payload.metadata !== 'undefined' && !isPlainObject(payload.metadata)) {
    errors.push(makeError('/metadata', 'must be an object', 'type'));
  }

  if (typeof payload.abandonment_flag !== 'undefined' && typeof payload.abandonment_flag !== 'boolean') {
    errors.push(makeError('/abandonment_flag', 'must be a boolean', 'type'));
  }

  if (typeof payload.decisions !== 'undefined') {
    if (!Array.isArray(payload.decisions)) {
      errors.push(makeError('/decisions', 'must be an array', 'type'));
    } else {
      payload.decisions.forEach((decision, index) => {
        const basePath = `/decisions/${index}`;
        if (!isPlainObject(decision)) {
          errors.push(makeError(basePath, 'must be an object', 'type'));
          return;
        }

        if (typeof decision.decision_id !== 'undefined' && !isUuid(decision.decision_id)) {
          errors.push(makeError(`${basePath}/decision_id`, 'must be a UUID', 'format'));
        }

        if (!isIsoDateTime(decision.timestamp)) {
          errors.push(makeError(`${basePath}/timestamp`, 'must be an ISO 8601 date-time string', 'format'));
        }

        if (typeof decision.chapter_id !== 'undefined' && typeof decision.chapter_id !== 'string') {
          errors.push(makeError(`${basePath}/chapter_id`, 'must be a string', 'type'));
        }

        if (typeof decision.scene_id !== 'string' || !decision.scene_id.trim()) {
          errors.push(makeError(`${basePath}/scene_id`, 'must be a non-empty string', 'type'));
        }

        if (typeof decision.option_id !== 'string' || !decision.option_id.trim()) {
          errors.push(makeError(`${basePath}/option_id`, 'must be a non-empty string', 'type'));
        }

        if (typeof decision.option_text !== 'undefined' && typeof decision.option_text !== 'string') {
          errors.push(makeError(`${basePath}/option_text`, 'must be a string', 'type'));
        }

        if (typeof decision.time_to_decision_ms !== 'undefined' && (!Number.isInteger(decision.time_to_decision_ms) || decision.time_to_decision_ms < 0)) {
          errors.push(makeError(`${basePath}/time_to_decision_ms`, 'must be a non-negative integer', 'type'));
        }

        if (typeof decision.mapping_confidence !== 'undefined' && (typeof decision.mapping_confidence !== 'number' || decision.mapping_confidence < 0 || decision.mapping_confidence > 1)) {
          errors.push(makeError(`${basePath}/mapping_confidence`, 'must be a number between 0 and 1', 'range'));
        }

        if (typeof decision.validation_steps !== 'undefined' && !Array.isArray(decision.validation_steps)) {
          errors.push(makeError(`${basePath}/validation_steps`, 'must be an array', 'type'));
        }

        if (typeof decision.risk_flags !== 'undefined' && !Array.isArray(decision.risk_flags)) {
          errors.push(makeError(`${basePath}/risk_flags`, 'must be an array', 'type'));
        }

        if (typeof decision.raw_mapping !== 'undefined' && !isPlainObject(decision.raw_mapping)) {
          errors.push(makeError(`${basePath}/raw_mapping`, 'must be an object', 'type'));
        }

        if (typeof decision.parsed_mapping !== 'undefined' && !isPlainObject(decision.parsed_mapping)) {
          errors.push(makeError(`${basePath}/parsed_mapping`, 'must be an object', 'type'));
        }
      });
    }
  }

  if (typeof payload.session_id === 'undefined' && typeof payload.pseudonym === 'undefined' && typeof payload.decisions === 'undefined') {
    errors.push(makeError('/', 'must include session_id, pseudonym, or decisions', 'required'));
  }

  return { valid: errors.length === 0, errors };
}

function isAllowedAlexaCertificateUrl(certUrl) {
  if (typeof certUrl !== 'string' || !certUrl.trim()) return false;
  try {
    const parsed = new URL(certUrl);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.port && parsed.port !== '443') return false;
    const hostAllowed = parsed.hostname === 's3.amazonaws.com' || parsed.hostname.endsWith('.amazonaws.com');
    if (!hostAllowed) return false;
    return parsed.pathname.includes('/echo.api/');
  } catch (_err) {
    return false;
  }
}

function extractAlexaTimestamp(rawBody) {
  if (typeof rawBody !== 'string' || !rawBody.trim()) return null;
  try {
    const parsed = JSON.parse(rawBody);
    return parsed?.request?.timestamp || parsed?.timestamp || null;
  } catch (_err) {
    return null;
  }
}

function isFreshAlexaTimestamp(timestamp, now = Date.now(), maxSkewMs = 150000) {
  if (!isIsoDateTime(timestamp)) return false;
  const requestTime = Date.parse(timestamp);
  return Math.abs(Number(now) - requestTime) <= maxSkewMs;
}

function verifyBodySignature({ rawBody, certificatePem, signature, algorithms = ['RSA-SHA256', 'RSA-SHA1'] }) {
  if (typeof rawBody !== 'string' || !rawBody.trim()) return false;
  if (typeof certificatePem !== 'string' || (!certificatePem.includes('BEGIN CERTIFICATE') && !certificatePem.includes('BEGIN PUBLIC KEY'))) return false;
  if (typeof signature !== 'string' || !signature.trim()) return false;

  for (const algorithm of algorithms) {
    try {
      const verifier = crypto.createVerify(algorithm);
      verifier.update(rawBody, 'utf8');
      verifier.end();
      if (verifier.verify(certificatePem, signature, 'base64')) return true;
    } catch (_err) {
      // Try next algorithm.
    }
  }

  return false;
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, response => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        resolve(fetchText(response.headers.location));
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`certificate fetch failed with status ${response.statusCode}`));
        return;
      }

      let data = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { data += chunk; });
      response.on('end', () => resolve(data));
      response.on('error', reject);
    }).on('error', reject);
  });
}

async function verifyAlexaRequest({ headers = {}, rawBody = '', now = Date.now, certificateFetcher = fetchText, maxSkewMs = 150000 }) {
  const normalizedHeaders = Object.entries(headers || {}).reduce((acc, [key, value]) => {
    acc[String(key).toLowerCase()] = Array.isArray(value) ? value[0] : value;
    return acc;
  }, {});

  const signature = normalizedHeaders['x-amzn-signature'] || normalizedHeaders.signature || null;
  const certUrl = normalizedHeaders['x-amzn-signature-cert-chain-url'] || normalizedHeaders['x-amzn-signature-certchainurl'] || null;

  if (!signature || !certUrl) {
    return { valid: false, statusCode: 401, error: 'missing Alexa signature headers' };
  }

  if (!isAllowedAlexaCertificateUrl(certUrl)) {
    return { valid: false, statusCode: 403, error: 'invalid Alexa certificate url' };
  }

  let certificatePem;
  try {
    certificatePem = await certificateFetcher(certUrl);
  } catch (error) {
    return { valid: false, statusCode: 403, error: `certificate fetch failed: ${error && error.message ? error.message : error}` };
  }

  if (typeof certificatePem !== 'string' || !certificatePem.includes('BEGIN CERTIFICATE')) {
    return { valid: false, statusCode: 403, error: 'invalid Alexa certificate payload' };
  }

  try {
    const x509 = new crypto.X509Certificate(certificatePem);
    const currentTime = Number(now());
    const notBefore = Date.parse(x509.validFrom);
    const notAfter = Date.parse(x509.validTo);
    if (!Number.isFinite(notBefore) || !Number.isFinite(notAfter) || currentTime < notBefore || currentTime > notAfter) {
      return { valid: false, statusCode: 403, error: 'Alexa certificate expired or not yet valid' };
    }
  } catch (_err) {
    return { valid: false, statusCode: 403, error: 'unable to inspect Alexa certificate' };
  }

  let parsedBody;
  try {
    parsedBody = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  } catch (_err) {
    return { valid: false, statusCode: 400, error: 'invalid Alexa JSON body' };
  }

  const timestamp = extractAlexaTimestamp(rawBody);
  if (!isFreshAlexaTimestamp(timestamp, now(), maxSkewMs)) {
    return { valid: false, statusCode: 403, error: 'Alexa request timestamp outside allowed window' };
  }

  const signatureOk = verifyBodySignature({ rawBody, certificatePem, signature });
  if (!signatureOk) {
    return { valid: false, statusCode: 403, error: 'Alexa signature verification failed' };
  }

  return { valid: true, payload: parsedBody, certificateUrl: certUrl };
}

module.exports = {
  extractAlexaTimestamp,
  isAllowedAlexaCertificateUrl,
  isFreshAlexaTimestamp,
  isIsoDateTime,
  isPlainObject,
  isUuid,
  validateTelemetryPayload,
  verifyAlexaRequest,
  verifyBodySignature
};