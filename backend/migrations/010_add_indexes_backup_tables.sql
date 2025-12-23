-- 010_add_indexes_backup_tables.sql
-- Purpose: Add helpful indexes to large backup tables if present; idempotent, guarded by existence checks.

DO $$
DECLARE
  t_exists boolean;
  col_exists boolean;
BEGIN
  -- business_profiles_backup: indexes on user_id, created_at when available
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='business_profiles_backup') INTO t_exists;
  IF t_exists THEN
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business_profiles_backup' AND column_name='user_id') INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS business_profiles_backup_user_id_idx ON public.business_profiles_backup (user_id)';
    END IF;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business_profiles_backup' AND column_name='created_at') INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS business_profiles_backup_created_at_idx ON public.business_profiles_backup (created_at)';
    END IF;
  END IF;

  -- memory_cards_backup_cleanup: index on created_at if available
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='memory_cards_backup_cleanup') INTO t_exists;
  IF t_exists THEN
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='memory_cards_backup_cleanup' AND column_name='created_at') INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS memory_cards_backup_cleanup_created_at_idx ON public.memory_cards_backup_cleanup (created_at)';
    END IF;
  END IF;

  -- user_files_backup: indexes on user_id, created_at if available
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_files_backup') INTO t_exists;
  IF t_exists THEN
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_files_backup' AND column_name='user_id') INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS user_files_backup_user_id_idx ON public.user_files_backup (user_id)';
    END IF;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_files_backup' AND column_name='created_at') INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS user_files_backup_created_at_idx ON public.user_files_backup (created_at)';
    END IF;
  END IF;
END $$;