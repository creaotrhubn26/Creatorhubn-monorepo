CREATE TABLE IF NOT EXISTS capture_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  client_id UUID,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS capture_sessions_owner_idx ON capture_sessions(owner_user_id);
CREATE INDEX IF NOT EXISTS capture_sessions_client_idx ON capture_sessions(client_id);
