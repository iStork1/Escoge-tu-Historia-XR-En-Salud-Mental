-- Minimal seed data for testing
-- Create a test user
INSERT INTO users (pseudonym)
SELECT 'test-user-1'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE pseudonym = 'test-user-1');

-- Seed a simple 2-chapter structure (extend as needed)
INSERT INTO chapters (chapter_id, title, "order")
VALUES ('chapter-01', 'Capítulo 1', 1)
ON CONFLICT (chapter_id) DO NOTHING;

INSERT INTO scenes (scene_id, chapter_id, title, "order")
VALUES ('c01-s01', 'chapter-01', 'Escena 1', 1)
ON CONFLICT (scene_id) DO NOTHING;

INSERT INTO options (option_id, scene_id, option_text)
VALUES ('c01-s01-o1', 'c01-s01', 'Opción A'),
	   ('c01-s01-o2', 'c01-s01', 'Opción B')
ON CONFLICT (option_id) DO NOTHING;

-- Note: use scripts/twine_to_payload.py + supabase_direct_ingest.py to populate decisions for testing
