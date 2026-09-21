-- Dual-system production sound imported by CreatorHub One/Capture.
-- Originals stay private in the CreatorHub S3 bucket and are linked to video
-- takes through non-destructive sync metadata.

BEGIN;

CREATE TABLE IF NOT EXISTS project_production_audio_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  storage_object_id UUID UNIQUE
    REFERENCES role_room_storage_objects(id) ON DELETE SET NULL,
  created_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  original_filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(160) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  checksum_sha256 CHAR(64) NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  source_type VARCHAR(32) NOT NULL
    CHECK (source_type IN ('memory_card', 'external_recorder', 'import', 'migration')),
  recorded_at TIMESTAMPTZ NOT NULL,
  duration_ms BIGINT CHECK (duration_ms IS NULL OR duration_ms >= 0),
  sample_rate INTEGER CHECK (sample_rate IS NULL OR sample_rate > 0),
  bit_depth INTEGER CHECK (bit_depth IS NULL OR bit_depth > 0),
  channel_count INTEGER CHECK (channel_count IS NULL OR channel_count > 0),
  channel_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  timecode_start VARCHAR(32),
  time_reference_samples BIGINT CHECK (time_reference_samples IS NULL OR time_reference_samples >= 0),
  frame_rate NUMERIC(8,3) CHECK (frame_rate IS NULL OR frame_rate > 0),
  drop_frame BOOLEAN,
  scene VARCHAR(160),
  take VARCHAR(80),
  tape VARCHAR(160),
  circled BOOLEAN,
  recorder_manufacturer VARCHAR(120),
  recorder_model VARCHAR(160),
  recorder_serial VARCHAR(160),
  notes TEXT,
  capture_state VARCHAR(24) NOT NULL DEFAULT 'uploading'
    CHECK (capture_state IN ('registered', 'uploading', 'verifying', 'ready', 'failed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, project_id)
);

CREATE INDEX IF NOT EXISTS project_production_audio_project_recorded_idx
  ON project_production_audio_assets(project_id, recorded_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS project_production_audio_pending_idx
  ON project_production_audio_assets(capture_state, updated_at)
  WHERE capture_state <> 'ready';

CREATE TABLE IF NOT EXISTS project_video_audio_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  video_asset_id UUID NOT NULL,
  audio_asset_id UUID NOT NULL,
  sync_method VARCHAR(24) NOT NULL
    CHECK (sync_method IN ('timecode', 'metadata', 'waveform', 'clap', 'manual')),
  offset_seconds NUMERIC(14,6) NOT NULL DEFAULT 0,
  offset_frames NUMERIC(14,4),
  confidence NUMERIC(5,4) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  drift_ppm NUMERIC(12,4),
  selected_channels JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (video_asset_id, project_id)
    REFERENCES project_video_assets(id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (audio_asset_id, project_id)
    REFERENCES project_production_audio_assets(id, project_id) ON DELETE CASCADE,
  UNIQUE (video_asset_id, audio_asset_id)
);

CREATE INDEX IF NOT EXISTS project_video_audio_links_audio_idx
  ON project_video_audio_links(project_id, audio_asset_id);
CREATE INDEX IF NOT EXISTS project_video_audio_links_video_idx
  ON project_video_audio_links(project_id, video_asset_id);

ALTER TABLE capture_card_transfers
  ADD COLUMN IF NOT EXISTS audio_count INTEGER NOT NULL DEFAULT 0 CHECK (audio_count >= 0);

COMMIT;
