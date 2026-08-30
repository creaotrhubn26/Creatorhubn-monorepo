-- Durable exactly-once guard for paid Storyboard Room image generations.
CREATE TABLE IF NOT EXISTS storyboard_ai_image_operations (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  storyboard_id UUID NOT NULL REFERENCES casting_storyboards(id) ON DELETE CASCADE,
  stage VARCHAR(24) NOT NULL CHECK (stage IN ('color', 'atmosphere')),
  idempotency_key VARCHAR(200) NOT NULL,
  operation_fingerprint VARCHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'claimed'
    CHECK (status IN ('claimed', 'processing', 'completed', 'failed')),
  reservation_id UUID,
  version_id UUID REFERENCES storyboard_ai_image_versions(id) ON DELETE SET NULL,
  response JSONB,
  error TEXT,
  lease_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, storyboard_id, stage, idempotency_key)
);

-- The runtime schema guard deliberately has a minimal CREATE TABLE fallback.
-- Re-apply domain constraints when that fallback won the rolling-deploy race.
ALTER TABLE storyboard_ai_image_operations
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_operations_stage_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_operations_status_check;

ALTER TABLE storyboard_ai_image_operations
  ADD CONSTRAINT storyboard_ai_image_operations_stage_check
    CHECK (stage IN ('color', 'atmosphere')),
  ADD CONSTRAINT storyboard_ai_image_operations_status_check
    CHECK (status IN ('claimed', 'processing', 'completed', 'failed'));

CREATE INDEX IF NOT EXISTS storyboard_ai_image_operations_status_idx
  ON storyboard_ai_image_operations (status, updated_at);
CREATE INDEX IF NOT EXISTS storyboard_ai_image_operations_storyboard_idx
  ON storyboard_ai_image_operations (storyboard_id);
CREATE INDEX IF NOT EXISTS storyboard_ai_image_operations_reservation_idx
  ON storyboard_ai_image_operations (reservation_id)
  WHERE reservation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS storyboard_ai_image_operations_version_idx
  ON storyboard_ai_image_operations (version_id)
  WHERE version_id IS NOT NULL;

ALTER TABLE storyboard_ai_image_usage
  ADD COLUMN IF NOT EXISTS operation_id UUID;

ALTER TABLE storyboard_ai_image_operations
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_operations_reservation_id_fkey;
ALTER TABLE storyboard_ai_image_usage
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_usage_operation_id_fkey;

ALTER TABLE storyboard_ai_image_operations
  ADD CONSTRAINT storyboard_ai_image_operations_reservation_id_fkey
    FOREIGN KEY (reservation_id)
    REFERENCES storyboard_ai_image_usage(id) ON DELETE SET NULL;
ALTER TABLE storyboard_ai_image_usage
  ADD CONSTRAINT storyboard_ai_image_usage_operation_id_fkey
    FOREIGN KEY (operation_id)
    REFERENCES storyboard_ai_image_operations(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS storyboard_ai_image_usage_operation_idx
  ON storyboard_ai_image_usage (operation_id)
  WHERE operation_id IS NOT NULL;
