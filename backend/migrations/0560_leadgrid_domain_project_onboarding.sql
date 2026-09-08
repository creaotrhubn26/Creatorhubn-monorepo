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
      (committed_project_id IS NULL AND committed_at IS NULL)
      OR (committed_project_id IS NOT NULL AND committed_at IS NOT NULL)
    ),
  CONSTRAINT leadgrid_project_onboarding_project_fkey
    FOREIGN KEY (organization_id, committed_project_id)
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

COMMIT;
