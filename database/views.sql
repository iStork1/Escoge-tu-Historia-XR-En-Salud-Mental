-- Views for dashboards and reporting

CREATE OR REPLACE VIEW dashboard_sessions AS
SELECT
  pseudonym,
  COUNT(*) as total_sessions,
  AVG(session_length_seconds) as avg_session_duration,
  SUM(CASE WHEN abandonment_flag THEN 1 ELSE 0 END) as abandoned_sessions
FROM sessions
GROUP BY pseudonym;

CREATE OR REPLACE VIEW risk_overview AS
SELECT
  DATE(timestamp) as date,
  risk_type,
  COUNT(*) as events,
  AVG(score) as avg_score
FROM risk_events
GROUP BY DATE(timestamp), risk_type;
