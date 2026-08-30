-- Race-safe global session revocation.
--
-- A delete-only revocation can be defeated when a concurrent login reads the
-- user first and persists its session after the delete commits. Every minted
-- session therefore snapshots this counter; security-sensitive requests join
-- back to users and require an exact match.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtext('0464_users_auth_session_version'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_session_version BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN users.auth_session_version IS
  'Monotonic generation copied into auth session snapshots; increment to revoke every older session race-safely.';

COMMIT;
