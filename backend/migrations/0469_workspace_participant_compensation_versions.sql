-- Versioned Workspace participant compensation backed by private general
-- split sheets. This remains a standalone Workspace/Enterprise domain: an
-- external participant is not a user, team member, seat, or project member.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE workspace_participant_compensation_links
  ADD COLUMN IF NOT EXISTS version INTEGER,
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS idempotency_key UUID,
  ADD COLUMN IF NOT EXISTS request_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS supersedes_link_id UUID,
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 0467 allowed hourly foundations before estimated_hours was a first-class
-- column. Recover only an explicit, bounded two-decimal estimate from the
-- immutable terms snapshot. Missing/ambiguous legal terms fail closed below;
-- inventing an estimate would silently alter the agreement.
UPDATE workspace_participant_compensation_links
   SET estimated_hours = (terms_snapshot->>'estimatedHours')::NUMERIC(10, 2)
 WHERE compensation_type = 'hourly'
   AND estimated_hours IS NULL
   AND COALESCE(terms_snapshot->>'estimatedHours', '')
       ~ '^[0-9]{1,5}([.][0-9]{1,2})?$'
   AND (terms_snapshot->>'estimatedHours')::NUMERIC > 0
   AND (terms_snapshot->>'estimatedHours')::NUMERIC <= 10000;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM workspace_participant_compensation_links
     WHERE compensation_type = 'hourly'
       AND estimated_hours IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'workspace_hourly_compensation_estimate_missing';
  END IF;
END;
$$;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY organization_id, project_id, participant_id
           ORDER BY created_at, id
         ) AS derived_version
    FROM workspace_participant_compensation_links
   WHERE version IS NULL
)
UPDATE workspace_participant_compensation_links link
   SET version = ranked.derived_version
  FROM ranked
 WHERE link.id = ranked.id;

UPDATE workspace_participant_compensation_links
   SET superseded_at = COALESCE(superseded_at, updated_at, created_at, NOW())
 WHERE status = 'superseded' AND superseded_at IS NULL;

UPDATE workspace_participant_compensation_links
   SET archived_at = COALESCE(archived_at, updated_at, created_at, NOW())
 WHERE status = 'archived' AND archived_at IS NULL;

ALTER TABLE workspace_participant_compensation_links
  ALTER COLUMN version SET NOT NULL,
  ALTER COLUMN version SET DEFAULT 1;

ALTER TABLE workspace_participant_compensation_links
  DROP CONSTRAINT IF EXISTS workspace_participant_compensation_exact_terms;
ALTER TABLE workspace_participant_compensation_links
  ADD CONSTRAINT workspace_participant_compensation_exact_terms
  CHECK (
    (compensation_type = 'hourly' AND hourly_rate > 0 AND estimated_hours > 0
      AND day_rate IS NULL AND fixed_amount IS NULL AND share_percentage IS NULL)
    OR (compensation_type = 'day_rate' AND day_rate > 0 AND estimated_hours IS NULL
      AND hourly_rate IS NULL AND fixed_amount IS NULL AND share_percentage IS NULL)
    OR (compensation_type = 'fixed' AND fixed_amount > 0 AND estimated_hours IS NULL
      AND hourly_rate IS NULL AND day_rate IS NULL AND share_percentage IS NULL)
    OR (compensation_type = 'share' AND share_percentage > 0 AND share_percentage <= 100
      AND estimated_hours IS NULL AND hourly_rate IS NULL AND day_rate IS NULL
      AND fixed_amount IS NULL)
    OR (compensation_type = 'unpaid' AND estimated_hours IS NULL
      AND hourly_rate IS NULL AND day_rate IS NULL AND fixed_amount IS NULL
      AND share_percentage IS NULL)
  );

