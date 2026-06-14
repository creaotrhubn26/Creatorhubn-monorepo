-- 275_youtube_publications.sql
--
-- Sporer YouTube-videoer publisert fra en release (Audio Showcase). Selve
-- Google/YouTube-tilkoblingen gjenbrukes fra eksisterende youtube-routes
-- (createYouTubeRouter / buildAuthorizedYoutubeClient) — ingen egen token-tabell.

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
