-- 0543_leadgrid_customer_onboarding_delivery_scope.sql
--
-- Customer onboarding, client-portal focus requests and delivery playbooks
-- are all children of one explicitly selected Leadgrid customer project.
-- Historic implementations trusted organization_id from the request, created
-- a second casting project, and exposed status rows by globally supplied IDs.
-- This migration gives every persisted step an enforceable project tuple and
-- adds stable retry keys for the two write entry points.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Auto-onboarding continued to create casting_projects for a period after
-- Leadgrid received its own project table. Preserve those legitimate historic
-- customer projects so their portal/audit records remain resolvable, while all
-- new writes use an already selected leadgrid_projects row.
INSERT INTO leadgrid_projects (
  id, organization_id, name, description, status, project_type,
  settings, metadata, created_by, created_at, updated_at
)
SELECT DISTINCT
       legacy.id,
       legacy.organization_id,
       legacy.name,
       legacy.description,
       legacy.status,
       COALESCE(legacy.project_type, 'kundeprosjekt'),
       COALESCE(legacy.settings, '{}'::jsonb),
       COALESCE(legacy.metadata, '{}'::jsonb)
         || jsonb_build_object('leadgrid_source', 'legacy_auto_onboard'),
       legacy.created_by,
       legacy.created_at,
       legacy.updated_at
  FROM casting_projects legacy
 WHERE legacy.organization_id IS NOT NULL
   AND legacy.project_type = 'kundeprosjekt'
   AND (
     EXISTS (
       SELECT 1 FROM customer_auto_onboards audit
        WHERE audit.project_id = legacy.id
     )
     OR EXISTS (
       SELECT 1 FROM client_portal_tokens token
        WHERE token.project_id = legacy.id
     )
     OR EXISTS (
       SELECT 1 FROM client_focus_requests focus
        WHERE focus.project_id = legacy.id
     )
     OR EXISTS (
       SELECT 1 FROM project_deliverables deliverable
        WHERE deliverable.project_id = legacy.id
     )
   )
ON CONFLICT (id) DO NOTHING;

ALTER TABLE customer_auto_onboards
  ADD COLUMN IF NOT EXISTS preset_id UUID,
  ADD COLUMN IF NOT EXISTS idempotency_key UUID,
  ADD COLUMN IF NOT EXISTS request_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS quota_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS portal_token_id UUID,
  ADD COLUMN IF NOT EXISTS invitation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS invitation_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE client_portal_tokens
  ADD COLUMN IF NOT EXISTS auto_onboard_id UUID;

ALTER TABLE client_focus_requests
  ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ;

-- The public portal has a real “withdraw request” action. Keep that state
-- distinct from an advisor declining the work.
ALTER TABLE client_focus_requests
  DROP CONSTRAINT IF EXISTS client_focus_requests_status_check;
ALTER TABLE client_focus_requests
  ADD CONSTRAINT client_focus_requests_status_check
  CHECK (
    status IN (
      'pending', 'acknowledged', 'in_progress',
      'completed', 'declined', 'withdrawn'
    )
  );

ALTER TABLE project_deliverables
  ADD COLUMN IF NOT EXISTS customer_id TEXT;

-- Recover authoritative tuples from the canonical lead/project rows. Never
-- guess from a user's first organization.
UPDATE customer_auto_onboards audit
   SET organization_id = lead.organization_id,
       project_id = lead.project_id,
       updated_at = NOW()
  FROM crm_customers lead
 WHERE audit.customer_id IS NOT NULL
   AND lead.id::text = audit.customer_id::text
   AND lead.organization_id IS NOT NULL
   AND lead.project_id IS NOT NULL
   AND (
     audit.organization_id IS DISTINCT FROM lead.organization_id
     OR audit.project_id IS DISTINCT FROM lead.project_id
   );

UPDATE customer_auto_onboards audit
   SET organization_id = project.organization_id,
       updated_at = NOW()
  FROM leadgrid_projects project
 WHERE audit.project_id = project.id
   AND project.organization_id IS NOT NULL
   AND audit.organization_id IS DISTINCT FROM project.organization_id;

UPDATE client_portal_tokens token
   SET organization_id = project.organization_id
  FROM leadgrid_projects project
 WHERE token.project_id = project.id
   AND project.organization_id IS NOT NULL
   AND token.organization_id IS DISTINCT FROM project.organization_id;

