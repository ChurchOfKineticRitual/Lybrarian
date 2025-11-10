# Lyric Writing Assistant - Product Requirements Document
## Final Specification for Development

**Version:** 2.0 Final  
**Date:** November 10, 2025  
**Platform:** Mobile-first Progressive Web App (PWA)  
**Deployment:** Netlify with serverless backend

---

## Executive Summary

A mobile-first generative writing tool that helps songwriters create new verses by drawing from a personal corpus of lyric fragments. The system uses semantic matching, prosodic analysis, and iterative user feedback to generate contextually appropriate variations that match the writer's style and requirements.

### Core Value Proposition

Writers provide input text (semantic, rhythmic, or both) on their phone and receive 10 AI-generated verse variations that:
- Match specified rhythmic and rhyme structures
- Draw inspiration from their fragment library with configurable adherence
- Emulate their established songwriting style
- Improve iteratively based on three-way preference feedback
- Can be edited and combined in a mobile-optimized workspace

---

## Platform Architecture

### Deployment Model: Progressive Web App (PWA)

**Why PWA:**
- Mobile-first by design (primary use case: phone)
- Works across all devices (phone, tablet, desktop) from single codebase
- Installable to home screen (feels like native app)
- No app store approval required
- Can still edit vault in Obsidian on desktop

### Infrastructure Stack

```
┌─────────────────────────────────────────┐
│  Client (Mobile Browser/PWA)            │
│  - React + Tailwind                     │
│  - Mobile-optimized UI                  │
│  - ProseMirror (text editing)           │
└─────────────────┬───────────────────────┘
                  │
         ┌────────▼────────┐
         │  Netlify CDN    │
         └────────┬────────┘
                  │
    ┌─────────────┴─────────────┐
    │                           │
┌───▼──────────────┐  ┌────────▼────────┐
│ Netlify Functions│  │  GitHub Repo    │
│  (Serverless)    │  │ (Obsidian Vault)│
│                  │  │                 │
│ - Generation API │  │ - Fragments     │
│ - Retrieval API  │  │ - Completed     │
│ - Analysis API   │  │ - Projects      │
│ - Workspace API  │  └─────────────────┘
└───┬──────────────┘
    │
    ├─────────────────┬──────────────────┐
    │                 │                  │
┌───▼─────┐  ┌───────▼──────┐  ┌───────▼────────┐
│ Neon DB │  │ Upstash Vector│ │ Anthropic API  │
│(Postgres)│  │   (Vectors)   │ │ (Claude LLM)   │
└──────────┘  └───────────────┘ └────────────────┘
```

**Key Components:**

1. **Frontend**: React PWA with mobile-first responsive design
2. **Backend**: Netlify Functions (serverless API)
3. **Storage**: 
   - Neon (serverless Postgres) for metadata, sessions, prosody
   - Upstash Vector for semantic embeddings
   - GitHub repo for markdown vault (editable in Obsidian)
4. **LLM**: Anthropic Claude API (Sonnet 4.5)
5. **Embeddings**: OpenAI text-embedding-3-small

---

## Data Architecture

### Source of Truth: Obsidian Vault (GitHub Repo)

The fragment library and all lyric content lives as markdown files in a GitHub repository that syncs with Obsidian.

```
lyrics-vault/
├── fragments/              # Lyric fragments (source material)
│   ├── frag0001.md
│   ├── frag0002.md
│   └── ...
├── completed-lyrics/       # Finished songs (style reference)
│   ├── song-title-1.md
│   └── ...
├── projects/              # Writing session workspaces
│   ├── project-cityscape.md
│   ├── project-morning-after.md
│   └── ...
└── _metadata/
    └── corpus-index.json
```

### Fragment File Format

Each fragment is a markdown file with YAML frontmatter:

