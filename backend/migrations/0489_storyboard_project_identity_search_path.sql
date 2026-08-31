-- Harden the production-applied tenant trigger without rewriting migration
-- history. Existing triggers remain bound to this function OID.
BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_storyboard_project_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO pg_catalog, pg_temp
AS $$
BEGIN
  -- Match PostgreSQL foreign-key concurrency semantics while retaining durable
  -- history when a storyboard is deleted later.
  PERFORM 1
    FROM public.casting_storyboards
   WHERE id = NEW.storyboard_id
     AND project_id = NEW.project_id
   FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'storyboard and project identity do not match',
      DETAIL = pg_catalog.format(
        '%I requires an existing casting_storyboards(id, project_id) identity',
        TG_TABLE_NAME
      ),
      CONSTRAINT = TG_ARGV[0];
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
