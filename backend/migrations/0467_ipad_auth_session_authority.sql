-- Bind short-lived iPad pairing codes to the exact user session generation
-- that issued them, and migrate still-active native bearers into the
-- canonical session authority before Lead Map starts enforcing it.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtext('0467_ipad_auth_session_authority'));

-- Some non-production databases may still contain the superseded persistent
-- store used by an older pairing implementation. Reset/logout never revoked
-- those rows, so silently copying them could resurrect a credential. Abort
-- before changing schema when an operator must revoke/re-pair them explicitly.
DO $$
DECLARE
  active_legacy_ipad_pairs BIGINT := 0;
BEGIN
  IF to_regclass('public.persistent_auth_sessions') IS NOT NULL THEN
    EXECUTE $legacy$
      SELECT COUNT(*)::bigint
        FROM public.persistent_auth_sessions
       WHERE source = 'ipad_pair'
         AND (expires_at IS NULL OR expires_at > NOW())
    $legacy$ INTO active_legacy_ipad_pairs;

    IF active_legacy_ipad_pairs > 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = format(
          '0467 blocked: %s active legacy ipad_pair sessions require explicit revocation and re-pairing',
          active_legacy_ipad_pairs
        );
    END IF;
  END IF;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN users.is_active IS
  'Global account activation flag enforced by authoritative auth-session resolution.';

ALTER TABLE ipad_pair_tokens
  ADD COLUMN IF NOT EXISTS auth_session_version BIGINT;

COMMENT ON COLUMN ipad_pair_tokens.auth_session_version IS
  'users.auth_session_version captured when the one-time pairing code is issued; NULL pre-migration codes must not be exchanged.';

-- This table historically self-migrated on application startup instead of
-- being owned by a numbered migration. Create the same canonical shape here
-- so a fresh database can run 0467 before the first server process starts.
CREATE TABLE IF NOT EXISTS creatorhub_auth_sessions (
  token TEXT PRIMARY KEY,
  session_data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

ALTER TABLE creatorhub_auth_sessions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_creatorhub_auth_sessions_expires_at
  ON creatorhub_auth_sessions (expires_at);

-- Preserve existing native clients when authoritative checks are enabled for
-- /api/admin-room/lead-map. Pairing rows are deliberately not backfilled: a
-- pending code has no trustworthy issuance snapshot. Only active users and
-- non-revoked long-lived native tokens receive a current canonical snapshot.
INSERT INTO creatorhub_auth_sessions (
  token,
  session_data,
  updated_at,
  expires_at
)
SELECT
  t.token,
  jsonb_build_object(
    'userId', u.id::text,
    'email', u.email::text,
    'name', COALESCE(
      NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
      u.email::text
    ),
    'role', COALESCE(NULLIF(BTRIM(u.role::text), ''), 'user'),
    'loginAt', COALESCE(t.created_at, NOW()),
    'authSessionVersion', u.auth_session_version::text,
    'isAdmin', COALESCE(NULLIF(BTRIM(u.role::text), ''), 'user')
      IN ('admin', 'super_admin')
  ),
  NOW(),
  NOW() + INTERVAL '30 days'
FROM ipad_tokens t
JOIN users u ON u.id::text = t.user_id
WHERE t.revoked_at IS NULL
  AND COALESCE(u.is_active, TRUE) = TRUE
  AND NULLIF(BTRIM(u.email::text), '') IS NOT NULL
ON CONFLICT (token) DO NOTHING;

COMMIT;
