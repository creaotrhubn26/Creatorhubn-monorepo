-- 0526_leadgrid_api_key_project_scope.sql
--
-- Bind Public API keys to one Leadgrid customer project by default.
-- Legacy keys are auto-bound only when the organization has exactly one
-- eligible customer project. The migration aborts when an active legacy key
-- is ambiguous, so rotation remains deliberate and no key receives silent
-- organization-wide access.
-- The management route permits new organization-wide keys only through an
-- explicit admin-only request.
--
-- The composite foreign key prevents a project from ever being paired with a
-- different organization. Deleting a Leadgrid project revokes its bound keys.

BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE leadgrid_api_keys
  ADD COLUMN IF NOT EXISTS project_id TEXT,
  ADD COLUMN IF NOT EXISTS access_scope VARCHAR(16);

-- Freeze API-key writes until the inventory assertion and migration updates
-- commit together. REPEATABLE READ also keeps the project inventory used by
-- the assertion and backfill on one snapshot without blocking project writes.
LOCK TABLE leadgrid_api_keys IN SHARE ROW EXCLUSIVE MODE;

DO $migration$
DECLARE
  ambiguous_active_keys BIGINT;
BEGIN
  WITH eligible_projects AS (
    SELECT organization_id,
           COUNT(*) AS project_count
      FROM leadgrid_projects
     WHERE organization_id IS NOT NULL
       AND (status IS NULL OR status NOT IN ('archived', 'deleted'))
       AND (project_type IS NULL OR project_type NOT IN (
         'feature_film', 'documentary', 'film', 'short_film',
         'tv_series', 'commercial', 'music_video', 'casting'
       ))
     GROUP BY organization_id
  )
  SELECT COUNT(*)
    INTO ambiguous_active_keys
    FROM leadgrid_api_keys k
    LEFT JOIN eligible_projects p
      ON p.organization_id = k.organization_id
   WHERE k.revoked_at IS NULL
     AND k.access_scope IS NULL
     AND COALESCE(p.project_count, 0) <> 1;

  IF ambiguous_active_keys > 0 THEN
    RAISE EXCEPTION
      'Migration 0526 blocked: % active legacy Leadgrid Public API key(s) require deliberate rotation',
      ambiguous_active_keys
      USING ERRCODE = 'P0001',
            HINT = 'Rotate or revoke ambiguous keys, then rerun the canonical production workflow.';
  END IF;
END
$migration$;

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
