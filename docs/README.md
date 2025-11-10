# Lyric Writing Assistant - Documentation Package

**Complete specifications for building a mobile-first lyric generation web app**

---

## 📋 Document Index

This package contains everything needed to build the Lyric Writing Assistant. Read documents in this order:

### 1. START HERE: PROJECT-SUMMARY.md
**Purpose:** High-level overview and orientation  
**Time:** 10 minutes  
**Read this:** Before anything else

Quick context on what we're building, why, and how the pieces fit together.

---

### 2. MAIN SPEC: lyric-assistant-prd-final.md
**Purpose:** Complete product requirements document  
**Time:** 45-60 minutes  
**Read this:** After project summary

**This is your bible.** Everything you need to know about:
- Features and functionality
- UI specifications (mobile-first)
- Architecture (Netlify + serverless)
- API specifications
- Database design
- Development roadmap
- Success criteria

**Contents:**
- Executive summary
- Platform architecture (PWA on Netlify)
- Data models (Obsidian vault + Postgres + Vector DB)
- User interface specs (3 main screens)
- Generation pipeline
- Four toggle settings (Religiosity, Rhythm, Rhyming, Meaning)
- Iterative refinement system
- API endpoints
- Database schema overview
- Development phases 1-6
- Word processing features (post-MVP)
- Technical requirements
- Success metrics

---

### 3. IMPLEMENTATION: quick-start-guide.md
**Purpose:** Step-by-step development guide  
**Time:** 30 minutes  
**Read this:** When ready to start coding

Practical guide for developers:
- Tech stack summary
- Phase 1 checklist (infrastructure setup)
- Fragment import walkthrough
- Generation API pseudocode
- Mobile UI patterns
- Testing strategy
- Common pitfalls
- Deployment checklist

**Use this as your roadmap** through Phases 1-6.

---

### 4. TECHNICAL: fragment-processing-spec.md
**Purpose:** Detailed fragment import algorithm  
**Time:** 30 minutes  
**Read this:** Before building import script

Complete specification for processing the initial 65 fragments:
- CSV parsing
- Tag generation (LLM-based)
- Prosodic analysis (syllables, stress, rhyme)
- Embedding generation
- Database population
- Vector store setup
- Markdown file creation

**Includes:**
- Complete Python code examples
- CMUdict integration
- Syllable counting algorithms
- Stress pattern detection
- Example outputs
- Validation checklist

---

### 5. DATABASE: database-schema.sql
**Purpose:** Complete Postgres schema  
**Time:** 15 minutes (review)  
**Read this:** When setting up database

Ready-to-run SQL schema including:
- All tables (fragments, fragment_lines, sessions, verses, etc.)
- Indexes for performance
- Views for common queries
- Helper functions
- Sample queries
- Migration tracking

**Just run this file** in your Neon database.

---

### 6. DATA: fragment-corpus-cleaned.csv
**Purpose:** Initial fragment data to import  
**Time:** 5 minutes (review)  
**Read this:** Before running import

**65 lyric fragments** ready to process:
- ID, Fragment, Attribution, Rhythmic (Y/N), Context
- Clean headers, no blank rows
- Multi-line fragments preserved

**Feed this to your import script** from fragment-processing-spec.md.

---

## 🎯 Quick Navigation by Task

**"I'm starting the project"**
→ Read: PROJECT-SUMMARY.md → lyric-assistant-prd-final.md → quick-start-guide.md

**"I'm building fragment import"**
→ Read: fragment-processing-spec.md + database-schema.sql  
→ Use: fragment-corpus-cleaned.csv

**"I'm building the generation API"**
→ Read: PRD section "Core Functionality" + PRD section "Setting-Specific Prompt Language"  
→ Reference: quick-start-guide.md "Key Algorithms"

**"I'm building the mobile UI"**
→ Read: PRD section "User Interface Specification"  
→ Reference: quick-start-guide.md "Mobile UI Patterns"

**"I'm setting up the database"**
→ Run: database-schema.sql  
→ Reference: PRD section "Runtime Database Schema"

**"I need to understand the architecture"**
→ Read: PRD section "Platform Architecture"  
→ Reference: PROJECT-SUMMARY.md "Architecture Overview"

---

## 📱 Project Overview

**What:** Mobile-first PWA for AI-assisted lyric writing  
**Platform:** React + Netlify Functions + Neon DB + Upstash Vector  
**User:** Solo songwriter with personal fragment library  
**Core Loop:** Input verse → Generate variations → Rate → Iterate → Keep → Export

---

