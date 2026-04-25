-- ========================================================================
-- Migration 010: Operational risk notification flow and SLA tracking
-- Purpose: add traceable notification attempts and SLA timestamps
-- ========================================================================

ALTER TABLE risk_events
  ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notification_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalation_level INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sla_target_minutes INT DEFAULT 15,
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'open';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'risk_events_status_check'
  ) THEN
    ALTER TABLE risk_events
      ADD CONSTRAINT risk_events_status_check
      CHECK (status IN ('open','notified','in_progress','resolved','closed','overdue_notification','overdue_action','overdue_closure','escalated'));
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS risk_event_notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_event_id UUID REFERENCES risk_events(risk_event_id) ON DELETE CASCADE,
  attempt_number INT NOT NULL,
  channel VARCHAR(30) NOT NULL,
  status VARCHAR(20) CHECK (status IN ('queued','sent','failed','acknowledged')) DEFAULT 'queued',
  provider_message_id TEXT,
  payload JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_events_notified_resolved ON risk_events (notified, resolved, status, timestamp);
CREATE INDEX IF NOT EXISTS idx_risk_event_notifications_risk_event_id ON risk_event_notifications (risk_event_id, attempt_number);