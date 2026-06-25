-- =====================================================================
-- 319_leadgrid_meeting_notes_webhook.sql
--
-- Robusthet-bundle 2 — async meeting-notes:
-- Registrer ny webhook-event `meeting_note.processed` slik at
-- subscribers (iPad CaptureApp, eksterne CRM-er) kan motta callback
-- når Whisper + Claude er ferdig med bakgrunns-prosessering.
-- =====================================================================

BEGIN;

INSERT INTO webhook_event_types (event_key, description)
VALUES (
  'meeting_note.processed',
  'AI meeting note transcribed and analyzed (async). Payload: { meeting_note_id, lead_id }.'
)
ON CONFLICT (event_key) DO NOTHING;

COMMIT;
