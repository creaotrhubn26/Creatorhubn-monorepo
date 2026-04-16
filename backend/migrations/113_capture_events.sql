CREATE TABLE IF NOT EXISTS capture_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES capture_sessions(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES capture_assets(id) ON DELETE CASCADE,
  actor_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS capture_events_session_idx ON capture_events(session_id, created_at);
CREATE INDEX IF NOT EXISTS capture_events_asset_idx ON capture_events(asset_id);