```yaml
---
id: frag0001
created: 2025-11-08T14:30:00Z
source: JC  # default; or "Alan Watts", "Joseph Campbell", etc.
rhythmic: true  # Y/N from CSV

# Per-line prosody (only if rhythmic: true)
lines: 2
prosody:
  - line: 1
    text: "An agent of biology,"
    syllables: 9
    stress: "010101010"
    end_rhyme: "ɒlədʒi"
  - line: 2
    text: "Acknowledging this honestly."
    syllables: 10
    stress: "01010101010"
    end_rhyme: "ɒnɪstli"

fragment_type: couplet  # or: verse, stanza, single-line, etc.

# Tags: combination of manual context and auto-generated
tags: [biology, honesty, abstract, philosophical]
# These tags are treated equally - user can delete any, add new ones
# Tags inform embedding creation and retrieval

context_note: ""  # From "Context" column if provided
# Used for embedding enrichment when present
---

An agent of biology,
Acknowledging this honestly.
```

**For Non-Rhythmic Fragments:**
```yaml
---
id: frag0005
created: 2025-11-08T14:30:00Z
source: JC
rhythmic: false  # No prosodic analysis

# No prosody fields for rhythmic: false
tags: [medical, unconscious, anxiety, anaesthetic, counting]
context_note: "the experience of General Anaesthetic"
---

Count back from a hundred in sevens
```

### Tag System Specification

**Tags are unified** - no distinction between "manual" and "generated":

1. **During initial import:**
   - If "Context" column has content → parse into initial tags
   - Run LLM analysis on fragment text + context → generate additional tags
   - Store all tags in single `tags` array

2. **In the UI:**
   - All tags displayed equally with × delete button
   - User can click × to remove any tag
   - User can add new tags via input field
   - Tags are freeform strings

3. **For embeddings:**
   - If `context_note` is present: `embedding_text = f"{fragment_text}\n\nContext: {context_note}"`
   - If `context_note` is blank: `embedding_text = fragment_text`
   - Tags supplement semantic understanding during retrieval (filter/weight by tag match)

### Completed Lyrics Format

```yaml
---
id: song-001
title: "Midnight Rain"
created: 2025-11-08T20:15:00Z
tags: [urban, rain, longing, completed]
use_for_style: true  # Include in style reference corpus
source_project: proj-cityscape-20251108  # Optional link to project
---

[Verse 1]
Walking through the midnight rain
Streetlights flicker, go insane
...

[Chorus]
...
```

### Project Workspace Format

```yaml
---
id: proj-cityscape-20251108
name: "Cityscape"
created: 2025-11-08T18:00:00Z
last_modified: 2025-11-08T22:30:00Z
session_ids: [sess-001, sess-002]  # Links to generation sessions
---

## Keeper Verses

Walking through the midnight rain
Streetlights flicker, go insane

Dancing shadows on empty streets
Every memory feels incomplete

[User can edit, rearrange, combine these freely]
```

---

## Runtime Database Schema (Postgres)

### Table: fragments
```sql
CREATE TABLE fragments (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP,
  source TEXT DEFAULT 'JC',
  rhythmic BOOLEAN,
  fragment_type TEXT,  -- 'couplet', 'verse', 'single-line', etc.
  content TEXT,  -- Full markdown content
  tags TEXT[],  -- Array of tag strings
  context_note TEXT,
  embedding_id TEXT,  -- Reference to vector store
  
  -- Vault sync
  file_path TEXT,  -- Path in GitHub repo
  last_synced TIMESTAMP
);

-- For rhythmic fragments only
CREATE TABLE fragment_lines (
  id SERIAL PRIMARY KEY,
  fragment_id TEXT REFERENCES fragments(id),
  line_number INTEGER,
  text TEXT,
  syllables INTEGER,
  stress_pattern TEXT,  -- Binary string like "10101010"
  end_rhyme_sound TEXT,  -- IPA phonetic
  meter TEXT  -- Optional: "iambic", "trochaic", etc.
);

CREATE INDEX idx_fragments_rhythmic ON fragments(rhythmic);
CREATE INDEX idx_fragments_tags ON fragments USING GIN(tags);
CREATE INDEX idx_fragment_lines_syllables ON fragment_lines(syllables);
```

