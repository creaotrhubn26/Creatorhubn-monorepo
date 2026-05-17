-- 0117_push_subscriptions.sql
-- Web Push subscriptions (Slice 9X.43). PWA-klienter (Stine + brudepar)
-- subscriber per nettleser/enhet og lagrer endpoint + nøkler her.
-- sendPushToUser slår opp alle subscriptions for en user_id og sender via
-- web-push.sendNotification. 410 Gone → slett raden.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  -- Stine: hennes auth-userId. Brudepar: pseudo-ID 'couple:<token>'.
  endpoint TEXT NOT NULL UNIQUE,
  -- VAPID endpoint URL — unique per browser/device.
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  failure_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON push_subscriptions (user_id);

COMMENT ON COLUMN push_subscriptions.failure_count IS
  'Inkrementeres ved provider-feil. Rader med 410 Gone slettes umiddelbart.';
