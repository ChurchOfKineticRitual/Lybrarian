# Lybrarian Generation Pipeline Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React PWA)                         │
│                                                                      │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐  │
│  │    Input    │───▶│    Review    │───▶│    Workspace        │  │
│  │   Screen    │    │    Screen    │    │    (Phase 4)        │  │
│  └─────────────┘    └──────────────┘    └─────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ POST /api/generate
                               │ { input, settings, iteration, feedback }
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Netlify Serverless Functions                      │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                      generate.js                            │   │
│  │                   (Main Orchestrator)                       │   │
│  │                                                             │   │
│  │  1. Validate Request                                        │   │
│  │  2. Analyze Prosody ────────────┐                          │   │
│  │  3. Retrieve Fragments ─────────┼────┐                     │   │
│  │  4. Get Style References ───────┼────┼────┐                │   │
│  │  5. Build Prompt ───────────────┼────┼────┼────┐           │   │
│  │  6. Call Claude API             │    │    │    │           │   │
│  │  7. Validate Output             │    │    │    │           │   │
│  │  8. Save to Database            │    │    │    │           │   │
│  │  9. Return Response             │    │    │    │           │   │
│  └─────────────────────────────────┼────┼────┼────┼───────────┘   │
│                                     ▼    ▼    ▼    ▼               │
│  ┌────────────┐  ┌───────────┐  ┌────────────┐  ┌─────────┐     │
│  │ prosody.js │  │retrieval.js│  │promptBuilder│  │  db.js  │     │
│  │            │  │            │  │    .js      │  │         │     │
│  │ • syllables│  │ • semantic │  │ • settings  │  │ • query │     │
│  │ • rhyme    │  │ • prosodic │  │ • fragments │  │ • pool  │     │
│  │ • analyze  │  │ • combine  │  │ • style     │  │ • txn   │     │
│  └────────────┘  └───────────┘  └────────────┘  └─────────┘     │
└────────────┬─────────────┬──────────────┬────────────┬────────────┘
             │             │              │            │
             │             │              │            │
        ┌────▼────┐  ┌─────▼─────┐  ┌────▼────┐  ┌───▼────┐
        │ syllable│  │  Upstash  │  │OpenRouter│ │  Neon  │
        │   npm   │  │  Vector   │  │  (API)  │  │   DB   │
        │ package │  │  (Search) │  │         │  │(Postgres)│
        └─────────┘  └─────┬─────┘  └────┬────┘  └────────┘
                           │              │
                      ┌────▼────┐    ┌────▼────┐
                      │ OpenAI  │    │ Claude  │
                      │Embedding│    │Sonnet 4.5│
                      └─────────┘    └─────────┘
```

## Request Flow (Step-by-Step)

### 1. User Input → Validation

```
User types verse in frontend:
  "Walking through the city at night
   Streetlights guide my way"

Frontend sends POST /api/generate:
  {
    "input": "Walking...",
    "settings": {
      "religiosity": "ish",
      "rhythm": "yes",
      "rhyming": "ish",
      "meaning": "yes"
    }
  }

generate.js validates:
  ✓ input is non-empty string
  ✓ settings are provided
  ✓ values are "no"/"ish"/"yes"
```

### 2. Prosody Analysis

```
If rhythm ≠ "no":
  prosody.analyzeVerse(input)

Returns:
  [
    { text: "Walking through...", syllables: 8, rhymeSound: "ght" },
    { text: "Streetlights guide...", syllables: 6, rhymeSound: "ay" }
  ]

Used for:
  - Fragment retrieval (find matching syllable counts)
  - Output validation (verify generated verses match)
```

### 3. Fragment Retrieval (Parallel)

```
┌─────────────────────┐        ┌──────────────────────┐
│  Semantic Retrieval │        │  Prosodic Retrieval  │
│                     │        │                      │
│ 1. Generate embedding│       │ 1. Query SQL for     │
│    (OpenAI API)     │        │    syllable matches  │
│                     │        │                      │
│ 2. Query Upstash    │        │ 2. Filter by rhythm  │
│    Vector store     │        │    setting (±2 syl)  │
│                     │        │                      │
│ 3. Return top 20    │        │ 3. Return fragment   │
│    by similarity    │        │    IDs               │
└──────────┬──────────┘        └──────────┬───────────┘
           │                              │
           └──────────┬───────────────────┘
                      ▼
              ┌───────────────┐
              │ Combine & Rank│
              │               │
              │ • Merge lists │
              │ • Bonus scores│
              │ • Top 15-20   │
              └───────┬───────┘
                      ▼
              Fetch full fragment data
              (content, tags, prosody)
