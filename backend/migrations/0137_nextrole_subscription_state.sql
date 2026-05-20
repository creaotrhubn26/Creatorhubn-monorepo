-- 0137 — NextRole abonnements-state på marketplace_installations
--
-- Utvider eksisterende marketplace_installations (fra
-- migrate-role-room-integration.sql) med felter NextRole trenger for
-- entitlement-sjekk:
--
--   tier              'trial' | 'standard' | 'pro' | 'cancelled'
--   stripe_customer_id  for å hente subscription-status fra Stripe ved behov
--   stripe_subscription_id  for å se ferdig-fakturering-status
--   trial_ends_at     når 14-dagers trial utløper (NULL hvis betalende)
--   current_period_end  Stripe billing-cycle slutt
--   status_updated_at sist webhook-event ble håndtert
--
-- Idempotent.

DO $$ BEGIN
  ALTER TABLE marketplace_installations
    ADD COLUMN IF NOT EXISTS tier            VARCHAR(32),
    ADD COLUMN IF NOT EXISTS stripe_customer_id     VARCHAR(255),
    ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS trial_ends_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ DEFAULT NOW();
END $$;

CREATE INDEX IF NOT EXISTS marketplace_installations_stripe_subscription_idx
  ON marketplace_installations (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS marketplace_installations_trial_ends_at_idx
  ON marketplace_installations (trial_ends_at)
  WHERE trial_ends_at IS NOT NULL AND tier = 'trial';
