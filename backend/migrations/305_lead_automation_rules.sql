-- =====================================================================
-- 305_lead_automation_rules.sql
--
-- IF/THEN automation-regler som binder lead-parametere sammen.
--
-- Eksempler (seedes i lead-rules-routes.ts):
--   IF status='interested' AND no follow_up_date
--      THEN prompt_user("Sett follow-up dato")
--   IF ai_score>80 AND lead_status='unvisited'
--      THEN set_priority('high')
--   IF status='proposal_sent' AND days_since_change>=5
--      THEN create_followup_reminder(days=1)
--   IF status='do_not_contact'
--      THEN disable_outreach()
--
-- Trigger-punkter:
--   - lead create
--   - lead update (status / score / follow_up endring)
--   - cron hver time (time-based rules)
--
-- Condition-grammatikk (JSONB):
--   { "all": [...] | "any": [...] | "not": {...},
--     "field": "status", "op": "eq", "value": "interested" }
--
-- Action-grammatikk (JSONB):
--   { "type": "prompt_user", "params": {"message": "..."}}
--   { "type": "set_priority", "params": {"level": "high"}}
--   { "type": "create_followup_reminder", "params": {"days": 1}}
--   { "type": "disable_outreach", "params": {}}
--   { "type": "notify_role", "params": {"role": "salgssjef", "message": "..."}}
--
-- Permission: marketing.rules.edit (kun markedssjef + admin kan endre regler)
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS lead_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name VARCHAR(160) NOT NULL,
  description TEXT,

  -- Hvilke event-typer trigger regelen
  trigger_on TEXT[] NOT NULL DEFAULT ARRAY['lead_create','lead_update','cron_hourly'],
  -- 'lead_create','lead_update','status_change','score_change',
  -- 'follow_up_set','follow_up_cleared','cron_hourly','cron_daily'

  -- Condition-tree (se grammatikk i fil-header)
  condition JSONB NOT NULL,
  -- Action-liste (kjøres sekvensielt; én feil avbryter ikke resten)
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Lavere = kjøres først (sortering ved trigger)
  priority SMALLINT NOT NULL DEFAULT 100,

  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,    -- system-seedede kan ikke slettes

  -- Per-org throttling: ikke kjør samme regel mer enn én gang per
  -- N minutter per lead (forhindrer spam-loops)
  throttle_minutes INT DEFAULT 60,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,

  UNIQUE (organization_id, name)
);
CREATE INDEX IF NOT EXISTS idx_rules_org_active
  ON lead_automation_rules(organization_id, is_active, priority);
CREATE INDEX IF NOT EXISTS idx_rules_trigger
  ON lead_automation_rules USING GIN (trigger_on)
  WHERE is_active = true;

-- ─── Audit av regel-kjøringer ──────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES lead_automation_rules(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  triggered_by_event VARCHAR(40) NOT NULL,

  -- 'matched' = condition var true → actions ble kjørt
  -- 'unmatched' = condition var false → ingen actions
  -- 'throttled' = innen throttle-vindu → hoppet over
  -- 'failed' = exception under evaluering eller action-run
  result VARCHAR(20) NOT NULL
    CHECK (result IN ('matched', 'unmatched', 'throttled', 'failed')),

  actions_executed JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  duration_ms INT,

  ran_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rule_runs_rule ON lead_automation_runs(rule_id, ran_at DESC);
CREATE INDEX IF NOT EXISTS idx_rule_runs_customer ON lead_automation_runs(customer_id, ran_at DESC);

-- ─── Permission ────────────────────────────────────────────────
INSERT INTO permissions (key, category, description) VALUES
  ('marketing.rules.view', 'Marketing', 'Se automation-regler'),
  ('marketing.rules.edit', 'Marketing', 'Lage/endre automation-regler (org-styrt)')
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category, description = EXCLUDED.description;

INSERT INTO role_permissions (role, permission_key) VALUES
  ('markedssjef',           'marketing.rules.view'),
  ('markedssjef',           'marketing.rules.edit'),
  ('markedskoordinator',    'marketing.rules.view'),
  ('seo_spesialist',        'marketing.rules.view'),
  ('content_ansvarlig',     'marketing.rules.view'),
  ('performance_marketer',  'marketing.rules.view'),
  ('markedsanalytiker',     'marketing.rules.view'),
  ('markedsanalytiker',     'marketing.rules.edit'),
  ('salgssjef',             'marketing.rules.view')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
