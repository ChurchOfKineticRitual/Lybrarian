# Lyric Writing Assistant - Quick Start Guide for Development

## Project Overview

**What:** A mobile-first Progressive Web App (PWA) that helps songwriters generate new verses using AI, drawing from a personal corpus of lyric fragments with semantic matching and prosodic analysis.

**Platform:** React PWA deployed to Netlify with serverless backend
**Primary Use:** Mobile phone (responsive across all devices)
**User:** Solo songwriter (Jordan) with ~65 initial fragments, expanding over time

---

## Core Concept

1. **User has fragments** → stored as markdown in Obsidian vault (GitHub repo)
2. **User writes input verse** → e.g., "Walking through the midnight rain"
3. **System generates 10 variations** → using retrieved fragments + Claude AI
4. **User rates verses** → Best / Fine / Not the vibe
5. **User iterates** → generates 10 more with feedback incorporated
6. **User keeps best verses** → copies to workspace for editing/combining
7. **User exports** → saves as completed song

---

## Document Structure

You have 4 key documents:

### 1. **lyric-assistant-prd-final.md** (THIS IS YOUR BIBLE)
- Complete product requirements
- Mobile-first architecture
- All UI specifications
- API specifications
- Database schema overview
- Development roadmap (Phases 1-6)

### 2. **fragment-processing-spec.md**
- How to import the initial 65 fragments from CSV
- Prosodic analysis pipeline (syllables, stress, rhyme)
- Tag generation process
- Embedding creation
- Complete Python processing script

### 3. **database-schema.sql**
- Complete Postgres schema
- All tables, indexes, views
- Helper functions
- Sample queries

### 4. **fragment-corpus-cleaned.csv** (THE DATA)
- 65 initial lyric fragments
- Columns: ID, Fragment, Attribution, Rhythmic (Y/N), Context
- Ready to import

---

## Tech Stack Summary

### Frontend
- **React** (Create React App or Vite)
- **Tailwind CSS** (mobile-first styling)
- **ProseMirror** (text editing - post-MVP)
- **PWA** (service worker, manifest)

### Backend (Netlify Functions)
- **Node.js** or **Python** serverless functions
- **API Routes:**
  - `/api/generate` - Main generation endpoint
  - `/api/add-keeper` - Save verse to workspace
  - `/api/update-rating` - Update verse rating
  - `/api/fragments` - Query fragments
  - `/api/projects` - Project CRUD
  - `/api/export-song` - Export completed lyric

### Data Layer
- **Neon** (serverless Postgres) - metadata, sessions, prosody
- **Upstash Vector** (serverless) - semantic embeddings
- **GitHub Repo** - Obsidian vault (markdown files)

### External APIs
- **Anthropic Claude API** (Sonnet 4.5) - verse generation
- **OpenAI Embeddings API** (text-embedding-3-small) - semantic search

### Prosody Analysis (Python)
- **CMUdict** (NLTK) - stress patterns
- **syllables** or **pyphen** - syllable counting
- **pronouncing** - rhyme matching

---

## Phase 1: Foundation (Your First Task)

**Goal:** Get fragments imported and queryable

### Step 1: Set Up Infrastructure

1. **Create Netlify project**
   ```bash
   netlify init
   ```

2. **Set up Neon database**
   - Create account at neon.tech
   - Create new database
   - Run `database-schema.sql`
   - Save connection string to Netlify env vars

3. **Set up Upstash Vector**
   - Create account at upstash.com
   - Create new vector index (dimensions: 1536 for OpenAI embeddings)
   - Save URL and token to Netlify env vars

4. **Set up GitHub repo for vault**
   - Create new repo: `lyrics-vault`
   - Structure:
     ```
     lyrics-vault/
     ├── fragments/
     ├── completed-lyrics/
     ├── projects/
     └── _metadata/
     ```

