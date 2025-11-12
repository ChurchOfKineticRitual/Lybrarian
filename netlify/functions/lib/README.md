# Netlify Functions Library

Shared utilities for Lybrarian serverless functions.

## Modules

### `retrieval.js` - Fragment Retrieval System

Dual retrieval strategy combining semantic (vector) and prosodic (SQL) search.

#### Functions

##### `retrieveFragments(inputText, prosodyData, settings, db)`

Main entry point for fragment retrieval.

**Parameters:**
- `inputText` (string): User's input verse
- `prosodyData` (object): Analyzed prosody structure
  ```js
  {
    lines: [
      {
        text: "Walking down the city street",
        syllables: 8,
        stress: "10101010",
        rhyme: "IY T" // IPA phonetic
      },
      // ... more lines
    ]
  }
  ```
- `settings` (object): Generation settings
  ```js
  {
    meaning: 'yes' | 'ish' | 'no',
    rhythm: 'yes' | 'ish' | 'no',
    rhyming: 'yes' | 'ish' | 'no',
    religiosity: 'yes' | 'ish' | 'no'
  }
  ```
- `db` (object): Database connection from `db.js`

**Returns:** Array of fragment objects with full data
```js
[
  {
    id: 'frag0001',
    content: 'Walking down the city street\nFinding faces I might meet',
    tags: ['urban', 'walking', 'city'],
    context_note: 'Observation of city life',
    rhythmic: true,
    fragment_type: 'couplet',
    lines: [
      {
        line_number: 1,
        text: 'Walking down the city street',
        syllables: 8,
        stress_pattern: '10101010',
        end_rhyme_us: 'IY T',
        end_rhyme_gb: 'IY T'
      },
      // ... more lines
    ],
    retrievalScore: 0.85 // Combined semantic + prosodic score
  },
  // ... up to 20 fragments
]
```

**Example Usage:**
```js
const { retrieveFragments } = require('./lib/retrieval');
const db = require('./lib/db');

exports.handler = async (event) => {
  const { inputText, prosodyData, settings } = JSON.parse(event.body);

  const fragments = await retrieveFragments(
    inputText,
    prosodyData,
    settings,
    db
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ fragments })
  };
};
```

##### `semanticRetrieval(inputText, topK = 20)`

Vector-based semantic similarity search.

**Parameters:**
- `inputText` (string): Text to search for
- `topK` (number): Number of results (default: 20)

**Returns:** Array of `{id, score}` objects

##### `prosodicRetrieval(prosodyData, db, rhythmSetting)`

SQL-based prosodic matching (syllables, stress patterns).

**Parameters:**
- `prosodyData` (object): Per-line prosody analysis
- `db` (object): Database connection
- `rhythmSetting` (string): 'yes' (exact) | 'ish' (±2 syllables) | 'no' (skip)

**Returns:** Array of fragment IDs

##### `combineAndRank(semanticResults, prosodicResults, settings, db)`

Merges and scores results from both retrieval methods.

**Scoring Algorithm:**
- Base score: Semantic similarity (0-1)
- +0.3 if found in prosodic results
- +0.2 if rhythmic fragment and rhythm='yes'
- Returns top 15-20 ranked by total score

---

### `db.js` - Database Connection

PostgreSQL connection pool manager for Neon serverless.

#### Functions

##### `query(text, params)`

Execute a SQL query.

**Parameters:**
- `text` (string): SQL query with placeholders ($1, $2, ...)
- `params` (array): Parameter values

**Returns:** Promise resolving to query result

**Example:**
```js
const db = require('./lib/db');

const result = await db.query(
  'SELECT * FROM fragments WHERE id = $1',
  ['frag0001']
);

console.log(result.rows);
```

##### `getClient()`

Get a dedicated client for transactions.

**Returns:** Promise resolving to PoolClient

**Example:**
```js
const client = await db.getClient();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO ...');
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

##### `getPool()`

Get the connection pool (for advanced usage).

##### `closePool()`

Close all connections (for cleanup/testing).

---

## Environment Variables Required

### Retrieval System
- `OPENROUTER_API_KEY`: OpenRouter API key for embeddings
- `UPSTASH_VECTOR_URL`: Upstash Vector database URL
- `UPSTASH_VECTOR_TOKEN`: Upstash Vector auth token

### Database
- `DATABASE_URL`: PostgreSQL connection string (Neon)

---

## Dependencies

Install with `npm install` in project root:
```json
{
  "@upstash/vector": "^1.1.1",
  "pg": "^8.11.3",
  "node-fetch": "^2.7.0"
}
```

---

## Error Handling

All retrieval functions implement graceful degradation:
- If semantic retrieval fails → returns empty array, falls back to prosodic only
- If prosodic retrieval fails → returns empty array, uses semantic only
- If both fail → returns empty array, generation proceeds without fragments
- Database errors are logged and propagated

---

## Performance Notes

### Semantic Retrieval
- Embedding generation: ~200-500ms
- Vector search: ~50-200ms
- Total: ~300-700ms

### Prosodic Retrieval
- SQL queries: ~50-150ms per line
- Multi-line input: parallelizable

### Combined
- Total retrieval time: ~400-1000ms
- Cached embeddings could reduce to ~100-300ms (future optimization)

---

## Testing

To test the retrieval system locally:

```js
// test-retrieval.js
const { retrieveFragments } = require('./netlify/functions/lib/retrieval');
const db = require('./netlify/functions/lib/db');

const inputText = "Walking down the city street";
const prosodyData = {
  lines: [
    { syllables: 8, stress: "10101010", rhyme: "IY T" }
  ]
};
const settings = {
  meaning: 'yes',
  rhythm: 'ish',
  rhyming: 'ish',
  religiosity: 'ish'
};

(async () => {
  const fragments = await retrieveFragments(inputText, prosodyData, settings, db);
  console.log(`Retrieved ${fragments.length} fragments`);
  console.log(fragments[0]);
  await db.closePool();
})();
```

Run with:
```bash
node test-retrieval.js
```
