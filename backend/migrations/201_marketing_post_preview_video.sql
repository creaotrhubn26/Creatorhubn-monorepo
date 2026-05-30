-- 201_marketing_post_preview_video.sql
-- Klient skal kunne se Bjarne's rendret klipp DIREKTE i klient-portalen
-- ved siden av kommentar-feltet.
--
-- To pipelines (begge støttes — runtime velger):
--   1. Cloudflare Stream (primær): auto-transcoding til HLS, adaptive
--      bitrate, posterframe. Bjarne laster én fil, klient streamer
--      adaptivt. Krever CLOUDFLARE_STREAM_API_TOKEN.
--   2. R2 (fallback): rå mp4-fil, signed URL, ingen transcoding.
--      Brukes hvis Stream ikke er konfigurert.

ALTER TABLE role_room_marketing_plan_posts
  -- Cloudflare Stream (primær)
  ADD COLUMN IF NOT EXISTS preview_stream_uid TEXT,
  ADD COLUMN IF NOT EXISTS preview_stream_ready BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS preview_stream_playback_url TEXT,
  ADD COLUMN IF NOT EXISTS preview_stream_thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS preview_stream_duration_sec NUMERIC(10,3),
  -- R2 fallback
  ADD COLUMN IF NOT EXISTS preview_video_key TEXT,
  ADD COLUMN IF NOT EXISTS preview_video_url TEXT,
  -- Felles
  ADD COLUMN IF NOT EXISTS preview_video_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS preview_video_mime TEXT,
  ADD COLUMN IF NOT EXISTS preview_video_bytes BIGINT;

COMMENT ON COLUMN role_room_marketing_plan_posts.preview_stream_uid IS
  'Cloudflare Stream video UID. Når satt har klient adaptive HLS-playback.';
COMMENT ON COLUMN role_room_marketing_plan_posts.preview_stream_ready IS
  'True når Cloudflare Stream har transcoded videoen og den kan spilles.';
COMMENT ON COLUMN role_room_marketing_plan_posts.preview_video_key IS
  'R2 fallback. Brukes kun hvis Stream ikke er konfigurert.';
