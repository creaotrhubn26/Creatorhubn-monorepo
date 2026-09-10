-- Durable delivery and tenant identity for CreatorHub Pro Tools Companion.

ALTER TABLE protools_companion_sessions
  ADD COLUMN IF NOT EXISTS organization_id VARCHAR(160),
  ADD COLUMN IF NOT EXISTS integration_owner_user_id VARCHAR(64);

UPDATE protools_companion_sessions
   SET integration_owner_user_id=user_id
 WHERE integration_owner_user_id IS NULL;

ALTER TABLE protools_easeverse_sync_outbox
  ADD COLUMN IF NOT EXISTS lock_token UUID,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dead_letter_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ptc_easeverse_outbox_lease
  ON protools_easeverse_sync_outbox(status, next_attempt_at, locked_at, created_at);

CREATE TABLE IF NOT EXISTS protools_companion_worker_heartbeat (
  worker_name VARCHAR(80) PRIMARY KEY,
  instance_id VARCHAR(160) NOT NULL,
  last_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  processed_count BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS creatorhub_music_sync_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(240) NOT NULL UNIQUE,
  user_id VARCHAR(64) NOT NULL,
  source_id VARCHAR(160) NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  dead_letter_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creatorhub_music_sync_outbox_due_idx
  ON creatorhub_music_sync_outbox(status, next_attempt_at, locked_at, created_at);
