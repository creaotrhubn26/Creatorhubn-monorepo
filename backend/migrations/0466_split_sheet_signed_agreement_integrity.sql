-- Database-boundary integrity for versioned Workspace split-sheet agreements.
--
-- Once at least one contributor has signed, legal terms and participant rows
-- become immutable. A signature is one-way and must carry the canonical
-- personal-token snapshot. Archiving remains allowed; amendments require a new
-- agreement. Parent-row locking also serializes older/future writer routes with
-- the canonical signing transaction.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION creatorhub_split_sheet_is_versioned(metadata_value JSONB)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN COALESCE(metadata_value->>'agreementVersion', '')
         ~ '^[[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*$'
      THEN (metadata_value->>'agreementVersion')::NUMERIC >= 1
    ELSE FALSE
  END;
$$;

CREATE OR REPLACE FUNCTION creatorhub_enforce_signed_split_sheet_header()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  has_signature BOOLEAN;
  has_existing_signature BOOLEAN;
BEGIN
  IF NOT creatorhub_split_sheet_is_versioned(OLD.metadata) THEN
    IF TG_OP = 'UPDATE'
       AND creatorhub_split_sheet_is_versioned(NEW.metadata) THEN
      SELECT EXISTS (
        SELECT 1
          FROM split_sheet_contributors
         WHERE split_sheet_id = OLD.id
           AND signed_at IS NOT NULL
      ) INTO has_existing_signature;
      IF has_existing_signature THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'personal_signing_required',
          DETAIL = 'All legacy signatures must be cleared before enabling versioned personal signing.';
      END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM split_sheet_contributors
     WHERE split_sheet_id = OLD.id
       AND signed_at IS NOT NULL
  ) INTO has_signature;

  IF NOT has_signature THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'signed_agreement_locked',
      DETAIL = 'Signed versioned agreements must be archived instead of deleted.';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.track_id IS DISTINCT FROM OLD.track_id
     OR NEW.total_percentage IS DISTINCT FROM OLD.total_percentage
     OR NEW.metadata IS DISTINCT FROM OLD.metadata THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'signed_agreement_locked',
      DETAIL = 'Signed agreement terms cannot be changed; create an amendment.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (
       NEW.status = 'archived'
       OR (OLD.status = 'pending_signatures' AND NEW.status = 'completed')
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'signed_agreement_locked',
      DETAIL = 'Only canonical completion or archiving is allowed after signing.';
  END IF;

  IF NEW.completed_at IS DISTINCT FROM OLD.completed_at
     AND NOT (
       OLD.status = 'pending_signatures'
       AND NEW.status = 'completed'
       AND NEW.completed_at IS NOT NULL
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'signed_agreement_locked',
      DETAIL = 'Completion evidence can only be recorded by canonical signing.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION creatorhub_enforce_signed_split_sheet_contributor()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  sheet_id UUID;
  parent_metadata JSONB;
  has_signature BOOLEAN;
BEGIN
  sheet_id := CASE
    WHEN TG_OP = 'INSERT' THEN NEW.split_sheet_id
    ELSE OLD.split_sheet_id
  END;

  -- Contributor identity belongs to one agreement for its entire lifetime.
  -- No active route moves rows, and forbidding it avoids cross-parent lock
  -- ordering and insertion into an already signed target sheet.
  IF TG_OP = 'UPDATE'
     AND NEW.split_sheet_id IS DISTINCT FROM OLD.split_sheet_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'split_sheet_contributor_parent_immutable',
      DETAIL = 'Create a new contributor row instead of moving one between agreements.';
  END IF;

  -- Delivery/access bookkeeping is not a legal term and need not contend for
  -- the parent agreement lock. Returning before the lock also prevents a
  -- harmless invitation-status update (whose child row is already locked by
  -- PostgreSQL before this BEFORE ROW trigger runs) from deadlocking a signer.
  IF TG_OP = 'UPDATE'
     AND (
       to_jsonb(NEW) - ARRAY[
         'invitation_sent_at', 'invitation_status', 'updated_at',
         'contributor_pin', 'contributor_password'
       ]
     ) = (
       to_jsonb(OLD) - ARRAY[
         'invitation_sent_at', 'invitation_status', 'updated_at',
         'contributor_pin', 'contributor_password'
       ]
     ) THEN
    RETURN NEW;
  END IF;

  -- PostgreSQL locks an UPDATE/DELETE target row before firing a BEFORE ROW
  -- trigger. NOWAIT therefore fails an unknown child-first writer closed
  -- instead of allowing a header->child signer deadlock. Canonical writers
  -- explicitly lock this parent first, so their re-entrant lock succeeds.
  SELECT metadata
    INTO parent_metadata
    FROM split_sheets
   WHERE id = sheet_id
   FOR UPDATE NOWAIT;

  IF NOT FOUND OR NOT creatorhub_split_sheet_is_versioned(parent_metadata) THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM split_sheet_contributors
     WHERE split_sheet_id = sheet_id
       AND signed_at IS NOT NULL
  ) INTO has_signature;

  IF TG_OP = 'INSERT' THEN
    IF has_signature THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'signed_agreement_locked',
        DETAIL = 'Participants cannot be added after the first signature.';
    END IF;
    IF NEW.signed_at IS NOT NULL OR NEW.signature_data IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'personal_signing_required',
        DETAIL = 'Versioned contributors must be created unsigned and signed through a personal token.';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF has_signature THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'signed_agreement_locked',
        DETAIL = 'Participants and signature evidence cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.signed_at IS NOT NULL
     AND (
       NEW.signed_at IS DISTINCT FROM OLD.signed_at
       OR NEW.signature_data IS DISTINCT FROM OLD.signature_data
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'signed_agreement_locked',
      DETAIL = 'Signature evidence is append-only and cannot be cleared or overwritten.';
  END IF;

  IF OLD.signed_at IS NULL AND NEW.signed_at IS NOT NULL THEN
    IF NEW.signature_data IS NULL
       OR NOT (
         NEW.signature_data @> '{"signedVia":"participant-token","consent":true}'::JSONB
       )
       OR jsonb_typeof(NEW.signature_data->'agreementSnapshot') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'personal_signing_required',
        DETAIL = 'Versioned agreements require canonical personal-token signing.';
    END IF;
  END IF;

  IF (has_signature OR OLD.signed_at IS NOT NULL OR NEW.signed_at IS NOT NULL)
     AND (
       NEW.split_sheet_id IS DISTINCT FROM OLD.split_sheet_id
       OR NEW.name IS DISTINCT FROM OLD.name
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.percentage IS DISTINCT FROM OLD.percentage
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.order_index IS DISTINCT FROM OLD.order_index
       OR NEW.notes IS DISTINCT FROM OLD.notes
       OR NEW.custom_fields IS DISTINCT FROM OLD.custom_fields
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'signed_agreement_locked',
      DETAIL = 'Signed participant terms cannot be changed; create an amendment.';
  END IF;

  RETURN NEW;
END;
$$;

-- The legacy percentage trigger ran after every contributor UPDATE, including
-- invitation bookkeeping. That turned a child-only administrative update back
-- into a child->parent lock and could deadlock a canonical parent-first signer.
-- Recalculate only when membership or percentage can actually affect the sum.
CREATE OR REPLACE FUNCTION creatorhub_refresh_split_sheet_total_percentage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  affected_sheet_id UUID;
  total_percentage_value NUMERIC(5, 2);
BEGIN
  affected_sheet_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.split_sheet_id
    ELSE NEW.split_sheet_id
  END;

  SELECT COALESCE(SUM(percentage), 0)
    INTO total_percentage_value
    FROM split_sheet_contributors
   WHERE split_sheet_id = affected_sheet_id;

  IF total_percentage_value > 100.01 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'split_sheet_percentage_exceeds_100';
  END IF;

  UPDATE split_sheets
     SET total_percentage = total_percentage_value
   WHERE id = affected_sheet_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_split_sheet_total_percentage
  ON split_sheet_contributors;
CREATE TRIGGER update_split_sheet_total_percentage
  AFTER INSERT OR DELETE OR UPDATE OF percentage, split_sheet_id
  ON split_sheet_contributors
  FOR EACH ROW
  EXECUTE FUNCTION creatorhub_refresh_split_sheet_total_percentage();

DROP TRIGGER IF EXISTS creatorhub_signed_split_sheet_header_guard
  ON split_sheets;
CREATE TRIGGER creatorhub_signed_split_sheet_header_guard
  BEFORE UPDATE OR DELETE ON split_sheets
  FOR EACH ROW
  EXECUTE FUNCTION creatorhub_enforce_signed_split_sheet_header();

DROP TRIGGER IF EXISTS creatorhub_signed_split_sheet_contributor_guard
  ON split_sheet_contributors;
CREATE TRIGGER creatorhub_signed_split_sheet_contributor_guard
  BEFORE INSERT OR UPDATE OR DELETE ON split_sheet_contributors
  FOR EACH ROW
  EXECUTE FUNCTION creatorhub_enforce_signed_split_sheet_contributor();

COMMIT;
