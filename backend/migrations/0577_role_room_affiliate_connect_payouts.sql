-- 0577_role_room_affiliate_connect_payouts.sql
-- Organization-owned Stripe Connect onboarding and an auditable affiliate
-- commission/payout ledger. Money is stored in the currency's minor unit.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '180s';

ALTER TABLE role_room_affiliate_partners
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_connect_country CHAR(2) NOT NULL DEFAULT 'NO',
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_status VARCHAR(24) NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS stripe_connect_details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_connect_transfers_status VARCHAR(24),
  ADD COLUMN IF NOT EXISTS stripe_connect_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS stripe_connect_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payout_currency CHAR(3) NOT NULL DEFAULT 'nok',
  ADD COLUMN IF NOT EXISTS minimum_payout_minor BIGINT NOT NULL DEFAULT 100000,
  ADD COLUMN IF NOT EXISTS last_connect_payout_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_connect_payout_status VARCHAR(24),
  ADD COLUMN IF NOT EXISTS last_connect_payout_at TIMESTAMPTZ;

ALTER TABLE role_room_affiliate_partners
  DROP CONSTRAINT IF EXISTS role_room_affiliate_partners_connect_status_check,
  ADD CONSTRAINT role_room_affiliate_partners_connect_status_check
    CHECK (stripe_connect_onboarding_status IN ('not_started', 'pending', 'restricted', 'complete')),
  DROP CONSTRAINT IF EXISTS role_room_affiliate_partners_minimum_payout_check,
  ADD CONSTRAINT role_room_affiliate_partners_minimum_payout_check
    CHECK (minimum_payout_minor >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS role_room_affiliate_partners_connect_account_uidx
  ON role_room_affiliate_partners(stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;

ALTER TABLE role_room_affiliate_commissions
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_charge_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS source_payment_amount_minor BIGINT,
  ADD COLUMN IF NOT EXISTS matures_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

UPDATE role_room_affiliate_commissions
   SET matures_at = COALESCE(matures_at, created_at + INTERVAL '30 days'),
       source_payment_amount_minor = COALESCE(source_payment_amount_minor, eligible_revenue_minor)
 WHERE matures_at IS NULL OR source_payment_amount_minor IS NULL;

ALTER TABLE role_room_affiliate_commissions
  ALTER COLUMN source_payment_amount_minor SET NOT NULL,
  ALTER COLUMN matures_at SET DEFAULT (NOW() + INTERVAL '30 days'),
  ALTER COLUMN matures_at SET NOT NULL;

ALTER TABLE role_room_affiliate_commissions
  DROP CONSTRAINT IF EXISTS role_room_affiliate_commissions_source_payment_check,
  ADD CONSTRAINT role_room_affiliate_commissions_source_payment_check
    CHECK (source_payment_amount_minor >= 0);

CREATE INDEX IF NOT EXISTS role_room_affiliate_commissions_payment_intent_idx
  ON role_room_affiliate_commissions(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS role_room_affiliate_commissions_charge_idx
  ON role_room_affiliate_commissions(stripe_charge_id)
  WHERE stripe_charge_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS role_room_affiliate_commissions_maturity_idx
  ON role_room_affiliate_commissions(matures_at, currency, status);

CREATE TABLE IF NOT EXISTS role_room_affiliate_commission_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID NOT NULL
    REFERENCES role_room_affiliate_commissions(id) ON DELETE RESTRICT,
  kind VARCHAR(24) NOT NULL
    CHECK (kind IN ('refund', 'chargeback', 'chargeback_recovered', 'manual')),
  source_object_id VARCHAR(255) NOT NULL,
  stripe_event_id VARCHAR(255),
  currency CHAR(3) NOT NULL DEFAULT 'nok',
  amount_minor BIGINT NOT NULL CHECK (amount_minor <> 0),
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (commission_id, kind, source_object_id)
);

CREATE INDEX IF NOT EXISTS role_room_affiliate_adjustments_commission_idx
  ON role_room_affiliate_commission_adjustments(commission_id, created_at);

CREATE TABLE IF NOT EXISTS role_room_affiliate_payouts (
  id UUID PRIMARY KEY,
  affiliate_partner_id UUID NOT NULL
    REFERENCES role_room_affiliate_partners(id) ON DELETE RESTRICT,
  stripe_connect_account_id VARCHAR(255) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'nok',
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  minimum_payout_minor BIGINT NOT NULL CHECK (minimum_payout_minor >= 0),
  batch_period DATE NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'transferred', 'reversed', 'failed')),
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  stripe_transfer_id VARCHAR(255) UNIQUE,
  stripe_transfer_reversed_minor BIGINT NOT NULL DEFAULT 0
    CHECK (stripe_transfer_reversed_minor >= 0),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT,
  initiated_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_at TIMESTAMPTZ,
  transferred_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (affiliate_partner_id, currency, batch_period)
);

CREATE INDEX IF NOT EXISTS role_room_affiliate_payouts_status_idx
  ON role_room_affiliate_payouts(status, created_at);

CREATE TABLE IF NOT EXISTS role_room_affiliate_payout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID NOT NULL
    REFERENCES role_room_affiliate_payouts(id) ON DELETE RESTRICT,
  commission_id UUID NOT NULL
    REFERENCES role_room_affiliate_commissions(id) ON DELETE RESTRICT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  reversed_amount_minor BIGINT NOT NULL DEFAULT 0
    CHECK (reversed_amount_minor >= 0 AND reversed_amount_minor <= amount_minor),
  status VARCHAR(20) NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'transferred', 'released', 'reversed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (payout_id, commission_id)
);

CREATE INDEX IF NOT EXISTS role_room_affiliate_payout_items_commission_idx
  ON role_room_affiliate_payout_items(commission_id, status);

CREATE TABLE IF NOT EXISTS role_room_affiliate_connected_payout_events (
  stripe_payout_id VARCHAR(255) PRIMARY KEY,
  affiliate_partner_id UUID NOT NULL
    REFERENCES role_room_affiliate_partners(id) ON DELETE RESTRICT,
  stripe_connect_account_id VARCHAR(255) NOT NULL,
  currency CHAR(3) NOT NULL,
  amount_minor BIGINT NOT NULL,
  status VARCHAR(24) NOT NULL,
  arrival_at TIMESTAMPTZ,
  failure_code VARCHAR(120),
  failure_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS role_room_affiliate_connected_payout_partner_idx
  ON role_room_affiliate_connected_payout_events(affiliate_partner_id, updated_at DESC);

COMMENT ON COLUMN role_room_affiliate_commissions.matures_at IS
  'Commission becomes payout-eligible after the refund/chargeback hold period.';
COMMENT ON TABLE role_room_affiliate_commission_adjustments IS
  'Immutable signed ledger entries. Refunds/chargebacks are negative; recovered disputes are positive.';
COMMENT ON TABLE role_room_affiliate_payouts IS
  'Monthly organization-level transfers from the platform balance to Stripe Connect.';
COMMENT ON TABLE role_room_affiliate_connected_payout_events IS
  'Connected-account bank payout lifecycle; not a one-to-one mapping to platform transfer batches.';

COMMIT;
