-- Migration: Add dual pronunciation columns to fragment_lines
-- Run this with: psql $DATABASE_URL < migrate_dual_pronunciations.sql

-- Add new columns for US and GB pronunciations
ALTER TABLE fragment_lines
ADD COLUMN IF NOT EXISTS end_rhyme_us TEXT,
ADD COLUMN IF NOT EXISTS end_rhyme_gb TEXT;

-- Rename the old column for clarity (optional - keeps backward compatibility)
-- The old end_rhyme_sound will be treated as GB for now
-- We'll update all three columns in the re-analysis script

-- Add indexes for the new columns (for efficient rhyme matching queries)
CREATE INDEX IF NOT EXISTS idx_fragment_lines_rhyme_us ON fragment_lines(end_rhyme_us);
CREATE INDEX IF NOT EXISTS idx_fragment_lines_rhyme_gb ON fragment_lines(end_rhyme_gb);

-- Show the updated schema
\d fragment_lines
