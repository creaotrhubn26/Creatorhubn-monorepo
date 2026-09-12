-- =====================================================================
-- 320_leadgrid_organization_id_denormalized.sql
--
-- Denormaliser organization_id på crm_customers for å eliminere
-- owner_user_id IN organization_members-subqueries fra hot-path queries.
--
-- Strategi:
--   1. ADD kolonne (idempotent)
--   2. CREATE INDEX (partial: kun for archived_at IS NULL)
--   3. Backfill kjøres separat via /api/leadgrid/cron/backfill-organization-id
--      (ikke i denne mig — krever batch-prosessering)
-- =====================================================================

BEGIN;

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS organization_id UUID;

CREATE INDEX IF NOT EXISTS idx_crm_customers_organization
  ON crm_customers(organization_id)
  WHERE archived_at IS NULL AND organization_id IS NOT NULL;

-- Composite index for vanlige queries: org + pipeline_stage
CREATE INDEX IF NOT EXISTS idx_crm_customers_org_pipeline
  ON crm_customers(organization_id, pipeline_stage)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_org_temperature
  ON crm_customers(organization_id, lead_temperature)
  WHERE archived_at IS NULL;

COMMIT;