### Table: completed_lyrics
```sql
CREATE TABLE completed_lyrics (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at TIMESTAMP,
  content TEXT,
  tags TEXT[],
  use_for_style BOOLEAN DEFAULT false,
  source_project TEXT,
  file_path TEXT,
  last_synced TIMESTAMP
);
```

### Table: projects
```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT,
  created_at TIMESTAMP,
  last_modified TIMESTAMP,
  workspace_content TEXT,  -- Current keeper verses
  file_path TEXT,
  last_synced TIMESTAMP
);
```

### Table: generation_sessions
```sql
CREATE TABLE generation_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  created_at TIMESTAMP,
  input_verse TEXT,
  
  -- Settings
  setting_religiosity TEXT,  -- 'no', 'ish', 'yes'
  setting_rhythm TEXT,
  setting_rhyming TEXT,
  setting_meaning TEXT,
  theme_selection TEXT,
  steer_text TEXT,
  
  -- Session metadata
  iteration_count INTEGER DEFAULT 1
);
```

### Table: generated_verses
```sql
CREATE TABLE generated_verses (
  id SERIAL PRIMARY KEY,
  session_id TEXT REFERENCES generation_sessions(id),
  iteration_number INTEGER,
  verse_content TEXT,
  rating TEXT DEFAULT 'fine',  -- 'best', 'fine', 'not_the_vibe'
  is_keeper BOOLEAN DEFAULT false,
  created_at TIMESTAMP
);
```

---

## User Interface Specification

### Mobile-First Design Principles

- **Touch-optimized**: All interactive elements minimum 44x44px
- **Thumb-friendly**: Primary actions in bottom third of screen
- **Swipe gestures**: Navigate between verses, manage keepers
- **Minimal chrome**: Maximize content area on small screens
- **Progressive disclosure**: Show complexity only when needed

### Screen 1: Generation Input

```
┌─────────────────────────────────┐
│  Lyric Assistant        [Menu]  │
├─────────────────────────────────┤
│                                 │
│  Project: Cityscape        [v]  │
│  ┌─────────────────────────┐   │
│  │ Input Verse             │   │
│  │                         │   │
│  │ [Multi-line text area]  │   │
│  │                         │   │
│  │                         │   │
│  └─────────────────────────┘   │
│                                 │
│  Settings                       │
│  ┌─────────────────────────┐   │
│  │ Religiosity             │   │
│  │  [No] [Ish] [Yes]       │   │
│  │                         │   │
│  │ Rhythm                  │   │
│  │  [No] [Ish] [Yes]       │   │
│  │                         │   │
│  │ Rhyming                 │   │
│  │  [No] [Ish] [Yes]       │   │
│  │                         │   │
│  │ Meaning                 │   │
│  │  [No] [Ish] [Yes]       │   │
│  └─────────────────────────┘   │
│                                 │
│  Theme                          │
│  [Let me tell you a story  v]  │
│                                 │
│  Steer (optional)               │
│  [_________________________]   │
│                                 │
│         [Generate]              │
│                                 │
└─────────────────────────────────┘
```

**Interaction Notes:**
- Settings use segmented button controls (not sliders)
- Defaults: Religiosity=Ish, Rhythm=Yes, Rhyming=Ish, Meaning=Yes
- Theme dropdown with 14 options (default: "Let me tell you a story")
- Generate button fixed at bottom (thumb zone)

### Screen 2: Generated Verses (Review)

