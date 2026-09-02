-- 0494_auth_verification_runtime_schema.sql
--
-- Canonical persistence for the authentication services reached by Role Room.
-- These tables were previously created only when the corresponding endpoint
-- happened to run. The TOTP replay window column is also reconciled because
-- older runtime-created tables do not gain columns through CREATE IF NOT EXISTS.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(hashtext('0494_auth_verification_runtime_schema'));

CREATE TABLE IF NOT EXISTS user_totp_secrets (
  user_id TEXT PRIMARY KEY,
  secret_encrypted TEXT NOT NULL,
  enabled_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  last_used_window BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE user_totp_secrets
  ADD COLUMN IF NOT EXISTS last_used_window BIGINT;

CREATE TABLE IF NOT EXISTS user_totp_backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_totp_backup_codes_user
  ON user_totp_backup_codes (user_id, used_at);

CREATE TABLE IF NOT EXISTS email_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT
);

-- Preserve the newest active code and invalidate any historical duplicates
-- before enforcing the same invariant for concurrent sends.
WITH ranked_active_codes AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY LOWER(email), purpose
           ORDER BY created_at DESC, id DESC
         ) AS duplicate_rank
    FROM email_verification_codes
   WHERE used_at IS NULL
)
UPDATE email_verification_codes AS code
   SET used_at = NOW()
  FROM ranked_active_codes AS ranked
 WHERE code.id = ranked.id
   AND ranked.duplicate_rank > 1;

CREATE INDEX IF NOT EXISTS idx_email_verif_codes_email_purpose
  ON email_verification_codes (LOWER(email), purpose, used_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_verif_codes_one_active
  ON email_verification_codes (LOWER(email), purpose)
  WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_email_verif_codes_expiry
  ON email_verification_codes (expires_at)
  WHERE used_at IS NULL;

COMMIT;
