-- 0463_casting_reminder_delivery_claims.sql
--
-- Distributed at-most-once guard for audition reminders. A claim lease may be
-- reclaimed only before delivery starts. Once delivery_started_at is committed,
-- the row is never automatically retried unless the sender can prove that the
-- failure happened before the provider could accept the message.

BEGIN;

CREATE TABLE IF NOT EXISTS casting_reminder_delivery_claims (
  schedule_id                 VARCHAR(255) NOT NULL
    REFERENCES casting_schedules(id) ON DELETE CASCADE,
  threshold                   VARCHAR(8) NOT NULL,
  channel                     VARCHAR(16) NOT NULL,
  claim_id                    UUID,
  claim_expires_at            TIMESTAMPTZ,
  delivery_started_at         TIMESTAMPTZ,
  delivery_uncertain_at       TIMESTAMPTZ,
  delivered_at                TIMESTAMPTZ,
  message_id                  TEXT,
  provider_message_id         TEXT,
  last_error                  TEXT,
  attempt_count               INTEGER NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (schedule_id, threshold, channel),
  CONSTRAINT casting_reminder_delivery_threshold_check
    CHECK (threshold IN ('24h', '1h')),
  CONSTRAINT casting_reminder_delivery_channel_check
    CHECK (channel IN ('whatsapp', 'sms', 'email')),
  CONSTRAINT casting_reminder_delivery_attempt_count_check
    CHECK (attempt_count >= 0),
  CONSTRAINT casting_reminder_delivery_started_state_check
    CHECK (
      (delivery_uncertain_at IS NULL OR delivery_started_at IS NOT NULL)
      AND (delivered_at IS NULL OR delivery_started_at IS NOT NULL)
      AND NOT (delivery_uncertain_at IS NOT NULL AND delivered_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS casting_reminder_delivery_reclaim_idx
  ON casting_reminder_delivery_claims (claim_expires_at, created_at)
  WHERE delivered_at IS NULL
    AND delivery_started_at IS NULL;

CREATE INDEX IF NOT EXISTS casting_reminder_delivery_uncertain_idx
  ON casting_reminder_delivery_claims (delivery_uncertain_at, updated_at)
  WHERE delivery_started_at IS NOT NULL
    AND delivered_at IS NULL;

-- `casting_schedules.reminders_sent` used to be the only idempotency marker and
-- did not identify which channel was delivered. Conservatively quarantine all
-- three channels for historical markers: this avoids replaying an old reminder
-- after the new per-channel table becomes authoritative.
INSERT INTO casting_reminder_delivery_claims (
  schedule_id,
  threshold,
  channel,
  delivery_started_at,
  delivered_at,
  attempt_count,
  created_at,
  updated_at
)
SELECT
  schedules.id,
  sent.threshold,
  channels.channel,
  schedules.updated_at,
  schedules.updated_at,
  1,
  schedules.updated_at,
  schedules.updated_at
FROM casting_schedules AS schedules
CROSS JOIN LATERAL jsonb_object_keys(
  CASE
    WHEN jsonb_typeof(schedules.reminders_sent) = 'object'
      THEN schedules.reminders_sent
    ELSE '{}'::jsonb
  END
) AS sent(threshold)
CROSS JOIN (VALUES ('whatsapp'), ('sms'), ('email')) AS channels(channel)
WHERE sent.threshold IN ('24h', '1h')
  AND NULLIF(schedules.reminders_sent ->> sent.threshold, '') IS NOT NULL
ON CONFLICT (schedule_id, threshold, channel) DO NOTHING;

COMMENT ON TABLE casting_reminder_delivery_claims IS
  'Per schedule, threshold og kanal: atomisk claim, pre-delivery lease og permanent at-most-once-sperre etter providerstart.';

COMMENT ON COLUMN casting_reminder_delivery_claims.delivery_started_at IS
  'Commit-before-send-grense. En rad med verdi her er aldri automatisk claimbar igjen.';

COMMENT ON COLUMN casting_reminder_delivery_claims.delivery_uncertain_at IS
  'Provider kan ha akseptert meldingen, men utfallet kunne ikke bekreftes. Krever manuell avklaring.';

COMMIT;
