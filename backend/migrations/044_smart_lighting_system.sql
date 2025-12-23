-- Migration: Smart Lighting System
-- Description: Add light-shaper attachments, pattern detection, and contextual tips
-- Date: 2025-11-25

-- ============================================================================
-- 1. Light Shaper Attachments Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS light_shaper_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Asset References
  light_asset_id UUID NOT NULL REFERENCES asset_library(id) ON DELETE CASCADE,
  shaper_asset_id UUID NOT NULL REFERENCES asset_library(id) ON DELETE CASCADE,
  
  -- Compatibility Info
  compatibility_score DECIMAL(3,2) DEFAULT 1.0 CHECK (compatibility_score >= 0 AND compatibility_score <= 1.0),
  mount_type VARCHAR(50), -- 'bowens', 'profoto', 'elinchrom', 'godox', 'universal'
  
  -- Effects on Light
  beam_angle_modifier DECIMAL(5,2), -- How much shaper changes beam angle (degrees)
  power_loss_stops DECIMAL(3,2), -- Light loss in stops (e.g., 1.0 = 1 stop loss)
  diffusion_factor DECIMAL(3,2) DEFAULT 1.0, -- 0.0 (hard) to 1.0 (very soft)
  
  -- Metadata
  notes TEXT,
  is_recommended BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure unique combinations
  UNIQUE(light_asset_id, shaper_asset_id)
);

CREATE INDEX idx_light_shaper_light ON light_shaper_attachments(light_asset_id);
CREATE INDEX idx_light_shaper_shaper ON light_shaper_attachments(shaper_asset_id);
CREATE INDEX idx_light_shaper_mount ON light_shaper_attachments(mount_type);

-- ============================================================================
-- 2. Enhance Pattern Recommendations
-- ============================================================================

ALTER TABLE asset_light_pattern_recommendations
ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS alternative_assets JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS usage_tips TEXT[];

COMMENT ON COLUMN asset_light_pattern_recommendations.is_required IS 'Whether this asset is required (vs optional) for the pattern';
COMMENT ON COLUMN asset_light_pattern_recommendations.alternative_assets IS 'Array of alternative asset IDs that can be used instead';
COMMENT ON COLUMN asset_light_pattern_recommendations.usage_tips IS 'Contextual tips for using this asset in this pattern';

-- ============================================================================
-- 3. Pattern Detection Helper Functions
-- ============================================================================

-- Function to calculate distance between two 3D points
CREATE OR REPLACE FUNCTION calculate_3d_distance(
  x1 DECIMAL, y1 DECIMAL, z1 DECIMAL,
  x2 DECIMAL, y2 DECIMAL, z2 DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
  RETURN SQRT(
    POWER(x2 - x1, 2) + 
    POWER(y2 - y1, 2) + 
    POWER(z2 - z1, 2)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate angle from subject to light (in degrees)
CREATE OR REPLACE FUNCTION calculate_light_angle(
  light_x DECIMAL, light_z DECIMAL,
  subject_x DECIMAL DEFAULT 0, subject_z DECIMAL DEFAULT 0
) RETURNS DECIMAL AS $$
DECLARE
  dx DECIMAL;
  dz DECIMAL;
  angle_rad DECIMAL;
  angle_deg DECIMAL;
BEGIN
  dx := light_x - subject_x;
  dz := light_z - subject_z;
  
  -- Calculate angle in radians using atan2
  angle_rad := ATAN2(dx, dz);
  
  -- Convert to degrees
  angle_deg := DEGREES(angle_rad);
  
  -- Normalize to 0-360
  IF angle_deg < 0 THEN
    angle_deg := angle_deg + 360;
  END IF;
  
  RETURN angle_deg;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to detect pattern from light position
CREATE OR REPLACE FUNCTION detect_light_pattern(
  light_x DECIMAL,
  light_y DECIMAL,
  light_z DECIMAL,
  subject_x DECIMAL DEFAULT 0,
  subject_y DECIMAL DEFAULT 0,
  subject_z DECIMAL DEFAULT 0,
  distance_threshold DECIMAL DEFAULT 0.5
) RETURNS TABLE (
  pattern_id UUID,
  pattern_name VARCHAR,
  pattern_slug VARCHAR,
  light_role VARCHAR,
  expected_angle DECIMAL,
  actual_angle DECIMAL,
  distance_from_expected DECIMAL,
  confidence DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.slug,
    (light_config->>'role')::VARCHAR as light_role,
    (light_config->>'angle')::DECIMAL as expected_angle,
    calculate_light_angle(light_x, light_z, subject_x, subject_z) as actual_angle,
    calculate_3d_distance(
      light_x, light_y, light_z,
      (light_config->'position'->>'x')::DECIMAL,
      (light_config->'position'->>'y')::DECIMAL,
      (light_config->'position'->>'z')::DECIMAL
    ) as distance_from_expected,
    GREATEST(0, 1 - (
      calculate_3d_distance(
        light_x, light_y, light_z,
        (light_config->'position'->>'x')::DECIMAL,
        (light_config->'position'->>'y')::DECIMAL,
        (light_config->'position'->>'z')::DECIMAL
      ) / distance_threshold
    )) as confidence
  FROM 
    virtual_studio_light_patterns p,
    jsonb_array_elements(p.light_setup) as light_config
  WHERE 
    calculate_3d_distance(
      light_x, light_y, light_z,
      (light_config->'position'->>'x')::DECIMAL,
      (light_config->'position'->>'y')::DECIMAL,
      (light_config->'position'->>'z')::DECIMAL
    ) < distance_threshold
  ORDER BY 
    confidence DESC,
    distance_from_expected ASC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 4. Seed Light-Shaper Compatibility Data
-- ============================================================================

-- This will be populated by a separate script that analyzes existing assets
-- For now, we'll add a few examples manually

COMMENT ON TABLE light_shaper_attachments IS 'Defines which light shapers are compatible with which lights';

