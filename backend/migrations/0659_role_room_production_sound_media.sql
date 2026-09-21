-- Private BWF/WAV originals for the Production Sound lane. The object itself
-- lives in the existing Role Room S3/storage-object contract; this table owns
-- the project/day relationship, parsed recorder metadata and explicit
-- reconciliation to the canonical continuity take identity.

BEGIN;

-- The day id is globally unique today, but the composite key lets the media
-- table enforce that its project and day always describe the same tenant.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_casting_production_days_project_id_id'
      AND conrelid = 'casting_production_days'::regclass
  ) THEN
    ALTER TABLE casting_production_days
      ADD CONSTRAINT uq_casting_production_days_project_id_id
      UNIQUE (project_id, id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS casting_production_sound_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL
    REFERENCES casting_projects(id) ON DELETE CASCADE,
  production_day_id VARCHAR(255) NOT NULL
    REFERENCES casting_production_days(id) ON DELETE CASCADE,
  storage_object_id UUID NOT NULL
    REFERENCES role_room_storage_objects(id) ON DELETE RESTRICT,
  uploaded_by VARCHAR(255),
  display_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(120) NOT NULL
    CONSTRAINT chk_casting_production_sound_media_type CHECK (
      content_type IN ('audio/wav', 'audio/wave', 'audio/vnd.wave', 'audio/x-wav', 'application/octet-stream')
    ),
  size_bytes BIGINT NOT NULL
    CONSTRAINT chk_casting_production_sound_media_size CHECK (
      size_bytes > 0 AND size_bytes <= 21474836480
    ),
  checksum_sha256 CHAR(64) NOT NULL
    CONSTRAINT chk_casting_production_sound_media_checksum CHECK (
      checksum_sha256 ~ '^[0-9a-f]{64}$'
    ),
  recorder_metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    CONSTRAINT chk_casting_production_sound_media_metadata CHECK (
      jsonb_typeof(recorder_metadata) = 'object'
    ),
  reconciliation_status VARCHAR(20) NOT NULL DEFAULT 'unmatched'
    CONSTRAINT chk_casting_production_sound_media_status CHECK (
      reconciliation_status IN ('unmatched', 'matched')
    ),
  continuity_take_id VARCHAR(120),
  reconciled_by VARCHAR(255),
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_casting_production_sound_media_storage_object UNIQUE (storage_object_id),
  CONSTRAINT fk_casting_production_sound_media_project_day
    FOREIGN KEY (project_id, production_day_id)
    REFERENCES casting_production_days(project_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_casting_production_sound_media_reconciliation CHECK (
    (reconciliation_status = 'unmatched' AND continuity_take_id IS NULL AND reconciled_by IS NULL AND reconciled_at IS NULL)
    OR
    (reconciliation_status = 'matched' AND continuity_take_id IS NOT NULL AND reconciled_by IS NOT NULL AND reconciled_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_casting_production_sound_media_day_active
  ON casting_production_sound_media
    (project_id, production_day_id, reconciliation_status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_casting_production_sound_media_take_active
  ON casting_production_sound_media
    (project_id, production_day_id, continuity_take_id, created_at DESC)
  WHERE deleted_at IS NULL AND continuity_take_id IS NOT NULL;

COMMIT;
