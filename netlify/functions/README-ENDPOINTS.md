# Lybrarian API Endpoints

This directory contains Netlify serverless functions that power the Lybrarian backend API.

## Current Endpoints

### 1. Generate (`/api/generate`) ✅ IMPLEMENTED

**File:** `generate.js`

**Purpose:** Core lyric generation pipeline - orchestrates prosody analysis, fragment retrieval, prompt building, and Claude API calls to generate 10 verse variations.

**Method:** POST

**Key Features:**
- Validates request and settings
- Analyzes input prosody (syllables, rhyme sounds)
- Retrieves relevant fragments (semantic + prosodic matching)
- Fetches style references from completed songs
- Builds context-rich prompt
- Calls Claude Sonnet 4.5 via OpenRouter
- Validates output against strict settings
- Saves session and verses to database
- Returns 10 variations with metadata

**Documentation:** See `GENERATE-ENDPOINT.md` for complete API spec

**Test:** `node netlify/functions/test-generate.js`

---

### 2. Health Check (`/api/health`) ✅ IMPLEMENTED

**File:** `health.js`

**Purpose:** Simple health check endpoint for monitoring and debugging.

**Method:** GET

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-12T20:00:00.000Z"
}
```

---

## Planned Endpoints (Phase 3-4)

### 3. Update Rating (`/api/update-rating`) 🔜 PHASE 3

**Purpose:** Update the rating of a generated verse (Best / Fine / Not the vibe)

**Method:** PATCH

**Request:**
```json
{
  "verseId": 123,
  "rating": "best"  // "best" | "fine" | "not_the_vibe"
}
```

**Response:**
```json
{
  "success": true,
  "verseId": 123,
  "rating": "best"
}
```

---

### 4. Add Keeper (`/api/add-keeper`) 🔜 PHASE 4

**Purpose:** Save a verse to the project workspace as a "keeper"

**Method:** POST

**Request:**
```json
{
  "verseId": 123,
  "projectId": "proj-abc"
}
```

**Response:**
```json
{
  "success": true,
  "verseId": 123,
  "isKeeper": true
}
```

---

### 5. Get Session (`/api/sessions/:id`) 🔜 PHASE 3

**Purpose:** Retrieve a generation session with all verses and ratings

**Method:** GET

**Response:**
```json
{
  "sessionId": "sess-abc",
  "input": "...",
  "settings": {...},
  "iteration": 1,
  "verses": [...]
}
```

---

### 6. Get Project (`/api/projects/:id`) 🔜 PHASE 4

**Purpose:** Retrieve project workspace with keeper verses

**Method:** GET

**Response:**
```json
{
  "projectId": "proj-abc",
  "name": "My Song",
  "workspace": "...",
  "sessions": [...],
  "keeperCount": 12
}
```

---

### 7. Export Song (`/api/export-song`) 🔜 PHASE 4

**Purpose:** Export project workspace to completed_lyrics table

**Method:** POST

**Request:**
```json
{
  "projectId": "proj-abc",
  "title": "Finished Song",
  "useForStyle": true
}
```

**Response:**
```json
{
  "success": true,
  "songId": "song-xyz",
  "title": "Finished Song"
}
```

---

### 8. Query Fragments (`/api/fragments`) 🔜 FUTURE

**Purpose:** Search and filter fragments for reference

**Method:** GET

**Query Params:**
- `tags`: Filter by tags
- `syllables`: Filter by syllable count
- `rhythmic`: Filter by rhythmic/arythmic
- `search`: Semantic search query

**Response:**
```json
{
  "fragments": [...],
  "total": 42
}
```

---

## Library Modules

Shared utilities used by multiple endpoints:

### `/lib/prosody.js` ✅

Prosodic analysis: syllable counting, rhyme sound extraction, verse analysis

**Functions:**
- `analyzeLine(text)` - Analyze single line
- `analyzeVerse(verseText)` - Analyze multi-line verse
- `getRhymeSound(word)` - Extract rhyme sound
- `countSyllables(text)` - Count syllables
- `rhymesMatch(sound1, sound2)` - Compare rhyme sounds

---

### `/lib/retrieval.js` ✅

Fragment retrieval via dual strategy (semantic + prosodic)

**Functions:**
- `retrieveFragments(input, prosody, settings, db)` - Main retrieval
- `semanticRetrieval(text, topK)` - Vector search
- `prosodicRetrieval(prosody, db, setting)` - SQL search
- `combineAndRank(semantic, prosodic, settings, db)` - Merge results
- `generateEmbedding(text)` - Create embedding via OpenRouter

---

### `/lib/promptBuilder.js` ✅

Prompt construction for Claude API

**Functions:**
- `buildGenerationPrompt(input, settings, fragments, styleRefs, iteration, feedback)` - Complete prompt
- `buildSystemPrompt()` - System instructions
- `formatSettings(settings)` - Natural language constraints
- `formatFragments(fragments)` - Fragment library section
- `formatStyleReferences(styleRefs)` - Style examples
- `formatFeedback(feedback)` - Iteration feedback

---

### `/lib/db.js` ✅

Database connection and query utilities

**Functions:**
- `query(sql, params)` - Execute query
- `getClient()` - Get client for transactions
- `getPool()` - Get connection pool
- `closePool()` - Close connections

---

## Testing

### Unit Tests

Test individual modules:

```bash
# Prosody analysis
node netlify/functions/lib/prosody.js

