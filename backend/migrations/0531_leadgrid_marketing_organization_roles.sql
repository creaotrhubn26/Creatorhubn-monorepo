-- =====================================================================
-- 0531_leadgrid_marketing_organization_roles.sql
--
-- Makes the marketing roles seeded in 0521 and 0524 assignable as real
-- organization memberships and through organization invitations.
-- =====================================================================

BEGIN;

ALTER TABLE organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;

ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN (
    'admin', 'salgssjef', 'teamleder',
    'salgskonsulent', 'promotor',
    'markedssjef', 'markedskoordinator',
    'seo_spesialist', 'content_ansvarlig',
    'performance_marketer', 'markedsanalytiker',
    'member', 'viewer'
  )) NOT VALID;

ALTER TABLE organization_members
  VALIDATE CONSTRAINT organization_members_role_check;

-- Organization invitations persist the requested role before the member row
-- exists, so this constraint must evolve in the same migration.
ALTER TABLE project_invitations
  DROP CONSTRAINT IF EXISTS project_invitations_role_check;

ALTER TABLE project_invitations
  ADD CONSTRAINT project_invitations_role_check
  CHECK (role IN (
    'admin', 'salgssjef', 'teamleder',
    'salgskonsulent', 'promotor',
    'markedssjef', 'markedskoordinator',
    'seo_spesialist', 'content_ansvarlig',
    'performance_marketer', 'markedsanalytiker',
    'owner', 'member', 'viewer'
  )) NOT VALID;

ALTER TABLE project_invitations
  VALIDATE CONSTRAINT project_invitations_role_check;

COMMIT;
