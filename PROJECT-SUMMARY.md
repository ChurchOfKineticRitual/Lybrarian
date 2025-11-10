# Lyric Writing Assistant - Project Summary

## Read This First

This document provides a high-level overview of the project. Read this before diving into the detailed specifications.

---

## What Are We Building?

A mobile-first web app that helps a songwriter (Jordan) generate new verses using AI by drawing from his personal collection of lyric fragments.

**The Core Loop:**
1. Jordan types a verse or rhythmic pattern on his phone
2. System finds relevant fragments from his library
3. Claude AI generates 10 verse variations inspired by those fragments
4. Jordan rates them (Best / Fine / Not the vibe)
5. Clicks "Iterate" → 10 more verses incorporating his feedback
6. Saves favorite verses to workspace
7. Edits and combines them into a complete song

---

## Why This Project Exists

**The Problem:**
- Jordan has hundreds of lyric fragments scattered across notebooks
- Finding relevant fragments manually is slow and breaks creative flow
- He wants AI to help him explore variations while maintaining his voice
- Needs to match specific rhythms (for melodies he's composing)

**The Solution:**
- Centralize fragments in searchable library with prosodic analysis
- Use AI to generate variations that match rhythm, rhyme, and meaning requirements
- Learn from user feedback through iteration
- Provide mobile-first UX for writing anywhere

---

## Key Technical Concepts

### 1. Fragments
**What:** Short lyric snippets (1-8 lines) that form the raw material

**Two Types:**
- **Rhythmic (Y):** Prosody matters - syllable count, stress pattern, rhyme
- **Semantic (N):** Only meaning matters - used for imagery and themes

**Example Rhythmic:**
```
Walking through the midnight rain    (8 syllables, stress: 10101010)
Streetlights flicker, go insane      (8 syllables, rhymes with "rain")
```

**Example Semantic:**
```
Count back from a hundred in sevens
(Medical/anxiety imagery, prosody irrelevant)
```

### 2. Prosodic Analysis
**What:** Breaking down the rhythmic qualities of text

**Three Components:**
- **Syllables:** Count per line (e.g., 8)
- **Stress:** Pattern of stressed/unstressed syllables (e.g., "10101010")
- **Rhyme:** Phonetic ending sound for matching (e.g., "aɪt" for "night")

**Why:** Allows matching input rhythm to find compatible fragments

### 3. Four-Way Toggle Settings

**Religiosity** - Fragment adherence:
- No: Invent freely
- Ish: Adapt fragments naturally (DEFAULT)
- Yes: Use actual fragment phrases, adapted

**Rhythm** - Prosodic matching:
- No: Approximate length only
- Ish: Similar syllables (±2)
- Yes: Exact syllable count (DEFAULT)

**Rhyming** - Rhyme requirement:
- No: No rhyme needed
- Ish: Slant rhymes okay (DEFAULT)
- Yes: Perfect rhymes required

**Meaning** - Input interpretation:
- No: Input is rhythmic guide only
- Ish: Loose semantic guide
- Yes: Actual lyric line (DEFAULT)

### 4. Iterative Refinement

**Iteration 1:** Generate 10 verses from input + settings + fragments

**Iteration 2+:** 
- Show AI the "Best" rated verses (what worked)
- Show AI the "Not the vibe" verses (what to avoid)
- Generate 10 more incorporating this feedback

**Result:** Quality improves with each iteration as system learns user preferences

---

## Architecture Overview

```
Mobile Phone (PWA)
    ↓
Netlify (React App + Functions)
    ↓
┌──────────┬──────────────┬────────────────┐
│          │              │                │
Neon DB    Upstash Vector  GitHub Repo
(Postgres) (Embeddings)    (Markdown Vault)
    ↓           ↓              ↓
Metadata    Semantic      Fragments
Sessions    Search        (Obsidian)
Prosody

External APIs:
- Anthropic Claude (verse generation)
- OpenAI (embeddings)
```

**Why This Stack:**
- **Netlify**: Easy deployment, serverless functions
- **Neon**: Serverless Postgres (scales to zero)
- **Upstash Vector**: Serverless embeddings (no server to manage)
- **GitHub**: Portable vault editable in Obsidian
- **React PWA**: Mobile-first, installable, works offline

---

## Data Flow

### Import Flow (One-Time Setup)
```
CSV (65 fragments)
    ↓
Parse & Analyze
    ├─→ Tags (LLM generation)
    ├─→ Prosody (CMUdict analysis)
    └─→ Embeddings (OpenAI API)
    ↓
Save to:
    ├─→ Neon DB (metadata, prosody)
    ├─→ Upstash (vectors)
    └─→ GitHub (markdown files)
```

### Generation Flow (Runtime)
```
User Input + Settings
    ↓
Analyze Input Prosody
    ↓
Retrieve Fragments
    ├─→ Semantic Search (vector DB)
    └─→ Prosodic Filter (SQL)
    ↓
Construct Prompt
    ├─→ Input + Settings
    ├─→ Retrieved Fragments
    ├─→ Style Reference (completed lyrics)
    └─→ Previous Ratings (if iteration 2+)
    ↓
Claude API → 10 Verses
    ↓
Validate (if strict settings)
    ↓
Return to User
```

---

## File Structure

### Documents You Have

**Core Specifications:**
1. `lyric-assistant-prd-final.md` - Complete product requirements (READ THIS FIRST)
2. `fragment-processing-spec.md` - How to import and process fragments
3. `database-schema.sql` - Complete Postgres schema
4. `quick-start-guide.md` - Step-by-step development guide

**Data:**
5. `fragment-corpus-cleaned.csv` - 65 initial fragments to import

### Repository Structure You'll Create

```
lyric-assistant/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── InputScreen.jsx
│   │   │   ├── ReviewScreen.jsx
│   │   │   ├── WorkspaceScreen.jsx
│   │   │   └── ...
│   │   ├── api/
│   │   │   └── client.js
│   │   ├── App.jsx
│   │   └── index.js
│   ├── public/
│   │   ├── manifest.json
│   │   └── service-worker.js
│   └── package.json
│
├── netlify/
│   └── functions/
│       ├── generate.js
│       ├── add-keeper.js
│       ├── update-rating.js
│       ├── fragments.js
│       └── export-song.js
│
├── scripts/
│   ├── import-fragments.py
│   ├── analyze-prosody.py
│   └── generate-embeddings.py
│
├── database/
│   └── schema.sql
│
└── README.md
```

---

## Development Phases

### Phase 1: Foundation (Weeks 1-4)
- Set up infrastructure (Netlify, Neon, Upstash, GitHub)
- Import 65 fragments with prosody analysis
- Verify all data in place

### Phase 2: Core Generation (Weeks 5-8)
- Build input UI (4 toggles + theme + steer)
- Build generation API (retrieval + Claude)
- Build review UI (display verses, ratings)

### Phase 3: Iteration (Weeks 9-10)
- Rating system
- Iterate button → generates with feedback
- Session history

### Phase 4: Workspace (Weeks 11-12)
- Keeper management (add, edit, reorder)
- Export to completed song
- Project management

### Phase 5: Mobile Polish (Weeks 13-14)
- PWA setup (installable)
- Touch gestures
- Performance optimization
- Dark mode

### Phase 6: Launch (Weeks 15-16)
- Testing
- Documentation
- Production deployment

---

## Success Criteria

**Must Have for Launch:**
- [ ] All 65 fragments imported successfully
- [ ] User can generate 10 verses matching input rhythm
- [ ] Iteration improves quality based on ratings
- [ ] Workspace allows editing and combining verses
- [ ] Export creates completed song file
- [ ] App works smoothly on mobile

**Quality Metrics:**
- Keeper rate >20% (user finds 2+ keepers per 10 verses)
- Iteration efficiency <3 iterations to find 3+ keepers
- Generation time <8 seconds
- Mobile Lighthouse score >80

---

## The Secret Sauce

**What Makes This Special:**

1. **Prosodic Matching:** Not just semantic similarity - matches actual rhythm for melodies
2. **Dual-Type Fragments:** Rhythmic fragments for prosody, semantic fragments for imagery
3. **Iterative Learning:** Gets better with user feedback in real-time
4. **Mobile-First:** Songwriter can work anywhere, anytime
5. **Portable Data:** Markdown vault editable in Obsidian, version-controllable

---

## Common Questions

**Q: Why both vector search and SQL queries?**
A: Vector search finds semantically similar fragments. SQL finds prosodically compatible fragments. Both are needed.

**Q: Why separate Rhythmic=Y/N fragments?**
A: Analyzing prosody of semantic-only fragments creates noise. "Count back from a hundred in sevens" has no meaningful rhythm - it's valuable for medical/anxiety imagery only.

**Q: Why iteration instead of just generating once?**
A: Creative writing is iterative. First pass gives direction, feedback refines. Like human collaboration.

**Q: Why mobile-first?**
A: Songwriter works everywhere - on couch, in cafe, waiting for train. Desktop is secondary.

**Q: Why Obsidian vault?**
A: Portability. Markdown files are human-readable, versionable, future-proof. Can use in other tools.

---

## What to Read Next

**If you're starting development:**
1. Read this document (✓ you're here)
2. Read `lyric-assistant-prd-final.md` (complete specs)
3. Read `quick-start-guide.md` (step-by-step)
4. Start Phase 1: Infrastructure setup

**If you're building fragment import:**
1. Read `fragment-processing-spec.md` (detailed algorithm)
2. Look at `fragment-corpus-cleaned.csv` (the data)
3. Review `database-schema.sql` (where it goes)

**If you're building generation:**
1. Read PRD section "Core Functionality"
2. Read PRD section "Setting-Specific Prompt Language"
3. Study retrieval algorithm in quick-start-guide

---

## The Vision

Jordan wants to:
- Capture lyric fragments on his phone as they occur to him
- Use AI to help explore variations when writing songs
- Match specific rhythms for melodies he's composing
- Maintain his unique voice (not generic AI lyrics)
- Work fluidly without breaking creative flow

**This app enables that.**

---

**Now go read the PRD. Everything you need is there. Good luck!**

**Version:** 1.0  
**Created:** November 10, 2025
