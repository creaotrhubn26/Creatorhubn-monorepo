CREATE TABLE IF NOT EXISTS capture_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES capture_sessions(id) ON DELETE CASCADE,
  original_filename VARCHAR(512) NOT NULL,
  capture_time TIMESTAMPTZ NOT NULL,

  preview_key VARCHAR(1024),
  full_key VARCHAR(1024),
  raw_key VARCHAR(1024),
  checksum_sha256 VARCHAR(64),
  mime VARCHAR(128) NOT NULL,
  size_bytes BIGINT,

  state VARCHAR(32) NOT NULL DEFAULT 'anticipated',
  signals JSONB NOT NULL DEFAULT '{}'::jsonb,

  rating INTEGER NOT NULL DEFAULT 0,
  color_label VARCHAR(16),
  flagged_for_client BOOLEAN NOT NULL DEFAULT FALSE,
  rejected BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS capture_assets_session_idx ON capture_assets(session_id, capture_time);
CREATE INDEX IF NOT EXISTS capture_assets_state_idx ON capture_assets(state);
