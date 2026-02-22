-- Triggers and helper functions for auditing and simple risk detection

-- ===== RISK DETECTION TRIGGERS =====

-- Function: on insert into clinical_mappings, detect PHQ9 item 9 and GDS item 7 risk
CREATE OR REPLACE FUNCTION fn_clinical_mappings_after_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- If mapping is PHQ item 9 and weight*confidence >= 0.2 -> create risk_event
  IF (NEW.scale = 'PHQ' AND NEW.item = 9 AND (COALESCE(NEW.weight,0) * COALESCE(NEW.confidence,0)) >= 0.2) THEN
    INSERT INTO risk_events(session_id, decision_id, risk_type, score, threshold_used, action_taken, notified)
    SELECT
      d.session_id,
      NEW.decision_id,
      'PHQ9_ITEM9_SELFHARM',
      (COALESCE(NEW.weight,0) * COALESCE(NEW.confidence,0)),
      0.2,
      'AUTO_INSERT',
      FALSE
    FROM decisions d
    WHERE d.decision_id = NEW.decision_id;
  END IF;
  
  -- If mapping is GDS item 7 (social engagement) and weight*confidence >= 0.3 -> create risk_event
  IF (NEW.scale = 'GDS' AND NEW.item = 7 AND (COALESCE(NEW.weight,0) * COALESCE(NEW.confidence,0)) >= 0.3) THEN
    INSERT INTO risk_events(session_id, decision_id, risk_type, score, threshold_used, action_taken, notified)
    SELECT
      d.session_id,
      NEW.decision_id,
      'GDS7_SOCIAL_ISOLATION',
      (COALESCE(NEW.weight,0) * COALESCE(NEW.confidence,0)),
      0.3,
      'AUTO_INSERT',
      FALSE
    FROM decisions d
    WHERE d.decision_id = NEW.decision_id
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_clinical_mappings_after_insert ON clinical_mappings;
CREATE TRIGGER trg_clinical_mappings_after_insert
AFTER INSERT ON clinical_mappings
FOR EACH ROW EXECUTE FUNCTION fn_clinical_mappings_after_insert();

-- ===== SESSION SCORE POPULATION TRIGGER =====

-- Function: compute and update session_scores when decisions inserted or clinical_mappings updated
CREATE OR REPLACE FUNCTION fn_compute_session_scores()
RETURNS TRIGGER AS $$
DECLARE
  v_session_id UUID;
  v_gds_total NUMERIC;
  v_phq_total NUMERIC;
BEGIN
  -- Determine which session to update based on which table fired the trigger
  IF TG_TABLE_NAME = 'decisions' THEN
    v_session_id := NEW.session_id;
  ELSIF TG_TABLE_NAME = 'clinical_mappings' THEN
    v_session_id := (SELECT session_id FROM decisions WHERE decision_id = NEW.decision_id);
  END IF;

  -- Calculate GDS total: sum of (item score) for all GDS mappings in this session
  SELECT COALESCE(SUM(cm.weight * cm.confidence), 0)
  INTO v_gds_total
  FROM clinical_mappings cm
  JOIN decisions d ON (cm.decision_id = d.decision_id OR cm.option_id = (SELECT option_id FROM decisions WHERE decision_id = cm.decision_id))
  WHERE d.session_id = v_session_id AND cm.scale = 'GDS';

  -- Calculate PHQ total: sum of (item score) for all PHQ mappings in this session
  SELECT COALESCE(SUM(cm.weight * cm.confidence), 0)
  INTO v_phq_total
  FROM clinical_mappings cm
  JOIN decisions d ON (cm.decision_id = d.decision_id OR cm.option_id = (SELECT option_id FROM decisions WHERE decision_id = cm.decision_id))
  WHERE d.session_id = v_session_id AND cm.scale = 'PHQ';

  -- Upsert into session_scores
  INSERT INTO session_scores(session_id, gds_total, phq_total, computed_at)
  VALUES (v_session_id, v_gds_total, v_phq_total, now())
  ON CONFLICT (session_id) DO UPDATE
  SET gds_total = EXCLUDED.gds_total,
      phq_total = EXCLUDED.phq_total,
      computed_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers
