-- =====================================================================
-- 0349_leadgrid_deals_and_workflows.sql
--
-- Leadgrid 500-roadmap topp-10 punkt 3+4:
--   1) Deal Management (#154 deal-probability + #155 expected close-date)
--      → strukturerte deal-felt på crm_customers + audit-historikk
--      → weighted forecast (sum(amount * probability / 100))
--   2) Smart Workflow Builder Leadgrid-koblet (#203)
--      → trigger/conditions/actions definert i JSONB
--      → eksekverings-historikk for audit + debug
--      → 8 nye webhook-event-types for workflow-triggers
--
-- ⚠️  Pipeline-stages bruker EKSISTERENDE enum fra mig 313:
--     ('new','first_contact','qualified','meeting','proposal','negotiation','won','lost')
--     (prompt-spec navnga 'contacted','proposal_sent','verbal_yes' men vi
--      mapper til eksisterende stages i applikasjon-laget.)
--
-- Bygger på:
--   - mig 313 (pipeline_stage + lead_status + permissions + role_permissions)
--   - mig 326 (last_pipeline_stage_change_at/_by audit-felt)
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. crm_customers — strukturerte deal-felt (#154-#155)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS deal_probability INTEGER
    CHECK (deal_probability IS NULL OR (deal_probability BETWEEN 0 AND 100)),
  ADD COLUMN IF NOT EXISTS deal_probability_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS expected_close_date DATE,
  ADD COLUMN IF NOT EXISTS deal_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS deal_currency VARCHAR(3) DEFAULT 'NOK',
  ADD COLUMN IF NOT EXISTS deal_stage_changed_at TIMESTAMPTZ;

-- Indekser for forecasting-queries
CREATE INDEX IF NOT EXISTS idx_crm_customers_expected_close
  ON crm_customers(expected_close_date)
  WHERE archived_at IS NULL AND expected_close_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_deal_probability
  ON crm_customers(deal_probability)
  WHERE archived_at IS NULL AND deal_probability IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_weighted_deal
  ON crm_customers(owner_user_id, expected_close_date, deal_probability)
  WHERE archived_at IS NULL
    AND deal_probability IS NOT NULL
    AND deal_amount IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 2. crm_deal_stage_history — sales-velocity-analyse
-- (mig 326 har audit-FELT på crm_customers; denne tabellen er full-historikk)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_deal_stage_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  from_stage    VARCHAR(40),
  to_stage      VARCHAR(40) NOT NULL,
  changed_by    VARCHAR(255) NOT NULL,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  probability_before INTEGER,
  probability_after INTEGER,
  amount_before NUMERIC(12, 2),
  amount_after NUMERIC(12, 2),
  duration_in_previous_stage_minutes INTEGER,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_deal_history_customer
  ON crm_deal_stage_history(customer_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_history_by_user
  ON crm_deal_stage_history(changed_by, changed_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 3. leadgrid_workflows — Smart Workflow Builder (#203)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leadgrid_workflows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  created_by      VARCHAR(255) NOT NULL,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  trigger_type    VARCHAR(60) NOT NULL,
  trigger_config  JSONB NOT NULL DEFAULT '{}'::jsonb,
  conditions      JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions         JSONB NOT NULL DEFAULT '[]'::jsonb,
  execution_count INTEGER NOT NULL DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  last_error_at   TIMESTAMPTZ,
  last_error_message TEXT,
  template_key    VARCHAR(80),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflows_org_active
  ON leadgrid_workflows(organization_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_workflows_trigger
  ON leadgrid_workflows(trigger_type) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_workflows_template
  ON leadgrid_workflows(template_key) WHERE template_key IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 4. leadgrid_workflow_executions — audit + debug
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leadgrid_workflow_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id     UUID NOT NULL REFERENCES leadgrid_workflows(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  lead_id         UUID,
  trigger_event   JSONB NOT NULL,
  context         JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','running','completed','failed','skipped','dry_run')),
  actions_executed JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message   TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  duration_ms     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_workflow_exec_workflow
  ON leadgrid_workflow_executions(workflow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_exec_status
  ON leadgrid_workflow_executions(status) WHERE status IN ('pending','failed');
CREATE INDEX IF NOT EXISTS idx_workflow_exec_org
  ON leadgrid_workflow_executions(organization_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_exec_lead
  ON leadgrid_workflow_executions(lead_id, started_at DESC) WHERE lead_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 5. webhook-events for workflow-triggers
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO webhook_event_types (event_key, description) VALUES
  ('lead.temperature_changed', 'Lead temperature (cold/warm/hot/ready) changed'),
  ('deal.probability_changed', 'Deal probability changed (manual or via stage)'),
  ('deal.amount_changed', 'Deal amount changed'),
  ('deal.expected_close_changed', 'Expected close date changed'),
  ('workflow.created', 'Workflow created'),
  ('workflow.activated', 'Workflow set to active'),
  ('workflow.deactivated', 'Workflow set to inactive'),
  ('workflow.executed', 'Workflow execution finished')
ON CONFLICT (event_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 6. RBAC permissions + role bindings
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO permissions (key, category, description) VALUES
  ('deals.edit',         'Deal Management', 'Endre deal_probability, expected_close_date, deal_amount'),
  ('deals.view_amount',  'Deal Management', 'Se deal_amount (kan skjules for low-trust-roller)'),
  ('deals.view_forecast','Deal Management', 'Se weighted forecast for hele orgen'),
  ('workflows.view',     'Workflows',       'Se workflows og deres eksekverings-historikk'),
  ('workflows.create',   'Workflows',       'Opprette/redigere/aktivere workflows'),
  ('workflows.execute',  'Workflows',       'Manuelt trigge workflows mot leads')
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category,
      description = EXCLUDED.description;

-- Default role_permissions
INSERT INTO role_permissions (role, permission_key) VALUES
  -- admin: alt
  ('admin', 'deals.edit'),
  ('admin', 'deals.view_amount'),
  ('admin', 'deals.view_forecast'),
  ('admin', 'workflows.view'),
  ('admin', 'workflows.create'),
  ('admin', 'workflows.execute'),
  -- salgssjef: alt
  ('salgssjef', 'deals.edit'),
  ('salgssjef', 'deals.view_amount'),
  ('salgssjef', 'deals.view_forecast'),
  ('salgssjef', 'workflows.view'),
  ('salgssjef', 'workflows.create'),
  ('salgssjef', 'workflows.execute'),
  -- teamleder: redigere deals + se forecast + se+execute workflows
  ('teamleder', 'deals.edit'),
  ('teamleder', 'deals.view_amount'),
  ('teamleder', 'deals.view_forecast'),
  ('teamleder', 'workflows.view'),
  ('teamleder', 'workflows.execute'),
  -- salgskonsulent: redigere egne deals + se amount + se workflows
  ('salgskonsulent', 'deals.edit'),
  ('salgskonsulent', 'deals.view_amount'),
  ('salgskonsulent', 'workflows.view'),
  -- promotor: kun se workflow-status
  ('promotor', 'workflows.view')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
