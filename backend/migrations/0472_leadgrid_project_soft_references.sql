-- Complete the separation introduced by 0449_leadgrid_projects.sql.
--
-- Migration 284 could add project_id foreign keys to casting_projects when
-- these columns did not already exist. Leadgrid project IDs now live in
-- leadgrid_projects, while these shared VARCHAR columns intentionally remain
-- soft references. Drop the stale Role Room constraints explicitly.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- PostgreSQL checks table ownership before it checks IF EXISTS. The production
-- migration role does not own every legacy table, so avoid ALTER TABLE when
-- migration 284 never created the constraint (the common case when project_id
-- already existed).
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = to_regclass('crm_customers')
      AND conname = 'crm_customers_project_id_fkey'
  ) THEN
    ALTER TABLE crm_customers
      DROP CONSTRAINT IF EXISTS crm_customers_project_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = to_regclass('market_scan_competitors')
      AND conname = 'market_scan_competitors_project_id_fkey'
  ) THEN
    ALTER TABLE market_scan_competitors
      DROP CONSTRAINT IF EXISTS market_scan_competitors_project_id_fkey;
  END IF;
END;
$migration$;

COMMIT;
