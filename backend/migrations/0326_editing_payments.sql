-- 0326_editing_payments.sql
-- Betaling/utbetaling for redigerings-oppdrag.
--   Fotograf betaler: Stripe (kort) ELLER faktura  (editing_jobs.payment_method)
--   Vendor får utbetalt: Stripe Connect (støttede land) ELLER PayPal Payouts (resten)
--   Escrow: utbetaling frigis FØRST etter fotograf-godkjenning (Showcase-flyt)
--
-- Konvensjoner (migrate.sh): egen BEGIN/COMMIT, idempotent.

BEGIN;

-- Innbetaling (fotograf)
ALTER TABLE editing_jobs ADD COLUMN IF NOT EXISTS payment_method varchar DEFAULT 'stripe'; -- stripe | invoice
ALTER TABLE editing_jobs ADD COLUMN IF NOT EXISTS stripe_checkout_session_id varchar;
ALTER TABLE editing_jobs ADD COLUMN IF NOT EXISTS invoice_url varchar;
-- payment_status finnes fra 0323: unpaid|held|released|refunded

-- Utbetaling (vendor)
ALTER TABLE editing_jobs ADD COLUMN IF NOT EXISTS payout_status varchar DEFAULT 'pending'; -- pending|released|paid|failed
ALTER TABLE editing_jobs ADD COLUMN IF NOT EXISTS payout_method varchar;                    -- stripe_connect|paypal|bank
ALTER TABLE editing_jobs ADD COLUMN IF NOT EXISTS paypal_payout_batch_id varchar;
ALTER TABLE editing_jobs ADD COLUMN IF NOT EXISTS payout_reference varchar;                  -- transfer-id / batch / fakturanr
ALTER TABLE editing_jobs ADD COLUMN IF NOT EXISTS paid_at timestamp;

-- Vendor utbetalingspreferanse (utenlandske kan ikke bruke Fiken; PayPal-fallback)
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS payout_method varchar DEFAULT 'stripe_connect'; -- stripe_connect|paypal|bank
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS paypal_payout_email varchar;
-- stripe_connect_account_id finnes fra 0323

COMMIT;
