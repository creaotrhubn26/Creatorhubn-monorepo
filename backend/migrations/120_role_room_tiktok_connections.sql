-- TikTok-tilkoblinger for produsenter. Speiler role_room_linkedin_connections-
-- shapen så token-refresh-worker, dispatcher og insights-worker kan dele
-- mønster på tvers av plattformer.
--
-- Konseptuelt: én produsent kan ha én TikTok-konto koblet (samme som
-- LinkedIn-mønsteret). Brand-konto-oppdagelse skjer ved publish-tid via
-- /v2/user/info i stedet for å lagre flere rader.

BEGIN;

CREATE TABLE IF NOT EXISTS role_room_tiktok_connections (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  role_room_email VARCHAR(255),
  -- Open ID er TikToks stabile bruker-ID per app. Union ID krever
  -- separat scope og kan brukes til cross-app ID hvis vi senere lager
  -- flere TikTok-apps for samme business.
  tiktok_open_id VARCHAR(255),
  tiktok_union_id VARCHAR(255),
  tiktok_username VARCHAR(255),
  tiktok_display_name VARCHAR(255),
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  expiry_date TIMESTAMPTZ,
  refresh_expiry_date TIMESTAMPTZ,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  connection_state VARCHAR(32) NOT NULL DEFAULT 'disconnected',
  last_error TEXT,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_tiktok_connections_user_id_unique
  ON role_room_tiktok_connections(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_tiktok_connections_open_id_unique
  ON role_room_tiktok_connections(tiktok_open_id);

COMMIT;
