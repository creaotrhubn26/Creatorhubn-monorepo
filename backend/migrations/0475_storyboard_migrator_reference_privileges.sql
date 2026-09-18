-- Grant only the parent-table privilege required by the dedicated Storyboard
-- migration role. Clean local databases without that role remain replayable.
BEGIN;

DO $storyboard_migrator_reference_privileges$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'creatorhub_migrator') THEN
    EXECUTE
      'GRANT REFERENCES ON TABLE public.casting_storyboards TO creatorhub_migrator';
  END IF;
END
$storyboard_migrator_reference_privileges$;

COMMIT;
