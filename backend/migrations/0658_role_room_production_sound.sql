-- Independent, conflict-safe lane for the production-sound report on each
-- shooting day. The JSON payload references canonical scene and continuity
-- take IDs; it never creates a parallel take identity.

ALTER TABLE casting_production_days
  ADD COLUMN IF NOT EXISTS sound_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sound_updated_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sound_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_casting_production_days_sound_updated
  ON casting_production_days (project_id, sound_updated_at DESC)
  WHERE sound_updated_at IS NOT NULL;

COMMENT ON COLUMN casting_production_days.sound_version IS
  'Optimistic-concurrency version for data.productionSound only.';
