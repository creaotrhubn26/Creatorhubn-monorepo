-- Migration: 084_add_project_state_to_client_gallery_sessions.sql
-- Description: Add projectState column to client_gallery_sessions table for tracking project delivery state
-- Date: 2025-01-XX

-- ============================================================================
-- 1. VERIFY client_gallery_sessions TABLE EXISTS
-- ============================================================================
DO $$
BEGIN
  -- Check if table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'client_gallery_sessions'
  ) THEN
    RAISE EXCEPTION 'client_gallery_sessions table does not exist. Please run showcase migrations first.';
  END IF;

  -- ============================================================================
  -- 2. ADD projectState COLUMN IF IT DOESN'T EXIST
  -- ============================================================================
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'client_gallery_sessions' 
    AND column_name = 'project_state'
  ) THEN
    -- Add the project_state column
    ALTER TABLE client_gallery_sessions 
    ADD COLUMN project_state VARCHAR(20) 
    CHECK (project_state IN ('delivered', 'in_review'))
    DEFAULT 'in_review';
    
    -- Add comment for documentation
    COMMENT ON COLUMN client_gallery_sessions.project_state IS 
    'Project delivery state: delivered (no watermark, download enabled, comments disabled) or in_review (watermarked, download disabled, comments enabled)';
    
    RAISE NOTICE 'Added project_state column to client_gallery_sessions table';
  ELSE
    RAISE NOTICE 'project_state column already exists in client_gallery_sessions table';
  END IF;

  -- ============================================================================
  -- 3. CREATE INDEX FOR PERFORMANCE (if needed)
  -- ============================================================================
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'client_gallery_sessions' 
    AND indexname = 'idx_client_gallery_sessions_project_state'
  ) THEN
    CREATE INDEX idx_client_gallery_sessions_project_state 
    ON client_gallery_sessions(project_state);
    
    RAISE NOTICE 'Created index on project_state for client_gallery_sessions table';
  END IF;

  RAISE NOTICE 'Migration 084_add_project_state_to_client_gallery_sessions completed successfully';
END $$;


























