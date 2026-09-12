-- 0507: Leadgrid salgsledelse — konsistent auth, idempotens og auditert dataflyt.
--
-- Migrasjonen er idempotent og kan kjøres både på databaser som har fått
-- 0354/0405/0406 og på produksjonsdatabaser hvor runtime-backfill allerede
-- har opprettet tabellene.

BEGIN;

-- Lead-status og provisjon har lenge brukt disse feltene. De eksplisitte
-- ALTER-setningene lukker gapet på miljøer der feltene tidligere bare ble
-- opprettet av runtime-kode eller en manuell produksjonsendring.
ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_changed_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meeting_booked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proposal_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS won_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS won_amount_oere BIGINT,
  ADD COLUMN IF NOT EXISTS won_recurring_oere BIGINT,
  ADD COLUMN IF NOT EXISTS won_note TEXT,
  ADD COLUMN IF NOT EXISTS lost_reason VARCHAR(80),
  ADD COLUMN IF NOT EXISTS lost_reason_detail TEXT;

CREATE TABLE IF NOT EXISTS crm_customer_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  from_status VARCHAR(40),
  to_status VARCHAR(40) NOT NULL,
  changed_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crm_customer_status_history
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES crm_customers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS from_status VARCHAR(40),
  ADD COLUMN IF NOT EXISTS to_status VARCHAR(40),
  ADD COLUMN IF NOT EXISTS changed_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS crm_customer_status_history_customer_idx
  ON crm_customer_status_history (customer_id, changed_at DESC);

INSERT INTO permissions (key, category, description) VALUES
  ('sales_leadership.view',   'Salgsledelse', 'Se team-KPI, prognoser, konkurranser og provisjon'),
  ('sales_leadership.manage', 'Salgsledelse', 'Administrere provisjon, mål, konkurranser, premier og godkjenninger')
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category,
      description = EXCLUDED.description;

INSERT INTO role_permissions (role, permission_key) VALUES
  ('owner', 'sales_leadership.view'),
  ('owner', 'sales_leadership.manage'),
  ('salgssjef', 'sales_leadership.view'),
  ('salgssjef', 'sales_leadership.manage'),
  ('teamleder', 'sales_leadership.view'),
  ('admin', 'sales_leadership.view'),
  ('admin', 'sales_leadership.manage')
ON CONFLICT DO NOTHING;

ALTER TABLE sales_contests
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS closed_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sales_contests_org_idempotency_uq
  ON sales_contests (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Nye awards får en eksplisitt replay-nøkkel. Eldre duplikatrader beholdes
-- urørt; dermed kan migrasjonen kjøres trygt uten å slette fulfillment-historikk.
ALTER TABLE sales_prize_awards
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS sales_prize_awards_contest_idempotency_uq
  ON sales_prize_awards (contest_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE sales_prize_catalog
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS sales_prize_catalog_org_idempotency_uq
  ON sales_prize_catalog (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE leadgrid_approvals
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(40),
  ADD COLUMN IF NOT EXISTS source_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS leadgrid_approvals_org_idempotency_uq
  ON leadgrid_approvals (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS leadgrid_approvals_source_idx
  ON leadgrid_approvals (organization_id, source_type, source_id)
  WHERE source_id IS NOT NULL;

ALTER TABLE leadgrid_mileage_claims
  ADD COLUMN IF NOT EXISTS rate_nok_per_km NUMERIC(8,2) NOT NULL DEFAULT 3.50,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS leadgrid_mileage_org_idempotency_uq
  ON leadgrid_mileage_claims (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE leadgrid_coaching_sessions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS leadgrid_coaching_org_idempotency_uq
  ON leadgrid_coaching_sessions (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Transaksjonell utkø for sideeffekter. Domeneendringen committes sammen med
-- eventet; varsling/e-post kan retryes uten å lage nye awards eller avgjørelser.
CREATE TABLE IF NOT EXISTS leadgrid_sales_management_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type VARCHAR(80) NOT NULL,
  aggregate_type VARCHAR(40) NOT NULL,
  aggregate_id VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','delivered','failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, event_type, aggregate_type, aggregate_id)
);

CREATE INDEX IF NOT EXISTS leadgrid_sales_management_outbox_pending_idx
  ON leadgrid_sales_management_outbox (next_attempt_at, created_at)
  WHERE status IN ('pending','failed');

CREATE INDEX IF NOT EXISTS leadgrid_sales_management_outbox_recovery_idx
  ON leadgrid_sales_management_outbox (updated_at)
  WHERE status = 'processing';
ALTER TABLE notification_events
  ADD COLUMN IF NOT EXISTS source_event_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS notification_events_source_event_uq
  ON notification_events (source_event_id)
  WHERE source_event_id IS NOT NULL;


CREATE INDEX IF NOT EXISTS crm_customers_org_assignee_won_idx
  ON crm_customers (organization_id, assigned_user_id, won_at DESC)
  WHERE archived_at IS NULL AND pipeline_stage = 'won';

-- Eldre Leadgrid-rader kan ha vunnet-status i ett av de historiske feltene.
-- Separate partial indexes gjør OR-spørringen effektiv uten å kreve en risikabel
-- masseoppdatering av eksisterende kundedata i denne migrasjonen.
CREATE INDEX IF NOT EXISTS crm_customers_org_assignee_status_won_idx
  ON crm_customers (organization_id, assigned_user_id, won_at DESC)
  WHERE archived_at IS NULL AND status = 'won';

CREATE INDEX IF NOT EXISTS crm_customers_org_assignee_lead_status_won_idx
  ON crm_customers (organization_id, assigned_user_id, won_at DESC)
  WHERE archived_at IS NULL AND lead_status = 'won';

CREATE INDEX IF NOT EXISTS leadgrid_rute_planer_org_today_idx
  ON leadgrid_rute_planer (organization_id, created_at DESC, status);

COMMIT;
