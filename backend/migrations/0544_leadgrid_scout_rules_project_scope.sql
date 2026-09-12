-- 0544_leadgrid_scout_rules_project_scope.sql
--
-- Lead Scout observations and automation rules used to be identified only by
-- a globally unique lead id (or, for rules, an organization). A Leadgrid
-- workspace can contain several customer projects, so every live read/write
-- must carry the exact organization/project tuple. Historic rows that cannot
-- be assigned without guessing are retained for audit, but are never served by
-- the project-scoped API and cannot remain active.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- -------------------------------------------------------------------------
-- Scout-derived lead facts
-- -------------------------------------------------------------------------

ALTER TABLE crm_customer_needs
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE crm_customer_signals
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE crm_customer_scores
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE crm_customer_scout_runs
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS project_id TEXT,
  ADD COLUMN IF NOT EXISTS request_key_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS request_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS result_payload JSONB;

UPDATE crm_customer_needs fact
   SET organization_id = lead.organization_id,
       project_id = lead.project_id
  FROM crm_customers lead
  JOIN leadgrid_projects project
    ON project.organization_id = lead.organization_id
   AND project.id = lead.project_id
 WHERE lead.id::text = fact.customer_id
   AND lead.organization_id IS NOT NULL
   AND lead.project_id IS NOT NULL
   AND (fact.organization_id, fact.project_id)
       IS DISTINCT FROM (lead.organization_id, lead.project_id);

UPDATE crm_customer_signals fact
   SET organization_id = lead.organization_id,
       project_id = lead.project_id
  FROM crm_customers lead
  JOIN leadgrid_projects project
    ON project.organization_id = lead.organization_id
   AND project.id = lead.project_id
 WHERE lead.id::text = fact.customer_id
   AND lead.organization_id IS NOT NULL
   AND lead.project_id IS NOT NULL
   AND (fact.organization_id, fact.project_id)
       IS DISTINCT FROM (lead.organization_id, lead.project_id);

UPDATE crm_customer_scores fact
   SET organization_id = lead.organization_id,
       project_id = lead.project_id
  FROM crm_customers lead
  JOIN leadgrid_projects project
    ON project.organization_id = lead.organization_id
   AND project.id = lead.project_id
 WHERE lead.id::text = fact.customer_id
   AND lead.organization_id IS NOT NULL
   AND lead.project_id IS NOT NULL
   AND (fact.organization_id, fact.project_id)
       IS DISTINCT FROM (lead.organization_id, lead.project_id);

UPDATE crm_customer_scout_runs fact
   SET organization_id = lead.organization_id,
       project_id = lead.project_id
  FROM crm_customers lead
  JOIN leadgrid_projects project
    ON project.organization_id = lead.organization_id
   AND project.id = lead.project_id
 WHERE lead.id::text = fact.customer_id
   AND lead.organization_id IS NOT NULL
   AND lead.project_id IS NOT NULL
   AND (fact.organization_id, fact.project_id)
       IS DISTINCT FROM (lead.organization_id, lead.project_id);

