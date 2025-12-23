-- Add Story Arc Editor State Backup/Versioning Table
-- Stores version history for editor states to enable recovery and versioning

CREATE TABLE IF NOT EXISTS story_arc_editor_backups (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  story_arc_id VARCHAR NOT NULL REFERENCES story_arc_projects(id) ON DELETE CASCADE,
  user_id VARCHAR,
  editor_state JSONB NOT NULL,
  version INTEGER NOT NULL,
  backup_type VARCHAR(20) DEFAULT 'auto', -- 'auto', 'manual', 'pre_save'
  description TEXT, -- Optional description for manual backups
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  
  -- Indexes for efficient queries
  CONSTRAINT story_arc_editor_backups_story_arc_id_fkey 
    FOREIGN KEY (story_arc_id) REFERENCES story_arc_projects(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS story_arc_editor_backups_story_arc_id_idx 
  ON story_arc_editor_backups(story_arc_id);
CREATE INDEX IF NOT EXISTS story_arc_editor_backups_user_id_idx 
  ON story_arc_editor_backups(user_id);
CREATE INDEX IF NOT EXISTS story_arc_editor_backups_version_idx 
  ON story_arc_editor_backups(story_arc_id, version DESC);
CREATE INDEX IF NOT EXISTS story_arc_editor_backups_created_at_idx 
  ON story_arc_editor_backups(story_arc_id, created_at DESC);

-- Add comment
COMMENT ON TABLE story_arc_editor_backups IS 'Version history and backups for Story Arc editor states. Automatically created before each save.';
COMMENT ON COLUMN story_arc_editor_backups.backup_type IS 'Type of backup: auto (automatic before save), manual (user-created), pre_save (before major changes)';

