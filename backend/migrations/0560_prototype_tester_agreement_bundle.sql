-- Complete, versioned agreement bundle for CreatorHub prototype testers.
--
-- Existing accepted invitations remain valid under their historic NDA and
-- program-terms evidence. Pending and new invitations must explicitly accept
-- the DPA and letter of intent before access can be activated.

ALTER TABLE prototype_tester_invites
  ADD COLUMN IF NOT EXISTS dpa_version VARCHAR(16) NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS letter_of_intent_version VARCHAR(16) NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS accepted_dpa BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepted_letter_of_intent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepted_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_signing_authority BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepted_agreements_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS agreement_digest VARCHAR(64),
  ADD COLUMN IF NOT EXISTS provisioned_user_id TEXT,
  ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMPTZ;

COMMENT ON COLUMN prototype_tester_invites.accepted_agreements_snapshot IS
  'Immutable snapshot of every agreement document shown during electronic acceptance, including full text and versions.';

COMMENT ON COLUMN prototype_tester_invites.agreement_digest IS
  'SHA-256 of the canonical JSON agreement snapshot stored at acceptance time.';

COMMENT ON COLUMN prototype_tester_invites.accepted_user_agent IS
  'User-Agent captured with signer name, email, timestamp and IP as acceptance evidence.';

COMMENT ON COLUMN prototype_tester_invites.confirmed_signing_authority IS
  'Signer confirmed authority to accept for themselves and any represented company.';

COMMENT ON COLUMN prototype_tester_invites.provisioned_user_id IS
  'User account activated after agreement acceptance; NULL permits safe activation retry.';
