-- 0541_leadgrid_workflow_project_scope.sql
--
-- Automations operate inside one customer project. The project tuple follows
-- the workflow through events, executions, waits and every generated artifact.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE leadgrid_workflows
  ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadgrid_workflow_executions
  ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadgrid_workflow_resume_jobs
  ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadgrid_email_tracking_events
  ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadgrid_proposal_views
  ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadgrid_contract_events
  ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadgrid_internal_notifications
  ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadgrid_meetings
  ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadgrid_phone_calls
  ADD COLUMN IF NOT EXISTS project_id TEXT;

-- Explicitly configured Discovery workflows already carry their project.
UPDATE leadgrid_workflows workflow
   SET project_id = workflow.trigger_config->>'project_id'
  FROM leadgrid_projects project
 WHERE workflow.project_id IS NULL
   AND NULLIF(workflow.trigger_config->>'project_id', '') = project.id
   AND workflow.organization_id = project.organization_id;

-- A single active Leadgrid project makes old workspace automations
-- unambiguous. Multi-project organizations are deliberately not guessed.
WITH only_project AS (
  SELECT organization_id, MIN(id) AS project_id
    FROM leadgrid_projects
   WHERE organization_id IS NOT NULL
     AND (status IS NULL OR status NOT IN ('archived', 'deleted'))
   GROUP BY organization_id
  HAVING COUNT(*) = 1
)
UPDATE leadgrid_workflows workflow
   SET project_id = resolved.project_id
  FROM only_project resolved
 WHERE workflow.project_id IS NULL
   AND workflow.organization_id = resolved.organization_id;

-- Ambiguous legacy automations remain available as audit data, but cannot
-- execute until recreated for an explicit customer project.
UPDATE leadgrid_workflows
   SET is_active = FALSE,
       last_error_at = NOW(),
       last_error_message = 'Deactivated: customer project must be selected',
       updated_at = NOW()
 WHERE project_id IS NULL
   AND is_active = TRUE;

-- Executions and resumable jobs must carry the exact same tenant tuple as
-- their workflow. A customer can retain a valid but different historical
-- project, and ambiguous workflows deliberately remain unscoped and inactive.
UPDATE leadgrid_workflow_executions execution
   SET project_id = workflow.project_id
  FROM leadgrid_workflows workflow
 WHERE execution.workflow_id = workflow.id
   AND execution.organization_id = workflow.organization_id
   AND execution.project_id IS DISTINCT FROM workflow.project_id;

UPDATE leadgrid_workflow_resume_jobs job
   SET project_id = workflow.project_id
  FROM leadgrid_workflows workflow
 WHERE job.workflow_id = workflow.id
   AND workflow.organization_id::text = job.organization_id
   AND job.project_id IS DISTINCT FROM workflow.project_id;

UPDATE leadgrid_email_tracking_events event
   SET project_id = customer.project_id,
       organization_id = customer.organization_id
  FROM crm_customers customer
  JOIN leadgrid_projects project
    ON project.organization_id = customer.organization_id
   AND project.id = customer.project_id
 WHERE event.customer_id = customer.id
   AND customer.organization_id IS NOT NULL
   AND customer.project_id IS NOT NULL
   AND (
     event.project_id IS DISTINCT FROM customer.project_id
     OR event.organization_id IS DISTINCT FROM customer.organization_id
   );

UPDATE leadgrid_proposal_views event
   SET project_id = customer.project_id,
       organization_id = customer.organization_id
  FROM crm_customers customer
  JOIN leadgrid_projects project
    ON project.organization_id = customer.organization_id
   AND project.id = customer.project_id
 WHERE event.customer_id = customer.id
   AND customer.organization_id IS NOT NULL
   AND customer.project_id IS NOT NULL
   AND (
     event.project_id IS DISTINCT FROM customer.project_id
     OR event.organization_id IS DISTINCT FROM customer.organization_id
   );

