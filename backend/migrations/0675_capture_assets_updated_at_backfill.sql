-- Repair legacy Capture installations where `capture_assets` predates the
-- canonical schema in 111_capture_assets.sql. CREATE TABLE IF NOT EXISTS does
-- not add columns to an existing table, while Photo Room review triggers and
-- rating updates rely on this timestamp.

ALTER TABLE capture_assets
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE capture_assets
   SET updated_at = COALESCE(updated_at, created_at, now())
 WHERE updated_at IS NULL;

ALTER TABLE capture_assets
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

