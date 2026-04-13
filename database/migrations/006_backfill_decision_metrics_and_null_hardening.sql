-- Migration 006: Backfill decision metrics and harden null-sensitive fields
-- Purpose:
-- 1) Backfill historical rows with missing values where there is deterministic source data.
-- 2) Auto-create decision-level clinical mappings from static option mappings when missing.
-- 3) Recompute session_scores from decision-level mappings.

BEGIN;

-- -----------------------------
-- A) Harden common nullable JSON fields
-- -----------------------------
ALTER TABLE scenes
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

UPDATE scenes
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

ALTER TABLE sessions
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

UPDATE sessions
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

UPDATE sessions
SET started_at = COALESCE(started_at, created_at, now())
WHERE started_at IS NULL;

UPDATE sessions
SET session_length_seconds = GREATEST(
  0,
  EXTRACT(EPOCH FROM (ended_at - started_at))::INT
)
WHERE ended_at IS NOT NULL
  AND started_at IS NOT NULL
  AND session_length_seconds IS NULL;

UPDATE decisions
SET validation_steps = '{}'::text[]
WHERE validation_steps IS NULL;

UPDATE decisions
SET risk_flags = '{}'::text[]
WHERE risk_flags IS NULL;

-- -----------------------------
-- B) Backfill decision-level clinical mappings from static option mappings
-- -----------------------------
-- GDS mappings from options.gds_mapping
INSERT INTO clinical_mappings (
  mapping_id,
  option_id,
  decision_id,
  scale,
  item,
  weight,
  confidence,
  primary_construct,
  rationale,
  mapping_source,
  source_confidence,
  validated
)
SELECT
  gen_random_uuid(),
  d.option_id,
  d.decision_id,
  'GDS',
  NULLIF((gm ->> 'item'), '')::INT,
  COALESCE(NULLIF((gm ->> 'weight'), '')::FLOAT, 0.5),
  COALESCE(NULLIF((gm ->> 'confidence'), '')::FLOAT, 0.75),
  COALESCE(gm ->> 'primary_construct', gm ->> 'rationale'),
  gm ->> 'rationale',
  CASE
    WHEN COALESCE(gm ->> 'mapping_source', 'designer') IN ('designer', 'llm', 'heuristic')
      THEN COALESCE(gm ->> 'mapping_source', 'designer')
    WHEN COALESCE(gm ->> 'mapping_source', '') = 'rule'
      THEN 'heuristic'
    ELSE 'designer'
  END,
  COALESCE(NULLIF((gm ->> 'confidence'), '')::FLOAT, 0.75),
  TRUE
FROM decisions d
JOIN options o ON o.option_id = d.option_id
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.gds_mapping, '[]'::jsonb)) gm
WHERE NOT EXISTS (
  SELECT 1
  FROM clinical_mappings cm
  WHERE cm.decision_id = d.decision_id
    AND cm.scale = 'GDS'
    AND cm.item = NULLIF((gm ->> 'item'), '')::INT
);

-- PHQ mappings from options.metadata->phq_mapping
INSERT INTO clinical_mappings (
  mapping_id,
  option_id,
  decision_id,
  scale,
  item,
  weight,
  confidence,
  primary_construct,
  rationale,
  mapping_source,
  source_confidence,
  validated
)
SELECT
  gen_random_uuid(),
  d.option_id,
  d.decision_id,
  'PHQ',
  NULLIF((pm ->> 'item'), '')::INT,
  COALESCE(NULLIF((pm ->> 'weight'), '')::FLOAT, 0.5),
  COALESCE(NULLIF((pm ->> 'confidence'), '')::FLOAT, 0.75),
  COALESCE(pm ->> 'primary_construct', pm ->> 'rationale'),
  pm ->> 'rationale',
  CASE
    WHEN COALESCE(pm ->> 'mapping_source', 'designer') IN ('designer', 'llm', 'heuristic')
      THEN COALESCE(pm ->> 'mapping_source', 'designer')
    WHEN COALESCE(pm ->> 'mapping_source', '') = 'rule'
      THEN 'heuristic'
    ELSE 'designer'
  END,
  COALESCE(NULLIF((pm ->> 'confidence'), '')::FLOAT, 0.75),
  TRUE
FROM decisions d
JOIN options o ON o.option_id = d.option_id
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.metadata -> 'phq_mapping', '[]'::jsonb)) pm
WHERE NOT EXISTS (
  SELECT 1
  FROM clinical_mappings cm
  WHERE cm.decision_id = d.decision_id
    AND cm.scale = 'PHQ'
    AND cm.item = NULLIF((pm ->> 'item'), '')::INT
);

-- -----------------------------
-- C) Backfill decisions.mapping_confidence
-- -----------------------------
WITH conf AS (
  SELECT
    d.decision_id,
    ROUND(AVG(COALESCE(cm.confidence, cm.source_confidence))::numeric, 3) AS avg_conf
  FROM decisions d
  LEFT JOIN clinical_mappings cm ON cm.decision_id = d.decision_id
  GROUP BY d.decision_id
)
UPDATE decisions d
SET mapping_confidence = conf.avg_conf
FROM conf
WHERE d.decision_id = conf.decision_id
  AND d.mapping_confidence IS NULL
  AND conf.avg_conf IS NOT NULL;

