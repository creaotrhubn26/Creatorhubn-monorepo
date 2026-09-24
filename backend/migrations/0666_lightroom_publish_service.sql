BEGIN;

ALTER TABLE lightroom_classic_exports
  DROP CONSTRAINT IF EXISTS lightroom_classic_exports_status_check;

ALTER TABLE lightroom_classic_exports
  ADD CONSTRAINT lightroom_classic_exports_status_check
  CHECK (status IN ('uploading', 'verified', 'error', 'unpublished'));

ALTER TABLE lightroom_classic_exports
  ADD COLUMN IF NOT EXISTS unpublished_at timestamptz;

CREATE INDEX IF NOT EXISTS lightroom_classic_exports_publish_status_idx
  ON lightroom_classic_exports(user_id, project_id, status, created_at DESC);

COMMIT;
