-- Selve underskriften, og hvordan den så ut.
--
-- En avkrysset boks er en bekreftelse. En underskrift er noe kunden har
-- utført: de skriver navnet sitt, velger hvordan det gjengis, og ser det stå
-- der før de trykker. Forskjellen er ikke juridisk — begge er gyldige
-- elektroniske signaturer — men den er reell for den som signerer, og det er
-- underskriften de kjenner igjen når de finner avtalen fram igjen senere.
--
-- Vi lagrer teksten de skrev og stilen de valgte, ikke et bilde. Da kan
-- signaturen gjengis likt overalt, den veier ingenting, og den kan ikke
-- klippes ut og limes inn på et annet dokument.
ALTER TABLE leadgrid_org_agreements
  ADD COLUMN IF NOT EXISTS signature_text text,
  ADD COLUMN IF NOT EXISTS signature_style text
    CHECK (signature_style IS NULL OR signature_style IN ('flyt', 'klassisk', 'rund')),
  -- Kvitteringen kundens signatar fikk. NULL = ikke sendt (eller feilet).
  ADD COLUMN IF NOT EXISTS receipt_sent_at timestamptz;

COMMENT ON COLUMN leadgrid_org_agreements.signature_text IS
  'Navnet slik signataren skrev det. Lagres som tekst, ikke bilde — kan ikke klippes ut og gjenbrukes.';
COMMENT ON COLUMN leadgrid_org_agreements.receipt_sent_at IS
  'Når kvitteringen gikk til signataren. Kunden skal kunne vise at de fikk den.';
