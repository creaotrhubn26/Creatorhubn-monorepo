-- Migration 056: Add missing showcase tables
-- Created: 2025-01-XX
-- Description: Adds showcase_collection_items and showcase_interactions tables,
--              plus analytics column to project_showcases

-- ============================================================================
-- Add analytics column to project_showcases if not exists
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_showcases' AND column_name = 'analytics'
  ) THEN
    ALTER TABLE project_showcases ADD COLUMN analytics JSONB;
    RAISE NOTICE 'Added analytics column to project_showcases';
  ELSE
    RAISE NOTICE 'analytics column already exists in project_showcases';
  END IF;
END $$;

-- ============================================================================
-- Showcase Collection Items - Links items to collections
-- ============================================================================
CREATE TABLE IF NOT EXISTS showcase_collection_items (
  id SERIAL PRIMARY KEY,
  collection_id VARCHAR NOT NULL,
  showcase_id VARCHAR NOT NULL,
  item_type VARCHAR(50) DEFAULT 'showcase', -- showcase, image, video, audio
  "order" INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for showcase_collection_items
CREATE INDEX IF NOT EXISTS showcase_collection_items_collection_id_idx 
  ON showcase_collection_items(collection_id);
CREATE INDEX IF NOT EXISTS showcase_collection_items_showcase_id_idx 
  ON showcase_collection_items(showcase_id);

-- ============================================================================
-- Showcase Interactions - Track likes, views, downloads etc.
-- ============================================================================
CREATE TABLE IF NOT EXISTS showcase_interactions (
  id SERIAL PRIMARY KEY,
  showcase_id VARCHAR NOT NULL,
  showcase_item_id VARCHAR,
  user_id VARCHAR,
  session_id VARCHAR(255),
  interaction_type VARCHAR(50) NOT NULL, -- view, like, download, share, favorite
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for showcase_interactions
CREATE INDEX IF NOT EXISTS showcase_interactions_showcase_id_idx 
  ON showcase_interactions(showcase_id);
CREATE INDEX IF NOT EXISTS showcase_interactions_type_idx 
  ON showcase_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS showcase_interactions_user_id_idx 
  ON showcase_interactions(user_id);

-- ============================================================================
-- Comments
-- ============================================================================
DO $$ 
BEGIN
  RAISE NOTICE '✅ Migration 056 complete - showcase_collection_items and showcase_interactions tables created';
END $$;