UPDATE client_focus_requests focus
   SET organization_id = project.organization_id
  FROM leadgrid_projects project
 WHERE focus.project_id = project.id
   AND project.organization_id IS NOT NULL
   AND focus.organization_id IS DISTINCT FROM project.organization_id;

UPDATE project_deliverables deliverable
   SET organization_id = project.organization_id
  FROM leadgrid_projects project
 WHERE deliverable.project_id = project.id
   AND project.organization_id IS NOT NULL
   AND deliverable.organization_id IS DISTINCT FROM project.organization_id;

UPDATE project_deliverables deliverable
   SET customer_id = focus.customer_id
  FROM client_focus_requests focus
 WHERE deliverable.focus_request_id = focus.id
   AND deliverable.organization_id = focus.organization_id
   AND deliverable.project_id = focus.project_id
   AND deliverable.customer_id IS NULL;

UPDATE client_portal_tokens token
   SET auto_onboard_id = audit.id
  FROM customer_auto_onboards audit
 WHERE token.auto_onboard_id IS NULL
   AND audit.client_token = token.token
   AND audit.organization_id = token.organization_id
   AND audit.project_id = token.project_id;

UPDATE customer_auto_onboards audit
   SET portal_token_id = token.id,
       invitation_status = CASE
         WHEN audit.finished_at IS NOT NULL THEN 'sent'
         ELSE audit.invitation_status
       END,
       invitation_sent_at = CASE
         WHEN audit.finished_at IS NOT NULL
           THEN COALESCE(audit.invitation_sent_at, audit.finished_at)
         ELSE audit.invitation_sent_at
       END,
       updated_at = NOW()
  FROM client_portal_tokens token
 WHERE audit.portal_token_id IS NULL
   AND audit.client_token = token.token
   AND audit.organization_id = token.organization_id
   AND audit.project_id = token.project_id;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'customer_auto_onboards'::regclass
       AND conname = 'customer_auto_onboards_retry_shape_check'
  ) THEN
    ALTER TABLE customer_auto_onboards
      ADD CONSTRAINT customer_auto_onboards_retry_shape_check
      CHECK (
        (idempotency_key IS NULL AND request_hash IS NULL)
        OR (
          idempotency_key IS NOT NULL
          AND request_hash ~ '^[0-9a-f]{64}$'
        )
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'customer_auto_onboards'::regclass
       AND conname = 'customer_auto_onboards_invitation_status_check'
  ) THEN
    ALTER TABLE customer_auto_onboards
      ADD CONSTRAINT customer_auto_onboards_invitation_status_check
      CHECK (invitation_status IN ('pending', 'claimed', 'sent', 'failed'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'customer_auto_onboards'::regclass
       AND conname = 'customer_auto_onboards_project_scope_fkey'
  ) THEN
    ALTER TABLE customer_auto_onboards
      ADD CONSTRAINT customer_auto_onboards_project_scope_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects(organization_id, id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'customer_auto_onboards'::regclass
       AND conname = 'customer_auto_onboards_preset_scope_fkey'
  ) THEN
    ALTER TABLE customer_auto_onboards
      ADD CONSTRAINT customer_auto_onboards_preset_scope_fkey
      FOREIGN KEY (organization_id, preset_id)
      REFERENCES lead_parameter_presets(organization_id, id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'client_portal_tokens'::regclass
       AND conname = 'client_portal_tokens_project_scope_fkey'
  ) THEN
    ALTER TABLE client_portal_tokens
      ADD CONSTRAINT client_portal_tokens_project_scope_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects(organization_id, id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'client_portal_tokens'::regclass
       AND conname = 'client_portal_tokens_auto_onboard_fkey'
  ) THEN
    ALTER TABLE client_portal_tokens
      ADD CONSTRAINT client_portal_tokens_auto_onboard_fkey
      FOREIGN KEY (auto_onboard_id)
      REFERENCES customer_auto_onboards(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'customer_auto_onboards'::regclass
       AND conname = 'customer_auto_onboards_portal_token_fkey'
  ) THEN
    ALTER TABLE customer_auto_onboards
      ADD CONSTRAINT customer_auto_onboards_portal_token_fkey
      FOREIGN KEY (portal_token_id)
      REFERENCES client_portal_tokens(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'client_focus_requests'::regclass
       AND conname = 'client_focus_requests_project_scope_fkey'
  ) THEN
    ALTER TABLE client_focus_requests
      ADD CONSTRAINT client_focus_requests_project_scope_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects(organization_id, id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'project_deliverables'::regclass
       AND conname = 'project_deliverables_project_scope_fkey'
  ) THEN
    ALTER TABLE project_deliverables
      ADD CONSTRAINT project_deliverables_project_scope_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects(organization_id, id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
END
$constraints$;

ALTER TABLE customer_auto_onboards
  VALIDATE CONSTRAINT customer_auto_onboards_retry_shape_check;
ALTER TABLE customer_auto_onboards
  VALIDATE CONSTRAINT customer_auto_onboards_invitation_status_check;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_auto_onboards_project_retry
  ON customer_auto_onboards (organization_id, project_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_client_portal_tokens_auto_onboard
  ON client_portal_tokens (auto_onboard_id)
  WHERE auto_onboard_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_deliverables_focus_request
  ON project_deliverables (organization_id, project_id, focus_request_id)
  WHERE focus_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_client_focus_requests_scope_need
  ON client_focus_requests (
    organization_id, project_id, customer_id, need_type
  );

CREATE INDEX IF NOT EXISTS idx_customer_auto_onboards_project_started
  ON customer_auto_onboards (organization_id, project_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_focus_requests_project_status
  ON client_focus_requests (
    organization_id, project_id, status, requested_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_project_deliverables_project_status_created
  ON project_deliverables (
    organization_id, project_id, status, created_at DESC
  );

-- Several historic tables deliberately used TEXT customer IDs. A generic
-- trigger lets the database still enforce the canonical UUID lead tuple for
-- all future scoped writes without destructively rewriting legacy audit data.
CREATE OR REPLACE FUNCTION enforce_leadgrid_customer_artifact_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.organization_id IS NULL OR NEW.project_id IS NULL THEN
    RAISE EXCEPTION 'Leadgrid customer artifacts require organization/project scope'
      USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM crm_customers lead
     WHERE lead.id::text = NEW.customer_id::text
       AND lead.organization_id = NEW.organization_id
       AND lead.project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'Leadgrid customer artifact does not match lead scope'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_customer_auto_onboards_customer_scope
  ON customer_auto_onboards;
CREATE TRIGGER trg_customer_auto_onboards_customer_scope
BEFORE INSERT OR UPDATE OF organization_id, project_id, customer_id
ON customer_auto_onboards
FOR EACH ROW EXECUTE FUNCTION enforce_leadgrid_customer_artifact_scope();

DROP TRIGGER IF EXISTS trg_client_portal_tokens_customer_scope
  ON client_portal_tokens;
CREATE TRIGGER trg_client_portal_tokens_customer_scope
BEFORE INSERT OR UPDATE OF organization_id, project_id, customer_id
ON client_portal_tokens
FOR EACH ROW EXECUTE FUNCTION enforce_leadgrid_customer_artifact_scope();

DROP TRIGGER IF EXISTS trg_client_focus_requests_customer_scope
  ON client_focus_requests;
CREATE TRIGGER trg_client_focus_requests_customer_scope
BEFORE INSERT OR UPDATE OF organization_id, project_id, customer_id
ON client_focus_requests
FOR EACH ROW EXECUTE FUNCTION enforce_leadgrid_customer_artifact_scope();

DROP TRIGGER IF EXISTS trg_project_deliverables_customer_scope
  ON project_deliverables;
CREATE TRIGGER trg_project_deliverables_customer_scope
BEFORE INSERT OR UPDATE OF organization_id, project_id, customer_id
ON project_deliverables
FOR EACH ROW EXECUTE FUNCTION enforce_leadgrid_customer_artifact_scope();

COMMENT ON COLUMN customer_auto_onboards.project_id IS
  'Authoritative Leadgrid customer project selected before onboarding starts.';
COMMENT ON COLUMN customer_auto_onboards.idempotency_key IS
  'Stable client-generated UUID; retries with the same payload replay one job.';
COMMENT ON COLUMN client_portal_tokens.auto_onboard_id IS
  'Makes portal provisioning idempotent when an onboarding worker resumes.';
COMMENT ON FUNCTION enforce_leadgrid_customer_artifact_scope() IS
  'Rejects portal, focus and delivery artifacts whose lead is outside their exact organization/project tuple.';

COMMIT;