DROP TRIGGER IF EXISTS trg_compute_session_scores_on_decision ON decisions;
CREATE TRIGGER trg_compute_session_scores_on_decision
AFTER INSERT ON decisions
FOR EACH ROW EXECUTE FUNCTION fn_compute_session_scores();

DROP TRIGGER IF EXISTS trg_compute_session_scores_on_mapping ON clinical_mappings;
CREATE TRIGGER trg_compute_session_scores_on_mapping
AFTER INSERT ON clinical_mappings
FOR EACH ROW EXECUTE FUNCTION fn_compute_session_scores();

-- ===== USER METRICS AGGREGATION TRIGGER =====

-- Function: maintain user_metrics_aggregated when sessions end (simple upsert)
CREATE OR REPLACE FUNCTION fn_sessions_after_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when session ended_at becomes not null
  IF TG_OP = 'UPDATE' AND NEW.ended_at IS NOT NULL AND (OLD.ended_at IS NULL) THEN
    INSERT INTO user_metrics_aggregated(pseudonym, total_sessions, avg_session_length_seconds, abandonment_rate, avg_emotional_score_gds, avg_emotional_score_phq, last_risk_flag_date, frequency_of_use_days, updated_at)
    VALUES (
      NEW.pseudonym,
      1,
      COALESCE(NEW.session_length_seconds,0),
      CASE WHEN NEW.abandonment_flag THEN 1 ELSE 0 END,
      NEW.normalized_emotional_score_gds,
      NEW.normalized_emotional_score_phq,
      (SELECT MAX(timestamp) FROM risk_events WHERE session_id = NEW.session_id),
      0,
      now()
    )
    ON CONFLICT (pseudonym) DO UPDATE
    SET
      total_sessions = user_metrics_aggregated.total_sessions + 1,
      avg_session_length_seconds = ((COALESCE(user_metrics_aggregated.avg_session_length_seconds,0) * user_metrics_aggregated.total_sessions) + COALESCE(NEW.session_length_seconds,0)) / (user_metrics_aggregated.total_sessions + 1),
      abandonment_rate = ((COALESCE(user_metrics_aggregated.abandonment_rate,0) * user_metrics_aggregated.total_sessions) + CASE WHEN NEW.abandonment_flag THEN 1 ELSE 0 END) / (user_metrics_aggregated.total_sessions + 1),
      avg_emotional_score_gds = ((COALESCE(user_metrics_aggregated.avg_emotional_score_gds,0) * user_metrics_aggregated.total_sessions) + COALESCE(NEW.normalized_emotional_score_gds,0)) / (user_metrics_aggregated.total_sessions + 1),
      avg_emotional_score_phq = ((COALESCE(user_metrics_aggregated.avg_emotional_score_phq,0) * user_metrics_aggregated.total_sessions) + COALESCE(NEW.normalized_emotional_score_phq,0)) / (user_metrics_aggregated.total_sessions + 1),
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

-- ===== AUDIT LOG TRIGGER =====

-- Optional: trigger to copy decision audit link when decision inserted
CREATE OR REPLACE FUNCTION fn_decisions_after_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- create lightweight audit row if none exists
  INSERT INTO decision_audit(session_id, decision_id, llm_request, llm_response, validation_result, pseudonym)
  VALUES (NEW.session_id, NEW.decision_id, NULL, NEW.raw_mapping, json_build_object('mapping_confidence', NEW.mapping_confidence), (SELECT pseudonym FROM sessions WHERE session_id = NEW.session_id))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_decisions_after_insert ON decisions;
CREATE TRIGGER trg_decisions_after_insert
AFTER INSERT ON decisions
FOR EACH ROW EXECUTE FUNCTION fn_decisions_after_insert();
