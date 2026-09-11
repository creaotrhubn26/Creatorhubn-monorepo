-- 0575_pondus_project_scope.sql
--
-- Pondus used to stop at organization scope. One organization may own
-- several customer projects (Dentum, CreatorHub, The Role Room), so both
-- project-specific templates and usage must carry the authoritative Leadgrid
-- project key. Global and organization-wide templates remain supported.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE pondus_templates
  ADD COLUMN IF NOT EXISTS project_id TEXT;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'pondus_templates'::regclass
       AND conname = 'pondus_templates_project_scope_check'
  ) THEN
    ALTER TABLE pondus_templates
      ADD CONSTRAINT pondus_templates_project_scope_check
      CHECK (project_id IS NULL OR org_id IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'pondus_templates'::regclass
       AND conname = 'pondus_templates_project_scope_fkey'
  ) THEN
    ALTER TABLE pondus_templates
      ADD CONSTRAINT pondus_templates_project_scope_fkey
      FOREIGN KEY (org_id, project_id)
      REFERENCES leadgrid_projects(organization_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE
      NOT VALID;
  END IF;
END
$migration$;

CREATE INDEX IF NOT EXISTS idx_pondus_templates_project_active
  ON pondus_templates(org_id, project_id, is_published, updated_at DESC)
  WHERE archived_at IS NULL;

ALTER TABLE pondus_template_usage
  ADD COLUMN IF NOT EXISTS project_id TEXT;

-- Existing usage with a lead has an unambiguous project. Rows without a lead
-- stay NULL rather than being guessed into the wrong customer project.
UPDATE pondus_template_usage pu
   SET project_id = c.project_id
  FROM crm_customers c
 WHERE pu.project_id IS NULL
   AND pu.lead_id = c.id
   AND c.project_id IS NOT NULL
   AND LOWER(c.organization_id::text) = LOWER(pu.organization_id);

-- Historical code stored UUID organization keys in a varchar column. Convert
-- valid keys so PostgreSQL can enforce the same composite tenant/project FK
-- used by the rest of Leadgrid. Invalid legacy values become NULL and remain
-- excluded from all project-scoped reads.
ALTER TABLE pondus_template_usage
  ALTER COLUMN organization_id TYPE UUID
  USING CASE
    WHEN organization_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN organization_id::uuid
    ELSE NULL
  END;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'pondus_template_usage'::regclass
       AND conname = 'pondus_template_usage_project_scope_fkey'
  ) THEN
    ALTER TABLE pondus_template_usage
      ADD CONSTRAINT pondus_template_usage_project_scope_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects(organization_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE
      NOT VALID;
  END IF;
END
$migration$;

CREATE INDEX IF NOT EXISTS idx_pondus_usage_project_template_time
  ON pondus_template_usage(organization_id, project_id, template_id, used_at DESC);

COMMENT ON COLUMN pondus_templates.project_id IS
  'NULL means global/org-wide; otherwise the template belongs only to this Leadgrid customer project.';
COMMENT ON COLUMN pondus_template_usage.project_id IS
  'Authoritative Leadgrid project for the usage session. New API writes require it.';

COMMIT;
