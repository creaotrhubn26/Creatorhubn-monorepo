-- ============================================================================
-- Virtual Studio Persistence Tables
-- Migration: 062_virtual_studio_persistence.sql
-- Created: 2025-12-02
-- Description: Database tables for Virtual Studio features persistence
-- ============================================================================

-- ============================================================================
-- EXPORT TEMPLATES
-- User-created export presets with scheduling configurations
-- ============================================================================

CREATE TABLE IF NOT EXISTS virtual_studio_export_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    
    -- Template Info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'Inventory',
    category VARCHAR(50) NOT NULL DEFAULT 'custom'
        CHECK (category IN ('social_media', 'client_delivery', 'portfolio', 'team_review', 'archival', 'quick_share', 'scheduled_release', 'custom')),
    
    -- Export Presets (array of preset IDs as JSON)
    presets JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Scheduling Configuration
    schedule_type VARCHAR(30) DEFAULT 'immediate'
        CHECK (schedule_type IN ('immediate', 'delay', 'specific_time', 'recurring')),
    delay_minutes INTEGER,
    specific_time VARCHAR(10), -- HH:mm format
    recurring_pattern VARCHAR(20)
        CHECK (recurring_pattern IS NULL OR recurring_pattern IN ('daily', 'weekly', 'monthly')),
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Export Options
    priority VARCHAR(20) DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    upload_to_drive BOOLEAN DEFAULT true,
    create_subfolder BOOLEAN DEFAULT true,
    subfolder_name VARCHAR(255),
    notify_on_complete BOOLEAN DEFAULT true,
    
    -- Metadata
    tags JSONB DEFAULT '[]'::jsonb,
    estimated_duration VARCHAR(50),
    recommended_for JSONB DEFAULT '[]'::jsonb,
    
    -- Stats
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_virtual_studio_export_templates_user_id ON virtual_studio_export_templates(user_id);
CREATE INDEX idx_virtual_studio_export_templates_category ON virtual_studio_export_templates(category);

-- ============================================================================
-- EXPORT JOBS
-- Export queue with status, progress, and results
-- ============================================================================

CREATE TABLE IF NOT EXISTS virtual_studio_export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    project_id UUID,
    scene_id UUID,
    template_id UUID REFERENCES virtual_studio_export_templates(id) ON DELETE SET NULL,
    
    -- Job Info
    name VARCHAR(255) NOT NULL,
    preset_id VARCHAR(100) NOT NULL,
    
    -- Export Configuration (JSON object)
    config JSONB NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'scheduled', 'queued', 'exporting', 'uploading', 'complete', 'failed', 'cancelled')),
    priority VARCHAR(20) DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Scheduling
    scheduled_time TIMESTAMP,
    delay_seconds INTEGER,
    
    -- Progress
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    current_frame INTEGER,
    total_frames INTEGER,
    
    -- Results
    output_url TEXT,
    output_format VARCHAR(20),
    file_size INTEGER,
    render_time INTEGER, -- Seconds
    
    -- Google Drive Upload
    upload_to_drive BOOLEAN DEFAULT false,
    drive_file_id VARCHAR(255),
    drive_web_view_link TEXT,
    drive_folder_id VARCHAR(255),
    
    -- Error Handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 2,
    
    -- Timestamps
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_virtual_studio_export_jobs_user_id ON virtual_studio_export_jobs(user_id);
CREATE INDEX idx_virtual_studio_export_jobs_status ON virtual_studio_export_jobs(status);
CREATE INDEX idx_virtual_studio_export_jobs_scheduled_time ON virtual_studio_export_jobs(scheduled_time);
CREATE INDEX idx_virtual_studio_export_jobs_project_id ON virtual_studio_export_jobs(project_id);

-- ============================================================================
-- ANIMATION CLIPS
-- Animation tracks, keyframes, and presets
-- ============================================================================

CREATE TABLE IF NOT EXISTS virtual_studio_animation_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    project_id UUID,
    scene_id UUID,
    
    -- Clip Info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration DECIMAL(10, 3) NOT NULL, -- Seconds
    
    -- Animation Data (array of AnimationTrack objects)
    tracks JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Playback Settings
    loop BOOLEAN DEFAULT false,
    speed DECIMAL(5, 2) DEFAULT 1.0,
    
    -- Template Flag
    is_template BOOLEAN DEFAULT false,
    template_category VARCHAR(50),
    
    -- Stats
    usage_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_virtual_studio_animation_clips_user_id ON virtual_studio_animation_clips(user_id);
CREATE INDEX idx_virtual_studio_animation_clips_project_id ON virtual_studio_animation_clips(project_id);
CREATE INDEX idx_virtual_studio_animation_clips_scene_id ON virtual_studio_animation_clips(scene_id);
CREATE INDEX idx_virtual_studio_animation_clips_is_template ON virtual_studio_animation_clips(is_template);

-- ============================================================================
-- USER PREFERENCES
-- UI settings, favorites, shortcuts, defaults
-- ============================================================================

