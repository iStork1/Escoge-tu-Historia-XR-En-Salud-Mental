-- Migration 009: Stable scoring model + dashboard metrics expansion
-- Purpose:
-- 1) Make session_scores stable and bounded (GDS max=15, PHQ max=27)
-- 2) Recompute user_metrics_aggregated from session_scores on session close
-- 3) Expose richer metrics in dashboard_sessions view

BEGIN;

-- =====================================================
-- A) Stable session scoring (bounded totals)
-- =====================================================
CREATE OR REPLACE FUNCTION fn_compute_session_scores()
RETURNS TRIGGER AS $$
DECLARE
  v_session_id UUID;
  v_gds_total NUMERIC := 0;
  v_phq_total NUMERIC := 0;
  v_rating_count INT := 0;
BEGIN
  -- Determine target session from trigger source
  IF TG_TABLE_NAME = 'decisions' THEN
    v_session_id := NEW.session_id;
  ELSIF TG_TABLE_NAME = 'clinical_mappings' THEN
    v_session_id := (SELECT session_id FROM decisions WHERE decision_id = NEW.decision_id);
  ELSIF TG_TABLE_NAME = 'decision_ratings' THEN
    v_session_id := (SELECT session_id FROM decisions WHERE decision_id = NEW.decision_id);
  END IF;

  IF v_session_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Prefer decision_ratings when available (stable, bounded by scale design)
  SELECT COUNT(*)
  INTO v_rating_count
  FROM decision_ratings dr
  JOIN decisions d ON d.decision_id = dr.decision_id
  WHERE d.session_id = v_session_id;

  IF v_rating_count > 0 THEN
    -- GDS: item score in [0,1], aggregate max across repeated touches of same item; total max = 15
    SELECT COALESCE(SUM(LEAST(GREATEST(item_score, 0), 1)), 0)
    INTO v_gds_total
    FROM (
      SELECT dr.item, MAX(COALESCE(dr.value, 0)) AS item_score
      FROM decision_ratings dr
      JOIN decisions d ON d.decision_id = dr.decision_id
      WHERE d.session_id = v_session_id
        AND dr.scale = 'GDS'
      GROUP BY dr.item
    ) g;

    -- PHQ: item score in [0,1], scale to 0..3 to keep canonical PHQ max=27
    SELECT COALESCE(SUM(LEAST(GREATEST(item_score, 0), 1) * 3), 0)
    INTO v_phq_total
    FROM (
      SELECT dr.item, MAX(COALESCE(dr.value, 0)) AS item_score
      FROM decision_ratings dr
      JOIN decisions d ON d.decision_id = dr.decision_id
      WHERE d.session_id = v_session_id
        AND dr.scale = 'PHQ'
      GROUP BY dr.item
    ) p;
  ELSE
    -- Fallback for legacy data without decision_ratings
    SELECT COALESCE(SUM(cm.weight * cm.confidence), 0)
    INTO v_gds_total
    FROM clinical_mappings cm
    JOIN decisions d ON cm.decision_id = d.decision_id
    WHERE d.session_id = v_session_id AND cm.scale = 'GDS';

    SELECT COALESCE(SUM(cm.weight * cm.confidence), 0)
    INTO v_phq_total
    FROM clinical_mappings cm
    JOIN decisions d ON cm.decision_id = d.decision_id
    WHERE d.session_id = v_session_id AND cm.scale = 'PHQ';
  END IF;

  -- Hard bounds for stable dashboards
  v_gds_total := LEAST(15, GREATEST(0, v_gds_total));
  v_phq_total := LEAST(27, GREATEST(0, v_phq_total));

  INSERT INTO session_scores(session_id, gds_total, phq_total, computed_at)
  VALUES (v_session_id, v_gds_total, v_phq_total, now())
  ON CONFLICT (session_id) DO UPDATE
  SET gds_total = EXCLUDED.gds_total,
      phq_total = EXCLUDED.phq_total,
      computed_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compute_session_scores_on_decision ON decisions;
CREATE TRIGGER trg_compute_session_scores_on_decision
AFTER INSERT ON decisions
FOR EACH ROW EXECUTE FUNCTION fn_compute_session_scores();

