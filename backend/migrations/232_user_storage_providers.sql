-- Migration 232: user_storage_providers
--
-- Per-bruker S3-kompatible storage-creds. Én rad per (user, provider,
-- account_label). Bruker AES-256-GCM-kryptering med samme keyring som
-- Google-token-encryption (CREATORHUB_GOOGLE_TOKEN_ENCRYPTION_KEY,
-- fallback ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY → JWT_SECRET).
--
-- Sikkerhets-prinsipp: aldri returnert som plaintext til frontend.
-- One Desk får dekryptert variant via Bearer helper-token mot
-- /api/dit/projects/:id/destinations/with-creds (separat endepunkt,
-- ikke samme som admin-listingen).

CREATE TABLE IF NOT EXISTS user_storage_providers (
  id varchar PRIMARY KEY,
  user_id varchar NOT NULL,
  provider varchar(32) NOT NULL,
  -- Brukerens eget visningsnavn ("hovedkonto", "backup-konto-2")
  account_label text NOT NULL,
  key_id_encrypted text NOT NULL,
  application_key_encrypted text NOT NULL,
  -- Tidspunkt hvor vi sist verifiserte at credsen autoriserer mot B2.
  -- NULL = aldri validert (skal aldri skje pga POST-flow, men nullable
  -- for sikkerhets skyld ved manuelle DB-inserts).
  validated_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_storage_providers_unique
  ON user_storage_providers (user_id, provider, account_label);

CREATE INDEX IF NOT EXISTS user_storage_providers_user_idx
  ON user_storage_providers (user_id);
