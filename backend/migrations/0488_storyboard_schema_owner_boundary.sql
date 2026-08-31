BEGIN;

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

-- Undo the direct privilege granted by the production-applied 0475 migration.
-- Inspect the direct ACL rather than effective privileges because Neon-managed
-- roles may inherit broader capabilities independently.
DO $storyboard_legacy_reference_cleanup$
BEGIN
  IF
    EXISTS (
      SELECT 1
      FROM pg_catalog.pg_roles
      WHERE rolname = 'creatorhub_migrator'
    )
    AND pg_catalog.to_regclass('public.casting_storyboards') IS NOT NULL
  THEN
    EXECUTE
      'REVOKE REFERENCES ON TABLE public.casting_storyboards FROM creatorhub_migrator';

    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class AS relation
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = relation.relnamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS acl
      JOIN pg_catalog.pg_roles AS grantee
        ON grantee.oid = acl.grantee
      WHERE namespace.nspname = 'public'
        AND relation.relname = 'casting_storyboards'
        AND grantee.rolname = 'creatorhub_migrator'
        AND acl.privilege_type = 'REFERENCES'
    ) THEN
      RAISE EXCEPTION
        'Legacy Storyboard REFERENCES privilege was not removed';
    END IF;
  END IF;
END
$storyboard_legacy_reference_cleanup$;

COMMIT;
