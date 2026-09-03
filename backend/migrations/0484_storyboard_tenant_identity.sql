-- migration-role: creatorhub_migrator
-- Enforce that every live Storyboard Room AI row belongs to the same project
-- as its storyboard. Durable usage/video history deliberately survives a
-- deleted storyboard, so those tables use write-time guards instead of
-- cascading foreign keys.
-- Migration 0483 installs the parent identity index.

BEGIN;

-- Install each live-row guard before repairing old rolling-schema rows. A
-- NOT VALID foreign key still protects concurrent writes, then VALIDATE proves
-- the canonical backfill converged every existing row.
ALTER TABLE storyboard_ai_image_versions
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_versions_storyboard_project_fkey;
ALTER TABLE storyboard_ai_image_versions
  ADD CONSTRAINT storyboard_ai_image_versions_storyboard_project_fkey
    FOREIGN KEY (storyboard_id, project_id)
    REFERENCES casting_storyboards (id, project_id)
    ON DELETE CASCADE NOT VALID;

UPDATE storyboard_ai_image_versions AS image_version
   SET project_id = storyboard.project_id
  FROM casting_storyboards AS storyboard
 WHERE image_version.storyboard_id = storyboard.id
   AND image_version.project_id IS DISTINCT FROM storyboard.project_id;

ALTER TABLE storyboard_ai_image_versions
  VALIDATE CONSTRAINT storyboard_ai_image_versions_storyboard_project_fkey;

ALTER TABLE storyboard_ai_image_operations
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_operations_storyboard_project_fkey;
ALTER TABLE storyboard_ai_image_operations
  ADD CONSTRAINT storyboard_ai_image_operations_storyboard_project_fkey
    FOREIGN KEY (storyboard_id, project_id)
    REFERENCES casting_storyboards (id, project_id)
    ON DELETE CASCADE NOT VALID;

-- Project normalization must never merge paid idempotency identities. Stop for
-- explicit reconciliation before UPDATE can hit the existing unique contract.
DO $storyboard_operation_identity_collision$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM storyboard_ai_image_operations AS image_operation
      JOIN casting_storyboards AS storyboard
        ON storyboard.id = image_operation.storyboard_id
     GROUP BY storyboard.project_id,
              image_operation.storyboard_id,
              image_operation.stage,
              image_operation.idempotency_key
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'storyboard image operation tenant repair has colliding idempotency identities';
  END IF;
END
$storyboard_operation_identity_collision$;

UPDATE storyboard_ai_image_operations AS image_operation
   SET project_id = storyboard.project_id
  FROM casting_storyboards AS storyboard
 WHERE image_operation.storyboard_id = storyboard.id
   AND image_operation.project_id IS DISTINCT FROM storyboard.project_id;

ALTER TABLE storyboard_ai_image_operations
  VALIDATE CONSTRAINT storyboard_ai_image_operations_storyboard_project_fkey;

-- Identity indexes let nullable lineage links carry the tenant and storyboard
-- identity as part of their foreign-key contract.
CREATE UNIQUE INDEX IF NOT EXISTS storyboard_ai_image_versions_identity_uidx
  ON storyboard_ai_image_versions (id, storyboard_id, project_id);
CREATE UNIQUE INDEX IF NOT EXISTS storyboard_ai_image_operations_identity_uidx
  ON storyboard_ai_image_operations (id, storyboard_id, project_id);
CREATE UNIQUE INDEX IF NOT EXISTS storyboard_ai_image_usage_identity_uidx
  ON storyboard_ai_image_usage (id, storyboard_id, project_id);

ALTER TABLE storyboard_ai_image_versions
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_versions_parent_identity_fkey;
ALTER TABLE storyboard_ai_image_versions
  ADD CONSTRAINT storyboard_ai_image_versions_parent_identity_fkey
    FOREIGN KEY (parent_version_id, storyboard_id, project_id)
    REFERENCES storyboard_ai_image_versions (id, storyboard_id, project_id)
    ON DELETE SET NULL (parent_version_id) NOT VALID;
ALTER TABLE storyboard_ai_image_versions
  VALIDATE CONSTRAINT storyboard_ai_image_versions_parent_identity_fkey;

