-- 0008_stripe_import_detail.sql
--
-- Mer detalj på hva kunden betalte for: Stripe-fakturanummer, lenke til Stripe-
-- fakturaen/kvitteringen (hosted_invoice_url) og faktureringsperiode. Selve
-- «hva» (linjene) ligger som itemiserte fakturalinjer på utkastet; disse feltene
-- gir sporbarhet tilbake til kilden.

ALTER TABLE stripe_imports ADD COLUMN IF NOT EXISTS stripe_number TEXT;
ALTER TABLE stripe_imports ADD COLUMN IF NOT EXISTS hosted_invoice_url TEXT;
ALTER TABLE stripe_imports ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE stripe_imports ADD COLUMN IF NOT EXISTS period_end DATE;
