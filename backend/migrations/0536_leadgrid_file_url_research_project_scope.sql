-- 0536_leadgrid_file_url_research_project_scope.sql
--
-- Make lead attachments and historical URL-research batches follow the same
-- immutable organization/project boundary as their Leadgrid leads. Legacy
-- rows are backfilled only from authoritative crm_customers relationships.
-- Rows that cannot be resolved unambiguously deliberately remain NULL and are
-- hidden by the application until they are repaired explicitly.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '180s';

ALTER TABLE leadgrid_lead_files
  ADD COLUMN IF NOT EXISTS project_id TEXT;

UPDATE leadgrid_lead_files attachment
   SET project_id = lead.project_id
  FROM crm_customers lead
 WHERE attachment.project_id IS NULL
   AND lead.id = attachment.lead_id
   AND lead.organization_id = attachment.organization_id
   AND lead.project_id IS NOT NULL
   AND EXISTS (
     SELECT 1
       FROM leadgrid_projects project
      WHERE project.organization_id = lead.organization_id
        AND project.id = lead.project_id
   );

ALTER TABLE leadgrid_url_research_batches
  ADD COLUMN IF NOT EXISTS project_id TEXT;

WITH authoritative_batch_projects AS (
  SELECT batch.id AS batch_id,
         MIN(lead.project_id) AS project_id
    FROM leadgrid_url_research_batches batch
    JOIN crm_customers lead
      ON lead.import_batch_id = batch.id
     AND lead.organization_id = batch.organization_id
    JOIN leadgrid_projects project
      ON project.organization_id = lead.organization_id
     AND project.id = lead.project_id
   WHERE batch.project_id IS NULL
     AND lead.project_id IS NOT NULL
   GROUP BY batch.id
  HAVING COUNT(DISTINCT lead.project_id) = 1
)
UPDATE leadgrid_url_research_batches batch
   SET project_id = authoritative.project_id
  FROM authoritative_batch_projects authoritative
 WHERE batch.id = authoritative.batch_id
   AND batch.project_id IS NULL;

DO $preflight$
DECLARE
  invalid_file_scopes BIGINT;
  invalid_batch_scopes BIGINT;
BEGIN
  SELECT COUNT(*)
    INTO invalid_file_scopes
    FROM leadgrid_lead_files attachment
   WHERE attachment.project_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
         FROM crm_customers lead
        WHERE lead.id = attachment.lead_id
          AND lead.organization_id = attachment.organization_id
          AND lead.project_id = attachment.project_id
     );

  IF invalid_file_scopes > 0 THEN
    RAISE EXCEPTION
      'leadgrid_lead_files has % rows outside the persisted lead tuple',
      invalid_file_scopes;
  END IF;

  SELECT COUNT(*)
    INTO invalid_batch_scopes
    FROM leadgrid_url_research_batches batch
   WHERE batch.project_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
         FROM leadgrid_projects project
        WHERE project.organization_id = batch.organization_id
          AND project.id = batch.project_id
     );

  IF invalid_batch_scopes > 0 THEN
    RAISE EXCEPTION
      'leadgrid_url_research_batches has % rows outside a Leadgrid project tuple',
      invalid_batch_scopes;
  END IF;
END
$preflight$;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_lead_files'::regclass
       AND conname = 'leadgrid_lead_files_project_scope_fkey'
  ) THEN
    ALTER TABLE leadgrid_lead_files
      ADD CONSTRAINT leadgrid_lead_files_project_scope_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects(organization_id, id)
      ON UPDATE CASCADE
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_lead_files'::regclass
       AND conname = 'leadgrid_lead_files_lead_scope_fkey'
  ) THEN
    ALTER TABLE leadgrid_lead_files
      ADD CONSTRAINT leadgrid_lead_files_lead_scope_fkey
      FOREIGN KEY (organization_id, project_id, lead_id)
      REFERENCES crm_customers(organization_id, project_id, id)
      ON UPDATE CASCADE
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_url_research_batches'::regclass
       AND conname = 'leadgrid_url_research_batches_project_scope_fkey'
  ) THEN
    ALTER TABLE leadgrid_url_research_batches
      ADD CONSTRAINT leadgrid_url_research_batches_project_scope_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects(organization_id, id)
      ON UPDATE CASCADE
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END
$constraints$;

ALTER TABLE leadgrid_lead_files
  VALIDATE CONSTRAINT leadgrid_lead_files_project_scope_fkey;
ALTER TABLE leadgrid_lead_files
  VALIDATE CONSTRAINT leadgrid_lead_files_lead_scope_fkey;
ALTER TABLE leadgrid_url_research_batches
  VALIDATE CONSTRAINT leadgrid_url_research_batches_project_scope_fkey;

CREATE INDEX IF NOT EXISTS idx_leadgrid_lead_files_project_feed
  ON leadgrid_lead_files
    (organization_id, project_id, lead_id, created_at DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leadgrid_url_research_batches_project_feed
  ON leadgrid_url_research_batches
    (organization_id, project_id, created_at DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leadgrid_url_research_batches_project_active
  ON leadgrid_url_research_batches
    (organization_id, project_id, status, created_at)
  WHERE project_id IS NOT NULL
    AND status IN ('pending', 'running', 'partial', 'failed');

COMMENT ON COLUMN leadgrid_lead_files.project_id IS
  'Persisted Leadgrid customer-project boundary. NULL legacy rows fail closed in application routes.';
COMMENT ON COLUMN leadgrid_url_research_batches.project_id IS
  'Persisted Leadgrid customer-project boundary. NULL means unresolved legacy data and is never user-readable.';

COMMIT;
