-- Migration: Prototype Feedback System
-- Creates tables for the enhanced prototype testing feedback system
-- Includes: feedback items, attachments, context data, gamification

-- ============================================================================
-- Main Feedback Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS prototype_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    user_name VARCHAR(255),
    
    -- Feedback Content
    profession VARCHAR(100) NOT NULL DEFAULT 'other',
    dashboard_type VARCHAR(100),
    feedback_type VARCHAR(50) NOT NULL CHECK (feedback_type IN ('bug', 'feature', 'usability', 'general', 'ui_ux')),
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) DEFAULT 5,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    component VARCHAR(255),
    tags TEXT[] DEFAULT '{}',
    is_anonymous BOOLEAN DEFAULT false,
    
    -- Status
    status VARCHAR(50) NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
    admin_notes TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Feedback Attachments (screenshots, audio, video)
-- ============================================================================

CREATE TABLE IF NOT EXISTS prototype_feedback_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL REFERENCES prototype_feedback(id) ON DELETE CASCADE,
    
    attachment_type VARCHAR(50) NOT NULL CHECK (attachment_type IN ('screenshot', 'audio', 'video')),
    file_url TEXT,
    file_blob BYTEA,
    mime_type VARCHAR(100),
    file_size INTEGER,
    
    -- Media-specific metadata
    duration_ms INTEGER, -- for audio/video
    width INTEGER,       -- for screenshot/video
    height INTEGER,      -- for screenshot/video
    transcription TEXT,  -- for audio
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Targeted Element Data
-- ============================================================================

CREATE TABLE IF NOT EXISTS prototype_feedback_targeted_elements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL REFERENCES prototype_feedback(id) ON DELETE CASCADE,
    
    css_selector TEXT,
    xpath TEXT,
    tag_name VARCHAR(100),
    element_id VARCHAR(255),
    class_name TEXT,
    text_content TEXT,
    
    -- Position
    rect_top NUMERIC,
    rect_left NUMERIC,
    rect_width NUMERIC,
    rect_height NUMERIC,
    
    -- Computed Style
    style_color VARCHAR(100),
    style_background_color VARCHAR(100),
    style_font_size VARCHAR(50),
    style_font_family VARCHAR(255),
    
    -- Attributes as JSONB
    attributes JSONB DEFAULT '{}',
    parent_chain TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Browser Context Data
-- ============================================================================

CREATE TABLE IF NOT EXISTS prototype_feedback_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL REFERENCES prototype_feedback(id) ON DELETE CASCADE,
    
    -- Browser Info
    user_agent TEXT,
    platform VARCHAR(100),
    language VARCHAR(20),
    viewport_width INTEGER,
    viewport_height INTEGER,
    screen_width INTEGER,
    screen_height INTEGER,
    device_pixel_ratio NUMERIC,
    color_depth INTEGER,
    timezone VARCHAR(100),
    is_online BOOLEAN DEFAULT true,
    cookies_enabled BOOLEAN DEFAULT true,
    do_not_track BOOLEAN DEFAULT false,
    touch_supported BOOLEAN DEFAULT false,
    webgl_renderer TEXT,
    
    -- Performance Metrics
    load_time_ms INTEGER,
    dom_content_loaded_ms INTEGER,
    first_paint_ms NUMERIC,
    first_contentful_paint_ms NUMERIC,
    largest_contentful_paint_ms NUMERIC,
    time_to_interactive_ms INTEGER,
    memory_usage_bytes BIGINT,
    fps INTEGER,
    
    -- Session Info
    current_url TEXT,
    current_component VARCHAR(255),
    session_duration_ms INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Console Errors Captured
-- ============================================================================

CREATE TABLE IF NOT EXISTS prototype_feedback_console_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_id UUID NOT NULL REFERENCES prototype_feedback_context(id) ON DELETE CASCADE,
    
    message TEXT NOT NULL,
    source TEXT,
    line_number INTEGER,
    column_number INTEGER,
    stack_trace TEXT,
    error_timestamp TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- User Journey Steps
