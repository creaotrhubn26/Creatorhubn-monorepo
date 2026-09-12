-- 0523_leadgrid_project_outcome_events.sql
--
-- Append-only, project-scoped outcome events for closed-loop integrations.
-- The payload deliberately supports only aggregate commercial metadata; names,
-- email addresses, phone numbers, free text and patient/treatment details do not
-- belong in this table.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- PostgreSQL requires an exact UNIQUE key before it can enforce the composite
-- tenant/project/lead foreign key below. The lead UUID is already globally
-- unique; this additional key exists so the database itself rejects a lead
-- that belongs to another organization or project.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'crm_customers'::regclass
       AND conname = 'crm_customers_organization_project_id_key'
  ) THEN
    ALTER TABLE crm_customers
      ADD CONSTRAINT crm_customers_organization_project_id_key
      UNIQUE (organization_id, project_id, id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS leadgrid_project_outcome_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  lead_id UUID NOT NULL,
  api_key_id UUID REFERENCES leadgrid_api_keys(id) ON DELETE SET NULL,
  event_type VARCHAR(40) NOT NULL CHECK (event_type IN (
    'pilot_invited',
    'meeting_completed',
    'profile_published',
    'inquiry_received',
    'booking_confirmed',
    'attendance_confirmed'
  )),
  external_event_id VARCHAR(255) NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  request_hash CHAR(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  occurred_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(metadata) = 'object'
    AND metadata - ARRAY[
      'channel',
      'campaign_ref',
      'territory_code',
      'quantity',
      'value_minor',
      'currency'
    ]::TEXT[] = '{}'::jsonb
    AND (
      NOT (metadata ? 'value_minor')
      OR (
        jsonb_typeof(metadata->'currency') = 'string'
        AND metadata->>'currency' ~ '^[A-Z]{3}$'
      )
    )
    AND ((metadata ? 'value_minor') = (metadata ? 'currency'))
  ),
  schema_version SMALLINT NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT leadgrid_outcome_events_project_scope_fkey
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT leadgrid_outcome_events_lead_scope_fkey
    FOREIGN KEY (organization_id, project_id, lead_id)
    REFERENCES crm_customers(organization_id, project_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT leadgrid_outcome_events_external_id_key
    UNIQUE (organization_id, project_id, external_event_id),
  CONSTRAINT leadgrid_outcome_events_idempotency_key
    UNIQUE (organization_id, project_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_outcome_events_project_time
  ON leadgrid_project_outcome_events
    (organization_id, project_id, occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_leadgrid_outcome_events_lead_time
  ON leadgrid_project_outcome_events
    (organization_id, project_id, lead_id, occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_leadgrid_outcome_events_type_time
  ON leadgrid_project_outcome_events
    (organization_id, project_id, event_type, occurred_at DESC);

COMMENT ON TABLE leadgrid_project_outcome_events IS
  'Append-only project outcome events. Rows are immutable through the application; deletion is reserved for tenant/lead lifecycle cascades.';
COMMENT ON COLUMN leadgrid_project_outcome_events.metadata IS
  'Allowlisted aggregate commercial metadata only. Never store patient identifiers, contact details, treatment/health details or free text.';
COMMENT ON COLUMN leadgrid_project_outcome_events.external_event_id IS
  'Stable identifier assigned by the source system; unique within an organization/project.';
COMMENT ON COLUMN leadgrid_project_outcome_events.idempotency_key IS
  'Stable retry key from Idempotency-Key, falling back to external_event_id.';

COMMIT;
