-- =====================================================================
-- 313_leadgrid_intelligence.sql
--
-- Leadgrid Intelligence Engine — composite scoring + Next Best Action.
--
-- Utvider crm_customers med:
--   - pipeline_stage (new → won/lost)
--   - lead_score, conversion_probability, expected_value
--   - follow_up_priority + lead_temperature
--   - next_best_action + reason + channel + confidence
--   - priority (low/normal/high/urgent)
--   - scored_at
--
-- Nye tabeller:
--   - lead_scores_history   (ML-features + forklarbarhet)
--   - lead_recommendations  (NBA persistert + audit)
--   - lead_tags + lead_tag_assignments
--   - lead_segments         (named filters/cohorts)
--   - lead_custom_fields + lead_custom_field_values
--   - lead_routes + lead_route_stops
--   - webhook_event_types   (22 events seeded)
--
-- RBAC: 8 nye intelligence/routes-permissions seeded for 5 roller
--       (admin, salgssjef, teamleder, salgskonsulent, promotor)
--
-- Bygger på:
--   - mig 271 (crm_customers + lead_status enum)
--   - mig 286 (permissions / role_permissions / user_permission_overrides)
--   - mig 303 (crm_customer_needs / signals / scores / scoring_weights)
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. crm_customers — Intelligence-felter
-- (sikre at archived_at finnes — vi WHERE-bruker den i nye indekser)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pipeline_stage VARCHAR(40) NOT NULL DEFAULT 'new'
    CHECK (pipeline_stage IN ('new','first_contact','qualified','meeting','proposal','negotiation','won','lost')),
  ADD COLUMN IF NOT EXISTS lead_score INTEGER
    CHECK (lead_score IS NULL OR (lead_score BETWEEN 0 AND 100)),
  ADD COLUMN IF NOT EXISTS conversion_probability NUMERIC(5,4)
    CHECK (conversion_probability IS NULL OR (conversion_probability BETWEEN 0 AND 1)),
  ADD COLUMN IF NOT EXISTS expected_value NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS follow_up_priority INTEGER
    CHECK (follow_up_priority IS NULL OR (follow_up_priority BETWEEN 0 AND 100)),
  ADD COLUMN IF NOT EXISTS lead_temperature VARCHAR(10)
    CHECK (lead_temperature IS NULL OR lead_temperature IN ('cold','warm','hot','ready')),
  ADD COLUMN IF NOT EXISTS next_best_action VARCHAR(60),
  ADD COLUMN IF NOT EXISTS next_best_action_reason TEXT,
  ADD COLUMN IF NOT EXISTS next_best_action_channel VARCHAR(40),
  ADD COLUMN IF NOT EXISTS next_best_action_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent'));

