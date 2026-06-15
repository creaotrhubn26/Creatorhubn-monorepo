-- 279_error_log.sql
--
-- Sentry-erstatning i Neon. Lagrer backend- og frontend-errors med nok
-- kontekst til å feilsøke uten å besøke en ekstern tjeneste.
--
-- Sentry-features vi erstatter:
--   - Aggregering per "fingerprint" (samme feil = samme rad, increment count)
--   - User-context (email + user_id)
--   - Request-meta (endpoint, IP, user agent)
--   - Stack trace
--   - Clarity-session-link for å hoppe rett til skjerm-replay
--   - "Mark as resolved" med audit
--
-- Ingen ekstern avhengighet. All data forblir i Neon.

BEGIN;

CREATE TABLE IF NOT EXISTS error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Klassifisering
  level VARCHAR(10) NOT NULL DEFAULT 'error'
    CHECK (level IN ('error', 'warning', 'info')),
  source VARCHAR(10) NOT NULL DEFAULT 'backend'
    CHECK (source IN ('backend', 'frontend')),
  status_code INT,

  -- Identifikasjon
  endpoint TEXT,
  message TEXT NOT NULL,
  error_name TEXT,
  stack TEXT,

  -- Fingerprint for aggregering: hash(source+endpoint+errorName+stack-første-linje)
  -- Samme fingerprint → increment occurrence_count
  fingerprint VARCHAR(64) NOT NULL,

  -- Kontekst
  user_id VARCHAR(255),
  user_email TEXT,
  clarity_session_id TEXT,
  ip TEXT,
  user_agent TEXT,
  url TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Lifecycle
  occurrence_count INT NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id VARCHAR(255),
  resolved_note TEXT,

  UNIQUE (fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_error_log_last_seen ON error_log (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_log_unresolved ON error_log (last_seen_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_error_log_endpoint ON error_log (endpoint) WHERE endpoint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_error_log_user_email ON error_log (user_email) WHERE user_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_error_log_status ON error_log (status_code) WHERE status_code IS NOT NULL;

COMMIT;