CREATE TABLE IF NOT EXISTS virtual_studio_user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- UI Preferences
    theme VARCHAR(20) DEFAULT 'dark',
    grid_size DECIMAL(5, 2) DEFAULT 0.5,
    show_grid BOOLEAN DEFAULT true,
    show_helpers BOOLEAN DEFAULT true,
    show_gizmos BOOLEAN DEFAULT true,
    
    -- Keyboard Shortcuts (custom overrides)
    custom_shortcuts JSONB,
    
    -- Favorites (arrays of IDs)
    favorite_templates JSONB DEFAULT '[]'::jsonb,
    favorite_export_presets JSONB DEFAULT '[]'::jsonb,
    favorite_assets JSONB DEFAULT '[]'::jsonb,
    
    -- Recent Items (arrays of {id, name, lastOpened})
    recent_projects JSONB DEFAULT '[]'::jsonb,
    recent_scenes JSONB DEFAULT '[]'::jsonb,
    recent_exports JSONB DEFAULT '[]'::jsonb,
    
    -- Default Settings
    default_resolution VARCHAR(50) DEFAULT '1920x1080',
    default_quality VARCHAR(20) DEFAULT 'high',
    default_fps INTEGER DEFAULT 30,
    default_format VARCHAR(20) DEFAULT 'mp4',
    
    -- Export Defaults
    default_upload_to_drive BOOLEAN DEFAULT true,
    default_drive_folder_id VARCHAR(255),
    
    -- Animation Preferences
    show_motion_paths BOOLEAN DEFAULT true,
    motion_path_color VARCHAR(20) DEFAULT '#4fc3f7',
    keyframe_color VARCHAR(20) DEFAULT '#ff9800',
    
    -- Onboarding
    onboarding_completed BOOLEAN DEFAULT false,
    tutorials_completed JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_virtual_studio_user_preferences_user_id ON virtual_studio_user_preferences(user_id);

-- ============================================================================
-- EQUIPMENT GROUPS
-- Equipment grouping and linking configurations
-- ============================================================================

CREATE TABLE IF NOT EXISTS virtual_studio_equipment_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    scene_id UUID,
    
    -- Group Info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Group Data
    node_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_locked BOOLEAN DEFAULT false,
    
    -- Linked Equipment (move together)
    linked_nodes JSONB, -- Array of {primaryId, linkedIds}
    
    -- Group Transform
    position JSONB, -- {x, y, z}
    rotation JSONB, -- {x, y, z}
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_virtual_studio_equipment_groups_user_id ON virtual_studio_equipment_groups(user_id);
CREATE INDEX idx_virtual_studio_equipment_groups_scene_id ON virtual_studio_equipment_groups(scene_id);

-- ============================================================================
-- ACTION HISTORY
-- Undo/redo stack per session
-- ============================================================================

CREATE TABLE IF NOT EXISTS virtual_studio_action_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    scene_id UUID NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    
    -- Action Data
    action_type VARCHAR(50) NOT NULL,
    action_data JSONB NOT NULL,
    
    -- Position in stack
    stack_index INTEGER NOT NULL,
    is_undone BOOLEAN DEFAULT false,
    
    -- Timestamps
    executed_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_virtual_studio_action_history_user_id ON virtual_studio_action_history(user_id);
CREATE INDEX idx_virtual_studio_action_history_scene_id ON virtual_studio_action_history(scene_id);
CREATE INDEX idx_virtual_studio_action_history_session_id ON virtual_studio_action_history(session_id);

-- ============================================================================
-- SCENE SNAPSHOTS
-- Scene state snapshots for comparison
-- ============================================================================

CREATE TABLE IF NOT EXISTS virtual_studio_scene_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    scene_id UUID NOT NULL,
    
    -- Snapshot Info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    
    -- Scene State
    scene_state JSONB NOT NULL,
    camera_state JSONB,
    
    -- Metadata
    node_count INTEGER,
    light_count INTEGER,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_virtual_studio_scene_snapshots_user_id ON virtual_studio_scene_snapshots(user_id);
CREATE INDEX idx_virtual_studio_scene_snapshots_scene_id ON virtual_studio_scene_snapshots(scene_id);
CREATE INDEX idx_virtual_studio_scene_snapshots_created_at ON virtual_studio_scene_snapshots(created_at);

-- ============================================================================
-- Trigger for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_virtual_studio_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER trigger_virtual_studio_export_templates_updated_at
    BEFORE UPDATE ON virtual_studio_export_templates
    FOR EACH ROW EXECUTE FUNCTION update_virtual_studio_updated_at();

CREATE TRIGGER trigger_virtual_studio_export_jobs_updated_at
    BEFORE UPDATE ON virtual_studio_export_jobs
    FOR EACH ROW EXECUTE FUNCTION update_virtual_studio_updated_at();

CREATE TRIGGER trigger_virtual_studio_animation_clips_updated_at
    BEFORE UPDATE ON virtual_studio_animation_clips
    FOR EACH ROW EXECUTE FUNCTION update_virtual_studio_updated_at();

CREATE TRIGGER trigger_virtual_studio_user_preferences_updated_at
    BEFORE UPDATE ON virtual_studio_user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_virtual_studio_updated_at();

CREATE TRIGGER trigger_virtual_studio_equipment_groups_updated_at
    BEFORE UPDATE ON virtual_studio_equipment_groups
    FOR EACH ROW EXECUTE FUNCTION update_virtual_studio_updated_at();

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE virtual_studio_export_templates IS 'User-created export presets with scheduling configurations';
COMMENT ON TABLE virtual_studio_export_jobs IS 'Export queue with status tracking, progress, and results';
COMMENT ON TABLE virtual_studio_animation_clips IS 'Animation tracks, keyframes, and preset templates';
COMMENT ON TABLE virtual_studio_user_preferences IS 'User settings including favorites, shortcuts, and defaults';
COMMENT ON TABLE virtual_studio_equipment_groups IS 'Equipment grouping and physical linking configurations';
COMMENT ON TABLE virtual_studio_action_history IS 'Undo/redo action stack per editing session';
COMMENT ON TABLE virtual_studio_scene_snapshots IS 'Scene state snapshots for before/after comparison';