# Prompt builder
node netlify/functions/lib/promptBuilder.example.js

# Generate endpoint
node netlify/functions/test-generate.js
```

### Integration Tests

Test with environment variables:

```bash
# Set env vars
export OPENROUTER_API_KEY=sk-or-v1-...
export DATABASE_URL=postgresql://...
export UPSTASH_VECTOR_URL=https://...
export UPSTASH_VECTOR_TOKEN=...

# Test retrieval system
node netlify/functions/test-retrieval.js

# Test generate endpoint (full pipeline)
./netlify/functions/test-generate-curl.sh local
```

### Local Development

```bash
# Start Netlify Dev server
netlify dev

# Endpoints available at:
# http://localhost:8888/.netlify/functions/generate
# http://localhost:8888/.netlify/functions/health

# Test with curl
curl http://localhost:8888/.netlify/functions/health
```

## Environment Variables

Required for all endpoints:

```bash
# OpenRouter (Claude + OpenAI embeddings)
OPENROUTER_API_KEY=sk-or-v1-...

# Neon Database
DATABASE_URL=postgresql://...

# Upstash Vector
UPSTASH_VECTOR_URL=https://...
UPSTASH_VECTOR_TOKEN=...
```

Optional:

```bash
# Node environment
NODE_ENV=development  # or 'production'

# GitHub (for vault sync - Phase 6)
GITHUB_TOKEN=ghp_...
GITHUB_REPO=username/lyrics-vault
```

## Deployment

### Netlify Configuration

Add environment variables in Netlify dashboard:

1. Site Settings → Environment Variables
2. Add all required variables
3. Deploy will automatically use them

### Deploy Commands

```bash
# Preview deploy
netlify deploy

# Production deploy
netlify deploy --prod
```

### Monitoring

View function logs:

1. Netlify Dashboard → Functions
2. Click on function name
3. View real-time logs and metrics

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│                                                      │
│  Input Screen → Review Screen → Workspace Screen    │
└────────────────────┬────────────────────────────────┘
                     │ HTTP/JSON
                     ▼
┌─────────────────────────────────────────────────────┐
│            Netlify Serverless Functions             │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ generate │  │  rating  │  │  keeper  │  ...    │
│  └────┬─────┘  └──────────┘  └──────────┘         │
│       │                                              │
│       ├─→ prosody.js (syllables, rhyme)            │
│       ├─→ retrieval.js (semantic + prosodic)       │
│       ├─→ promptBuilder.js (prompt assembly)       │
│       └─→ db.js (PostgreSQL)                       │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌────────┐  ┌─────────┐  ┌──────────┐
   │  Neon  │  │ Upstash │  │OpenRouter│
   │   DB   │  │ Vector  │  │  (Claude)│
   └────────┘  └─────────┘  └──────────┘
```

## Development Phases

- ✅ **Phase 1**: Infrastructure + fragment import + prosody analysis
- ✅ **Phase 2**: Core generation (generate endpoint + library modules)
- 🔜 **Phase 3**: Iteration system (ratings + feedback loop)
- 🔜 **Phase 4**: Workspace (keeper management + export)
- 🔜 **Phase 5**: Mobile polish (PWA features + performance)
- 🔜 **Phase 6**: Testing + deployment + vault sync

## Documentation

- `GENERATE-ENDPOINT.md` - Complete generate endpoint specification
- `lib/README.md` - Library modules documentation
- `lib/INTEGRATION.md` - Module integration guide
- `lib/prosody-usage.md` - Prosody module usage examples
- `/CLAUDE.md` - Project overview
- `/lyric-assistant-prd-final.md` - Product requirements

## Contributing

When adding new endpoints:

1. Create endpoint file: `[name].js`
2. Export `handler` function
3. Use library modules for shared logic
4. Add tests: `test-[name].js`
5. Update this README
6. Document API spec in `[NAME]-ENDPOINT.md`

## Support

For issues:
1. Check Netlify function logs
2. Verify environment variables
3. Test modules individually
4. Review documentation
5. Check database schema
