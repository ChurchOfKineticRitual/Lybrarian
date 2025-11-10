# Claude.md - Context for AI Assistants

**Last Updated:** November 10, 2025
**Project:** Lybrarian - Lyric Writing Assistant

---

## 👤 About the Developer

**Experience Level:** Non-developer / Beginner
**Background:** Some GitHub experience over the past few months
**Learning Style:** Hands-on with direct instructions
**Goal:** Learn technical concepts while building this project

### Communication Preferences

✅ **DO:**
- Provide step-by-step instructions for ALL technical operations
- Explain what each command does and why we're using it
- Check latest documentation and best practices (post-training cutoff)
- Teach concepts as we go
- Ask clarifying questions before proceeding with assumptions
- Provide context for technical decisions

❌ **DON'T:**
- Assume familiarity with development workflows
- Skip explanation of terminal commands
- Use jargon without explanation
- Proceed with "standard practices" without verification

---

## 🎯 Project Overview

Building a **mobile-first Progressive Web App** for AI-assisted lyric writing.

### Core Technology Stack

**Frontend:**
- React (UI framework)
- Vite (build tool - modern alternative to Create React App)
- Tailwind CSS (styling)
- PWA (Progressive Web App capabilities)

**Backend:**
- Netlify Functions (serverless API)
- Neon (serverless PostgreSQL database)
- Upstash Vector (vector database for semantic search)

**AI Services:**
- Anthropic Claude API (lyric generation)
- OpenAI Embeddings API (semantic search)

**Data Storage:**
- GitHub repository (Obsidian vault for markdown files)
- PostgreSQL (metadata, prosody analysis)
- Vector database (semantic embeddings)

**Python Scripts:**
- Fragment import and processing
- Prosodic analysis (NLTK, CMUdict)
- Embedding generation

---

## 📋 Project Documentation

All project specifications are in this repository:

1. **PROJECT-SUMMARY.md** - High-level overview
2. **lyric-assistant-prd-final.md** - Complete product requirements (THE BIBLE)
3. **quick-start-guide.md** - Development roadmap
4. **fragment-processing-spec.md** - Fragment import algorithm
5. **database-schema.sql** - Complete database schema
6. **fragment-corpus-cleaned.csv** - Initial 65 lyric fragments

---

## 🔧 Development Environment

### Git Branch Strategy

**Active Feature Branch:** `claude/lyric-tool-setup-011CUzzqtNpDPY3HmTGFbXFD`

**Important:**
- All development happens on this branch
- Branch name MUST start with `claude/` and end with matching session ID
- Push with: `git push -u origin <branch-name>`
- Retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s) if network errors occur

### Platform

**Currently using:** Claude Code Web
**Environment:** Linux 4.4.0
**Working Directory:** `/home/user/Lybrarian`

**Note:** Claude Code Web has limited MCP server support compared to desktop version. Using built-in tools (Bash, Read, Edit, etc.) for all operations.

---

## 🎓 Learning Goals

As we build this project, I want to understand:

1. **Git Workflow**
   - Branching, committing, pushing
   - When and why to commit
   - How to write good commit messages

2. **Modern Web Development**
   - How React components work
   - What serverless functions do
   - Database operations
   - API integration

3. **Development Tools**
   - Terminal/command line usage
   - Package managers (npm)
   - Environment variables
   - Build processes

4. **Best Practices**
   - Code organization
   - Security (API keys, etc.)
   - Testing approaches
   - Deployment workflow

---

## 📝 Instructions for AI Assistants

### Always Check Latest Docs

Before implementing any feature or using any library:
1. Verify current best practices (post-January 2025)
2. Check for breaking changes in dependencies
3. Look up current API syntax
4. Confirm security recommendations

### Explain Terminal Commands

**Format for commands:**
```bash
command-to-run  # What this does and why
```

**Example:**
```bash
npm install react  # Installs React library into project dependencies
```

### Use Clear File Paths

Always use absolute paths when explaining:
- ❌ "in the config file"
- ✅ "in `/home/user/Lybrarian/netlify.toml`"

### Break Down Complex Tasks

For multi-step operations:
1. List all steps upfront
2. Explain what each step accomplishes
3. Show expected output/result
4. Verify success before proceeding

---

## 🚀 Development Phases

### Phase 1: Foundation (Current)
- [ ] Project structure setup
- [ ] Netlify configuration
- [ ] Database schema deployment
- [ ] Fragment import (65 fragments)
- [ ] Verify data in all systems

### Phase 2: Core Generation
- [ ] Input UI (toggles, settings)
- [ ] Generation API endpoint
- [ ] Review UI (display verses)

### Phase 3: Iteration
- [ ] Rating system
- [ ] Iterate with feedback
- [ ] Session history

### Phase 4: Workspace
- [ ] Keeper management
- [ ] Edit and combine verses
- [ ] Export to completed song

### Phase 5: Mobile Polish
- [ ] PWA setup
- [ ] Touch gestures
- [ ] Performance optimization

### Phase 6: Launch
- [ ] Testing
- [ ] Documentation
- [ ] Production deployment

---

## 🔐 Security Notes

**Environment Variables** (never commit these):
- `ANTHROPIC_API_KEY` - For Claude AI generation
- `OPENAI_API_KEY` - For embeddings
- `DATABASE_URL` - Neon PostgreSQL connection
- `UPSTASH_VECTOR_URL` - Vector database
- `UPSTASH_VECTOR_TOKEN` - Vector DB auth
- `GITHUB_TOKEN` - For vault repository access
- `GITHUB_REPO` - Format: `username/lyrics-vault`

These go in:
- `.env.local` (local development, gitignored)
- Netlify dashboard (production)

---

## 📚 Key Concepts to Understand

### Prosodic Analysis
Breaking down lyric rhythm:
- **Syllables:** Count per line (e.g., 8)
- **Stress pattern:** (e.g., "10101010" = alternating stressed/unstressed)
- **Rhyme sound:** Phonetic ending (e.g., "aɪt" for "night")

### Fragment Types
- **Rhythmic (Y):** Prosody matters - used for rhythm matching
- **Semantic (N):** Only meaning matters - used for themes/imagery

### Four-Way Toggles
- **Religiosity:** How strictly to use fragment phrases
- **Rhythm:** How closely to match syllable count
- **Rhyming:** Rhyme requirement level
- **Meaning:** How to interpret input text

### Iterative Refinement
1. Generate 10 verses
2. User rates: Best / Fine / Not the vibe
3. Iterate: Generate 10 more using "Best" and "Not the vibe" as feedback
4. Quality improves each iteration

---

## 🤝 Working Together

### When Starting a Session
1. Check this file for context
2. Review current phase progress
3. Ask what I'd like to work on
4. Create/update todo list

### When Implementing
1. Explain the plan before executing
2. Show commands before running
3. Verify success at each step
4. Commit logical chunks of work

### When Teaching
1. Use analogies for complex concepts
2. Link to documentation for deeper learning
3. Explain "why" not just "what"
4. Encourage questions

---

## 🎵 Project Vision

Jordan (the songwriter) wants to:
- Capture lyric fragments on his phone
- Use AI to explore variations while maintaining his voice
- Match specific rhythms for melodies he's composing
- Work fluidly without breaking creative flow

This app makes that possible.

---

## 📞 How to Get Help

If stuck:
1. Ask Claude to check latest documentation
2. Request explanation of errors in plain English
3. Ask for alternative approaches
4. Take it one small step at a time

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

**Remember: This is a learning journey. Questions are encouraged. We're building something great together!** 🎵