ALTER TABLE workspace_participant_compensation_links
  ADD CONSTRAINT workspace_participant_compensation_version_positive
    CHECK (version > 0),
  ADD CONSTRAINT workspace_participant_compensation_request_hash_format
    CHECK (request_hash IS NULL OR request_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT workspace_participant_compensation_status_timestamps
    CHECK (
      (status IN ('draft', 'active') AND superseded_at IS NULL AND archived_at IS NULL)
      OR (status = 'superseded' AND superseded_at IS NOT NULL AND archived_at IS NULL)
      OR (status = 'archived' AND archived_at IS NOT NULL AND superseded_at IS NULL)
    );

CREATE UNIQUE INDEX IF NOT EXISTS ux_workspace_participant_compensation_scope_id
  ON workspace_participant_compensation_links
    (organization_id, project_id, participant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_workspace_participant_compensation_version
  ON workspace_participant_compensation_links
    (organization_id, project_id, participant_id, version);
CREATE UNIQUE INDEX IF NOT EXISTS ux_workspace_participant_compensation_idempotency
  ON workspace_participant_compensation_links
    (organization_id, project_id, participant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE workspace_participant_compensation_links
  ADD CONSTRAINT workspace_participant_compensation_supersedes_fk
    FOREIGN KEY (organization_id, project_id, participant_id, supersedes_link_id)
    REFERENCES workspace_participant_compensation_links
      (organization_id, project_id, participant_id, id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT workspace_participant_compensation_not_self_superseding
    CHECK (supersedes_link_id IS NULL OR supersedes_link_id <> id);

-- 0467 exposed the storage foundation before managed compensation was made
-- private-only. Abort rather than silently grandfathering any public token,
-- invitation, signature, or contributor-access row into the hardened model.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM workspace_participant_compensation_links link
      LEFT JOIN split_sheets sheet
        ON sheet.id = link.split_sheet_id
       AND sheet.project_id = link.project_id
       AND sheet.user_id = link.project_owner_user_id
      LEFT JOIN split_sheet_contributors contributor
        ON contributor.split_sheet_id = link.split_sheet_id
       AND contributor.id = link.contributor_id
     WHERE link.compensation_type <> 'unpaid'
       AND (
         sheet.id IS NULL
         OR contributor.id IS NULL
         OR contributor.user_id IS NOT NULL
         OR contributor.signed_at IS NOT NULL
         OR contributor.signature_data IS NOT NULL
         OR contributor.invitation_sent_at IS NOT NULL
         OR COALESCE(contributor.invitation_status, 'not_sent') <> 'not_sent'
         OR contributor.contributor_pin IS NOT NULL
         OR contributor.contributor_password IS NOT NULL
         OR sheet.status <> 'draft'
         OR sheet.access_code IS NOT NULL
         OR sheet.pin IS NOT NULL
         OR sheet.password IS NOT NULL
         OR sheet.security_enabled IS TRUE
         OR sheet.require_pin_for_signature IS TRUE
         OR sheet.require_password_for_signature IS TRUE
         OR (
           SELECT COUNT(*)
             FROM split_sheet_contributors sheet_contributor
            WHERE sheet_contributor.split_sheet_id = link.split_sheet_id
         ) <> 1
         OR EXISTS (
           SELECT 1
             FROM split_sheet_contributor_access access_entry
            WHERE access_entry.contributor_id = link.contributor_id
         )
       )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'workspace_compensation_legacy_signing_state_invalid';
  END IF;
END;
$$;

-- A terminal participant cannot retain live economic terms or a bearer
-- signing credential. Signed evidence remains untouched; only pending tokens
-- for issued/viewed documents are incompatible with cancellation/archive.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM workspace_project_participants participant
     WHERE (participant.archived_at IS NOT NULL
            OR participant.workflow_status IN ('archived', 'cancelled'))
       AND (
         EXISTS (
           SELECT 1
             FROM workspace_participant_compensation_links link
            WHERE link.organization_id = participant.organization_id
              AND link.project_id = participant.project_id
              AND link.participant_id = participant.id
              AND link.status = 'active'
         )
         OR EXISTS (
           SELECT 1
             FROM workspace_participant_documents document
             JOIN workspace_participant_document_signers signer
               ON signer.organization_id = document.organization_id
              AND signer.project_id = document.project_id
              AND signer.participant_id = document.participant_id
              AND signer.document_id = document.id
            WHERE document.organization_id = participant.organization_id
              AND document.project_id = participant.project_id
              AND document.participant_id = participant.id
              AND document.status IN ('issued', 'viewed')
              AND signer.status = 'pending'
              AND signer.signing_token_hash IS NOT NULL
         )
       )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'workspace_participant_terminal_legal_state_invalid';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION creatorhub_protect_workspace_participant_compensation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  sheet_metadata JSONB;
  contributor_user_id VARCHAR(255);
  contributor_fields JSONB;
  sheet_found BOOLEAN;
  contributor_count BIGINT;
  sole_contributor_matches BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'workspace_compensation_history_locked';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'workspace_compensation_workflow_required';
    END IF;

    IF NEW.compensation_type <> 'unpaid' THEN
      SELECT sheet.metadata, contributor.user_id, contributor.custom_fields
        INTO sheet_metadata, contributor_user_id, contributor_fields
        FROM split_sheets sheet
        JOIN split_sheet_contributors contributor
          ON contributor.split_sheet_id = sheet.id
         AND contributor.id = NEW.contributor_id
       WHERE sheet.id = NEW.split_sheet_id
         AND sheet.project_id = NEW.project_id
         AND sheet.user_id = NEW.project_owner_user_id;
      sheet_found := FOUND;

      SELECT COUNT(*),
             COALESCE(BOOL_AND(id = NEW.contributor_id), FALSE)
        INTO contributor_count, sole_contributor_matches
        FROM split_sheet_contributors
       WHERE split_sheet_id = NEW.split_sheet_id;

      IF NOT sheet_found
         OR contributor_count <> 1
         OR NOT sole_contributor_matches
         OR contributor_user_id IS NOT NULL
         OR NOT creatorhub_split_sheet_is_versioned(sheet_metadata)
         OR COALESCE(sheet_metadata->>'visibility', '') <> 'private'
         OR COALESCE(sheet_metadata->>'source', '') <> 'workspace-participant-compensation'
         OR COALESCE(sheet_metadata->>'workspaceProjectId', '') <> NEW.project_id
         OR COALESCE(sheet_metadata->>'workspaceParticipantId', '') <> NEW.participant_id::text
         OR COALESCE(sheet_metadata->>'workspaceCompensationId', '') <> NEW.id::text
         OR COALESCE(contributor_fields->>'workspaceParticipantId', '') <> NEW.participant_id::text
         OR COALESCE(contributor_fields->>'workspaceCompensationId', '') <> NEW.id::text THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'workspace_compensation_split_sheet_invalid';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.project_owner_user_id IS DISTINCT FROM OLD.project_owner_user_id
     OR NEW.participant_id IS DISTINCT FROM OLD.participant_id
     OR NEW.split_sheet_id IS DISTINCT FROM OLD.split_sheet_id
     OR NEW.contributor_id IS DISTINCT FROM OLD.contributor_id
     OR NEW.compensation_type IS DISTINCT FROM OLD.compensation_type
     OR NEW.hourly_rate IS DISTINCT FROM OLD.hourly_rate
     OR NEW.estimated_hours IS DISTINCT FROM OLD.estimated_hours
     OR NEW.day_rate IS DISTINCT FROM OLD.day_rate
     OR NEW.fixed_amount IS DISTINCT FROM OLD.fixed_amount
     OR NEW.share_percentage IS DISTINCT FROM OLD.share_percentage
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.terms_snapshot IS DISTINCT FROM OLD.terms_snapshot
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.request_hash IS DISTINCT FROM OLD.request_hash
     OR NEW.supersedes_link_id IS DISTINCT FROM OLD.supersedes_link_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (OLD.superseded_at IS NOT NULL
         AND NEW.superseded_at IS DISTINCT FROM OLD.superseded_at)
     OR (OLD.archived_at IS NOT NULL
         AND NEW.archived_at IS DISTINCT FROM OLD.archived_at) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'workspace_compensation_terms_locked';
  END IF;

  IF NOT (
    (OLD.status = 'draft' AND NEW.status IN ('draft', 'active', 'archived'))
    OR (OLD.status = 'active' AND NEW.status IN ('active', 'superseded', 'archived'))
    OR (OLD.status IN ('superseded', 'archived') AND NEW.status = OLD.status)
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'workspace_compensation_transition_invalid';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION creatorhub_protect_workspace_compensation_contributor()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
       NEW.split_sheet_id IS DISTINCT FROM OLD.split_sheet_id
       OR NEW.name IS DISTINCT FROM OLD.name
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.percentage IS DISTINCT FROM OLD.percentage
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.order_index IS DISTINCT FROM OLD.order_index
       OR NEW.notes IS DISTINCT FROM OLD.notes
       OR NEW.custom_fields IS DISTINCT FROM OLD.custom_fields
     ) AND EXISTS (
       SELECT 1
         FROM workspace_participant_compensation_links link
        WHERE link.split_sheet_id = OLD.split_sheet_id
          AND link.contributor_id = OLD.id
          AND link.status IN ('active', 'superseded', 'archived')
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'workspace_compensation_contributor_terms_locked';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION creatorhub_protect_workspace_compensation_sheet()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  all_signed BOOLEAN;
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.track_id IS DISTINCT FROM OLD.track_id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.metadata IS DISTINCT FROM OLD.metadata THEN
    IF EXISTS (
      SELECT 1
        FROM workspace_participant_compensation_links link
       WHERE link.split_sheet_id = OLD.id
         AND link.status IN ('active', 'superseded', 'archived')
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'workspace_compensation_sheet_terms_locked';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND EXISTS (
    SELECT 1
      FROM workspace_participant_compensation_links link
     WHERE link.split_sheet_id = OLD.id
       AND link.status IN ('active', 'superseded', 'archived')
  ) THEN
    IF NOT (
      (OLD.status = 'draft' AND NEW.status IN ('pending_signatures', 'archived'))
      OR (OLD.status = 'pending_signatures' AND NEW.status IN ('completed', 'archived'))
      OR (OLD.status = 'completed' AND NEW.status = 'archived')
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'workspace_compensation_sheet_transition_invalid';
    END IF;

    IF OLD.status = 'pending_signatures' AND NEW.status = 'completed' THEN
      SELECT COUNT(*) > 0 AND BOOL_AND(signed_at IS NOT NULL)
        INTO all_signed
        FROM split_sheet_contributors
       WHERE split_sheet_id = OLD.id;
      IF NOT COALESCE(all_signed, FALSE) THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'workspace_compensation_signatures_incomplete';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Final authoritative link guard. The earlier definition keeps the migration
-- readable against 0467; this replacement adds the private-sheet namespace
-- and canonical numeric-term checks required by the production service.
CREATE OR REPLACE FUNCTION creatorhub_workspace_json_numeric_matches(
  document JSONB,
  field_name TEXT,
  expected_value NUMERIC
)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN expected_value IS NULL THEN
      NOT (COALESCE(document, '{}'::jsonb) ? field_name)
      OR COALESCE(document, '{}'::jsonb)->field_name = 'null'::jsonb
    WHEN jsonb_typeof(COALESCE(document, '{}'::jsonb)->field_name) = 'number' THEN
      (document->>field_name)::NUMERIC = expected_value
    ELSE FALSE
  END;
$$;

CREATE OR REPLACE FUNCTION creatorhub_protect_workspace_participant_compensation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  sheet_record RECORD;
  contributor_record RECORD;
  sheet_found BOOLEAN;
  contributor_found BOOLEAN;
  contributor_count BIGINT;
  sole_contributor_matches BOOLEAN;
  expected_amount NUMERIC;
  participant_record RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'workspace_compensation_history_locked';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT participant.workflow_status, participant.archived_at
      INTO participant_record
      FROM workspace_project_participants participant
     WHERE participant.organization_id = NEW.organization_id
       AND participant.project_id = NEW.project_id
       AND participant.id = NEW.participant_id;
    IF NOT FOUND
       OR participant_record.archived_at IS NOT NULL
       OR participant_record.workflow_status IN ('archived', 'cancelled') THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'workspace_compensation_participant_terminal';
    END IF;

    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'workspace_compensation_workflow_required';
    END IF;

    IF COALESCE(NEW.terms_snapshot->>'source', '')
         <> 'workspace-participant-compensation'
       OR COALESCE(NEW.terms_snapshot->>'workspaceProjectId', '') <> NEW.project_id
       OR COALESCE(NEW.terms_snapshot->>'workspaceParticipantId', '')
         <> NEW.participant_id::text
       OR COALESCE(NEW.terms_snapshot->>'workspaceCompensationId', '') <> NEW.id::text
       OR COALESCE(NEW.terms_snapshot->>'compensationVersion', '') <> NEW.version::text
       OR COALESCE(NEW.terms_snapshot->>'compensationType', '') <> NEW.compensation_type
       OR COALESCE(NEW.terms_snapshot->>'currency', '') <> NEW.currency THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'workspace_compensation_terms_snapshot_invalid';
    END IF;

    IF NEW.compensation_type = 'hourly' AND NOT (
      creatorhub_workspace_json_numeric_matches(
        NEW.terms_snapshot, 'hourlyRate', NEW.hourly_rate
      )
      AND creatorhub_workspace_json_numeric_matches(
        NEW.terms_snapshot, 'estimatedHours', NEW.estimated_hours
      )
      AND creatorhub_workspace_json_numeric_matches(
        NEW.terms_snapshot,
        'estimatedAmount',
        ROUND(NEW.hourly_rate * NEW.estimated_hours, 2)
      )
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'workspace_compensation_terms_snapshot_invalid';
    END IF;

    IF NEW.compensation_type = 'fixed' AND NOT (
      creatorhub_workspace_json_numeric_matches(
        NEW.terms_snapshot, 'fixedAmount', NEW.fixed_amount
      )
      AND creatorhub_workspace_json_numeric_matches(
        NEW.terms_snapshot, 'estimatedAmount', NEW.fixed_amount
      )
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'workspace_compensation_terms_snapshot_invalid';
    END IF;

    IF NEW.compensation_type <> 'unpaid' THEN
      SELECT sheet.*
        INTO sheet_record
        FROM split_sheets sheet
       WHERE sheet.id = NEW.split_sheet_id
         AND sheet.project_id = NEW.project_id
         AND sheet.user_id = NEW.project_owner_user_id;
      sheet_found := FOUND;

      SELECT contributor.*
        INTO contributor_record
        FROM split_sheet_contributors contributor
       WHERE contributor.split_sheet_id = NEW.split_sheet_id
         AND contributor.id = NEW.contributor_id;
      contributor_found := FOUND;

      SELECT COUNT(*),
             COALESCE(BOOL_AND(id = NEW.contributor_id), FALSE)
        INTO contributor_count, sole_contributor_matches
        FROM split_sheet_contributors
       WHERE split_sheet_id = NEW.split_sheet_id;

      IF NOT sheet_found
         OR NOT contributor_found
         OR contributor_count <> 1
         OR NOT sole_contributor_matches
         OR contributor_record.user_id IS NOT NULL
         OR contributor_record.signed_at IS NOT NULL
         OR contributor_record.signature_data IS NOT NULL
         OR contributor_record.invitation_sent_at IS NOT NULL
         OR COALESCE(contributor_record.invitation_status, 'not_sent') <> 'not_sent'
         OR contributor_record.contributor_pin IS NOT NULL
         OR contributor_record.contributor_password IS NOT NULL
         OR sheet_record.status <> 'draft'
         OR sheet_record.access_code IS NOT NULL
         OR sheet_record.pin IS NOT NULL
         OR sheet_record.password IS NOT NULL
         OR sheet_record.security_enabled IS TRUE
         OR sheet_record.require_pin_for_signature IS TRUE
         OR sheet_record.require_password_for_signature IS TRUE
         OR NOT creatorhub_split_sheet_is_versioned(sheet_record.metadata)
         OR COALESCE(sheet_record.metadata->>'visibility', '') <> 'private'
         OR COALESCE(sheet_record.metadata->>'source', '')
           <> 'workspace-participant-compensation'
         OR COALESCE(sheet_record.metadata->>'workspaceOrganizationId', '')
           <> NEW.organization_id
         OR COALESCE(sheet_record.metadata->>'workspaceProjectId', '') <> NEW.project_id
         OR COALESCE(sheet_record.metadata->>'workspaceParticipantId', '')
           <> NEW.participant_id::text
         OR COALESCE(sheet_record.metadata->>'workspaceCompensationId', '') <> NEW.id::text
         OR COALESCE(sheet_record.metadata->>'compensationVersion', '') <> NEW.version::text
         OR COALESCE(sheet_record.metadata->>'currency', '') <> NEW.currency
         OR COALESCE(contributor_record.custom_fields->>'workspaceProjectId', '')
           <> NEW.project_id
         OR COALESCE(contributor_record.custom_fields->>'workspaceParticipantId', '')
           <> NEW.participant_id::text
         OR COALESCE(contributor_record.custom_fields->>'workspaceCompensationId', '')
           <> NEW.id::text
         OR COALESCE(contributor_record.custom_fields->>'compensationVersion', '')
           <> NEW.version::text
         OR COALESCE(contributor_record.custom_fields->>'compensationType', '')
           <> NEW.compensation_type
         OR COALESCE(contributor_record.custom_fields->>'currency', '') <> NEW.currency
         OR EXISTS (
           SELECT 1
             FROM split_sheet_contributor_access access_entry
            WHERE access_entry.contributor_id = NEW.contributor_id
         ) THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'workspace_compensation_split_sheet_invalid';
      END IF;

      IF NEW.compensation_type = 'hourly' THEN
        expected_amount := ROUND(NEW.hourly_rate * NEW.estimated_hours, 2);
        IF NOT (
          creatorhub_workspace_json_numeric_matches(
            contributor_record.custom_fields, 'hourlyRate', NEW.hourly_rate
          )
          AND creatorhub_workspace_json_numeric_matches(
            contributor_record.custom_fields, 'estimatedHours', NEW.estimated_hours
          )
          AND creatorhub_workspace_json_numeric_matches(
            contributor_record.custom_fields, 'estimatedAmount', expected_amount
          )
          AND creatorhub_workspace_json_numeric_matches(
            sheet_record.metadata, 'projectAmount', expected_amount
          )
        ) THEN
          RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'workspace_compensation_split_sheet_invalid';
        END IF;
      ELSIF NEW.compensation_type = 'fixed' THEN
        IF NOT (
          creatorhub_workspace_json_numeric_matches(
            contributor_record.custom_fields, 'estimatedAmount', NEW.fixed_amount
          )
          AND creatorhub_workspace_json_numeric_matches(
            sheet_record.metadata, 'projectAmount', NEW.fixed_amount
          )
        ) THEN
          RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'workspace_compensation_split_sheet_invalid';
        END IF;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.project_owner_user_id IS DISTINCT FROM OLD.project_owner_user_id
     OR NEW.participant_id IS DISTINCT FROM OLD.participant_id
     OR NEW.split_sheet_id IS DISTINCT FROM OLD.split_sheet_id
     OR NEW.contributor_id IS DISTINCT FROM OLD.contributor_id
     OR NEW.compensation_type IS DISTINCT FROM OLD.compensation_type
     OR NEW.hourly_rate IS DISTINCT FROM OLD.hourly_rate
     OR NEW.estimated_hours IS DISTINCT FROM OLD.estimated_hours
     OR NEW.day_rate IS DISTINCT FROM OLD.day_rate
     OR NEW.fixed_amount IS DISTINCT FROM OLD.fixed_amount
     OR NEW.share_percentage IS DISTINCT FROM OLD.share_percentage
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.terms_snapshot IS DISTINCT FROM OLD.terms_snapshot
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.request_hash IS DISTINCT FROM OLD.request_hash
     OR NEW.supersedes_link_id IS DISTINCT FROM OLD.supersedes_link_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (OLD.superseded_at IS NOT NULL
         AND NEW.superseded_at IS DISTINCT FROM OLD.superseded_at)
     OR (OLD.archived_at IS NOT NULL
         AND NEW.archived_at IS DISTINCT FROM OLD.archived_at) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'workspace_compensation_terms_locked';
  END IF;

  IF NOT (
    (OLD.status = 'draft' AND NEW.status IN ('draft', 'active', 'archived'))
    OR (OLD.status = 'active' AND NEW.status IN ('active', 'superseded', 'archived'))
    OR (OLD.status IN ('superseded', 'archived') AND NEW.status = OLD.status)
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'workspace_compensation_transition_invalid';
  END IF;

  RETURN NEW;
END;
$$;

-- Once the link exists, the sheet's one external contributor is immutable.
-- This deliberately blocks invitations and signatures too: managed sheets are
-- private calculation/evidence records; acceptance belongs to the hardened
-- participant contract portal rather than the legacy general signer.
CREATE OR REPLACE FUNCTION creatorhub_protect_workspace_compensation_contributor()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  referenced_contributor_id UUID;
  old_sheet_managed BOOLEAN;
  new_sheet_managed BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT EXISTS (
      SELECT 1
        FROM workspace_participant_compensation_links link
       WHERE link.split_sheet_id = NEW.split_sheet_id
    ) INTO new_sheet_managed;
    IF new_sheet_managed THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'workspace_compensation_contributor_set_locked';
    END IF;
    RETURN NEW;
  END IF;

  SELECT link.contributor_id
    INTO referenced_contributor_id
    FROM workspace_participant_compensation_links link
   WHERE link.split_sheet_id = OLD.split_sheet_id
   LIMIT 1;
  old_sheet_managed := FOUND;

  IF TG_OP = 'DELETE' THEN
    IF old_sheet_managed THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'workspace_compensation_contributor_set_locked';
    END IF;
    RETURN OLD;
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM workspace_participant_compensation_links link
     WHERE link.split_sheet_id = NEW.split_sheet_id
  ) INTO new_sheet_managed;

  IF NEW.split_sheet_id IS DISTINCT FROM OLD.split_sheet_id
     AND (old_sheet_managed OR new_sheet_managed) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'workspace_compensation_contributor_set_locked';
  END IF;

  IF old_sheet_managed AND OLD.id IS DISTINCT FROM referenced_contributor_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'workspace_compensation_contributor_set_locked';
  END IF;

  IF old_sheet_managed
     AND (to_jsonb(NEW) - 'updated_at')
         IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'workspace_compensation_contributor_terms_locked';
  END IF;

  RETURN NEW;
END;
$$;

-- The legacy general signer stores bearer credentials in this side table.
-- Managed compensation never creates one: contractual acceptance happens in
-- the participant-document portal. Guard both ends of an UPDATE so a token
-- cannot be moved into or out of the managed namespace.
CREATE OR REPLACE FUNCTION creatorhub_protect_workspace_compensation_access()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  old_contributor_managed BOOLEAN := FALSE;
  new_contributor_managed BOOLEAN := FALSE;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT EXISTS (
      SELECT 1
        FROM workspace_participant_compensation_links link
       WHERE link.contributor_id = OLD.contributor_id
    ) INTO old_contributor_managed;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT EXISTS (
      SELECT 1
        FROM workspace_participant_compensation_links link
       WHERE link.contributor_id = NEW.contributor_id
    ) INTO new_contributor_managed;
  END IF;

  IF old_contributor_managed OR new_contributor_managed THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'workspace_compensation_access_forbidden';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION creatorhub_protect_workspace_compensation_sheet()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  managed_sheet BOOLEAN;
  has_signature_evidence BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
      FROM workspace_participant_compensation_links link
     WHERE link.split_sheet_id = OLD.id
  ) INTO managed_sheet;
  IF NOT managed_sheet THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.track_id IS DISTINCT FROM OLD.track_id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.total_percentage IS DISTINCT FROM OLD.total_percentage
     OR NEW.metadata IS DISTINCT FROM OLD.metadata
     OR NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'workspace_compensation_sheet_terms_locked';
  END IF;

  IF NEW.access_code IS DISTINCT FROM OLD.access_code
     OR NEW.pin IS DISTINCT FROM OLD.pin
     OR NEW.password IS DISTINCT FROM OLD.password
     OR NEW.security_enabled IS DISTINCT FROM OLD.security_enabled
     OR NEW.require_pin_for_signature IS DISTINCT FROM OLD.require_pin_for_signature
     OR NEW.require_password_for_signature IS DISTINCT FROM OLD.require_password_for_signature THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'workspace_compensation_sheet_private';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'draft' AND NEW.status = 'archived' THEN
      RETURN NEW;
    END IF;

    IF OLD.status = 'pending_signatures' AND NEW.status = 'archived' THEN
      SELECT EXISTS (
        SELECT 1
          FROM split_sheet_contributors contributor
         WHERE contributor.split_sheet_id = OLD.id
           AND (
             contributor.signed_at IS NOT NULL
             OR contributor.signature_data IS NOT NULL
           )
      ) INTO has_signature_evidence;
      IF NOT has_signature_evidence THEN
        RETURN NEW;
      END IF;
    END IF;

    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'workspace_compensation_sheet_transition_invalid';
  END IF;

  RETURN NEW;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_workspace_participant_compensation_sheet
  ON workspace_participant_compensation_links (split_sheet_id)
  WHERE split_sheet_id IS NOT NULL;

CREATE OR REPLACE FUNCTION creatorhub_validate_workspace_compensation_namespace()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_metadata JSONB;
  current_project_id VARCHAR(255);
  current_owner_user_id VARCHAR(255);
  scoped_link_count BIGINT;
BEGIN
  SELECT metadata, project_id, user_id
    INTO current_metadata, current_project_id, current_owner_user_id
    FROM split_sheets
   WHERE id = NEW.id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF COALESCE(current_metadata->>'source', '')
       = 'workspace-participant-compensation' THEN
    SELECT COUNT(*)
      INTO scoped_link_count
      FROM workspace_participant_compensation_links link
     WHERE link.split_sheet_id = NEW.id
       AND link.project_id = current_project_id
       AND link.project_owner_user_id = current_owner_user_id
       AND link.project_id = COALESCE(current_metadata->>'workspaceProjectId', '')
       AND link.participant_id::text
         = COALESCE(current_metadata->>'workspaceParticipantId', '')
       AND link.id::text
         = COALESCE(current_metadata->>'workspaceCompensationId', '');
    IF scoped_link_count <> 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'workspace_compensation_namespace_unlinked';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION creatorhub_validate_workspace_participant_terminal_state()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_organization_id VARCHAR(255);
  target_project_id VARCHAR;
  target_participant_id UUID;
  participant_record RECORD;
BEGIN
  IF TG_TABLE_NAME = 'workspace_project_participants' THEN
    target_organization_id := NEW.organization_id;
    target_project_id := NEW.project_id;
    target_participant_id := NEW.id;
  ELSE
    target_organization_id := NEW.organization_id;
    target_project_id := NEW.project_id;
    target_participant_id := NEW.participant_id;
  END IF;

  SELECT participant.workflow_status, participant.archived_at
    INTO participant_record
    FROM workspace_project_participants participant
   WHERE participant.organization_id = target_organization_id
     AND participant.project_id = target_project_id
     AND participant.id = target_participant_id;
  IF NOT FOUND
     OR (
       participant_record.archived_at IS NULL
       AND participant_record.workflow_status NOT IN ('archived', 'cancelled')
     ) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM workspace_participant_compensation_links link
     WHERE link.organization_id = target_organization_id
       AND link.project_id = target_project_id
       AND link.participant_id = target_participant_id
       AND link.status = 'active'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'workspace_participant_terminal_compensation_active';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM workspace_participant_documents document
      JOIN workspace_participant_document_signers signer
        ON signer.organization_id = document.organization_id
       AND signer.project_id = document.project_id
       AND signer.participant_id = document.participant_id
       AND signer.document_id = document.id
     WHERE document.organization_id = target_organization_id
       AND document.project_id = target_project_id
       AND document.participant_id = target_participant_id
       AND document.status IN ('issued', 'viewed')
       AND signer.status = 'pending'
       AND signer.signing_token_hash IS NOT NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'workspace_participant_terminal_document_token_active';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workspace_participant_compensation_lifecycle
  ON workspace_participant_compensation_links;
CREATE TRIGGER trg_workspace_participant_compensation_lifecycle
  BEFORE INSERT OR UPDATE OR DELETE ON workspace_participant_compensation_links
  FOR EACH ROW EXECUTE FUNCTION creatorhub_protect_workspace_participant_compensation();

DROP TRIGGER IF EXISTS trg_workspace_compensation_contributor_terms
  ON split_sheet_contributors;
CREATE TRIGGER trg_workspace_compensation_contributor_terms
  BEFORE INSERT OR UPDATE OR DELETE ON split_sheet_contributors
  FOR EACH ROW EXECUTE FUNCTION creatorhub_protect_workspace_compensation_contributor();

DROP TRIGGER IF EXISTS trg_workspace_compensation_access
  ON split_sheet_contributor_access;
CREATE TRIGGER trg_workspace_compensation_access
  BEFORE INSERT OR UPDATE OR DELETE ON split_sheet_contributor_access
  FOR EACH ROW EXECUTE FUNCTION creatorhub_protect_workspace_compensation_access();

DROP TRIGGER IF EXISTS trg_workspace_compensation_sheet_terms
  ON split_sheets;
CREATE TRIGGER trg_workspace_compensation_sheet_terms
  BEFORE UPDATE ON split_sheets
  FOR EACH ROW EXECUTE FUNCTION creatorhub_protect_workspace_compensation_sheet();

DROP TRIGGER IF EXISTS trg_workspace_participant_terminal_state
  ON workspace_project_participants;
CREATE CONSTRAINT TRIGGER trg_workspace_participant_terminal_state
  AFTER INSERT OR UPDATE ON workspace_project_participants
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION creatorhub_validate_workspace_participant_terminal_state();

DROP TRIGGER IF EXISTS trg_workspace_compensation_terminal_participant
  ON workspace_participant_compensation_links;
CREATE CONSTRAINT TRIGGER trg_workspace_compensation_terminal_participant
  AFTER INSERT OR UPDATE ON workspace_participant_compensation_links
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION creatorhub_validate_workspace_participant_terminal_state();

DROP TRIGGER IF EXISTS trg_workspace_signer_terminal_participant
  ON workspace_participant_document_signers;
CREATE CONSTRAINT TRIGGER trg_workspace_signer_terminal_participant
  AFTER INSERT OR UPDATE ON workspace_participant_document_signers
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION creatorhub_validate_workspace_participant_terminal_state();

DROP TRIGGER IF EXISTS trg_workspace_compensation_namespace
  ON split_sheets;
CREATE CONSTRAINT TRIGGER trg_workspace_compensation_namespace
  AFTER INSERT OR UPDATE ON split_sheets
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION creatorhub_validate_workspace_compensation_namespace();

COMMENT ON COLUMN workspace_participant_compensation_links.idempotency_key IS
  'Caller-generated UUID scoped to one participant. Same key + same request replays safely.';
COMMENT ON COLUMN workspace_participant_compensation_links.request_hash IS
  'SHA-256 of the canonical compensation request; prevents idempotency-key payload reuse.';

COMMIT;
