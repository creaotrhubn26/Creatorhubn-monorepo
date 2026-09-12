-- =====================================================================
-- 322_leadgrid_webhook_secret_rotation.sql
--
-- Webhook-secret-rotering m/ grace-period. Når secret roteres lagres
-- gammel secret i signing_secret_old + signing_secret_rotated_at. Begge
-- aksepteres parallelt i 7 dager; en cron eksprier den gamle deretter.
-- =====================================================================

BEGIN;

ALTER TABLE leadgrid_webhook_subscriptions
  ADD COLUMN IF NOT EXISTS signing_secret_old TEXT,
  ADD COLUMN IF NOT EXISTS signing_secret_rotated_at TIMESTAMPTZ;

COMMIT;
