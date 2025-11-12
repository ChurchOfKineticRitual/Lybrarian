# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Lybrarian** is a mobile-first Progressive Web App (PWA) for AI-assisted lyric writing. It helps songwriters generate verse variations by drawing from a personal library of lyric fragments, using semantic matching, prosodic analysis (syllables, stress patterns, rhyme), and iterative feedback.

**Core Loop:** Input verse → Generate 10 variations → Rate (Best/Fine/Not the vibe) → Iterate with feedback → Keep favorites → Export

## Architecture

**Stack:**
- Frontend: React PWA + Tailwind CSS + ProseMirror
- Backend: Netlify Functions (serverless)
- Database: Neon (serverless Postgres)
- Vector Search: Upstash Vector
- Vault Storage: GitHub repo (Obsidian-compatible markdown)
- LLM: Anthropic Claude API (Sonnet 4.5)
- Embeddings: OpenAI text-embedding-3-small

**Data Flow:**
1. Fragments stored as markdown in GitHub repo (Obsidian vault)
2. Metadata + prosodic analysis stored in Neon DB
3. Semantic embeddings stored in Upstash Vector
4. Generation combines semantic search (vector) + prosodic filtering (SQL)

## Key Concepts

### Fragment Types
- **Rhythmic (Y):** Requires full prosodic analysis (syllables, stress pattern, rhyme phonetics)
- **Arythmic (N):** Requires basic rhyme analysis only (syllables, rhyme phonetics, no stress pattern)

Note: ALL fragments are semantic (have meaning) and get semantic embeddings. The distinction is prosodic analysis depth.

### Four-Way Toggle Settings
1. **Religiosity** (fragment adherence): No / Ish / Yes
2. **Rhythm** (prosodic matching): No / Ish / Yes
3. **Rhyming** (rhyme requirement): No / Ish / Yes
4. **Meaning** (input interpretation): No / Ish / Yes

Defaults: Ish, Yes, Ish, Yes

### Prosodic Analysis
**All fragments get basic rhyme analysis:**
- Syllable count
- US and British end rhyme sounds (IPA phonetic)

**Rhythmic fragments additionally get:**
- Stress pattern (binary string: "10101010")

Uses: CMUdict (NLTK), syllables library, pronouncing library

### Iteration System
- Iteration 1: Generate from input + settings + retrieved fragments
- Iteration 2+: Include previous "Best" and "Not the vibe" ratings as feedback
- System learns user preferences and improves output quality

## Development Commands

### Setup & Installation

```bash
# Install dependencies (once frontend/ is created)
cd frontend && npm install

# Set up database schema (✅ COMPLETED)
psql $DATABASE_URL < database-schema.sql

# Import initial 65 fragments (✅ COMPLETED)
# Phase 1: Generate tags
python scripts/import_fragments.py --generate-tags fragment-corpus-cleaned.csv
# Phase 2: Complete import 
python scripts/import_fragments.py --complete-import fragment-corpus-cleaned.csv

# Enhanced rhyme analysis (✅ COMPLETED)
# Dual pronunciation migration
psql $DATABASE_URL < database-migration-dual-pronunciation.sql
# Re-analyze all fragments
python scripts/import_fragments.py --reanalyze  
# Fix any failed rhymes with LLM fallback
python scripts/import_fragments.py --fix-rhymes
```

### Environment Variables

Required in Netlify (or `.env` for local development) - ✅ CONFIGURED:
```
# OpenRouter API (unified access to Claude + OpenAI) - ✅ SET
OPENROUTER_API_KEY=sk-or-v1-...
# Neon Database - ✅ SET
DATABASE_URL=postgresql://...
# Upstash Vector - ✅ SET  
UPSTASH_VECTOR_URL=https://...
UPSTASH_VECTOR_TOKEN=...
GITHUB_TOKEN=ghp_...
GITHUB_REPO=username/lyrics-vault
```

### Development Workflow

```bash
# Local development (when implemented)
netlify dev

# Deploy to preview
netlify deploy

# Deploy to production
netlify deploy --prod

# Test generation endpoint
curl -X POST http://localhost:8888/api/generate \
  -H "Content-Type: application/json" \
  -d '{"input":"test verse","settings":{"rhythm":"yes"}}'
```

## Database Schema

### Core Tables
- `fragments`: Fragment metadata, tags, content
- `fragment_lines`: Per-line prosodic analysis (syllables, stress, rhyme)
- `completed_lyrics`: Finished songs used for style reference
- `sessions`: Generation session tracking
- `verses`: Generated verses with ratings
- `projects`: Writing workspace sessions

### Key Queries

**Find fragments by syllable count:**
```sql
SELECT f.*, fl.* FROM fragments f
JOIN fragment_lines fl ON f.id = fl.fragment_id
WHERE fl.syllables = 8 AND f.rhythmic = true
ORDER BY f.created_at DESC;
```

**Get fragments for style reference:**
```sql
SELECT * FROM completed_lyrics
WHERE use_for_style = true
ORDER BY created_at DESC LIMIT 3;
```

## API Endpoints (Netlify Functions)

When implementing, create these in `netlify/functions/`:

- `generate.js` - Main generation endpoint (retrieval + LLM)
- `add-keeper.js` - Save verse to workspace
- `update-rating.js` - Update verse rating (Best/Fine/Not the vibe)
- `fragments.js` - Query/search fragments
- `projects.js` - Project CRUD operations
- `export-song.js` - Export workspace to completed song

## Generation Pipeline