UPDATE leadgrid_contract_events event
   SET project_id = customer.project_id,
       organization_id = customer.organization_id
  FROM crm_customers customer
  JOIN leadgrid_projects project
    ON project.organization_id = customer.organization_id
   AND project.id = customer.project_id
 WHERE event.customer_id = customer.id
   AND customer.organization_id IS NOT NULL
   AND customer.project_id IS NOT NULL
   AND (
     event.project_id IS DISTINCT FROM customer.project_id
     OR event.organization_id IS DISTINCT FROM customer.organization_id
   );

UPDATE leadgrid_internal_notifications event
   SET project_id = customer.project_id,
       organization_id = customer.organization_id
  FROM crm_customers customer
  JOIN leadgrid_projects project
    ON project.organization_id = customer.organization_id
   AND project.id = customer.project_id
 WHERE event.related_lead_id = customer.id
   AND customer.organization_id IS NOT NULL
   AND customer.project_id IS NOT NULL
   AND (
     event.project_id IS DISTINCT FROM customer.project_id
     OR event.organization_id IS DISTINCT FROM customer.organization_id
   );

UPDATE leadgrid_meetings event
   SET project_id = customer.project_id,
       organization_id = customer.organization_id
  FROM crm_customers customer
  JOIN leadgrid_projects project
    ON project.organization_id = customer.organization_id
   AND project.id = customer.project_id
 WHERE event.customer_id = customer.id
   AND customer.organization_id IS NOT NULL
   AND customer.project_id IS NOT NULL
   AND (
     event.project_id IS DISTINCT FROM customer.project_id
     OR event.organization_id IS DISTINCT FROM customer.organization_id
   );

UPDATE leadgrid_phone_calls event
   SET project_id = customer.project_id,
       organization_id = customer.organization_id
  FROM crm_customers customer
  JOIN leadgrid_projects project
    ON project.organization_id = customer.organization_id
   AND project.id = customer.project_id
 WHERE event.customer_id = customer.id
   AND customer.organization_id IS NOT NULL
   AND customer.project_id IS NOT NULL
   AND (
     event.project_id IS DISTINCT FROM customer.project_id
     OR event.organization_id IS DISTINCT FROM customer.organization_id
   );

DO $$
DECLARE
  target_table TEXT;
  constraint_name TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'leadgrid_workflows',
    'leadgrid_workflow_executions',
    'leadgrid_email_tracking_events',
    'leadgrid_proposal_views',
    'leadgrid_contract_events',
    'leadgrid_internal_notifications',
    'leadgrid_meetings',
    'leadgrid_phone_calls'
  ]
  LOOP
    constraint_name := target_table || '_project_scope_fkey';
    IF NOT EXISTS (
      SELECT 1
        FROM pg_constraint
       WHERE conrelid = target_table::regclass
         AND conname = constraint_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (organization_id, project_id) REFERENCES leadgrid_projects (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID',
        target_table,
        constraint_name
      );
    END IF;
    EXECUTE format(
      'ALTER TABLE %I VALIDATE CONSTRAINT %I',
      target_table,
      constraint_name
    );
  END LOOP;
END
$$;

-- An execution must belong to the exact same organization/project tuple as
-- its workflow, not merely to any valid project in the organization.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_workflows'::regclass
       AND conname = 'leadgrid_workflows_project_id_id_key'
  ) THEN
    ALTER TABLE leadgrid_workflows
      ADD CONSTRAINT leadgrid_workflows_project_id_id_key
      UNIQUE (organization_id, project_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_workflow_executions'::regclass
       AND conname = 'leadgrid_workflow_executions_workflow_scope_fkey'
  ) THEN
    ALTER TABLE leadgrid_workflow_executions
      ADD CONSTRAINT leadgrid_workflow_executions_workflow_scope_fkey
      FOREIGN KEY (organization_id, project_id, workflow_id)
      REFERENCES leadgrid_workflows (organization_id, project_id, id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END
$$;

ALTER TABLE leadgrid_workflow_executions
  VALIDATE CONSTRAINT leadgrid_workflow_executions_workflow_scope_fkey;

-- Resume jobs used VARCHAR organization IDs in the legacy schema, so a
-- regular UUID composite FK cannot be added without a blocking type rewrite.
-- Cancel unresolved runnable jobs and enforce the exact workflow tuple with a
-- small constraint trigger for every new or changed row.
UPDATE leadgrid_workflow_resume_jobs
   SET status = 'cancelled',
       resumed_at = COALESCE(resumed_at, NOW())
 WHERE project_id IS NULL
   AND status IN ('pending', 'running');

ALTER TABLE leadgrid_workflow_resume_jobs
  DROP CONSTRAINT IF EXISTS leadgrid_workflow_resume_jobs_project_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_workflow_resume_jobs'::regclass
       AND conname = 'leadgrid_workflow_resume_jobs_runnable_project_check'
  ) THEN
    ALTER TABLE leadgrid_workflow_resume_jobs
      ADD CONSTRAINT leadgrid_workflow_resume_jobs_runnable_project_check
      CHECK (
        project_id IS NOT NULL
        OR status IN ('done', 'skipped', 'cancelled', 'failed')
      )
      NOT VALID;
  END IF;
