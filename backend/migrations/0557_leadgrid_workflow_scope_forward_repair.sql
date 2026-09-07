-- 0557_leadgrid_workflow_scope_forward_repair.sql
--
-- Forward-only repair after 0541 was applied in production. Applied migration
-- bytes are immutable, so this migration conservatively reconciles ambiguous
-- legacy scope and adds exact lead-tuple enforcement for future writes.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public._migrations_applied
     WHERE filename = '0541_leadgrid_workflow_project_scope.sql'
       AND applied_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      '0557 requires the applied_at boundary from migration 0541'
      USING ERRCODE = '55000';
  END IF;
END
$preflight$;

CREATE TABLE IF NOT EXISTS leadgrid_scope_reconciliation_audit (
  source_migration TEXT NOT NULL,
  entity_table TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  previous_organization_id TEXT,
  previous_project_id TEXT,
  related_lead_id TEXT,
  related_workflow_id TEXT,
  reason TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  reconciled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_migration, entity_table, entity_id, reason)
);

COMMENT ON TABLE leadgrid_scope_reconciliation_audit IS
  'Redacted pre-repair scope snapshots for conservative Leadgrid reconciliation. FORCE RLS keeps runtime application sessions out of the operator audit.';

ALTER TABLE leadgrid_scope_reconciliation_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE leadgrid_scope_reconciliation_audit FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leadgrid_scope_reconciliation_operator_access
  ON leadgrid_scope_reconciliation_audit;
CREATE POLICY leadgrid_scope_reconciliation_operator_access
  ON leadgrid_scope_reconciliation_audit
  FOR ALL
  USING (SESSION_USER <> 'creatorhub_runtime_login')
  WITH CHECK (SESSION_USER <> 'creatorhub_runtime_login');

CREATE TEMP TABLE leadgrid_0557_context
ON COMMIT DROP
AS
-- The legacy ledger stores a timezone-less value written by NOW(). The live
-- 0541 ledger was verified as written with the database timezone GMT; interpret
-- that value explicitly so a later rerun is independent of session timezone.
SELECT applied_at AT TIME ZONE 'UTC' AS migration_cutoff
  FROM public._migrations_applied
 WHERE filename = '0541_leadgrid_workflow_project_scope.sql';

-- Keep the reconciliation snapshot stable and close the late-write window
-- between cleanup and trigger installation. Normal reads remain available;
-- concurrent writes wait briefly or the migration fails atomically.
LOCK TABLE
  crm_customers,
  leadgrid_projects,
  leadgrid_workflows,
  leadgrid_workflow_executions,
  leadgrid_workflow_resume_jobs,
  leadgrid_email_tracking_events,
  leadgrid_proposal_views,
  leadgrid_contract_events,
  leadgrid_internal_notifications,
  leadgrid_meetings,
  leadgrid_phone_calls
IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE leadgrid_0557_ambiguous_workflows
ON COMMIT DROP
AS
SELECT workflow.id,
       workflow.organization_id,
       workflow.project_id
  FROM leadgrid_workflows workflow
 CROSS JOIN leadgrid_0557_context context
 WHERE workflow.project_id IS NOT NULL
   AND workflow.created_at <= context.migration_cutoff
   AND NULLIF(BTRIM(workflow.trigger_config ->> 'project_id'), '')
       IS DISTINCT FROM workflow.project_id
   AND (
     SELECT COUNT(*)
       FROM leadgrid_projects project
      WHERE project.organization_id = workflow.organization_id
        AND project.created_at <= context.migration_cutoff
   ) <> 1;

CREATE UNIQUE INDEX ON leadgrid_0557_ambiguous_workflows (id);

-- A child must be detached before its inferred parent project is cleared.
INSERT INTO leadgrid_scope_reconciliation_audit (
  source_migration,
  entity_table,
  entity_id,
  previous_organization_id,
  previous_project_id,
  related_lead_id,
  related_workflow_id,
  reason,
  snapshot
)
SELECT '0557_leadgrid_workflow_scope_forward_repair.sql',
       'leadgrid_workflow_executions',
       execution.id::text,
       execution.organization_id::text,
       execution.project_id,
       execution.lead_id::text,
       execution.workflow_id::text,
       'ambiguous_inferred_workflow_project',
       to_jsonb(execution) -
         ARRAY['trigger_event', 'context', 'actions_executed', 'error_message']
  FROM leadgrid_workflow_executions execution
  JOIN leadgrid_0557_ambiguous_workflows ambiguous
    ON ambiguous.id = execution.workflow_id
   AND ambiguous.organization_id = execution.organization_id
   AND ambiguous.project_id = execution.project_id
 WHERE execution.project_id IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE leadgrid_workflow_executions execution
   SET project_id = NULL
  FROM leadgrid_0557_ambiguous_workflows ambiguous
 WHERE ambiguous.id = execution.workflow_id
   AND ambiguous.organization_id = execution.organization_id
   AND ambiguous.project_id = execution.project_id;

