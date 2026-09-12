-- Production management is stored inside the rich production-day payload,
-- but receives its own optimistic-concurrency lane. This prevents a generic
-- production-day save (for example from 2nd AD) from overwriting PM changes.
ALTER TABLE casting_production_days
  ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS management_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS management_updated_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS management_updated_at TIMESTAMPTZ;

UPDATE casting_production_days
SET data = '{}'::jsonb
WHERE data IS NULL;

-- `data` was introduced by an older runtime compatibility guard on some
-- installations. ADD COLUMN IF NOT EXISTS does not retrofit its default.
ALTER TABLE casting_production_days
  ALTER COLUMN data SET DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_casting_production_days_management_updated
  ON casting_production_days(project_id, management_updated_at DESC)
  WHERE management_updated_at IS NOT NULL;
