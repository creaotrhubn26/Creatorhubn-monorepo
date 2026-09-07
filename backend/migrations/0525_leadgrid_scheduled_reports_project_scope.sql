-- 0525_leadgrid_scheduled_reports_project_scope.sql
--
-- The scheduled-report tables pre-date the repository migration ledger in
-- some environments. Reconcile their base shape for fresh databases and add
-- an optional, tenant-enforced Leadgrid project scope.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS leadgrid_scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(160) NOT NULL,
  report_type VARCHAR(20) NOT NULL DEFAULT 'summary',
  period_days INTEGER NOT NULL DEFAULT 7,
  status_filter VARCHAR(30) NOT NULL DEFAULT 'all',
  recipient_user_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  recipient_emails TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  frequency VARCHAR(16) NOT NULL DEFAULT 'weekly',
  day_of_week SMALLINT,
  day_of_month SMALLINT,
  time_of_day TIME NOT NULL DEFAULT '08:00',
  timezone VARCHAR(80) NOT NULL DEFAULT 'Europe/Oslo',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  next_send_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  last_send_status VARCHAR(20),
  last_send_error TEXT,
  scope VARCHAR(16) NOT NULL DEFAULT 'org',
  target_team_leader_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  target_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  auto_send_to_target BOOLEAN NOT NULL DEFAULT TRUE,
  project_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leadgrid_scheduled_reports_report_type_check
    CHECK (report_type IN ('summary', 'leads_list', 'both')),
  CONSTRAINT leadgrid_scheduled_reports_period_days_check
    CHECK (period_days BETWEEN 1 AND 36500),
  CONSTRAINT leadgrid_scheduled_reports_frequency_check
    CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  CONSTRAINT leadgrid_scheduled_reports_scope_check
    CHECK (scope IN ('org', 'team', 'individual')),
  CONSTRAINT leadgrid_scheduled_reports_project_scope_fkey
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- Existing production installations already have the base table.
ALTER TABLE leadgrid_scheduled_reports
  ADD COLUMN IF NOT EXISTS project_id TEXT;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'leadgrid_scheduled_reports'::regclass
       AND conname = 'leadgrid_scheduled_reports_project_scope_fkey'
  ) THEN
    ALTER TABLE leadgrid_scheduled_reports
      ADD CONSTRAINT leadgrid_scheduled_reports_project_scope_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects(organization_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

CREATE INDEX IF NOT EXISTS idx_leadgrid_scheduled_reports_due_project
  ON leadgrid_scheduled_reports
    (organization_id, project_id, next_send_at, id)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS leadgrid_scheduled_report_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES leadgrid_scheduled_reports(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT,
  recipient TEXT NOT NULL,
  report_type VARCHAR(20) NOT NULL,
  pdf_size_bytes BIGINT NOT NULL DEFAULT 0,
  delivery_status VARCHAR(20) NOT NULL,
  external_message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leadgrid_scheduled_report_log_project_scope_fkey
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

ALTER TABLE leadgrid_scheduled_report_log
  ADD COLUMN IF NOT EXISTS project_id TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- The original production table was provisioned outside the migration ledger
-- and can use sent_at instead of created_at. Preserve that history when it is
-- available; otherwise assign one deterministic reconciliation timestamp.
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'leadgrid_scheduled_report_log'
       AND column_name = 'sent_at'
  ) THEN
    EXECUTE $sql$
      UPDATE leadgrid_scheduled_report_log
         SET created_at = COALESCE(created_at, sent_at, statement_timestamp())
       WHERE created_at IS NULL
    $sql$;
  ELSE
    UPDATE leadgrid_scheduled_report_log
       SET created_at = statement_timestamp()
     WHERE created_at IS NULL;
  END IF;
END
$migration$;

ALTER TABLE leadgrid_scheduled_report_log
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'leadgrid_scheduled_report_log'::regclass
       AND conname = 'leadgrid_scheduled_report_log_project_scope_fkey'
  ) THEN
    ALTER TABLE leadgrid_scheduled_report_log
      ADD CONSTRAINT leadgrid_scheduled_report_log_project_scope_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects(organization_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

CREATE INDEX IF NOT EXISTS idx_leadgrid_scheduled_report_log_project
  ON leadgrid_scheduled_report_log
    (organization_id, project_id, created_at DESC);

COMMIT;
