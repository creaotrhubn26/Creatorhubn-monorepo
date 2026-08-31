-- Complete the separation introduced by 0449_leadgrid_projects.sql.
--
-- Migration 284 could add project_id foreign keys to casting_projects when
-- these columns did not already exist. Leadgrid project IDs now live in
-- leadgrid_projects, while these shared VARCHAR columns intentionally remain
-- soft references. Drop the stale Role Room constraints explicitly.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE IF EXISTS crm_customers
  DROP CONSTRAINT IF EXISTS crm_customers_project_id_fkey;

ALTER TABLE IF EXISTS market_scan_competitors
  DROP CONSTRAINT IF EXISTS market_scan_competitors_project_id_fkey;

COMMIT;
