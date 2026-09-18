-- Shared, single-use credentials for the user-scoped realtime WebSocket.
--
-- A browser/native client first authenticates over ordinary HTTPS, then uses
-- the returned 30-second ticket in the WebSocket URL.  The raw credential is
-- never stored; atomic DELETE ... RETURNING makes replay impossible even when
-- two backend instances receive the same ticket concurrently.

BEGIN;

CREATE TABLE IF NOT EXISTS realtime_user_event_tickets (
  ticket_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_realtime_user_event_tickets_user_issued
  ON realtime_user_event_tickets (user_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_realtime_user_event_tickets_expires
  ON realtime_user_event_tickets (expires_at);

COMMIT;