```
┌─────────────────────────────────┐
│  ← Back to Input    Iteration 1 │
├─────────────────────────────────┤
│                                 │
│  Verse 1/10                     │
│  ┌─────────────────────────┐   │
│  │ Walking through the      │   │
│  │ midnight rain            │   │
│  │ Streetlights flicker,    │   │
│  │ go insane                │   │
│  └─────────────────────────┘   │
│                                 │
│  Rating                         │
│  [ Best ] [Fine] [Not the vibe] │
│                                 │
│         [Add to Keepers]        │
│                                 │
│  ─────────────────────────────  │
│  [< Prev]            [Next >]   │
│                                 │
│  ● ○ ○ ○ ○ ○ ○ ○ ○ ○          │
│                                 │
│         [Iterate]               │
│  (Generate 10 more with         │
│   feedback from ratings)        │
│                                 │
└─────────────────────────────────┘
```

**Interaction Notes:**
- Swipe left/right to navigate between verses
- Tap rating buttons to change (defaults to Fine)
- Pagination dots show position (1-10)
- "Add to Keepers" button prominent
- Iterate button at bottom after viewing all verses
- **Post-MVP**: Long-press text to select for "Very Good" or "Reroll"

### Screen 3: Workspace (Keeper Verses)

```
┌─────────────────────────────────┐
│  ← Back          Workspace      │
├─────────────────────────────────┤
│                                 │
│  Project: Cityscape             │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Walking through the      │   │
│  │ midnight rain            │   │
│  │ Streetlights flicker,    │   │
│  │ go insane                │ ⋮ │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Dancing shadows on       │   │
│  │ empty streets            │   │
│  │ Every memory feels       │   │
│  │ incomplete               │ ⋮ │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ [Editable text area]     │   │
│  │                          │   │
│  └─────────────────────────┘   │
│                                 │
│            [+ Add New]          │
│                                 │
│  ─────────────────────────────  │
│  [Export as Song]               │
│                                 │
└─────────────────────────────────┘
```

**Interaction Notes:**
- Each keeper verse is a card
- Drag handle (⋮) to reorder
- Tap card to edit inline
- Standard text editing (cut, copy, paste, select)
- Add blank card for manual writing
- Export saves to completed lyrics

### Mobile Navigation Pattern

```
Bottom Navigation Bar:
┌──────┬──────┬──────┬──────┐
│ Home │Review│Keeper│ More │
└──────┴──────┴──────┴──────┘
```

- **Home**: Generation input
- **Review**: Current session verses (if any)
- **Keeper**: Workspace
- **More**: Projects, fragments, settings

---

## Core Functionality

### Generation Pipeline

```
User Input + Settings
    ↓
[Netlify Function: /api/generate]
    ↓
1. Parse input verse
2. Analyze prosody (syllables, stress, rhyme)
    ↓
3. Semantic retrieval
   - If Meaning ≠ No: Vector search on input
   - Weight by Theme + Steer
    ↓
4. Prosodic retrieval (if rhythmic fragments)
   - Filter by syllable count (based on Rhythm setting)
   - Match stress patterns
   - Find rhyme candidates (based on Rhyming setting)
    ↓
5. Combine retrieval results (top 15-20 fragments)
    ↓
6. Construct prompt
   - Include settings instructions
   - Add retrieved fragments
   - Add completed lyrics (style)
   - [If iteration 2+] Add rated verses
    ↓
7. Call Claude API
   - Generate 10 variations
   - Stream results to client
    ↓
8. [If Rhythm:Yes or Rhyming:Yes] Validate
   - Check constraints
   - Regenerate if needed (max 2 attempts)
    ↓
9. Return verses to client
    ↓
10. Save session to database
```

### Iterative Refinement

**Iteration 1:**
- Generate from input + settings + fragments + style

**Iteration 2+:**
- Retrieve previous verses from session
- Filter for "Best" (2-3 examples) and "Not the vibe" (2-3 examples)
- Omit "Fine" (no signal)
- Include in prompt with reflection request
- Generate 10 new variations

**Prompt structure for iteration 2+:**
```
[System context + style reference]

PREVIOUS GENERATION - Learn from feedback:

User marked these as "Best" ✓:
1. [verse]
2. [verse]

User marked these as "Not the vibe" ✗:
1. [verse]
2. [verse]

Briefly reflect: What patterns made the "Best" ones work? What felt off about the others?

Now generate 10 NEW variations incorporating this feedback while meeting all original requirements.
```