END
$$;

ALTER TABLE leadgrid_workflow_resume_jobs
  VALIDATE CONSTRAINT leadgrid_workflow_resume_jobs_runnable_project_check;

CREATE OR REPLACE FUNCTION enforce_leadgrid_workflow_resume_job_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.project_id IS NOT NULL AND NOT EXISTS (
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
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_leadgrid_workflow_resume_job_scope
  ON leadgrid_workflow_resume_jobs;
CREATE CONSTRAINT TRIGGER trg_leadgrid_workflow_resume_job_scope
AFTER INSERT OR UPDATE OF workflow_id, organization_id, project_id
ON leadgrid_workflow_resume_jobs
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION enforce_leadgrid_workflow_resume_job_scope();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'leadgrid_workflows_active_project_check'
  ) THEN
    ALTER TABLE leadgrid_workflows
      ADD CONSTRAINT leadgrid_workflows_active_project_check
      CHECK (NOT is_active OR project_id IS NOT NULL)
      NOT VALID;
  END IF;
END
$$;

ALTER TABLE leadgrid_workflows
  VALIDATE CONSTRAINT leadgrid_workflows_active_project_check;

CREATE INDEX IF NOT EXISTS idx_workflows_project_active_trigger
  ON leadgrid_workflows (
    organization_id,
    project_id,
    trigger_type
  )
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_workflow_exec_project_started
  ON leadgrid_workflow_executions (
    organization_id,
    project_id,
    started_at DESC
  )
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_resume_project_due
  ON leadgrid_workflow_resume_jobs (
    organization_id,
    project_id,
    resume_at
  )
  WHERE status = 'pending'
    AND project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lg_email_tracking_project
  ON leadgrid_email_tracking_events (
    organization_id,
    project_id,
    occurred_at DESC
  )
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lg_proposal_views_project
  ON leadgrid_proposal_views (
    organization_id,
    project_id,
    viewed_at DESC
  )
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lg_contract_events_project
  ON leadgrid_contract_events (
    organization_id,
    project_id,
    occurred_at DESC
  )
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lg_internal_notif_project
  ON leadgrid_internal_notifications (
    organization_id,
    project_id,
    created_at DESC
  )
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lg_meetings_project
  ON leadgrid_meetings (
    organization_id,
    project_id,
    starts_at DESC
  )
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lg_calls_project
  ON leadgrid_phone_calls (
    organization_id,
    project_id,
    planned_at DESC
  )
  WHERE project_id IS NOT NULL;

COMMIT;
