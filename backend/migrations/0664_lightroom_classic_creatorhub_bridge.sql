-- Lightroom Classic exports always land in private CreatorHub S3 first.
-- Google Drive is an optional, private mirror and never the source of truth.

CREATE TABLE IF NOT EXISTS lightroom_integration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(255) NOT NULL,
  plugin_token_hash text,
  plugin_version varchar(32) NOT NULL DEFAULT '1.1.0',
  drive_root_folder_id varchar(255),
  drive_root_folder_name varchar(255),
  drive_root_folder_url text,
  last_sync_at timestamptz,
  last_showcase_item_id varchar(255),
  last_drive_file_id varchar(255),
  last_error text,
  sync_status varchar(64) NOT NULL DEFAULT 'idle',
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lightroom_integration
  ADD COLUMN IF NOT EXISTS user_id varchar(255),
  ADD COLUMN IF NOT EXISTS plugin_token_hash text,
  ADD COLUMN IF NOT EXISTS plugin_version varchar(32) DEFAULT '1.1.0',
  ADD COLUMN IF NOT EXISTS drive_root_folder_id varchar(255),
  ADD COLUMN IF NOT EXISTS drive_root_folder_name varchar(255),
  ADD COLUMN IF NOT EXISTS drive_root_folder_url text,
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_showcase_item_id varchar(255),
  ADD COLUMN IF NOT EXISTS last_drive_file_id varchar(255),
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS sync_status varchar(64) DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS configuration jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lightroom_integration_user_id
  ON lightroom_integration(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lightroom_integration_token_hash
  ON lightroom_integration(plugin_token_hash)
  WHERE plugin_token_hash IS NOT NULL;
ALTER TABLE lightroom_integration DROP COLUMN IF EXISTS plugin_token_plain;

CREATE TABLE IF NOT EXISTS lightroom_simulator (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(255) NOT NULL,
  export_id varchar(255),
  status varchar(64) NOT NULL,
  drive_file_id varchar(255),
  showcase_item_id varchar(255),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lightroom_simulator
  ADD COLUMN IF NOT EXISTS user_id varchar(255),
  ADD COLUMN IF NOT EXISTS export_id varchar(255),
  ADD COLUMN IF NOT EXISTS status varchar(64),
  ADD COLUMN IF NOT EXISTS drive_file_id varchar(255),
  ADD COLUMN IF NOT EXISTS showcase_item_id varchar(255),
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_lightroom_simulator_user_created
  ON lightroom_simulator(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS lightroom_classic_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(255) NOT NULL,
  project_id varchar NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  capture_session_id uuid NOT NULL REFERENCES capture_sessions(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL UNIQUE REFERENCES capture_assets(id) ON DELETE CASCADE,
  filename varchar(512) NOT NULL,
  mime_type varchar(128) NOT NULL,
  object_key varchar(1024) NOT NULL UNIQUE,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  checksum_sha256 varchar(64) NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  status varchar(32) NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'verified', 'error')),
  mirror_to_drive boolean NOT NULL DEFAULT false,
  drive_file_id varchar(255),
  drive_folder_id varchar(255),
  drive_folder_name varchar(255),
  drive_web_view_link text,
  drive_mirrored_at timestamptz,
  drive_last_error text,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lightroom_classic_exports_verified_requires_timestamp
    CHECK (status <> 'verified' OR verified_at IS NOT NULL)
);

DROP INDEX IF EXISTS lightroom_classic_exports_dedupe_idx;
CREATE UNIQUE INDEX lightroom_classic_exports_dedupe_idx
  ON lightroom_classic_exports(user_id, project_id, checksum_sha256, filename);
CREATE INDEX IF NOT EXISTS lightroom_classic_exports_project_created_idx
  ON lightroom_classic_exports(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lightroom_classic_exports_user_status_idx
  ON lightroom_classic_exports(user_id, status, created_at DESC);

COMMENT ON TABLE lightroom_classic_exports IS
  'Verified Lightroom Classic exports in CreatorHub S3 with an optional private Google Drive mirror.';
COMMENT ON COLUMN lightroom_classic_exports.object_key IS
  'Canonical private CreatorHub S3 key. This remains authoritative even when Drive mirroring is enabled.';
