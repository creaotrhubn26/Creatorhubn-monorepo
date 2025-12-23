-- ============================================================================
-- Migration: 067_virtual_studio_user_data.sql
-- Description: Virtual Studio User Data - Replace localStorage with DB
-- 
-- Tables:
-- - virtual_studio_guide_settings: Distance/angle/composition guide settings
-- - virtual_studio_light_presets: Saved lighting presets
-- - virtual_studio_share_links: Client sharing links
-- - virtual_studio_client_comments: Client feedback comments
-- - virtual_studio_client_approvals: Client approval status
-- - virtual_studio_scene_snapshots: Before/after scene snapshots
-- - virtual_studio_custom_templates: User-created scene templates
-- - virtual_studio_auto_save: Auto-saved scene data
-- - virtual_studio_device_config: Device-specific settings
-- - virtual_studio_persona_journey: User journey tracking
-- - virtual_studio_comparison_settings: Scene comparison preferences
-- ============================================================================

-- ============================================================================
-- Studio Guide Settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS virtual_studio_guide_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  show_distance_guides BOOLEAN DEFAULT true,
  distance_unit TEXT DEFAULT 'meters',
  show_angle_guides BOOLEAN DEFAULT true,
  show_light_angle BOOLEAN DEFAULT true,
  show_camera_angle BOOLEAN DEFAULT true,
  show_composition_guides BOOLEAN DEFAULT false,
  composition_type TEXT DEFAULT 'rule_of_thirds',
  show_height_guides BOOLEAN DEFAULT true,
  show_safety_guides BOOLEAN DEFAULT false,
  show_dof_preview BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS vs_guide_settings_user_id_idx ON virtual_studio_guide_settings(user_id);

-- ============================================================================
-- Light Presets
-- ============================================================================
CREATE TABLE IF NOT EXISTS virtual_studio_light_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'custom',
  lights JSONB DEFAULT '[]'::jsonb,
  thumbnail TEXT,
  is_public BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS vs_light_presets_user_id_idx ON virtual_studio_light_presets(user_id);
CREATE INDEX IF NOT EXISTS vs_light_presets_category_idx ON virtual_studio_light_presets(category);

-- ============================================================================
-- Client Share Links
-- ============================================================================
CREATE TABLE IF NOT EXISTS virtual_studio_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID,
  
  token TEXT NOT NULL UNIQUE,
  client_name TEXT,
  client_email TEXT,
  
  can_comment BOOLEAN DEFAULT true,
  can_approve BOOLEAN DEFAULT true,
  can_download BOOLEAN DEFAULT false,
  
  password TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  max_views INTEGER,
  
  is_active BOOLEAN DEFAULT true,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  
  scene_data JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS vs_share_links_user_id_idx ON virtual_studio_share_links(user_id);
CREATE INDEX IF NOT EXISTS vs_share_links_token_idx ON virtual_studio_share_links(token);
CREATE INDEX IF NOT EXISTS vs_share_links_project_id_idx ON virtual_studio_share_links(project_id);

-- ============================================================================
-- Client Comments
-- ============================================================================
CREATE TABLE IF NOT EXISTS virtual_studio_client_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID NOT NULL REFERENCES virtual_studio_share_links(id) ON DELETE CASCADE,
  
  author_name TEXT NOT NULL,
  author_email TEXT,
  content TEXT NOT NULL,
  
  position JSONB,
  camera_view JSONB,
  
  is_resolved BOOLEAN DEFAULT false,
  resolved_by TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  parent_id UUID,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS vs_client_comments_share_link_idx ON virtual_studio_client_comments(share_link_id);
CREATE INDEX IF NOT EXISTS vs_client_comments_parent_idx ON virtual_studio_client_comments(parent_id);

-- ============================================================================
-- Client Approvals
-- ============================================================================
CREATE TABLE IF NOT EXISTS virtual_studio_client_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID NOT NULL REFERENCES virtual_studio_share_links(id) ON DELETE CASCADE,
  
  client_name TEXT NOT NULL,
  client_email TEXT,
  
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  
  approved_items JSONB DEFAULT '[]'::jsonb,
  revision_items JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS vs_client_approvals_share_link_idx ON virtual_studio_client_approvals(share_link_id);
CREATE INDEX IF NOT EXISTS vs_client_approvals_status_idx ON virtual_studio_client_approvals(status);

-- ============================================================================
-- Scene Snapshots
-- ============================================================================
CREATE TABLE IF NOT EXISTS virtual_studio_scene_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID,
  
  name TEXT NOT NULL,
  description TEXT,
  
  scene_data JSONB NOT NULL,
  thumbnail TEXT,
  
  node_count INTEGER DEFAULT 0,
  light_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS vs_scene_snapshots_user_id_idx ON virtual_studio_scene_snapshots(user_id);