### Setting-Specific Prompt Language

**Religiosity:**

- **No**: "Draw thematic inspiration from the fragments but invent freely. Create new phrases and images beyond what's in the corpus."
- **Ish**: "Pull concepts, imagery, and occasional phrases from the fragments, adapting them naturally to fit the requirements."
- **Yes**: "Use actual words and phrases from the fragments, but adapt them as a human songwriter would—change tense ('walking' → 'walked'), adjust pronouns ('I' → 'you'), swap similar words for better rhyme ('night' → 'sight'), modify to fit rhythm. Creative adaptation within boundaries."

**Rhythm:**

- **No**: "Match the general feel and approximate length. Syllable count can vary by 3-4 syllables per line."
- **Ish**: "Aim for similar syllable count per line (within ±2 syllables). Stress patterns should be compatible but can flex."
- **Yes**: "Exact syllable count required per line. Stress pattern must match. Line 1: [N] syllables, pattern [X]. Line 2: [M] syllables, pattern [Y]."

**Rhyming:**

- **No**: "No rhyme required. Focus on meaning and rhythm."
- **Ish**: "Slant rhymes, assonance, consonance, and near-rhymes are excellent. Perfect rhymes not required but welcome."
- **Yes**: "Perfect end rhymes required. Lines must rhyme with these sounds: [phonetic specifications]."

**Meaning:**

- **No**: "The input text is only a rhythmic guide (syllables and stress). Ignore its semantic content completely. Base meaning on Theme and Steer only."
- **Ish**: "The input text provides loose contextual direction—a vibe or mood to work from—but is not final lyric material. Use it as inspiration while staying flexible."
- **Yes**: "The input text is an actual line from the song the writer is already happy with. Generated verses must work in a song that contains this exact line, even if they don't directly follow it. Maintain thematic and tonal consistency."

### Prosodic Analysis Implementation

**Tools:**
- Syllable counting: `pyphen` or `syllables` library
- Stress patterns: CMU Pronouncing Dictionary (CMUdict via NLTK)
- Phonetic transcription: `pronouncing` library
- Rhyme matching: Phonetic distance algorithms

**Process:**
```python
def analyze_fragment_prosody(text, is_rhythmic):
    if not is_rhythmic:
        return None  # Skip prosodic analysis
    
    lines = text.split('\n')
    prosody = []
    
    for i, line in enumerate(lines, 1):
        line_data = {
            'line': i,
            'text': line,
            'syllables': count_syllables(line),
            'stress': get_stress_pattern(line),  # "10101010"
            'end_rhyme': get_end_rhyme_sound(line)  # IPA
        }
        prosody.append(line_data)
    
    return {
        'lines': len(lines),
        'prosody': prosody,
        'fragment_type': classify_type(len(lines))
    }
```

### Tag Generation

**LLM prompt for tag generation:**
```
Given this lyric fragment and optional context, generate 3-7 relevant tags:

Fragment: "{fragment_text}"
Context: "{context_note}"  [if present]

Tags should capture:
- Themes (love, loss, defiance, etc.)
- Imagery (urban, nocturnal, domestic, etc.)
- Emotions (melancholic, hopeful, angry, etc.)
- Style (satirical, sincere, abstract, etc.)

Return only a comma-separated list of single-word or two-word tags.
```

---

## API Specification (Netlify Functions)

### POST /api/generate

**Request:**
```json
{
  "projectId": "proj-cityscape-20251108",
  "sessionId": "sess-001",  // null for new session
  "iterationNumber": 1,
  "input": {
    "verse": "Walking through the midnight rain\nStreetlights flicker, go insane",
    "settings": {
      "religiosity": "ish",
      "rhythm": "yes",
      "rhyming": "ish",
      "meaning": "yes"
    },
    "theme": "Let me tell you a story",
    "steer": ""
  },
  "previousRatings": [  // Empty array for iteration 1
    {
      "verse": "...",
      "rating": "best"
    }
  ]
}
```

