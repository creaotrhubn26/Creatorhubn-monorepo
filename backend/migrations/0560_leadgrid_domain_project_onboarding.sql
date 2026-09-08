-- 0560_leadgrid_domain_project_onboarding.sql
--
-- Short-lived, tenant-bound previews for the domain -> project -> Discovery
-- onboarding flow. A preview is the immutable human confirmation boundary:
-- no project, profile or lead is written before it is explicitly committed.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS leadgrid_project_onboarding_previews (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL
                        REFERENCES organizations(id) ON DELETE CASCADE,
  created_by            VARCHAR(255) NOT NULL
                        REFERENCES users(id) ON DELETE CASCADE,
  website_url           TEXT NOT NULL,
  website_domain        VARCHAR(253) NOT NULL,
  plan                   JSONB NOT NULL
                        CHECK (jsonb_typeof(plan) = 'object'),
  expires_at             TIMESTAMPTZ NOT NULL,
  committed_organization_id UUID,
  committed_project_id  TEXT,
  committed_at          TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT leadgrid_project_onboarding_domain_check
    CHECK (
      website_domain = LOWER(website_domain)
      AND website_domain ~ '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$'
      AND POSITION('.' IN website_domain) > 0
    ),
  CONSTRAINT leadgrid_project_onboarding_commit_pair_check
    CHECK (
      (committed_organization_id IS NULL AND committed_project_id IS NULL AND committed_at IS NULL)
      OR (committed_organization_id IS NOT NULL AND committed_project_id IS NOT NULL AND committed_at IS NOT NULL)
    ),
  CONSTRAINT leadgrid_project_onboarding_project_fkey
    FOREIGN KEY (committed_organization_id, committed_project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_project_onboarding_actor
  ON leadgrid_project_onboarding_previews
  (organization_id, created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leadgrid_project_onboarding_expiry
  ON leadgrid_project_onboarding_previews (expires_at)
  WHERE committed_at IS NULL;

COMMENT ON TABLE leadgrid_project_onboarding_previews IS
  'Short-lived, user- and tenant-bound confirmation snapshots for domain-first Leadgrid project and Discovery onboarding.';

-- Sales teams are organization-wide in the existing Leadgrid model. This
-- tenant-bound join makes the team selected during onboarding authoritative
-- for the customer project without changing legacy team IDs.
CREATE TABLE IF NOT EXISTS leadgrid_project_sales_teams (
  organization_id UUID NOT NULL,
  project_id TEXT NOT NULL,
  sales_team_id TEXT NOT NULL,
  created_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, project_id, sales_team_id),
  CONSTRAINT leadgrid_project_sales_teams_project_fkey
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_project_sales_teams_team
  ON leadgrid_project_sales_teams (organization_id, sales_team_id);

-- A single project invitation may also establish the minimum organization
-- role and optional sales-team membership needed to use that project.
ALTER TABLE leadgrid_project_invitations
  ADD COLUMN IF NOT EXISTS organization_role VARCHAR(30),
  ADD COLUMN IF NOT EXISTS sales_team_id TEXT,
  ADD COLUMN IF NOT EXISTS sales_team_role VARCHAR(20);

ALTER TABLE leadgrid_project_invitations
  DROP CONSTRAINT IF EXISTS leadgrid_project_invitations_organization_role_check,
  DROP CONSTRAINT IF EXISTS leadgrid_project_invitations_sales_team_role_check;

ALTER TABLE leadgrid_project_invitations
  ADD CONSTRAINT leadgrid_project_invitations_organization_role_check
    CHECK (organization_role IS NULL OR organization_role IN ('admin', 'member', 'viewer')),
  ADD CONSTRAINT leadgrid_project_invitations_sales_team_role_check
    CHECK (sales_team_role IS NULL OR sales_team_role IN ('leader', 'member'));

COMMIT;
