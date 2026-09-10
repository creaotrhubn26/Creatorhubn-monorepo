-- Add e-mail OTP evidence and durable signing receipts to the CreatorHub
-- prototype-tester agreement flow. Existing accepted agreements keep their
-- historic evidence and receive a receipt id without being reclassified as
-- e-mail verified.

ALTER TABLE prototype_tester_invites
  ADD COLUMN IF NOT EXISTS signature_method VARCHAR(80),
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signing_receipt_id UUID,
  ADD COLUMN IF NOT EXISTS receipt_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receipt_email_provider VARCHAR(80),
  ADD COLUMN IF NOT EXISTS receipt_email_message_id TEXT,
  ADD COLUMN IF NOT EXISTS receipt_email_delivery_reason TEXT;

UPDATE prototype_tester_invites
   SET signing_receipt_id = COALESCE(signing_receipt_id, gen_random_uuid()),
       signature_method = COALESCE(signature_method, 'typed_name_legacy')
 WHERE status = 'accepted'
   AND agreement_digest IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_prototype_tester_invites_receipt_id
  ON prototype_tester_invites (signing_receipt_id)
  WHERE signing_receipt_id IS NOT NULL;

COMMENT ON COLUMN prototype_tester_invites.email_verified_at IS
  'When the invite recipient proved control of the invited e-mail using a one-time code.';

COMMENT ON COLUMN prototype_tester_invites.signing_receipt_id IS
  'Stable non-secret identifier for the authenticated signing receipt.';

COMMENT ON COLUMN prototype_tester_invites.receipt_email_sent_at IS
  'Provider-confirmed send time for the dedicated signing receipt e-mail.';
