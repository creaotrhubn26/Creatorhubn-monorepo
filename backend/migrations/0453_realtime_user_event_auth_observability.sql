-- Privacy-safe adoption telemetry for the user-events WebSocket.
--
-- Tickets retain only a fixed client kind and a short build version. Accepted
-- connections are aggregated hourly without user ids, credentials, IPs or
-- user agents so operators can prove legacy-token traffic has reached zero.

BEGIN;

ALTER TABLE realtime_user_event_tickets
  ADD COLUMN IF NOT EXISTS client_kind TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS client_version TEXT;

CREATE TABLE IF NOT EXISTS realtime_user_event_auth_metrics (
  bucket_start TIMESTAMPTZ NOT NULL,
  auth_method TEXT NOT NULL CHECK (auth_method IN ('ticket', 'legacy')),
  client_kind TEXT NOT NULL CHECK (client_kind IN ('web', 'capture-ios', 'unknown')),
  connection_count BIGINT NOT NULL DEFAULT 0 CHECK (connection_count >= 0),
  last_seen_at TIMESTAMPTZ NOT NULL,
  last_client_version TEXT,
  PRIMARY KEY (bucket_start, auth_method, client_kind)
);

CREATE INDEX IF NOT EXISTS idx_realtime_user_event_auth_metrics_seen
  ON realtime_user_event_auth_metrics (last_seen_at DESC);

COMMIT;
