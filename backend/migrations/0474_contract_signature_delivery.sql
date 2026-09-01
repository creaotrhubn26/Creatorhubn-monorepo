-- Immutable delivery evidence and bearer-token authorization for contracts.
-- Raw signing tokens are never persisted; only their SHA-256 digest is stored.

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS delivery_recipient_email VARCHAR,
  ADD COLUMN IF NOT EXISTS delivery_recipient_name VARCHAR,
  ADD COLUMN IF NOT EXISTS delivery_document_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS signing_token_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS signing_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signing_token_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_requested_by VARCHAR,
  ADD COLUMN IF NOT EXISTS delivery_message_id TEXT,
  ADD COLUMN IF NOT EXISTS delivery_provider VARCHAR(32);

-- Token recipients do not necessarily have an internal customer/person row.
ALTER TABLE customer_signatures
  ALTER COLUMN signer_person_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contracts_signing_token_hash_unique_idx
  ON contracts (signing_token_hash)
  WHERE signing_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS contracts_signing_token_expiry_idx
  ON contracts (signing_token_expires_at)
  WHERE signing_token_hash IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'contracts_signing_token_hash_format_check'
  ) THEN
    ALTER TABLE contracts
      ADD CONSTRAINT contracts_signing_token_hash_format_check
      CHECK (
        signing_token_hash IS NULL
        OR signing_token_hash ~ '^[0-9a-f]{64}$'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'contracts_delivery_document_hash_format_check'
  ) THEN
    ALTER TABLE contracts
      ADD CONSTRAINT contracts_delivery_document_hash_format_check
      CHECK (
        delivery_document_hash IS NULL
        OR delivery_document_hash ~ '^[0-9a-f]{64}$'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'contracts_signing_token_expiry_check'
  ) THEN
    ALTER TABLE contracts
      ADD CONSTRAINT contracts_signing_token_expiry_check
      CHECK (
        signing_token_hash IS NULL
        OR signing_token_expires_at IS NOT NULL
      );
  END IF;
END $$;

COMMENT ON COLUMN contracts.delivery_recipient_email IS
  'Immutable normalized email snapshot used for the delivered signing invitation.';
COMMENT ON COLUMN contracts.delivery_document_hash IS
  'Canonical legal-document hash captured before delivery; verified again before signing.';
COMMENT ON COLUMN contracts.signing_token_hash IS
  'SHA-256 digest of the active signing bearer token. The raw token exists only in the email link.';
COMMENT ON COLUMN contracts.delivery_sent_at IS
  'Set only after the transactional email provider confirms delivery acceptance.';