INSERT INTO leadgrid_scope_reconciliation_audit (
  source_migration,
  entity_table,
  entity_id,
  previous_organization_id,
  previous_project_id,
  related_lead_id,
  related_workflow_id,
  reason,
  snapshot
)
SELECT '0557_leadgrid_workflow_scope_forward_repair.sql',
       'leadgrid_workflow_resume_jobs',
       job.id::text,
       job.organization_id,
       job.project_id,
       job.lead_id,
       job.workflow_id::text,
       'ambiguous_inferred_workflow_project',
       to_jsonb(job) - ARRAY['event', 'last_error']
  FROM leadgrid_workflow_resume_jobs job
  JOIN leadgrid_0557_ambiguous_workflows ambiguous
    ON ambiguous.id = job.workflow_id
   AND ambiguous.organization_id::text = job.organization_id
   AND ambiguous.project_id = job.project_id
 WHERE job.project_id IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE leadgrid_workflow_resume_jobs job
   SET project_id = NULL,
       status = CASE
         WHEN job.status IN ('pending', 'running') THEN 'cancelled'
         ELSE job.status
       END,
       resumed_at = CASE
         WHEN job.status IN ('pending', 'running')
           THEN COALESCE(job.resumed_at, NOW())
         ELSE job.resumed_at
       END
  FROM leadgrid_0557_ambiguous_workflows ambiguous
 WHERE ambiguous.id = job.workflow_id
   AND ambiguous.organization_id::text = job.organization_id
   AND ambiguous.project_id = job.project_id;

INSERT INTO leadgrid_scope_reconciliation_audit (
  source_migration,
  entity_table,
  entity_id,
  previous_organization_id,
  previous_project_id,
  related_workflow_id,
  reason,
  snapshot
)
SELECT '0557_leadgrid_workflow_scope_forward_repair.sql',
       'leadgrid_workflows',
       workflow.id::text,
       workflow.organization_id::text,
       workflow.project_id,
       workflow.id::text,
       'ambiguous_inferred_workflow_project',
       to_jsonb(workflow) -
         ARRAY[
           'trigger_config', 'conditions', 'actions', 'metadata',
           'last_error_message'
         ]
  FROM leadgrid_workflows workflow
  JOIN leadgrid_0557_ambiguous_workflows ambiguous
    ON ambiguous.id = workflow.id
   AND ambiguous.organization_id = workflow.organization_id
   AND ambiguous.project_id = workflow.project_id
ON CONFLICT DO NOTHING;

UPDATE leadgrid_workflows workflow
   SET project_id = NULL,
       is_active = FALSE,
       last_error_at = NOW(),
       last_error_message =
         'Deactivated: legacy workflow project provenance is ambiguous',
       updated_at = NOW()
  FROM leadgrid_0557_ambiguous_workflows ambiguous
 WHERE ambiguous.id = workflow.id
   AND ambiguous.organization_id = workflow.organization_id
   AND ambiguous.project_id = workflow.project_id;

-- A resolved workflow does not make a conflicting or missing lead reference
-- trustworthy. Preserve the execution, but remove its project visibility.
INSERT INTO leadgrid_scope_reconciliation_audit (
  source_migration,
  entity_table,
  entity_id,
  previous_organization_id,
  previous_project_id,
  related_lead_id,
  related_workflow_id,
  reason,
  snapshot
)
SELECT '0557_leadgrid_workflow_scope_forward_repair.sql',
       'leadgrid_workflow_executions',
       execution.id::text,
       execution.organization_id::text,
       execution.project_id,
       execution.lead_id::text,
       execution.workflow_id::text,
       'lead_missing_or_cross_project',
       to_jsonb(execution) -
         ARRAY['trigger_event', 'context', 'actions_executed', 'error_message']
  FROM leadgrid_workflow_executions execution
 WHERE execution.project_id IS NOT NULL
   AND execution.lead_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM crm_customers customer
      WHERE customer.id = execution.lead_id
        AND customer.organization_id = execution.organization_id
        AND customer.project_id = execution.project_id
   )
ON CONFLICT DO NOTHING;

