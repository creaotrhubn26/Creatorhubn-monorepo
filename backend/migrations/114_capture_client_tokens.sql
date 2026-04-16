CREATE TABLE IF NOT EXISTS capture_client_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES capture_sessions(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  pin_hash VARCHAR(64),
  client_label VARCHAR(255),
  reviewer_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS capture_client_tokens_session_idx ON capture_client_tokens(session_id);
CREATE INDEX IF NOT EXISTS capture_client_tokens_hash_idx ON capture_client_tokens(token_hash);
