-- ============================================================================
-- Virtual Studio Projects and Scenes Tables
-- Migration: 063_virtual_studio_projects.sql
-- Created: 2025-12-02
-- Description: Database tables for project and scene management
-- ============================================================================

-- ============================================================================
-- PROJECTS
-- Main project container for Virtual Studio
-- ============================================================================

CREATE TABLE IF NOT EXISTS virtual_studio_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    
    -- Project Info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    
    -- Project Type
    project_type VARCHAR(50) DEFAULT 'photography'
        CHECK (project_type IN ('photography', 'videography', 'commercial', 'wedding', 'event', 'product', 'other')),
    
    -- Tags (JSON array of strings)
    tags JSONB DEFAULT '[]'::jsonb,
    
    -- Status
    status VARCHAR(30) DEFAULT 'active'
        CHECK (status IN ('active', 'draft', 'archived', 'shared')),
    is_favorite BOOLEAN DEFAULT false,
    
    -- Google Drive Integration
    google_drive_folder_id VARCHAR(255),
    google_drive_file_id VARCHAR(255),
    google_drive_url TEXT,
    
    -- Scene Count (denormalized for performance)
    scene_count INTEGER DEFAULT 0,
    
    -- Versioning
    version INTEGER DEFAULT 1,
    
    -- Timestamps
    last_opened_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_virtual_studio_projects_user_id ON virtual_studio_projects(user_id);
CREATE INDEX idx_virtual_studio_projects_status ON virtual_studio_projects(status);
CREATE INDEX idx_virtual_studio_projects_project_type ON virtual_studio_projects(project_type);
CREATE INDEX idx_virtual_studio_projects_updated_at ON virtual_studio_projects(updated_at);
CREATE INDEX idx_virtual_studio_projects_is_favorite ON virtual_studio_projects(is_favorite);

-- ============================================================================
-- SCENES
-- Individual scenes within a project
-- ============================================================================

CREATE TABLE IF NOT EXISTS virtual_studio_scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES virtual_studio_projects(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    
    -- Scene Info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    
    -- Scene Data
    scene_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    camera_state JSONB,
    environment_state JSONB,
    
    -- Animation Data
    animation_data JSONB,
    
    -- Rendering Settings
    render_settings JSONB,
    
    -- Stats
    node_count INTEGER DEFAULT 0,
    light_count INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Versioning
    version INTEGER DEFAULT 1,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_virtual_studio_scenes_project_id ON virtual_studio_scenes(project_id);
CREATE INDEX idx_virtual_studio_scenes_user_id ON virtual_studio_scenes(user_id);
CREATE INDEX idx_virtual_studio_scenes_updated_at ON virtual_studio_scenes(updated_at);

-- ============================================================================
-- ADD GEAR PRESETS TO USER PREFERENCES
-- ============================================================================

ALTER TABLE virtual_studio_user_preferences 
ADD COLUMN IF NOT EXISTS gear_presets JSONB DEFAULT '[]'::jsonb;

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

CREATE TRIGGER trigger_virtual_studio_projects_updated_at
    BEFORE UPDATE ON virtual_studio_projects
    FOR EACH ROW EXECUTE FUNCTION update_virtual_studio_updated_at();

CREATE TRIGGER trigger_virtual_studio_scenes_updated_at
    BEFORE UPDATE ON virtual_studio_scenes
    FOR EACH ROW EXECUTE FUNCTION update_virtual_studio_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE virtual_studio_projects IS 'Main project container for Virtual Studio with Google Drive integration';
COMMENT ON TABLE virtual_studio_scenes IS 'Individual scenes within a project containing 3D scene data and settings';
COMMENT ON COLUMN virtual_studio_user_preferences.gear_presets IS 'Saved gear/lighting presets for quick scene setup';