5. **Configure environment variables in Netlify**
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   OPENAI_API_KEY=sk-...
   DATABASE_URL=postgresql://...
   UPSTASH_VECTOR_URL=https://...
   UPSTASH_VECTOR_TOKEN=...
   GITHUB_TOKEN=ghp_...
   GITHUB_REPO=username/lyrics-vault
   ```

### Step 2: Fragment Import

1. **Create import script** (Python recommended)
   - Follow `fragment-processing-spec.md` exactly
   - Key steps:
     - Parse CSV
     - Generate tags (LLM call)
     - Analyze prosody (only if Rhythmic=Y)
     - Create embeddings
     - Save to database
     - Save to vector store
     - Create markdown files

2. **Run import**
   ```bash
   python scripts/import_fragments.py fragment-corpus-cleaned.csv
   ```

3. **Verify import**
   - Check database: 65 rows in `fragments` table
   - Check vector store: 65 embeddings
   - Check GitHub repo: 65 markdown files in `fragments/`

**Success Criteria:**
- [ ] All 65 fragments in database
- [ ] Rhythmic fragments have prosody data in `fragment_lines` table
- [ ] All fragments have embeddings in vector store
- [ ] Markdown files created in GitHub repo

---

## Phase 2: Core Generation (Your Second Task)

**Goal:** Build input UI and generation API

### Step 1: Frontend - Input Screen

Create React component with:
- Multi-line text input for verse
- Four 3-way toggles (Religiosity, Rhythm, Rhyming, Meaning)
  - Use segmented button controls, NOT sliders
  - Defaults: Ish, Yes, Ish, Yes
- Theme dropdown (14 options, default: "Let me tell you a story")
- Steer text input (optional)
- Generate button

**Mobile-first:**
- Touch-friendly (44px minimum tap targets)
- Bottom navigation
- Thumb-friendly button placement

### Step 2: Backend - Generation Function

Create `/api/generate` Netlify Function:

```javascript
// Pseudocode structure
export async function handler(event) {
  const { input, settings, sessionId, iteration } = JSON.parse(event.body);
  
  // 1. Analyze input prosody
  const inputProsody = await analyzeProsody(input.verse);
  
  // 2. Retrieve fragments
  const semanticResults = await vectorSearch(input.verse);
  const prosodicResults = await queryFragmentsByProsody(inputProsody, settings.rhythm);
  const fragments = combineAndRank(semanticResults, prosodicResults);
  
  // 3. Get previous ratings (if iteration > 1)
  const previousRatings = await getPreviousRatings(sessionId);
  
  // 4. Construct prompt
  const prompt = buildPrompt({
    input: input.verse,
    settings,
    fragments: fragments.slice(0, 20),
    styleReference: await getStyleLyrics(),
    previousRatings: filterForFeedback(previousRatings)  // Best + Not the vibe only
  });
  
  // 5. Call Claude API
  const verses = await generateVerses(prompt, 10);
  
  // 6. Validate (if settings.rhythm === 'yes' or settings.rhyming === 'yes')
  const validated = await validateVerses(verses, inputProsody, settings);
  
  // 7. Save to database
  await saveSession(sessionId, input, settings, verses);
  
  return {
    statusCode: 200,
    body: JSON.stringify({ verses })
  };
}
```

**Key Implementation Notes:**

1. **Prompt Construction** (CRITICAL)
   - Use setting-specific language from PRD section "Setting-Specific Prompt Language"
   - Include retrieved fragments
   - Include 2-3 completed lyrics for style
   - For iteration 2+: include 2-3 "Best" and 2-3 "Not the vibe" examples

2. **Retrieval Strategy**
   - Semantic: Vector search on input verse (if Meaning ≠ No)
   - Prosodic: SQL query on `fragment_lines` for syllable match
   - Combine results with scoring algorithm
   - Return top 15-20 fragments

3. **Validation**
   - If Rhythm: Yes → check syllable count matches exactly
   - If Rhyming: Yes → check phonetic rhyme match
   - If validation fails: regenerate (max 2 attempts per verse)

### Step 3: Frontend - Review Screen

Create React component with:
- Display 10 verses (one at a time or list)
- Swipe navigation (left/right)
- Three rating buttons: Best / Fine / Not the vibe
- "Add to Keepers" button
- "Iterate" button at bottom

**Mobile UX:**
- Swipe gestures between verses
- Large tap targets for ratings
- Visual feedback on rating selection
- Pagination dots (1-10)

**Success Criteria:**
- [ ] User can input verse and settings
- [ ] Generate button calls API
- [ ] 10 verses display
- [ ] User can rate verses
- [ ] User can iterate (generates 10 more with feedback)

---

## Phase 3: Workspace & Export

### Workspace Screen

- Display all keeper verses as cards
- Tap to edit inline
- Drag to reorder
- Delete button
- "Export as Song" button

### Export Function

Create `/api/export-song`:
- Takes workspace content + title
- Creates markdown file in `completed-lyrics/`
- Commits to GitHub repo
- Saves to database with `use_for_style: true`

---

## Key Algorithms

### 1. Prosodic Analysis

```python
import syllables
from nltk.corpus import cmudict
import pronouncing

