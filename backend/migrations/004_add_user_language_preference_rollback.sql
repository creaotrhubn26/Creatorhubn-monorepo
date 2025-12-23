-- Rollback Migration: Remove User Language Preference
-- Created: 2025-01-27
-- Description: Rollback script to remove language preference feature

-- Drop the analytics view
DROP VIEW IF EXISTS language_preference_stats;

-- Drop the trigger
DROP TRIGGER IF EXISTS user_preferences_updated_at_trigger ON user_preferences;

-- Drop the trigger function
DROP FUNCTION IF EXISTS update_user_preferences_updated_at();

-- Drop the CHECK constraint
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_preferred_language_check;

-- Drop the indexes
DROP INDEX IF EXISTS user_preferences_preferred_language_idx;

-- Remove the preferred_language column
ALTER TABLE user_preferences DROP COLUMN IF EXISTS preferred_language;

-- Note: We don't drop user_preferences_user_id_idx or the table itself
-- as they may be used by other features