DO $constraints$
DECLARE
  target_table TEXT;
  constraint_name TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'crm_customer_needs',
    'crm_customer_signals',
    'crm_customer_scores',
    'crm_customer_scout_runs'
  ] LOOP
    constraint_name := target_table || '_project_scope_fkey';
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conrelid = target_table::regclass
         AND conname = constraint_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (organization_id, project_id) REFERENCES leadgrid_projects (organization_id, id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID',
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
$constraints$;

-- customer_id is a legacy TEXT column while crm_customers.id is UUID in the
-- current Leadgrid schema. A trigger enforces the composite reference without
-- a risky blocking type rewrite and rejects unscoped future rows.
CREATE OR REPLACE FUNCTION enforce_leadgrid_customer_fact_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.organization_id IS NULL OR NEW.project_id IS NULL THEN
    RAISE EXCEPTION 'Leadgrid customer fact requires organization_id and project_id'
      USING ERRCODE = '23502';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM crm_customers lead
     WHERE lead.id::text = NEW.customer_id
       AND lead.organization_id = NEW.organization_id
       AND lead.project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'Leadgrid customer fact must match the lead project scope'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_crm_customer_needs_project_scope ON crm_customer_needs;
CREATE TRIGGER trg_crm_customer_needs_project_scope
BEFORE INSERT OR UPDATE OF customer_id, organization_id, project_id
ON crm_customer_needs
FOR EACH ROW EXECUTE FUNCTION enforce_leadgrid_customer_fact_scope();

DROP TRIGGER IF EXISTS trg_crm_customer_signals_project_scope ON crm_customer_signals;
CREATE TRIGGER trg_crm_customer_signals_project_scope
BEFORE INSERT OR UPDATE OF customer_id, organization_id, project_id
ON crm_customer_signals
FOR EACH ROW EXECUTE FUNCTION enforce_leadgrid_customer_fact_scope();

DROP TRIGGER IF EXISTS trg_crm_customer_scores_project_scope ON crm_customer_scores;
CREATE TRIGGER trg_crm_customer_scores_project_scope
BEFORE INSERT OR UPDATE OF customer_id, organization_id, project_id
ON crm_customer_scores
FOR EACH ROW EXECUTE FUNCTION enforce_leadgrid_customer_fact_scope();

DROP TRIGGER IF EXISTS trg_crm_customer_scout_runs_project_scope ON crm_customer_scout_runs;
CREATE TRIGGER trg_crm_customer_scout_runs_project_scope
BEFORE INSERT OR UPDATE OF customer_id, organization_id, project_id
ON crm_customer_scout_runs
FOR EACH ROW EXECUTE FUNCTION enforce_leadgrid_customer_fact_scope();

CREATE INDEX IF NOT EXISTS idx_crm_needs_project_customer
  ON crm_customer_needs (organization_id, project_id, customer_id, priority DESC)
  WHERE organization_id IS NOT NULL AND project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_signals_project_customer
  ON crm_customer_signals (organization_id, project_id, customer_id, detected_at DESC)
  WHERE organization_id IS NOT NULL AND project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_scores_project_customer
  ON crm_customer_scores (organization_id, project_id, customer_id, contribution DESC)
  WHERE organization_id IS NOT NULL AND project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scout_runs_project_customer
  ON crm_customer_scout_runs (organization_id, project_id, customer_id, started_at DESC)
  WHERE organization_id IS NOT NULL AND project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_scout_runs_project_request
  ON crm_customer_scout_runs (organization_id, project_id, request_key_hash)
  WHERE request_key_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS leadgrid_scout_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  triggered_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  idempotency_key_hash CHAR(64) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  result_payload JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  CONSTRAINT leadgrid_scout_batches_project_scope_fkey
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects (organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT leadgrid_scout_batches_request_key
    UNIQUE (organization_id, project_id, idempotency_key_hash)
);

CREATE INDEX IF NOT EXISTS idx_scout_batches_project_started
  ON leadgrid_scout_batches
    (organization_id, project_id, started_at DESC);

-- -------------------------------------------------------------------------
-- Project-scoped automation rules and exactly-once evaluations
-- -------------------------------------------------------------------------

ALTER TABLE lead_automation_rules
  ADD COLUMN IF NOT EXISTS project_id TEXT,
  ADD COLUMN IF NOT EXISTS creation_key_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS creation_request_hash CHAR(64);

-- Only a single customer project is unambiguous. Multi-project organization
-- rules are kept as disabled legacy audit rows; the user can seed or recreate
-- them deliberately for each customer project.
WITH customer_projects AS (
  SELECT organization_id,
         MIN(id) AS project_id
    FROM leadgrid_projects
   WHERE organization_id IS NOT NULL
     AND (status IS NULL OR status NOT IN ('archived', 'deleted'))
     AND (project_type IS NULL OR project_type NOT IN (
       'feature_film', 'documentary', 'film', 'short_film',
       'tv_series', 'commercial', 'music_video', 'casting'
     ))
   GROUP BY organization_id
  HAVING COUNT(*) = 1
)
UPDATE lead_automation_rules rule
   SET project_id = project.project_id
  FROM customer_projects project
 WHERE project.organization_id = rule.organization_id
   AND rule.project_id IS NULL;

UPDATE lead_automation_rules
   SET is_active = FALSE,
       updated_at = NOW()
 WHERE project_id IS NULL
   AND is_active = TRUE;

ALTER TABLE lead_automation_rules
  DROP CONSTRAINT IF EXISTS lead_automation_rules_organization_id_name_key;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'lead_automation_rules'::regclass
       AND conname = 'lead_automation_rules_project_name_key'
  ) THEN
    ALTER TABLE lead_automation_rules
      ADD CONSTRAINT lead_automation_rules_project_name_key
      UNIQUE (organization_id, project_id, name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'lead_automation_rules'::regclass
       AND conname = 'lead_automation_rules_project_scope_fkey'
  ) THEN
    ALTER TABLE lead_automation_rules
      ADD CONSTRAINT lead_automation_rules_project_scope_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects (organization_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'lead_automation_rules'::regclass
       AND conname = 'lead_automation_rules_active_project_check'
  ) THEN
    ALTER TABLE lead_automation_rules
      ADD CONSTRAINT lead_automation_rules_active_project_check
      CHECK (NOT is_active OR project_id IS NOT NULL) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'lead_automation_rules'::regclass
       AND conname = 'lead_automation_rules_project_id_id_key'
  ) THEN
    ALTER TABLE lead_automation_rules
      ADD CONSTRAINT lead_automation_rules_project_id_id_key
      UNIQUE (organization_id, project_id, id);
  END IF;
