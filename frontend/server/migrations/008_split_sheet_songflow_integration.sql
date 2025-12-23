-- Split Sheet SongFlow Integration Migration
-- Links split sheets with SongFlow projects and tracks

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== ADD SONGFLOW COLUMNS TO SPLIT SHEETS ====================

-- Add SongFlow project and track ID columns to split_sheets table
ALTER TABLE split_sheets 
ADD COLUMN IF NOT EXISTS songflow_project_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS songflow_track_id VARCHAR(255);

-- Create indexes for SongFlow lookups
CREATE INDEX IF NOT EXISTS idx_split_sheets_songflow_project_id ON split_sheets(songflow_project_id);
CREATE INDEX IF NOT EXISTS idx_split_sheets_songflow_track_id ON split_sheets(songflow_track_id);

-- ==================== SPLIT SHEET SONGFLOW LINKS TABLE ====================

-- Junction table for many-to-many relationships between split sheets and SongFlow tracks
CREATE TABLE IF NOT EXISTS split_sheet_songflow_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  split_sheet_id UUID NOT NULL REFERENCES split_sheets(id) ON DELETE CASCADE,
  songflow_project_id VARCHAR(255),
  songflow_track_id VARCHAR(255),
  link_type VARCHAR(50) NOT NULL DEFAULT 'track' CHECK (link_type IN ('project', 'track')),
  auto_created BOOLEAN DEFAULT FALSE,
  linked_at TIMESTAMP DEFAULT NOW(),
  linked_by VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure at least one SongFlow ID is provided
  CONSTRAINT check_songflow_id CHECK (
    songflow_project_id IS NOT NULL OR songflow_track_id IS NOT NULL
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_split_sheet_songflow_links_split_sheet_id ON split_sheet_songflow_links(split_sheet_id);
CREATE INDEX IF NOT EXISTS idx_split_sheet_songflow_links_project_id ON split_sheet_songflow_links(songflow_project_id);
CREATE INDEX IF NOT EXISTS idx_split_sheet_songflow_links_track_id ON split_sheet_songflow_links(songflow_track_id);
CREATE INDEX IF NOT EXISTS idx_split_sheet_songflow_links_type ON split_sheet_songflow_links(link_type);

-- Unique constraint: one split sheet can only be linked once to a specific track/project combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_split_sheet_songflow_link 
ON split_sheet_songflow_links(split_sheet_id, songflow_track_id) 
WHERE songflow_track_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_split_sheet_songflow_project_link 
ON split_sheet_songflow_links(split_sheet_id, songflow_project_id) 
WHERE songflow_project_id IS NOT NULL;

-- ==================== TRIGGERS ====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_split_sheet_songflow_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for split_sheet_songflow_links
CREATE TRIGGER update_split_sheet_songflow_links_updated_at 
BEFORE UPDATE ON split_sheet_songflow_links
FOR EACH ROW EXECUTE FUNCTION update_split_sheet_songflow_links_updated_at();

-- ==================== SYNC COLUMNS WITH JUNCTION TABLE ====================

-- Function to sync direct columns with junction table (for backward compatibility)
CREATE OR REPLACE FUNCTION sync_split_sheet_songflow_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- When a link is created, also update the direct columns on split_sheets
  IF TG_OP = 'INSERT' THEN
    UPDATE split_sheets
    SET 
      songflow_project_id = COALESCE(NEW.songflow_project_id, songflow_project_id),
      songflow_track_id = COALESCE(NEW.songflow_track_id, songflow_track_id)
    WHERE id = NEW.split_sheet_id;
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to sync columns
CREATE TRIGGER sync_split_sheet_songflow_columns_trigger
AFTER INSERT ON split_sheet_songflow_links
FOR EACH ROW EXECUTE FUNCTION sync_split_sheet_songflow_columns();























