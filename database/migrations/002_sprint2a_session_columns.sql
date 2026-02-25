-- Migration: Add missing columns to sessions table for Sprint 2a
-- This migration adds the is_closed column and created_at to sessions table
-- Run this in Supabase SQL editor

ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Add comment for documentation
COMMENT ON COLUMN sessions.is_closed IS 'Flag indicating whether session has been closed/ended';
COMMENT ON COLUMN sessions.created_at IS 'Timestamp when session record was created (same as started_at typically)';

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'sessions' 
ORDER BY ordinal_position;
