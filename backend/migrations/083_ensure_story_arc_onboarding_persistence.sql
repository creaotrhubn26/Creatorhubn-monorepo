-- Migration: 083_ensure_story_arc_onboarding_persistence.sql
-- Description: Ensure onboarding_profiles table supports Story Arc Studio onboarding completion tracking
-- Date: 2025-01-XX

-- ============================================================================
-- 1. VERIFY onboarding_profiles TABLE EXISTS AND HAS REQUIRED COLUMNS
-- ============================================================================
DO $$
BEGIN
  -- Check if table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'onboarding_profiles'
  ) THEN
    RAISE EXCEPTION 'onboarding_profiles table does not exist. Please run migration 058 first.';
  END IF;

  -- Verify onboarding_completed column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'onboarding_profiles' 
    AND column_name = 'onboarding_completed'
  ) THEN
    -- Add the column if it doesn't exist
    ALTER TABLE onboarding_profiles 
    ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;
    
    RAISE NOTICE 'Added onboarding_completed column to onboarding_profiles table';
  END IF;

  -- Verify user_id column exists and is indexed
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'onboarding_profiles' 
    AND indexname = 'idx_onboarding_profiles_user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_onboarding_profiles_user_id 
    ON onboarding_profiles(user_id);
    
    RAISE NOTICE 'Created index on user_id for onboarding_profiles table';
  END IF;

  -- Verify updated_at column exists (for tracking completion time)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'onboarding_profiles' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE onboarding_profiles 
    ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
    
    RAISE NOTICE 'Added updated_at column to onboarding_profiles table';
  END IF;

  RAISE NOTICE 'Migration 083_ensure_story_arc_onboarding_persistence completed successfully';
END $$;


























