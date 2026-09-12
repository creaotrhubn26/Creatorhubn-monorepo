-- 280_persistent_sessions.sql
--
-- Persistent session-storage. Backend-restart vasker bort in-memory
-- activeSessions-Map; denne tabellen lar oss restore aktive sessions
-- ved oppstart slik at Daniel slipper å re-logge etter hver redeploy.
--
-- Brukes initielt av super-admin emergency-login. Andre login-flyter
-- (Google OAuth, /api/auth/login) kan opt-in senere.

BEGIN;

CREATE TABLE IF NOT EXISTS persistent_auth_sessions (
  token VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  email TEXT,
  role VARCHAR(50),
  source VARCHAR(40) NOT NULL DEFAULT 'unknown',
    -- 'emergency_login' | 'google_oauth' | 'password' | 'admin_impersonate'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ip TEXT,
  user_agent TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_persistent_sessions_expires
  ON persistent_auth_sessions (expires_at)
  WHERE expires_at > NOW();

CREATE INDEX IF NOT EXISTS idx_persistent_sessions_user
  ON persistent_auth_sessions (user_id);

COMMIT;
