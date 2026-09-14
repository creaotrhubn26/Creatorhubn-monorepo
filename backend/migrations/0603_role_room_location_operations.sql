CREATE TABLE IF NOT EXISTS role_room_location_operations (
  id VARCHAR(255) PRIMARY KEY NOT NULL,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  location_id VARCHAR(255) NOT NULL REFERENCES casting_locations(id) ON DELETE CASCADE,
  operations JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 0,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS role_room_location_operations_project_location_uidx
  ON role_room_location_operations(project_id, location_id);

CREATE INDEX IF NOT EXISTS role_room_location_operations_project_updated_idx
  ON role_room_location_operations(project_id, updated_at DESC);

-- Private scout photos. PostgreSQL remains authoritative for project and
-- location ownership before a signed S3 URL is issued.
CREATE TABLE IF NOT EXISTS casting_location_scout_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  location_id VARCHAR(255) NOT NULL REFERENCES casting_locations(id) ON DELETE CASCADE,
  uploaded_by VARCHAR(255),
  storage_provider VARCHAR(20) NOT NULL DEFAULT 'aws_s3'
    CONSTRAINT chk_casting_location_scout_media_provider CHECK (storage_provider = 'aws_s3'),
  bucket_name TEXT NOT NULL,
  object_key TEXT NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  size_bytes BIGINT NOT NULL
    CONSTRAINT chk_casting_location_scout_media_size CHECK (size_bytes > 0 AND size_bytes <= 26214400),
  content_type VARCHAR(120) NOT NULL
    CONSTRAINT chk_casting_location_scout_media_type CHECK (
      content_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif')
    ),
  checksum_sha256 CHAR(64) NOT NULL
    CONSTRAINT chk_casting_location_scout_media_checksum CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_casting_location_scout_media_s3_contract CHECK (
    bucket_name = 'the-role-room-prod-745600963362-eu-north-1'
    AND object_key LIKE 'organizations/%'
  ),
  CONSTRAINT uq_casting_location_scout_media_provider_key UNIQUE (storage_provider, object_key)
);

CREATE INDEX IF NOT EXISTS idx_casting_location_scout_media_active
  ON casting_location_scout_media(project_id, location_id, created_at DESC)
  WHERE deleted_at IS NULL;
