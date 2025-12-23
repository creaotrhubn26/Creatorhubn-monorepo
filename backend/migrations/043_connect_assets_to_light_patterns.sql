-- ============================================================================
-- CONNECT ASSET LIBRARY TO LIGHT PATTERNS
-- Migration: 043_connect_assets_to_light_patterns.sql
-- Description: Add relationships between assets and light patterns
-- Date: 2025-11-25
-- ============================================================================

-- ============================================================================
-- ASSET LIGHT PATTERN RECOMMENDATIONS TABLE
-- Links assets (especially lights) to recommended light patterns
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_light_pattern_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES asset_library(id) ON DELETE CASCADE,
  pattern_id UUID NOT NULL REFERENCES virtual_studio_light_patterns(id) ON DELETE CASCADE,
  recommendation_strength VARCHAR(20) DEFAULT 'recommended', -- 'essential', 'recommended', 'optional'
  role_in_pattern VARCHAR(50), -- 'key_light', 'fill_light', 'rim_light', 'background_light'
  notes TEXT, -- Why this asset works well for this pattern
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(asset_id, pattern_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_asset_pattern_recs_asset ON asset_light_pattern_recommendations(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_pattern_recs_pattern ON asset_light_pattern_recommendations(pattern_id);
CREATE INDEX IF NOT EXISTS idx_asset_pattern_recs_strength ON asset_light_pattern_recommendations(recommendation_strength);

-- ============================================================================
-- UPDATE ASSET METADATA TO INCLUDE LIGHT SPECIFICATIONS
-- Add common light specifications to metadata for better pattern matching
-- ============================================================================

-- Add comment to document metadata structure for lights
COMMENT ON COLUMN asset_library.metadata IS 'JSONB metadata structure:
For lights: {
  "brand": "Profoto",
  "power_watts": 500,
  "color_temp_k": 5600,
  "cri": 95,
  "light_type": "strobe|continuous|led",
  "beam_angle": 45,
  "compatible_modifiers": ["softbox", "umbrella", "beauty_dish"],
  "recommended_patterns": ["rembrandt-lighting", "loop-lighting"],
  "dimensions": {"width": 20, "height": 30, "depth": 15, "unit": "cm"},
  "weight_kg": 2.5
}
For light shapers: {
  "type": "softbox|umbrella|beauty_dish|reflector",
  "size": "60x90cm",
  "shape": "rectangular|octagonal|circular",
  "mount_type": "bowens|profoto|elinchrom",
  "diffusion_layers": 2,
  "recommended_patterns": ["rembrandt-lighting", "butterfly-lighting"]
}';

-- ============================================================================
-- HELPER FUNCTION: Get recommended patterns for an asset
-- ============================================================================

CREATE OR REPLACE FUNCTION get_asset_recommended_patterns(asset_uuid UUID)
RETURNS TABLE(
  pattern_id UUID,
  pattern_name VARCHAR(100),
  pattern_slug VARCHAR(100),
  recommendation_strength VARCHAR(20),
  role_in_pattern VARCHAR(50)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.slug,
    r.recommendation_strength,
    r.role_in_pattern
  FROM asset_light_pattern_recommendations r
  JOIN virtual_studio_light_patterns p ON r.pattern_id = p.id
  WHERE r.asset_id = asset_uuid
  ORDER BY 
    CASE r.recommendation_strength
      WHEN 'essential' THEN 1
      WHEN 'recommended' THEN 2
      WHEN 'optional' THEN 3
      ELSE 4
    END,
    p.usage_count DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER FUNCTION: Get recommended assets for a light pattern
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pattern_recommended_assets(pattern_uuid UUID)
RETURNS TABLE(
  asset_id UUID,
  asset_name VARCHAR(255),
  asset_category VARCHAR(50),
  asset_subcategory VARCHAR(50),
  recommendation_strength VARCHAR(20),
  role_in_pattern VARCHAR(50),
  thumbnail_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.name,
    a.category,
    a.subcategory,
    r.recommendation_strength,
    r.role_in_pattern,
    a.thumbnail_url
  FROM asset_light_pattern_recommendations r
  JOIN asset_library a ON r.asset_id = a.id
  WHERE r.pattern_id = pattern_uuid
  ORDER BY 
    CASE r.recommendation_strength
      WHEN 'essential' THEN 1
      WHEN 'recommended' THEN 2
      WHEN 'optional' THEN 3
      ELSE 4
    END,
    CASE r.role_in_pattern
      WHEN 'key_light' THEN 1
      WHEN 'fill_light' THEN 2
      WHEN 'rim_light' THEN 3
      WHEN 'background_light' THEN 4
      ELSE 5
    END;
END;
$$ LANGUAGE plpgsql;

-- Migration complete
SELECT 'Migration 043: Asset Library <-> Light Patterns Connection - Completed' AS status;

