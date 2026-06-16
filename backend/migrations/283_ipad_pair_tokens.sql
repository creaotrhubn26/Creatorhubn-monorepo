-- 283_ipad_pair_tokens.sql
--
-- Kort-levd parings-token for iPad-apper. Brukeren genererer i web
-- (Admin Room / Lead Map "iPad-paring"-knapp), iPad-en bytter via
-- /api/ipad-tokens/exchange mot et permanent bearer-token som
-- lagres i persistent_auth_sessions (mig 280).
--
-- Flyt:
--   1. Bruker (web, autentisert) → POST /admin-room/ipad-tokens/generate
--      → 8-tegns kode + QR-data. TTL: 5 min.
--   2. iPad → POST /ipad-tokens/exchange m/ kode
--      → server validerer + sletter kode + oppretter bearer i
--        persistent_auth_sessions, returnerer bearer-token + user-info.
--   3. iPad lagrer bearer i Keychain.
--
-- Sikkerhet:
--   - Token er 32-byte random (urlsafe base64), kort visuell
--     8-tegns versjon for manuell inntasting.
--   - One-shot: slettes ved første vellykkede exchange.
--   - 5-min TTL minimaliserer vinduet for shoulder-surfing.
--   - Bundle device-info (model, OS, app-version) ved exchange for
--     audit.

BEGIN;

CREATE TABLE IF NOT EXISTS ipad_pair_tokens (
  token VARCHAR(128) PRIMARY KEY,
  short_code VARCHAR(16) NOT NULL UNIQUE,
  user_id VARCHAR(255) NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  device_info JSONB
);

CREATE INDEX IF NOT EXISTS idx_ipad_pair_tokens_short_code
  ON ipad_pair_tokens (short_code)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ipad_pair_tokens_user
  ON ipad_pair_tokens (user_id, created_at DESC);

-- Periodisk cleanup-job sletter brukte + utløpte tokens (manuell for nå)

COMMIT;
