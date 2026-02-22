-- ============================================================
-- Migration 096 – Audition Schedule Upgrades
--
-- Adds:
--   1. `location` free-text column to casting_schedules
--   2. Compound indexes for filter/sort performance
--   3. casting_schedule_favorites table (per-user starred slots)
--   4. update trigger for casting_schedules
-- ============================================================

-- 1. Add `location` free-text column (backup/override for locationId FK)
ALTER TABLE casting_schedules
  ADD COLUMN IF NOT EXISTS location TEXT;

-- 2. Compound indexes for the four most common filters + sort
CREATE INDEX IF NOT EXISTS casting_schedules_project_date_time_idx
  ON casting_schedules (project_id, date, start_time);

CREATE INDEX IF NOT EXISTS casting_schedules_project_status_idx
  ON casting_schedules (project_id, status);

CREATE INDEX IF NOT EXISTS casting_schedules_project_role_idx
  ON casting_schedules (project_id, role_id);

CREATE INDEX IF NOT EXISTS casting_schedules_project_candidate_idx
  ON casting_schedules (project_id, candidate_id);

-- Pool = rows where date IS NULL; helps for fast "pool count"
CREATE INDEX IF NOT EXISTS casting_schedules_project_pool_idx
  ON casting_schedules (project_id)
  WHERE date IS NULL;

-- 3. Per-user starred schedule-slots
CREATE TABLE IF NOT EXISTS casting_schedule_favorites (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     VARCHAR(255) NOT NULL,
  project_id  VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  schedule_id VARCHAR(255) NOT NULL REFERENCES casting_schedules(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, schedule_id)
);

CREATE INDEX IF NOT EXISTS csf_user_project_idx
  ON casting_schedule_favorites (user_id, project_id);

-- 4. Auto-update trigger (same pattern as other tables)
DROP TRIGGER IF EXISTS update_casting_schedules_updated_at ON casting_schedules;
CREATE TRIGGER update_casting_schedules_updated_at
  BEFORE UPDATE ON casting_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
