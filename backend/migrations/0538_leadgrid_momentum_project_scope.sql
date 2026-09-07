-- 0538_leadgrid_momentum_project_scope.sql
--
-- Migration 327 stored goals and daily momentum snapshots at organization
-- level. That is not a safe cache key once one workspace contains multiple
-- customer projects: one client's activity could otherwise change another
-- client's score and trend. Keep the legacy tables intact as rollback/audit
-- data and introduce strict project-bound stores for selected-project flows.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS leadgrid_project_sales_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  year_month CHAR(7) NOT NULL
    CHECK (year_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  revenue_target NUMERIC(12,2)
    CHECK (revenue_target IS NULL OR revenue_target >= 0),
  deals_target INTEGER
    CHECK (deals_target IS NULL OR deals_target >= 0),
  meetings_target INTEGER
    CHECK (meetings_target IS NULL OR meetings_target >= 0),
  proposals_target INTEGER
    CHECK (proposals_target IS NULL OR proposals_target >= 0),
  daily_contacts_target INTEGER NOT NULL DEFAULT 3
    CHECK (daily_contacts_target >= 0),
  daily_followups_target INTEGER NOT NULL DEFAULT 5
    CHECK (daily_followups_target >= 0),
  daily_meetings_target INTEGER NOT NULL DEFAULT 1
    CHECK (daily_meetings_target >= 0),
  daily_pipeline_moves_target INTEGER NOT NULL DEFAULT 2
    CHECK (daily_pipeline_moves_target >= 0),
  monthly_leads_needed INTEGER
    CHECK (monthly_leads_needed IS NULL OR monthly_leads_needed >= 0),
  set_by_user_id VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leadgrid_project_sales_goals_project_scope_fkey
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT leadgrid_project_sales_goals_scope_month_key
    UNIQUE (organization_id, project_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_project_sales_goals_month
  ON leadgrid_project_sales_goals
    (organization_id, project_id, year_month DESC);

CREATE TABLE IF NOT EXISTS leadgrid_project_momentum_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  momentum_score NUMERIC(5,2) NOT NULL
    CHECK (momentum_score BETWEEN 0 AND 100),
  activity_score NUMERIC(5,2)
    CHECK (activity_score IS NULL OR activity_score BETWEEN 0 AND 100),
  velocity_score NUMERIC(5,2)
    CHECK (velocity_score IS NULL OR velocity_score BETWEEN 0 AND 100),
  decay_score NUMERIC(5,2)
    CHECK (decay_score IS NULL OR decay_score BETWEEN 0 AND 100),
  overdue_penalty NUMERIC(5,2)
    CHECK (overdue_penalty IS NULL OR overdue_penalty BETWEEN 0 AND 10),
  contacts_today INTEGER NOT NULL DEFAULT 0 CHECK (contacts_today >= 0),
  followups_today INTEGER NOT NULL DEFAULT 0 CHECK (followups_today >= 0),
  meetings_today INTEGER NOT NULL DEFAULT 0 CHECK (meetings_today >= 0),
  pipeline_moves_today INTEGER NOT NULL DEFAULT 0 CHECK (pipeline_moves_today >= 0),
  overdue_nbas INTEGER NOT NULL DEFAULT 0 CHECK (overdue_nbas >= 0),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leadgrid_project_momentum_snapshots_project_scope_fkey
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT leadgrid_project_momentum_snapshots_scope_date_key
    UNIQUE (organization_id, project_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_project_momentum_snapshots_date
  ON leadgrid_project_momentum_snapshots
    (organization_id, project_id, snapshot_date DESC);

-- Existing goal values are configuration, not measured results. Use the old
-- organization goal as an initial baseline for every existing customer
-- project; every subsequent read/write is independent per project.
INSERT INTO leadgrid_project_sales_goals (
  organization_id,
  project_id,
  year_month,
  revenue_target,
  deals_target,
  meetings_target,
  proposals_target,
  daily_contacts_target,
  daily_followups_target,
  daily_meetings_target,
  daily_pipeline_moves_target,
  monthly_leads_needed,
  set_by_user_id,
  notes,
  created_at,
  updated_at
)
SELECT legacy.organization_id,
       project.id,
       legacy.year_month,
       legacy.revenue_target,
       legacy.deals_target,
       legacy.meetings_target,
       legacy.proposals_target,
       COALESCE(legacy.daily_contacts_target, 3),
       COALESCE(legacy.daily_followups_target, 5),
       COALESCE(legacy.daily_meetings_target, 1),
       COALESCE(legacy.daily_pipeline_moves_target, 2),
       legacy.monthly_leads_needed,
       legacy.set_by_user_id,
       legacy.notes,
       legacy.created_at,
       legacy.updated_at
  FROM leadgrid_org_sales_goals legacy
  JOIN leadgrid_projects project
    ON project.organization_id = legacy.organization_id
ON CONFLICT (organization_id, project_id, year_month) DO NOTHING;

-- Organization snapshots are derived and cannot be split safely across two
-- projects. Preserve history only when the organization has exactly one
-- Leadgrid project; multi-project snapshots remain in the legacy table and are
-- intentionally never served by the project API.
WITH single_project AS (
  SELECT organization_id, MIN(id) AS project_id
    FROM leadgrid_projects
   WHERE organization_id IS NOT NULL
   GROUP BY organization_id
  HAVING COUNT(*) = 1
)
INSERT INTO leadgrid_project_momentum_snapshots (
  organization_id,
  project_id,
  snapshot_date,
  momentum_score,
  activity_score,
  velocity_score,
  decay_score,
  overdue_penalty,
  contacts_today,
  followups_today,
  meetings_today,
  pipeline_moves_today,
  overdue_nbas,
  computed_at
)
SELECT legacy.organization_id,
       project.project_id,
       legacy.snapshot_date,
       legacy.momentum_score,
       legacy.activity_score,
       legacy.velocity_score,
       legacy.decay_score,
       legacy.overdue_penalty,
       COALESCE(legacy.contacts_today, 0),
       COALESCE(legacy.followups_today, 0),
       COALESCE(legacy.meetings_today, 0),
       COALESCE(legacy.pipeline_moves_today, 0),
       COALESCE(legacy.overdue_nbas, 0),
       legacy.computed_at
  FROM leadgrid_momentum_snapshots legacy
  JOIN single_project project
    ON project.organization_id = legacy.organization_id
ON CONFLICT (organization_id, project_id, snapshot_date) DO NOTHING;

COMMENT ON TABLE leadgrid_project_sales_goals IS
  'Monthly targets for one Leadgrid customer project. Never aggregate across projects.';

COMMENT ON TABLE leadgrid_project_momentum_snapshots IS
  'Derived daily KPI for one Leadgrid customer project. Tenant/project is the cache identity.';

COMMENT ON TABLE leadgrid_org_sales_goals IS
  'Legacy organization-level goal baseline from migration 327. Selected-project operations use leadgrid_project_sales_goals.';

COMMENT ON TABLE leadgrid_momentum_snapshots IS
  'Legacy organization-level snapshots from migration 327. Selected-project operations never read or write this table.';

COMMIT;
