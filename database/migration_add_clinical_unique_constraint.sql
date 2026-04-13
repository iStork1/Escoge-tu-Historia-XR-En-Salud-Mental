-- Migration: Clean duplicates and add UNIQUE index to clinical_mappings
-- Purpose: Prevent duplicate clinical mappings when syncing chapters.json multiple times

-- STEP 1: Delete duplicate rows, keeping only one per (option_id, scale, item)
-- Keep the oldest one by ordering on created_at (implicit order)
DELETE FROM clinical_mappings cm1
WHERE decision_id IS NULL
  AND NOT (mapping_id, option_id, scale, item) IN (
    SELECT DISTINCT ON (option_id, scale, item) 
           mapping_id, option_id, scale, item
    FROM clinical_mappings cm2
    WHERE cm2.decision_id IS NULL
    ORDER BY option_id, scale, item, mapping_id
  );

-- STEP 2: Create UNIQUE index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_clinical_mapping_static
ON clinical_mappings (option_id, scale, item)
WHERE decision_id IS NULL;

-- STEP 3: Verify no duplicates remain
SELECT option_id, scale, item, COUNT(*) as count
FROM clinical_mappings
WHERE decision_id IS NULL
GROUP BY option_id, scale, item
HAVING COUNT(*) > 1;
