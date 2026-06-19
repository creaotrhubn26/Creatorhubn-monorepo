-- 0331_editing_vat_and_vendor_nda.sql
-- VAT/MVA-beregning på editing-oppdrag (formidler-modell) + motpart-NDA-felt
-- for utenlandske vendors (f.eks. Orbit Graphics' tysk-lov-NDA).
-- Apply m/ ON_ERROR_STOP=1, IKKE --single-transaction.
BEGIN;

-- (A) VAT/MVA på oppdrag. Formidler-modell:
--  - reverse charge når vendor er utenlandsk (fjernleverbar tjeneste → norsk kjøper
--    selv-avregner 25%; ingen MVA legges på beløpet som flyter til vendor).
--  - innenlands norsk vendor: 25% MVA på tjenesten.
--  - plattform-provisjon: 25% MVA på cut (faktureres norsk fotograf).
ALTER TABLE editing_jobs
  ADD COLUMN IF NOT EXISTS vat_reverse_charge boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5,4) NOT NULL DEFAULT 0.25,
  ADD COLUMN IF NOT EXISTS service_vat_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_vat_cents integer NOT NULL DEFAULT 0;

-- (B) Motpart-NDA + ekte DPA-artefakt på vendor-profilen (ingen compliance-fiksjon).
ALTER TABLE vendor_onboarding_profiles
  ADD COLUMN IF NOT EXISTS vendor_nda_governing_law varchar(120),
  ADD COLUMN IF NOT EXISTS vendor_nda_url varchar(500),
  ADD COLUMN IF NOT EXISTS vendor_nda_file_key varchar(500),
  ADD COLUMN IF NOT EXISTS vendor_nda_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS vendor_nda_countersigned_by varchar(255),
  ADD COLUMN IF NOT EXISTS dpa_document_key varchar(500);   -- ekte DPA-artefakt (badge gates på denne)

COMMIT;
