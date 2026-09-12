-- 290_lead_map_notifications.sql
--
-- Varsel-system for Lead Map. Tre lag:
--
-- 1) notification_events     — selve hendelses-loggen + in-app-feed
-- 2) notification_preferences — bruker velger HVA de vil varsles om
-- 3) notification_device_tokens — APNs-tokens for iPad-push
--
-- Levering:
--   - In-app feed:  ALLE events lagres + leveres via GET /me/notifications
--   - APNs:         Hvis bruker har device-token + preferansen er på
--   - E-post:       Fallback hvis APNs ikke konfigurert (via Resend)
--
-- Event-typer (NB: lever i kode, ikke som enum — fleksibelt):
--   lead_assigned          — ny lead tildelt deg
--   lead_status_changed    — status endret på lead du eier
--   lead_won_on_team       — lead i ditt team gikk til 'won' (for teamleder/salgssjef)
--   follow_up_due          — forfalt follow-up (cron, hvert 15 min)
--   approaching_lead       — under 500m fra fysisk lead (kun iPad, GPS-trigget)

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- Events
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id VARCHAR(255) NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  event_type VARCHAR(40) NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  -- Relatert lead/visit/team — frontend kan dypelinke til disse
  lead_id UUID REFERENCES crm_customers(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES crm_visits(id) ON DELETE CASCADE,
  -- Avsender (hvis relevant — null for system-events som follow_up_due)
  triggered_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  -- Frontend ruter til denne URL-en når brukeren tapper varselet
  deep_link TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Delivery-status (separate fra read-status)
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  apns_sent BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_events_recipient_unread
  ON notification_events (recipient_user_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notification_events_recipient_all
  ON notification_events (recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_events_lead
  ON notification_events (lead_id, created_at DESC)
  WHERE lead_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- Brukers preferanser per event-type
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE CASCADE,
  event_type VARCHAR(40) NOT NULL,
  -- Kanaler: in_app er alltid på (UI henter via GET /me/notifications),
  -- de andre styres her
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  apns_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  -- Quiet hours (lokaltid) — ingen push i dette vinduet
  quiet_hours_start INT,                          -- 0–23, NULL = ingen
  quiet_hours_end INT,                            -- 0–23
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, organization_id, event_type)
);

-- ─────────────────────────────────────────────────────────────────
-- Device-tokens for APNs / FCM
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  -- 'apns' (iPad) | 'web_push' (browser) | 'fcm' (Android — fremtidig)
  platform VARCHAR(20) NOT NULL
    CHECK (platform IN ('apns', 'web_push', 'fcm')),
  token TEXT NOT NULL,                            -- APNs device-token / web-push endpoint
  -- Web-push krever auth + p256dh-keys
  web_push_p256dh TEXT,
  web_push_auth TEXT,
  -- Apper deler enhets-info så vi kan deaktivere gamle tokens
  device_name VARCHAR(200),
  app_version VARCHAR(40),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (platform, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user
  ON notification_device_tokens (user_id, enabled);

COMMIT;
