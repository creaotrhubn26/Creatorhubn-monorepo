-- Converge the canonical Drizzle contract with the membership lifecycle
-- columns already used by Role Room access checks and seat management.

ALTER TABLE casting_user_roles
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by_user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_cur_project_active
  ON casting_user_roles(project_id, deactivated_at);
