-- =====================================================================
-- 0350_leadgrid_workflow_extensions.sql
--
-- Utvider Leadgrid Workflow Engine (mig 0349) med:
--   1) 6 nye triggers — email.opened, email.link_clicked,
--      meeting.booked, meeting.no_show, proposal.opened, contract.signed
--   2) 9 nye actions  — schedule_call, book_meeting, update_lead_fields,
--      post_to_webhook, trigger_zapier, send_internal_notification,
--      remove_tag, archive_lead, revive_lead
--
-- Nye tabeller for å BÆRE event-data:
--   - leadgrid_email_tracking_events  (sent/opened/link_clicked/bounced/unsubscribed)
--   - leadgrid_proposal_views         (PDF-tracker)
--   - leadgrid_contract_events        (DocuSign/Posten Signering webhook-mottak)
--   - leadgrid_workflow_webhook_destinations (for post_to_webhook + trigger_zapier)
--   - leadgrid_internal_notifications (in-app notif for send_internal_notification)
--   - leadgrid_meetings               (lightweight meeting-tabell for leads —
--                                       role_room_meetings krever casting_project FK)
--   - leadgrid_phone_calls            (planlagte/loggede telefonkall fra workflows)
--
-- Idempotent: alt CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- INSERT ... ON CONFLICT DO NOTHING.
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Email-tracking — for email.opened + email.link_clicked triggers
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leadgrid_email_tracking_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  customer_id     UUID,
  event_type      VARCHAR(40) NOT NULL
                  CHECK (event_type IN ('sent','opened','link_clicked','bounced','unsubscribed')),
  email_id        VARCHAR(120),
  link_url        TEXT,
  user_agent      TEXT,
  ip_address      INET,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lg_email_tracking_customer
  ON leadgrid_email_tracking_events(customer_id, occurred_at DESC)
  WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lg_email_tracking_event
  ON leadgrid_email_tracking_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_lg_email_tracking_org
  ON leadgrid_email_tracking_events(organization_id, occurred_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 2. Proposal-PDF-tracking — for proposal.opened trigger
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leadgrid_proposal_views (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  customer_id     UUID NOT NULL,
  proposal_id     VARCHAR(120) NOT NULL,
  viewed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  view_duration_seconds INTEGER,
  pages_viewed    INTEGER,
  device_type     VARCHAR(40),
  user_agent      TEXT,
  ip_address      INET,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_lg_proposal_views_customer
  ON leadgrid_proposal_views(customer_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_lg_proposal_views_proposal
  ON leadgrid_proposal_views(proposal_id, viewed_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 3. Contract-events — for contract.signed trigger (+ sent/viewed/declined/expired)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leadgrid_contract_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  customer_id     UUID NOT NULL,
  event_type      VARCHAR(30) NOT NULL
                  CHECK (event_type IN ('sent','viewed','signed','declined','expired')),
  contract_id     VARCHAR(120) NOT NULL,
  signer_email    VARCHAR(255),
  provider        VARCHAR(40),
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_lg_contract_events_customer
  ON leadgrid_contract_events(customer_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_lg_contract_events_contract
  ON leadgrid_contract_events(contract_id, occurred_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 4. Webhook-destinations — for post_to_webhook + trigger_zapier actions
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leadgrid_workflow_webhook_destinations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL,
  name             VARCHAR(120) NOT NULL,
  url              TEXT NOT NULL,
  hmac_secret      TEXT,
  destination_type VARCHAR(40) NOT NULL DEFAULT 'generic'
                   CHECK (destination_type IN ('generic','zapier','make','n8n','slack','teams')),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_by       VARCHAR(255),
  last_invoked_at  TIMESTAMPTZ,
  last_status_code INTEGER,
  invocation_count INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lg_webhook_dest_org_active
  ON leadgrid_workflow_webhook_destinations(organization_id)
  WHERE is_active = TRUE;

-- ─────────────────────────────────────────────────────────────────────
-- 5. Internal notifications — for send_internal_notification action
--    (separat fra notification_events i mig 290 fordi vi vil ikke at
--    workflows skal kunne forurense Lead Map-feeden; det er en egen
--    arbeids-strøm for "workflow informerte deg om noe".)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leadgrid_internal_notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL,
  recipient_user_id VARCHAR(255) NOT NULL,
  title             VARCHAR(200) NOT NULL,
  body              TEXT,
  related_lead_id   UUID,
  workflow_id       UUID,
  execution_id      UUID,
  is_read           BOOLEAN NOT NULL DEFAULT FALSE,
  read_at           TIMESTAMPTZ,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lg_internal_notif_user_unread
  ON leadgrid_internal_notifications(recipient_user_id, created_at DESC)
  WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_lg_internal_notif_lead
  ON leadgrid_internal_notifications(related_lead_id, created_at DESC)
  WHERE related_lead_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 6. leadgrid_meetings — lightweight meeting-record for leads
--    (role_room_meetings krever casting_project FK → ikke egnet for Leadgrid-leads)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leadgrid_meetings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL,
  customer_id      UUID,
  meeting_type     VARCHAR(40) NOT NULL DEFAULT 'discovery'
                   CHECK (meeting_type IN ('discovery','demo','closing','followup','other')),
  title            VARCHAR(200) NOT NULL,
  starts_at        TIMESTAMPTZ,
  ends_at          TIMESTAMPTZ,
  duration_minutes INTEGER,
  meet_link        TEXT,
  calendar_event_id TEXT,
  location         TEXT,
  status           VARCHAR(30) NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled','confirmed','completed','cancelled','no_show')),
  notes            TEXT,
  participants     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_id VARCHAR(255),
  source           VARCHAR(40),
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lg_meetings_customer
  ON leadgrid_meetings(customer_id, starts_at DESC NULLS LAST)
  WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lg_meetings_org_status
  ON leadgrid_meetings(organization_id, status, starts_at DESC NULLS LAST);

-- ─────────────────────────────────────────────────────────────────────
-- 7. leadgrid_phone_calls — planlagte/loggede telefonkall fra workflows
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leadgrid_phone_calls (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL,
  customer_id      UUID,
  planned_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  assigned_user_id VARCHAR(255),
  status           VARCHAR(30) NOT NULL DEFAULT 'planned'
                   CHECK (status IN ('planned','completed','no_answer','cancelled','skipped')),
  notes            TEXT,
  duration_seconds INTEGER,
  outcome          VARCHAR(60),
  source           VARCHAR(40),
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id VARCHAR(255),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lg_calls_customer
  ON leadgrid_phone_calls(customer_id, planned_at DESC NULLS LAST)
  WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lg_calls_assigned_planned
  ON leadgrid_phone_calls(assigned_user_id, planned_at)
  WHERE status = 'planned';

-- ─────────────────────────────────────────────────────────────────────
-- 8. Nye webhook-event-typer for de 6 nye triggers + workflow-actions
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO webhook_event_types (event_key, description) VALUES
  ('email.opened',          'Tracking-pixel registrerte at e-post ble åpnet'),
  ('email.link_clicked',    'Tracking-redirect registrerte at lenke ble klikket'),
  ('meeting.booked',        'Møte ble booket (Google Meet/Calendly/manuelt)'),
  ('meeting.no_show',       'Møte ble markert som no_show'),
  ('proposal.opened',       'Proposal-PDF ble åpnet av kunde'),
  ('contract.signed',       'Kontrakt ble signert (DocuSign/Posten Signering)'),
  ('lead.archived',         'Lead ble arkivert (manuelt eller via workflow)'),
  ('lead.revived',          'Lead ble revivisert (archived_at = NULL)')
ON CONFLICT (event_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 9. Ny RBAC-permission for webhook-config
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO permissions (key, category, description) VALUES
  ('workflows.manage_webhooks', 'Workflows',
   'Opprette/redigere webhook-destinasjoner som workflows kan poste til')
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category,
      description = EXCLUDED.description;

-- Default role_permissions — kun admin + salgssjef får manage_webhooks
INSERT INTO role_permissions (role, permission_key) VALUES
  ('admin',     'workflows.manage_webhooks'),
  ('salgssjef', 'workflows.manage_webhooks')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