**Response (streaming):**
```json
{
  "sessionId": "sess-001",
  "iteration": 1,
  "verses": [
    {
      "id": 1,
      "content": "Wandering through the neon glow\nWhere broken hearts and shadows go",
      "rating": "fine",
      "isKeeper": false
    }
    // ... 9 more verses
  ]
}
```

### POST /api/add-keeper

**Request:**
```json
{
  "projectId": "proj-cityscape-20251108",
  "verseContent": "Walking through the midnight rain\nStreetlights flicker, go insane"
}
```

**Response:**
```json
{
  "success": true,
  "workspaceUpdated": true
}
```

### POST /api/update-rating

**Request:**
```json
{
  "verseId": 123,
  "rating": "best"  // or "fine" or "not_the_vibe"
}
```

**Response:**
```json
{
  "success": true
}
```

### GET /api/fragments?search=urban&rhythmic=true&syllables=8

**Response:**
```json
{
  "fragments": [
    {
      "id": "frag0001",
      "content": "City lights blur through tears at night",
      "tags": ["urban", "nocturnal", "sad"],
      "rhythmic": true,
      "syllables": 8,
      "stress": "10101010"
    }
    // ... more fragments
  ]
}
```

### POST /api/import-fragments

**Request:**
```json
{
  "csvData": "...",  // CSV content
  "analyzeNow": true
}
```

**Response:**
```json
{
  "success": true,
  "processed": 65,
  "fragmentsCreated": 65,
  "errors": []
}
```

### GET /api/projects

**Response:**
```json
{
  "projects": [
    {
      "id": "proj-cityscape-20251108",
      "name": "Cityscape",
      "lastModified": "2025-11-08T22:30:00Z",
      "keeperCount": 5
    }
  ]
}
```

### POST /api/export-song

**Request:**
```json
{
  "projectId": "proj-cityscape-20251108",
  "title": "Midnight Rain",
  "content": "[Full lyric content]",
  "useForStyle": true
}
```

**Response:**
```json
{
  "success": true,
  "songId": "song-001",
  "filePath": "completed-lyrics/midnight-rain.md"
}
```

---

## Word Processing Features (Post-MVP)

### Text Selection in Generated Verses

**"Very Good" Action:**
1. User long-presses text in generated verse
2. Selection handles appear
3. Toolbar shows: [Cancel] [Very Good]
4. Tap "Very Good"
5. System:
   - Extracts selected phrase
   - Analyzes prosody (if rhythmic context)
   - Generates tags
   - Creates new fragment
   - Shows confirmation toast
   - Fragment appears in library

**"Reroll" Action:**
1. User long-presses text in generated verse
2. Selection handles appear
3. Toolbar shows: [Cancel] [Reroll]
4. Tap "Reroll"
5. System:
   - Calls API with: original verse + selection span + original requirements
   - Generates 3 new variations where ONLY the selected phrase changes
   - Shows in modal: "Choose replacement" with 3 options
   - User taps one → replaces in place

**Implementation:**
- Use ProseMirror for text selection and manipulation
- Mobile-optimized selection handles
- Touch-friendly toolbar with clear icons

### Workspace Text Editing

**Features:**
- Tap any keeper card to enter edit mode
- Standard contenteditable behavior
- Cut, copy, paste support
- Undo/redo
- Auto-save on blur
- Drag-to-reorder cards (touch-friendly)
- Combine cards: drag one onto another to merge
- Split cards: select text and tap "Split" to create new card

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)
**Goal:** Core infrastructure and fragment import

