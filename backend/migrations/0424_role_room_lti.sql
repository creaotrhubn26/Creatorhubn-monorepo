-- 0424_role_room_lti.sql
-- LTI 1.3 Advantage — tool-side registrering + launch-kontekst for grade-passback
-- til LMS-karakterbok (AGS). Canvas først. Aktiveres når en plattform er
-- registrert (super-admin) + tool-nøkkel generert (lat, ved første /lti/jwks).

-- Vårt tool-nøkkelpar (RSA). Én aktiv rad; public_jwk eksponeres via /lti/jwks.
CREATE TABLE IF NOT EXISTS role_room_lti_tool_keys (
  id          TEXT PRIMARY KEY,
  kid         TEXT NOT NULL,
  private_pem TEXT NOT NULL,
  public_jwk  JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Registrert LMS-plattform (per Canvas-instans). Fylles av super-admin.
CREATE TABLE IF NOT EXISTS role_room_lti_platforms (
  id             TEXT PRIMARY KEY,
  owner_user_id  VARCHAR(255) NOT NULL,
  name           TEXT,
  issuer         TEXT NOT NULL,
  client_id      TEXT NOT NULL,
  deployment_id  TEXT,
  auth_login_url TEXT NOT NULL,   -- plattformens OIDC auth-endepunkt
  token_url      TEXT NOT NULL,   -- OAuth2 token-endepunkt (for AGS)
  jwks_url       TEXT NOT NULL,   -- plattformens offentlige nøkler
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (issuer, client_id)
);

-- OIDC-state (CSRF) for launch-dansen. Kortlevd.
CREATE TABLE IF NOT EXISTS role_room_lti_states (
  state       TEXT PRIMARY KEY,
  nonce       TEXT NOT NULL,
  platform_id TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lagret launch-kontekst → AGS-endepunkter for senere grade-passback.
CREATE TABLE IF NOT EXISTS role_room_lti_launches (
  id               TEXT PRIMARY KEY,
  platform_id      TEXT NOT NULL REFERENCES role_room_lti_platforms(id) ON DELETE CASCADE,
  lti_user_sub     TEXT,
  context_id       TEXT,
  resource_link_id TEXT,
  ags_lineitems    TEXT,
  ags_lineitem     TEXT,
  ags_scopes       JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_lti_launches_platform
  ON role_room_lti_launches (platform_id, created_at DESC);
