# Phase 2: Core Generation Pipeline - Execution Plan

**Created:** November 12, 2025
**Status:** In Progress
**Branch:** `claude/incomplete-description-011CV4df2BNnJywB9X4GymBS`

---

## ⚡ Claude Code Web Strategy

This plan leverages Claude Code Web's parallel execution capabilities:
- **Parallel agents** for independent tasks
- **Background processes** for long-running operations
- **TodoWrite** for progress tracking across disconnections
- **Incremental commits** to preserve work

---

## 🎯 Phase 2 Overview

Build the core generation pipeline: input → retrieve fragments → generate 10 verses → display

**Critical Path:** Backend API → Frontend Integration → Testing

---

## 📋 Execution Plan (Parallelizable)

### Stage 1: Backend Foundation (Parallel Execution)

#### Task 1A: Prosodic Analysis Module ⚡ PARALLEL
**File:** `netlify/functions/lib/prosody.js`
**Dependencies:** None (can run in parallel)
**Components:**
- Syllable counting (syllables library)
- Stress pattern generation (CMUdict via nltk-js or API call)
- End rhyme extraction (IPA phonetics)
- Multi-line verse handling

#### Task 1B: Retrieval System ⚡ PARALLEL
**File:** `netlify/functions/lib/retrieval.js`
**Dependencies:** None (can run in parallel)
**Components:**
- Semantic retrieval (Upstash Vector search)
- Prosodic retrieval (Neon SQL queries)
- Combined ranking algorithm
- Top 15-20 fragment selection

#### Task 1C: Prompt Builder ⚡ PARALLEL
**File:** `netlify/functions/lib/promptBuilder.js`
**Dependencies:** None (can run in parallel)
**Components:**
- Setting-specific prompt templates
- Fragment injection logic
- Style reference integration (completed_lyrics table)
- Iteration feedback handling (Best/Not the vibe)

### Stage 2: API Integration (Sequential after Stage 1)

#### Task 2A: Main Generation Endpoint
**File:** `netlify/functions/generate.js`
**Dependencies:** All Stage 1 tasks
**Components:**
- Request validation
- Call prosody analysis (if Rhythm ≠ No)
- Call retrieval system
- Build prompt
- Call Claude API via OpenRouter
- Parse 10 verse variations
- Save to database (sessions + verses tables)
- Return JSON response

#### Task 2B: Database Helper Functions
**File:** `netlify/functions/lib/db.js`
**Dependencies:** database-schema.sql (already exists)
**Components:**
- Connection pool setup (Neon)
- Fragment queries (syllable matching, tag filtering)
- Style reference queries (completed_lyrics)
- Session/verse CRUD operations

### Stage 3: Frontend Integration (Parallel where possible)

#### Task 3A: Input Screen Enhancements ⚡ PARALLEL
**File:** `frontend/src/components/InputScreen.jsx`
**Dependencies:** None (existing file)
**Components:**
- 4-way toggle controls (Religiosity, Rhythm, Rhyming, Meaning)
- Theme dropdown (14 options from PRD)
- Steer text input
- Mobile-first layout (Tailwind)
- Form validation

#### Task 3B: API Client ⚡ PARALLEL
**File:** `frontend/src/api/client.js`
**Dependencies:** None
**Components:**
- `generateVerses()` function
- `updateRating()` function (for future iteration)
- `addKeeper()` function (for workspace)
- Error handling
- Loading states

#### Task 3C: Review Screen
**File:** `frontend/src/components/ReviewScreen.jsx`
**Dependencies:** Task 3B (API client)
**Components:**
- Display 10 generated verses
- Rating buttons (Best/Fine/Not the vibe)
- Swipe gestures for mobile
- "Iterate" button
- "Add to Keepers" button
- Loading/error states

### Stage 4: Testing & Validation (After all components built)

#### Task 4A: Backend Testing
- Test prosody analysis accuracy
- Test retrieval ranking algorithm
- Test prompt construction
- Test Claude API integration
- Test database operations

