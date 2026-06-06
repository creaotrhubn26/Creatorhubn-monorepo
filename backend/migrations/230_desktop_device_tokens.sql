-- Migration 230: desktop_device_tokens
--
-- Long-lived auth-token for Creatorhub-desktop-apper (One Desk).
-- Etter Google OAuth-login mottar appen en device-token som lever
-- 1 år og gir tilgang til /api/desktop/me/* + auto-issuance av
-- per-prosjekt dit_helper_tokens.
--
-- Token-format: `trr_desk_<32-byte-hex>` — prefiks identifiserer typen.
-- Lagres med SHA-256-hash, vises kun ved utstedelse.

CREATE TABLE IF NOT EXISTS desktop_device_tokens (
  id            varchar PRIMARY KEY,
  user_id       varchar NOT NULL,
  user_email    text NOT NULL,
  token_hash    text NOT NULL,
  label         text NOT NULL DEFAULT 'Creatorhub One Desk',
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  last_used_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS desktop_device_tokens_hash_idx
  ON desktop_device_tokens (token_hash);
CREATE INDEX IF NOT EXISTS desktop_device_tokens_user_idx
  ON desktop_device_tokens (user_id);
