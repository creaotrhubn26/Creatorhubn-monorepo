-- Migration: Prototype Feedback System (Fixed for VARCHAR IDs)
-- Creates tables for the enhanced prototype testing feedback system

-- ============================================================================
-- Feedback Attachments (screenshots, audio, video)
-- ============================================================================

CREATE TABLE IF NOT EXISTS prototype_feedback_attachments (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    feedback_id VARCHAR(255) NOT NULL,
    
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
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    feedback_id VARCHAR(255) NOT NULL,
    
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
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    feedback_id VARCHAR(255) NOT NULL,
    
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
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    context_id VARCHAR(255) NOT NULL,
    
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
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    context_id VARCHAR(255) NOT NULL,
    
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
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    feedback_id VARCHAR(255) NOT NULL,
    
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
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(255) NOT NULL,
    
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
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(255) NOT NULL,
    
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
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(255) NOT NULL,
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
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(255) NOT NULL,
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
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    feedback_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    message TEXT,
    seen BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

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

CREATE INDEX IF NOT EXISTS idx_prototype_console_errors_context ON prototype_feedback_console_errors(context_id);
CREATE INDEX IF NOT EXISTS idx_prototype_journey_steps_context ON prototype_feedback_journey_steps(context_id);

-- ============================================================================
-- Add missing columns to existing prototype_feedback table
-- ============================================================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prototype_feedback' AND column_name = 'resolved_by') THEN
        ALTER TABLE prototype_feedback ADD COLUMN resolved_by VARCHAR(255);
    END IF;
END $$;