ALTER TABLE storyboard_ai_image_operations
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_operations_version_identity_fkey;
ALTER TABLE storyboard_ai_image_operations
  ADD CONSTRAINT storyboard_ai_image_operations_version_identity_fkey
    FOREIGN KEY (version_id, storyboard_id, project_id)
    REFERENCES storyboard_ai_image_versions (id, storyboard_id, project_id)
    ON DELETE SET NULL (version_id) NOT VALID;
ALTER TABLE storyboard_ai_image_operations
  VALIDATE CONSTRAINT storyboard_ai_image_operations_version_identity_fkey;

ALTER TABLE storyboard_ai_image_operations
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_operations_reservation_identity_fkey;
ALTER TABLE storyboard_ai_image_operations
  ADD CONSTRAINT storyboard_ai_image_operations_reservation_identity_fkey
    FOREIGN KEY (reservation_id, storyboard_id, project_id)
    REFERENCES storyboard_ai_image_usage (id, storyboard_id, project_id)
    ON DELETE SET NULL (reservation_id) NOT VALID;
ALTER TABLE storyboard_ai_image_operations
  VALIDATE CONSTRAINT storyboard_ai_image_operations_reservation_identity_fkey;

ALTER TABLE storyboard_ai_image_usage
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_usage_operation_identity_fkey;
ALTER TABLE storyboard_ai_image_usage
  ADD CONSTRAINT storyboard_ai_image_usage_operation_identity_fkey
    FOREIGN KEY (operation_id, storyboard_id, project_id)
    REFERENCES storyboard_ai_image_operations (id, storyboard_id, project_id)
    ON DELETE SET NULL (operation_id) NOT VALID;
ALTER TABLE storyboard_ai_image_usage
  VALIDATE CONSTRAINT storyboard_ai_image_usage_operation_identity_fkey;

CREATE OR REPLACE FUNCTION enforce_storyboard_project_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Match PostgreSQL foreign-key concurrency semantics while retaining durable
  -- history when a storyboard is deleted later.
  PERFORM 1
    FROM casting_storyboards
   WHERE id = NEW.storyboard_id
     AND project_id = NEW.project_id
   FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'storyboard and project identity do not match',
      DETAIL = format(
        '%I requires an existing casting_storyboards(id, project_id) identity',
        TG_TABLE_NAME
      ),
      CONSTRAINT = TG_ARGV[0];
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS storyboard_ai_image_usage_tenant_identity
  ON storyboard_ai_image_usage;
CREATE TRIGGER storyboard_ai_image_usage_tenant_identity
BEFORE INSERT OR UPDATE OF storyboard_id, project_id
ON storyboard_ai_image_usage
FOR EACH ROW EXECUTE FUNCTION enforce_storyboard_project_identity(
  'storyboard_ai_image_usage_storyboard_project_guard'
);

DROP TRIGGER IF EXISTS storyboard_ai_video_jobs_tenant_identity
  ON storyboard_ai_video_jobs;
CREATE TRIGGER storyboard_ai_video_jobs_tenant_identity
BEFORE INSERT OR UPDATE OF storyboard_id, project_id
ON storyboard_ai_video_jobs
FOR EACH ROW EXECUTE FUNCTION enforce_storyboard_project_identity(
  'storyboard_ai_video_jobs_storyboard_project_guard'
);

-- Trigger DDL holds both durable tables against concurrent writes until COMMIT.
-- Audit after installing the guards so no mismatch can enter between the check
-- and the point where future writes become protected.
DO $storyboard_durable_tenant_identity$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM storyboard_ai_image_usage AS image_usage
      JOIN casting_storyboards AS storyboard
        ON storyboard.id = image_usage.storyboard_id
     WHERE image_usage.project_id IS DISTINCT FROM storyboard.project_id
  ) THEN
    RAISE EXCEPTION
      'storyboard image usage has a conflicting durable project identity';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM storyboard_ai_video_jobs AS video_job
      JOIN casting_storyboards AS storyboard
        ON storyboard.id = video_job.storyboard_id
     WHERE video_job.project_id IS DISTINCT FROM storyboard.project_id
  ) THEN
    RAISE EXCEPTION
      'storyboard video job has a conflicting durable project identity';
  END IF;
END
$storyboard_durable_tenant_identity$;

COMMIT;