-- FIX (2026-06-22): crm_customers har INGEN organization_id-kolonne.
-- Org-tilhørighet hentes via owner_user_id → organization_members.
-- Indeksene bruker owner_user_id som "tenant"-key (det er hva queries
-- faktisk filtrerer på via owner_user_id IN organization_members).
CREATE INDEX IF NOT EXISTS idx_crm_customers_pipeline_stage
  ON crm_customers(owner_user_id, pipeline_stage) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crm_customers_follow_up_priority
  ON crm_customers(owner_user_id, follow_up_priority DESC NULLS LAST) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crm_customers_next_follow_up
  ON crm_customers(owner_user_id, next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crm_customers_temperature
  ON crm_customers(owner_user_id, lead_temperature) WHERE archived_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 2. lead_scores_history — full breakdown for forklarbarhet + ML
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_scores_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  lead_score INTEGER NOT NULL,
  conversion_probability NUMERIC(5,4),
  expected_value NUMERIC(12,2),
  follow_up_priority INTEGER,
  lead_temperature VARCHAR(10),
  pipeline_stage VARCHAR(40),
  -- Per-faktor-breakdown (NUMERIC slik at vi kan ta gjennomsnitt over tid):
  category_fit NUMERIC(5,2),
  digital_need NUMERIC(5,2),
  budget_potential NUMERIC(5,2),
  engagement NUMERIC(5,2),
  timing NUMERIC(5,2),
  location_fit NUMERIC(5,2),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  computed_by VARCHAR(40) NOT NULL DEFAULT 'engine',
  triggered_by VARCHAR(40),
  reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_lead_scores_history_lead
  ON lead_scores_history(lead_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_scores_history_org
  ON lead_scores_history(organization_id, computed_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 3. lead_recommendations — NBA persistert + history
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  assigned_user_id UUID,
  action_type VARCHAR(60) NOT NULL,
  channel VARCHAR(40),
  priority VARCHAR(10) NOT NULL CHECK (priority IN ('low','normal','high','urgent')),
  reason TEXT NOT NULL,
  best_contact_time JSONB,
  suggested_message TEXT,
  confidence NUMERIC(3,2),
  expected_impact VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','executed','dismissed','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  outcome VARCHAR(40),
  outcome_notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_lead_recommendations_active
  ON lead_recommendations(organization_id, assigned_user_id, priority, created_at DESC)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_lead_recommendations_lead
  ON lead_recommendations(lead_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 4. Tags
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name VARCHAR(60) NOT NULL,
  color VARCHAR(20) DEFAULT '#9333EA',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS lead_tag_assignments (
  lead_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES lead_tags(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID,
  PRIMARY KEY (lead_id, tag_id)
);

-- ─────────────────────────────────────────────────────────────────────
-- 5. Segments (named filters/cohorts)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name VARCHAR(80) NOT NULL,
  description TEXT,
  filter_def JSONB NOT NULL,
  is_smart BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────
-- 6. Custom fields (per org)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  field_key VARCHAR(60) NOT NULL,
  label VARCHAR(120) NOT NULL,
  field_type VARCHAR(20) NOT NULL
    CHECK (field_type IN ('text','number','date','boolean','select','multiselect','url','email')),
  options JSONB,
  required BOOLEAN DEFAULT FALSE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, field_key)
);

CREATE TABLE IF NOT EXISTS lead_custom_field_values (
  lead_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES lead_custom_fields(id) ON DELETE CASCADE,
  value_text TEXT,
  value_number NUMERIC(18,6),
  value_date DATE,
  value_boolean BOOLEAN,
  value_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lead_id, field_id)
);

-- ─────────────────────────────────────────────────────────────────────
-- 7. Routes (field sales)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  name VARCHAR(120) NOT NULL,
  planned_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','completed','cancelled')),
  start_lat NUMERIC(10,7),
  start_lng NUMERIC(10,7),
  start_address TEXT,
  total_distance_meters INTEGER,
  total_drive_seconds INTEGER,
  expected_route_value NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS lead_route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES lead_routes(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES crm_customers(id),
  position INTEGER NOT NULL,
  scheduled_at TIMESTAMPTZ,
  distance_from_previous_meters INTEGER,
  drive_seconds_from_previous INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','arrived','visited','skipped','no_answer')),
  arrived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  outcome VARCHAR(40),
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_lead_route_stops_route
  ON lead_route_stops(route_id, position);

-- ─────────────────────────────────────────────────────────────────────
-- 8. Webhook event-katalog
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_event_types (
  event_key VARCHAR(60) PRIMARY KEY,
  description TEXT,
  payload_schema JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO webhook_event_types (event_key, description) VALUES
  ('lead.created', 'A new lead was created'),
  ('lead.updated', 'Lead fields were updated'),
  ('lead.status_changed', 'Lead status transitioned'),
  ('lead.pipeline_stage_changed', 'Lead pipeline stage transitioned'),
  ('lead.assigned', 'Lead was assigned to a user'),
  ('lead.scored', 'Lead score was recomputed'),
  ('lead.tagged', 'Tag added to lead'),
  ('lead.archived', 'Lead archived'),
  ('activity.created', 'Activity logged on a lead'),
  ('note.created', 'Note added to a lead'),
  ('visit.logged', 'Field visit logged'),
  ('meeting.booked', 'Meeting scheduled with lead'),
  ('proposal.sent', 'Proposal sent to lead'),
  ('deal.won', 'Deal closed as won'),
  ('deal.lost', 'Deal closed as lost'),
  ('followup.due', 'Follow-up is due'),
  ('followup.overdue', 'Follow-up is overdue'),
  ('recommendation.created', 'Next Best Action computed'),
  ('recommendation.executed', 'NBA was executed by user'),
  ('route.created', 'Field route created'),
  ('route.started', 'Route execution started'),
  ('route.completed', 'Route execution completed')
ON CONFLICT (event_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 9. Webhook-abonnementer (per org) + delivery-queue
-- Gjenbruk eksisterende `webhooks` er ikke mulig — den har ingen org_id.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leadgrid_webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  signing_secret TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  last_delivered_at TIMESTAMPTZ,
  last_status_code INTEGER,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leadgrid_webhook_subs_org
  ON leadgrid_webhook_subscriptions(organization_id) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS webhook_delivery_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES leadgrid_webhook_subscriptions(id) ON DELETE CASCADE,
  event_key VARCHAR(60) NOT NULL,
  payload JSONB NOT NULL,
  delivery_id UUID NOT NULL DEFAULT gen_random_uuid(),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','delivered','failed','exhausted')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  last_status_code INTEGER,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_queue_pending
  ON webhook_delivery_queue(status, next_retry_at)
  WHERE status IN ('pending','failed');

-- ─────────────────────────────────────────────────────────────────────
-- 10. RBAC permissions for Intelligence Engine + Routes
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO permissions (key, category, description) VALUES
  ('intelligence.view_score',          'Intelligence', 'View lead scoring and breakdown'),
  ('intelligence.override_score',      'Intelligence', 'Manually override AI score'),
  ('intelligence.run_engine',          'Intelligence', 'Trigger Intelligence Engine recompute'),
  ('intelligence.view_recommendations','Intelligence', 'View Next Best Actions'),
  ('intelligence.execute_recommendation','Intelligence', 'Mark NBA as executed'),
  ('routes.create',                    'Ruter',        'Create field routes'),
  ('routes.execute',                   'Ruter',        'Execute / update field route stops'),
  ('routes.view',                      'Ruter',        'View routes')
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category,
      description = EXCLUDED.description;

-- Default role_permissions for Intelligence + Routes
INSERT INTO role_permissions (role, permission_key) VALUES
  ('admin', 'intelligence.view_score'),
  ('admin', 'intelligence.override_score'),
  ('admin', 'intelligence.run_engine'),
  ('admin', 'intelligence.view_recommendations'),
  ('admin', 'intelligence.execute_recommendation'),
  ('admin', 'routes.create'),
  ('admin', 'routes.execute'),
  ('admin', 'routes.view'),
  ('salgssjef', 'intelligence.view_score'),
  ('salgssjef', 'intelligence.override_score'),
  ('salgssjef', 'intelligence.run_engine'),
  ('salgssjef', 'intelligence.view_recommendations'),
  ('salgssjef', 'intelligence.execute_recommendation'),
  ('salgssjef', 'routes.create'),
  ('salgssjef', 'routes.execute'),
  ('salgssjef', 'routes.view'),
  ('teamleder', 'intelligence.view_score'),
  ('teamleder', 'intelligence.run_engine'),
  ('teamleder', 'intelligence.view_recommendations'),
  ('teamleder', 'intelligence.execute_recommendation'),
  ('teamleder', 'routes.create'),
  ('teamleder', 'routes.execute'),
  ('teamleder', 'routes.view'),
  ('salgskonsulent', 'intelligence.view_score'),
  ('salgskonsulent', 'intelligence.view_recommendations'),
  ('salgskonsulent', 'intelligence.execute_recommendation'),
  ('salgskonsulent', 'routes.execute'),
  ('salgskonsulent', 'routes.view'),
  ('promotor', 'intelligence.view_recommendations'),
  ('promotor', 'intelligence.execute_recommendation'),
  ('promotor', 'routes.execute'),
  ('promotor', 'routes.view')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
