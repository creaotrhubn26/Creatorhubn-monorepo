-- Standalone Workspace participant document lifecycle.
--
-- This migration intentionally builds only on the Workspace participant tables
-- introduced by 0467. It does not grant accounts, team seats, or project access.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- A personal portal credential remains a SHA-256 digest after signing. This is
-- required for idempotent retries, viewing the signed record, and withdrawing an
-- active media consent. The raw 32-byte bearer token is never persisted.
ALTER TABLE workspace_participant_document_signers
  DROP CONSTRAINT IF EXISTS workspace_participant_document_signers_token_lifecycle,
  DROP CONSTRAINT IF EXISTS workspace_participant_document_signers_status_evidence;

ALTER TABLE workspace_participant_document_signers
  ADD CONSTRAINT workspace_participant_document_signers_token_lifecycle
    CHECK (
      (signing_token_hash IS NULL OR token_issued_at IS NOT NULL)
      AND (token_expires_at IS NULL OR (
        token_issued_at IS NOT NULL AND token_expires_at > token_issued_at
      ))
      AND (token_revoked_at IS NULL OR (
        token_issued_at IS NOT NULL AND token_revoked_at >= token_issued_at
      ))
      AND (token_revoked_at IS NULL OR signing_token_hash IS NULL)
      AND (
        status <> 'pending'
        OR (
          token_used_at IS NULL
          AND (
            (signing_token_hash IS NULL AND token_issued_at IS NULL
              AND token_expires_at IS NULL AND token_revoked_at IS NULL)
            OR (signing_token_hash IS NOT NULL AND token_issued_at IS NOT NULL
              AND token_expires_at IS NOT NULL)
            OR (signing_token_hash IS NULL AND token_issued_at IS NOT NULL
              AND token_expires_at IS NOT NULL AND token_revoked_at IS NOT NULL)
          )
        )
      )
    ),
  ADD CONSTRAINT workspace_participant_document_signers_status_evidence
    CHECK (
      (status = 'pending' AND token_used_at IS NULL AND signed_at IS NULL
        AND declined_at IS NULL AND signature_evidence IS NULL)
      OR (status = 'signed' AND token_issued_at IS NOT NULL
        AND token_used_at IS NOT NULL AND signed_at IS NOT NULL
        AND declined_at IS NULL AND signature_evidence IS NOT NULL)
      OR (status = 'declined' AND token_issued_at IS NOT NULL
        AND token_used_at IS NOT NULL AND declined_at IS NOT NULL
        AND signed_at IS NULL)
    );

ALTER TABLE workspace_participant_documents
  DROP CONSTRAINT IF EXISTS workspace_participant_documents_withdrawable_type;
ALTER TABLE workspace_participant_documents
  ADD CONSTRAINT workspace_participant_documents_withdrawable_type
    CHECK (status <> 'withdrawn' OR document_type = 'media_consent');

-- One external legal signer is sufficient for the adult or guardian flow in
-- this slice. Producer/witness expansion can remain multi-row later.
DROP INDEX IF EXISTS ux_workspace_participant_document_external_signer;
CREATE UNIQUE INDEX IF NOT EXISTS ux_workspace_participant_document_external_signer
  ON workspace_participant_document_signers (document_id)
  WHERE signer_role IN ('participant', 'guardian');

CREATE OR REPLACE FUNCTION creatorhub_protect_workspace_legal_document()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_document_workflow_required';
    END IF;
    IF NEW.signed_at IS NOT NULL OR NEW.withdrawn_at IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_document_evidence_invalid';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_legal_record_locked';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status <> 'draft' AND (
       NEW.organization_id IS DISTINCT FROM OLD.organization_id
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.participant_id IS DISTINCT FROM OLD.participant_id
       OR NEW.document_type IS DISTINCT FROM OLD.document_type
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.terms_snapshot IS DISTINCT FROM OLD.terms_snapshot
       OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
       OR NEW.supersedes_document_id IS DISTINCT FROM OLD.supersedes_document_id
       OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_legal_record_locked';
  END IF;

  IF NOT (
    (OLD.status = 'draft' AND NEW.status IN ('draft', 'issued'))
    OR (OLD.status = 'issued' AND NEW.status IN ('issued', 'viewed', 'signed', 'declined', 'expired', 'superseded'))
    OR (OLD.status = 'viewed' AND NEW.status IN ('viewed', 'signed', 'declined', 'expired', 'superseded'))
    OR (OLD.status = 'signed' AND NEW.status IN ('signed', 'withdrawn', 'superseded'))
    OR (OLD.status IN ('declined', 'withdrawn', 'expired', 'superseded') AND NEW.status = OLD.status)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_document_transition_invalid';
  END IF;

  IF NEW.status = 'withdrawn' AND NEW.document_type <> 'media_consent' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_document_not_withdrawable';
  END IF;

  IF NEW.signed_at IS DISTINCT FROM OLD.signed_at THEN
    IF NOT (
      OLD.status IN ('issued', 'viewed')
      AND NEW.status = 'signed'
      AND OLD.signed_at IS NULL
      AND NEW.signed_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_signature_timestamp_locked';
    END IF;
  ELSIF NEW.status = 'signed' AND NEW.signed_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_signature_timestamp_required';
  END IF;

  IF NEW.withdrawn_at IS DISTINCT FROM OLD.withdrawn_at THEN
    IF NOT (
      OLD.status = 'signed'
      AND NEW.status = 'withdrawn'
      AND OLD.document_type = 'media_consent'
      AND OLD.withdrawn_at IS NULL
      AND NEW.withdrawn_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_withdrawal_timestamp_locked';
    END IF;
  ELSIF NEW.status = 'withdrawn' AND NEW.withdrawn_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_withdrawal_timestamp_required';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION creatorhub_protect_workspace_signature_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_signer_workflow_required';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_signature_locked';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.participant_id IS DISTINCT FROM OLD.participant_id
     OR NEW.document_id IS DISTINCT FROM OLD.document_id
     OR NEW.signer_role IS DISTINCT FROM OLD.signer_role
     OR NEW.signer_name IS DISTINCT FROM OLD.signer_name
     OR NEW.signer_email IS DISTINCT FROM OLD.signer_email
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_signer_identity_locked';
  END IF;

  IF OLD.status = 'pending' THEN
    IF NEW.status NOT IN ('pending', 'signed', 'declined') THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_signer_transition_invalid';
    END IF;
    IF OLD.token_revoked_at IS NOT NULL AND NEW.status <> 'pending' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_signing_token_revoked';
    END IF;
    RETURN NEW;
  END IF;

  -- A signed/declined legal decision is immutable. Only the bearer credential
  -- may be rotated or revoked; token_used_at remains the original decision time.
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.signature_evidence IS DISTINCT FROM OLD.signature_evidence
     OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
     OR NEW.declined_at IS DISTINCT FROM OLD.declined_at
     OR NEW.token_used_at IS DISTINCT FROM OLD.token_used_at THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_signature_locked';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON COLUMN workspace_participant_document_signers.signing_token_hash IS
  'SHA-256 digest of the current personal document portal credential. Raw 32-byte tokens are never persisted or logged.';

COMMIT;
