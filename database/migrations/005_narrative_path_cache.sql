-- Migration 005: Scene-by-Scene Deterministic Path Cache
-- Purpose: Reuse generated narrative across users with segmented deterministic keys
-- Scope: Path-key cache, variant ranking, reuse metrics

CREATE TABLE IF NOT EXISTS narrative_path_cache (
  variant_key TEXT PRIMARY KEY,
  base_path_key TEXT NOT NULL,
  path_window_size SMALLINT NOT NULL DEFAULT 3 CHECK (path_window_size BETWEEN 1 AND 8),
  segment_json JSONB NOT NULL,
  generation_mode TEXT NOT NULL DEFAULT 'scene_by_scene' CHECK (generation_mode IN ('scene_by_scene','mini_chapter')),
  continuity_snapshot JSONB,
  critical_node TEXT,
  narrative_intensity TEXT NOT NULL DEFAULT 'medium' CHECK (narrative_intensity IN ('low','medium','high')),
  output_json JSONB NOT NULL,
  compressed_memory JSONB,
  generated_with_provider TEXT,
  generated_with_model TEXT,
  input_tokens INT,
  output_tokens INT,
  estimated_cost_usd NUMERIC(10,6),
  quality_score NUMERIC(6,3) NOT NULL DEFAULT 0.500,
  usage_count INT NOT NULL DEFAULT 0,
  rating_count INT NOT NULL DEFAULT 0,
  avg_rating NUMERIC(4,2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  prompt_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_npc_base_path ON narrative_path_cache(base_path_key);
CREATE INDEX IF NOT EXISTS idx_npc_segment_gin ON narrative_path_cache USING GIN(segment_json);
CREATE INDEX IF NOT EXISTS idx_npc_output_gin ON narrative_path_cache USING GIN(output_json);
CREATE INDEX IF NOT EXISTS idx_npc_quality_score ON narrative_path_cache(base_path_key, quality_score DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_npc_active ON narrative_path_cache(is_active);
CREATE INDEX IF NOT EXISTS idx_npc_prompt_version ON narrative_path_cache(prompt_version);

CREATE TABLE IF NOT EXISTS narrative_cache_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_path_key TEXT NOT NULL,
  variant_key TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('hit','miss','write','rating')),
  savings_usd NUMERIC(10,6),
  latency_ms INT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nce_base_path ON narrative_cache_events(base_path_key);
CREATE INDEX IF NOT EXISTS idx_nce_event_type ON narrative_cache_events(event_type);
CREATE INDEX IF NOT EXISTS idx_nce_created_at ON narrative_cache_events(created_at DESC);

CREATE OR REPLACE FUNCTION fn_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_narrative_path_cache_updated_at ON narrative_path_cache;
CREATE TRIGGER trg_touch_narrative_path_cache_updated_at
BEFORE UPDATE ON narrative_path_cache
FOR EACH ROW
EXECUTE FUNCTION fn_touch_updated_at();

CREATE OR REPLACE VIEW v_narrative_path_cache_best AS
SELECT DISTINCT ON (c.base_path_key)
  c.base_path_key,
  c.variant_key,
  c.segment_json,
  c.generation_mode,
  c.critical_node,
  c.narrative_intensity,
  c.output_json,
  c.compressed_memory,
  c.quality_score,
  c.usage_count,
  c.avg_rating,
  c.prompt_version,
  c.updated_at
FROM narrative_path_cache c
WHERE c.is_active = TRUE
ORDER BY c.base_path_key, c.quality_score DESC, c.updated_at DESC;

CREATE OR REPLACE VIEW v_narrative_cache_kpis AS
SELECT
  COALESCE(SUM(CASE WHEN event_type = 'hit' THEN 1 ELSE 0 END), 0) AS cache_hits,
  COALESCE(SUM(CASE WHEN event_type = 'miss' THEN 1 ELSE 0 END), 0) AS cache_misses,
  COALESCE(SUM(CASE WHEN event_type = 'write' THEN 1 ELSE 0 END), 0) AS cache_writes,
  CASE
    WHEN COALESCE(SUM(CASE WHEN event_type IN ('hit','miss') THEN 1 ELSE 0 END), 0) = 0 THEN 0
    ELSE ROUND(
      (SUM(CASE WHEN event_type = 'hit' THEN 1 ELSE 0 END)::NUMERIC /
      NULLIF(SUM(CASE WHEN event_type IN ('hit','miss') THEN 1 ELSE 0 END), 0))
      , 4
    )
  END AS cache_hit_rate,
  COALESCE(ROUND(SUM(CASE WHEN event_type = 'hit' THEN COALESCE(savings_usd,0) ELSE 0 END), 6), 0) AS cache_savings_usd,
  MAX(created_at) AS last_event_at
FROM narrative_cache_events;

COMMENT ON TABLE narrative_path_cache IS 'Deterministic segmented narrative cache by path key + variant ranking.';
COMMENT ON TABLE narrative_cache_events IS 'Audit of cache hits/misses/writes for cost and reuse KPIs.';
COMMENT ON COLUMN narrative_path_cache.base_path_key IS 'Hash of path window + segment buckets + critical node + prompt version.';
COMMENT ON COLUMN narrative_path_cache.segment_json IS 'Segmentation dimensions: clinical_level, user_pattern, age_group.';
COMMENT ON COLUMN narrative_path_cache.compressed_memory IS 'Narrative compression memory (event, emotion, impact).';
COMMENT ON VIEW v_narrative_path_cache_best IS 'Top-ranked active variant per deterministic base path key.';
COMMENT ON VIEW v_narrative_cache_kpis IS 'Operational KPIs: hit rate and estimated savings from narrative reuse.';
