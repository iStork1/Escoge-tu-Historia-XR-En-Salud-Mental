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
} catch (_err) {
  // Continue when dotenv is unavailable.
}

const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const { computeRiskSlaState, summarizeRiskEvents } = require('./p0-helpers');

const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getNotifierWebhookUrl() {
  return String(process.env.RISK_NOTIFICATION_WEBHOOK_URL || '').trim() || null;
}

async function defaultNotifier(event, attempt) {
  const webhookUrl = getNotifierWebhookUrl();
  const payload = {
    risk_event_id: event.risk_event_id,
    session_id: event.session_id,
    decision_id: event.decision_id,
    risk_type: event.risk_type,
    score: event.score,
    threshold_used: event.threshold_used,
    status: attempt.status,
    operational_state: attempt.operational_state,
    attempt_id: attempt.attempt_id,
    created_at: attempt.created_at
  };

  if (!webhookUrl) {
    console.log('[risk-worker] notification payload', JSON.stringify(payload));
    return { ok: true, channel: 'log' };
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`notification webhook returned ${response.status}`);
  }

  return { ok: true, channel: 'webhook', status: response.status };
}

async function recordAttempt(event, attempt, result) {
  if (!supabase) return null;
  const row = {
    risk_event_id: event.risk_event_id,
    attempt_number: attempt.attempt_number,
    channel: result.channel || 'log',
    status: result.ok ? 'sent' : 'failed',
    provider_message_id: result.message_id || null,
    payload: attempt,
    error: result.error || null
  };

  const { error } = await supabase.from('risk_event_notifications').insert([row]);
  if (error) throw error;
  return row;
}

async function updateRiskEvent(event, updates) {
  if (!supabase) return;
  const { error } = await supabase
    .from('risk_events')
    .update(updates)
    .eq('risk_event_id', event.risk_event_id);
  if (error) throw error;
}

async function runRiskNotificationCycle({ limit = 25, notifier = defaultNotifier, now = Date.now } = {}) {
  if (!supabase) {
    return { ok: false, error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured' };
  }

  const { data: pendingEvents, error } = await supabase
    .from('risk_events')
    .select('*')
    .eq('notified', false)
    .order('timestamp', { ascending: true })
    .limit(limit);

  if (error) throw error;

  const results = [];
  for (const event of pendingEvents || []) {
    const operationalState = computeRiskSlaState(event, now());
    const attemptNumber = Number(event.notification_attempts || 0) + 1;
    const attemptId = uuidv4();
    const attempt = {
      attempt_id: attemptId,
      attempt_number: attemptNumber,
      created_at: new Date(now()).toISOString(),
      operational_state: operationalState,
      status: 'queued'
    };

    try {
      const notificationResult = await notifier(event, attempt);
      const timestamps = {
        notified_at: event.notified_at || attempt.created_at,
        first_action_at: event.first_action_at || attempt.created_at,
        status: operationalState.breached_notification ? 'escalated' : operationalState.status,
        notified: true,
        action_taken: event.action_taken || 'NOTIFIED_BY_WORKER',
        notification_attempts: attemptNumber,
        escalation_level: operationalState.escalation_level
      };
      await updateRiskEvent(event, timestamps);
      await recordAttempt(event, attempt, notificationResult);
      results.push({ risk_event_id: event.risk_event_id, ok: true, attempt_id: attemptId });
    } catch (workerError) {
      const failedResult = { ok: false, channel: 'log', error: workerError.message || String(workerError) };
      await recordAttempt(event, attempt, failedResult).catch(() => null);
      await updateRiskEvent(event, {
        action_taken: event.action_taken || 'NOTIFICATION_FAILED',
        notification_attempts: attemptNumber,
        escalation_level: Math.max(operationalState.escalation_level, 1),
        notified: Boolean(event.notified),
        status: operationalState.status === 'open' ? 'overdue_notification' : operationalState.status
      }).catch(() => null);
      results.push({ risk_event_id: event.risk_event_id, ok: false, attempt_id: attemptId, error: failedResult.error });
    }
  }

  const { data: updatedEvents } = await supabase
    .from('risk_events')
    .select('*')
    .eq('notified', false)
    .order('timestamp', { ascending: true })
    .limit(limit);

  return {
    ok: true,
    processed: results.length,
    results,
    pending_summary: summarizeRiskEvents(updatedEvents || [])
  };
}

async function main() {
  if (!supabase) {
    console.warn('[risk-worker] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
    process.exitCode = 0;
    return;
  }

  const once = String(process.env.RISK_WORKER_ONCE || 'false').toLowerCase() === 'true';
  const intervalMs = Math.max(15000, Number(process.env.RISK_WORKER_INTERVAL_MS || 60000));

  if (once) {
    const report = await runRiskNotificationCycle();
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  while (true) {
    try {
      const report = await runRiskNotificationCycle();
      console.log(JSON.stringify(report, null, 2));
    } catch (error) {
      console.error('[risk-worker] cycle error', error && error.message ? error.message : error);
    }
    await sleep(intervalMs);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('[risk-worker] fatal error', error && error.message ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = { defaultNotifier, runRiskNotificationCycle };