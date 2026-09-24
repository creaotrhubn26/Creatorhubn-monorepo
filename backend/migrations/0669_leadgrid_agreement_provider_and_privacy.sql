-- Hvem kunden faktisk inngår avtale med, og personvernerklæringen.
--
-- CREATORHUB AS ER AVTALEPARTEN, IKKE «LEADGRID».
-- Leadgrid er et produktnavn. En databehandleravtale må navngi et rettssubjekt
-- med organisasjonsnummer — ellers vet ikke kunden hvem de har avtale med, og
-- avtalen er vanskelig å håndheve begge veier. Creatorhub AS, org.nr
-- 937 518 684, Søsterveien 11, 1474 Lørenskog (Enhetsregisteret 2026-09-24).
--
-- Parten lagres PÅ HVER SIGNATUR, ikke bare som en konstant i koden. Bytter
-- selskapet navn eller organisasjonsnummer senere, skal gamle signaturer
-- fortsatt vise hvem avtalen faktisk ble inngått med.
ALTER TABLE leadgrid_org_agreements
  ADD COLUMN IF NOT EXISTS provider_legal_name text NOT NULL DEFAULT 'Creatorhub AS',
  ADD COLUMN IF NOT EXISTS provider_org_number text NOT NULL DEFAULT '937518684';

COMMENT ON COLUMN leadgrid_org_agreements.provider_legal_name IS
  'Rettssubjektet kunden inngikk avtale med. Lagres per signatur, ikke som konstant.';

-- Personvernerklæringen er en fjerde avtaletype. Den er ikke det samme som
-- databehandleravtalen: DPA-en regulerer hva vi gjør med KUNDENS data, mens
-- personvernerklæringen sier hva vi gjør med opplysninger om brukeren selv.
ALTER TABLE leadgrid_org_agreements
  DROP CONSTRAINT IF EXISTS leadgrid_org_agreements_agreement_type_check;

ALTER TABLE leadgrid_org_agreements
  ADD CONSTRAINT leadgrid_org_agreements_agreement_type_check
  CHECK (agreement_type IN ('dpa', 'loi', 'terms', 'privacy'));
