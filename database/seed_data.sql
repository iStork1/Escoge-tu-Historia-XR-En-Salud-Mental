-- Minimal seed data for testing

-- Example pseudonyms
INSERT INTO sessions (pseudonym) VALUES ('user_test_1') RETURNING session_id;

-- Example chapter/scene seed in metadata (optional)
-- Insert a decision example via backend or use the payloads in instructions/payloads
