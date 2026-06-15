-- 282_audio_gcal_sync.sql
--
-- Automatisk toveis Google Calendar-synk per produsent. Lagrer inkrementell
-- syncToken (events.list) + watch-kanal (events.watch → webhook for umiddelbar
-- synk). Polling-cron bruker samme syncToken som robust fallback når webhook
-- ikke er aktiv (kanal utløpt / domene ikke verifisert ennå).

CREATE TABLE IF NOT EXISTS audio_gcal_sync (
  owner_user_id      TEXT PRIMARY KEY,
  auto_enabled       BOOLEAN NOT NULL DEFAULT false,
  sync_token         TEXT,                 -- Google nextSyncToken for inkrementell list
  channel_id         TEXT,                 -- vår watch-kanal-id (events.watch)
  channel_token      TEXT,                 -- hemmelig token validert på webhook
  resource_id        TEXT,                 -- Googles resourceId (for channels.stop)
  channel_expiration TIMESTAMPTZ,          -- når watch-kanalen utløper (fornyes av cron)
  last_synced_at     TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audio_gcal_sync_channel ON audio_gcal_sync (channel_id);
CREATE INDEX IF NOT EXISTS idx_audio_gcal_sync_enabled ON audio_gcal_sync (auto_enabled) WHERE auto_enabled = true;
