-- 0496_notification_delivery_log_schema.sql
--
-- Canonical delivery audit used by Role Room audition reminders. Previously
-- the relation existed only through schema snapshots/runtime history. One row
-- per logical notification + channel prevents duplicate audit rows on retry.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(hashtext('0496_notification_delivery_log_schema'));

CREATE TABLE IF NOT EXISTS notification_delivery_log (
  id TEXT PRIMARY KEY DEFAULT ('ndl_' || substr(md5(random()::text), 1, 9)),
  notification_id TEXT NOT NULL,
  delivery_method VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  attempted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMP,
  error_message TEXT,
  retry_count TEXT DEFAULT '0',
  metadata JSONB
);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_notification_id
  ON notification_delivery_log (notification_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_delivery_log_channel
  ON notification_delivery_log (notification_id, delivery_method);

COMMIT;
