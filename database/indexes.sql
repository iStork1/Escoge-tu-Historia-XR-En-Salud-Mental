-- Recommended indexes for performance

CREATE INDEX IF NOT EXISTS idx_sessions_pseudonym ON sessions(pseudonym);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_decisions_session_id_timestamp ON decisions(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_clinical_mappings_decision_id ON clinical_mappings(decision_id);
CREATE INDEX IF NOT EXISTS idx_clinical_mappings_scale_item ON clinical_mappings(scale, item);
CREATE INDEX IF NOT EXISTS idx_risk_events_timestamp ON risk_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_metrics_updated ON user_metrics_aggregated(updated_at);
CREATE INDEX IF NOT EXISTS idx_audio_metrics_session ON audio_metrics(session_id);
