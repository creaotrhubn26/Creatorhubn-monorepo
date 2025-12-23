-- ============================================================================
-- Virtual Studio API Alignment - Missing Columns
-- Migration: 064_virtual_studio_api_columns.sql
-- Created: 2025-12-02
-- Description: Add missing columns to match frontend API types
-- ============================================================================

-- ============================================================================
-- PROJECTS - Additional columns for API compatibility
-- ============================================================================

ALTER TABLE virtual_studio_projects ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE virtual_studio_projects ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE virtual_studio_projects ADD COLUMN IF NOT EXISTS google_drive_file_id VARCHAR(255);
ALTER TABLE virtual_studio_projects ADD COLUMN IF NOT EXISTS google_drive_url TEXT;
ALTER TABLE virtual_studio_projects ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE virtual_studio_projects ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMP;
ALTER TABLE virtual_studio_projects ADD COLUMN IF NOT EXISTS node_count INTEGER DEFAULT 0;
ALTER TABLE virtual_studio_projects ADD COLUMN IF NOT EXISTS light_count INTEGER DEFAULT 0;

COMMENT ON COLUMN virtual_studio_projects.thumbnail_url IS 'Preview thumbnail URL for project card';
COMMENT ON COLUMN virtual_studio_projects.tags IS 'User-defined tags for organization';
COMMENT ON COLUMN virtual_studio_projects.google_drive_file_id IS 'Google Drive file ID for synced project JSON';
COMMENT ON COLUMN virtual_studio_projects.google_drive_url IS 'Direct link to project in Google Drive';
COMMENT ON COLUMN virtual_studio_projects.version IS 'Version number, incremented on each save';
COMMENT ON COLUMN virtual_studio_projects.last_opened_at IS 'Timestamp of last time project was opened';
COMMENT ON COLUMN virtual_studio_projects.node_count IS 'Denormalized count of 3D objects in project';
COMMENT ON COLUMN virtual_studio_projects.light_count IS 'Denormalized count of lights in project';

-- ============================================================================
-- SCENES - Additional columns for API compatibility
-- ============================================================================

ALTER TABLE virtual_studio_scenes ADD COLUMN IF NOT EXISTS camera_state JSONB;
ALTER TABLE virtual_studio_scenes ADD COLUMN IF NOT EXISTS environment_state JSONB;
ALTER TABLE virtual_studio_scenes ADD COLUMN IF NOT EXISTS animation_data JSONB;
ALTER TABLE virtual_studio_scenes ADD COLUMN IF NOT EXISTS render_settings JSONB;
ALTER TABLE virtual_studio_scenes ADD COLUMN IF NOT EXISTS node_count INTEGER DEFAULT 0;
ALTER TABLE virtual_studio_scenes ADD COLUMN IF NOT EXISTS light_count INTEGER DEFAULT 0;
ALTER TABLE virtual_studio_scenes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

COMMENT ON COLUMN virtual_studio_scenes.camera_state IS 'Camera position, rotation, FOV, DOF settings';
COMMENT ON COLUMN virtual_studio_scenes.environment_state IS 'HDRI, background, ambient settings';
COMMENT ON COLUMN virtual_studio_scenes.animation_data IS 'Animation tracks and clips for this scene';
COMMENT ON COLUMN virtual_studio_scenes.render_settings IS 'Full render configuration object';
COMMENT ON COLUMN virtual_studio_scenes.node_count IS 'Denormalized count of 3D objects in scene';
COMMENT ON COLUMN virtual_studio_scenes.light_count IS 'Denormalized count of lights in scene';
COMMENT ON COLUMN virtual_studio_scenes.is_active IS 'Whether scene is active/visible in project';

-- ============================================================================
-- USER PREFERENCES - Additional columns for API compatibility
-- ============================================================================

ALTER TABLE virtual_studio_user_preferences ADD COLUMN IF NOT EXISTS grid_size DECIMAL(5,2) DEFAULT 0.5;
ALTER TABLE virtual_studio_user_preferences ADD COLUMN IF NOT EXISTS show_gizmos BOOLEAN DEFAULT true;
ALTER TABLE virtual_studio_user_preferences ADD COLUMN IF NOT EXISTS motion_path_color VARCHAR(20) DEFAULT '#4fc3f7';
ALTER TABLE virtual_studio_user_preferences ADD COLUMN IF NOT EXISTS keyframe_color VARCHAR(20) DEFAULT '#ff9800';
ALTER TABLE virtual_studio_user_preferences ADD COLUMN IF NOT EXISTS default_upload_to_drive BOOLEAN DEFAULT true;
ALTER TABLE virtual_studio_user_preferences ADD COLUMN IF NOT EXISTS default_drive_folder_id VARCHAR(255);

COMMENT ON COLUMN virtual_studio_user_preferences.grid_size IS 'Grid cell size in meters';
COMMENT ON COLUMN virtual_studio_user_preferences.show_gizmos IS 'Show transform gizmos';
COMMENT ON COLUMN virtual_studio_user_preferences.motion_path_color IS 'Color for motion path visualization';
COMMENT ON COLUMN virtual_studio_user_preferences.keyframe_color IS 'Color for keyframe markers';
COMMENT ON COLUMN virtual_studio_user_preferences.default_upload_to_drive IS 'Default setting for Google Drive upload';
COMMENT ON COLUMN virtual_studio_user_preferences.default_drive_folder_id IS 'Default Google Drive folder for uploads';

