-- 0594_role_room_production_continuity.sql
-- Isolated persistence and optimistic-concurrency lane for script supervision.
-- Rich continuity content remains in casting_production_days.data while these
-- columns make ownership, ordering and conflict detection explicit.

ALTER TABLE casting_production_days
  ADD COLUMN IF NOT EXISTS continuity_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS continuity_updated_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS continuity_updated_at TIMESTAMPTZ;

UPDATE casting_production_days
SET continuity_version = 0
WHERE continuity_version IS NULL;

ALTER TABLE casting_production_days
  ALTER COLUMN continuity_version SET DEFAULT 0,
  ALTER COLUMN continuity_version SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_casting_production_days_continuity_updated
  ON casting_production_days(project_id, continuity_updated_at DESC)
  WHERE continuity_updated_at IS NOT NULL;

-- S3 is only object storage. PostgreSQL remains authoritative for project,
-- production-day and scene ownership before any signed URL is issued.
CREATE TABLE IF NOT EXISTS casting_production_continuity_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL
    REFERENCES casting_projects(id) ON DELETE CASCADE,
  production_day_id VARCHAR(255) NOT NULL
    REFERENCES casting_production_days(id) ON DELETE CASCADE,
  scene_id VARCHAR(255) NOT NULL,
  uploaded_by VARCHAR(255),
  storage_provider VARCHAR(20) NOT NULL DEFAULT 'aws_s3'
    CONSTRAINT chk_casting_continuity_media_provider
      CHECK (storage_provider = 'aws_s3'),
  bucket_name TEXT NOT NULL,
  object_key TEXT NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  media_kind VARCHAR(16) NOT NULL
    CONSTRAINT chk_casting_continuity_media_kind
      CHECK (media_kind IN ('photo', 'video')),
  size_bytes BIGINT NOT NULL
    CONSTRAINT chk_casting_continuity_media_size
      CHECK (size_bytes > 0 AND size_bytes <= 262144000),
  content_type VARCHAR(120) NOT NULL
    CONSTRAINT chk_casting_continuity_media_type CHECK (
    content_type IN (
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
      'image/avif', 'video/mp4', 'video/quicktime', 'video/webm'
    )
  ),
  checksum_sha256 CHAR(64) NOT NULL
    CONSTRAINT chk_casting_continuity_media_checksum
      CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_casting_continuity_media_s3_contract CHECK (
    bucket_name = 'the-role-room-prod-745600963362-eu-north-1'
    AND object_key LIKE 'organizations/%'
  ),
  CONSTRAINT uq_casting_continuity_media_provider_key
    UNIQUE (storage_provider, object_key)
);

CREATE INDEX IF NOT EXISTS idx_casting_continuity_media_day_active
  ON casting_production_continuity_media
    (project_id, production_day_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_casting_continuity_media_scene_active
  ON casting_production_continuity_media
    (project_id, scene_id, created_at DESC)
  WHERE deleted_at IS NULL;
