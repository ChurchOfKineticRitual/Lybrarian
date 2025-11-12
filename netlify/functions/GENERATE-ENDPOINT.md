# Generate Endpoint Documentation

## Overview

The `/api/generate` endpoint is the core of Lybrarian's lyric generation pipeline. It orchestrates the complete workflow from input verse to 10 generated variations, integrating semantic search, prosodic analysis, and Claude AI.

**File:** `/netlify/functions/generate.js`

## Architecture

### Pipeline Flow

```
Input Verse
    ↓
1. Validate Request
    ↓
2. Analyze Input Prosody (if rhythm ≠ "no")
    ↓
3. Retrieve Fragments (semantic + prosodic)
    ↓
4. Get Style References (completed songs)
    ↓
5. Build Prompt (combine all context)
    ↓
6. Call Claude API (OpenRouter)
    ↓
7. Validate Output (if strict settings)
    ↓
8. Save to Database (sessions + verses)
    ↓
9. Return Response
```

### Dependencies

- **Prosody Module** (`lib/prosody.js`) - Syllable counting, rhyme analysis
- **Retrieval Module** (`lib/retrieval.js`) - Vector + SQL fragment search
- **Prompt Builder** (`lib/promptBuilder.js`) - Prompt construction
- **Database** (`lib/db.js`) - PostgreSQL connection
- **OpenRouter API** - Claude Sonnet 4.5 access
- **Upstash Vector** - Semantic embeddings (used by retrieval)

## API Specification

### Endpoint

```
POST /.netlify/functions/generate
```

Or with Netlify routing:

```
POST /api/generate
```

### Request Body

```json
{
  "input": "Multi-line verse text here\nCan span multiple lines",
  "settings": {
    "religiosity": "ish",  // Fragment adherence: "no" | "ish" | "yes"
    "rhythm": "yes",       // Prosodic matching: "no" | "ish" | "yes"
    "rhyming": "ish",      // Rhyme requirement: "no" | "ish" | "yes"
    "meaning": "yes",      // Semantic interpretation: "no" | "ish" | "yes"
    "theme": "urban nostalgia",  // Optional: thematic keyword
    "steer": "more introspective"  // Optional: creative direction
  },
  "iteration": 1,          // Optional: iteration number (default: 1)
  "projectId": "proj-123", // Optional: project ID (creates default if not provided)
  "feedback": {            // Optional: required for iteration 2+
    "best": [              // Array of best-rated verses from previous iteration
      {
        "verse_text": "...",
        "explanation": "Why it worked"
      }
    ],
    "notTheVibe": [        // Array of rejected verses
      {
        "verse_text": "...",
        "explanation": "Why it didn't work"
      }
    ]
  }
}
```

### Response Body

**Success (200):**

```json
{
  "success": true,
  "sessionId": "sess-abc123",
  "projectId": "proj-xyz789",
  "verses": [
    {
      "verse": "Generated verse text\nMultiple lines here",
      "fragmentsUsed": [1, 3, 7],
      "explanation": "Brief note on creative approach",
      "rating": null
    }
    // ...9 more verses...
  ],
  "metadata": {
    "generationTime": "2500ms",
    "fragmentCount": 18,
    "styleRefCount": 2,
    "iteration": 1
  },
  "debug": {
    "inputProsody": [
      {
        "text": "Walking through the city at night",
        "syllables": 8,
        "rhymeSound": "ght"
      }
      // ...more lines...
    ],
    "retrievedFragments": [
      {
        "id": "frag-001",
        "score": 0.87,
        "content": "City lights and lonely nights..."
      }
      // ...top 5 fragments...
    ]
  }
}
```

**Error (400 - Bad Request):**

```json
{
  "error": "Input verse is required and must be a non-empty string"
}
```

**Error (500 - Internal Server Error):**

```json
{
  "error": "Internal server error",
  "message": "OpenRouter API request failed: 500 Internal Server Error",
  "details": "Stack trace (only in development)"
}
```

## Settings Behavior

### Religiosity (Fragment Adherence)

- **`"no"`**: Generate freely, fragments are optional inspiration only
- **`"ish"`**: Draw inspiration from fragments but paraphrase and adapt (default)
- **`"yes"`**: Use exact phrases from fragments, stay close to source

