-- 0150 — AI follow-up questions for video-presentasjon
--
-- Etter at bruker har levert en video, kan AI generere 2-3 oppfølgings-
-- spørsmål basert på hva de faktisk sa. Hver oppfølgning lagres som
-- en ny video-presentasjon-sesjon koblet til forelder-sesjonen.
--
-- follow_up_questions: AI-genererte spørsmål som [{question, why}]-array
-- parent_session_id: kobler oppfølgnings-sesjon til den originale

ALTER TABLE nextrole_video_presentations
  ADD COLUMN IF NOT EXISTS follow_up_questions JSONB,
  ADD COLUMN IF NOT EXISTS parent_session_id   VARCHAR(64)
    REFERENCES nextrole_video_presentations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS nextrole_video_presentations_parent_idx
  ON nextrole_video_presentations (parent_session_id)
  WHERE parent_session_id IS NOT NULL;