def analyze_line(text):
    """Analyze one line of text."""
    return {
        'syllables': count_syllables(text),
        'stress': get_stress_pattern(text),  # "10101010"
        'end_rhyme': get_rhyme_sound(text)    # IPA phonetic
    }
```

See `fragment-processing-spec.md` for complete implementation.

### 2. Fragment Retrieval

```python
def retrieve_fragments(input_verse, settings):
    """Multi-stage retrieval."""
    
    # Semantic retrieval
    if settings['meaning'] != 'no':
        semantic_matches = vector_search(input_verse, top_k=50)
    else:
        semantic_matches = []
    
    # Prosodic retrieval (for rhythmic fragments only)
    prosody = analyze_prosody(input_verse)
    
    if settings['rhythm'] == 'yes':
        syllable_matches = query_db(
            "SELECT * FROM fragment_lines WHERE syllables = ?",
            prosody['syllables']
        )
    elif settings['rhythm'] == 'ish':
        syllable_matches = query_db(
            "SELECT * FROM fragment_lines WHERE syllables BETWEEN ? AND ?",
            prosody['syllables'] - 2,
            prosody['syllables'] + 2
        )
    else:
        syllable_matches = []
    
    # Combine and rank
    combined = merge_results(semantic_matches, syllable_matches)
    return combined[:20]  # Top 20
```

### 3. Prompt Construction for Iteration 2+

```python
def build_iteration_prompt(input, settings, fragments, previous_verses):
    """Build prompt with feedback."""
    
    # Filter ratings
    best = [v for v in previous_verses if v['rating'] == 'best'][:3]
    worst = [v for v in previous_verses if v['rating'] == 'not_the_vibe'][:3]
    
    prompt = f"""
Generate 10 verse variations matching these requirements:

INPUT: {input}

REQUIREMENTS:
- Religiosity: {settings['religiosity']} → {RELIGIOSITY_PROMPTS[settings['religiosity']]}
- Rhythm: {settings['rhythm']} → {RHYTHM_PROMPTS[settings['rhythm']]}
- Rhyming: {settings['rhyming']} → {RHYMING_PROMPTS[settings['rhyming']]}
- Meaning: {settings['meaning']} → {MEANING_PROMPTS[settings['meaning']]}

FRAGMENTS FOR INSPIRATION:
{format_fragments(fragments)}

LEARN FROM PREVIOUS FEEDBACK:

User marked these as "Best" ✓:
{format_verses(best)}

User marked these as "Not the vibe" ✗:
{format_verses(worst)}

Briefly reflect: What made the "Best" ones work? What felt off about the others?

Now generate 10 NEW variations incorporating this feedback.
"""
    
    return prompt
```

---

## Mobile UI Patterns

### Bottom Navigation
```
┌──────┬──────┬──────┬──────┐
│ Home │Review│Keeper│ More │
└──────┴──────┴──────┴──────┘
```

### Segmented Control (Toggle)
```
Religiosity
┌─────┬─────┬─────┐
│ No  │ Ish │ Yes │
└─────┴─────┴─────┘
       ^selected
