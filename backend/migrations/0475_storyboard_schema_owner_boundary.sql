-- Production migrations have one execution identity: the dedicated login
-- activates the canonical NOLOGIN schema owner before any SQL is applied.
-- Keep this boundary replayable on disposable databases where those roles do
-- not exist, but fail closed if a configured production topology is bypassed.

DO $storyboard_schema_owner_boundary$
BEGIN
  IF
    EXISTS (
      SELECT 1
      FROM pg_catalog.pg_roles
      WHERE rolname = 'creatorhub_migration_login'
    )
    AND EXISTS (
      SELECT 1
      FROM pg_catalog.pg_roles
      WHERE rolname = 'creatorhub_schema_owner'
    )
    AND (
      session_user <> 'creatorhub_migration_login'
      OR current_user <> 'creatorhub_schema_owner'
    )
  THEN
    RAISE EXCEPTION
      'Production migration role boundary is not active';
  END IF;
END
$storyboard_schema_owner_boundary$;
