-- 0490_leadgrid_lead_creation_duplicate_indexes.sql
--
-- Indekser matcher de normaliserte, tenant-scopede duplikatkriteriene i
-- leadgrid-lead-creation-service.ts. Ingen globale unikhetskrav: samme
-- kontakt kan legitimt finnes i flere organisasjoner.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_crm_customers_org_email_lower
  ON crm_customers (organization_id, LOWER(email))
  WHERE organization_id IS NOT NULL
    AND email IS NOT NULL
    AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_org_phone_digits
  ON crm_customers (
    organization_id,
    RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 8)
  )
  WHERE organization_id IS NOT NULL
    AND phone IS NOT NULL
    AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_org_name_city_lower
  ON crm_customers (
    organization_id,
    LOWER(name),
    LOWER(COALESCE(city, ''))
  )
  WHERE organization_id IS NOT NULL
    AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_org_coordinates
  ON crm_customers (organization_id, latitude, longitude)
  WHERE organization_id IS NOT NULL
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND archived_at IS NULL;

COMMIT;
