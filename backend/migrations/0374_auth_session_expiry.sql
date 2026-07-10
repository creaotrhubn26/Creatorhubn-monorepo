-- 0374_auth_session_expiry.sql
-- Add a global TTL to persisted auth sessions (creatorhub_auth_sessions).
--
-- Background: sessions in this table previously had NO expiry — a persisted
-- session token was valid forever. This adds a sliding 30-day TTL, enforced in
-- auth-session-store.ts (load/hydrate reject expired rows; each successful use
-- renews the window). Impersonation sessions keep their own, shorter, per-request
-- TTL (enforced separately in index.ts) — this 30-day outer bound never loosens it.
--
-- Deploy ordering: SAFE either way. auth-session-store.ts self-migrates this
-- column at runtime (ADD COLUMN IF NOT EXISTS in ensureAuthSessionTable), so the
-- code tolerates the pre-migration state. This file is the canonical record and
-- backfills/indexes explicitly.

ALTER TABLE creatorhub_auth_sessions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Backfill existing rows to expire 30 days from now so no live session is
-- logged out at deploy time (do NOT base this on updated_at, which would
-- instantly expire older-but-active sessions).
UPDATE creatorhub_auth_sessions
  SET expires_at = NOW() + INTERVAL '30 days'
  WHERE expires_at IS NULL;

-- Cheap expiry filtering + future cleanup jobs.
CREATE INDEX IF NOT EXISTS idx_creatorhub_auth_sessions_expires_at
  ON creatorhub_auth_sessions (expires_at);
