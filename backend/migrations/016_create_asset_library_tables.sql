-- ============================================================================
-- ASSET LIBRARY SYSTEM
-- Migration: 016_create_asset_library_tables.sql
-- Description: Create comprehensive 3D asset library system for Virtual Studio
-- Date: 2025-11-25
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ASSET CATEGORIES TABLE
-- Defines hierarchical categories for organizing assets
-- ============================================================================

-- Drop existing empty table if it exists
DROP TABLE IF EXISTS asset_categories CASCADE;

CREATE TABLE asset_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  parent_id UUID REFERENCES asset_categories(id) ON DELETE CASCADE,
  icon VARCHAR(50), -- Material-UI icon name
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for parent lookups
CREATE INDEX idx_asset_categories_parent ON asset_categories(parent_id);

-- ============================================================================
-- ASSET LIBRARY TABLE
-- Main table for storing all 3D assets (lights, props, furniture, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NULL, -- NULL for system assets, references users(id) for user assets
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL, -- light, light_shaper, accessory, prop, furniture
  subcategory VARCHAR(50), -- softbox, umbrella, chair, plant, etc.
  model_url TEXT NOT NULL, -- GLB/GLTF file URL (S3 or CDN)
  thumbnail_url TEXT, -- Preview image URL
  tags TEXT[], -- Searchable tags array
  metadata JSONB DEFAULT '{}', -- Custom properties (dimensions, brand, power, etc.)
  is_system BOOLEAN DEFAULT false, -- System vs user-created
  is_public BOOLEAN DEFAULT false, -- Shareable with community
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_asset_library_category ON asset_library(category);
CREATE INDEX IF NOT EXISTS idx_asset_library_subcategory ON asset_library(subcategory);
CREATE INDEX IF NOT EXISTS idx_asset_library_user_id ON asset_library(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_library_is_system ON asset_library(is_system);
CREATE INDEX IF NOT EXISTS idx_asset_library_is_public ON asset_library(is_public);
CREATE INDEX IF NOT EXISTS idx_asset_library_tags ON asset_library USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_asset_library_metadata ON asset_library USING GIN(metadata);

-- ============================================================================
-- USER ASSET FAVORITES TABLE
-- Track user's favorite assets for quick access
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_asset_favorites (
  user_id VARCHAR(255) NOT NULL,
  asset_id UUID NOT NULL REFERENCES asset_library(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, asset_id)
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_user_asset_favorites_user ON user_asset_favorites(user_id);

-- ============================================================================
-- ASSET USAGE TRACKING TABLE
-- Track which assets are used in which projects
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES asset_library(id) ON DELETE CASCADE,
  project_id VARCHAR(255) NOT NULL, -- References virtual_studio_projects(id)
  scene_id VARCHAR(255), -- Optional scene identifier
  user_id VARCHAR(255) NOT NULL,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for tracking queries
CREATE INDEX IF NOT EXISTS idx_asset_usage_asset ON asset_usage_tracking(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_usage_project ON asset_usage_tracking(project_id);
CREATE INDEX IF NOT EXISTS idx_asset_usage_user ON asset_usage_tracking(user_id);

-- ============================================================================
-- SEED INITIAL CATEGORIES
-- ============================================================================

INSERT INTO asset_categories (name, icon, description, sort_order) VALUES
  ('Lights', 'Lightbulb', 'Studio lights, strobes, LED panels, and continuous lights', 1),
  ('Light Shapers', 'FilterFrames', 'Softboxes, umbrellas, beauty dishes, and modifiers', 2),
  ('Accessories', 'Build', 'Stands, booms, clamps, and grip equipment', 3),
  ('Props', 'Chair', 'Decorative objects, geometric shapes, and set pieces', 4),
  ('Furniture', 'Weekend', 'Chairs, tables, and furniture for set design', 5)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SEED SUBCATEGORIES
-- ============================================================================

-- Get category IDs for subcategories
DO $$
DECLARE
  lights_id UUID;
  shapers_id UUID;
  accessories_id UUID;
  props_id UUID;
  furniture_id UUID;
BEGIN
  SELECT id INTO lights_id FROM asset_categories WHERE name = 'Lights';
  SELECT id INTO shapers_id FROM asset_categories WHERE name = 'Light Shapers';
  SELECT id INTO accessories_id FROM asset_categories WHERE name = 'Accessories';
  SELECT id INTO props_id FROM asset_categories WHERE name = 'Props';
  SELECT id INTO furniture_id FROM asset_categories WHERE name = 'Furniture';

  -- Light subcategories
  INSERT INTO asset_categories (name, parent_id, sort_order) VALUES
    ('Studio Strobes', lights_id, 1),
    ('Monolights', lights_id, 2),
    ('LED Panels', lights_id, 3),
    ('Speedlights', lights_id, 4),
    ('Ring Lights', lights_id, 5),
    ('Tube Lights', lights_id, 6),
    ('Continuous Lights', lights_id, 7),
    ('Practical Lights', lights_id, 8)
  ON CONFLICT DO NOTHING;

  -- Light Shaper subcategories
  INSERT INTO asset_categories (name, parent_id, sort_order) VALUES
    ('Softboxes', shapers_id, 1),
    ('Octaboxes', shapers_id, 2),
    ('Strip Boxes', shapers_id, 3),
    ('Umbrellas', shapers_id, 4),
    ('Beauty Dishes', shapers_id, 5),
    ('Reflectors', shapers_id, 6),
    ('Grids', shapers_id, 7),
    ('Snoots', shapers_id, 8),
    ('Barn Doors', shapers_id, 9),
    ('Diffusers', shapers_id, 10)
  ON CONFLICT DO NOTHING;
END $$;

-- Migration complete
SELECT 'Migration 016: Asset Library System - Completed' AS status;

