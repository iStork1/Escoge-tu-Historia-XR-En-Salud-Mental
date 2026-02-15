-- Add options and option_mappings tables for chapter-driven choices
-- Ensure uuid generator available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS options (
  option_id text PRIMARY KEY,
  chapter_id text,
  scene_id text,
  option_text text,
  next_chapter_id text,
  metadata jsonb
);

CREATE TABLE IF NOT EXISTS option_mappings (
  mapping_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id text REFERENCES options(option_id) ON DELETE CASCADE,
  scale text,
  item integer,
  weight numeric,
  confidence numeric,
  metadata jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_options_chapter ON options(chapter_id);
CREATE INDEX IF NOT EXISTS idx_option_mappings_option ON option_mappings(option_id);
