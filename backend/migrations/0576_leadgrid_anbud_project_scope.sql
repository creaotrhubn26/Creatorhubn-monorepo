-- 0576_leadgrid_anbud_project_scope.sql
--
-- Doffin searches are cached globally, but every persisted watch and pipeline
-- item belongs to one Leadgrid customer project. This prevents Dentum watches,
-- customer matches and deadlines from appearing in CreatorHub/The Role Room
-- projects that happen to share the same organization.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE leadgrid_doffin_watches
  ADD COLUMN IF NOT EXISTS project_id TEXT;

ALTER TABLE leadgrid_anbud_pipeline
  ADD COLUMN IF NOT EXISTS project_id TEXT;

-- Only recover historical rows when the organization had exactly one
-- Leadgrid project. Ambiguous rows are retained with NULL and deliberately
-- remain invisible to project-scoped reads instead of being guessed.
WITH single_project AS (
  SELECT LOWER(organization_id::text) AS organization_key, MIN(id) AS project_id
    FROM leadgrid_projects
   WHERE organization_id IS NOT NULL
   GROUP BY LOWER(organization_id::text)
  HAVING COUNT(*) = 1
)
UPDATE leadgrid_doffin_watches watch
   SET project_id = scope.project_id
  FROM single_project scope
 WHERE watch.project_id IS NULL
   AND LOWER(watch.organization_id) = scope.organization_key;

WITH single_project AS (
  SELECT LOWER(organization_id::text) AS organization_key, MIN(id) AS project_id
    FROM leadgrid_projects
   WHERE organization_id IS NOT NULL
   GROUP BY LOWER(organization_id::text)
  HAVING COUNT(*) = 1
)
UPDATE leadgrid_anbud_pipeline item
   SET project_id = scope.project_id
  FROM single_project scope
 WHERE item.project_id IS NULL
   AND LOWER(item.organization_id) = scope.organization_key;

ALTER TABLE leadgrid_anbud_pipeline
  DROP CONSTRAINT IF EXISTS leadgrid_anbud_pipeline_organization_id_doffin_id_key;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_doffin_watches'::regclass
       AND conname = 'leadgrid_doffin_watches_project_required_check'
  ) THEN
    ALTER TABLE leadgrid_doffin_watches
      ADD CONSTRAINT leadgrid_doffin_watches_project_required_check
      CHECK (project_id IS NOT NULL) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_doffin_watches'::regclass
       AND conname = 'leadgrid_doffin_watches_project_fkey'
  ) THEN
    ALTER TABLE leadgrid_doffin_watches
      ADD CONSTRAINT leadgrid_doffin_watches_project_fkey
      FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_anbud_pipeline'::regclass
       AND conname = 'leadgrid_anbud_pipeline_project_required_check'
  ) THEN
    ALTER TABLE leadgrid_anbud_pipeline
      ADD CONSTRAINT leadgrid_anbud_pipeline_project_required_check
      CHECK (project_id IS NOT NULL) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_anbud_pipeline'::regclass
       AND conname = 'leadgrid_anbud_pipeline_project_fkey'
  ) THEN
    ALTER TABLE leadgrid_anbud_pipeline
      ADD CONSTRAINT leadgrid_anbud_pipeline_project_fkey
      FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
END
$migration$;

CREATE INDEX IF NOT EXISTS idx_doffin_watches_project
  ON leadgrid_doffin_watches
    (organization_id, project_id, created_at DESC)
  WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_anbud_pipeline_project_doffin
  ON leadgrid_anbud_pipeline (organization_id, project_id, doffin_id);

CREATE INDEX IF NOT EXISTS idx_anbud_pipeline_project_status
  ON leadgrid_anbud_pipeline
    (organization_id, project_id, status, frist)
  WHERE project_id IS NOT NULL;

COMMENT ON COLUMN leadgrid_doffin_watches.project_id IS
  'Authoritative Leadgrid customer project. New application writes require it.';
COMMENT ON COLUMN leadgrid_anbud_pipeline.project_id IS
  'Authoritative Leadgrid customer project for pipeline, deadlines and notifications.';

COMMIT;
