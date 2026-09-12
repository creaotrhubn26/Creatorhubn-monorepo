-- 0545_leadgrid_collaboration_project_scope.sql
--
-- Bind collaborative lead state to the same authoritative
-- organization/project/lead tuple as the customer record. Historical rows
-- that cannot be mapped safely are retained but are invisible to scoped
-- application queries. NOT VALID constraints still reject unsafe new writes.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE leadgrid_lead_notes
  ADD COLUMN IF NOT EXISTS project_id TEXT;

ALTER TABLE leadgrid_lead_favorites
  ADD COLUMN IF NOT EXISTS project_id TEXT;

UPDATE leadgrid_lead_notes note
   SET project_id = customer.project_id
  FROM crm_customers customer
 WHERE note.lead_id = customer.id
   AND note.organization_id = customer.organization_id
   AND customer.project_id IS NOT NULL
   AND note.project_id IS DISTINCT FROM customer.project_id;

UPDATE leadgrid_lead_favorites favorite
   SET project_id = customer.project_id
  FROM crm_customers customer
 WHERE favorite.lead_id = customer.id
   AND favorite.organization_id = customer.organization_id
   AND customer.project_id IS NOT NULL
   AND favorite.project_id IS DISTINCT FROM customer.project_id;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_lead_notes'::regclass
       AND conname = 'leadgrid_lead_notes_project_required_check'
  ) THEN
    ALTER TABLE leadgrid_lead_notes
      ADD CONSTRAINT leadgrid_lead_notes_project_required_check
      CHECK (project_id IS NOT NULL) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_lead_notes'::regclass
       AND conname = 'leadgrid_lead_notes_project_scope_fkey'
  ) THEN
    ALTER TABLE leadgrid_lead_notes
      ADD CONSTRAINT leadgrid_lead_notes_project_scope_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects (organization_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_lead_notes'::regclass
       AND conname = 'leadgrid_lead_notes_lead_scope_fkey'
  ) THEN
    ALTER TABLE leadgrid_lead_notes
      ADD CONSTRAINT leadgrid_lead_notes_lead_scope_fkey
      FOREIGN KEY (organization_id, project_id, lead_id)
      REFERENCES crm_customers (organization_id, project_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_lead_favorites'::regclass
       AND conname = 'leadgrid_lead_favorites_project_required_check'
  ) THEN
    ALTER TABLE leadgrid_lead_favorites
      ADD CONSTRAINT leadgrid_lead_favorites_project_required_check
      CHECK (project_id IS NOT NULL) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_lead_favorites'::regclass
       AND conname = 'leadgrid_lead_favorites_project_scope_fkey'
  ) THEN
    ALTER TABLE leadgrid_lead_favorites
      ADD CONSTRAINT leadgrid_lead_favorites_project_scope_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects (organization_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_lead_favorites'::regclass
       AND conname = 'leadgrid_lead_favorites_lead_scope_fkey'
  ) THEN
    ALTER TABLE leadgrid_lead_favorites
      ADD CONSTRAINT leadgrid_lead_favorites_lead_scope_fkey
      FOREIGN KEY (organization_id, project_id, lead_id)
      REFERENCES crm_customers (organization_id, project_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leadgrid_lead_notes_project_feed
  ON leadgrid_lead_notes
    (organization_id, project_id, lead_id, pinned DESC, created_at DESC)
  WHERE deleted_at IS NULL AND project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leadgrid_lead_favorites_project_user
  ON leadgrid_lead_favorites
    (organization_id, project_id, user_id, created_at DESC)
  WHERE project_id IS NOT NULL;

COMMENT ON COLUMN leadgrid_lead_notes.project_id IS
  'Authoritative Leadgrid customer project. New rows must match organization_id and lead_id.';
COMMENT ON COLUMN leadgrid_lead_favorites.project_id IS
  'Authoritative Leadgrid customer project. New rows must match organization_id and lead_id.';

COMMIT;
