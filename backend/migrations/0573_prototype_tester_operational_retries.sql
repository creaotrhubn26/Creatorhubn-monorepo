-- Operational evidence for idempotent prototype-tester delivery and account
-- retries. A retry always reuses the existing invitation and receipt.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE prototype_tester_invites
  ADD COLUMN IF NOT EXISTS email_delivery_attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS account_provisioning_attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS account_provisioning_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS account_provisioning_error TEXT,
  ADD COLUMN IF NOT EXISTS access_email_attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS access_email_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_email_provider VARCHAR(80),
  ADD COLUMN IF NOT EXISTS access_email_message_id TEXT,
  ADD COLUMN IF NOT EXISTS access_email_delivery_reason TEXT,
  ADD COLUMN IF NOT EXISTS receipt_email_attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_email_last_attempt_at TIMESTAMPTZ;

UPDATE prototype_tester_invites
   SET email_delivery_attempt_count = GREATEST(email_delivery_attempt_count, 1),
       email_last_attempt_at = COALESCE(email_last_attempt_at, email_sent_at, created_at)
 WHERE email_sent_at IS NOT NULL;

UPDATE prototype_tester_invites
   SET account_provisioning_attempt_count = GREATEST(account_provisioning_attempt_count, 1),
       account_provisioning_last_attempt_at = COALESCE(
         account_provisioning_last_attempt_at,
         provisioned_at,
         accepted_at
       )
 WHERE provisioned_at IS NOT NULL;

UPDATE prototype_tester_invites
   SET receipt_email_attempt_count = GREATEST(receipt_email_attempt_count, 1),
       receipt_email_last_attempt_at = COALESCE(
         receipt_email_last_attempt_at,
         receipt_email_sent_at,
         accepted_at
       )
 WHERE receipt_email_sent_at IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'prototype_tester_invites_retry_counts_nonnegative'
       AND conrelid = 'prototype_tester_invites'::regclass
  ) THEN
    ALTER TABLE prototype_tester_invites
      ADD CONSTRAINT prototype_tester_invites_retry_counts_nonnegative
      CHECK (
        email_delivery_attempt_count >= 0
        AND account_provisioning_attempt_count >= 0
        AND access_email_attempt_count >= 0
        AND receipt_email_attempt_count >= 0
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_prototype_tester_invites_operational_followup
  ON prototype_tester_invites (status, updated_at DESC)
  WHERE email_delivery_reason IS NOT NULL
     OR account_provisioning_error IS NOT NULL
     OR access_email_delivery_reason IS NOT NULL
     OR receipt_email_delivery_reason IS NOT NULL;

COMMENT ON COLUMN prototype_tester_invites.account_provisioning_error IS
  'Latest safe operational error code/message for admin follow-up; never stores credentials or sign-in codes.';

COMMENT ON COLUMN prototype_tester_invites.access_email_sent_at IS
  'Provider-confirmed send time for the access-activated e-mail.';

COMMIT;
