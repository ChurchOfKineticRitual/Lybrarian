# Integration Guide: Prosody + Retrieval

How to use the prosody analysis and retrieval system together in generation functions.

## Overview

The generation pipeline has two analysis phases:

1. **Client-side analysis** (JavaScript): Basic syllable counting using `prosody.js`
2. **Server-side storage** (Python + PostgreSQL): Full CMUdict phonetic analysis in database

The retrieval system bridges these by:
- Using simple syllable counts from JS prosody analysis for SQL filtering
- Accessing full phonetic data (stress patterns, IPA rhymes) from database

## Basic Usage Pattern

```js
const { analyzeVerse } = require('./lib/prosody');
const { retrieveFragments } = require('./lib/retrieval');
const db = require('./lib/db');

exports.handler = async (event) => {
  const { inputText, settings } = JSON.parse(event.body);

  // Step 1: Analyze input prosody (JavaScript)
  const lines = analyzeVerse(inputText);

  // Step 2: Format for retrieval system
  const prosodyData = {
    lines: lines.map(line => ({
      text: line.text,
      syllables: line.syllables,
      // Note: stress patterns not available in JS,
      // but database has them for fragments
      rhyme: line.rhymeSound // Simplified client-side rhyme
    }))
  };

  // Step 3: Retrieve matching fragments
  const fragments = await retrieveFragments(
    inputText,
    prosodyData,
    settings,
    db
  );

  // Step 4: Use fragments in prompt construction
  // ...
};
```

## Prosody Data Format

### From `prosody.js` (JavaScript)

```js
const lines = analyzeVerse("Walking down the street\nFinding faces I might meet");
// Returns:
[
  {
    text: "Walking down the street",
    syllables: 6,
    endWord: "street",
    rhymeSound: "eet" // Simplified (last 2-3 letters)
  },
  {
    text: "Finding faces I might meet",
    syllables: 7,
    endWord: "meet",
    rhymeSound: "eet"
  }
]
```

### In Database (`fragment_lines` table)

```sql
-- Full CMUdict-based phonetic analysis from Python
SELECT text, syllables, stress_pattern, end_rhyme_us, end_rhyme_gb
FROM fragment_lines
WHERE fragment_id = 'frag0001';
```

Returns:
```
text                        | syllables | stress_pattern | end_rhyme_us | end_rhyme_gb
----------------------------|-----------|----------------|--------------|-------------
Walking down the street     | 6         | 101010         | IY T         | IY T
Finding faces I might meet  | 7         | 1010101        | IY T         | IY T
```

## Why Two Systems?

**JavaScript prosody** (`prosody.js`):
- Fast, client-side syllable counting
- Approximate rhyme detection
- Good enough for input analysis
- Used for: Real-time validation, prosodic retrieval filtering

**Python + CMUdict** (database):
- Precise stress patterns (1=stressed, 0=unstressed)
- Accurate IPA phonetic transcription
- Dual US/British pronunciation support
- Used for: Fragment storage, strict validation, detailed matching

## Retrieval Behavior by Setting

### Rhythm = 'yes'
- Prosodic retrieval: EXACT syllable match
- SQL: `WHERE syllables = $1`
- Uses JavaScript-analyzed syllables from input

### Rhythm = 'ish'
- Prosodic retrieval: ±2 syllables tolerance
- SQL: `WHERE syllables BETWEEN $1 AND $2`
- More flexible, catches close matches

### Rhythm = 'no'
- Prosodic retrieval: SKIPPED
- Only semantic (vector) retrieval runs
- Length-agnostic

## Complete Generation Function Example

```js
const { analyzeVerse } = require('./lib/prosody');
const { retrieveFragments } = require('./lib/retrieval');
const { buildPrompt } = require('./lib/promptBuilder');
const db = require('./lib/db');

exports.handler = async (event) => {
  try {
    const { inputText, settings } = JSON.parse(event.body);

    // 1. Analyze input prosody
    const lines = analyzeVerse(inputText);
    console.log(`Analyzed ${lines.length} lines`);

    // 2. Format prosody data
    const prosodyData = {
      lines: lines.map(line => ({
        text: line.text,
        syllables: line.syllables,
        rhyme: line.rhymeSound
      }))
    };

    // 3. Retrieve fragments (dual semantic + prosodic)
    const fragments = await retrieveFragments(
      inputText,
      prosodyData,
      settings,
      db
    );
    console.log(`Retrieved ${fragments.length} fragments`);

    // 4. Fetch style reference lyrics
    const styleResult = await db.query(
      'SELECT content FROM completed_lyrics WHERE use_for_style = true LIMIT 3'
    );
    const styleLyrics = styleResult.rows.map(r => r.content);

    // 5. Build prompt
    const prompt = buildPrompt({
      inputText,
      fragments,
      styleLyrics,
      settings,
      prosodyData
    });

    // 6. Call Claude API
    // ... (LLM generation logic)

    // 7. Return results
    return {
      statusCode: 200,
      body: JSON.stringify({
        verses: generatedVerses,
        fragmentsUsed: fragments.length,
        prosodyAnalysis: prosodyData
      })
    };

  } catch (error) {
    console.error('Generation error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

## Error Handling

Both systems implement graceful degradation:

```js
// If prosody analysis fails
const lines = analyzeVerse(inputText);
// Returns: [] (empty array, safe to continue)

// If retrieval fails
const fragments = await retrieveFragments(...);
// Returns: [] (empty array, generation proceeds without fragments)
```

## Performance Optimization

### Current Flow (Acceptable)
1. Analyze input (JS): ~5-20ms
2. Semantic retrieval: ~300-700ms
3. Prosodic retrieval: ~50-150ms
4. Total: ~400-900ms

### Future Optimization
- Cache embeddings for common phrases
- Pre-compute prosodic indexes
- Parallel retrieval execution
- Target: <200ms retrieval time

## Testing

Test prosody + retrieval together:

```bash
# Terminal 1: Start local Netlify dev
netlify dev

# Terminal 2: Test the pipeline
curl -X POST http://localhost:8888/api/test-retrieval \
  -H "Content-Type: application/json" \
  -d '{
    "inputText": "Walking down the city street",
    "settings": {
      "meaning": "yes",
      "rhythm": "ish",
      "rhyming": "ish",
      "religiosity": "ish"
    }
  }'
```

Or use the simple GET endpoint:
```bash
curl "http://localhost:8888/api/test-retrieval?input=Walking+down+the+city+street"
```

## Common Pitfalls

1. **Missing prosody data**: Always run `analyzeVerse()` before `retrieveFragments()`
2. **Empty input**: Handle empty strings gracefully (prosody returns `[]`)
3. **Database connection**: Ensure `DATABASE_URL` env var is set
4. **Vector store**: Ensure `UPSTASH_VECTOR_URL` and `UPSTASH_VECTOR_TOKEN` are set
5. **Syllable mismatch**: JS syllable counts are approximate, database counts are definitive

## Next Steps

After retrieval is working:
1. Integrate with prompt builder (`promptBuilder.js`)
2. Add Claude API generation logic
3. Implement validation for strict settings
4. Add iteration feedback support
