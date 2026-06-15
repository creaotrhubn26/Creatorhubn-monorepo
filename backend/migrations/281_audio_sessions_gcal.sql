-- 281_audio_sessions_gcal.sql
--
-- Google Calendar toveis-synk for økter: lagre Google-event-id slik at push blir
-- idempotent (oppdaterer i stedet for å duplisere), og slik at vi kan hente
-- endringer tilbake (toveis) — tid/sted/tittel endret i Google reflekteres i økta,
-- og slettet i Google nullstiller koblingen.

ALTER TABLE audio_sessions ADD COLUMN IF NOT EXISTS gcal_event_id   TEXT;
ALTER TABLE audio_sessions ADD COLUMN IF NOT EXISTS gcal_html_link  TEXT;
ALTER TABLE audio_sessions ADD COLUMN IF NOT EXISTS gcal_synced_at  TIMESTAMPTZ;
