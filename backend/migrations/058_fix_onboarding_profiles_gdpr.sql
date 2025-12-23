-- Migration: 058_fix_onboarding_profiles_gdpr.sql
-- Description: Recreate onboarding_profiles table with full GDPR schema
-- Date: 2025-11-29
-- Note: This drops the existing table (no data to preserve) and creates new schema

-- ============================================================================
-- 1. DROP EXISTING TABLE (confirmed no data to preserve)
-- ============================================================================
DROP TABLE IF EXISTS onboarding_profiles CASCADE;

-- ============================================================================
-- 2. CREATE NEW TABLE WITH FULL GDPR SCHEMA
-- ============================================================================
CREATE TABLE onboarding_profiles (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR NOT NULL,
  user_type VARCHAR NOT NULL CHECK (user_type IN ('photographer', 'videographer', 'music_producer', 'creator', 'vendor')),
  experience_level VARCHAR DEFAULT 'beginner' CHECK (experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  learning_style VARCHAR DEFAULT 'step_by_step' CHECK (learning_style IN ('step_by_step', 'video_based', 'hands_on', 'documentation')),
  preferred_language VARCHAR DEFAULT 'norwegian',
  
  -- User goals and preferences
  goals JSONB DEFAULT '[]'::jsonb,
  completed_steps JSONB DEFAULT '[]'::jsonb,
  current_path VARCHAR,
  
  -- User profile customization
  profile_photo VARCHAR,
  branding_color VARCHAR DEFAULT '#ff8c00',
  business_name VARCHAR,
  tagline VARCHAR,
  custom_logo VARCHAR,
  
  -- Contact information
  email VARCHAR,
  phone VARCHAR,
  business_address JSONB,
  organization_number VARCHAR,
  website VARCHAR,
  vat_number VARCHAR,
  
  -- Business status tracking
  business_status VARCHAR DEFAULT 'active' CHECK (business_status IN ('active', 'inactive', 'suspended', 'pending_deletion')),
  business_status_reason TEXT,
  business_status_changed_at TIMESTAMP,
  business_status_changed_by VARCHAR,
  
  -- Financial health tracking
  last_financial_check TIMESTAMP,
  credit_rating VARCHAR,
  risk_level VARCHAR CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  risk_indicators JSONB,
  
  -- GDPR Compliance & Data Retention
  data_retention_until TIMESTAMP,
  marked_for_deletion BOOLEAN DEFAULT false,
  deletion_requested_at TIMESTAMP,
  deletion_requested_by VARCHAR,
  deletion_completed_at TIMESTAMP,
  
  -- Service restrictions
  service_restrictions JSONB,
  
  -- Onboarding completion tracking
  onboarding_completed BOOLEAN DEFAULT false,
  
  -- Personalized recommendations
  personalized_recommendations JSONB,
  
  -- Progress tracking data
  progress_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 3. CREATE INDEXES
-- ============================================================================
CREATE INDEX idx_onboarding_profiles_user_id ON onboarding_profiles(user_id);
CREATE INDEX idx_onboarding_profiles_user_type ON onboarding_profiles(user_type);
CREATE INDEX idx_onboarding_profiles_marked_for_deletion ON onboarding_profiles(marked_for_deletion);
CREATE INDEX idx_onboarding_profiles_data_retention ON onboarding_profiles(data_retention_until);
CREATE INDEX idx_onboarding_profiles_business_status ON onboarding_profiles(business_status);

-- ============================================================================
-- 4. ADD JOB_TYPE COLUMN TO cleanup_job_logs IF MISSING
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cleanup_job_logs' AND column_name = 'job_type'
  ) THEN
    ALTER TABLE cleanup_job_logs ADD COLUMN job_type VARCHAR(50) DEFAULT 'gdpr_cleanup';
  END IF;
END $$;

-- Update any existing NULL job_type values
UPDATE cleanup_job_logs SET job_type = 'gdpr_cleanup' WHERE job_type IS NULL;

-- ============================================================================
-- 5. VERIFICATION
-- ============================================================================
DO $$
BEGIN
  -- Verify onboarding_profiles has required columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'onboarding_profiles' AND column_name = 'user_type'
  ) THEN
    RAISE EXCEPTION 'Migration failed: user_type column not created';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'onboarding_profiles' AND column_name = 'marked_for_deletion'
  ) THEN
    RAISE EXCEPTION 'Migration failed: marked_for_deletion column not created';
  END IF;
  
  RAISE NOTICE 'Migration 058_fix_onboarding_profiles_gdpr completed successfully';
END $$;

