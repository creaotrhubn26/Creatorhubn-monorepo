-- 279_session_reminders.sql
--
-- Påminnelse-flagg på økter (Fase 2): 24t- og 1t-påminnelser sendes én gang
-- via cron (e-post + valgfri SMS). Flaggene hindrer dupliserte varsler.

ALTER TABLE audio_sessions ADD COLUMN IF NOT EXISTS reminded_24h BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE audio_sessions ADD COLUMN IF NOT EXISTS reminded_1h  BOOLEAN NOT NULL DEFAULT FALSE;
