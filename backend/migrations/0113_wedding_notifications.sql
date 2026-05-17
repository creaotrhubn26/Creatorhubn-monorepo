-- 0113_wedding_notifications.sql
-- Notifikasjons-logg for bryllup (Slice 9X.38).
-- Initialt: plan-B-aktivering varsler fotograf + brudepar + must-capture VIPs.
-- Senere kan samme tabell logge timeline-endringer, kontrakt-godkjenning,
-- galleri-leveranse etc.

CREATE TABLE IF NOT EXISTS wedding_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id VARCHAR(64) NOT NULL,
  notification_type TEXT NOT NULL,
  -- 'plan_b_activated' | 'plan_b_deactivated' | 'timeline_changed' |
  -- 'overtime_activated' | 'gallery_delivered' | etc.
  recipient_type TEXT NOT NULL,
  -- 'photographer' | 'couple' | 'vip_contact' | 'assistant'
  recipient_name TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  channel TEXT NOT NULL,
  -- 'email' | 'sms'
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  provider TEXT,
  -- 'gmail' | 'twilio'
  provider_message_id TEXT,
  error_message TEXT,
  related_entity_type TEXT,
  related_entity_id TEXT,
  -- F.eks. type='location_alternative', id=<altId>
  triggered_by TEXT,
  -- 'photographer' | 'couple' | 'system'
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wedding_notifications_wedding_created
  ON wedding_notifications (wedding_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wedding_notifications_type
  ON wedding_notifications (notification_type, sent_at DESC);

COMMENT ON COLUMN wedding_notifications.status IS
  'pending = ikke sendt ennå. sent = leveransekvittering fra provider. failed = provider returnerte feil. skipped = mottaker mangler kanal-info.';
