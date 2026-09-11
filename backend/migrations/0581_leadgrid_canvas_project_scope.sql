-- 0581_leadgrid_canvas_project_scope.sql
--
-- Canvas notes used to be organization/user scoped. Customer projects in the
-- same organization must never share notes or PDF originals. Recover linked
-- notes from their lead; only recover unlinked notes when the organization
-- has exactly one Leadgrid project.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE leadgrid_canvas_notater
  ADD COLUMN IF NOT EXISTS project_id TEXT;

UPDATE leadgrid_canvas_notater note
   SET project_id = customer.project_id
  FROM crm_customers customer
 WHERE note.project_id IS NULL
   AND note.lead_id = customer.id
   AND LOWER(note.organization_id) = LOWER(customer.organization_id::text)
   AND customer.project_id IS NOT NULL;

WITH single_project AS (
  SELECT LOWER(organization_id::text) AS organization_key, MIN(id) AS project_id
    FROM leadgrid_projects
   WHERE organization_id IS NOT NULL
   GROUP BY LOWER(organization_id::text)
  HAVING COUNT(*) = 1
)
UPDATE leadgrid_canvas_notater note
   SET project_id = scope.project_id
  FROM single_project scope
 WHERE note.project_id IS NULL
   AND LOWER(note.organization_id) = scope.organization_key;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_canvas_notater'::regclass
       AND conname = 'leadgrid_canvas_notater_project_required_check'
  ) THEN
    ALTER TABLE leadgrid_canvas_notater
      ADD CONSTRAINT leadgrid_canvas_notater_project_required_check
      CHECK (project_id IS NOT NULL) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_canvas_notater'::regclass
       AND conname = 'leadgrid_canvas_notater_project_fkey'
  ) THEN
    ALTER TABLE leadgrid_canvas_notater
      ADD CONSTRAINT leadgrid_canvas_notater_project_fkey
      FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
END
$migration$;

CREATE INDEX IF NOT EXISTS idx_canvas_notes_project_user_updated
  ON leadgrid_canvas_notater
    (organization_id, project_id, user_id, updated_at DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_canvas_notes_project_lead
  ON leadgrid_canvas_notater
    (organization_id, project_id, lead_id, updated_at DESC)
  WHERE project_id IS NOT NULL AND lead_id IS NOT NULL;

COMMENT ON COLUMN leadgrid_canvas_notater.project_id IS
  'Authoritative Leadgrid customer project. New application writes require it.';

COMMIT;
