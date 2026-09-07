-- 0537_leadgrid_forecasting_project_scope.sql
--
-- Forecasting and attribution caches used to be organization-wide. That could
-- mix results from different customer projects (for example Dentum and another
-- client) in the same forecast. Caches are derived data, so legacy rows without
-- an authoritative project can be invalidated safely instead of guessed.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE leadgrid_forecast_cache
  ADD COLUMN IF NOT EXISTS project_id TEXT;

ALTER TABLE leadgrid_attribution_aggregates
  ADD COLUMN IF NOT EXISTS project_id TEXT;

-- An organization-level aggregate cannot be assigned to one customer project
-- without leaking or falsifying data. Only discard unresolved derived rows.
DELETE FROM leadgrid_forecast_cache
 WHERE project_id IS NULL;

DELETE FROM leadgrid_attribution_aggregates
 WHERE project_id IS NULL;

ALTER TABLE leadgrid_forecast_cache
  DROP CONSTRAINT IF EXISTS leadgrid_forecast_cache_organization_id_horizon_days_key;

ALTER TABLE leadgrid_attribution_aggregates
  DROP CONSTRAINT IF EXISTS leadgrid_attribution_aggregates_organization_id_action_type_window_days_key;

ALTER TABLE leadgrid_forecast_cache
  ALTER COLUMN project_id SET NOT NULL;

ALTER TABLE leadgrid_attribution_aggregates
  ALTER COLUMN project_id SET NOT NULL;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'leadgrid_forecast_cache'::regclass
       AND conname = 'leadgrid_forecast_cache_project_scope_fkey'
  ) THEN
    ALTER TABLE leadgrid_forecast_cache
      ADD CONSTRAINT leadgrid_forecast_cache_project_scope_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects(organization_id, id)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'leadgrid_forecast_cache'::regclass
       AND conname = 'leadgrid_forecast_cache_org_project_horizon_key'
  ) THEN
    ALTER TABLE leadgrid_forecast_cache
      ADD CONSTRAINT leadgrid_forecast_cache_org_project_horizon_key
      UNIQUE (organization_id, project_id, horizon_days);
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'leadgrid_attribution_aggregates'::regclass
       AND conname = 'leadgrid_attribution_aggregates_project_scope_fkey'
  ) THEN
    ALTER TABLE leadgrid_attribution_aggregates
      ADD CONSTRAINT leadgrid_attribution_aggregates_project_scope_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects(organization_id, id)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'leadgrid_attribution_aggregates'::regclass
       AND conname = 'leadgrid_attribution_aggregates_org_project_action_window_key'
  ) THEN
    ALTER TABLE leadgrid_attribution_aggregates
      ADD CONSTRAINT leadgrid_attribution_aggregates_org_project_action_window_key
      UNIQUE (organization_id, project_id, action_type, window_days);
  END IF;
END
$migration$;

CREATE INDEX IF NOT EXISTS idx_forecast_cache_project_age
  ON leadgrid_forecast_cache
    (organization_id, project_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_attribution_aggregates_project
  ON leadgrid_attribution_aggregates
    (organization_id, project_id, window_days, computed_at DESC);

COMMENT ON COLUMN leadgrid_forecast_cache.project_id IS
  'Required Leadgrid customer-project scope. Organization-wide forecast cache rows are intentionally unsupported.';

COMMENT ON COLUMN leadgrid_attribution_aggregates.project_id IS
  'Required Leadgrid customer-project scope. Prevents attribution from mixing customer campaigns.';

COMMIT;
