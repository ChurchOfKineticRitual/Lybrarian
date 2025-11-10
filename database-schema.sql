-- Lyric Writing Assistant Database Schema
-- PostgreSQL (Neon Serverless)
-- Version: 1.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- FRAGMENTS & PROSODY
-- ============================================

CREATE TABLE fragments (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Source & metadata
    source TEXT DEFAULT 'JC',  -- Author attribution
    rhythmic BOOLEAN NOT NULL,  -- Whether prosodic analysis applies
    fragment_type TEXT,  -- 'couplet', 'verse', 'quatrain', 'single-line', 'stanza'
    
    -- Content
    content TEXT NOT NULL,  -- Full text of fragment
    tags TEXT[] DEFAULT '{}',  -- Array of tag strings
    context_note TEXT DEFAULT '',  -- Interpretive notes
    
    -- Vector embedding
    embedding_id TEXT,  -- Reference to vector store
    
    -- Vault sync
    file_path TEXT NOT NULL,  -- Path in GitHub repo
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexing
    CONSTRAINT valid_fragment_type CHECK (
        fragment_type IS NULL OR 
        fragment_type IN ('single-line', 'couplet', 'quatrain', 'verse', 'stanza')
    )
);

-- Per-line prosodic data (only for rhythmic=true fragments)
CREATE TABLE fragment_lines (
    id SERIAL PRIMARY KEY,
    fragment_id TEXT NOT NULL REFERENCES fragments(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    
    -- Line content
    text TEXT NOT NULL,
    
    -- Prosody
    syllables INTEGER NOT NULL,
    stress_pattern TEXT,  -- Binary string like "10101010"
    end_rhyme_sound TEXT,  -- IPA phonetic representation
    meter TEXT,  -- Optional: 'iambic', 'trochaic', etc.
    
    -- Constraints
    CONSTRAINT unique_fragment_line UNIQUE (fragment_id, line_number),
    CONSTRAINT positive_line_number CHECK (line_number > 0),
    CONSTRAINT positive_syllables CHECK (syllables > 0)
);

-- Indexes for fragments
CREATE INDEX idx_fragments_rhythmic ON fragments(rhythmic);
CREATE INDEX idx_fragments_source ON fragments(source);
CREATE INDEX idx_fragments_type ON fragments(fragment_type);
CREATE INDEX idx_fragments_tags ON fragments USING GIN(tags);  -- GIN index for array search
CREATE INDEX idx_fragments_created ON fragments(created_at DESC);

-- Indexes for fragment_lines
CREATE INDEX idx_fragment_lines_fragment ON fragment_lines(fragment_id);
CREATE INDEX idx_fragment_lines_syllables ON fragment_lines(syllables);
CREATE INDEX idx_fragment_lines_rhyme ON fragment_lines(end_rhyme_sound);

-- ============================================
-- COMPLETED LYRICS
-- ============================================

CREATE TABLE completed_lyrics (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Content
    content TEXT NOT NULL,  -- Full lyric text
    tags TEXT[] DEFAULT '{}',
    
    -- Style reference
    use_for_style BOOLEAN DEFAULT false,  -- Include in style corpus for generation
    
    -- Lineage
    source_project TEXT,  -- Optional reference to project
    
    -- Vault sync
    file_path TEXT NOT NULL,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_lyrics_style ON completed_lyrics(use_for_style);
CREATE INDEX idx_lyrics_created ON completed_lyrics(created_at DESC);
CREATE INDEX idx_lyrics_project ON completed_lyrics(source_project);
CREATE INDEX idx_lyrics_tags ON completed_lyrics USING GIN(tags);

-- ============================================
-- PROJECTS & WORKSPACES
-- ============================================

CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Workspace
    workspace_content TEXT DEFAULT '',  -- Current keeper verses (markdown)
    
    -- Vault sync
    file_path TEXT NOT NULL,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_projects_modified ON projects(last_modified DESC);

-- ============================================
-- GENERATION SESSIONS
-- ============================================

CREATE TABLE generation_sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Input
    input_verse TEXT NOT NULL,
    
    -- Settings
    setting_religiosity TEXT NOT NULL CHECK (setting_religiosity IN ('no', 'ish', 'yes')),
    setting_rhythm TEXT NOT NULL CHECK (setting_rhythm IN ('no', 'ish', 'yes')),
    setting_rhyming TEXT NOT NULL CHECK (setting_rhyming IN ('no', 'ish', 'yes')),
    setting_meaning TEXT NOT NULL CHECK (setting_meaning IN ('no', 'ish', 'yes')),
    theme_selection TEXT NOT NULL,
    steer_text TEXT DEFAULT '',
    
    -- Metadata
    iteration_count INTEGER DEFAULT 1 CHECK (iteration_count > 0)
);

CREATE INDEX idx_sessions_project ON generation_sessions(project_id);
CREATE INDEX idx_sessions_created ON generation_sessions(created_at DESC);

-- ============================================
-- GENERATED VERSES
-- ============================================

CREATE TABLE generated_verses (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES generation_sessions(id) ON DELETE CASCADE,
    iteration_number INTEGER NOT NULL CHECK (iteration_number > 0),
    
    -- Content
    verse_content TEXT NOT NULL,
    
    -- User feedback
    rating TEXT DEFAULT 'fine' CHECK (rating IN ('best', 'fine', 'not_the_vibe')),
    is_keeper BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_session_iteration_index UNIQUE (session_id, iteration_number, id)
);

CREATE INDEX idx_verses_session ON generated_verses(session_id);
CREATE INDEX idx_verses_iteration ON generated_verses(iteration_number);
CREATE INDEX idx_verses_rating ON generated_verses(rating);
CREATE INDEX idx_verses_keeper ON generated_verses(is_keeper);
CREATE INDEX idx_verses_created ON generated_verses(created_at DESC);

-- ============================================
-- USERS (for multi-user support)
-- ============================================

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    
    -- Settings
    default_settings JSONB DEFAULT '{
        "religiosity": "ish",
        "rhythm": "yes",
        "rhyming": "ish",
        "meaning": "yes",
        "theme": "Let me tell you a story"
    }'::jsonb
);