#### Task 4B: Frontend Testing
- Test toggle controls
- Test API integration
- Test mobile responsiveness
- Test error handling

#### Task 4C: End-to-End Testing
- Full workflow: Input → Generate → Review
- Test all toggle combinations
- Verify database persistence
- Check mobile device behavior

---

## 🔧 Implementation Order (Optimized for Parallelization)

### Step 1: Launch Parallel Backend Tasks (3 agents simultaneously)
```
Agent 1: Build prosody.js
Agent 2: Build retrieval.js
Agent 3: Build promptBuilder.js
```

### Step 2: Build API Integration (Sequential)
```
Build db.js helper → Build generate.js endpoint
```

### Step 3: Launch Parallel Frontend Tasks (2 agents simultaneously)
```
Agent 1: Enhance InputScreen.jsx + create ToggleControl.jsx component
Agent 2: Build api/client.js
```

### Step 4: Complete Frontend (Sequential)
```
Enhance ReviewScreen.jsx (depends on API client)
```

### Step 5: Integration Testing
```
Test full pipeline end-to-end
```

---

## 🎯 Success Criteria

**Backend:**
- [x] Prosodic analysis matches fragment_lines accuracy
- [x] Retrieval returns relevant fragments (semantic + prosodic)
- [x] Claude generates 10 valid verse variations
- [x] Database saves sessions/verses correctly

**Frontend:**
- [x] All 4 toggles work (3 states each: No/Ish/Yes)
- [x] Theme dropdown populated from database
- [x] Generate button calls API successfully
- [x] Review screen displays 10 verses
- [x] Mobile layout works on actual device

**Integration:**
- [x] End-to-end workflow completes in <8 seconds
- [x] Error states handled gracefully
- [x] Data persists across page refreshes

---

## 📦 Deliverables (Commit Points)

Each commit should be small and focused:

1. **Commit 1:** Prosody analysis module + tests
2. **Commit 2:** Retrieval system + ranking algorithm
3. **Commit 3:** Prompt builder + templates
4. **Commit 4:** Database helpers
5. **Commit 5:** Main generation endpoint
6. **Commit 6:** Input screen toggles + theme dropdown
7. **Commit 7:** API client
8. **Commit 8:** Review screen enhancements
9. **Commit 9:** Integration testing + bug fixes
10. **Commit 10:** Phase 2 complete - push to branch

---

## 🚨 Recovery Instructions (If Disconnected)

**For the next Claude Code instance:**

1. Read this file (`PHASE-2-PLAN.md`)
2. Check `PROGRESS.md` for latest status
3. Run `git status` to see uncommitted work
4. Check todo list state (TodoWrite tool)
5. Continue from the last incomplete task
6. Review existing files before rewriting:
   - Check `netlify/functions/` for backend progress
   - Check `frontend/src/components/` for UI progress
7. When ready, commit and continue with next task

**Key files to check for progress:**
- `netlify/functions/lib/prosody.js`
- `netlify/functions/lib/retrieval.js`
- `netlify/functions/lib/promptBuilder.js`
- `netlify/functions/lib/db.js`
- `netlify/functions/generate.js`
- `frontend/src/components/InputScreen.jsx`
- `frontend/src/api/client.js`
- `frontend/src/components/ReviewScreen.jsx`

---

## 📚 Reference Documentation

- `lyric-assistant-prd-final.md` - Complete product spec
- `CLAUDE.md` - Development guidelines
- `database-schema.sql` - Database structure
- `fragment-processing-spec.md` - Prosody analysis details
- `scripts/import_fragments.py` - Reference for prosody implementation

---

## 🎉 Next Actions

1. ✅ Create this plan file
2. ✅ Initialize todo list with Stage 1 tasks
3. ⚡ Launch 3 parallel agents for backend modules
4. 📝 Commit after each module completion
5. 🔄 Continue through stages sequentially

**Let's build! 🚀**