-- ============================================================================

CREATE TABLE IF NOT EXISTS prototype_feedback_journey_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_id UUID NOT NULL REFERENCES prototype_feedback_context(id) ON DELETE CASCADE,
    
    step_type VARCHAR(50) NOT NULL CHECK (step_type IN ('navigation', 'click', 'input', 'scroll', 'error')),
    target_element TEXT,
    value TEXT,
    url TEXT,
    step_timestamp TIMESTAMP WITH TIME ZONE,
    step_order INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Feedback Verification (automated tests, regression, user validation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS prototype_feedback_verification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL REFERENCES prototype_feedback(id) ON DELETE CASCADE,
    
    -- Automated Tests
    automated_tests_status VARCHAR(50) CHECK (automated_tests_status IN ('pending', 'running', 'passed', 'failed')),
    automated_tests_coverage NUMERIC,
    automated_tests_results JSONB DEFAULT '[]',
    
    -- Regression Tests
    regression_tests_status VARCHAR(50) CHECK (regression_tests_status IN ('pending', 'running', 'passed', 'failed')),
    regression_affected_components TEXT[] DEFAULT '{}',
    regression_test_results JSONB DEFAULT '[]',
    
    -- User Validation
    user_validation_status VARCHAR(50) CHECK (user_validation_status IN ('pending', 'sent', 'validated', 'failed')),
    validation_sent_at TIMESTAMP WITH TIME ZONE,
    validation_expires_at TIMESTAMP WITH TIME ZONE,
    validation_url TEXT,
    user_validated_at TIMESTAMP WITH TIME ZONE,
    user_confirmed BOOLEAN,
    user_comments TEXT,
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    
    -- System Health
    pre_deployment_health JSONB DEFAULT '{}',
    post_deployment_health JSONB DEFAULT '{}',
    health_check_results JSONB DEFAULT '[]',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Tester Gamification
-- ============================================================================

CREATE TABLE IF NOT EXISTS prototype_tester_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Stats
    total_feedback INTEGER DEFAULT 0,
    feedback_by_type JSONB DEFAULT '{}',
    feedback_by_status JSONB DEFAULT '{}',
    avg_rating NUMERIC DEFAULT 0,
    resolved_issues INTEGER DEFAULT 0,
    implemented_features INTEGER DEFAULT 0,
    testing_sessions INTEGER DEFAULT 0,
    total_testing_time_minutes INTEGER DEFAULT 0,
    components_tested_count INTEGER DEFAULT 0,
    consecutive_days INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    
    -- XP & Level
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id)
);

-- ============================================================================
-- Tester Badges
-- ============================================================================

CREATE TABLE IF NOT EXISTS prototype_tester_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    badge_id VARCHAR(100) NOT NULL,
    badge_name VARCHAR(255) NOT NULL,
    badge_description TEXT,
    badge_tier VARCHAR(50) CHECK (badge_tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
    badge_color VARCHAR(50),
    
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, badge_id)
);

-- ============================================================================
-- Feedback Drafts (for auto-save)
-- ============================================================================

CREATE TABLE IF NOT EXISTS prototype_feedback_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    draft_id VARCHAR(255) NOT NULL,
    
    data JSONB NOT NULL DEFAULT '{}',
    auto_saved BOOLEAN DEFAULT true,
    
    saved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, draft_id)
);

-- ============================================================================
-- Offline Queue (for sync when back online)
-- ============================================================================

CREATE TABLE IF NOT EXISTS prototype_feedback_offline_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    offline_id VARCHAR(255) NOT NULL,
    
    feedback_data JSONB NOT NULL,
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP WITH TIME ZONE,
    synced BOOLEAN DEFAULT false,
    
    UNIQUE(user_id, offline_id)
);

