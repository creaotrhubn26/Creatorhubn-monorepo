-- 0485_leadgrid_add_lead_profile_fields.sql
--
-- Fullfører den strukturerte «Legg til lead»-kontrakten. Eksisterende CRM-
-- kolonner gjenbrukes for org.nr, nettside, bransje, notat, temperatur,
-- pipeline og oppfølging. Disse fire feltene manglet en eksplisitt kolonne.

BEGIN;

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_role TEXT,
  ADD COLUMN IF NOT EXISTS employee_count_estimate INTEGER
    CHECK (employee_count_estimate IS NULL OR employee_count_estimate >= 0),
  ADD COLUMN IF NOT EXISTS annual_revenue_nok_estimate NUMERIC(16,2)
    CHECK (annual_revenue_nok_estimate IS NULL OR annual_revenue_nok_estimate >= 0);

-- Org.nr er allerede lagret i enrichment_org_nr. Denne sammensatte indeksen
-- gjør oppslag og senere duplikatkontroll tenant-scopet når organization_id
-- er tilgjengelig, uten å endre eldre personlige CRM-rader.
CREATE INDEX IF NOT EXISTS idx_crm_customers_org_enrichment_org_nr
  ON crm_customers (organization_id, enrichment_org_nr)
  WHERE enrichment_org_nr IS NOT NULL;

COMMENT ON COLUMN crm_customers.contact_name IS
  'Primary contact person captured when a Leadgrid lead is created.';
COMMENT ON COLUMN crm_customers.contact_role IS
  'Role/title of the primary contact person at the lead company.';
COMMENT ON COLUMN crm_customers.employee_count_estimate IS
  'Best-known employee count at lead creation time; may be user-entered or enriched.';
COMMENT ON COLUMN crm_customers.annual_revenue_nok_estimate IS
  'Best-known annual revenue estimate in NOK at lead creation time.';

COMMIT;
