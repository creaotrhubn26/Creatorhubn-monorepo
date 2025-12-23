-- 011_cleanup_exists_flag_tables.sql
-- Purpose: Drop unintended existence-flag tables created during earlier checks.
-- Idempotent and safe; tables usually have no dependencies.

DO $$
BEGIN
  EXECUTE 'DROP TABLE IF EXISTS public.ar_exists';
  EXECUTE 'DROP TABLE IF EXISTS public.fc_exists';
  EXECUTE 'DROP TABLE IF EXISTS public.fm_exists';
  EXECUTE 'DROP TABLE IF EXISTS public.ms_exists';
  EXECUTE 'DROP TABLE IF EXISTS public.pg_exists';
  EXECUTE 'DROP TABLE IF EXISTS public.si_exists';
  EXECUTE 'DROP TABLE IF EXISTS public.us_exists';
END $$;