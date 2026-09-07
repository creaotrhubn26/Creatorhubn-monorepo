-- 0533_leadgrid_project_team_scope.sql
--
-- Leadgrid projects are isolated from Role Room casting_projects. The legacy
-- project_members/project_invitations tables still carry casting-project FKs,
-- so Leadgrid needs its own tenant-bound membership and invitation stores.

BEGIN;

CREATE TABLE IF NOT EXISTS leadgrid_project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  project_id TEXT NOT NULL,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL DEFAULT 'member'
    CHECK (role IN (
      'admin', 'salgssjef', 'teamleder',
      'salgskonsulent', 'promotor',
      'markedssjef', 'markedskoordinator',
      'seo_spesialist', 'content_ansvarlig',
      'performance_marketer', 'markedsanalytiker',
      'owner', 'member', 'viewer'
    )),
  invited_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(meta) = 'object'),
  CONSTRAINT leadgrid_project_members_project_fkey
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT leadgrid_project_members_scope_user_key
    UNIQUE (organization_id, project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_project_members_user
  ON leadgrid_project_members (user_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_leadgrid_project_members_project
  ON leadgrid_project_members (organization_id, project_id);

CREATE TABLE IF NOT EXISTS leadgrid_project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  project_id TEXT NOT NULL,
  email TEXT NOT NULL CHECK (LENGTH(TRIM(email)) > 3),
  role VARCHAR(30) NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'member', 'viewer')),
  token VARCHAR(128) NOT NULL UNIQUE,
  invited_by VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  email_status VARCHAR(40),
  email_provider_message_id VARCHAR(200),
  CONSTRAINT leadgrid_project_invitations_project_fkey
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT leadgrid_project_invitations_acceptance_check CHECK (
    (accepted_at IS NULL AND accepted_by_user_id IS NULL)
    OR (accepted_at IS NOT NULL AND accepted_by_user_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_project_invitations_project
  ON leadgrid_project_invitations (organization_id, project_id, invited_at DESC);

CREATE INDEX IF NOT EXISTS idx_leadgrid_project_invitations_pending_email
  ON leadgrid_project_invitations (organization_id, project_id, LOWER(email))
  WHERE accepted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leadgrid_project_invitations_pending_token
  ON leadgrid_project_invitations (token)
  WHERE accepted_at IS NULL;

-- Preserve memberships attached to projects copied from casting_projects in
-- migration 0449. Role values are intentionally retained for compatibility.
INSERT INTO leadgrid_project_members (
  organization_id, project_id, user_id, role,
  invited_by, invited_at, last_active_at, meta
)
SELECT
  project.organization_id,
  project.id,
  legacy.user_id,
  legacy.role,
  legacy.invited_by,
  legacy.invited_at,
  legacy.last_active_at,
  COALESCE(legacy.meta, '{}'::jsonb)
FROM project_members legacy
JOIN leadgrid_projects project
  ON project.id = legacy.project_id
JOIN users member_user
  ON member_user.id = legacy.user_id
WHERE project.organization_id IS NOT NULL
ON CONFLICT (organization_id, project_id, user_id) DO NOTHING;

-- Every project creator must be able to manage the team, including projects
-- created before this migration.
INSERT INTO leadgrid_project_members (
  organization_id, project_id, user_id, role, invited_by, invited_at
)
SELECT
  project.organization_id,
  project.id,
  project.created_by,
  'owner',
  project.created_by,
  project.created_at
FROM leadgrid_projects project
JOIN users creator
  ON creator.id = project.created_by
WHERE project.organization_id IS NOT NULL
  AND project.created_by IS NOT NULL
ON CONFLICT (organization_id, project_id, user_id) DO UPDATE
  SET role = 'owner';

-- A direct project member still needs a non-privileged organization role so
-- shared Leadgrid RBAC middleware can resolve leads.view/leads.update. Existing
-- organization roles are deliberately preserved; project ownership never
-- escalates to organization admin.
INSERT INTO organization_members (
  organization_id, user_id, role, invited_at, joined_at
)
SELECT
  member.organization_id,
  member.user_id,
  CASE
    WHEN BOOL_AND(member.role = 'viewer') THEN 'viewer'
    ELSE 'member'
  END,
  MIN(member.invited_at),
  MIN(member.invited_at)
FROM leadgrid_project_members member
GROUP BY member.organization_id, member.user_id
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Preserve existing Leadgrid project invitations before the old polymorphic
-- table is retired from Leadgrid code paths. Organization invitations remain
-- in project_invitations and are deliberately not copied.
INSERT INTO leadgrid_project_invitations (
  id, organization_id, project_id, email, role, token,
  invited_by, invited_at, expires_at, accepted_at,
  accepted_by_user_id, email_status, email_provider_message_id
)
SELECT
  legacy.id,
  project.organization_id,
  project.id,
  legacy.email,
  CASE
    WHEN legacy.role = 'owner' THEN 'owner'
    WHEN legacy.role = 'viewer' THEN 'viewer'
    ELSE 'member'
  END,
  legacy.token,
  legacy.invited_by,
  legacy.invited_at,
  CASE
    WHEN (legacy.accepted_at IS NULL) <> (legacy.accepted_by_user_id IS NULL)
      THEN LEAST(legacy.expires_at, NOW())
    ELSE legacy.expires_at
  END,
  CASE WHEN legacy.accepted_by_user_id IS NOT NULL THEN legacy.accepted_at END,
  CASE WHEN legacy.accepted_at IS NOT NULL THEN legacy.accepted_by_user_id END,
  legacy.email_status,
  legacy.email_provider_message_id
FROM project_invitations legacy
JOIN leadgrid_projects project
  ON project.id = legacy.project_id
WHERE legacy.project_id IS NOT NULL
  AND project.organization_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

COMMIT;
