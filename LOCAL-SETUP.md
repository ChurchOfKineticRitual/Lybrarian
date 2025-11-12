# Local Setup Guide - Lybrarian Fragment Import

This guide helps you run the fragment import on your local machine.

## Prerequisites

- Python 3.9+ installed
- Git installed
- Your OpenRouter API key (already in `.env` file)

## Quick Start (5 minutes)

### 1. Clone the Repository

```bash
# Clone from GitHub
git clone https://github.com/ChurchOfKineticRitual/Lybrarian.git
cd Lybrarian

# Or if you already cloned it, just cd into the directory
cd path/to/Lybrarian
```

### 2. Verify Environment Setup

The `.env` file is already configured with your OpenRouter API key. Verify it exists:

```bash
cat .env
# Should show: OPENROUTER_API_KEY=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
```

✅ **You're ready for Phase 1** (tag generation only needs OpenRouter)

### 3. Install Python Dependencies

```bash
# Option A: System-wide install
pip3 install openai pyyaml python-dotenv

# Option B: Virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install openai pyyaml python-dotenv
```

**Note:** For Phase 1, you only need these 3 packages. The full requirements (asyncpg, upstash-vector, syllables, nltk, pronouncing) are needed for Phase 2.

### 4. Run Phase 1 - Generate Tags

```bash
cd scripts
python3 import_fragments.py --generate-tags ../fragment-corpus-cleaned.csv
```

This will:
- Generate AI tags for all 65 fragments (~2-3 minutes)
- Save to `tags-review.json` in the project root
- Show progress for each fragment

**Expected output:**
```
============================================================
LYBRARIAN FRAGMENT IMPORT - PHASE 1
============================================================
CSV: ../fragment-corpus-cleaned.csv
Output: tags-review.json
============================================================

[1/65] Generating tags for frag0001...
  Text: An agent of biology,...
  Tags: biology, honesty, philosophical, abstract, science

[2/65] Generating tags for frag0002...
...
```

### 5. Review and Edit Tags

```bash
# Open the tags file in your editor
code ../tags-review.json  # VS Code
# or
open ../tags-review.json  # Mac default editor
# or
nano ../tags-review.json  # Terminal editor
```

Edit the `tags` array for any fragment:
- Add new tags
- Remove unwanted tags
- Modify tag names

Save when done.

---

## Phase 2 - Complete Import (Later)

Phase 2 requires additional infrastructure setup. You'll need:

### Infrastructure Setup

1. **Neon Database** (https://console.neon.tech/)
   - Create free account
   - Create new database
   - Get connection URL
   - Run `database-schema.sql` to create tables

2. **Upstash Vector** (https://console.upstash.com/)
   - Create free account
   - Create Vector index with:
     - Dimensions: 1536
     - Similarity: Cosine
   - Get URL and token

3. **Update `.env` file** with these credentials:
   ```bash
   DATABASE_URL=postgresql://...
   UPSTASH_VECTOR_URL=https://...
   UPSTASH_VECTOR_TOKEN=...
   ```

### Install Full Dependencies

```bash
pip install -r scripts/requirements.txt
```

**Note:** If `pronouncing` fails to install, you can skip it - the script will work without it for most fragments.

### Run Phase 2

```bash
cd scripts
python3 import_fragments.py --complete-import ../fragment-corpus-cleaned.csv
```

This will:
- Load your reviewed tags from `tags-review.json`
- Analyze prosody (syllables, stress, rhyme)
- Generate embeddings via OpenRouter
- Save to database and vector store
- Create markdown files in `lyrics-vault/`

---

## Troubleshooting

### "Module not found" errors
```bash
pip3 install <module-name>
```

### "Missing environment variable"
Make sure you're in the project root where `.env` is located, or set the variable manually:
```bash
export OPENROUTER_API_KEY=sk-or-v1-...
```

### "File not found: tags-review.json"
You must run Phase 1 (`--generate-tags`) before Phase 2 (`--complete-import`)

### Check which Python you're using
```bash
which python3
python3 --version  # Should be 3.9 or higher
```

---

## What's Next?

After successfully importing fragments:

1. **Verify the data** - Query your database to see fragments
2. **Test vector search** - Try semantic search in Upstash
3. **Build the generation API** - Create the verse generation endpoint
4. **Connect the frontend** - Hook up the React app to the API

---

## Using Claude Code in Terminal

If you have Claude Code installed locally, you can ask it to help with any step:

```bash
# In your local terminal
claude "help me set up Neon database for Lybrarian"
claude "run the fragment import script and show me the output"
claude "check if my tags-review.json is valid JSON"
```

---

**Good luck! The script is ready to run. Start with Phase 1 whenever you're ready.**
