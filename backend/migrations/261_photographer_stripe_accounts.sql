-- 261_photographer_stripe_accounts.sql
--
-- Stripe Connect-konto per fotograf/skaper. Bildekjøp i client-gallery skal
-- betales til FOTOGRAFENS egen Stripe-konto (destination charge), ikke
-- CreatorHubs plattform-konto. Følger samme Connect-mønster som
-- academy_instructors.stripe_account_id (admin-academy-routes.ts), men scopet
-- til vanlige brukere (photographer_id = users/local-admin id-streng).
--
--   * stripe_account_id  — Express connected-account id (acct_...)
--   * onboarding_status  — 'pending' | 'complete' (utledet av Stripe-status)
--   * charges/payouts/details — speilet fra Stripe ved status-sync + webhook
--   * UNIQUE photographer_id (én Connect-konto per fotograf)
--   * UNIQUE stripe_account_id + index for revers-oppslag fra webhook
--     (account.updated → finn fotografen)

CREATE TABLE IF NOT EXISTS photographer_stripe_accounts (
  photographer_id    TEXT        PRIMARY KEY,
  stripe_account_id  TEXT        NOT NULL UNIQUE,
  onboarding_status  TEXT        NOT NULL DEFAULT 'pending',
  charges_enabled    BOOLEAN     NOT NULL DEFAULT FALSE,
  payouts_enabled    BOOLEAN     NOT NULL DEFAULT FALSE,
  details_submitted  BOOLEAN     NOT NULL DEFAULT FALSE,
  country            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photographer_stripe_account_id
  ON photographer_stripe_accounts (stripe_account_id);
