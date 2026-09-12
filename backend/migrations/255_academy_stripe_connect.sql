-- ── 255_academy_stripe_connect.sql ─────────────────────────────────
-- Stripe Connect Express-onboarding for Academy-instruktører +
-- per-enrollment revenue-split + Stripe Transfer-audit + refund-audit
-- + webhook-event-deduplisering.
--
-- Konsept:
--   * Academy-instruktører får Express Connect-konto (Stripe håndterer
--     KYC via BankID for norske kontoer).
--   * Enrollments lagrer hvilken share platformen tar (20 %) og hva
--     som skal til instruktør (80 %). Selve overføringen skjer via
--     Stripe Transfer fra Connect-balance når payout markeres betalt.
--   * Webhook-handler synker account-/transfer-/charge-events tilbake
--     til DB, og dedupliseres via academy_stripe_webhook_events.
--
-- Forhåndskrav:
--   * Migrasjon 243 (academy_instructors, academy_enrollments)
--   * Migrasjon 254 (academy_payouts)
-- ───────────────────────────────────────────────────────────────────

-- ── academy_instructors: Express Connect account-state ─────────────
ALTER TABLE academy_instructors
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_account_country TEXT DEFAULT 'NO',
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'not_started',
  -- 'not_started' | 'pending' | 'restricted' | 'enabled' | 'disabled'
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payouts_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS charges_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requirements_currently_due TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS academy_instructors_stripe_account_idx
  ON academy_instructors (stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

-- ── academy_enrollments: per-enrollment revenue-split ──────────────
ALTER TABLE academy_enrollments
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT,
  ADD COLUMN IF NOT EXISTS platform_fee_nok INTEGER NOT NULL DEFAULT 0,
    -- 20 % av amount_paid_nok som CreatorHub holder
  ADD COLUMN IF NOT EXISTS instructor_revenue_nok INTEGER NOT NULL DEFAULT 0,
    -- 80 % av amount_paid_nok som går til instruktør
  ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT,
    -- Hvilken transfer som overførte instructor-revenue til Connect account
  ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'pending';
    -- 'pending' | 'transferred' | 'refunded' | 'reversed'

CREATE INDEX IF NOT EXISTS academy_enrollments_charge_idx
  ON academy_enrollments (stripe_charge_id)
  WHERE stripe_charge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS academy_enrollments_payment_intent_idx
  ON academy_enrollments (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- ── academy_transfers: Stripe Transfer-audit-trail ─────────────────
CREATE TABLE IF NOT EXISTS academy_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID REFERENCES academy_payouts(id),
  stripe_transfer_id TEXT NOT NULL UNIQUE,
  instructor_id UUID NOT NULL,
  amount_nok INTEGER NOT NULL,
  destination_account_id TEXT NOT NULL,
  source_transaction TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'in_transit' | 'paid' | 'failed' | 'reversed'
  failure_code TEXT,
  failure_message TEXT,
  initiated_by TEXT,
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS academy_transfers_instructor_idx
  ON academy_transfers (instructor_id, initiated_at DESC);
CREATE INDEX IF NOT EXISTS academy_transfers_status_idx
  ON academy_transfers (status, initiated_at DESC);
CREATE INDEX IF NOT EXISTS academy_transfers_payout_idx
  ON academy_transfers (payout_id)
  WHERE payout_id IS NOT NULL;

-- ── academy_refunds: refund-audit ──────────────────────────────────
-- Når en student blir refundert etter at payout er gjort må vi spore
-- både Stripe refund-id og hvor mye instruktør "skylder" (clawback).
CREATE TABLE IF NOT EXISTS academy_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID,
  stripe_refund_id TEXT NOT NULL UNIQUE,
  stripe_charge_id TEXT,
  amount_refunded_nok INTEGER NOT NULL,
  platform_fee_reversed_nok INTEGER NOT NULL DEFAULT 0,
  instructor_clawback_nok INTEGER NOT NULL DEFAULT 0,
    -- Hvor mye vi prøvde å kreve tilbake fra instructor (kan være > 0
    -- selv om instructor allerede er betalt — krever manuell handling
    -- inntil transfer-reversal automatiseres).
  related_transfer_id UUID REFERENCES academy_transfers(id),
  reversed_transfer_id TEXT,
    -- Stripe transfer.reversal id hvis vi reverserte transfer
  reason TEXT,
  refunded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS academy_refunds_enrollment_idx
  ON academy_refunds (enrollment_id)
  WHERE enrollment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS academy_refunds_charge_idx
  ON academy_refunds (stripe_charge_id)
  WHERE stripe_charge_id IS NOT NULL;

-- ── academy_stripe_webhook_events: idempotency-store ──────────────
CREATE TABLE IF NOT EXISTS academy_stripe_webhook_events (
  stripe_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'received',
    -- 'received' | 'processed' | 'failed' | 'duplicate'
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS academy_stripe_webhook_events_type_idx
  ON academy_stripe_webhook_events (event_type, received_at DESC);
CREATE INDEX IF NOT EXISTS academy_stripe_webhook_events_status_idx
  ON academy_stripe_webhook_events (status, received_at DESC);
