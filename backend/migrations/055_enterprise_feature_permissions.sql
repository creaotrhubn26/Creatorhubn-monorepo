-- Enterprise Feature Permissions Migration
-- Allows enterprise admins to configure which features team members can access

-- Create enterprise_feature_permissions table
CREATE TABLE IF NOT EXISTS enterprise_feature_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL,
  feature_id VARCHAR(255) NOT NULL,
  -- Permission level for this feature
  permission_level VARCHAR(50) NOT NULL DEFAULT 'all',
  -- 'all' = everyone in org, 'admin_only' = only admins, 'disabled' = no one
  -- Can also use role names: 'admin', 'member', 'viewer'
  allowed_roles TEXT[] DEFAULT ARRAY['admin', 'member', 'viewer'],
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255),
  -- Ensure unique feature per organization
  CONSTRAINT unique_org_feature UNIQUE (organization_id, feature_id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_enterprise_feature_perms_org 
  ON enterprise_feature_permissions(organization_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_feature_perms_feature 
  ON enterprise_feature_permissions(feature_id);

-- Enterprise feature permission presets (for quick setup)
CREATE TABLE IF NOT EXISTS enterprise_permission_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  -- Preset configuration as JSON
  -- Format: { "feature_id": { "permission_level": "all", "allowed_roles": ["admin", "member"] } }
  permissions_config JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  is_system BOOLEAN DEFAULT FALSE, -- System presets can't be deleted
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default presets
INSERT INTO enterprise_permission_presets (name, description, permissions_config, is_default, is_system)
VALUES 
  (
    'Full Access',
    'Alle teammedlemmer har tilgang til alle funksjoner',
    '{"default": {"permission_level": "all", "allowed_roles": ["admin", "member", "viewer"]}}',
    TRUE,
    TRUE
  ),
  (
    'Admin Kontroll',
    'Sensitive funksjoner er kun tilgjengelig for administratorer',
    '{
      "default": {"permission_level": "all", "allowed_roles": ["admin", "member", "viewer"]},
      "billing-invoicing": {"permission_level": "admin_only", "allowed_roles": ["admin"]},
      "client-management": {"permission_level": "admin_only", "allowed_roles": ["admin"]},
      "team-management": {"permission_level": "admin_only", "allowed_roles": ["admin"]},
      "google-workspace": {"permission_level": "admin_only", "allowed_roles": ["admin"]},
      "analytics-reporting": {"permission_level": "admin_only", "allowed_roles": ["admin", "member"]}
    }',
    FALSE,
    TRUE
  ),
  (
    'Viewer Only',
    'Nye medlemmer får kun lesetilgang til de fleste funksjoner',
    '{
      "default": {"permission_level": "all", "allowed_roles": ["admin", "member"]},
      "viewer_features": ["dashboard-overview", "project-viewing", "calendar-view", "notification-center"]
    }',
    FALSE,
    TRUE
  )
ON CONFLICT DO NOTHING;

-- Organization permission preset assignment
ALTER TABLE enterprise_team_members 
  ADD COLUMN IF NOT EXISTS permission_preset_id UUID REFERENCES enterprise_permission_presets(id);

-- Organization-level settings for feature permissions
ALTER TABLE enterprise_inquiries 
  ADD COLUMN IF NOT EXISTS feature_permissions_config JSONB DEFAULT '{}';

-- Add column to track which preset the org uses by default
CREATE TABLE IF NOT EXISTS enterprise_organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL UNIQUE,
  default_permission_preset_id UUID REFERENCES enterprise_permission_presets(id),
  -- Custom permissions override preset
  custom_permissions JSONB DEFAULT '{}',
  -- Features that are always admin-only for this org
  admin_only_features TEXT[] DEFAULT ARRAY[]::TEXT[],
  -- Features that are completely disabled for this org
  disabled_features TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_org_settings 
  ON enterprise_organization_settings(organization_id);

-- Function to check if a user has access to a feature
CREATE OR REPLACE FUNCTION check_enterprise_feature_access(
  p_organization_id VARCHAR(255),
  p_user_role VARCHAR(50),
  p_feature_id VARCHAR(255)
) RETURNS BOOLEAN AS $$
DECLARE
  v_settings RECORD;
  v_permission RECORD;
BEGIN
  -- Get organization settings
  SELECT * INTO v_settings 
  FROM enterprise_organization_settings 
  WHERE organization_id = p_organization_id;
  
  -- If no settings, allow all
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;
  
  -- Check if feature is disabled
  IF p_feature_id = ANY(v_settings.disabled_features) THEN
    RETURN FALSE;
  END IF;
  
  -- Check if feature is admin-only and user is not admin
  IF p_feature_id = ANY(v_settings.admin_only_features) AND p_user_role != 'admin' THEN
    RETURN FALSE;
  END IF;
  
  -- Check specific feature permission
  SELECT * INTO v_permission 
  FROM enterprise_feature_permissions 
  WHERE organization_id = p_organization_id AND feature_id = p_feature_id;
  
  IF FOUND THEN
    RETURN p_user_role = ANY(v_permission.allowed_roles);
  END IF;
  
  -- Default: allow all
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE enterprise_feature_permissions IS 'Per-feature permission settings for enterprise organizations';
COMMENT ON TABLE enterprise_permission_presets IS 'Pre-configured permission templates for quick setup';
COMMENT ON TABLE enterprise_organization_settings IS 'Organization-level feature permission settings';
COMMENT ON FUNCTION check_enterprise_feature_access IS 'Check if a user role has access to a feature in an organization';

