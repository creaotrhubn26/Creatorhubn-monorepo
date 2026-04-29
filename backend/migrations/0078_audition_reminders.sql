-- 0078_audition_reminders.sql
-- Sporing av sendte audition-reminders for å unngå dobbel-sending.

ALTER TABLE casting_schedules
  ADD COLUMN IF NOT EXISTS reminders_sent JSONB NOT NULL DEFAULT '{}'::jsonb;

-- reminders_sent-format: { "24h": "2026-04-29T08:00:00Z", "1h": "2026-04-29T18:00:00Z" }
-- Cron-runner sjekker om aktuell key allerede finnes før send.

COMMENT ON COLUMN casting_schedules.reminders_sent IS
  'JSONB-objekt med "24h" og "1h"-keys. Verdi er ISO-timestamp da reminder ble sendt. Brukes av audition-reminder-cron for idempotens.';

CREATE INDEX IF NOT EXISTS casting_schedules_upcoming_idx
  ON casting_schedules(date, start_time)
  WHERE type = 'audition' AND status NOT IN ('canceled', 'completed');
