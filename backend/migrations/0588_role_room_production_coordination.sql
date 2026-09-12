-- Separate persistence and optimistic-concurrency lane for the production
-- coordinator. It must not share version or audit ownership with PM decisions.

ALTER TABLE casting_production_days
  ADD COLUMN IF NOT EXISTS coordination_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coordination_updated_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS coordination_updated_at TIMESTAMPTZ;

UPDATE casting_production_days
SET coordination_version = 0
WHERE coordination_version IS NULL;

-- ADD COLUMN IF NOT EXISTS does not retrofit a default on installations where
-- a compatibility guard created the column first.
ALTER TABLE casting_production_days
  ALTER COLUMN coordination_version SET DEFAULT 0,
  ALTER COLUMN coordination_version SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_casting_production_days_coordination_updated
  ON casting_production_days(project_id, coordination_updated_at DESC)
  WHERE coordination_updated_at IS NOT NULL;