**Deliverables:**
- [ ] Netlify project setup with Functions
- [ ] GitHub repo structure for Obsidian vault
- [ ] Neon Postgres database provisioned and schema created
- [ ] Upstash Vector database setup
- [ ] Fragment import script
  - CSV parsing
  - Prosodic analysis pipeline (CMUdict integration)
  - Tag generation via LLM
  - Markdown file creation
  - Database population
  - Vector embedding generation
- [ ] Basic React app scaffold (mobile-first)
- [ ] Authentication (Netlify Identity)

**Success Criteria:**
- All 65 fragments imported successfully
- Prosodic analysis working for rhythmic fragments
- Tags generated and editable
- Fragments queryable in database

### Phase 2: Generation Core (Weeks 5-8)
**Goal:** Basic generation working end-to-end

**Deliverables:**
- [ ] Generation input UI (Screen 1)
  - Input text area
  - Four toggle settings
  - Theme dropdown (14 options)
  - Steer field
  - Generate button
- [ ] `/api/generate` function
  - Prosodic analysis of input
  - Semantic retrieval (vector search)
  - Prosodic retrieval (if applicable)
  - Fragment ranking and selection
  - Prompt construction
  - Claude API integration (streaming)
  - Validation loop (for strict settings)
- [ ] Review UI (Screen 2)
  - Display 10 generated verses
  - Swipe navigation
  - Rating buttons
  - Keeper button
- [ ] Session persistence
  - Save sessions to database
  - Link to projects

**Success Criteria:**
- User can input verse, configure settings, generate 10 variations
- Generation respects all four toggle settings
- Verses display on mobile UI
- Sessions saved successfully

### Phase 3: Iteration & Feedback (Weeks 9-10)
**Goal:** Multi-iteration refinement working

**Deliverables:**
- [ ] Rating system
  - Three-way toggle (Best/Fine/Not the vibe)
  - Save ratings to database
  - Update UI immediately
- [ ] Iterate functionality
  - "Iterate" button appears after rating
  - Retrieves rated verses from session
  - Filters for Best (2-3) and Not the vibe (2-3)
  - Constructs iteration 2+ prompt with reflection
  - Generates 10 new verses
  - Increments iteration counter
- [ ] Iteration history
  - View previous iterations
  - Navigate between iteration sets

**Success Criteria:**
- User can rate verses and iterate
- Iteration 2+ incorporates feedback
- Quality improves with iteration (qualitative testing)

### Phase 4: Workspace (Weeks 11-12)
**Goal:** Keeper management and song export

**Deliverables:**
- [ ] Workspace UI (Screen 3)
  - Display keeper verses as cards
  - Tap to edit inline
  - Drag-to-reorder
  - Delete keepers
  - Add blank card
- [ ] `/api/add-keeper` function
- [ ] `/api/export-song` function
  - Creates completed lyric file
  - Adds to vault
  - Marks for style reference
- [ ] Project management
  - Create new project
  - Open existing project
  - Project list view
  - Delete project

**Success Criteria:**
- User can add verses to keepers
- Edit and rearrange in workspace
- Export as completed song
- Projects persist across sessions

### Phase 5: PWA & Mobile Polish (Weeks 13-14)
**Goal:** Full mobile experience

**Deliverables:**
- [ ] PWA setup
  - Service worker
  - Manifest file
  - Install prompt
  - Offline error handling
- [ ] Mobile UI refinements
  - Touch gesture optimization
  - Loading states
  - Error messages
  - Haptic feedback
  - Dark mode
- [ ] Performance optimization
  - Lazy loading
  - Code splitting
  - Image optimization
  - API response caching
- [ ] Bottom navigation
  - Four-tab layout
  - Smooth transitions

**Success Criteria:**
- App installable to home screen
- Smooth 60fps interactions
- Fast load time (<3s on 3G)
- Feels native on mobile

### Phase 6: Testing & Launch (Weeks 15-16)
**Goal:** Production-ready release

**Deliverables:**
- [ ] User testing (5 songwriters)
- [ ] Bug fixes based on feedback
- [ ] Documentation
  - User guide
  - Fragment import tutorial
  - API documentation