-- -----------------------------
-- D) Backfill decision_audit.validation_result
-- -----------------------------
UPDATE decision_audit da
SET validation_result = jsonb_build_object(
  'mapping_confidence', d.mapping_confidence,
  'mappings_count', COALESCE(cm.cnt, 0),
  'backfilled', TRUE
)
FROM decisions d
LEFT JOIN (
  SELECT decision_id, COUNT(*) AS cnt
  FROM clinical_mappings
  WHERE decision_id IS NOT NULL
  GROUP BY decision_id
) cm ON cm.decision_id = d.decision_id
WHERE da.decision_id = d.decision_id
  AND da.validation_result IS NULL;

-- -----------------------------
-- E) Recompute session_scores globally
-- -----------------------------
INSERT INTO session_scores (session_id, gds_total, phq_total, computed_at)
SELECT
  d.session_id,
  COALESCE(SUM(CASE WHEN cm.scale = 'GDS' THEN COALESCE(cm.weight, 0) * COALESCE(cm.confidence, 0) ELSE 0 END), 0) AS gds_total,
  COALESCE(SUM(CASE WHEN cm.scale = 'PHQ' THEN COALESCE(cm.weight, 0) * COALESCE(cm.confidence, 0) ELSE 0 END), 0) AS phq_total,
  now() AS computed_at
FROM decisions d
LEFT JOIN clinical_mappings cm ON cm.decision_id = d.decision_id
GROUP BY d.session_id
ON CONFLICT (session_id) DO UPDATE
SET
  gds_total = EXCLUDED.gds_total,
  phq_total = EXCLUDED.phq_total,
  computed_at = EXCLUDED.computed_at;

-- -----------------------------
-- F) Trigger: auto-fill decision mappings from options on new decision inserts
-- -----------------------------
CREATE OR REPLACE FUNCTION fn_autofill_decision_mappings_from_option()
RETURNS TRIGGER AS $$
BEGIN
  -- If no option_id, there is nothing deterministic to map.
  IF NEW.option_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if mappings already exist for this decision.
  IF EXISTS (SELECT 1 FROM clinical_mappings cm WHERE cm.decision_id = NEW.decision_id) THEN
    RETURN NEW;
  END IF;

  -- Insert GDS mappings from static option JSON.
  INSERT INTO clinical_mappings (
    mapping_id, option_id, decision_id, scale, item, weight, confidence,
    primary_construct, rationale, mapping_source, source_confidence, validated
  )
  SELECT
    gen_random_uuid(),
    NEW.option_id,
    NEW.decision_id,
    'GDS',
    NULLIF((gm ->> 'item'), '')::INT,
    COALESCE(NULLIF((gm ->> 'weight'), '')::FLOAT, 0.5),
    COALESCE(NULLIF((gm ->> 'confidence'), '')::FLOAT, 0.75),
    COALESCE(gm ->> 'primary_construct', gm ->> 'rationale'),
    gm ->> 'rationale',
    CASE
      WHEN COALESCE(gm ->> 'mapping_source', 'designer') IN ('designer', 'llm', 'heuristic')
        THEN COALESCE(gm ->> 'mapping_source', 'designer')
      WHEN COALESCE(gm ->> 'mapping_source', '') = 'rule'
        THEN 'heuristic'
      ELSE 'designer'
    END,
    COALESCE(NULLIF((gm ->> 'confidence'), '')::FLOAT, 0.75),
    TRUE
  FROM options o
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.gds_mapping, '[]'::jsonb)) gm
  WHERE o.option_id = NEW.option_id;

  -- Insert PHQ mappings from static option metadata JSON.
  INSERT INTO clinical_mappings (
    mapping_id, option_id, decision_id, scale, item, weight, confidence,
    primary_construct, rationale, mapping_source, source_confidence, validated
  )
  SELECT
    gen_random_uuid(),
    NEW.option_id,
    NEW.decision_id,
    'PHQ',
    NULLIF((pm ->> 'item'), '')::INT,
    COALESCE(NULLIF((pm ->> 'weight'), '')::FLOAT, 0.5),
    COALESCE(NULLIF((pm ->> 'confidence'), '')::FLOAT, 0.75),
    COALESCE(pm ->> 'primary_construct', pm ->> 'rationale'),
    pm ->> 'rationale',
    CASE
      WHEN COALESCE(pm ->> 'mapping_source', 'designer') IN ('designer', 'llm', 'heuristic')
        THEN COALESCE(pm ->> 'mapping_source', 'designer')
      WHEN COALESCE(pm ->> 'mapping_source', '') = 'rule'
        THEN 'heuristic'
      ELSE 'designer'
    END,
    COALESCE(NULLIF((pm ->> 'confidence'), '')::FLOAT, 0.75),
    TRUE
  FROM options o
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.metadata -> 'phq_mapping', '[]'::jsonb)) pm
  WHERE o.option_id = NEW.option_id;

  -- Refresh decisions.mapping_confidence if still null.
  UPDATE decisions d
  SET mapping_confidence = sub.avg_conf
  FROM (
    SELECT decision_id, ROUND(AVG(COALESCE(confidence, source_confidence))::numeric, 3) AS avg_conf
    FROM clinical_mappings
    WHERE decision_id = NEW.decision_id
    GROUP BY decision_id
  ) sub
  WHERE d.decision_id = sub.decision_id
    AND d.mapping_confidence IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_autofill_decision_mappings_from_option ON decisions;
CREATE TRIGGER trg_autofill_decision_mappings_from_option
AFTER INSERT ON decisions
FOR EACH ROW
EXECUTE FUNCTION fn_autofill_decision_mappings_from_option();

COMMIT;