END
$constraints$;

ALTER TABLE lead_automation_rules
  VALIDATE CONSTRAINT lead_automation_rules_project_scope_fkey;
ALTER TABLE lead_automation_rules
  VALIDATE CONSTRAINT lead_automation_rules_active_project_check;

DROP INDEX IF EXISTS idx_rules_org_active;
CREATE INDEX IF NOT EXISTS idx_rules_project_active
  ON lead_automation_rules (organization_id, project_id, is_active, priority, name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rules_project_creation_key
  ON lead_automation_rules (organization_id, project_id, creation_key_hash)
  WHERE creation_key_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS lead_automation_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  customer_id UUID NOT NULL,
  triggered_by_event VARCHAR(40) NOT NULL,
  idempotency_key_hash CHAR(64) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed')),
  result_payload JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT lead_automation_evaluations_project_scope_fkey
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects (organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT lead_automation_evaluations_customer_scope_fkey
    FOREIGN KEY (organization_id, project_id, customer_id)
    REFERENCES crm_customers (organization_id, project_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT lead_automation_evaluations_request_key
    UNIQUE (organization_id, project_id, idempotency_key_hash)
);

CREATE INDEX IF NOT EXISTS idx_rule_evaluations_project_customer
  ON lead_automation_evaluations
    (organization_id, project_id, customer_id, started_at DESC);

-- Durable cron queue.  The scheduler first materializes one row per exact
-- project/lead/time bucket and workers then claim rows with SKIP LOCKED.  This
-- makes hourly/daily rules safe across deploy restarts and multiple Render
-- instances; the evaluation idempotency envelope is the second line of
-- defence if a worker loses its response after committing the actions.
CREATE TABLE IF NOT EXISTS lead_automation_scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  customer_id UUID NOT NULL,
  trigger_event VARCHAR(20) NOT NULL
    CHECK (trigger_event IN ('cron_hourly', 'cron_daily')),
  schedule_bucket TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
  lease_token UUID,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lead_automation_scheduled_jobs_project_scope_fkey
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects (organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT lead_automation_scheduled_jobs_customer_scope_fkey
    FOREIGN KEY (organization_id, project_id, customer_id)
    REFERENCES crm_customers (organization_id, project_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT lead_automation_scheduled_jobs_bucket_key
    UNIQUE (organization_id, project_id, customer_id, trigger_event, schedule_bucket)
);
ALTER TABLE lead_automation_scheduled_jobs
  ADD COLUMN IF NOT EXISTS lease_token UUID;

CREATE INDEX IF NOT EXISTS idx_rule_scheduled_jobs_claim
  ON lead_automation_scheduled_jobs (status, available_at, schedule_bucket, id)
  WHERE status IN ('pending', 'running', 'failed');

ALTER TABLE lead_automation_runs
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS project_id TEXT,
  ADD COLUMN IF NOT EXISTS evaluation_id UUID;

UPDATE lead_automation_runs run
   SET organization_id = rule.organization_id,
       project_id = rule.project_id
  FROM lead_automation_rules rule,
       crm_customers lead
 WHERE rule.id = run.rule_id
   AND lead.id::text = run.customer_id
   AND rule.project_id IS NOT NULL
   AND lead.organization_id = rule.organization_id
   AND lead.project_id = rule.project_id
   AND (run.organization_id, run.project_id)
       IS DISTINCT FROM (rule.organization_id, rule.project_id);

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'lead_automation_runs'::regclass
       AND conname = 'lead_automation_runs_rule_scope_fkey'
  ) THEN
    ALTER TABLE lead_automation_runs
      ADD CONSTRAINT lead_automation_runs_rule_scope_fkey
      FOREIGN KEY (organization_id, project_id, rule_id)
      REFERENCES lead_automation_rules (organization_id, project_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'lead_automation_runs'::regclass
       AND conname = 'lead_automation_runs_evaluation_fkey'
  ) THEN
    ALTER TABLE lead_automation_runs
      ADD CONSTRAINT lead_automation_runs_evaluation_fkey
      FOREIGN KEY (evaluation_id)
      REFERENCES lead_automation_evaluations (id)
      ON DELETE CASCADE NOT VALID;
  END IF;
END
$constraints$;

ALTER TABLE lead_automation_runs
  VALIDATE CONSTRAINT lead_automation_runs_rule_scope_fkey;
ALTER TABLE lead_automation_runs
  VALIDATE CONSTRAINT lead_automation_runs_evaluation_fkey;

CREATE OR REPLACE FUNCTION enforce_lead_automation_run_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.organization_id IS NULL OR NEW.project_id IS NULL OR NEW.evaluation_id IS NULL THEN
    RAISE EXCEPTION 'Leadgrid automation run requires project evaluation scope'
      USING ERRCODE = '23502';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM lead_automation_rules rule
      JOIN crm_customers lead
        ON lead.id::text = NEW.customer_id
       AND lead.organization_id = rule.organization_id
       AND lead.project_id = rule.project_id
      JOIN lead_automation_evaluations evaluation
        ON evaluation.id = NEW.evaluation_id
       AND evaluation.organization_id = rule.organization_id
       AND evaluation.project_id = rule.project_id
       AND evaluation.customer_id::text = NEW.customer_id
     WHERE rule.id = NEW.rule_id
       AND rule.organization_id = NEW.organization_id
       AND rule.project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'Automation run rule, lead and evaluation scopes do not match'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_lead_automation_runs_project_scope ON lead_automation_runs;
CREATE TRIGGER trg_lead_automation_runs_project_scope
BEFORE INSERT OR UPDATE OF rule_id, customer_id, organization_id, project_id, evaluation_id
ON lead_automation_runs
FOR EACH ROW EXECUTE FUNCTION enforce_lead_automation_run_scope();

CREATE INDEX IF NOT EXISTS idx_rule_runs_project_rule
  ON lead_automation_runs (organization_id, project_id, rule_id, ran_at DESC)
  WHERE organization_id IS NOT NULL AND project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rule_runs_project_customer
  ON lead_automation_runs (organization_id, project_id, customer_id, ran_at DESC)
  WHERE organization_id IS NOT NULL AND project_id IS NOT NULL;

COMMENT ON FUNCTION enforce_leadgrid_customer_fact_scope() IS
  'Rejects new Scout facts/runs unless customer, organization and Leadgrid project form one exact tuple.';
COMMENT ON TABLE lead_automation_evaluations IS
  'Exactly-once, project-scoped envelope for one manual or scheduled rule evaluation.';
COMMENT ON TABLE lead_automation_scheduled_jobs IS
  'Durable project-scoped hourly/daily rule queue with one job per lead and schedule bucket.';
COMMENT ON TABLE leadgrid_scout_batches IS
  'Project-scoped idempotency envelope for a validated bulk Scout request.';
COMMENT ON COLUMN crm_customer_scout_runs.request_key_hash IS
  'SHA-256 of the caller Idempotency-Key; unique within the selected customer project.';

COMMIT;
