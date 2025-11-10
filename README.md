# Lybrarian - AI-Powered Lyric Writing Assistant

A mobile-first Progressive Web App that helps songwriters generate new verses using AI, drawing from a personal collection of lyric fragments with semantic matching and prosodic analysis.

## 🎵 What It Does

- **Input:** Type a verse or rhythmic pattern on your phone
- **Generate:** AI creates 10 verse variations inspired by your fragment library
- **Iterate:** Rate verses and generate refined versions based on feedback
- **Keep:** Save favorites to workspace for editing and combining
- **Export:** Create completed songs

## 🏗️ Tech Stack

- **Frontend:** React + Vite + Tailwind CSS v4
- **Backend:** Netlify Functions (serverless)
- **Database:** Neon (PostgreSQL) + Upstash Vector
- **AI:** Anthropic Claude + OpenAI Embeddings
- **Data:** GitHub repository (Obsidian vault)

## 📁 Project Structure

```
Lybrarian/
├── frontend/              # React PWA
├── netlify/functions/     # Serverless API endpoints
├── scripts/               # Python import & analysis scripts
├── docs/                  # Complete project documentation
└── Claude.md              # Context for AI assistants
```

## 📚 Documentation

See `docs/` folder for complete specifications:

- **PROJECT-SUMMARY.md** - High-level overview (start here!)
- **lyric-assistant-prd-final.md** - Complete product requirements
- **quick-start-guide.md** - Development roadmap
- **fragment-processing-spec.md** - Fragment import algorithm
- **database-schema.sql** - Complete database schema
- **fragment-corpus-cleaned.csv** - Initial 65 lyric fragments

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ (for Netlify Functions)
- Python 3.9+ (for prosody analysis)
- Netlify account
- Neon database account
- Upstash Vector account
- Anthropic API key
- OpenAI API key

### Setup

1. **Install frontend dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Set up environment variables:**
   - Copy `.env.example` to `.env.local`
   - Add your API keys (never commit these!)

3. **Run locally:**
   ```bash
   npm run dev  # Frontend at localhost:5173
   netlify dev  # Full stack with functions
   ```

## 🔐 Environment Variables

Required (see `.env.example`):
- `ANTHROPIC_API_KEY` - Claude AI generation
- `OPENAI_API_KEY` - Embeddings for semantic search
- `DATABASE_URL` - Neon PostgreSQL connection
- `UPSTASH_VECTOR_URL` - Vector database
- `UPSTASH_VECTOR_TOKEN` - Vector DB authentication
- `GITHUB_TOKEN` - For Obsidian vault sync
- `GITHUB_REPO` - Format: `username/lyrics-vault`

## 📖 Development Phases

- [x] **Phase 1:** Foundation & infrastructure setup (current)
- [ ] **Phase 2:** Core generation (input UI + API)
- [ ] **Phase 3:** Iteration & feedback
- [ ] **Phase 4:** Workspace & export
- [ ] **Phase 5:** PWA polish
- [ ] **Phase 6:** Launch

## 🎯 Current Status

**Branch:** `claude/lyric-tool-setup-011CUzzqtNpDPY3HmTGFbXFD`

Working on Phase 1 - setting up project structure and dependencies.

## 📝 License

Private project - all rights reserved.

## 🤝 Contributing

This is a personal project. See `Claude.md` for AI assistant context.

---

**Built with Claude Code Web** | November 2025