- [ ] Production deployment
  - Environment variables secured
  - Rate limiting configured
  - Monitoring setup (Sentry)
  - Analytics (optional, privacy-focused)
- [ ] Domain setup and SSL

**Success Criteria:**
- Zero critical bugs
- Positive user feedback
- Deployed to production
- User can complete full workflow: import → generate → iterate → export

### Post-MVP (Future Phases)
**Phase 7: Text Selection Features**
- Long-press selection in verses
- "Very Good" action (create fragment)
- "Reroll" action (regenerate phrase)
- ProseMirror integration

**Phase 8: Advanced Features**
- Fragment browsing and editing
- Multi-song structure (verse/chorus awareness)
- Collaboration (shared libraries)
- Analytics dashboard
- Custom themes (user-created)

---

## Technical Requirements

### Performance Targets
- Initial page load: <3 seconds (3G)
- Generation time: <8 seconds (total for 10 verses)
- UI interaction: 60fps scrolling
- Time to interactive: <5 seconds

### Browser Support
- iOS Safari 14+
- Chrome/Edge (mobile) 90+
- Firefox (mobile) 90+
- Samsung Internet 14+

### API Rate Limits
- Claude API: 50 requests/minute (configurable)
- Embedding API: 100 requests/minute
- Per-user: 10 generation requests/minute

### Security
- Authentication: Netlify Identity
- API endpoints: JWT validation
- Environment variables: Netlify env (API keys)
- CORS: Restricted to app domain
- No sensitive data in localStorage

### Data Privacy
- All fragments stored privately per user
- No sharing of fragment content with third parties (except LLM APIs for generation)
- User can export vault and delete account
- GDPR-compliant data deletion

---

## Success Metrics

### User Engagement
- Projects created per user
- Sessions per week
- Average iterations per session
- Keeper rate (% of verses marked as keeper)
- Completed songs exported

### Generation Quality
- Best/Fine/Not the vibe distribution
- Iteration efficiency (avg iterations to find 3+ keepers)
- User retention (return within 7 days)
- Time spent in workspace (indicates usefulness)

### Technical Performance
- API latency (p50, p95, p99)
- Error rate (<1%)
- Uptime (99.9%)
- Mobile performance score (Lighthouse >80)

---

## Open Questions for Development

1. **Fragment versioning**: Should edited fragments create new versions or overwrite?
2. **Style learning**: Should system automatically add new completed songs to style corpus, or require opt-in?
3. **Offline mode**: Should we cache fragments locally for offline generation (using locally-run model)?
4. **Collaboration**: Future feature for shared fragment libraries between users?
5. **Prosody validation**: How strict should validation be for "Yes" settings? Fail hard or show warning?
6. **Theme expansion**: Should users be able to add custom themes beyond the 14 presets?

---

## Deployment Checklist

### Pre-Launch
- [ ] Environment variables set in Netlify
- [ ] Database schema deployed to Neon
- [ ] Vector store configured in Upstash
- [ ] API keys validated (Anthropic, OpenAI)
- [ ] GitHub repo permissions set
- [ ] Domain DNS configured
- [ ] SSL certificate active
- [ ] Rate limiting tested
- [ ] Error handling verified
- [ ] Mobile responsiveness tested on 5+ devices
- [ ] PWA installation tested (iOS + Android)

### Launch
- [ ] Deploy to production
- [ ] Smoke test critical paths
- [ ] Monitor error logs (first 24 hours)
- [ ] User onboarding flow tested
- [ ] Fragment import tested with full 65 fragments

### Post-Launch
- [ ] Gather user feedback (first week)
- [ ] Monitor performance metrics
- [ ] Address bugs (priority queue)
- [ ] Plan Phase 7 (text selection features)

---

**Document Version:** 2.0 Final  
**Last Updated:** November 10, 2025  
**Status:** Ready for Development  
**Next Review:** End of Phase 1