```

### Verse Card
```
┌─────────────────────────┐
│ Walking through the     │
│ midnight rain           │
│ Streetlights flicker,   │
│ go insane               │
│                         │
│ [Best] [Fine] [Not vibe]│
│    [Add to Keepers]     │
└─────────────────────────┘
```

---

## Testing Strategy

### Unit Tests
- Prosodic analysis functions
- Fragment retrieval algorithms
- Tag generation

### Integration Tests
- Fragment import end-to-end
- Generation API with mock LLM
- Database operations

### User Testing
- Generation quality (manual review)
- Mobile UX on real devices
- Complete workflow: input → generate → iterate → keeper → export

---

## Common Pitfalls to Avoid

1. **Don't over-complicate prosody** - Start with syllable counting and basic stress patterns. Perfect accuracy not required.

2. **Don't neglect mobile UX** - Test on actual phones, not just browser devtools.

3. **Don't expose API keys** - Use Netlify environment variables, never commit to repo.

4. **Don't forget rate limiting** - Add delays between LLM calls to avoid hitting limits.

5. **Don't ignore "Fine" ratings** - They provide no signal. Only use "Best" and "Not the vibe" for iteration.

6. **Don't validate too strictly** - For "Ish" settings, allow flexibility. Only enforce hard constraints for "Yes" settings.

7. **Don't forget to sync vault** - Markdown files should commit to GitHub after changes.

---

## Development Workflow

### Day-to-Day
1. Pull latest from GitHub (vault sync)
2. Work on local branch
3. Test with real LLM calls (small test set)
4. Deploy to Netlify preview
5. Test on phone
6. Merge to main → auto-deploy

### Fragment Management
- Add fragments via Obsidian (desktop)
- Sync to GitHub
- Netlify function picks up changes
- Re-analyze prosody if needed
- Update embeddings incrementally

---

## Deployment Checklist

See PRD "Deployment Checklist" section for complete pre-launch steps.

**Quick version:**
- [ ] Environment variables set
- [ ] Database schema deployed
- [ ] Vector store configured
- [ ] Fragments imported (all 65)
- [ ] PWA manifest and service worker
- [ ] Domain and SSL
- [ ] Rate limiting enabled
- [ ] Error monitoring (Sentry)

---

## Success Metrics to Track

- Keeper rate (% of verses marked as keeper)
- Iteration efficiency (avg iterations to find 3+ keepers)
- Time to first keeper (how long until user finds something useful)
- Mobile performance (Lighthouse score)
- API latency (p95 < 8 seconds for generation)

---

## Resources

### Documentation
- PRD: `lyric-assistant-prd-final.md`
- Fragment processing: `fragment-processing-spec.md`
- Database schema: `database-schema.sql`

### APIs
- Anthropic Claude: https://docs.anthropic.com
- OpenAI Embeddings: https://platform.openai.com/docs/guides/embeddings
- Netlify Functions: https://docs.netlify.com/functions/overview/
- Neon: https://neon.tech/docs
- Upstash Vector: https://upstash.com/docs/vector

### Libraries
- CMUdict: https://www.nltk.org/howto/corpus.html#cmu-pronouncing-dictionary
- Pronouncing: https://pronouncing.readthedocs.io/
- Syllables: https://pypi.org/project/syllables/

---

## Getting Help

If you encounter issues:

1. **Check the PRD** - Most questions answered there
2. **Review processing spec** - For fragment import issues
3. **Check database schema** - For query issues
4. **Test with small dataset** - Use 5 fragments first, then scale to 65
5. **Validate embeddings** - Ensure vector store returns similar fragments for test query

---

## Next Steps

**Start here:**
1. Read PRD completely (30 min)
2. Set up Netlify project (15 min)
3. Create database and run schema (10 min)
4. Set up vector store (10 min)
5. Build fragment import script (2-3 hours)
6. Import 65 fragments (5 min run time)
7. Verify import successful (10 min)

**Then move to:**
- Phase 2: Generation core
- Phase 3: Iteration & feedback
- Phase 4: Workspace
- Phase 5: PWA polish

---

**Good luck! The PRD is comprehensive - trust it, follow it, and you'll build something excellent.**

**Version:** 1.0  
**Last Updated:** November 10, 2025
