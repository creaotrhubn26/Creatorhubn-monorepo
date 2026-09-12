-- 0436_role_room_mcp_oauth.sql
--
-- OAuth 2.1 Authorization Server for The Role Room MCP («Sign in with The Role
-- Room»). Selv-heles også lat i koden (ensureOAuthTables) — denne er for journalen.

CREATE TABLE IF NOT EXISTS role_room_mcp_oauth_clients (
  client_id     TEXT PRIMARY KEY,
  client_name   TEXT,
  redirect_uris TEXT[] NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_room_mcp_oauth_codes (
  code_hash      TEXT PRIMARY KEY,
  client_id      TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  redirect_uri   TEXT NOT NULL,
  scope          TEXT[] NOT NULL,
  code_challenge TEXT NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_room_mcp_oauth_tokens (
  token_hash TEXT PRIMARY KEY,
  client_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  scope      TEXT[] NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
