BEGIN;

CREATE TABLE IF NOT EXISTS role_room_linkedin_connections (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  role_room_email VARCHAR(255),
  linkedin_member_id VARCHAR(255),
  linkedin_email VARCHAR(255),
  linkedin_name VARCHAR(255),
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  expiry_date TIMESTAMPTZ,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  connection_state VARCHAR(32) NOT NULL DEFAULT 'disconnected',
  last_error TEXT,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_linkedin_connections_user_id_unique
  ON role_room_linkedin_connections(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_linkedin_connections_member_id_unique
  ON role_room_linkedin_connections(linkedin_member_id);
CREATE INDEX IF NOT EXISTS idx_rr_linkedin_connections_email
  ON role_room_linkedin_connections(linkedin_email);

COMMIT;
