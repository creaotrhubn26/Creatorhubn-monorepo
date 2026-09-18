-- 0453_admin_workspace_tasks.sql
--
-- Operative oppgaver for Admin Workspace. Dette er adminens egen arbeidskø
-- for støttearbeid, marked, partnerskap, salg og interne leveranser. Tabellen
-- aggregerer ikke CRM- eller Role Room-oppgaver.

-- Saker ble opprinnelig opprettet med bare id som unik nøkkel. Den kompositt-
-- unike nøkkelen gjør det mulig å håndheve at en oppgave og saken den peker på
-- alltid tilhører samme bruker.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'admin_workspace_cases_user_unique'
  ) THEN
    ALTER TABLE admin_workspace_cases
      ADD CONSTRAINT admin_workspace_cases_user_unique UNIQUE (id, user_id);
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS admin_workspace_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  product_key VARCHAR(20),
  title VARCHAR(240) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'todo',
  priority VARCHAR(10) NOT NULL DEFAULT 'normal',
  due_date DATE,
  assignee VARCHAR(160),
  project_id UUID,
  case_id UUID,
  tags TEXT[] NOT NULL DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR,
  CONSTRAINT admin_workspace_tasks_user_unique UNIQUE (id, user_id),
  CONSTRAINT admin_workspace_tasks_product_key_check
    CHECK (product_key IS NULL OR product_key IN ('role_room', 'leadgrid')),
  CONSTRAINT admin_workspace_tasks_status_check
    CHECK (status IN ('inbox', 'todo', 'in_progress', 'waiting', 'done', 'cancelled')),
  CONSTRAINT admin_workspace_tasks_priority_check
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT admin_workspace_tasks_project_fk
    FOREIGN KEY (project_id, user_id)
    REFERENCES admin_workspace_projects (id, user_id)
    ON DELETE SET NULL (project_id),
  CONSTRAINT admin_workspace_tasks_case_fk
    FOREIGN KEY (case_id, user_id)
    REFERENCES admin_workspace_cases (id, user_id)
    ON DELETE SET NULL (case_id),
  CONSTRAINT admin_workspace_tasks_completed_check
    CHECK (
      (status = 'done' AND completed_at IS NOT NULL)
      OR (status <> 'done' AND completed_at IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_admin_workspace_tasks_user_status_due
  ON admin_workspace_tasks (user_id, status, due_date, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_workspace_tasks_user_product_due
  ON admin_workspace_tasks (user_id, product_key, due_date, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_workspace_tasks_project
  ON admin_workspace_tasks (user_id, project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_workspace_tasks_case
  ON admin_workspace_tasks (user_id, case_id)
  WHERE case_id IS NOT NULL;

COMMENT ON TABLE admin_workspace_tasks IS
  'Adminens operative arbeidskø på tvers av støtte, marked, partnerskap, salg og interne initiativer. Ikke kunde- eller produksjonsoppgaver.';

COMMENT ON COLUMN admin_workspace_tasks.product_key IS
  'NULL er Creatorhub/internt. Ellers role_room eller leadgrid.';
