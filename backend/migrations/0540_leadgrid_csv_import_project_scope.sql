-- 0540_leadgrid_csv_import_project_scope.sql
--
-- CSV/Excel-import belongs to one customer project. Historic batches were
-- organization-wide and imported crm_customers without project_id, which made
-- the leads invisible after project ACL became authoritative.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE leadgrid_import_batches
  ADD COLUMN IF NOT EXISTS project_id TEXT,
  ADD COLUMN IF NOT EXISTS commit_key_hash TEXT;

-- Backfill a batch only when all surviving imported leads agree on one
-- authoritative project. Ambiguous legacy batches remain visible as legacy
-- audit data, but no new runtime write may omit project_id.
WITH unambiguous AS (
  SELECT import_batch_id,
         MIN(project_id) AS project_id
    FROM crm_customers
   WHERE import_batch_id IS NOT NULL
     AND project_id IS NOT NULL
   GROUP BY import_batch_id
  HAVING COUNT(DISTINCT project_id) = 1
)
UPDATE leadgrid_import_batches batch
   SET project_id = resolved.project_id
  FROM unambiguous resolved
 WHERE batch.id = resolved.import_batch_id
   AND batch.project_id IS NULL;

UPDATE leadgrid_import_batches batch
   SET organization_id = project.organization_id
  FROM leadgrid_projects project
 WHERE batch.project_id = project.id
   AND project.organization_id IS NOT NULL
   AND batch.organization_id IS DISTINCT FROM project.organization_id;

CREATE INDEX IF NOT EXISTS idx_leadgrid_import_batches_project
  ON leadgrid_import_batches (
    organization_id,
    project_id,
    created_at DESC
  )
  WHERE organization_id IS NOT NULL
    AND project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_leadgrid_import_batches_commit_key
  ON leadgrid_import_batches (owner_user_id, commit_key_hash)
  WHERE commit_key_hash IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'leadgrid_import_batches_project_scope_fkey'
  ) THEN
    ALTER TABLE leadgrid_import_batches
      ADD CONSTRAINT leadgrid_import_batches_project_scope_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects (organization_id, id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END
$$;

ALTER TABLE leadgrid_import_batches
  VALIDATE CONSTRAINT leadgrid_import_batches_project_scope_fkey;

COMMENT ON COLUMN leadgrid_import_batches.project_id IS
  'Authoritative customer project selected before CSV preview and commit.';
COMMENT ON COLUMN leadgrid_import_batches.commit_key_hash IS
  'SHA-256 of the one-time preview token; makes network retries idempotent.';

COMMIT;
