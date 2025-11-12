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
- **OpenRouter**: Unified API for Claude + OpenAI (https://openrouter.ai/)
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

### Two-Phase Workflow

The import script uses a two-phase workflow that allows you to review and edit AI-generated tags before finalizing the import.

#### Phase 1: Generate Tags

Generate tags for all fragments and save to a review file:

```bash
python import_fragments.py --generate-tags ../fragment-corpus-cleaned.csv
```

This creates `tags-review.json` with AI-generated tags for each fragment.

#### Phase 2: Review & Edit Tags

Open `tags-review.json` and review the generated tags:

```json
{
  "id": "frag0001",
  "text": "An agent of biology,\nAcknowledging this honestly.",
  "tags": ["biology", "honesty", "philosophical", "abstract"],
  ...
}
```

**Edit the tags as needed:**
- Add new tags: `"tags": ["biology", "honesty", "philosophical", "abstract", "science"]`
- Remove tags: Delete unwanted tags from the array
- Modify tags: Change tag names to better fit your taxonomy

Save the file when done.

#### Phase 3: Complete Import

Run the complete import with your reviewed tags:

```bash
python import_fragments.py --complete-import ../fragment-corpus-cleaned.csv
```

This processes each fragment through the full pipeline using your curated tags.

### What It Does

**Phase 1 - Tag Generation:**
1. **Parse CSV** - Read fragment data (ID, text, attribution, rhythmic flag, context)
2. **Generate Tags** - Use Claude (via OpenRouter) to generate 3-7 semantic tags
3. **Save for Review** - Export to `tags-review.json` for manual editing

**Phase 2 - Complete Import:**
1. **Load Reviewed Tags** - Read edited tags from `tags-review.json`
2. **Analyze Prosody** (rhythmic fragments only) - Extract:
   - Syllable count per line
   - Stress pattern (binary string like "10101010")
   - End rhyme sound (IPA phonetics)
3. **Generate Embeddings** - Create 1536-dimensional vectors using OpenAI (via OpenRouter)
4. **Save to Vector Store** - Store embeddings in Upstash for semantic search
5. **Save to Database** - Store metadata and prosody in Neon Postgres
6. **Create Markdown Files** - Generate Obsidian-compatible vault files

### Output

The script creates:

- **Database entries**: 65 fragments + prosodic line data (for rhythmic fragments)
- **Vector embeddings**: 65 vectors in Upstash
- **Markdown files**: `lyrics-vault/fragments/frag0001.md` through `frag0065.md`

### Example Output

**Phase 1 - Generate Tags:**

```
============================================================
LYBRARIAN FRAGMENT IMPORT - PHASE 1
============================================================
CSV: ../fragment-corpus-cleaned.csv
Output: tags-review.json
============================================================

PHASE 1: GENERATING TAGS
============================================================

[1/65] Generating tags for frag0001...
  Text: An agent of biology,
Acknowledging this honestly....
  Tags: biology, honesty, philosophical, abstract, science

[2/65] Generating tags for frag0002...
...

============================================================
TAGS GENERATED - READY FOR REVIEW
============================================================
Tags saved to: tags-review.json

Next steps:
1. Review and edit tags in: tags-review.json
2. Confirm/delete/amend tags as needed
3. Run: python import_fragments.py --complete-import ../fragment-corpus-cleaned.csv

Tag file format:
  - Edit the 'tags' array for each fragment
  - Add/remove/modify tags as needed
  - Save the file when done
```

**Phase 2 - Complete Import:**

```
============================================================
LYBRARIAN FRAGMENT IMPORT - PHASE 2
============================================================
Tags: tags-review.json
Output: lyrics-vault/fragments/
============================================================

PHASE 2: COMPLETING IMPORT
============================================================

[1/65] Processing frag0001...
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
- Verify `OPENROUTER_API_KEY` is set (replaces separate Anthropic/OpenAI keys)
- Get your key from https://openrouter.ai/keys
- Load with `source .env` if needed

### "Tags file not found"
- You must run Phase 1 (`--generate-tags`) before Phase 2 (`--complete-import`)
- Check that `tags-review.json` exists in the current directory

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

**Phase 1 (Tag Generation):**
- **Tag generation**: ~2s per fragment (Claude via OpenRouter)
- **Total time**: ~2-3 minutes for 65 fragments

**Phase 2 (Complete Import):**
- **Prosodic analysis**: ~0.5s per fragment (local)
- **Embedding generation**: ~1s per fragment (OpenAI via OpenRouter)
- **Database save**: ~0.1s per fragment
- **Total time**: ~2-3 minutes for 65 fragments

**Total workflow time**: ~5-6 minutes (plus manual tag review time)

## Next Steps

After successful import:

1. **Verify data** - Run sample queries against database
2. **Test vector search** - Query Upstash for similar fragments
3. **Build generation API** - Use fragments in verse generation (`netlify/functions/generate.js`)
4. **Implement frontend** - Connect input screen to generation API

See `../PROGRESS.md` for development roadmap.
