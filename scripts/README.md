# Lybrarian Scripts

Python scripts for fragment processing and data import.

## Setup

### 1. Install Python Dependencies

```bash
cd scripts
pip install -r requirements.txt
```

Or use a virtual environment (recommended):

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Copy the example environment file and fill in your API keys:

```bash
cp ../.env.example ../.env
# Edit .env with your actual API keys
```

Required services:
- **Anthropic API**: For tag generation (https://console.anthropic.com/)
- **OpenAI API**: For embeddings (https://platform.openai.com/)
- **Neon Database**: For Postgres storage (https://console.neon.tech/)
- **Upstash Vector**: For semantic search (https://console.upstash.com/)

### 3. Set Up Database Schema

Before running the import script, create the database tables:

```bash
# Connect to your Neon database and run:
psql $DATABASE_URL < ../database-schema.sql
```

### 4. Create Upstash Vector Index

1. Go to https://console.upstash.com/
2. Create a new Vector index
3. Configure:
   - **Dimensions**: 1536 (for OpenAI text-embedding-3-small)
   - **Similarity**: Cosine
   - **Region**: Choose closest to your location

## Fragment Import

### Usage

Import all fragments from CSV:

```bash
python import_fragments.py ../fragment-corpus-cleaned.csv
```

### What It Does

The script processes each fragment through the following pipeline:

1. **Parse CSV** - Read fragment data (ID, text, attribution, rhythmic flag, context)
2. **Generate Tags** - Use Claude API to generate 3-7 semantic tags
3. **Analyze Prosody** (rhythmic fragments only) - Extract:
   - Syllable count per line
   - Stress pattern (binary string like "10101010")
   - End rhyme sound (IPA phonetics)
4. **Generate Embeddings** - Create 1536-dimensional vectors using OpenAI
5. **Save to Vector Store** - Store embeddings in Upstash for semantic search
6. **Save to Database** - Store metadata and prosody in Neon Postgres
7. **Create Markdown Files** - Generate Obsidian-compatible vault files

### Output

The script creates:

- **Database entries**: 65 fragments + prosodic line data (for rhythmic fragments)
- **Vector embeddings**: 65 vectors in Upstash
- **Markdown files**: `lyrics-vault/fragments/frag0001.md` through `frag0065.md`

### Example Output

```
============================================================
LYBRARIAN FRAGMENT IMPORT
============================================================
CSV: ../fragment-corpus-cleaned.csv
Output: lyrics-vault/fragments/
============================================================

Parsing CSV...
Parsed 65 fragments from CSV

============================================================
PROCESSING FRAGMENTS
============================================================

[1/65] Processing frag0001...
  → Generating tags...
    Tags: biology, honesty, philosophical, abstract, science
  → Analyzing prosody...
    Type: couplet, Lines: 2
  → Generating embedding...
    Embedding: 1536 dimensions
  → Saving to vector store...
  → Saving to database...
  → Creating markdown file...
  ✓ Complete: frag0001.md

[2/65] Processing frag0002...
...

============================================================
IMPORT COMPLETE
============================================================
Total fragments: 65
✓ Successful: 65
✗ Failed: 0
Output: lyrics-vault/fragments

🎉 All fragments imported successfully!
```

### Verification

After import, verify the results:

**Check database:**
```sql
-- Count fragments
SELECT COUNT(*) FROM fragments;  -- Should be 65

-- Count rhythmic vs semantic
SELECT rhythmic, COUNT(*) FROM fragments GROUP BY rhythmic;

-- Check prosodic data
SELECT COUNT(*) FROM fragment_lines;  -- Should match rhythmic fragments

-- Sample fragment with tags
SELECT id, tags, fragment_type FROM fragments LIMIT 5;
```

**Check vector store:**
```bash
# Check Upstash console - should show 65 vectors
```

**Check markdown files:**
```bash
ls -l lyrics-vault/fragments/  # Should have 65 .md files
cat lyrics-vault/fragments/frag0001.md  # View sample
```

## Prosodic Analysis Details

### Syllable Counting
- Uses `syllables` library for estimation
- Handles common English words accurately
- Fallback to vowel counting for unknown words

### Stress Patterns
- Uses CMUdict (Carnegie Mellon Pronouncing Dictionary)
- Binary patterns: `1` = stressed, `0` = unstressed
- Example: "biology" → "01010"

### Rhyme Sounds
- Uses `pronouncing` library
- Extracts IPA phonetic representation
- Captures rhyme from last stressed vowel to end
- Example: "honestly" → "AH0 N AH0 S T L IY0"

### Fragment Types
- **single-line**: 1 line
- **couplet**: 2 lines
- **quatrain**: 4 lines
- **verse**: 5-8 lines
- **stanza**: 9+ lines

## Troubleshooting

### "Missing required environment variables"
- Check that `.env` file exists in project root
- Verify all required variables are set
- Load with `source .env` if needed

### "Failed to connect to database"
- Verify `DATABASE_URL` is correct
- Check Neon dashboard for connection details
- Ensure database schema has been created

### "CMUdict not found"
- Script will auto-download on first run
- If fails, manually run: `python -c "import nltk; nltk.download('cmudict')"`

### "Rate limit exceeded"
- Script includes 0.5s delay between fragments
- For faster processing, adjust in code (may hit API limits)
- Total time: ~4-5 minutes for 65 fragments

### "Vector dimension mismatch"
- Ensure Upstash index is configured for 1536 dimensions
- text-embedding-3-small always returns 1536-dim vectors

## Performance

- **Tag generation**: ~2s per fragment (Claude API)
- **Prosodic analysis**: ~0.5s per fragment (local)
- **Embedding generation**: ~1s per fragment (OpenAI API)
- **Database save**: ~0.1s per fragment
- **Total time**: ~4-5 minutes for 65 fragments

## Next Steps

After successful import:

1. **Verify data** - Run sample queries against database
2. **Test vector search** - Query Upstash for similar fragments
3. **Build generation API** - Use fragments in verse generation (`netlify/functions/generate.js`)
4. **Implement frontend** - Connect input screen to generation API

See `../PROGRESS.md` for development roadmap.
