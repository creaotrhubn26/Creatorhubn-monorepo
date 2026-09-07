-- Leadgrid CPV enrichment must be migration-owned and project scoped.

BEGIN;

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS cpv_koder TEXT;

CREATE INDEX IF NOT EXISTS idx_crm_customers_leadgrid_cpv_pending
  ON crm_customers (organization_id, project_id, id)
  WHERE project_id IS NOT NULL
    AND cpv_koder IS NULL
    AND archived_at IS NULL;

COMMIT;
