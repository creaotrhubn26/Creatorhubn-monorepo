-- 0144 — Utvider interview_sessions + interview_messages for voice/video/case
--
-- mode-kolonne på sessions:
--   'qa_text'             — eksisterende: ren tekst-Q&A (default)
--   'qa_voice'            — Whisper-transkripsjon av brukerens svar
--   'video_presentation'  — webcam-recording m/ Whisper + keyframe-vision
--   'case'                — case-intervju (Claude som intervjuer)
--
-- audio_url/video_url på messages:
--   R2-presigned URL til opptaket (24t TTL). Brukes til playback i
--   chat-UI. Den lagrede transkripsjonen blir værende selv om URL-en
--   utløper, så historikk forblir lesbart.

ALTER TABLE interview_sessions
  ADD COLUMN IF NOT EXISTS mode VARCHAR(32) DEFAULT 'qa_text',
  -- competence_requirements: AI-ekstraherte kompetansekrav fra JD-en
  -- som array av { key, label, why } objekter. Vises som checklist i
  -- frontend og brukes som scoring-kriterier i AI-feedback.
  ADD COLUMN IF NOT EXISTS competence_requirements JSONB,
  -- per-competence-score (akkumulert fra hvert svar)
  ADD COLUMN IF NOT EXISTS competence_scores JSONB;

ALTER TABLE interview_sessions
  DROP CONSTRAINT IF EXISTS interview_sessions_mode_chk;
ALTER TABLE interview_sessions
  ADD CONSTRAINT interview_sessions_mode_chk CHECK (
    mode IN ('qa_text','qa_voice','video_presentation','case')
  );

ALTER TABLE interview_messages
  ADD COLUMN IF NOT EXISTS audio_url       TEXT,
  ADD COLUMN IF NOT EXISTS audio_r2_key    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS video_url       TEXT,
  ADD COLUMN IF NOT EXISTS video_r2_key    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS duration_ms     INT,
  ADD COLUMN IF NOT EXISTS transcript_lang VARCHAR(8);

CREATE INDEX IF NOT EXISTS interview_sessions_mode_idx
  ON interview_sessions (mode);
