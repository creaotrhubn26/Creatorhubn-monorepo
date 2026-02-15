-- Word Bank Database Schema
-- Stores learned vocabulary for screenplay analysis

-- Main word bank table
CREATE TABLE IF NOT EXISTS wordbank_words (
    id SERIAL PRIMARY KEY,
    word VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'both', -- 'en', 'no', 'both'
    weight DECIMAL(3,2) NOT NULL DEFAULT 0.7,
    is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
    is_approved BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    usage_count INTEGER DEFAULT 0,
    
    -- Prevent duplicate words in same category
    CONSTRAINT unique_word_category UNIQUE (word, category)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_wordbank_category ON wordbank_words(category);
CREATE INDEX IF NOT EXISTS idx_wordbank_language ON wordbank_words(language);
CREATE INDEX IF NOT EXISTS idx_wordbank_approved ON wordbank_words(is_approved);
CREATE INDEX IF NOT EXISTS idx_wordbank_word ON wordbank_words(word);

-- Word usage tracking (for analytics)
CREATE TABLE IF NOT EXISTS wordbank_usage (
    id SERIAL PRIMARY KEY,
    word_id INTEGER REFERENCES wordbank_words(id) ON DELETE CASCADE,
    project_id UUID,
    user_id UUID REFERENCES users(id),
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scene_context TEXT, -- First 200 chars of scene for context
    was_correct BOOLEAN -- NULL = not yet rated, TRUE = correct, FALSE = wrong
);

CREATE INDEX IF NOT EXISTS idx_wordbank_usage_word ON wordbank_usage(word_id);
CREATE INDEX IF NOT EXISTS idx_wordbank_usage_project ON wordbank_usage(project_id);

-- Feedback history for learning analysis
CREATE TABLE IF NOT EXISTS wordbank_feedback (
    id SERIAL PRIMARY KEY,
    project_id UUID,
    user_id UUID REFERENCES users(id),
    scene_text TEXT NOT NULL,
    detected_purpose VARCHAR(50) NOT NULL,
    correct_purpose VARCHAR(50) NOT NULL,
    learned_words TEXT[], -- Array of words that were added
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wordbank_feedback_user ON wordbank_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_wordbank_feedback_purposes ON wordbank_feedback(detected_purpose, correct_purpose);

-- Project-specific word bank overrides
CREATE TABLE IF NOT EXISTS wordbank_project_words (
    id SERIAL PRIMARY KEY,
    project_id UUID NOT NULL,
    word VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'both',
    weight DECIMAL(3,2) NOT NULL DEFAULT 0.7,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_project_word_category UNIQUE (project_id, word, category)
);

CREATE INDEX IF NOT EXISTS idx_wordbank_project ON wordbank_project_words(project_id);

-- Word suggestions (pending admin approval)
CREATE TABLE IF NOT EXISTS wordbank_suggestions (
    id SERIAL PRIMARY KEY,
    word VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'both',
    suggested_weight DECIMAL(3,2) NOT NULL DEFAULT 0.7,
    reason TEXT,
    suggested_by UUID REFERENCES users(id),
    suggested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_wordbank_suggestions_status ON wordbank_suggestions(status);

-- View for getting all active words (global + approved)
CREATE OR REPLACE VIEW wordbank_active_words AS
SELECT 
    id, word, category, language, weight, 
    is_builtin, created_at, usage_count
FROM wordbank_words
WHERE is_approved = TRUE;

-- Function to increment word usage
CREATE OR REPLACE FUNCTION increment_word_usage(word_text VARCHAR, category_text VARCHAR)
RETURNS VOID AS $$
BEGIN
    UPDATE wordbank_words 
    SET usage_count = usage_count + 1,
        updated_at = NOW()
    WHERE word = word_text AND category = category_text;
END;
$$ LANGUAGE plpgsql;

-- Function to add word with duplicate check
CREATE OR REPLACE FUNCTION add_word_safe(
    p_word VARCHAR,
    p_category VARCHAR,
    p_language VARCHAR DEFAULT 'both',
    p_weight DECIMAL DEFAULT 0.7,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, word_id INTEGER, message VARCHAR) AS $$
DECLARE
    v_word_id INTEGER;
BEGIN
    -- Check if exists
    SELECT id INTO v_word_id 
    FROM wordbank_words 
    WHERE word = LOWER(TRIM(p_word)) AND category = p_category;
    
    IF v_word_id IS NOT NULL THEN
        RETURN QUERY SELECT FALSE, v_word_id, 'Word already exists'::VARCHAR;
        RETURN;
    END IF;
    
    -- Insert new word
    INSERT INTO wordbank_words (word, category, language, weight, created_by, is_approved)
    VALUES (LOWER(TRIM(p_word)), p_category, p_language, p_weight, p_user_id, TRUE)
    RETURNING id INTO v_word_id;
    
    RETURN QUERY SELECT TRUE, v_word_id, 'Word added successfully'::VARCHAR;
END;
$$ LANGUAGE plpgsql;

-- Analytics: Get most common misclassifications
CREATE OR REPLACE VIEW wordbank_misclassification_stats AS
SELECT 
    detected_purpose,
    correct_purpose,
    COUNT(*) as occurrence_count,
    array_agg(DISTINCT unnest(learned_words)) as commonly_learned_words
FROM wordbank_feedback
WHERE detected_purpose != correct_purpose
GROUP BY detected_purpose, correct_purpose
ORDER BY occurrence_count DESC;

-- Insert category metadata
CREATE TABLE IF NOT EXISTS wordbank_categories (
    id VARCHAR(50) PRIMARY KEY,
    name_en VARCHAR(100) NOT NULL,
    name_no VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0
);

INSERT INTO wordbank_categories (id, name_en, name_no, description, sort_order) VALUES
('conflict', 'Conflict', 'Konflikt', 'Scenes with confrontation, arguments, or physical/verbal disputes', 1),
('climax', 'Climax', 'Klimaks', 'Peak dramatic moments, revelations, and turning points', 2),
('exposition', 'Exposition', 'Eksposisjon', 'Scene setup, introductions, and world-building', 3),
('resolution', 'Resolution', 'Oppløsning', 'Conclusions, peace, closure, and endings', 4),
('rising_action', 'Rising Action', 'Stigende handling', 'Building tension, complications, and increasing stakes', 5),
('falling_action', 'Falling Action', 'Fallende handling', 'Aftermath, consequences, and winding down', 6),
('transition', 'Transition', 'Overgang', 'Scene changes, time jumps, and location shifts', 7),
('character_development', 'Character Development', 'Karakterutvikling', 'Personal growth, change, and inner journey', 8),
('subplot', 'Subplot', 'Sidehandling', 'Secondary storylines and side character arcs', 9),
('romance', 'Romance', 'Romantikk', 'Romantic relationships and love stories', 10),
('comedy', 'Comedy', 'Komedie', 'Humorous and light-hearted scenes', 11),
('horror', 'Horror', 'Skrekk', 'Frightening and suspenseful horror elements', 12),
('thriller', 'Thriller', 'Thriller', 'High-tension suspense and excitement', 13),
('action', 'Action', 'Action', 'Physical action sequences and stunts', 14),
('drama', 'Drama', 'Drama', 'Emotional and serious dramatic scenes', 15),
('mystery', 'Mystery', 'Mysterium', 'Puzzles, investigations, and secrets', 16)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE wordbank_words IS 'Main vocabulary database for screenplay scene purpose detection';
COMMENT ON TABLE wordbank_feedback IS 'User feedback when correcting scene purpose detection - used for learning';
COMMENT ON TABLE wordbank_project_words IS 'Project-specific vocabulary overrides';
COMMENT ON TABLE wordbank_suggestions IS 'User-submitted words pending admin approval';
