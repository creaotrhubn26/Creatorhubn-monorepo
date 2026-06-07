-- 233_email_events.sql
--
-- Lagrer email-events fra Resend webhooks (delivered/opened/clicked/bounced/
-- complained/sent) slik at AdminDashboard "Lab" → email-analytics-tab kan
-- aggregere ekte tall i stedet for å vise stubs.
--
-- event_type-verdier (samme strenger som Resend sender):
--   'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained'
--
-- campaign_id linker hendelser til en marketing-campaign hvis utsendingen
-- ble sendt fra en kampanje (vi setter denne ved send-tid og forventer
-- den som tag/header tilbake i webhook payload).
CREATE TABLE IF NOT EXISTS email_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_event_id TEXT UNIQUE,
  email_id        TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  to_email        TEXT,
  subject         TEXT,
  campaign_id     TEXT,
  link_url        TEXT,
  user_agent      TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_events_email_idx
  ON email_events (email_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS email_events_type_idx
  ON email_events (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS email_events_campaign_idx
  ON email_events (campaign_id, occurred_at DESC)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS email_events_occurred_idx
  ON email_events (occurred_at DESC);