1. **Analyze Input Prosody** (if Rhythm ≠ No)
   - Count syllables per line
   - Generate stress pattern
   - Extract end rhyme sounds

2. **Retrieve Fragments**
   - Semantic: Vector search on input text (if Meaning ≠ No)
   - Prosodic: SQL query on `fragment_lines` for syllable match
   - Combine and rank top 15-20 fragments

3. **Build Prompt**
   - Input verse + settings
   - Retrieved fragments
   - 2-3 completed lyrics for style reference
   - Previous ratings if iteration 2+ (Best + Not the vibe only)

4. **Generate with Claude API**
   - Request 10 verse variations
   - Stream response for better UX

5. **Validate** (if strict settings)
   - Verify syllable count if Rhythm: Yes
   - Verify rhyme matching if Rhyming: Yes
   - Regenerate failed verses (max 2 attempts)

6. **Save to Database**
   - Store session, verses, settings

## Critical Implementation Details

### Prosodic Analysis Pipeline
- Analyze ALL fragments for basic rhyme matching
- Rhythmic=Y fragments get full prosodic analysis (stress patterns)
- Arythmic=N fragments get basic analysis (syllables + rhyme sounds only)
- Use CMUdict for stress patterns and phonetics
- Handle multi-line fragments line-by-line
- Store per-line data in `fragment_lines` table

### Fragment Retrieval Strategy
- Semantic and prosodic retrieval run in parallel
- Scoring algorithm combines both result sets
- Rhythmic fragments scored higher if prosody matches
- Return top 15-20 to fit in LLM context window

### Iteration Feedback
- Only use "Best" and "Not the vibe" ratings for feedback
- "Fine" ratings provide no signal, ignore them
- Include 2-3 examples of each in iteration prompts
- Ask LLM to reflect on what worked/didn't work

### Mobile-First UI Requirements
- Minimum 44px tap targets
- Bottom navigation (thumb-friendly)
- Swipe gestures for verse navigation
- Segmented button controls (not sliders) for toggles
- Test on actual mobile devices, not just devtools

### Validation Rules
- **Rhythm: Yes** → Exact syllable count match per line
- **Rhythm: Ish** → ±2 syllables tolerance
- **Rhythm: No** → Approximate length only
- **Rhyming: Yes** → Perfect phonetic rhyme match
- **Rhyming: Ish** → Slant rhymes acceptable
- **Rhyming: No** → No rhyme requirement

## Development Phases

**✅ Phase 1** (Complete): Infrastructure + fragment import + enhanced rhyme analysis
**Phase 2** (Next): Core generation (input UI + API + review UI)  
**Phase 3** (Future): Iteration system (ratings + feedback loop)
**Phase 4** (Future): Workspace (keeper management + export)
**Phase 5** (Future): Mobile polish (PWA features + performance)
**Phase 6** (Future): Testing + deployment

## Project Structure (To Be Created)

```
lyric-assistant/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── InputScreen.jsx
│   │   │   ├── ReviewScreen.jsx
│   │   │   ├── WorkspaceScreen.jsx
│   │   │   └── ToggleControl.jsx
│   │   ├── api/client.js
│   │   ├── App.jsx
│   │   └── index.js
│   ├── public/
│   │   ├── manifest.json      # PWA manifest
│   │   └── service-worker.js  # Offline support
│   └── package.json
├── netlify/functions/         # Serverless API
│   ├── generate.js
│   ├── add-keeper.js
│   ├── update-rating.js
│   └── ...
├── scripts/                   # Python processing scripts
│   ├── import-fragments.py    # CSV → DB + Vector + Vault
│   ├── analyze-prosody.py
│   └── generate-embeddings.py
└── database-schema.sql        # Complete Postgres schema
```

## Documentation Reference

All specifications are in the repository root:
- `PROJECT-SUMMARY.md` - High-level overview (read first)
- `lyric-assistant-prd-final.md` - Complete product requirements (comprehensive)
- `quick-start-guide.md` - Step-by-step development guide
- `fragment-processing-spec.md` - Detailed fragment import algorithm
- `database-schema.sql` - Complete database schema with examples
- `fragment-corpus-cleaned.csv` - Initial 65 fragments to import

## Common Pitfalls

1. Don't skip rhyme analysis for arythmic fragments (rhythmic=N) - they still need basic rhyme data
2. Don't expose API keys - use environment variables only
3. Don't use "Fine" ratings for iteration feedback (no signal)
4. Don't validate too strictly for "Ish" settings - allow flexibility
5. Don't forget to test on actual mobile devices for touch interactions
6. Don't skip the vault sync - markdown files must commit to GitHub

## Success Metrics

- Keeper rate: >20% (2+ keepers per 10 verses)
- Iteration efficiency: <3 iterations to find 3+ keepers
- Generation time: <8 seconds
- Mobile Lighthouse score: >80

## Testing Strategy

- Unit tests: Prosodic analysis, retrieval algorithms, tag generation
- Integration tests: Fragment import end-to-end, generation API with mock LLM
- User testing: Complete workflow on real mobile devices

## Unique Technical Challenges

1. **Dual-mode retrieval**: Combining semantic (vector) and prosodic (SQL) search
2. **Prosodic accuracy**: CMUdict-based syllable/stress/rhyme analysis
3. **Iterative feedback**: Incorporating user ratings into subsequent generations
4. **Mobile complexity**: Complex creative workflow on touch devices
5. **Prompt engineering**: Setting-specific language for four independent toggles
