-- 0007_stripe_imports.sql
--
-- Stripe → Reknaren inntektssynk. Betalende kunder hos Creatorhub / The Role Room /
-- Leadgrid (alt fakturert via Stripe) registreres i regnskapet: kunde opprettes +
-- en UTKAST-salgsfaktura lages per betalt Stripe-faktura. Utkast = mennesket
-- godkjenner (utsteder) før inntekt bokføres — kjerneinvarianten holdes.
--
-- Denne tabellen er idempotens-nøkkelen: hver Stripe-faktura importeres høyst én
-- gang per organisasjon. Ingen beløp regnes ut her — de kommer ordrett fra Stripe
-- (bigint i minste valutaenhet, dvs. øre for NOK).

CREATE TABLE IF NOT EXISTS stripe_imports (
  id                 UUID PRIMARY KEY,
  organization_id    UUID NOT NULL REFERENCES organizations(id),
  stripe_invoice_id  TEXT NOT NULL,
  stripe_customer_id TEXT,
  -- Kilde-produkt: 'creatorhub' | 'role_room' | 'leadgrid' | annet (fritekst fra Stripe).
  source_product     TEXT,
  customer_id        UUID REFERENCES customers(id),
  invoice_id         UUID REFERENCES invoices(id),
  amount_minor       BIGINT NOT NULL,
  currency           TEXT NOT NULL,
  -- 'imported' = utkast opprettet; 'skipped_currency' = ikke-NOK, hoppet over ærlig.
  status             TEXT NOT NULL DEFAULT 'imported'
                       CHECK (status IN ('imported', 'skipped_currency')),
  imported_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, stripe_invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_stripe_imports_org
  ON stripe_imports (organization_id, imported_at DESC);
