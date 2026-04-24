const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  isAllowedAlexaCertificateUrl,
  isFreshAlexaTimestamp,
  validateTelemetryPayload,
  verifyBodySignature
} = require('../src/p0-helpers');

test('rejects Alexa consent bypass in source', () => {
  const indexSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  assert.ok(!indexSource.includes(".eq('pseudonym', pn)"), 'previous-session consent lookup should not remain in the Alexa consent flow');
});

test('uses session_scores in the session aggregation trigger', () => {
  const triggers = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'audit_triggers.sql'), 'utf8');
  assert.ok(triggers.includes('session_scores'), 'session aggregation should read from session_scores');
  assert.ok(!triggers.includes('NEW.normalized_emotional_score_gds'), 'legacy normalized session fields should not be used');
  assert.ok(!triggers.includes('NEW.normalized_emotional_score_phq'), 'legacy normalized session fields should not be used');
});

test('accepts a well-formed telemetry payload', () => {
  const payload = {
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    pseudonym: 'user_123',
    consent_given: true,
    started_at: '2026-04-24T10:00:00Z',
    decisions: [
      {
        decision_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        timestamp: '2026-04-24T10:02:00Z',
        chapter_id: 'c01',
        scene_id: 'c01-s01',
        option_id: 'c01-s01-o1',
        option_text: 'Leer la tarjeta con atención y curiosidad',
        time_to_decision_ms: 4200,
        mapping_confidence: 0.82,
        validation_steps: ['schema_ok'],
        risk_flags: [],
        raw_mapping: { clinical_mapping: [] }
      }
    ]
  };

  const result = validateTelemetryPayload(payload);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('rejects malformed telemetry payloads', () => {
  const payload = {
    session_id: 'not-a-uuid',
    decisions: [
      {
        timestamp: 'invalid-date',
        scene_id: '',
        option_id: ''
      }
    ]
  };

  const result = validateTelemetryPayload(payload);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(err => err.path === '/session_id'));
  assert.ok(result.errors.some(err => err.path === '/decisions/0/timestamp'));
});

test('allows only Alexa certificate URLs that match the expected domain/path', () => {
  assert.equal(isAllowedAlexaCertificateUrl('https://s3.amazonaws.com/echo.api/echo-api-cert-4.pem'), true);
  assert.equal(isAllowedAlexaCertificateUrl('http://s3.amazonaws.com/echo.api/echo-api-cert-4.pem'), false);
  assert.equal(isAllowedAlexaCertificateUrl('https://evil.example.com/echo.api/cert.pem'), false);
});

test('treats Alexa timestamps outside the freshness window as stale', () => {
  const now = Date.parse('2026-04-24T10:00:00Z');
  assert.equal(isFreshAlexaTimestamp('2026-04-24T09:59:00Z', now, 150000), true);
  assert.equal(isFreshAlexaTimestamp('2026-04-24T09:55:00Z', now, 150000), false);
});

test('verifies signed request bodies against the provided public key', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const rawBody = '{"request":{"timestamp":"2026-04-24T10:00:00Z"}}';
  const signature = crypto.createSign('RSA-SHA256').update(rawBody).end().sign(privateKey, 'base64');

  assert.equal(verifyBodySignature({ rawBody, certificatePem: publicKeyPem, signature }), true);
  assert.equal(verifyBodySignature({ rawBody: rawBody + 'x', certificatePem: publicKeyPem, signature }), false);
});