UPDATE leadgrid_workflow_executions execution
   SET project_id = NULL
 WHERE execution.project_id IS NOT NULL
   AND execution.lead_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM crm_customers customer
      WHERE customer.id = execution.lead_id
        AND customer.organization_id = execution.organization_id
        AND customer.project_id = execution.project_id
   );

INSERT INTO leadgrid_scope_reconciliation_audit (
  source_migration,
  entity_table,
  entity_id,
  previous_organization_id,
  previous_project_id,
  related_lead_id,
  related_workflow_id,
  reason,
  snapshot
)
SELECT '0557_leadgrid_workflow_scope_forward_repair.sql',
       'leadgrid_workflow_resume_jobs',
       job.id::text,
       job.organization_id,
       job.project_id,
       job.lead_id,
       job.workflow_id::text,
       'lead_missing_or_cross_project',
       to_jsonb(job) - ARRAY['event', 'last_error']
  FROM leadgrid_workflow_resume_jobs job
 WHERE job.project_id IS NOT NULL
   AND NULLIF(BTRIM(job.lead_id), '') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM crm_customers customer
      WHERE customer.id::text = job.lead_id
        AND customer.organization_id::text = job.organization_id
        AND customer.project_id = job.project_id
   )
ON CONFLICT DO NOTHING;

UPDATE leadgrid_workflow_resume_jobs job
   SET project_id = NULL,
       status = CASE
         WHEN job.status IN ('pending', 'running') THEN 'cancelled'
         ELSE job.status
       END,
       resumed_at = CASE
         WHEN job.status IN ('pending', 'running')
           THEN COALESCE(job.resumed_at, NOW())
         ELSE job.resumed_at
       END
 WHERE job.project_id IS NOT NULL
   AND NULLIF(BTRIM(job.lead_id), '') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM crm_customers customer
      WHERE customer.id::text = job.lead_id
        AND customer.organization_id::text = job.organization_id
        AND customer.project_id = job.project_id
   );

-- Explicit archived/deleted/missing projects remain valid historical labels,
-- but workflows for them must never be runnable.
INSERT INTO leadgrid_scope_reconciliation_audit (
  source_migration,
  entity_table,
  entity_id,
  previous_organization_id,
  previous_project_id,
  related_workflow_id,
  reason,
  snapshot
)
SELECT '0557_leadgrid_workflow_scope_forward_repair.sql',
       'leadgrid_workflows',
       workflow.id::text,
       workflow.organization_id::text,
       workflow.project_id,
       workflow.id::text,
       'active_workflow_project_ineligible',
       to_jsonb(workflow) -
         ARRAY[
           'trigger_config', 'conditions', 'actions', 'metadata',
           'last_error_message'
         ]
  FROM leadgrid_workflows workflow
 WHERE workflow.is_active = TRUE
   AND (
     workflow.project_id IS NULL
     OR NOT EXISTS (
       SELECT 1
         FROM leadgrid_projects project
        WHERE project.organization_id = workflow.organization_id
          AND project.id = workflow.project_id
          AND (
            project.status IS NULL
            OR project.status NOT IN ('archived', 'deleted')
          )
     )
   )
ON CONFLICT DO NOTHING;

UPDATE leadgrid_workflows workflow
   SET is_active = FALSE,
       last_error_at = NOW(),
       last_error_message =
         'Deactivated: workflow project is missing or inactive',
       updated_at = NOW()
 WHERE workflow.is_active = TRUE
   AND (
     workflow.project_id IS NULL
     OR NOT EXISTS (
       SELECT 1
         FROM leadgrid_projects project
        WHERE project.organization_id = workflow.organization_id
          AND project.id = workflow.project_id
          AND (
            project.status IS NULL
            OR project.status NOT IN ('archived', 'deleted')
          )
     )
   );

-- 0541 copied the lead's then-current project into six legacy audit streams.
-- For rows that already existed at the 0541 ledger boundary, that provenance
-- is retained only for organizations that had exactly one project at that
-- boundary. Historical request metadata was caller-controlled and is retained
-- only as a hint in the source row, never trusted as scope authority. Ambiguous
-- rows keep all content and tenant identity; only project visibility is removed.
DO $artifacts$
DECLARE
  artifact RECORD;