CREATE INDEX IF NOT EXISTS vs_scene_snapshots_project_id_idx ON virtual_studio_scene_snapshots(project_id);

-- ============================================================================
-- Custom Templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS virtual_studio_custom_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'custom',
  tags JSONB DEFAULT '[]'::jsonb,
  
  scene_data JSONB NOT NULL,
  thumbnail TEXT,
  
  is_public BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS vs_custom_templates_user_id_idx ON virtual_studio_custom_templates(user_id);
CREATE INDEX IF NOT EXISTS vs_custom_templates_category_idx ON virtual_studio_custom_templates(category);

-- ============================================================================
-- Auto-Save
-- ============================================================================
CREATE TABLE IF NOT EXISTS virtual_studio_auto_save (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID,
  
  scene_data JSONB NOT NULL,
  
  node_count INTEGER DEFAULT 0,
  is_dirty BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  UNIQUE(user_id, project_id)
);

CREATE INDEX IF NOT EXISTS vs_auto_save_user_id_idx ON virtual_studio_auto_save(user_id);
CREATE INDEX IF NOT EXISTS vs_auto_save_project_id_idx ON virtual_studio_auto_save(project_id);

-- ============================================================================
-- Device Config
-- ============================================================================
CREATE TABLE IF NOT EXISTS virtual_studio_device_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  device_type TEXT DEFAULT 'desktop',
  is_touch BOOLEAN DEFAULT false,
  has_apple_pencil BOOLEAN DEFAULT false,
  
  quality_level TEXT DEFAULT 'high',
  shadow_quality TEXT DEFAULT 'medium',
  antialias BOOLEAN DEFAULT true,
  
  panel_layout TEXT DEFAULT 'default',
  toolbar_position TEXT DEFAULT 'top',
  
  config JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS vs_device_config_user_id_idx ON virtual_studio_device_config(user_id);

-- ============================================================================
-- Persona Journey
-- ============================================================================
CREATE TABLE IF NOT EXISTS virtual_studio_persona_journey (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  profession TEXT,
  specialization TEXT,
  experience_level TEXT DEFAULT 'beginner',
  
  completed_steps JSONB DEFAULT '[]'::jsonb,
  current_step TEXT,
  
  discovered_features JSONB DEFAULT '[]'::jsonb,
  feature_usage_count JSONB DEFAULT '{}'::jsonb,
  
  goals JSONB DEFAULT '[]'::jsonb,
  completed_goals JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS vs_persona_journey_user_id_idx ON virtual_studio_persona_journey(user_id);

-- ============================================================================
-- Comparison Settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS virtual_studio_comparison_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  default_mode TEXT DEFAULT 'side_by_side',
  sync_cameras BOOLEAN DEFAULT true,
  show_differences BOOLEAN DEFAULT false,
  
  label_position TEXT DEFAULT 'top',
  show_timestamps BOOLEAN DEFAULT true,
  
  settings JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS vs_comparison_settings_user_id_idx ON virtual_studio_comparison_settings(user_id);

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_vs_user_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables with updated_at
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN 
    SELECT unnest(ARRAY[
      'virtual_studio_guide_settings',
      'virtual_studio_light_presets',
      'virtual_studio_share_links',
      'virtual_studio_custom_templates',
      'virtual_studio_auto_save',
      'virtual_studio_device_config',
      'virtual_studio_persona_journey',
      'virtual_studio_comparison_settings'
    ])
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS %I_updated_at ON %I;
      CREATE TRIGGER %I_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION update_vs_user_data_updated_at();
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE virtual_studio_guide_settings IS 'User settings for studio guides (distances, angles, composition)';
COMMENT ON TABLE virtual_studio_light_presets IS 'Saved lighting presets created by users';
COMMENT ON TABLE virtual_studio_share_links IS 'Links shared with clients for review/approval';
COMMENT ON TABLE virtual_studio_client_comments IS 'Client feedback comments on shared scenes';
COMMENT ON TABLE virtual_studio_client_approvals IS 'Client approval status for shared scenes';
COMMENT ON TABLE virtual_studio_scene_snapshots IS 'Scene snapshots for before/after comparison';
COMMENT ON TABLE virtual_studio_custom_templates IS 'User-created scene templates';
COMMENT ON TABLE virtual_studio_auto_save IS 'Auto-saved scene data for crash recovery';
COMMENT ON TABLE virtual_studio_device_config IS 'Device-specific configuration and preferences';
COMMENT ON TABLE virtual_studio_persona_journey IS 'User persona and onboarding journey tracking';
COMMENT ON TABLE virtual_studio_comparison_settings IS 'Scene comparison mode preferences';

