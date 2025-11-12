# Prosody Re-Analysis Guide

## What This Does

Re-analyzes all 65 fragments with the new **dual US/British pronunciation system**:
- Adds `end_rhyme_us` and `end_rhyme_gb` columns to database
- Updates all rhythmic fragments with both American and British phonetic rhyme sounds
- Preserves backward compatibility with existing `end_rhyme_sound` column

## Prerequisites

1. **Database credentials** - Your Neon Postgres connection string
2. **Python packages** - Install if not already present:
   ```bash
   pip install asyncpg syllables pronouncing nltk python-dotenv
   ```

3. **Optional (for better British pronunciations)**:
   ```bash
   pip install phonemizer
   # Also requires espeak installed: sudo apt-get install espeak
   ```

## Step 1: Set Up Environment Variables

Create a `.env` file in the project root (`/home/user/Lybrarian/.env`):

```bash
# Required for re-analysis
DATABASE_URL=postgresql://your_user:your_password@your_host/your_db

# Optional (not needed for re-analysis, but keep if you have them)
OPENROUTER_API_KEY=sk-or-v1-...
UPSTASH_VECTOR_URL=https://...
UPSTASH_VECTOR_TOKEN=...
```

## Step 2: Run Database Migration

This adds the new columns to `fragment_lines` table:

```bash
# From project root
psql $DATABASE_URL < scripts/migrate_dual_pronunciations.sql
```

**Expected output:**
```
ALTER TABLE
CREATE INDEX
CREATE INDEX
         Table "public.fragment_lines"
       Column       |  Type   | Modifiers
--------------------+---------+-----------
 id                 | integer | not null
 fragment_id        | text    | not null
 line_number        | integer | not null
 text               | text    | not null
 syllables          | integer | not null
 stress_pattern     | text    |
 end_rhyme_sound    | text    |
 end_rhyme_us       | text    |    ← NEW!
 end_rhyme_gb       | text    |    ← NEW!
 meter              | text    |
```

## Step 3: Run Prosody Re-Analysis

This updates all fragments with dual pronunciations:

```bash
cd scripts
python reanalyze_prosody.py
```

**Expected output:**
```
============================================================
PROSODY RE-ANALYSIS - DUAL PRONUNCIATIONS
============================================================
✓ Connected to database
✓ Found 65 fragments
✓ 52 rhythmic fragments to analyze

[1/65] Analyzing frag0001...
  Line 1: 10 syllables
    US rhyme: AH0 L AH0 JH IY1
    GB rhyme: AH0 L AH0 JH IY1
  ✓ Updated 2 lines

[2/65] Analyzing frag0002...
...

============================================================
✓ Re-analysis complete!
  Fragments processed: 52
  Lines updated: 156
  Semantic fragments skipped: 13
============================================================
```

## Step 4: Verify Results

Query the database to confirm dual pronunciations are stored:

```bash
psql $DATABASE_URL -c "
SELECT
    f.id,
    fl.line_number,
    fl.text,
    fl.end_rhyme_us,
    fl.end_rhyme_gb
FROM fragments f
JOIN fragment_lines fl ON f.id = fl.fragment_id
WHERE f.rhythmic = true
LIMIT 5;
"
```

## What Changed

### Database Schema
- ✅ Added `end_rhyme_us` column (American phonetics)
- ✅ Added `end_rhyme_gb` column (British phonetics)
- ✅ Kept `end_rhyme_sound` for backward compatibility (populated with GB pronunciation)
- ✅ Added indexes for efficient rhyme matching queries

### Prosodic Analysis
- ✅ US pronunciation: Uses CMUdict via `pronouncing` library
- ✅ GB pronunciation: Uses `phonemizer` with espeak backend (fallback to phoneme conversion)
- ✅ Handles accent differences: TRAP-BATH split, rhoticity, LOT-CLOTH merger

## Troubleshooting

### "DATABASE_URL not found"
Make sure `.env` file exists in project root with `DATABASE_URL` set.

### "Module not found: asyncpg"
Install missing packages: `pip install asyncpg syllables pronouncing nltk python-dotenv`

### "Connection refused"
Check your Neon database is active and connection string is correct.

### "British phonemizer failed"
This is normal - the script falls back to converting US phonemes to British. For better accuracy, install:
```bash
pip install phonemizer
sudo apt-get install espeak  # or brew install espeak on Mac
```

## Next Steps

After successful re-analysis:
1. ✅ Database has dual pronunciations for all rhythmic fragments
2. → Build the generation API (`netlify/functions/generate.js`)
3. → Implement retrieval system (semantic + prosodic)
4. → Connect frontend toggle controls

---

**Ready to proceed with Phase 2!** 🚀
