-- 0454_admin_workspace_calendar.sql
--
-- Egne hendelser i Admin Workspace-kalenderen. Avledede frister fra oppgaver,
-- saker, adminprosjekter, støtte og markedskontakter forblir i kildetabellene
-- og aggregeres bare ved lesing.

CREATE TABLE IF NOT EXISTS admin_workspace_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  product_key VARCHAR(20),
  title VARCHAR(240) NOT NULL,
  description TEXT,
  event_type VARCHAR(20) NOT NULL DEFAULT 'meeting',
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  time_zone VARCHAR(80) NOT NULL DEFAULT 'Europe/Oslo',
  location VARCHAR(300),
  meeting_url TEXT,
  assignee VARCHAR(160),
  project_id UUID,
  case_id UUID,
  tags TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR,
  CONSTRAINT admin_workspace_calendar_events_user_unique UNIQUE (id, user_id),
  CONSTRAINT admin_workspace_calendar_events_product_key_check
    CHECK (product_key IS NULL OR product_key IN ('role_room', 'leadgrid')),
  CONSTRAINT admin_workspace_calendar_events_type_check
    CHECK (event_type IN ('meeting', 'focus', 'reminder', 'deadline', 'follow_up', 'other')),
  CONSTRAINT admin_workspace_calendar_events_status_check
    CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
  CONSTRAINT admin_workspace_calendar_events_range_check
    CHECK (ends_at > starts_at),
  CONSTRAINT admin_workspace_calendar_events_project_fk
    FOREIGN KEY (project_id, user_id)
    REFERENCES admin_workspace_projects (id, user_id)
    ON DELETE SET NULL (project_id),
  CONSTRAINT admin_workspace_calendar_events_case_fk
    FOREIGN KEY (case_id, user_id)
    REFERENCES admin_workspace_cases (id, user_id)
    ON DELETE SET NULL (case_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_workspace_calendar_user_range
  ON admin_workspace_calendar_events (user_id, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_admin_workspace_calendar_user_product
  ON admin_workspace_calendar_events (user_id, product_key, starts_at);

CREATE INDEX IF NOT EXISTS idx_admin_workspace_calendar_project
  ON admin_workspace_calendar_events (user_id, project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_workspace_calendar_case
  ON admin_workspace_calendar_events (user_id, case_id)
  WHERE case_id IS NOT NULL;

COMMENT ON TABLE admin_workspace_calendar_events IS
  'Adminens egne møter, fokusblokker og påminnelser. Produksjonskalendere holdes separat.';
