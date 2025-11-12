# Lybrarian Retrieval System

## Summary

The dual retrieval system for finding relevant lyric fragments has been successfully built and is ready for integration into the generation pipeline.

## What Was Built

### Core Modules

1. **`/netlify/functions/lib/retrieval.js`** (10KB)
   - Main retrieval system with 4 exported functions
   - Combines semantic (vector) and prosodic (SQL) search
   - Implements scoring algorithm with bonuses for matches
   - Graceful error handling and fallback behavior

2. **`/netlify/functions/lib/db.js`** (1.8KB)
   - PostgreSQL connection pool manager
   - Optimized for Neon serverless database
   - Query helper functions with logging
   - Transaction support via `getClient()`

3. **`/netlify/functions/test-retrieval.js`** (2.4KB)
   - Test endpoint: `GET /api/test-retrieval?input=your+verse`
   - Demonstrates retrieval system usage
   - Returns detailed results for debugging

### Documentation

4. **`/netlify/functions/lib/README.md`** (5.7KB)
   - Complete API documentation
   - Function signatures and examples
   - Performance notes and testing guide

5. **`/netlify/functions/lib/INTEGRATION.md`** (6.2KB)
   - Integration guide with prosody.js
   - Complete generation function example
   - Error handling patterns

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Generation Function (generate.js)              │
│  - Analyzes input with prosody.js               │
│  - Calls retrieveFragments()                    │
│  - Builds prompt with results                   │
└────────────────┬────────────────────────────────┘
                 │
       ┌─────────▼──────────┐
       │  retrieval.js      │
       │  Main Entry Point  │
       └─┬─────────────────┬┘
         │                 │
    ┌────▼────┐       ┌───▼─────┐
    │Semantic │       │Prosodic │
    │Retrieval│       │Retrieval│
    │(Vector) │       │  (SQL)  │
    └────┬────┘       └───┬─────┘
         │                │
    ┌────▼────────────────▼─────┐
    │  combineAndRank()         │
    │  - Merge results          │
    │  - Apply scoring bonuses  │
    │  - Return top 15-20       │
    └────┬──────────────────────┘
         │
    ┌────▼────────────────┐
    │ Fetch full fragment │
    │ data from database  │
    └─────────────────────┘
```

## Installation

### 1. Install Dependencies

```bash
cd /home/user/Lybrarian
npm install
```

This installs:
- `@upstash/vector@^1.1.1` - Vector database client
- `pg@^8.11.3` - PostgreSQL client
- `node-fetch@^2.7.0` - HTTP client for OpenRouter API

### 2. Verify Environment Variables

Ensure `.env` contains:

```bash
# OpenRouter API (for embeddings)
OPENROUTER_API_KEY=sk-or-v1-...

# Neon Database
DATABASE_URL=postgresql://...

# Upstash Vector
UPSTASH_VECTOR_URL=https://...
UPSTASH_VECTOR_TOKEN=...
```

### 3. Test the System

```bash
# Start Netlify dev server
netlify dev

# In another terminal, test retrieval
curl "http://localhost:8888/api/test-retrieval?input=Walking+down+the+city+street"
```

Expected response:
```json
{
  "success": true,
  "input": "Walking down the city street",
  "results": {
    "semantic": { "count": 10 },
    "prosodic": { "count": 15 },
    "combined": {
      "count": 18,
      "fragments": [ ... ]
    }
  }
}
```

## API Reference

### Main Function: `retrieveFragments()`

```js
const { retrieveFragments } = require('./lib/retrieval');
const db = require('./lib/db');

const fragments = await retrieveFragments(
  inputText,      // User's input verse
  prosodyData,    // From prosody.js analyzeVerse()
  settings,       // { meaning, rhythm, rhyming, religiosity }
  db              // Database connection
);
```

**Returns:** Array of up to 20 fragment objects with:
- Full content and metadata
- Tags and context notes
- Per-line prosodic data
- Retrieval score (0-1.5 range)

### Scoring Algorithm

```
Base Score: Semantic similarity (0-1 from vector search)
  +0.3  if fragment found in prosodic results
  +0.2  if fragment is rhythmic AND rhythm='yes'
