-- 0122_assistant_brief_notes.sql
-- Slice 9X.49 — Notater + AI-sammendrag av brief-møtet med assistent.
-- Transcript-URL kan limes manuelt fra Google Meet (Workspace har built-in
-- transcribing). Hvis ikke transcript: Claude summary'er bare notes-tekst.

ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS brief_notes TEXT;
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS brief_transcript_url TEXT;
-- Lenke til Google Drive-fil ("Meet recording for ...") eller manuell transcript
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS brief_summary TEXT;
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS brief_summary_action_items JSONB DEFAULT '[]'::jsonb;
-- AI-ekstraherte action-items: [{ owner: 'photographer'|'assistant', task, due? }]
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS brief_summarized_at TIMESTAMPTZ;
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS brief_summary_model TEXT;

COMMENT ON COLUMN wedding_assistants.brief_summary_action_items IS
  'AI-ekstraherte to-do-punkter med owner og evt. due-date. Vises som sjekkliste under hvert brief.';
