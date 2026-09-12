-- 282_lead_enrichment.sql
--
-- Ekstern firma-berikkelse av leads.
--
-- Bruker data.brreg.no (Brønnøysundregistrenes åpne API, gratis,
-- ingen auth) til å hente:
--   - org-nummer, registrert dato
--   - daglig leder + styreleder (kontaktperson for outreach)
--   - omsetning + ansatte (proxy via Proff hvis API-nøkkel finnes —
--     ellers kun BRREG-grunnlag)
--   - status (aktiv / avviklet / konkurs)
--   - NACE-kode (bransje-klassifikasjon)
--
-- Lagret som JSONB så vi kan endre struktur uten ny migration.
-- enriched_at brukes til å vise alder + re-fetche når > 30 dager.

BEGIN;

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS enrichment_data JSONB,
  ADD COLUMN IF NOT EXISTS enrichment_org_nr VARCHAR(20),
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- Lookup på org-nr for "samme firma som lead" hvis vi ser et match
CREATE INDEX IF NOT EXISTS idx_leads_enrichment_org
  ON crm_customers (enrichment_org_nr)
  WHERE enrichment_org_nr IS NOT NULL;

-- For "stale berikkelse"-sjekk
CREATE INDEX IF NOT EXISTS idx_leads_enriched_at
  ON crm_customers (enriched_at);

COMMIT;
