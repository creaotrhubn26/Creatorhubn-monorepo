-- Ett øyeblikksbilde av Fastlegeregisteret, delt av alle kjøringer.
--
-- NHNs produksjonsendepunkt bruker 13–15 sekunder på å generere svaret på
-- 23,5 MB og har selv en gateway-timeout på 15. Det kappløper med seg selv,
-- og et kaldt kall gir 504 omtrent like ofte som 200 (målt 2026-09-24).
--
-- Registeret endrer seg i døgn, ikke i minutter. Å hente det på nytt for
-- hver Discovery-kjøring er derfor både unødvendig og den eneste grunnen til
-- at kjøringene står i det kappløpet i det hele tatt.
--
-- Raden er også en forsikring: er NHN nede, serverer vi forrige øyeblikksbilde
-- i stedet for å la kjøringen feile. En uke gammel legekontoradresse er
-- fortsatt riktig adresse; en feilet kjøring er ingenting.
CREATE TABLE IF NOT EXISTS leadgrid_flr_snapshot (
  environment    text PRIMARY KEY
                 CHECK (environment IN ('test', 'production')),
  payload        jsonb NOT NULL,
  contract_count integer NOT NULL,
  source_uri     text NOT NULL,
  fetched_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL
);

COMMENT ON TABLE leadgrid_flr_snapshot IS
  'Delt øyeblikksbilde av FLR-avtalene. Én rad per miljø. Hindrer at hver Discovery-kjøring kappløper med NHNs 15-sekunders gateway-timeout.';
COMMENT ON COLUMN leadgrid_flr_snapshot.expires_at IS
  'Når raden slutter å være fersk. Den slutter ikke å være brukbar — utløpt snapshot serveres videre hvis NHN ikke svarer.';
COMMENT ON COLUMN leadgrid_flr_snapshot.contract_count IS
  'Antall avtaler i payload. Et fall her er et varsku om at kilden har endret seg.';