-- ============================================================================
-- Status Updates / Notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS prototype_feedback_status_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL REFERENCES prototype_feedback(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    message TEXT,
    seen BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_prototype_feedback_user_id ON prototype_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_prototype_feedback_status ON prototype_feedback(status);
CREATE INDEX IF NOT EXISTS idx_prototype_feedback_priority ON prototype_feedback(priority);
CREATE INDEX IF NOT EXISTS idx_prototype_feedback_type ON prototype_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_prototype_feedback_profession ON prototype_feedback(profession);
CREATE INDEX IF NOT EXISTS idx_prototype_feedback_created_at ON prototype_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prototype_feedback_component ON prototype_feedback(component);

CREATE INDEX IF NOT EXISTS idx_prototype_attachments_feedback_id ON prototype_feedback_attachments(feedback_id);
CREATE INDEX IF NOT EXISTS idx_prototype_targeted_feedback_id ON prototype_feedback_targeted_elements(feedback_id);
CREATE INDEX IF NOT EXISTS idx_prototype_context_feedback_id ON prototype_feedback_context(feedback_id);
CREATE INDEX IF NOT EXISTS idx_prototype_verification_feedback_id ON prototype_feedback_verification(feedback_id);

CREATE INDEX IF NOT EXISTS idx_prototype_tester_stats_user_id ON prototype_tester_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_prototype_tester_stats_xp ON prototype_tester_stats(xp DESC);
CREATE INDEX IF NOT EXISTS idx_prototype_tester_badges_user_id ON prototype_tester_badges(user_id);

CREATE INDEX IF NOT EXISTS idx_prototype_drafts_user_id ON prototype_feedback_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_prototype_offline_queue_user_id ON prototype_feedback_offline_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_prototype_offline_queue_synced ON prototype_feedback_offline_queue(synced);

CREATE INDEX IF NOT EXISTS idx_prototype_status_updates_feedback_id ON prototype_feedback_status_updates(feedback_id);
CREATE INDEX IF NOT EXISTS idx_prototype_status_updates_user_id ON prototype_feedback_status_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_prototype_status_updates_seen ON prototype_feedback_status_updates(seen);

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_prototype_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prototype_feedback_updated_at ON prototype_feedback;
CREATE TRIGGER trigger_prototype_feedback_updated_at
    BEFORE UPDATE ON prototype_feedback
    FOR EACH ROW EXECUTE FUNCTION update_prototype_feedback_updated_at();

DROP TRIGGER IF EXISTS trigger_prototype_tester_stats_updated_at ON prototype_tester_stats;
CREATE TRIGGER trigger_prototype_tester_stats_updated_at
    BEFORE UPDATE ON prototype_tester_stats
    FOR EACH ROW EXECUTE FUNCTION update_prototype_feedback_updated_at();

DROP TRIGGER IF EXISTS trigger_prototype_verification_updated_at ON prototype_feedback_verification;
CREATE TRIGGER trigger_prototype_verification_updated_at
    BEFORE UPDATE ON prototype_feedback_verification
    FOR EACH ROW EXECUTE FUNCTION update_prototype_feedback_updated_at();

-- ============================================================================
-- Function to update tester stats after feedback submission
-- ============================================================================

CREATE OR REPLACE FUNCTION update_tester_stats_on_feedback()
RETURNS TRIGGER AS $$
DECLARE
    current_xp INTEGER;
    new_xp INTEGER;
    xp_reward INTEGER;
BEGIN
    -- Calculate XP reward based on feedback type
    xp_reward := CASE 
        WHEN NEW.feedback_type = 'bug' THEN 15
        WHEN NEW.feedback_type = 'feature' THEN 12
        WHEN NEW.feedback_type = 'usability' THEN 12
        ELSE 10
    END;
    
    -- Add bonus for detailed description (200+ chars)
    IF LENGTH(NEW.description) > 200 THEN
        xp_reward := xp_reward + 5;
    END IF;
    
    -- Insert or update tester stats
    INSERT INTO prototype_tester_stats (user_id, total_feedback, xp, level)
    VALUES (NEW.user_id, 1, xp_reward, 1)
    ON CONFLICT (user_id) DO UPDATE SET
        total_feedback = prototype_tester_stats.total_feedback + 1,
        xp = prototype_tester_stats.xp + xp_reward,
        level = CASE 
            WHEN prototype_tester_stats.xp + xp_reward >= 10000 THEN 10
            WHEN prototype_tester_stats.xp + xp_reward >= 6000 THEN 9
            WHEN prototype_tester_stats.xp + xp_reward >= 4000 THEN 8
            WHEN prototype_tester_stats.xp + xp_reward >= 2500 THEN 7
            WHEN prototype_tester_stats.xp + xp_reward >= 1500 THEN 6
            WHEN prototype_tester_stats.xp + xp_reward >= 1000 THEN 5
            WHEN prototype_tester_stats.xp + xp_reward >= 600 THEN 4
            WHEN prototype_tester_stats.xp + xp_reward >= 300 THEN 3
            WHEN prototype_tester_stats.xp + xp_reward >= 100 THEN 2
            ELSE 1
        END,
        feedback_by_type = jsonb_set(
            COALESCE(prototype_tester_stats.feedback_by_type, '{}'),
            ARRAY[NEW.feedback_type],
            to_jsonb(COALESCE((prototype_tester_stats.feedback_by_type->>NEW.feedback_type)::integer, 0) + 1)
        ),
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tester_stats ON prototype_feedback;
CREATE TRIGGER trigger_update_tester_stats
    AFTER INSERT ON prototype_feedback
    FOR EACH ROW 
    WHEN (NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION update_tester_stats_on_feedback();

-- ============================================================================
-- Function to check and award badges
-- ============================================================================

CREATE OR REPLACE FUNCTION check_and_award_badges()
RETURNS TRIGGER AS $$
DECLARE
    badge_to_award RECORD;
BEGIN
    -- First feedback badge
    IF NEW.total_feedback = 1 THEN
        INSERT INTO prototype_tester_badges (user_id, badge_id, badge_name, badge_description, badge_tier, badge_color)
        VALUES (NEW.user_id, 'first_feedback', 'First Steps', 'Submit your first feedback', 'bronze', '#cd7f32')
        ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
    
    -- 10 feedback badge
    IF NEW.total_feedback = 10 THEN
        INSERT INTO prototype_tester_badges (user_id, badge_id, badge_name, badge_description, badge_tier, badge_color)
        VALUES (NEW.user_id, 'feedback_10', 'Getting Started', 'Submit 10 feedback items', 'bronze', '#cd7f32')
        ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
    
    -- 50 feedback badge
    IF NEW.total_feedback = 50 THEN
        INSERT INTO prototype_tester_badges (user_id, badge_id, badge_name, badge_description, badge_tier, badge_color)
        VALUES (NEW.user_id, 'feedback_50', 'Active Tester', 'Submit 50 feedback items', 'silver', '#c0c0c0')
        ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
    
    -- 100 feedback badge
    IF NEW.total_feedback = 100 THEN
        INSERT INTO prototype_tester_badges (user_id, badge_id, badge_name, badge_description, badge_tier, badge_color)
        VALUES (NEW.user_id, 'feedback_100', 'Feedback Master', 'Submit 100 feedback items', 'gold', '#ffd700')
        ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
    
    -- Level badges
    IF NEW.level >= 5 AND OLD.level < 5 THEN
        INSERT INTO prototype_tester_badges (user_id, badge_id, badge_name, badge_description, badge_tier, badge_color)
        VALUES (NEW.user_id, 'level_5', 'Expert', 'Reach Level 5', 'gold', '#ffd700')
        ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
    
    IF NEW.level >= 10 AND OLD.level < 10 THEN
        INSERT INTO prototype_tester_badges (user_id, badge_id, badge_name, badge_description, badge_tier, badge_color)
        VALUES (NEW.user_id, 'level_10', 'Founder', 'Reach Level 10', 'diamond', '#b9f2ff')
        ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_badges ON prototype_tester_stats;
CREATE TRIGGER trigger_check_badges
    AFTER UPDATE ON prototype_tester_stats
    FOR EACH ROW
    EXECUTE FUNCTION check_and_award_badges();

