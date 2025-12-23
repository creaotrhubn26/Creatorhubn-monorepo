-- Migration: Create tutorial_preferences table
-- Description: Store user tutorial dismissal and progress preferences with database persistence
-- Date: 2024-12-15

-- Create tutorial_preferences table
-- Note: Using VARCHAR for user_id to work with session-based or string-based user IDs
CREATE TABLE IF NOT EXISTS tutorial_preferences (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  tutorial_id VARCHAR(255) NOT NULL,
  dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMP,
  profession VARCHAR(100),
  completed_steps JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure one preference record per user per tutorial
  UNIQUE(user_id, tutorial_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tutorial_preferences_user_id 
  ON tutorial_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_tutorial_preferences_tutorial_id 
  ON tutorial_preferences(tutorial_id);

CREATE INDEX IF NOT EXISTS idx_tutorial_preferences_user_tutorial 
  ON tutorial_preferences(user_id, tutorial_id);

CREATE INDEX IF NOT EXISTS idx_tutorial_preferences_dismissed 
  ON tutorial_preferences(dismissed);

-- Add comment to table
COMMENT ON TABLE tutorial_preferences IS 'Stores user tutorial dismissal preferences and progress tracking';

-- Add column comments
COMMENT ON COLUMN tutorial_preferences.tutorial_id IS 'Unique identifier for the tutorial (e.g., keyboard-shortcuts, photo-editing-basics)';
COMMENT ON COLUMN tutorial_preferences.dismissed IS 'Whether user has permanently dismissed this tutorial';
COMMENT ON COLUMN tutorial_preferences.dismissed_at IS 'Timestamp when tutorial was dismissed';
COMMENT ON COLUMN tutorial_preferences.profession IS 'User profession when tutorial was used';
COMMENT ON COLUMN tutorial_preferences.completed_steps IS 'JSON array of completed step indices for progress tracking';

