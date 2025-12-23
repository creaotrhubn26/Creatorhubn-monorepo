-- Migration 002: Prototype Tester Workflow Enhancement
-- Closes workflow gaps between PrototypeTesterModal and PrototypeFeedbackPanel
-- Created: 2025-10-25

-- 1. Add linking and enhanced fields to prototype_feedback table
ALTER TABLE prototype_feedback 
ADD COLUMN IF NOT EXISTS application_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS tester_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS detailed_feedback TEXT,
ADD COLUMN IF NOT EXISTS testing_notes TEXT,
ADD COLUMN IF NOT EXISTS expectations TEXT,
ADD COLUMN IF NOT EXISTS location_context JSONB;

-- Add index for application linking
CREATE INDEX IF NOT EXISTS idx_prototype_feedback_application_id 
  ON prototype_feedback(application_id);

-- Add index for tester verification
CREATE INDEX IF NOT EXISTS idx_prototype_feedback_tester_verified 
  ON prototype_feedback(tester_verified);

-- 2. Ensure prototype_tester_applications table exists with all required fields
CREATE TABLE IF NOT EXISTS prototype_tester_applications (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  profession VARCHAR(50) NOT NULL CHECK (profession IN ('photographer', 'videographer', 'music_producer', 'vendor', 'other')),
  testing_areas JSONB NOT NULL,
  experience VARCHAR(50) NOT NULL CHECK (experience IN ('beginner', 'intermediate', 'advanced', 'expert')),
  feedback TEXT NOT NULL,
  available_time VARCHAR(255),
  device_info TEXT,
  has_agreed_to_terms BOOLEAN DEFAULT FALSE,
  
  -- Enhanced NoteEditor fields
  detailed_feedback TEXT,
  testing_notes TEXT,
  expectations TEXT,
  
  -- Location context tracking
  location_context JSONB,
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'inactive')),
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for prototype_tester_applications
CREATE INDEX IF NOT EXISTS idx_applications_email ON prototype_tester_applications(email);
CREATE INDEX IF NOT EXISTS idx_applications_status ON prototype_tester_applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_profession ON prototype_tester_applications(profession);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON prototype_tester_applications(created_at DESC);

-- 3. Add foreign key constraint (if both tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prototype_tester_applications') THEN
    ALTER TABLE prototype_feedback 
    ADD CONSTRAINT fk_feedback_application
    FOREIGN KEY (application_id) 
    REFERENCES prototype_tester_applications(id)
    ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4. Create updated_at trigger for applications
CREATE OR REPLACE FUNCTION update_prototype_tester_applications_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_prototype_tester_applications_timestamp ON prototype_tester_applications;
CREATE TRIGGER trigger_update_prototype_tester_applications_timestamp
BEFORE UPDATE ON prototype_tester_applications
FOR EACH ROW
EXECUTE FUNCTION update_prototype_tester_applications_timestamp();

-- 5. Add comments for documentation
COMMENT ON TABLE prototype_tester_applications IS 'Stores prototype tester applications submitted via PrototypeTesterModal';
COMMENT ON COLUMN prototype_tester_applications.detailed_feedback IS 'Rich text feedback from NoteEditor';
COMMENT ON COLUMN prototype_tester_applications.testing_notes IS 'Rich text testing notes from NoteEditor';
COMMENT ON COLUMN prototype_tester_applications.expectations IS 'Rich text expectations from NoteEditor';
COMMENT ON COLUMN prototype_tester_applications.location_context IS 'JSON context of where application was submitted (profession, dashboard, tab, section, etc.)';

COMMENT ON COLUMN prototype_feedback.application_id IS 'Links feedback to original tester application';
COMMENT ON COLUMN prototype_feedback.tester_verified IS 'Whether feedback is from an approved tester';
COMMENT ON COLUMN prototype_feedback.detailed_feedback IS 'Rich text detailed feedback';
COMMENT ON COLUMN prototype_feedback.testing_notes IS 'Rich text testing notes';
COMMENT ON COLUMN prototype_feedback.expectations IS 'Rich text user expectations';
COMMENT ON COLUMN prototype_feedback.location_context IS 'JSON context of where feedback was submitted';

-- Success message
SELECT 'Migration 002: Prototype Workflow Enhancement - Completed' AS status;
