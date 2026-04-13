-- Views for dashboards and reporting

CREATE OR REPLACE VIEW dashboard_sessions AS
SELECT
  s.pseudonym,
  COUNT(*) AS total_sessions,
  AVG(s.session_length_seconds) AS avg_session_duration,
  SUM(CASE WHEN s.abandonment_flag THEN 1 ELSE 0 END) AS abandoned_sessions,
  ROUND(COALESCE(AVG(ss.gds_total), 0)::numeric, 3) AS avg_gds_total,
  ROUND(COALESCE(AVG(ss.phq_total), 0)::numeric, 3) AS avg_phq_total,
  ROUND(COALESCE(MAX(ss.gds_total), 0)::numeric, 3) AS max_gds_total,
  ROUND(COALESCE(MAX(ss.phq_total), 0)::numeric, 3) AS max_phq_total,
  ROUND(COALESCE(AVG(ss.gds_total / 15.0), 0)::numeric, 3) AS avg_gds_normalized,
  ROUND(COALESCE(AVG(ss.phq_total / 27.0), 0)::numeric, 3) AS avg_phq_normalized,
  MAX(s.started_at) AS last_session_at
FROM sessions s
LEFT JOIN session_scores ss ON ss.session_id = s.session_id
GROUP BY s.pseudonym;

CREATE OR REPLACE VIEW risk_overview AS
SELECT
  DATE(timestamp) as date,
  risk_type,
  COUNT(*) as events,
  AVG(score) as avg_score
FROM risk_events
GROUP BY DATE(timestamp), risk_type;

-- Note: clinician review dashboard views are created in migrations/007_clinical_review_dashboard.sql.
-- If you choose to prune that feature (migration 008), keep them out of this file.
