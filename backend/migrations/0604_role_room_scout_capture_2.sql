ALTER TABLE casting_location_scout_media
  ADD COLUMN IF NOT EXISTS client_upload_id UUID,
  ADD COLUMN IF NOT EXISTS media_kind VARCHAR(20) NOT NULL DEFAULT 'photo',
  ADD COLUMN IF NOT EXISTS capture_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE casting_location_scout_media
  DROP CONSTRAINT IF EXISTS chk_casting_location_scout_media_size,
  DROP CONSTRAINT IF EXISTS chk_casting_location_scout_media_type;

ALTER TABLE casting_location_scout_media
  ADD CONSTRAINT chk_casting_location_scout_media_size
    CHECK (size_bytes > 0 AND size_bytes <= 262144000),
  ADD CONSTRAINT chk_casting_location_scout_media_type
    CHECK (content_type IN (
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif',
      'video/mp4', 'video/quicktime', 'video/webm',
      'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a'
    )),
  ADD CONSTRAINT chk_casting_location_scout_media_kind
    CHECK (media_kind IN ('photo', 'video', 'audio', 'panorama'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_casting_location_scout_media_client_upload
  ON casting_location_scout_media(project_id, location_id, client_upload_id)
  WHERE client_upload_id IS NOT NULL;
