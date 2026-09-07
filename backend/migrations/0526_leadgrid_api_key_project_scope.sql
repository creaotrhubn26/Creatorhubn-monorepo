-- 0526_leadgrid_api_key_project_scope.sql
--
-- Bind Public API keys to one Leadgrid customer project by default.
-- Legacy keys are auto-bound only when the organization has exactly one
-- eligible customer project. Ambiguous legacy keys are revoked and must be
-- rotated deliberately; they never receive silent organization-wide access.
-- The management route permits new organization-wide keys only through an
-- explicit admin-only request.
--
-- The composite foreign key prevents a project from ever being paired with a
-- different organization. Deleting a Leadgrid project revokes its bound keys.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE leadgrid_api_keys
  ADD COLUMN IF NOT EXISTS project_id TEXT,
  ADD COLUMN IF NOT EXISTS access_scope VARCHAR(16);

-- A single eligible customer project is an unambiguous safe binding.
WITH eligible_projects AS (
  SELECT organization_id,
         MIN(id) AS project_id,
         COUNT(*) AS project_count
    FROM leadgrid_projects
   WHERE organization_id IS NOT NULL
     AND (status IS NULL OR status NOT IN ('archived', 'deleted'))
     AND (project_type IS NULL OR project_type NOT IN (
       'feature_film', 'documentary', 'film', 'short_film',
       'tv_series', 'commercial', 'music_video', 'casting'
     ))
   GROUP BY organization_id
),
single_projects AS (
  SELECT organization_id, project_id
    FROM eligible_projects
   WHERE project_count = 1
)
UPDATE leadgrid_api_keys k
   SET project_id = single_projects.project_id,
       access_scope = 'project'
  FROM single_projects
 WHERE k.access_scope IS NULL
   AND k.organization_id = single_projects.organization_id;

-- Multiple/no eligible projects are ambiguous. Fail closed and require key
-- rotation instead of granting access to every present and future project.
UPDATE leadgrid_api_keys
   SET access_scope = 'organization',
       revoked_at = COALESCE(revoked_at, NOW()),
       revoked_reason = COALESCE(
         revoked_reason,
         'project_scope_migration_requires_rotation'
       )
 WHERE access_scope IS NULL;

ALTER TABLE leadgrid_api_keys
  ALTER COLUMN access_scope SET DEFAULT 'project',
  ALTER COLUMN access_scope SET NOT NULL;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'leadgrid_api_keys'::regclass
       AND conname = 'leadgrid_api_keys_access_scope_check'
  ) THEN
    ALTER TABLE leadgrid_api_keys
      ADD CONSTRAINT leadgrid_api_keys_access_scope_check
      CHECK (
        (access_scope = 'project' AND project_id IS NOT NULL)
        OR
        (access_scope = 'organization' AND project_id IS NULL)
      ) NOT VALID;
  END IF;
END
$migration$;

ALTER TABLE leadgrid_api_keys
  VALIDATE CONSTRAINT leadgrid_api_keys_access_scope_check;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'leadgrid_api_keys'::regclass
       AND conname = 'leadgrid_api_keys_project_tenant_fk'
  ) THEN
    ALTER TABLE leadgrid_api_keys
      ADD CONSTRAINT leadgrid_api_keys_project_tenant_fk
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects(organization_id, id)
      ON UPDATE CASCADE
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END
$migration$;

ALTER TABLE leadgrid_api_keys
  VALIDATE CONSTRAINT leadgrid_api_keys_project_tenant_fk;

CREATE INDEX IF NOT EXISTS idx_leadgrid_api_keys_project_active
  ON leadgrid_api_keys(organization_id, project_id)
  WHERE revoked_at IS NULL AND access_scope = 'project';

COMMENT ON COLUMN leadgrid_api_keys.project_id IS
  'Immutable Leadgrid customer-project boundary for project-scoped Public API keys.';
COMMENT ON COLUMN leadgrid_api_keys.access_scope IS
  'project by default; organization requires an explicit admin action; ambiguous legacy keys are revoked.';

COMMIT;
