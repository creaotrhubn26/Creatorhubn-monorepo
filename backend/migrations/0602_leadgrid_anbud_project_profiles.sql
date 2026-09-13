-- 0602_leadgrid_anbud_project_profiles.sql
--
-- Product-side tender profiles are separate from Discovery buyer profiles.
-- Suggested Doffin watches stay drafts until an organization/project admin
-- confirms them. Managed watches are idempotent per project and template key.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS leadgrid_anbud_project_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  template_key TEXT NOT NULL,
  template_version INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused')),
  cpv_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  exclusion_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggested_watches JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_watch_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  requires_admin_confirmation BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, project_id),
  FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

ALTER TABLE leadgrid_doffin_watches
  ADD COLUMN IF NOT EXISTS template_key TEXT;

ALTER TABLE leadgrid_doffin_watches
  ADD COLUMN IF NOT EXISTS template_version INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS uq_doffin_watches_project_template
  ON leadgrid_doffin_watches (organization_id, project_id, template_key)
  WHERE template_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_anbud_project_profiles_status
  ON leadgrid_anbud_project_profiles
    (organization_id, project_id, status, updated_at DESC);

COMMENT ON TABLE leadgrid_anbud_project_profiles IS
  'Product-side Doffin profile. Suggested watches require explicit admin confirmation.';
COMMENT ON COLUMN leadgrid_doffin_watches.template_key IS
  'Stable managed-watch identity; unique inside the authoritative Leadgrid project.';

COMMIT;
