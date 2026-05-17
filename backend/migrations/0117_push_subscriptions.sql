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

-- Idempotente ALTER-er: hvis tabellen ble opprettet av en eldre versjon
-- (lazy CREATE TABLE i web-push-routes.ts) uten alle kolonnene, legg dem
-- til her. Trygt å kjøre flere ganger.
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS endpoint TEXT;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS p256dh TEXT;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS auth TEXT;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON push_subscriptions (user_id);

COMMENT ON COLUMN push_subscriptions.failure_count IS
  'Inkrementeres ved provider-feil. Rader med 410 Gone slettes umiddelbart.';
