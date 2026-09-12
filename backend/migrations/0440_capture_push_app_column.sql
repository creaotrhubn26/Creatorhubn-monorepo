-- 0440_capture_push_app_column.sql
--
-- Skiller CaptureApp- fra LeadMap-tokens i notification_device_tokens så
-- backend sender med riktig apns-topic per app. Idempotent — den late
-- selvhelern i capture-push.ts kjører samme ALTER ved første bruk siden
-- Render ikke har preDeploy-migrasjon.

BEGIN;

ALTER TABLE notification_device_tokens
  ADD COLUMN IF NOT EXISTS app VARCHAR(20) NOT NULL DEFAULT 'leadmap';

COMMIT;
