-- 0587_leadgrid_product_onboarding_scope.sql
--
-- The legacy tour stored one row per user and described an obsolete customer
-- portal/API workflow. Product onboarding is now isolated by the same tenant,
-- customer-project and effective-role boundaries as the Leadgrid workspaces.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS leadgrid_product_onboarding_state (
  user_id              VARCHAR(255) NOT NULL
                       REFERENCES users(id) ON DELETE CASCADE,
  organization_id      UUID NOT NULL
                       REFERENCES organizations(id) ON DELETE CASCADE,
  project_id           TEXT NOT NULL,
  role_track           VARCHAR(30) NOT NULL
                       CHECK (LENGTH(TRIM(role_track)) BETWEEN 1 AND 30),
  onboarding_version   INTEGER NOT NULL DEFAULT 2
                       CHECK (onboarding_version > 0),
  current_step         VARCHAR(40) NOT NULL DEFAULT 'welcome'
                       CHECK (current_step IN (
                         'welcome', 'choose_project', 'find_candidates',
                         'approve_candidates', 'work_leads', 'follow_up',
                         'completed', 'skipped'
                       )),
  steps_completed      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at         TIMESTAMPTZ,
  skipped_at           TIMESTAMPTZ,
  PRIMARY KEY (
    user_id, organization_id, project_id, role_track, onboarding_version
  ),
  CONSTRAINT leadgrid_product_onboarding_project_fkey
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT leadgrid_product_onboarding_terminal_state_check CHECK (
    (current_step = 'completed' AND completed_at IS NOT NULL AND skipped_at IS NULL)
    OR (current_step = 'skipped' AND skipped_at IS NOT NULL AND completed_at IS NULL)
    OR (current_step NOT IN ('completed', 'skipped')
        AND completed_at IS NULL AND skipped_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_product_onboarding_funnel
  ON leadgrid_product_onboarding_state
  (onboarding_version, role_track, current_step);

COMMENT ON TABLE leadgrid_product_onboarding_state IS
  'Versioned Leadgrid product-guide progress, isolated per user, organization, customer project and effective project role.';

COMMIT;
