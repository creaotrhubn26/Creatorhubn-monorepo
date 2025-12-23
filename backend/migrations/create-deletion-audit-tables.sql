-- ⭐ GDPR Compliance: Deletion Audit Tables
-- Created: October 8, 2025
-- Purpose: Track all user data deletions for legal compliance

-- 1. Deletion Audit Log (must be kept indefinitely for GDPR Article 30)
CREATE TABLE IF NOT EXISTS deletion_audit_log (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  deleted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_tables JSONB NOT NULL,
  deletion_reason TEXT NOT NULL,
  deleted_by VARCHAR(255) NOT NULL,
  errors_encountered JSONB,
  data_size_mb INTEGER,
  backup_created BOOLEAN DEFAULT FALSE,
  backup_location TEXT,
  legal_retention_kept JSONB
);

-- Ensure indexes exist without errors on re-run
CREATE INDEX IF NOT EXISTS idx_deletion_audit_user_id ON deletion_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_deletion_audit_deleted_at ON deletion_audit_log(deleted_at DESC);

-- 2. Deletion Failures (for monitoring and retry)
CREATE TABLE IF NOT EXISTS deletion_failures (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  attempted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  error TEXT NOT NULL,
  tables_deleted JSONB,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  resolution TEXT
);

-- Backfill columns if table already existed without them
ALTER TABLE deletion_failures
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS resolution TEXT;

-- Ensure indexes exist without errors on re-run
CREATE INDEX IF NOT EXISTS idx_deletion_failures_user_id ON deletion_failures(user_id);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'deletion_failures' 
      AND column_name = 'resolved_at'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_deletion_failures_unresolved ON deletion_failures(resolved_at) WHERE resolved_at IS NULL';
  END IF;
END $$;

-- 3. Cleanup Job Logs (for monitoring cron job execution)
CREATE TABLE IF NOT EXISTS cleanup_job_logs (
  id SERIAL PRIMARY KEY,
  run_at TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(50) NOT NULL,
  deleted_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  error TEXT,
  details JSONB,
  duration_ms INTEGER
);

-- Backfill columns if table already existed without them
ALTER TABLE cleanup_job_logs
  ADD COLUMN IF NOT EXISTS run_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS deleted_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error TEXT,
  ADD COLUMN IF NOT EXISTS details JSONB,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

-- Ensure indexes exist without errors on re-run
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'cleanup_job_logs' 
      AND column_name = 'run_at'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cleanup_job_logs_run_at ON cleanup_job_logs(run_at DESC)';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_cleanup_job_logs_status ON cleanup_job_logs(status);

-- 4. Deletion Requests (user-initiated deletion requests)
CREATE TABLE IF NOT EXISTS deletion_requests (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  request_type VARCHAR(50) NOT NULL,
  reason TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  completed_at TIMESTAMP,
  data_export_created BOOLEAN DEFAULT FALSE,
  data_export_url TEXT
);

-- Ensure indexes exist without errors on re-run
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user_id ON deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON deletion_requests(status);

-- Add comments for documentation
COMMENT ON TABLE deletion_audit_log IS 'GDPR Article 30: Records of processing activities - Must be kept indefinitely';
COMMENT ON TABLE deletion_failures IS 'Tracks failed deletion attempts for monitoring and retry';
COMMENT ON TABLE cleanup_job_logs IS 'Monitors automated cleanup job execution';
COMMENT ON TABLE deletion_requests IS 'User-initiated deletion requests (GDPR Article 17)';

-- Success message
SELECT 'Deletion audit tables created successfully' AS status;
