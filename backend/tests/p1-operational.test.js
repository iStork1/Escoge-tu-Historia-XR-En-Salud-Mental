const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  computeRiskSlaState,
  summarizeRiskEvents,
  verifyOperationalAccess
} = require('../src/p0-helpers');

test('documents the review and clinical report endpoints in the router', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  assert.ok(source.includes('/admin/dashboard'), 'visual dashboard endpoint should be routed');
  assert.ok(source.includes('/admin/review-queue'), 'review queue endpoint should be routed');
  assert.ok(source.includes('/admin/review-actions'), 'review action endpoint should be routed');
  assert.ok(source.includes('/admin/clinical-reports'), 'clinical reports endpoint should be routed');
  assert.ok(source.includes('verifyOperationalAccess'), 'operational auth should guard the endpoints');
});

test('accepts dashboard access when an operational token is configured', () => {
  const previous = process.env.OPERATIONS_API_KEY;
  process.env.OPERATIONS_API_KEY = 'dashboard-token';

  try {
    assert.equal(verifyOperationalAccess({ authorization: 'Bearer dashboard-token' }).valid, true);
    assert.equal(verifyOperationalAccess({ 'x-api-key': 'dashboard-token' }).valid, true);
    assert.equal(verifyOperationalAccess({ authorization: 'Bearer wrong-token' }).valid, false);
  } finally {
    if (typeof previous === 'undefined') delete process.env.OPERATIONS_API_KEY;
    else process.env.OPERATIONS_API_KEY = previous;
  }
});

test('computes operational SLA breaches for risk events', () => {
  const state = computeRiskSlaState({
    timestamp: '2026-04-24T10:00:00Z',
    notified: false,
    resolved: false,
    action_taken: 'AUTO_INSERT'
  }, Date.parse('2026-04-24T10:40:00Z'), {
    notificationMinutes: 15,
    firstActionMinutes: 30,
    closureMinutes: 1440
  });

  assert.equal(state.status, 'overdue_action');
  assert.equal(state.breached_notification, true);
  assert.equal(state.breached_first_action, true);
  assert.equal(state.escalation_level >= 2, true);
});

test('summarizes risk events for operational reporting', () => {
  const report = summarizeRiskEvents([
    { timestamp: '2026-04-24T10:00:00Z', notified: false, resolved: false },
    { timestamp: '2026-04-24T09:00:00Z', notified: true, first_action_at: '2026-04-24T09:10:00Z', resolved: true }
  ], Date.parse('2026-04-24T10:40:00Z'));

  assert.equal(report.total, 2);
  assert.ok(Object.keys(report.by_status).length > 0);
  assert.equal(Array.isArray(report.rows), true);
});