────────────────────────────────────────────────
Total: 0 to 1.5 (sorted descending, top 15-20 returned)
```

### Retrieval Behavior by Settings

| Setting | Semantic | Prosodic | Behavior |
|---------|----------|----------|----------|
| `meaning='yes'` | ✓ | Based on rhythm | Vector search enabled |
| `meaning='ish'` | ✓ | Based on rhythm | Vector search enabled |
| `meaning='no'` | ✗ | Based on rhythm | Skip semantic search |
| `rhythm='yes'` | Based on meaning | Exact syllables | SQL: `syllables = N` |
| `rhythm='ish'` | Based on meaning | ±2 syllables | SQL: `syllables BETWEEN N-2 AND N+2` |
| `rhythm='no'` | Based on meaning | ✗ | Skip prosodic search |

## Integration with Generation Pipeline

### Complete Example

```js
const { analyzeVerse } = require('./lib/prosody');
const { retrieveFragments } = require('./lib/retrieval');
const { buildPrompt } = require('./lib/promptBuilder');
const db = require('./lib/db');

exports.handler = async (event) => {
  const { inputText, settings } = JSON.parse(event.body);

  // Step 1: Analyze prosody
  const lines = analyzeVerse(inputText);
  const prosodyData = {
    lines: lines.map(line => ({
      text: line.text,
      syllables: line.syllables,
      rhyme: line.rhymeSound
    }))
  };

  // Step 2: Retrieve fragments
  const fragments = await retrieveFragments(
    inputText,
    prosodyData,
    settings,
    db
  );

  // Step 3: Build prompt and generate
  // ... (rest of generation logic)

  return {
    statusCode: 200,
    body: JSON.stringify({
      verses: generatedVerses,
      fragmentsUsed: fragments.length
    })
  };
};
```

## Files Created

```
/home/user/Lybrarian/
├── package.json                           (updated with dependencies)
├── netlify/functions/
│   ├── lib/
│   │   ├── retrieval.js                   (10.0 KB) - Main retrieval system
│   │   ├── db.js                          (1.8 KB)  - Database connection
│   │   ├── README.md                      (5.7 KB)  - API documentation
│   │   └── INTEGRATION.md                 (6.2 KB)  - Integration guide
│   └── test-retrieval.js                  (2.4 KB)  - Test endpoint
└── RETRIEVAL-SYSTEM.md                    (this file)
```

## Performance

### Expected Timing

- **Semantic retrieval**: 300-700ms (embedding + vector search)
- **Prosodic retrieval**: 50-150ms (SQL queries)
- **Combine & rank**: 10-50ms (in-memory operations)
- **Fetch full data**: 50-100ms (single SQL query with JOIN)
- **Total**: 400-1000ms per retrieval

### Optimization Opportunities (Future)

1. Cache embeddings for repeat queries
2. Pre-compute prosodic indexes
3. Use database read replicas
4. Parallel retrieval execution
5. Target: <200ms retrieval time

## Error Handling

All functions implement **graceful degradation**:

- If semantic retrieval fails → returns `[]`, uses prosodic only
- If prosodic retrieval fails → returns `[]`, uses semantic only
- If both fail → returns `[]`, generation proceeds without fragments
- Database errors → logged and propagated
- Invalid input → safe defaults, never crashes

## Testing Checklist

- [x] Syntax validation passed
- [ ] Install dependencies: `npm install`
- [ ] Test endpoint: `curl /api/test-retrieval`
- [ ] Semantic retrieval: Verify vector search works
- [ ] Prosodic retrieval: Verify SQL queries work
- [ ] Combined scoring: Verify ranking algorithm
- [ ] Full fragments: Verify JOIN query returns complete data
- [ ] Error handling: Test with missing env vars
- [ ] Performance: Measure timing under load

## Next Steps

1. **Install dependencies**: Run `npm install` in project root
2. **Test retrieval**: Use test endpoint to verify it works
3. **Integrate with generation**: Import `retrieveFragments()` in `generate.js`
4. **Build prompt construction**: Pass fragments to `buildPrompt()`
5. **Implement validation**: Use prosody data for strict setting checks

## Success Criteria

- ✓ All 4 retrieval functions implemented
- ✓ Scoring algorithm matches spec (+0.3 prosodic, +0.2 rhythmic)
- ✓ Graceful error handling with fallbacks
- ✓ Database connection utility created
- ✓ Test endpoint for debugging
- ✓ Complete documentation provided
- [ ] Dependencies installed and tested
- [ ] Integration with generation pipeline

## Reference Documentation

- See `/netlify/functions/lib/README.md` for detailed API docs
- See `/netlify/functions/lib/INTEGRATION.md` for integration patterns
- See `/home/user/Lybrarian/lyric-assistant-prd-final.md` for full spec
- See `/home/user/Lybrarian/database-schema.sql` for database structure

---

**Status**: Ready for installation and testing
**Last Updated**: 2025-11-12
**Dependencies**: @upstash/vector@^1.1.1, pg@^8.11.3, node-fetch@^2.7.0