DROP TRIGGER IF EXISTS trg_compute_session_scores_on_mapping ON clinical_mappings;
CREATE TRIGGER trg_compute_session_scores_on_mapping
AFTER INSERT ON clinical_mappings
FOR EACH ROW EXECUTE FUNCTION fn_compute_session_scores();

DROP TRIGGER IF EXISTS trg_compute_session_scores_on_decision_rating ON decision_ratings;
CREATE TRIGGER trg_compute_session_scores_on_decision_rating
AFTER INSERT OR UPDATE ON decision_ratings
FOR EACH ROW EXECUTE FUNCTION fn_compute_session_scores();

-- =====================================================
-- B) User metrics aggregation based on session_scores
-- =====================================================
CREATE OR REPLACE FUNCTION fn_sessions_after_update()
RETURNS TRIGGER AS $$
DECLARE
  v_gds_total NUMERIC := 0;
  v_phq_total NUMERIC := 0;
  v_gds_norm NUMERIC := 0;
  v_phq_norm NUMERIC := 0;
BEGIN
  -- Act only when session transitions to ended
  IF TG_OP = 'UPDATE' AND NEW.ended_at IS NOT NULL AND (OLD.ended_at IS NULL) THEN
    SELECT COALESCE(ss.gds_total, 0), COALESCE(ss.phq_total, 0)
    INTO v_gds_total, v_phq_total
    FROM session_scores ss
    WHERE ss.session_id = NEW.session_id;

    IF NOT FOUND THEN
      v_gds_total := 0;
      v_phq_total := 0;
    END IF;

    v_gds_norm := LEAST(1, GREATEST(0, v_gds_total / 15));
    v_phq_norm := LEAST(1, GREATEST(0, v_phq_total / 27));

    INSERT INTO user_metrics_aggregated(
      pseudonym,
      total_sessions,
      avg_session_length_seconds,
      abandonment_rate,
      avg_emotional_score_gds,
      avg_emotional_score_phq,
      last_risk_flag_date,
      frequency_of_use_days,
      updated_at
    )
    VALUES (
      NEW.pseudonym,
      1,
      COALESCE(NEW.session_length_seconds, 0),
      CASE WHEN NEW.abandonment_flag THEN 1 ELSE 0 END,
      v_gds_norm,
      v_phq_norm,
      (SELECT MAX(timestamp) FROM risk_events WHERE session_id = NEW.session_id),
      0,
      now()
    )
    ON CONFLICT (pseudonym) DO UPDATE
    SET
      total_sessions = user_metrics_aggregated.total_sessions + 1,
      avg_session_length_seconds = ((COALESCE(user_metrics_aggregated.avg_session_length_seconds,0) * user_metrics_aggregated.total_sessions) + COALESCE(NEW.session_length_seconds,0)) / (user_metrics_aggregated.total_sessions + 1),
      abandonment_rate = ((COALESCE(user_metrics_aggregated.abandonment_rate,0) * user_metrics_aggregated.total_sessions) + CASE WHEN NEW.abandonment_flag THEN 1 ELSE 0 END) / (user_metrics_aggregated.total_sessions + 1),
      avg_emotional_score_gds = ((COALESCE(user_metrics_aggregated.avg_emotional_score_gds,0) * user_metrics_aggregated.total_sessions) + v_gds_norm) / (user_metrics_aggregated.total_sessions + 1),
      avg_emotional_score_phq = ((COALESCE(user_metrics_aggregated.avg_emotional_score_phq,0) * user_metrics_aggregated.total_sessions) + v_phq_norm) / (user_metrics_aggregated.total_sessions + 1),
      last_risk_flag_date = GREATEST(COALESCE(user_metrics_aggregated.last_risk_flag_date, TO_TIMESTAMP(0)), (SELECT COALESCE(MAX(timestamp), TO_TIMESTAMP(0)) FROM risk_events WHERE session_id = NEW.session_id)),
      frequency_of_use_days = user_metrics_aggregated.frequency_of_use_days,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sessions_after_update ON sessions;
CREATE TRIGGER trg_sessions_after_update
AFTER UPDATE ON sessions
FOR EACH ROW EXECUTE FUNCTION fn_sessions_after_update();

-- =====================================================
-- C) Expanded dashboard view with clinical totals
-- =====================================================
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

COMMIT;