BEGIN
  FOR artifact IN
    SELECT *
      FROM (
        VALUES
          ('leadgrid_email_tracking_events', 'customer_id', 'occurred_at'),
          ('leadgrid_proposal_views', 'customer_id', 'viewed_at'),
          ('leadgrid_contract_events', 'customer_id', 'occurred_at'),
          ('leadgrid_internal_notifications', 'related_lead_id', 'created_at'),
          ('leadgrid_meetings', 'customer_id', 'created_at'),
          ('leadgrid_phone_calls', 'customer_id', 'created_at')
      ) AS entries(table_name, lead_column, timestamp_column)
  LOOP
    EXECUTE format(
      $audit_mismatch$
        INSERT INTO leadgrid_scope_reconciliation_audit (
          source_migration, entity_table, entity_id,
          previous_organization_id, previous_project_id,
          related_lead_id, reason, snapshot
        )
        SELECT '0557_leadgrid_workflow_scope_forward_repair.sql',
               %L,
               event.id::text,
               event.organization_id::text,
               event.project_id,
               event.%I::text,
               'lead_missing_or_cross_project',
               to_jsonb(event) - ARRAY[
                 'metadata', 'ip_address', 'user_agent', 'link_url',
                 'signer_email', 'notes', 'participants', 'body', 'title',
                 'location', 'meet_link'
               ]
          FROM %I event
         WHERE event.project_id IS NOT NULL
           AND event.%I IS NOT NULL
           AND NOT EXISTS (
             SELECT 1
               FROM crm_customers customer
              WHERE customer.id = event.%I
                AND customer.organization_id = event.organization_id
                AND customer.project_id = event.project_id
           )
        ON CONFLICT DO NOTHING
      $audit_mismatch$,
      artifact.table_name,
      artifact.lead_column,
      artifact.table_name,
      artifact.lead_column,
      artifact.lead_column
    );

    EXECUTE format(
      $clear_mismatch$
        UPDATE %I event
           SET project_id = NULL
         WHERE event.project_id IS NOT NULL
           AND event.%I IS NOT NULL
           AND NOT EXISTS (
             SELECT 1
               FROM crm_customers customer
              WHERE customer.id = event.%I
                AND customer.organization_id = event.organization_id
                AND customer.project_id = event.project_id
           )
      $clear_mismatch$,
      artifact.table_name,
      artifact.lead_column,
      artifact.lead_column
    );

    EXECUTE format(
      $audit_ambiguous$
        INSERT INTO leadgrid_scope_reconciliation_audit (
          source_migration, entity_table, entity_id,
          previous_organization_id, previous_project_id,
          related_lead_id, reason, snapshot
        )
        SELECT '0557_leadgrid_workflow_scope_forward_repair.sql',
               %L,
               event.id::text,
               event.organization_id::text,
               event.project_id,
               event.%I::text,
               'legacy_multi_project_provenance_ambiguous',
               to_jsonb(event) - ARRAY[
                 'metadata', 'ip_address', 'user_agent', 'link_url',
                 'signer_email', 'notes', 'participants', 'body', 'title',
                 'location', 'meet_link'
               ]
          FROM %I event
         CROSS JOIN leadgrid_0557_context context
         WHERE event.project_id IS NOT NULL
           AND event.%I IS NOT NULL
           AND event.%I <= context.migration_cutoff
           AND (
             SELECT COUNT(*)
               FROM leadgrid_projects project
              WHERE project.organization_id = event.organization_id
                AND project.created_at <= context.migration_cutoff
           ) <> 1
        ON CONFLICT DO NOTHING
      $audit_ambiguous$,
      artifact.table_name,
      artifact.lead_column,
      artifact.table_name,
      artifact.lead_column,
      artifact.timestamp_column
    );

    EXECUTE format(
      $clear_ambiguous$
        UPDATE %I event
           SET project_id = NULL
          FROM leadgrid_0557_context context
         WHERE event.project_id IS NOT NULL
           AND event.%I IS NOT NULL
           AND event.%I <= context.migration_cutoff
           AND (
             SELECT COUNT(*)
               FROM leadgrid_projects project
              WHERE project.organization_id = event.organization_id
                AND project.created_at <= context.migration_cutoff
           ) <> 1
      $clear_ambiguous$,
      artifact.table_name,
      artifact.lead_column,
      artifact.timestamp_column
    );
  END LOOP;
END
$artifacts$;

-- Validate new lead-bound artifact writes without a cascading FK. A composite
-- FK with ON UPDATE CASCADE would rewrite historical provenance when a lead is
-- later moved, while ON DELETE SET NULL cannot support artifact tables whose
-- lead column is NOT NULL. These triggers validate child writes only, so old
-- audit rows remain immutable when their current lead changes later.
CREATE OR REPLACE FUNCTION enforce_leadgrid_scoped_artifact_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  related_lead_id UUID;
BEGIN
  related_lead_id := NULLIF(BTRIM(to_jsonb(NEW) ->> TG_ARGV[0]), '')::uuid;

  IF related_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.organization_id IS NULL
     OR NULLIF(BTRIM(NEW.project_id), '') IS NULL THEN
    RAISE EXCEPTION
      '% lead-bound rows require organization/project scope', TG_TABLE_NAME
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM crm_customers customer
     WHERE customer.id = related_lead_id
       AND customer.organization_id = NEW.organization_id
       AND customer.project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION
      '% lead must match organization/project', TG_TABLE_NAME
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END
$function$;