```

### 4. Style References

```
SQL Query:
  SELECT * FROM completed_lyrics
  WHERE use_for_style = true
  ORDER BY created_at DESC
  LIMIT 3

Returns:
  [
    {
      title: "Previous Song 1",
      content: "Full lyrics..."
    },
    ...
  ]

Used to:
  - Match user's writing style
  - Maintain consistent voice
  - Reference completed work
```

### 5. Prompt Building

```
promptBuilder.buildGenerationPrompt(
  input,
  settings,
  fragments (15-20),
  styleRefs (2-3),
  iteration,
  feedback
)

Generates:
  ┌─────────────────────────────────┐
  │      System Prompt              │
  │  "You are an expert lyric       │
  │   writing assistant..."         │
  │  [Instructions]                 │
  └─────────────────────────────────┘

  ┌─────────────────────────────────┐
  │       User Prompt               │
  │                                 │
  │  INPUT VERSE:                   │
  │  [User's verse]                 │
  │                                 │
  │  CONSTRAINTS:                   │
  │  - Religiosity: ish             │
  │  - Rhythm: yes (exact syllables)│
  │  - Rhyming: ish (slant ok)      │
  │  - Meaning: yes (stay close)    │
  │                                 │
  │  FRAGMENT LIBRARY (18 frags):   │
  │  Fragment 1 [urban, night]:     │
  │  "City lights and lonely..."    │
  │  (8 syllables)                  │
  │  ...                            │
  │                                 │
  │  STYLE REFERENCES (2 songs):    │
  │  Song 1: "Previous Work"        │
  │  ---                            │
  │  [Full lyrics]                  │
  │  ---                            │
  │                                 │
  │  [ITERATION FEEDBACK if iter>1] │
  │                                 │
  │  Generate 10 variations.        │
  └─────────────────────────────────┘
```

### 6. Claude API Call

```
POST https://openrouter.ai/api/v1/chat/completions
Headers:
  Authorization: Bearer $OPENROUTER_API_KEY
  Content-Type: application/json

Body:
  {
    "model": "anthropic/claude-sonnet-4.5",
    "messages": [
      { "role": "system", "content": systemPrompt },
      { "role": "user", "content": userPrompt }
    ],
    "temperature": 0.7,
    "max_tokens": 4000
  }

Response (3-6 seconds):
  {
    "choices": [{
      "message": {
        "content": "[{verse: '...', fragmentsUsed: [1,3], ...}, ...]"
      }
    }]
  }

Parse JSON array of 10 verses
```

### 7. Validation (if strict)

```
If rhythm="yes" OR rhyming="yes":

  For each verse:
    1. Analyze prosody (syllables, rhyme)
    2. Compare to input prosody
    3. Check matches:
       - Syllables per line (if rhythm="yes")
       - Rhyme sound (if rhyming="yes")

  If failed:
    - Regenerate verse (max 2 attempts)
    - If still fails, accept with warning

Logs:
  "Verse 3 failed validation: Line 2 has 9 syllables, expected 8"
  "Regenerating verse 3, attempt 1/2"
  "Verse 3 regenerated successfully"
```

### 8. Database Save (Transaction)

```
BEGIN TRANSACTION;

1. Get or create project:
   INSERT INTO projects (id, name, user_id, ...)
   VALUES ('proj-123', 'Untitled Project', 'user-jc', ...)
   ON CONFLICT DO NOTHING;

2. Create session:
   INSERT INTO generation_sessions (
     id, project_id, input_verse,
     setting_religiosity, setting_rhythm, ...
   ) VALUES (
     'sess-abc123', 'proj-123', 'Walking through...',
     'ish', 'yes', ...
   );

3. Insert 10 verses:
   INSERT INTO generated_verses (
     session_id, iteration_number, verse_content, rating
   ) VALUES
     ('sess-abc123', 1, 'Dancing through...', 'fine'),
     ('sess-abc123', 1, 'Wandering past...', 'fine'),
     ...;

COMMIT;
```

### 9. Response

```
Return to frontend:
{
  "success": true,
  "sessionId": "sess-abc123",
  "projectId": "proj-123",
  "verses": [
    {
      "verse": "Dancing through the district by moonlight\nNeon signs illuminate my trail",
      "fragmentsUsed": [1, 3, 7],
      "explanation": "Urban imagery with similar rhythm",
      "rating": null
    },
    ... 9 more ...
  ],
  "metadata": {
    "generationTime": "4200ms",
    "fragmentCount": 18,
    "styleRefCount": 2,
    "iteration": 1
  },
  "debug": {
    "inputProsody": [...],
    "retrievedFragments": [...]
  }
}

Frontend displays 10 verses with rating buttons
```

## Data Flow Diagram

```
┌──────────┐
│  INPUT   │
│  VERSE   │
└────┬─────┘
     │
     ├──────────────────────────────────────────────────┐
     │                                                   │
     ▼                                                   ▼
┌─────────────┐                                   ┌──────────┐
│  PROSODY    │                                   │ SETTINGS │
│  ANALYSIS   │                                   │ (4 knobs)│
│             │                                   └────┬─────┘
│ • Syllables │                                        │
│ • Rhyme     │                                        │
└─────┬───────┘                                        │
      │                                                │
      ├────────────────────────┐                       │
      │                        │                       │
      ▼                        ▼                       │
┌─────────────┐          ┌──────────────┐            │
│  SEMANTIC   │          │  PROSODIC    │            │
│  RETRIEVAL  │          │  RETRIEVAL   │            │
│             │          │              │            │
│ • Vector DB │          │ • SQL match  │            │
│ • Top 20    │          │ • Syllables  │            │
└─────┬───────┘          └──────┬───────┘            │
      │                         │                     │
      └──────────┬──────────────┘                     │
                 ▼                                    │
          ┌─────────────┐                            │
          │  COMBINE &  │                            │
          │    RANK     │                            │
          │             │                            │
          │ • Score     │                            │
          │ • Top 15-20 │                            │
          └──────┬──────┘                            │
                 │                                    │
                 ├────────────────────────────────────┤
                 │                                    │
                 ▼                                    ▼
          ┌─────────────┐                      ┌──────────┐
          │  FRAGMENTS  │                      │  STYLE   │
          │   (15-20)   │                      │   REFS   │
          │             │                      │  (2-3)   │
          │ • Content   │                      │          │
          │ • Tags      │                      │ • Songs  │
          │ • Prosody   │                      │ • Lyrics │
          └──────┬──────┘                      └────┬─────┘
                 │                                  │
                 └──────────┬───────────────────────┘
                            ▼
                     ┌─────────────┐
                     │   PROMPT    │
                     │   BUILDER   │
                     │             │
                     │ • System    │
                     │ • User      │
                     │ • Context   │
                     └──────┬──────┘
                            ▼
                     ┌─────────────┐
                     │   CLAUDE    │
                     │  SONNET 4.5 │
                     │             │
                     │ via         │
                     │ OpenRouter  │
                     └──────┬──────┘
                            ▼
                     ┌─────────────┐
                     │  10 VERSES  │
                     │   (JSON)    │
                     └──────┬──────┘
                            │
                            ├─────────────┐
                            ▼             ▼
                     ┌─────────────┐  ┌──────────┐
                     │  VALIDATE   │  │   SAVE   │
                     │  (if strict)│  │    TO    │
                     │             │  │ DATABASE │
                     │ • Syllables │  └────┬─────┘
                     │ • Rhyme     │       │
                     └──────┬──────┘       │
                            │              │
                            └──────┬───────┘
                                   ▼
                            ┌─────────────┐
                            │  RESPONSE   │
                            │             │
                            │ • Verses    │
                            │ • Metadata  │
                            │ • Debug     │
                            └─────────────┘
```

## Module Dependencies

```
generate.js
    ├── lib/prosody.js
    │       └── syllable (npm package)
    │
    ├── lib/retrieval.js
    │       ├── @upstash/vector
    │       ├── node-fetch (OpenAI embeddings)
    │       └── lib/db.js
    │
    ├── lib/promptBuilder.js
    │       └── (no external deps)
    │
    ├── lib/db.js
    │       └── pg (PostgreSQL client)
    │
    └── node-fetch (Claude API)
```

## Error Handling Flow

```
                    ┌─────────────┐
                    │   Request   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Validate   │───✗───▶ 400 Bad Request
                    └──────┬──────┘
                           │ ✓
                           ▼
                    ┌─────────────┐
                    │   Prosody   │───✗───▶ Log warning
                    │   Analysis  │        Continue with empty
                    └──────┬──────┘
                           │ ✓
                           ▼
                    ┌─────────────┐
                    │  Retrieval  │───✗───▶ Log error
                    │             │        Continue with []
                    └──────┬──────┘
                           │ ✓
                           ▼
                    ┌─────────────┐
                    │   Prompt    │───✗───▶ 500 Internal Error
                    │   Builder   │
                    └──────┬──────┘
                           │ ✓
                           ▼
                    ┌─────────────┐
                    │ Claude API  │───✗───▶ 500 API Error
                    │             │        Retry once
                    └──────┬──────┘
                           │ ✓
                           ▼
                    ┌─────────────┐
                    │ Validation  │───✗───▶ Regenerate
                    │             │        (max 2 attempts)
                    └──────┬──────┘
                           │ ✓
                           ▼
                    ┌─────────────┐
                    │   Database  │───✗───▶ 500 DB Error
                    │    Save     │        Rollback txn
                    └──────┬──────┘
                           │ ✓
                           ▼
                    ┌─────────────┐
                    │   Success   │
                    │   Response  │
                    └─────────────┘
```

## Performance Timeline

```
Time (ms)     Event
───────────────────────────────────────────────────
    0         Request received
   50         Validation complete
  150         Prosody analysis complete

  150         ├─ Semantic retrieval starts
              └─ Prosodic retrieval starts

  800         ├─ Semantic retrieval complete (650ms)
              └─ Prosodic retrieval complete (650ms)

  900         Fragments combined & ranked
 1100         Style references fetched (200ms)
 1150         Prompt built (50ms)

 1150         Claude API call starts
 5000         Claude API response received (3850ms)

 5100         Validation complete (100ms)
 5200         Database save complete (100ms)

 5200         Response sent
───────────────────────────────────────────────────
Total: ~5.2 seconds
```

## Scaling Considerations

### Current Setup (MVP)
- Single region (US)
- Netlify serverless (auto-scales)
- Neon database (serverless Postgres)
- Upstash Vector (serverless)
- Connection pooling (max 10)

### Future Optimizations
1. **Caching**
   - Cache fragments for same input+settings
   - Cache embeddings for common phrases
   - Redis for session data

2. **Streaming**
   - Stream verses as generated
   - WebSocket connection
   - Incremental display

3. **Batch Processing**
   - Generate multiple iterations in parallel
   - Queue system for high load

4. **CDN**
   - Edge caching for static content
   - Geographic distribution

5. **Database**
   - Read replicas
   - Indexed queries
   - Materialized views

## Security Architecture

```
┌─────────────────────────────────────────┐
│           Request Validation             │
│  • Input sanitization                    │
│  • Type checking                         │
│  • Length limits                         │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│        Parameterized Queries             │
│  • SQL injection prevention              │
│  • Prepared statements                   │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│      Environment Variables               │
│  • API keys never in code                │
│  • Secrets in Netlify dashboard          │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│         Error Sanitization               │
│  • No stack traces in prod               │
│  • Generic error messages                │
│  • Detailed logs server-side             │
└─────────────────────────────────────────┘
```

---

**Last Updated:** November 12, 2025
**Architecture Version:** 1.0
**Phase:** 2 (Core Generation)
