-- Feature Customizations Migration
-- Allows admins to customize feature names, descriptions, and logos

-- Feature Customizations Table
CREATE TABLE IF NOT EXISTS feature_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id VARCHAR(100) NOT NULL,
  custom_name VARCHAR(255),
  custom_description TEXT,
  logo_url TEXT,
  logo_icon VARCHAR(100), -- Material UI icon name (e.g., 'PhotoCamera', 'Videocam')
  logo_color VARCHAR(50), -- Hex color for the icon
  display_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  custom_category VARCHAR(100),
  marketing_text TEXT, -- Short marketing description
  tooltip_text TEXT, -- Hover tooltip text
  external_link TEXT, -- Link to documentation/help
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(feature_id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_feature_customizations_feature_id 
  ON feature_customizations(feature_id);
CREATE INDEX IF NOT EXISTS idx_feature_customizations_category 
  ON feature_customizations(custom_category);
CREATE INDEX IF NOT EXISTS idx_feature_customizations_visible 
  ON feature_customizations(is_visible) WHERE is_visible = true;

-- Feature Logo Assets Table (for uploaded logos)
CREATE TABLE IF NOT EXISTS feature_logo_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id VARCHAR(100) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  dimensions JSONB, -- { width, height }
  is_active BOOLEAN DEFAULT true,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(feature_id, file_name)
);

CREATE INDEX IF NOT EXISTS idx_feature_logo_assets_feature_id 
  ON feature_logo_assets(feature_id);

-- Audit log for feature customization changes
CREATE TABLE IF NOT EXISTS feature_customization_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'logo_upload', 'logo_delete')),
  old_value JSONB,
  new_value JSONB,
  changed_by UUID NOT NULL REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_customization_audit_feature_id 
  ON feature_customization_audit(feature_id);
CREATE INDEX IF NOT EXISTS idx_feature_customization_audit_created_at 
  ON feature_customization_audit(created_at DESC);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_feature_customization_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_feature_customization_timestamp ON feature_customizations;
CREATE TRIGGER trigger_update_feature_customization_timestamp
  BEFORE UPDATE ON feature_customizations
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_customization_timestamp();

-- Comments
COMMENT ON TABLE feature_customizations IS 'Admin-customizable feature names, descriptions, and logos';
COMMENT ON TABLE feature_logo_assets IS 'Uploaded logo files for features';
COMMENT ON TABLE feature_customization_audit IS 'Audit trail for feature customization changes';

