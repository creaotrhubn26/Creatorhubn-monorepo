-- 0079_casting_candidate_reminder_prefs.sql
-- Per-kandidat opt-in/opt-out for audition-reminders.
--
-- Default er alle på fordi audition-reminders er en transaksjonell melding
-- (kandidaten har allerede samtykket til auditionen ved å akseptere). GDPR-OK
-- som transactional notification, men kandidaten må kunne slå av i TalentPortal.

ALTER TABLE casting_candidates
  ADD COLUMN IF NOT EXISTS reminder_prefs JSONB NOT NULL
    DEFAULT '{"sms24h":true,"sms1h":true,"email24h":true,"email1h":true}'::jsonb;

COMMENT ON COLUMN casting_candidates.reminder_prefs IS
  'Per-kanal opt-in for audition-reminders. Keys: sms24h, sms1h, email24h, email1h. Default alle true (transaksjonell melding). Kandidat slår av via TalentPortal.';
