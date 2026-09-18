-- migration-role: creatorhub_migrator
-- Durable pairing, idempotent bounce ingestion and replayable EaseVerse sync.

CREATE TABLE IF NOT EXISTS protools_companion_pairing_codes (
  code_hash CHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  workspace_project_id VARCHAR(160),
  audio_review_project_id UUID,
  easeverse_track_id VARCHAR(160),
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ptc_pairing_codes_expires
  ON protools_companion_pairing_codes (expires_at);

CREATE TABLE IF NOT EXISTS protools_companion_rate_limits (
  scope VARCHAR(80) NOT NULL,
  subject_hash CHAR(64) NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, subject_hash, window_started_at)
);

ALTER TABLE protools_companion_sessions
  ADD COLUMN IF NOT EXISTS workspace_project_id VARCHAR(160),
  ADD COLUMN IF NOT EXISTS easeverse_project_id VARCHAR(160),
  ADD COLUMN IF NOT EXISTS device_token_id VARCHAR(160),
  ADD COLUMN IF NOT EXISTS sync_revision BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_easeverse_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_easeverse_sync_status VARCHAR(24),
  ADD COLUMN IF NOT EXISTS last_easeverse_sync_error TEXT;

ALTER TABLE protools_companion_bounces
  ADD COLUMN IF NOT EXISTS client_event_id VARCHAR(240),
  ADD COLUMN IF NOT EXISTS content_fingerprint VARCHAR(400),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS uq_ptc_bounces_session_event
  ON protools_companion_bounces (session_id, client_event_id)
  WHERE client_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS protools_easeverse_sync_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  event_id VARCHAR(240) NOT NULL UNIQUE,
  event_type VARCHAR(40) NOT NULL,
  revision BIGINT NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ptc_easeverse_outbox_pending
  ON protools_easeverse_sync_outbox (status, next_attempt_at, created_at);

