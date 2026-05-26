-- Ekte presence-tracking for Role Room-brukere
--
-- Klienten POSTer til /api/presence/heartbeat hvert 30 sek mens tab er
-- aktiv (sjekker document.visibilityState). Vi lagrer siste-sett-tidspunkt,
-- rute brukeren er på, og evt. om de er idle (15+ min uten input).
--
-- Aktive-nå-query: last_seen_at > NOW() - INTERVAL '90 seconds'

CREATE TABLE IF NOT EXISTS user_presence (
  user_id UUID PRIMARY KEY,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_route VARCHAR(200),
  is_idle BOOLEAN NOT NULL DEFAULT FALSE,
  user_agent_short VARCHAR(80),
  session_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_session_count INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen
  ON user_presence (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_presence_active
  ON user_presence (last_seen_at DESC)
  WHERE is_idle = FALSE;