## 🏗️ Tech Stack

**Frontend:**
- React (mobile-first PWA)
- Tailwind CSS
- ProseMirror (text editing)

**Backend:**
- Netlify Functions (serverless)
- Neon (serverless Postgres)
- Upstash Vector (embeddings)
- GitHub (Obsidian vault)

**APIs:**
- Anthropic Claude (generation)
- OpenAI (embeddings)

**Prosody:**
- CMUdict (NLTK)
- Syllables library
- Pronouncing library

---

## 🎨 Key Features

1. **Four-way toggle settings** (Religiosity, Rhythm, Rhyming, Meaning)
2. **Prosodic matching** (syllables, stress patterns, rhyme)
3. **Iterative refinement** (learns from Best/Fine/Not the vibe ratings)
4. **Mobile-optimized workspace** (edit, combine, reorder verses)
5. **Obsidian integration** (portable markdown vault)
6. **Semantic + prosodic retrieval** (finds relevant fragments)

---

## 📊 Development Phases

**Phase 1: Foundation** (Weeks 1-4)
- Infrastructure setup
- Fragment import (65 fragments)

**Phase 2: Core Generation** (Weeks 5-8)
- Input UI + settings
- Generation API
- Review UI

**Phase 3: Iteration** (Weeks 9-10)
- Rating system
- Feedback incorporation

**Phase 4: Workspace** (Weeks 11-12)
- Keeper management
- Export functionality

**Phase 5: Mobile Polish** (Weeks 13-14)
- PWA features
- Performance optimization

**Phase 6: Launch** (Weeks 15-16)
- Testing
- Deployment

---

## ✅ Success Criteria

**Must Have:**
- All 65 fragments imported with prosody
- Generate 10 verses matching rhythm
- Iteration improves with feedback
- Mobile-optimized UX
- Export to completed song

**Quality Metrics:**
- Keeper rate >20%
- Iteration efficiency <3 rounds
- Generation time <8 seconds
- Mobile Lighthouse score >80

---

## 🚀 Getting Started

1. **Read PROJECT-SUMMARY.md** (10 min)
2. **Read lyric-assistant-prd-final.md** (60 min)
3. **Read quick-start-guide.md** (30 min)
4. **Set up infrastructure** (Phase 1, Day 1)
5. **Import fragments** (Phase 1, Days 2-3)
6. **Build generation core** (Phase 2)

---

## 📚 Additional Context

**Why This Project:**
Songwriter has hundreds of scattered lyric fragments. Wants AI to help generate variations while matching specific rhythms for melodies, maintaining personal voice, and working from phone.

**Unique Aspects:**
- Dual-type fragments (rhythmic vs semantic)
- Per-line prosodic analysis
- Iterative feedback loop
- Mobile-first design
- Portable markdown vault

**Technical Challenges:**
- Accurate prosody analysis (CMUdict)
- Multi-modal retrieval (semantic + prosodic)
- Prompt engineering for settings
- Mobile UX for complex interactions
- Real-time LLM streaming

---

## 🔧 Environment Variables Needed

```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...
UPSTASH_VECTOR_URL=https://...
UPSTASH_VECTOR_TOKEN=...
GITHUB_TOKEN=ghp_...
GITHUB_REPO=username/lyrics-vault
```

---

## 📁 Repository Structure

```
lyric-assistant/
├── frontend/              # React PWA
├── netlify/functions/     # Serverless API
├── scripts/               # Import & utility scripts
├── database/              # Schema & migrations
└── docs/                  # This documentation
```

---

## 🤝 Support

If you have questions:
1. Check the PRD first (most comprehensive)
2. Review quick-start-guide for practical tips
3. Consult fragment-processing-spec for import details
4. Reference database-schema.sql for queries

---

## 📝 Document Status

| Document | Status | Version | Last Updated |
|----------|--------|---------|--------------|
| PROJECT-SUMMARY.md | ✅ Final | 1.0 | Nov 10, 2025 |
| lyric-assistant-prd-final.md | ✅ Final | 2.0 | Nov 10, 2025 |
| quick-start-guide.md | ✅ Final | 1.0 | Nov 10, 2025 |
| fragment-processing-spec.md | ✅ Final | 1.0 | Nov 10, 2025 |
| database-schema.sql | ✅ Final | 1.0 | Nov 10, 2025 |
| fragment-corpus-cleaned.csv | ✅ Final | - | Nov 10, 2025 |

---

**Everything you need is here. Read the docs, follow the phases, build something great.**

**Good luck! 🎵**
