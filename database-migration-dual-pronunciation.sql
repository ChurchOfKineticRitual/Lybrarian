-- Migration: Add dual US/British English pronunciation support
-- Date: 2025-11-12
-- Description: Adds separate columns for American and British English rhyme sounds

-- Add new columns for dual pronunciation
ALTER TABLE fragment_lines ADD COLUMN IF NOT EXISTS end_rhyme_us TEXT;
ALTER TABLE fragment_lines ADD COLUMN IF NOT EXISTS end_rhyme_gb TEXT;

-- Create indexes for new rhyme columns
CREATE INDEX IF NOT EXISTS idx_fragment_lines_rhyme_us ON fragment_lines(end_rhyme_us);
CREATE INDEX IF NOT EXISTS idx_fragment_lines_rhyme_gb ON fragment_lines(end_rhyme_gb);

-- Migrate existing data: copy current end_rhyme_sound to both new columns
-- (Existing data is American-based from CMUdict)
UPDATE fragment_lines 
SET end_rhyme_us = end_rhyme_sound,
    end_rhyme_gb = end_rhyme_sound
WHERE end_rhyme_us IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN fragment_lines.end_rhyme_us IS 'American English phonetic rhyme sound (CMUdict-based)';
COMMENT ON COLUMN fragment_lines.end_rhyme_gb IS 'British English phonetic rhyme sound (converted from American)';
COMMENT ON COLUMN fragment_lines.end_rhyme_sound IS 'Legacy rhyme sound (kept for backward compatibility)';

-- Verify migration
SELECT 
    fragment_id,
    text,
    end_rhyme_sound as legacy,
    end_rhyme_us,
    end_rhyme_gb
FROM fragment_lines 
WHERE fragment_id IN (
    SELECT id FROM fragments LIMIT 3
)
ORDER BY fragment_id, line_number;