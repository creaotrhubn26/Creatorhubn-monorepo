-- Formalize the users.is_active contract already present in the Drizzle
-- snapshot and consumed by authentication/customer-success code.
--
-- Older production databases never received a versioned migration for this
-- column. Keep the expansion idempotent, backfill existing accounts as active,
-- and only then enforce the default/not-null contract.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE users
  ALTER COLUMN is_active SET DEFAULT TRUE;

UPDATE users
   SET is_active = TRUE
 WHERE is_active IS NULL;

ALTER TABLE users
  ALTER COLUMN is_active SET NOT NULL;

COMMENT ON COLUMN users.is_active IS
  'Whether the account may authenticate. FALSE blocks new and existing native Leadgrid sessions.';

COMMIT;