COMMENT ON FUNCTION enforce_leadgrid_scoped_artifact_lead() IS
  'Validates exact lead scope on new or explicitly re-scoped Leadgrid artifact rows without rewriting historical rows when a lead later moves.';

DO $artifact_triggers$
DECLARE
  artifact RECORD;
  trigger_name TEXT;
BEGIN
  FOR artifact IN
    SELECT *
      FROM (
        VALUES
          ('leadgrid_email_tracking_events', 'customer_id'),
          ('leadgrid_proposal_views', 'customer_id'),
          ('leadgrid_contract_events', 'customer_id'),
          ('leadgrid_internal_notifications', 'related_lead_id'),
          ('leadgrid_meetings', 'customer_id'),
          ('leadgrid_phone_calls', 'customer_id')
      ) AS entries(table_name, lead_column)
  LOOP
    trigger_name := 'trg_' || artifact.table_name || '_lead_scope';
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON %I',
      trigger_name,
      artifact.table_name
    );
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF organization_id, project_id, %I ON %I FOR EACH ROW EXECUTE FUNCTION enforce_leadgrid_scoped_artifact_lead(%L)',
      trigger_name,
      artifact.lead_column,
      artifact.table_name,
      artifact.lead_column
    );
  END LOOP;
END
$artifact_triggers$;

CREATE OR REPLACE FUNCTION enforce_leadgrid_workflow_execution_lead_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NULLIF(BTRIM(NEW.project_id), '') IS NULL THEN
    RAISE EXCEPTION
      'new or re-scoped workflow executions require project scope'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.lead_id IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
        FROM crm_customers customer
       WHERE customer.id = NEW.lead_id
         AND customer.organization_id = NEW.organization_id
         AND customer.project_id = NEW.project_id
     ) THEN
    RAISE EXCEPTION
      'workflow execution lead must match organization/project'
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END
$function$;

COMMENT ON FUNCTION enforce_leadgrid_workflow_execution_lead_scope() IS
  'Requires project scope and validates the optional lead tuple on new or explicitly re-scoped workflow executions.';

DROP TRIGGER IF EXISTS trg_leadgrid_workflow_execution_lead_scope
  ON leadgrid_workflow_executions;
CREATE TRIGGER trg_leadgrid_workflow_execution_lead_scope
BEFORE INSERT OR UPDATE OF workflow_id, organization_id, project_id, lead_id
ON leadgrid_workflow_executions
FOR EACH ROW
EXECUTE FUNCTION enforce_leadgrid_workflow_execution_lead_scope();

CREATE OR REPLACE FUNCTION enforce_leadgrid_workflow_resume_job_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.project_id IS NULL THEN
    RAISE EXCEPTION
      'new or re-scoped workflow resume jobs require project scope'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM leadgrid_workflows workflow
     WHERE workflow.id = NEW.workflow_id
       AND workflow.organization_id::text = NEW.organization_id
       AND workflow.project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION
      'workflow resume job must match workflow organization/project'
      USING ERRCODE = '23503';
  END IF;

  IF NULLIF(BTRIM(NEW.lead_id), '') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
         FROM crm_customers customer
        WHERE customer.id::text = NEW.lead_id
          AND customer.organization_id::text = NEW.organization_id
          AND customer.project_id = NEW.project_id
     ) THEN
    RAISE EXCEPTION
      'workflow resume job lead must match organization/project'
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END
$function$;

COMMENT ON FUNCTION enforce_leadgrid_workflow_resume_job_scope() IS
  'Requires both workflow and optional lead to match a resume job exact organization/project tuple.';

-- Migration 0541's constraint trigger did not fire for lead_id-only changes.
-- Recreate it so every tuple component is covered by the stronger function.
DROP TRIGGER IF EXISTS trg_leadgrid_workflow_resume_job_scope
  ON leadgrid_workflow_resume_jobs;
CREATE CONSTRAINT TRIGGER trg_leadgrid_workflow_resume_job_scope
AFTER INSERT OR UPDATE OF workflow_id, organization_id, project_id, lead_id
ON leadgrid_workflow_resume_jobs
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION enforce_leadgrid_workflow_resume_job_scope();

COMMIT;
