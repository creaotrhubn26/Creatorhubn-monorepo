-- Avtaler kunden signerer, og bevis for at de gjorde det.
--
-- DATABEHANDLERAVTALEN ER IKKE VALGFRI. Leadgrid behandler personopplysninger
-- på kundens vegne — kontaktpersoner hos leads, navn, telefon, e-post. Da er
-- vi databehandler etter GDPR artikkel 28, og avtale SKAL foreligge før
-- behandlingen starter. Uten den er både vi og kunden i brudd, og kunden har
-- ingen dokumentasjon å vise et tilsyn.
--
-- Intensjonsavtalen er kommersiell, ikke juridisk påkrevd, men den er det som
-- gjør at en prøvekonto er noe annet enn en uforpliktende titt.
--
-- Signaturen er en enkel elektronisk signatur: navn, rolle, tidspunkt, IP og
-- hash av den nøyaktige dokumentversjonen. Det holder for denne avtaletypen i
-- Norge, og hashen er det som gjør signaturen verdt noe — uten den kan ingen
-- i ettertid vise HVA som ble signert.
CREATE TABLE IF NOT EXISTS leadgrid_org_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  -- dpa: databehandleravtale (GDPR art. 28)
  -- loi: intensjonsavtale (letter of intent)
  -- terms: generelle vilkår
  agreement_type text NOT NULL CHECK (agreement_type IN ('dpa', 'loi', 'terms')),
  -- Versjonen som faktisk ble vist. Endrer vi teksten, må den signeres på nytt.
  document_version text NOT NULL,
  -- SHA-256 av dokumentteksten slik den sto da signaturen falt.
  document_sha256 text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT NOW(),
  signed_by_user_id uuid,
  -- Navn og rolle skrives inn av den som signerer. Brukerkontoen alene er
  -- ikke nok: den sier hvem som var innlogget, ikke hvem som forpliktet seg.
  signer_name text NOT NULL,
  signer_title text,
  signer_email text NOT NULL,
  signer_ip text,
  -- Fakturaopplysninger bekreftet i samme signatur, der det er relevant.
  confirmed_billing jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Én gjeldende signatur per avtaletype og versjon. Signerer de på nytt etter
-- en tekstendring, får den nye versjonen sin egen rad — historikken består.
CREATE UNIQUE INDEX IF NOT EXISTS leadgrid_org_agreements_unique_idx
  ON leadgrid_org_agreements (organization_id, agreement_type, document_version);

CREATE INDEX IF NOT EXISTS leadgrid_org_agreements_org_idx
  ON leadgrid_org_agreements (organization_id, agreement_type, signed_at DESC);

COMMENT ON COLUMN leadgrid_org_agreements.document_sha256 IS
  'Hash av teksten som ble vist. Uten den kan ingen i ettertid vise HVA som ble signert.';
COMMENT ON COLUMN leadgrid_org_agreements.confirmed_billing IS
  'Fakturaopplysninger kunden bekreftet ved signering: org.nr, adresse, fakturaepost, referanse.';
