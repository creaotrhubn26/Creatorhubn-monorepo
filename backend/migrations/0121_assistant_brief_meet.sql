-- 0121_assistant_brief_meet.sql
-- Brief-møte mellom hovedfotograf og assistent (Slice 9X.48).
-- Google Calendar-event med Meet-lenke som inviterer begge parter.

ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS brief_meeting_event_id TEXT;
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS brief_meeting_url TEXT;
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS brief_meeting_at TIMESTAMPTZ;
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS brief_meeting_duration_min INTEGER;

COMMENT ON COLUMN wedding_assistants.brief_meeting_event_id IS
  'Google Calendar eventId. Brukes til å oppdatere/slette event ved endringer.';