### Rhythm (Prosodic Matching)

- **`"no"`**: Approximate length only
- **`"ish"`**: ±2 syllables tolerance per line
- **`"yes"`**: Exact syllable match per line (default)

### Rhyming

- **`"no"`**: Rhyming is optional
- **`"ish"`**: Slant rhymes acceptable (default)
- **`"yes"`**: Perfect rhyme match required

### Meaning (Semantic Interpretation)

- **`"no"`**: Reinterpret freely, can change topic
- **`"ish"`**: Keep general theme but explore variations
- **`"yes"`**: Stay close to input's meaning (default)

## Validation & Regeneration

When `rhythm: "yes"` or `rhyming: "yes"`, the endpoint validates generated verses:

1. **Syllable Count Check** (rhythm="yes"):
   - Each line must match input syllable count exactly
   - Uses `analyzeLine()` from prosody module

2. **Rhyme Check** (rhyming="yes"):
   - Last line must rhyme with input's last line
   - Uses `rhymesMatch()` comparison

3. **Regeneration**:
   - Failed verses are regenerated (max 2 attempts)
   - After 2 failures, verse is accepted with warning
   - Logged for debugging

## Database Schema

### Sessions Table

```sql
CREATE TABLE generation_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  input_verse TEXT NOT NULL,
  setting_religiosity TEXT NOT NULL,
  setting_rhythm TEXT NOT NULL,
  setting_rhyming TEXT NOT NULL,
  setting_meaning TEXT NOT NULL,
  theme_selection TEXT NOT NULL,
  steer_text TEXT DEFAULT '',
  iteration_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Verses Table

```sql
CREATE TABLE generated_verses (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  iteration_number INTEGER NOT NULL,
  verse_content TEXT NOT NULL,
  rating TEXT DEFAULT 'fine',  -- 'best' | 'fine' | 'not_the_vibe'
  is_keeper BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Environment Variables

Required environment variables (set in Netlify or `.env`):

```bash
# OpenRouter API (Claude + OpenAI embeddings)
OPENROUTER_API_KEY=sk-or-v1-...

# Neon Database
DATABASE_URL=postgresql://...

# Upstash Vector (used by retrieval module)
UPSTASH_VECTOR_URL=https://...
UPSTASH_VECTOR_TOKEN=...
```

## Example Usage

### Basic Generation (First Iteration)

```bash
curl -X POST https://lybrarian.app/.netlify/functions/generate \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Walking through the city at night\nStreetlights guide my way\nMemories of you still burning bright\nWishing you would stay",
    "settings": {
      "religiosity": "ish",
      "rhythm": "yes",
      "rhyming": "ish",
      "meaning": "yes",
      "theme": "urban nostalgia"
    }
  }'
```

### Second Iteration with Feedback

```bash
curl -X POST https://lybrarian.app/.netlify/functions/generate \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Walking through the city at night\nStreetlights guide my way",
    "settings": {
      "religiosity": "ish",
      "rhythm": "yes",
      "rhyming": "ish",
      "meaning": "yes"
    },
    "iteration": 2,
    "sessionId": "sess-abc123",
    "feedback": {
      "best": [
        {
          "verse_text": "Dancing through the district by moonlight\nNeon signs illuminate my trail",
          "explanation": "Great urban imagery"
        }
      ],
      "notTheVibe": [
        {
          "verse_text": "Running in the town when dark\nLamps show where to go",
          "explanation": "Too simple, lost the poetic quality"
        }
      ]
    }
  }'
```

## Testing

### Unit Tests

```bash
# Test module imports and validation
node netlify/functions/test-generate.js
```

### Local Development

```bash
# Start Netlify Dev server
netlify dev

# Test endpoint at http://localhost:8888
curl -X POST http://localhost:8888/.netlify/functions/generate \
  -H "Content-Type: application/json" \
  -d @test-request.json
```

### Integration Test (requires env vars)

```bash
# Set environment variables
export OPENROUTER_API_KEY=sk-or-v1-...
export DATABASE_URL=postgresql://...
export UPSTASH_VECTOR_URL=https://...
export UPSTASH_VECTOR_TOKEN=...

# Run full generation pipeline
node netlify/functions/test-generate-full.js
```

## Error Handling

### Common Errors

1. **400 - Missing Input**
   - Cause: Empty or missing `input` field
   - Solution: Provide non-empty verse text

2. **400 - Invalid Settings**
   - Cause: Setting values not in ["no", "ish", "yes"]
   - Solution: Use valid setting values

3. **400 - Missing Feedback**
   - Cause: `iteration > 1` but no feedback provided
   - Solution: Include feedback object with best/notTheVibe arrays

4. **500 - API Key Missing**
   - Cause: OPENROUTER_API_KEY not set
   - Solution: Set environment variable

5. **500 - Database Connection Failed**
   - Cause: DATABASE_URL invalid or database unreachable
   - Solution: Check Neon connection string

6. **500 - Claude API Failed**
   - Cause: OpenRouter API error or invalid response
   - Solution: Check API status, retry

7. **500 - JSON Parse Error**
   - Cause: Claude returned non-JSON response
   - Solution: Check prompt format, retry

## Performance

### Target Metrics

- **Generation Time**: < 8 seconds (end-to-end)
- **Fragment Retrieval**: < 1 second
- **Claude API Call**: 3-6 seconds (varies by model load)
- **Database Save**: < 500ms

### Optimization Notes

- Uses connection pooling for database (reused across invocations)
- Parallel retrieval (semantic + prosodic queries run concurrently)
- Caches style references within single request
- Only validates if strict settings require it

## Integration Points

### Frontend Integration

The frontend should:

1. Send input verse + settings on initial generation
2. Display 10 verses with rating controls
3. Collect user ratings (Best / Fine / Not the vibe)
4. For iteration 2+: send feedback with best/notTheVibe arrays
5. Handle loading states (8s generation time)
6. Display validation warnings if verses fail strict requirements

### Future Endpoints

This endpoint integrates with:

- `POST /api/update-rating` - Update verse ratings
- `POST /api/add-keeper` - Save verse to workspace
- `GET /api/sessions/:id` - Retrieve session history
- `POST /api/export-song` - Export final song to completed_lyrics

## Debugging

### Enable Verbose Logging

The endpoint logs detailed information to console:

```javascript
console.log('=== Generation Pipeline Started ===');
console.log('Input:', body.input.substring(0, 100) + '...');
console.log('Settings:', body.settings);
console.log('Iteration:', body.iteration || 1);
// ...more logs throughout pipeline...
```

View logs in Netlify dashboard or local terminal.

### Debug Response Fields

The response includes a `debug` object with:

- **inputProsody**: Syllable counts and rhyme sounds per line
- **retrievedFragments**: Top 5 fragments with scores and content preview

Use these to understand why certain verses were generated.

### Common Issues

**Problem**: Verses don't match syllable count
- Check: `debug.inputProsody` to see what was analyzed
- Solution: Verify input verse formatting, check rhythm setting

**Problem**: No fragments retrieved
- Check: `metadata.fragmentCount` in response
- Solution: Verify fragment data exists in database, check Upstash credentials

**Problem**: Generic/boring verses
- Check: `metadata.styleRefCount` - are style references being used?
- Solution: Add completed songs to `completed_lyrics` with `use_for_style = true`

## Security

- Never exposes API keys in responses
- Validates all input before processing
- Uses parameterized SQL queries (prevents injection)
- Sanitizes error messages in production
- Connection pooling prevents resource exhaustion

## Future Enhancements

1. **Streaming Response**: Stream verses as they're generated
2. **Batch Generation**: Generate multiple sets in parallel
3. **Caching**: Cache fragments for same input+settings
4. **Rate Limiting**: Prevent abuse
5. **User Authentication**: Multi-user support
6. **Analytics**: Track generation quality metrics
7. **A/B Testing**: Test different prompt strategies

## Related Documentation

- `/netlify/functions/lib/README.md` - Module documentation
- `/netlify/functions/lib/INTEGRATION.md` - Module integration guide
- `/CLAUDE.md` - Project overview and development guide
- `/lyric-assistant-prd-final.md` - Complete product requirements
- `/database-schema.sql` - Full database schema

## Support

For issues or questions:
1. Check logs in Netlify dashboard
2. Verify environment variables are set
3. Test individual modules with unit tests
4. Review this documentation
5. Check related documentation files
