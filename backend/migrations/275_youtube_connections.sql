-- 275_youtube_connections.sql
--
-- Per-bruker YouTube-kanaltilkobling for å publisere visualizer/offisiell video
-- rett fra Audio Showcase (YouTube Data API v3, videos.insert). refresh_token
-- lagres kryptert (AES-256-GCM med GOOGLE_TOKEN_ENCRYPTION_KEY).

CREATE TABLE IF NOT EXISTS youtube_connections (
  user_id            TEXT PRIMARY KEY,
  channel_id         TEXT,
  channel_title      TEXT,
  refresh_token_enc  TEXT,            -- kryptert
  scope              TEXT,
  connected_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sporer publiserte videoer per release (idempotens + visning av lenke).
CREATE TABLE IF NOT EXISTS youtube_publications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id    UUID,
  user_id       TEXT NOT NULL,
  video_id      TEXT,
  video_url     TEXT,
  privacy       TEXT,
  status        TEXT NOT NULL DEFAULT 'uploaded',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_youtube_pub_release ON youtube_publications (release_id);
