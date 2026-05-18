-- 0126_tester_enterprise_offers.sql
-- Slice 9X.57 — Konvertering av team-prototype-testere til Enterprise.
--
-- Trigger: 14 dager før program_ends_at (sjekkes av setInterval-runner som
-- kjører hver time) opprettes et offer per team-master. Offer inneholder
-- de økonomiske vilkårene (3 mnd gratis, deretter 25 % rabatt i 12 mnd).
--
-- Når master aksepterer via Stripe Checkout:
--   1. Stripe webhook setter accepted_at og stripe_subscription_id
--   2. Master får e-post-bekreftelse
--   3. Hele teamet får e-post om at organisasjonen nå er Enterprise

CREATE TABLE IF NOT EXISTS tester_enterprise_offers (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tester_master_invite_id     UUID NOT NULL REFERENCES prototype_tester_invites(id) ON DELETE CASCADE,
  -- Snapshot av tilbudet
  team_size_at_offer          INTEGER NOT NULL,
  free_months                 INTEGER NOT NULL DEFAULT 3,
  discount_pct_after_free     INTEGER NOT NULL DEFAULT 25,
  discount_months_after_free  INTEGER NOT NULL DEFAULT 12,
  -- Status: 'sent' | 'accepted' | 'declined' | 'expired'
  status                      VARCHAR(20) NOT NULL DEFAULT 'sent',
  sent_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at                  TIMESTAMPTZ NOT NULL,
  accepted_at                 TIMESTAMPTZ,
  declined_at                 TIMESTAMPTZ,
  -- Stripe-kobling (settes når master fullfører Checkout)
  stripe_checkout_session_id  TEXT,
  stripe_subscription_id      TEXT,
  stripe_customer_id          TEXT,
  -- Sporing
  email_sent_at               TIMESTAMPTZ,
  reminder_sent_at            TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tester_enterprise_offers_master
  ON tester_enterprise_offers (tester_master_invite_id);

CREATE INDEX IF NOT EXISTS idx_tester_enterprise_offers_status
  ON tester_enterprise_offers (status, expires_at);

CREATE INDEX IF NOT EXISTS idx_tester_enterprise_offers_stripe_session
  ON tester_enterprise_offers (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

COMMENT ON TABLE tester_enterprise_offers IS
  'Etter-program-tilbud for team-mastere: 3 mnd gratis Enterprise + 25 % rabatt i 12 mnd. Triggers 14 dager før program_ends_at.';
COMMENT ON COLUMN tester_enterprise_offers.free_months IS
  'Antall måneder med 100 % rabatt (Stripe trial_period_days). Snapshot av tilbudet — kan endres i fremtidige offers uten å påvirke aktive.';
