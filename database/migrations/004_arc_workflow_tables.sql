-- Migration 004: Arc Workflow Persistence
-- Purpose: Persist weekly arc planning + daily generation outputs in Postgres
-- Scope: Prompt 1 (architect) and Prompt 2 (generator) operational storage

-- ================================
-- ARC WEEK TABLE (Prompt 1 output)
-- ================================
CREATE TABLE IF NOT EXISTS arc_weeks (
  arc_id TEXT PRIMARY KEY,
  week_number INT NOT NULL CHECK (week_number > 0),
  arc_theme TEXT NOT NULL,
  title TEXT NOT NULL,
  chapter_start_id TEXT,
  chapter_end_id TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','archived','failed')),
  architecture_json JSONB NOT NULL,
  entry_hook TEXT,
  opening_scene TEXT,
  clinical_theme JSONB,
  transition_json JSONB,
  planned_with_provider TEXT,
  planned_with_model TEXT,
  prompt_version TEXT,
  prompt_compact_level TEXT,
  input_tokens INT,
  output_tokens INT,
  estimated_cost_usd NUMERIC(10,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arc_weeks_week_number ON arc_weeks(week_number);
CREATE INDEX IF NOT EXISTS idx_arc_weeks_status ON arc_weeks(status);
CREATE INDEX IF NOT EXISTS idx_arc_weeks_created_at ON arc_weeks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arc_weeks_architecture_gin ON arc_weeks USING GIN(architecture_json);

-- ================================
-- ARC DAY TABLE (Prompt 2 outputs)
-- ================================
CREATE TABLE IF NOT EXISTS arc_days (
  arc_day_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arc_id TEXT NOT NULL REFERENCES arc_weeks(arc_id) ON DELETE CASCADE,
  arc_day SMALLINT NOT NULL CHECK (arc_day BETWEEN 1 AND 7),
  chapter_id TEXT,
  chapter_order INT,
  generation_mode TEXT NOT NULL DEFAULT 'full' CHECK (generation_mode IN ('full','partial','on_demand')),
  payload_mode TEXT NOT NULL DEFAULT 'delta' CHECK (payload_mode IN ('reference','delta','full')),
  chapter_template_id TEXT REFERENCES chapters(chapter_id) ON DELETE SET NULL,
  day_context_json JSONB,
  output_json JSONB,
  delta_json JSONB,
  summary_text TEXT,
  top_option_id TEXT,
  transition_json JSONB,
  generated_with_provider TEXT,
  generated_with_model TEXT,
  input_tokens INT,
  output_tokens INT,
  estimated_cost_usd NUMERIC(10,6),
  latency_ms INT,
  generated_metrics JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_arc_days_payload_mode CHECK (
    (payload_mode = 'full' AND output_json IS NOT NULL)
    OR (payload_mode = 'delta' AND delta_json IS NOT NULL)
    OR (payload_mode = 'reference' AND chapter_template_id IS NOT NULL)
  ),
  UNIQUE (arc_id, arc_day)
);

-- Backward-compatible upgrades when arc_days already exists from an older draft.
ALTER TABLE arc_days
  ADD COLUMN IF NOT EXISTS generation_mode TEXT,
  ADD COLUMN IF NOT EXISTS payload_mode TEXT,
  ADD COLUMN IF NOT EXISTS chapter_template_id TEXT,
  ADD COLUMN IF NOT EXISTS day_context_json JSONB,
  ADD COLUMN IF NOT EXISTS output_json JSONB,
  ADD COLUMN IF NOT EXISTS delta_json JSONB,
  ADD COLUMN IF NOT EXISTS summary_text TEXT,
  ADD COLUMN IF NOT EXISTS top_option_id TEXT,
  ADD COLUMN IF NOT EXISTS transition_json JSONB,
  ADD COLUMN IF NOT EXISTS generated_with_provider TEXT,
  ADD COLUMN IF NOT EXISTS generated_with_model TEXT,
  ADD COLUMN IF NOT EXISTS input_tokens INT,
  ADD COLUMN IF NOT EXISTS output_tokens INT,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS latency_ms INT,
  ADD COLUMN IF NOT EXISTS generated_metrics JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE arc_days
  ALTER COLUMN generation_mode SET DEFAULT 'full',
  ALTER COLUMN payload_mode SET DEFAULT 'delta';

UPDATE arc_days
SET generation_mode = COALESCE(generation_mode, 'full'),
    payload_mode = COALESCE(payload_mode, 'full')
WHERE generation_mode IS NULL OR payload_mode IS NULL;

ALTER TABLE arc_days
  ALTER COLUMN generation_mode SET NOT NULL,
  ALTER COLUMN payload_mode SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'arc_days'
      AND constraint_name = 'fk_arc_days_template'
  ) THEN
    ALTER TABLE arc_days
      ADD CONSTRAINT fk_arc_days_template
      FOREIGN KEY (chapter_template_id) REFERENCES chapters(chapter_id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE arc_days DROP CONSTRAINT IF EXISTS chk_arc_days_payload_mode;
ALTER TABLE arc_days
  ADD CONSTRAINT chk_arc_days_payload_mode CHECK (
    (payload_mode = 'full' AND output_json IS NOT NULL)
    OR (payload_mode = 'delta' AND delta_json IS NOT NULL)
    OR (payload_mode = 'reference' AND chapter_template_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_arc_days_arc_id ON arc_days(arc_id);
CREATE INDEX IF NOT EXISTS idx_arc_days_chapter_id ON arc_days(chapter_id);
CREATE INDEX IF NOT EXISTS idx_arc_days_payload_mode ON arc_days(payload_mode);
CREATE INDEX IF NOT EXISTS idx_arc_days_template_id ON arc_days(chapter_template_id);
CREATE INDEX IF NOT EXISTS idx_arc_days_created_at ON arc_days(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arc_days_output_gin ON arc_days USING GIN(output_json);
CREATE INDEX IF NOT EXISTS idx_arc_days_delta_gin ON arc_days USING GIN(delta_json);

-- ======================================
-- ARC TRANSITIONS (explicit continuity)
-- ======================================
CREATE TABLE IF NOT EXISTS arc_transitions (
  transition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_arc_id TEXT NOT NULL REFERENCES arc_weeks(arc_id) ON DELETE CASCADE,
  to_arc_id TEXT REFERENCES arc_weeks(arc_id) ON DELETE SET NULL,
  emotional_state_end TEXT,
  next_arc_hook TEXT NOT NULL,
  clinical_carry_over JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_arc_id)
);

CREATE INDEX IF NOT EXISTS idx_arc_transitions_next_arc_hook ON arc_transitions(next_arc_hook);
CREATE INDEX IF NOT EXISTS idx_arc_transitions_created_at ON arc_transitions(created_at DESC);

-- ======================================
-- updated_at helper trigger
-- ======================================
CREATE OR REPLACE FUNCTION fn_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_arc_weeks_updated_at ON arc_weeks;
CREATE TRIGGER trg_touch_arc_weeks_updated_at
BEFORE UPDATE ON arc_weeks
FOR EACH ROW
EXECUTE FUNCTION fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_arc_days_updated_at ON arc_days;
CREATE TRIGGER trg_touch_arc_days_updated_at
BEFORE UPDATE ON arc_days
FOR EACH ROW
EXECUTE FUNCTION fn_touch_updated_at();

-- ======================================
-- Operational views (fast reads)
-- ======================================
CREATE OR REPLACE VIEW v_arc_latest_transition AS
SELECT t.*
FROM arc_transitions t
ORDER BY t.created_at DESC
LIMIT 1;

CREATE OR REPLACE VIEW v_arc_progress AS
SELECT
  w.arc_id,
  w.week_number,
  w.arc_theme,
  w.title,
  w.status,
  COUNT(d.arc_day_id) AS generated_days,
  COALESCE(SUM(d.input_tokens), 0) AS total_input_tokens,
  COALESCE(SUM(d.output_tokens), 0) AS total_output_tokens,
  COALESCE(SUM(d.estimated_cost_usd), 0)::NUMERIC(10,6) AS total_estimated_cost_usd,
  MAX(d.arc_day) AS last_generated_day,
  w.created_at,
  w.updated_at
FROM arc_weeks w
LEFT JOIN arc_days d ON d.arc_id = w.arc_id
GROUP BY w.arc_id, w.week_number, w.arc_theme, w.title, w.status, w.created_at, w.updated_at;

-- ======================================
-- Comments
-- ======================================
COMMENT ON TABLE arc_weeks IS 'Prompt 1 outputs: one weekly architecture per arc_id.';
COMMENT ON TABLE arc_days IS 'Prompt 2 outputs by day. Can store reference to chapters, delta patch, or full payload.';
COMMENT ON TABLE arc_transitions IS 'Explicit continuity bridge between contiguous arcs.';
COMMENT ON COLUMN arc_weeks.architecture_json IS 'Full architect JSON output for reproducibility and re-generation.';
COMMENT ON COLUMN arc_days.payload_mode IS 'reference=points to canonical chapters; delta=stores only differences; full=stores complete generated payload.';
COMMENT ON COLUMN arc_days.chapter_template_id IS 'Canonical chapter template from chapters table used as base when payload_mode=reference or delta.';
COMMENT ON COLUMN arc_days.delta_json IS 'Compact patch/override over chapter_template_id to reduce storage and downstream token usage.';
COMMENT ON COLUMN arc_days.output_json IS 'Complete generated day payload. Use only when payload_mode=full.';
COMMENT ON COLUMN arc_days.generated_metrics IS 'Derived metrics for observability: scenes/options/mappings counts, transition flags, etc.';
