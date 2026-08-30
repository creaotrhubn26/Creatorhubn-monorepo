-- Standalone CreatorHub Workspace/Enterprise participants.
-- External participants never receive a user account, team membership, seat,
-- or Workspace access from any table in this migration.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Composite keys let downstream legal/payment records prove both the canonical
-- Workspace project and the split-sheet owner rather than trusting IDs supplied
-- by an API caller.
CREATE UNIQUE INDEX IF NOT EXISTS ux_projects_id_user_id
  ON public.projects (id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_split_sheets_id_project_owner
  ON split_sheets (id, project_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_split_sheet_contributors_sheet_and_id
  ON split_sheet_contributors (split_sheet_id, id);

-- ON DELETE RESTRICT is intentional legal retention: a bound canonical project
-- must be soft-archived rather than deleted after participant records exist.
CREATE TABLE IF NOT EXISTS workspace_project_enterprise_scopes (
  project_id VARCHAR PRIMARY KEY,
  project_owner_user_id VARCHAR(255) NOT NULL,
  organization_id VARCHAR(255) NOT NULL,
  bound_by VARCHAR(255) NOT NULL,
  bound_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workspace_project_enterprise_scopes_project_fk
    FOREIGN KEY (project_id, project_owner_user_id)
    REFERENCES public.projects (id, user_id)
    ON DELETE RESTRICT,
  UNIQUE (organization_id, project_id),
  UNIQUE (organization_id, project_id, project_owner_user_id)
);

CREATE TABLE IF NOT EXISTS workspace_project_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL,
  project_id VARCHAR NOT NULL,
  external_reference VARCHAR(120),
  display_name VARCHAR(255) NOT NULL,
  email VARCHAR(320),
  phone VARCHAR(50),
  participant_type VARCHAR(30) NOT NULL DEFAULT 'extra'
    CHECK (participant_type IN ('extra', 'model', 'featured', 'interviewee', 'other')),
  role_label VARCHAR(255),
  engagement_type VARCHAR(30) NOT NULL DEFAULT 'undecided'
    CHECK (engagement_type IN ('undecided', 'employee', 'contractor', 'agency', 'volunteer')),
  workflow_status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (workflow_status IN ('draft', 'invited', 'confirmed', 'completed', 'cancelled', 'archived')),
  is_minor BOOLEAN NOT NULL DEFAULT FALSE,
  guardian_status VARCHAR(30) NOT NULL DEFAULT 'not_required'
    CHECK (guardian_status IN ('not_required', 'required', 'pending', 'approved', 'rejected')),
  work_permit_status VARCHAR(30) NOT NULL DEFAULT 'not_required'
    CHECK (work_permit_status IN ('not_required', 'required', 'pending', 'approved', 'rejected')),
  requires_contract BOOLEAN NOT NULL DEFAULT TRUE,
  requires_media_consent BOOLEAN NOT NULL DEFAULT TRUE,
  requires_compensation BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255) NOT NULL,
  archived_by VARCHAR(255),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workspace_project_participants_scope_fk
    FOREIGN KEY (organization_id, project_id)
    REFERENCES workspace_project_enterprise_scopes (organization_id, project_id)
    ON DELETE RESTRICT,
  CONSTRAINT workspace_project_participants_name_not_blank
    CHECK (BTRIM(display_name) <> ''),
  CONSTRAINT workspace_project_participants_external_reference_not_blank
    CHECK (external_reference IS NULL OR BTRIM(external_reference) <> ''),
  CONSTRAINT workspace_project_participants_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT workspace_project_participants_archive_consistency
    CHECK (
      (workflow_status = 'archived' AND archived_at IS NOT NULL)
      OR (workflow_status <> 'archived' AND archived_at IS NULL)
    ),
  UNIQUE (organization_id, project_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_workspace_project_participants_external_reference
  ON workspace_project_participants (organization_id, project_id, external_reference)
  WHERE external_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_project_participants_project_active
  ON workspace_project_participants (organization_id, project_id, created_at DESC)
  WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_project_participants_project_status
  ON workspace_project_participants (organization_id, project_id, workflow_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_project_participants_project_type
  ON workspace_project_participants (organization_id, project_id, participant_type, created_at DESC)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS workspace_participant_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL,
  project_id VARCHAR NOT NULL,
  participant_id UUID NOT NULL,
  document_type VARCHAR(40) NOT NULL
    CHECK (document_type IN ('contract', 'media_consent', 'guardian_consent', 'work_permit', 'nda', 'other')),
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'viewed', 'signed', 'declined', 'withdrawn', 'expired', 'superseded')),
  version INTEGER NOT NULL CHECK (version > 0),
  title VARCHAR(255) NOT NULL,
  terms_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash CHAR(64),
  supersedes_document_id UUID,
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workspace_participant_documents_terms_object
    CHECK (jsonb_typeof(terms_snapshot) = 'object'),
  CONSTRAINT workspace_participant_documents_hash_format
    CHECK (content_hash IS NULL OR content_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT workspace_participant_documents_issued_snapshot
    CHECK (status = 'draft' OR (content_hash IS NOT NULL AND issued_at IS NOT NULL)),
  CONSTRAINT workspace_participant_documents_draft_timestamps
    CHECK (status <> 'draft' OR (issued_at IS NULL AND signed_at IS NULL AND withdrawn_at IS NULL)),
  CONSTRAINT workspace_participant_documents_signed_evidence
    CHECK (status NOT IN ('signed', 'withdrawn') OR signed_at IS NOT NULL),
  CONSTRAINT workspace_participant_documents_withdrawal_evidence
    CHECK (status <> 'withdrawn' OR withdrawn_at IS NOT NULL),
  CONSTRAINT workspace_participant_documents_signed_at_consistency
    CHECK (signed_at IS NULL OR status IN ('signed', 'withdrawn', 'superseded')),
  CONSTRAINT workspace_participant_documents_withdrawn_at_consistency
    CHECK (withdrawn_at IS NULL OR status = 'withdrawn'),
  CONSTRAINT workspace_participant_documents_participant_fk
    FOREIGN KEY (organization_id, project_id, participant_id)
    REFERENCES workspace_project_participants (organization_id, project_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT workspace_participant_documents_supersedes_fk
    FOREIGN KEY (organization_id, project_id, participant_id, document_type, supersedes_document_id)
    REFERENCES workspace_participant_documents (organization_id, project_id, participant_id, document_type, id)
    ON DELETE RESTRICT,
  CONSTRAINT workspace_participant_documents_not_self_superseding
    CHECK (supersedes_document_id IS NULL OR supersedes_document_id <> id),
  UNIQUE (organization_id, project_id, id),
  UNIQUE (organization_id, project_id, participant_id, id),
  UNIQUE (organization_id, project_id, participant_id, document_type, id),
  UNIQUE (participant_id, document_type, version)
);

CREATE INDEX IF NOT EXISTS idx_workspace_participant_documents_participant
  ON workspace_participant_documents (organization_id, project_id, participant_id, document_type, version DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_participant_documents_status
  ON workspace_participant_documents (organization_id, project_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS workspace_participant_document_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL,
  project_id VARCHAR NOT NULL,
  participant_id UUID NOT NULL,
  document_id UUID NOT NULL,
  signer_role VARCHAR(30) NOT NULL
    CHECK (signer_role IN ('participant', 'guardian', 'producer', 'witness')),
  signer_name VARCHAR(255) NOT NULL,
  signer_email VARCHAR(320),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'signed', 'declined')),
  signing_token_hash CHAR(64),
  token_issued_at TIMESTAMPTZ,
  token_expires_at TIMESTAMPTZ,
  token_used_at TIMESTAMPTZ,
  token_revoked_at TIMESTAMPTZ,
  signature_evidence JSONB,
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workspace_participant_document_signers_document_fk
    FOREIGN KEY (organization_id, project_id, participant_id, document_id)
    REFERENCES workspace_participant_documents (organization_id, project_id, participant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT workspace_participant_document_signers_token_hash_format
    CHECK (signing_token_hash IS NULL OR signing_token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT workspace_participant_document_signers_evidence_object
    CHECK (signature_evidence IS NULL OR jsonb_typeof(signature_evidence) = 'object'),
  CONSTRAINT workspace_participant_document_signers_token_lifecycle
    CHECK (
      (signing_token_hash IS NULL OR (
        status = 'pending' AND token_issued_at IS NOT NULL AND token_expires_at IS NOT NULL
        AND token_used_at IS NULL AND token_revoked_at IS NULL
      ))
      AND (token_issued_at IS NOT NULL OR (
        signing_token_hash IS NULL AND token_expires_at IS NULL
        AND token_used_at IS NULL AND token_revoked_at IS NULL
      ))
      AND (token_issued_at IS NULL OR (token_expires_at IS NOT NULL AND token_expires_at > token_issued_at))
      AND NOT (token_used_at IS NOT NULL AND token_revoked_at IS NOT NULL)
      AND (token_used_at IS NULL OR (token_issued_at IS NOT NULL AND signing_token_hash IS NULL))
      AND (token_revoked_at IS NULL OR (
        status = 'pending' AND token_issued_at IS NOT NULL AND signing_token_hash IS NULL
      ))
    ),
  CONSTRAINT workspace_participant_document_signers_active_token_hash
    CHECK (
      status <> 'pending' OR token_issued_at IS NULL
      OR token_revoked_at IS NOT NULL OR signing_token_hash IS NOT NULL
    ),
  CONSTRAINT workspace_participant_document_signers_status_evidence
    CHECK (
      (status = 'pending' AND token_used_at IS NULL AND signed_at IS NULL AND declined_at IS NULL)
      OR (status = 'signed' AND signing_token_hash IS NULL AND token_used_at IS NOT NULL AND signed_at IS NOT NULL
          AND declined_at IS NULL AND signature_evidence IS NOT NULL)
      OR (status = 'declined' AND signing_token_hash IS NULL AND token_used_at IS NOT NULL AND declined_at IS NOT NULL
          AND signed_at IS NULL)
    ),
  UNIQUE (organization_id, project_id, participant_id, document_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_workspace_participant_signers_token_hash
  ON workspace_participant_document_signers (signing_token_hash)
  WHERE signing_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_participant_signers_document
  ON workspace_participant_document_signers (organization_id, project_id, document_id, status);

CREATE TABLE IF NOT EXISTS workspace_participant_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL,
  project_id VARCHAR NOT NULL,
  participant_id UUID NOT NULL,
  document_id UUID,
  signer_id UUID,
  event_type VARCHAR(80) NOT NULL,
  actor_type VARCHAR(20) NOT NULL DEFAULT 'user'
    CHECK (actor_type IN ('user', 'participant', 'system')),
  actor_user_id VARCHAR(255),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workspace_participant_events_participant_fk
    FOREIGN KEY (organization_id, project_id, participant_id)
    REFERENCES workspace_project_participants (organization_id, project_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT workspace_participant_events_document_fk
    FOREIGN KEY (organization_id, project_id, participant_id, document_id)
    REFERENCES workspace_participant_documents (organization_id, project_id, participant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT workspace_participant_events_signer_fk
    FOREIGN KEY (organization_id, project_id, participant_id, document_id, signer_id)
    REFERENCES workspace_participant_document_signers (organization_id, project_id, participant_id, document_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT workspace_participant_events_signer_requires_document
    CHECK (signer_id IS NULL OR document_id IS NOT NULL),
  CONSTRAINT workspace_participant_events_payload_object
    CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_workspace_participant_events_participant
  ON workspace_participant_events (organization_id, project_id, participant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_participant_events_document
  ON workspace_participant_events (document_id, occurred_at DESC)
  WHERE document_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS workspace_participant_compensation_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL,
  project_id VARCHAR NOT NULL,
  project_owner_user_id VARCHAR(255) NOT NULL,
  participant_id UUID NOT NULL,
  split_sheet_id UUID,
  contributor_id UUID,
  compensation_type VARCHAR(20) NOT NULL
    CHECK (compensation_type IN ('hourly', 'day_rate', 'fixed', 'share', 'unpaid')),
  hourly_rate NUMERIC(14, 2),
  day_rate NUMERIC(14, 2),
  fixed_amount NUMERIC(14, 2),
  share_percentage NUMERIC(7, 4),
  currency CHAR(3) NOT NULL DEFAULT 'NOK',
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'superseded', 'archived')),
  terms_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workspace_participant_compensation_participant_fk
    FOREIGN KEY (organization_id, project_id, participant_id)
    REFERENCES workspace_project_participants (organization_id, project_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT workspace_participant_compensation_scope_owner_fk
    FOREIGN KEY (organization_id, project_id, project_owner_user_id)
    REFERENCES workspace_project_enterprise_scopes (organization_id, project_id, project_owner_user_id)
    ON DELETE RESTRICT,
  CONSTRAINT workspace_participant_compensation_sheet_project_owner_fk
    FOREIGN KEY (split_sheet_id, project_id, project_owner_user_id)
    REFERENCES split_sheets (id, project_id, user_id)
    ON DELETE RESTRICT,
  CONSTRAINT workspace_participant_compensation_contributor_fk
    FOREIGN KEY (split_sheet_id, contributor_id)
    REFERENCES split_sheet_contributors (split_sheet_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT workspace_participant_compensation_link_pair
    CHECK ((split_sheet_id IS NULL) = (contributor_id IS NULL)),
  CONSTRAINT workspace_participant_compensation_paid_link
    CHECK (
      (compensation_type = 'unpaid' AND split_sheet_id IS NULL)
      OR (compensation_type <> 'unpaid' AND split_sheet_id IS NOT NULL)
    ),
  CONSTRAINT workspace_participant_compensation_exact_terms
    CHECK (
      (compensation_type = 'hourly' AND hourly_rate > 0
        AND day_rate IS NULL AND fixed_amount IS NULL AND share_percentage IS NULL)
      OR (compensation_type = 'day_rate' AND day_rate > 0
        AND hourly_rate IS NULL AND fixed_amount IS NULL AND share_percentage IS NULL)
      OR (compensation_type = 'fixed' AND fixed_amount > 0
        AND hourly_rate IS NULL AND day_rate IS NULL AND share_percentage IS NULL)
      OR (compensation_type = 'share' AND share_percentage > 0 AND share_percentage <= 100
        AND hourly_rate IS NULL AND day_rate IS NULL AND fixed_amount IS NULL)
      OR (compensation_type = 'unpaid' AND hourly_rate IS NULL AND day_rate IS NULL
        AND fixed_amount IS NULL AND share_percentage IS NULL)
    ),
  CONSTRAINT workspace_participant_compensation_currency
    CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT workspace_participant_compensation_terms_object
    CHECK (jsonb_typeof(terms_snapshot) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_workspace_participant_compensation_active
  ON workspace_participant_compensation_links (organization_id, project_id, participant_id)
  WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS ux_workspace_participant_compensation_contributor
  ON workspace_participant_compensation_links (contributor_id)
  WHERE contributor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_participant_compensation_participant
  ON workspace_participant_compensation_links (organization_id, project_id, participant_id, updated_at DESC);

-- The feature row is the configurable fallback used by the Enterprise UI.
-- A newly provisioned organization starts fail-closed through the settings
-- admin-only list; when an admin later chooses "all", the row-level fallback
-- is already coherent instead of silently re-locking the feature.
WITH inserted_feature_policies AS (
  INSERT INTO enterprise_feature_permissions
    (organization_id, feature_id, permission_level, allowed_roles, created_by)
  SELECT DISTINCT organization_id,
         'workspace-project-participants',
         'all',
         ARRAY['admin', 'member', 'viewer']::TEXT[],
         'migration-0467'
    FROM enterprise_team_members
   WHERE status = 'active'
     AND org_kind = 'enterprise'
  ON CONFLICT (organization_id, feature_id) DO NOTHING
  RETURNING organization_id
)
INSERT INTO enterprise_organization_settings
  (organization_id, admin_only_features)
SELECT organization_id, ARRAY['workspace-project-participants']::TEXT[]
  FROM inserted_feature_policies
ON CONFLICT (organization_id) DO UPDATE
  SET admin_only_features = CASE
        WHEN 'workspace-project-participants' = ANY(
          COALESCE(enterprise_organization_settings.admin_only_features, ARRAY[]::TEXT[])
        ) THEN COALESCE(enterprise_organization_settings.admin_only_features, ARRAY[]::TEXT[])
        ELSE array_append(
          COALESCE(enterprise_organization_settings.admin_only_features, ARRAY[]::TEXT[]),
          'workspace-project-participants'
        )
      END,
      updated_at = NOW();

CREATE OR REPLACE FUNCTION creatorhub_provision_workspace_participants_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'active' AND NEW.org_kind = 'enterprise' THEN
    WITH inserted_feature_policy AS (
      INSERT INTO enterprise_feature_permissions
        (organization_id, feature_id, permission_level, allowed_roles, created_by)
      VALUES (
        NEW.organization_id,
        'workspace-project-participants',
        'all',
        ARRAY['admin', 'member', 'viewer']::TEXT[],
        'enterprise-membership-provisioner'
      )
      ON CONFLICT (organization_id, feature_id) DO NOTHING
      RETURNING organization_id
    )
    INSERT INTO enterprise_organization_settings
      (organization_id, admin_only_features)
    SELECT organization_id, ARRAY['workspace-project-participants']::TEXT[]
      FROM inserted_feature_policy
    ON CONFLICT (organization_id) DO UPDATE
      SET admin_only_features = CASE
            WHEN 'workspace-project-participants' = ANY(
              COALESCE(enterprise_organization_settings.admin_only_features, ARRAY[]::TEXT[])
            ) THEN COALESCE(enterprise_organization_settings.admin_only_features, ARRAY[]::TEXT[])
            ELSE array_append(
              COALESCE(enterprise_organization_settings.admin_only_features, ARRAY[]::TEXT[]),
              'workspace-project-participants'
            )
          END,
          updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_provision_workspace_participants_policy ON enterprise_team_members;
CREATE TRIGGER trg_provision_workspace_participants_policy
  AFTER INSERT OR UPDATE OF status, org_kind ON enterprise_team_members
  FOR EACH ROW EXECUTE FUNCTION creatorhub_provision_workspace_participants_policy();

CREATE OR REPLACE FUNCTION creatorhub_workspace_participant_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION creatorhub_protect_workspace_enterprise_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '23514',
    MESSAGE = 'workspace_enterprise_scope_immutable';
END;
$$;

CREATE OR REPLACE FUNCTION creatorhub_prevent_workspace_participant_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '23514',
    MESSAGE = 'workspace_participant_archive_required',
    DETAIL = 'Workspace participants must be archived instead of deleted.';
END;
$$;

CREATE OR REPLACE FUNCTION creatorhub_protect_workspace_legal_document()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_document_workflow_required';
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
       OR (
         NEW.signed_at IS DISTINCT FROM OLD.signed_at
         AND NOT (
           OLD.status IN ('issued', 'viewed')
           AND NEW.status = 'signed'
           AND OLD.signed_at IS NULL
           AND NEW.signed_at IS NOT NULL
         )
       )
       OR (
         NEW.withdrawn_at IS DISTINCT FROM OLD.withdrawn_at
         AND NOT (
           OLD.status = 'signed'
           AND OLD.document_type IN ('media_consent', 'guardian_consent')
           AND NEW.status = 'withdrawn'
           AND OLD.withdrawn_at IS NULL
           AND NEW.withdrawn_at IS NOT NULL
         )
       )
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_legal_record_locked';
  END IF;

  IF NOT (
    (OLD.status = 'draft' AND NEW.status IN ('draft', 'issued'))
    OR (OLD.status = 'issued' AND NEW.status IN ('issued', 'viewed', 'signed', 'declined', 'expired', 'superseded'))
    OR (OLD.status = 'viewed' AND NEW.status IN ('viewed', 'signed', 'declined', 'expired', 'superseded'))
    OR (OLD.status = 'signed' AND NEW.status IN ('signed', 'superseded'))
    OR (OLD.status = 'signed'
        AND OLD.document_type IN ('media_consent', 'guardian_consent')
        AND NEW.status = 'withdrawn')
    OR (OLD.status IN ('declined', 'withdrawn', 'expired', 'superseded') AND NEW.status = OLD.status)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_document_transition_invalid';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION creatorhub_protect_workspace_signature_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_signer_workflow_required';
  END IF;
  IF TG_OP = 'DELETE' AND (
    OLD.status IN ('signed', 'declined')
    OR OLD.token_issued_at IS NOT NULL
    OR OLD.token_revoked_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_signature_locked';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('signed', 'declined') THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_signature_locked';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.token_revoked_at IS NOT NULL
     AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_signing_token_revoked';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION creatorhub_workspace_events_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workspace_event_append_only';
END;
$$;

DROP TRIGGER IF EXISTS trg_workspace_project_enterprise_scopes_immutable ON workspace_project_enterprise_scopes;
CREATE TRIGGER trg_workspace_project_enterprise_scopes_immutable
  BEFORE UPDATE OR DELETE ON workspace_project_enterprise_scopes
  FOR EACH ROW EXECUTE FUNCTION creatorhub_protect_workspace_enterprise_scope();

DROP TRIGGER IF EXISTS trg_workspace_project_participants_touch ON workspace_project_participants;
CREATE TRIGGER trg_workspace_project_participants_touch
  BEFORE UPDATE ON workspace_project_participants
  FOR EACH ROW EXECUTE FUNCTION creatorhub_workspace_participant_touch();

DROP TRIGGER IF EXISTS trg_workspace_project_participants_no_delete ON workspace_project_participants;
CREATE TRIGGER trg_workspace_project_participants_no_delete
  BEFORE DELETE ON workspace_project_participants
  FOR EACH ROW EXECUTE FUNCTION creatorhub_prevent_workspace_participant_delete();

DROP TRIGGER IF EXISTS trg_workspace_participant_documents_touch ON workspace_participant_documents;
CREATE TRIGGER trg_workspace_participant_documents_touch
  BEFORE UPDATE ON workspace_participant_documents
  FOR EACH ROW EXECUTE FUNCTION creatorhub_workspace_participant_touch();

DROP TRIGGER IF EXISTS trg_workspace_participant_documents_legal_lock ON workspace_participant_documents;
CREATE TRIGGER trg_workspace_participant_documents_legal_lock
  BEFORE INSERT OR UPDATE OR DELETE ON workspace_participant_documents
  FOR EACH ROW EXECUTE FUNCTION creatorhub_protect_workspace_legal_document();

DROP TRIGGER IF EXISTS trg_workspace_participant_signers_touch ON workspace_participant_document_signers;
CREATE TRIGGER trg_workspace_participant_signers_touch
  BEFORE UPDATE ON workspace_participant_document_signers
  FOR EACH ROW EXECUTE FUNCTION creatorhub_workspace_participant_touch();

DROP TRIGGER IF EXISTS trg_workspace_participant_signatures_lock ON workspace_participant_document_signers;
CREATE TRIGGER trg_workspace_participant_signatures_lock
  BEFORE INSERT OR UPDATE OR DELETE ON workspace_participant_document_signers
  FOR EACH ROW EXECUTE FUNCTION creatorhub_protect_workspace_signature_evidence();

DROP TRIGGER IF EXISTS trg_workspace_participant_compensation_touch ON workspace_participant_compensation_links;
CREATE TRIGGER trg_workspace_participant_compensation_touch
  BEFORE UPDATE ON workspace_participant_compensation_links
  FOR EACH ROW EXECUTE FUNCTION creatorhub_workspace_participant_touch();

DROP TRIGGER IF EXISTS trg_workspace_participant_events_append_only ON workspace_participant_events;
CREATE TRIGGER trg_workspace_participant_events_append_only
  BEFORE UPDATE OR DELETE ON workspace_participant_events
  FOR EACH ROW EXECUTE FUNCTION creatorhub_workspace_events_append_only();

COMMENT ON TABLE workspace_project_enterprise_scopes IS
  'Immutable binding between one public.projects Workspace and one CreatorHub Enterprise organization.';
COMMENT ON TABLE workspace_project_participants IS
  'External people engaged in a Workspace project; never grants an account, seat, or project access.';
COMMENT ON COLUMN workspace_project_participants.organization_id IS
  'Enterprise tenant resolved and bound server-side from active memberships.';
COMMENT ON COLUMN workspace_participant_document_signers.signing_token_hash IS
  'SHA-256 hash only. Raw portal/signing tokens must never be persisted.';

COMMIT;
