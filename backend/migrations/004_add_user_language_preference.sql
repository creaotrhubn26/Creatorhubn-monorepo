-- Migration: Add User Language Preference
-- Created: 2025-01-27
-- Description: Adds language preference support for multi-language interface

-- Add preferredLanguage column to user_preferences table
-- If the table doesn't exist, create it
CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Ensure user_id column exists (some older schemas may lack it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN user_id VARCHAR(255);
  END IF;

  -- Ensure uniqueness on user_id when present
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname = 'user_preferences_user_id_idx'
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX user_preferences_user_id_idx ON user_preferences(user_id);
    EXCEPTION WHEN undefined_column THEN
      -- Column not present; ignore
      NULL;
    END;
  END IF;
END $$;

-- Add preferredLanguage column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'preferred_language'
  ) THEN
    ALTER TABLE user_preferences 
    ADD COLUMN preferred_language VARCHAR(10) DEFAULT 'no' NOT NULL;
  END IF;
END $$;

-- Add index for faster lookups (guard column existence)
DO $$
BEGIN
  BEGIN
    CREATE INDEX IF NOT EXISTS user_preferences_preferred_language_idx ON user_preferences(preferred_language);
  EXCEPTION WHEN undefined_column THEN
    -- skip if column not present
    NULL;
  END;
END $$;

-- Add CHECK constraint to ensure valid language codes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_preferences_preferred_language_check'
  ) THEN
    ALTER TABLE user_preferences
    ADD CONSTRAINT user_preferences_preferred_language_check
    CHECK (preferred_language IN ('no', 'en', 'sv', 'da', 'de', 'es', 'fr', 'pl'));
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON TABLE user_preferences IS 'Stores user preferences including language, theme, and other settings';
COMMENT ON COLUMN user_preferences.preferred_language IS 'User interface language preference (ISO 639-1 code)';

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS user_preferences_updated_at_trigger ON user_preferences;
CREATE TRIGGER user_preferences_updated_at_trigger
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();

-- Insert default preferences for existing users who don't have them
INSERT INTO user_preferences (user_id, preferred_language)
SELECT DISTINCT u.id, 'no'
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_preferences up WHERE up.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Analytics: Create view for language preference statistics
CREATE OR REPLACE VIEW language_preference_stats AS
SELECT 
  preferred_language,
  COUNT(*) as user_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM user_preferences
GROUP BY preferred_language
ORDER BY user_count DESC;

COMMENT ON VIEW language_preference_stats IS 'Statistics on user language preferences for analytics';
