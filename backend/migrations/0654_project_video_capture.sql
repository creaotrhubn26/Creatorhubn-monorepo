-- 0654_project_video_capture.sql
--
-- Native CreatorHub One video ingest. Raw camera clips/takes deliberately live
-- outside project_video_versions: the latter remains the review/export model.

BEGIN;

CREATE TABLE IF NOT EXISTS project_video_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  storage_object_id UUID UNIQUE
    REFERENCES role_room_storage_objects(id) ON DELETE SET NULL,
  created_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  original_filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(160) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  checksum_sha256 CHAR(64) NOT NULL
    CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  source_type VARCHAR(32) NOT NULL
    CHECK (source_type IN (
      'ipad_camera', 'uvc', 'canon_ccapi', 'blackmagic_rest',
      'sony_companion', 'ndi_bridge', 'import'
    )),
  camera_manufacturer VARCHAR(120),
  camera_model VARCHAR(160),
  camera_serial VARCHAR(160),
  duration_ms BIGINT CHECK (duration_ms IS NULL OR duration_ms >= 0),
  frame_rate NUMERIC(8,3) CHECK (frame_rate IS NULL OR frame_rate > 0),
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  timecode_start VARCHAR(32),
  recorded_at TIMESTAMPTZ NOT NULL,
  capture_state VARCHAR(24) NOT NULL DEFAULT 'uploading'
    CHECK (capture_state IN (
      'registered', 'uploading', 'verifying', 'processing', 'ready', 'failed'
    )),
  stream_uid TEXT,
  stream_state VARCHAR(24) NOT NULL DEFAULT 'pending'
    CHECK (stream_state IN ('pending', 'importing', 'processing', 'ready', 'failed', 'skipped')),
  stream_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, project_id)
);

CREATE INDEX IF NOT EXISTS project_video_assets_project_recorded_idx
  ON project_video_assets(project_id, recorded_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS project_video_assets_processing_idx
  ON project_video_assets(capture_state, stream_state, updated_at)
  WHERE capture_state <> 'ready' OR stream_state IN ('pending', 'importing', 'processing');

CREATE TABLE IF NOT EXISTS project_video_takes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL UNIQUE,
  scene_id VARCHAR(160),
  shot_id VARCHAR(160),
  slate VARCHAR(80),
  take_number INTEGER NOT NULL DEFAULT 1 CHECK (take_number > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'unrated'
    CHECK (status IN ('unrated', 'hold', 'good', 'no_good')),
  circled BOOLEAN NOT NULL DEFAULT FALSE,
  continuity_notes TEXT,
  performance_notes TEXT,
  technical_notes TEXT,
  created_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (asset_id, project_id)
    REFERENCES project_video_assets(id, project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS project_video_takes_project_idx
  ON project_video_takes(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS project_video_takes_shot_idx
  ON project_video_takes(project_id, shot_id, take_number)
  WHERE shot_id IS NOT NULL;

-- A selected take can become a normal Video Room version without copying the
-- CreatorHub S3 original. The unique link makes promotion idempotent.
ALTER TABLE project_video_versions
  ADD COLUMN IF NOT EXISTS capture_asset_id UUID
    REFERENCES project_video_assets(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS project_video_versions_capture_asset_idx
  ON project_video_versions(capture_asset_id)
  WHERE capture_asset_id IS NOT NULL;

COMMIT;
