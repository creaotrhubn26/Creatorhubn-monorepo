-- 0337_ipad_tokens.sql
--
-- Bearer-token-lagring for iPad-app Google Sign-In + andre native
-- innloggings-flyter. Refereres av:
--   - backend/server/leadgrid-google-auth-routes.ts (Google exchange)
--
-- Tabellen var aldri opprettet i en migrasjon — koden INSERTet i en
-- ikke-eksisterende tabell og kastet 500 «google_auth_failed» til iPad.
-- Denne migrasjonen lager den, og er idempotent.
--
-- Mønsteret er bevisst enklere enn `ipad_pair_tokens` (som er for
-- web→iPad-paringskode-flyt med kort_kode + utløp). Denne tabellen er
-- for langlevende bearer-tokens etter innlogging.

CREATE TABLE IF NOT EXISTS ipad_tokens (
  token         VARCHAR(128) PRIMARY KEY,
  user_id       VARCHAR(255) NOT NULL,
  device_name   VARCHAR(255),
  device_model  VARCHAR(120),
  os_version    VARCHAR(40),
  app_version   VARCHAR(40),
  source        VARCHAR(40) DEFAULT 'google_signin',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ipad_tokens_user
  ON ipad_tokens (user_id, revoked_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ipad_tokens_source
  ON ipad_tokens (source);

COMMENT ON TABLE ipad_tokens IS
  'Langlevende bearer-tokens for iPad-native innlogging (Google Sign-In, pairing-kode-exchange m.fl.). Token brukes som Authorization: Bearer-header. Revoker ved å sette revoked_at.';