CREATE INDEX idx_users_email ON users(email);

-- Add user_id to relevant tables (for multi-user support)
ALTER TABLE fragments ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE completed_lyrics ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE projects ADD COLUMN user_id TEXT REFERENCES users(id);

CREATE INDEX idx_fragments_user ON fragments(user_id);
CREATE INDEX idx_lyrics_user ON completed_lyrics(user_id);
CREATE INDEX idx_projects_user ON projects(user_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Update last_modified timestamp for projects
CREATE OR REPLACE FUNCTION update_project_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_modified = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_modified
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION update_project_modified();

-- ============================================
-- VIEWS
-- ============================================

-- View: Fragments with prosody summary
CREATE VIEW fragments_with_prosody AS
SELECT 
    f.id,
    f.source,
    f.rhythmic,
    f.fragment_type,
    f.content,
    f.tags,
    f.context_note,
    f.created_at,
    COUNT(fl.id) as line_count,
    ARRAY_AGG(fl.syllables ORDER BY fl.line_number) as syllables_per_line,
    ARRAY_AGG(fl.stress_pattern ORDER BY fl.line_number) as stress_patterns,
    ARRAY_AGG(fl.end_rhyme_sound ORDER BY fl.line_number) as rhyme_sounds
FROM fragments f
LEFT JOIN fragment_lines fl ON f.id = fl.fragment_id
GROUP BY f.id, f.source, f.rhythmic, f.fragment_type, f.content, 
         f.tags, f.context_note, f.created_at;

-- View: Session with verse statistics
CREATE VIEW sessions_with_stats AS
SELECT 
    s.id,
    s.project_id,
    s.created_at,
    s.input_verse,
    s.setting_religiosity,
    s.setting_rhythm,
    s.setting_rhyming,
    s.setting_meaning,
    s.theme_selection,
    s.steer_text,
    s.iteration_count,
    COUNT(gv.id) as total_verses,
    COUNT(CASE WHEN gv.rating = 'best' THEN 1 END) as best_count,
    COUNT(CASE WHEN gv.rating = 'fine' THEN 1 END) as fine_count,
    COUNT(CASE WHEN gv.rating = 'not_the_vibe' THEN 1 END) as not_vibe_count,
    COUNT(CASE WHEN gv.is_keeper THEN 1 END) as keeper_count
FROM generation_sessions s
LEFT JOIN generated_verses gv ON s.id = gv.session_id
GROUP BY s.id, s.project_id, s.created_at, s.input_verse,
         s.setting_religiosity, s.setting_rhythm, s.setting_rhyming,
         s.setting_meaning, s.theme_selection, s.steer_text, s.iteration_count;

-- View: Projects with session count
CREATE VIEW projects_with_activity AS
SELECT 
    p.id,
    p.name,
    p.created_at,
    p.last_modified,
    COUNT(DISTINCT s.id) as session_count,
    SUM(CASE WHEN gv.is_keeper THEN 1 ELSE 0 END) as total_keepers
FROM projects p
LEFT JOIN generation_sessions s ON p.id = s.project_id
LEFT JOIN generated_verses gv ON s.id = gv.session_id
GROUP BY p.id, p.name, p.created_at, p.last_modified;

-- ============================================
-- SAMPLE QUERIES
-- ============================================

-- Find fragments by tag
-- SELECT * FROM fragments WHERE 'urban' = ANY(tags);

-- Find rhythmic fragments with 8 syllables
-- SELECT f.*, fl.syllables 
-- FROM fragments f
-- JOIN fragment_lines fl ON f.id = fl.fragment_id
-- WHERE f.rhythmic = true AND fl.syllables = 8;

-- Find fragments with rhyme sound
-- SELECT f.*, fl.end_rhyme_sound
-- FROM fragments f
-- JOIN fragment_lines fl ON f.id = fl.fragment_id
-- WHERE fl.end_rhyme_sound LIKE '%AY%';

-- Get all verses from a session with ratings
-- SELECT verse_content, rating, is_keeper
-- FROM generated_verses
-- WHERE session_id = 'sess-001'
-- ORDER BY iteration_number, id;

-- Get best and worst verses from session (for iteration)
-- SELECT verse_content, rating
-- FROM generated_verses
-- WHERE session_id = 'sess-001' 
--   AND rating IN ('best', 'not_the_vibe')
-- ORDER BY rating DESC;

-- Get all completed lyrics for style reference
-- SELECT title, content
-- FROM completed_lyrics
-- WHERE use_for_style = true
-- ORDER BY created_at DESC;

-- Get project workspace with keeper count
-- SELECT p.*, pvw.keeper_count
-- FROM projects p
-- JOIN projects_with_activity pvw ON p.id = pvw.id
-- WHERE p.id = 'proj-001';

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default user (for single-user MVP)
INSERT INTO users (id, email, created_at)
VALUES ('user-jc', 'jordan@example.com', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PERMISSIONS (Neon)
-- ============================================

-- Grant permissions to application role
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_role;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_role;

-- ============================================
-- CLEANUP FUNCTIONS (for development)
-- ============================================

-- Function to reset all data (DANGER: only for dev)
CREATE OR REPLACE FUNCTION reset_all_data()
RETURNS VOID AS $$
BEGIN
    TRUNCATE TABLE generated_verses CASCADE;
    TRUNCATE TABLE generation_sessions CASCADE;
    TRUNCATE TABLE projects CASCADE;
    TRUNCATE TABLE completed_lyrics CASCADE;
    TRUNCATE TABLE fragment_lines CASCADE;
    TRUNCATE TABLE fragments CASCADE;
    -- Don't truncate users in production
END;
$$ LANGUAGE plpgsql;

-- Function to delete a project and all related data
CREATE OR REPLACE FUNCTION delete_project_cascade(project_id_param TEXT)
RETURNS VOID AS $$
BEGIN
    DELETE FROM generated_verses 
    WHERE session_id IN (
        SELECT id FROM generation_sessions WHERE project_id = project_id_param
    );
    
    DELETE FROM generation_sessions WHERE project_id = project_id_param;
    DELETE FROM projects WHERE id = project_id_param;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MIGRATIONS TRACKING
-- ============================================

CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description)
VALUES (1, 'Initial schema creation');

-- ============================================
-- END OF SCHEMA
-- ============================================
