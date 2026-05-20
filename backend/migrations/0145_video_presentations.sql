-- 0145 — Video-presentasjon-trening (Pro)
--
-- En "video_presentation_session" representerer ett opptak hvor
-- kandidaten svarer på en prompt (f.eks. "Fortell om deg selv på 60
-- sekunder"). Hvert opptak får AI-feedback basert på:
--   • Whisper-transkripsjon (taleflyt, fyllord, struktur)
--   • Keyframes fra video (engasjement, blikk, energi)
--   • Treff mot kompetansekrav fra koblet jobbsøknad
--
-- Lagring:
--   • Video lastes opp til R2 og signed-URL caches 24t
--   • Transkripsjon og feedback lagres permanent (etter sletting av video)

CREATE TABLE IF NOT EXISTS nextrole_video_presentations (
  id                    VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id               VARCHAR(255) NOT NULL,
  resume_id             VARCHAR(64) REFERENCES resumes(id) ON DELETE SET NULL,
  job_application_id    VARCHAR(64) REFERENCES job_applications(id) ON DELETE SET NULL,

  prompt_text           TEXT NOT NULL,
  prompt_kind           VARCHAR(64),               -- 'about_yourself', 'why_company', 'strength_weakness', 'custom', 'jd_specific'
  target_duration_sec   INT,

  -- Opptak-metadata (videofilen slettes via R2 lifecycle etter 24t)
  video_r2_key          VARCHAR(255),
  video_mime            VARCHAR(64),
  video_bytes           BIGINT,
  duration_ms           INT,

  -- AI-pipeline-resultater
  transcript            TEXT,
  transcript_lang       VARCHAR(8),

  -- competence_scores: { "key1": 8, "key2": 6 } per kompetansekrav
  competence_scores     JSONB,
  -- delivery_scores: { "speech_clarity": 0-10, "filler_words": int,
  --                    "energy": 0-10, "structure": 0-10, "eye_contact": 0-10 }
  delivery_scores       JSONB,
  overall_score         INT,                       -- 0-100

  feedback_summary      TEXT,
  strengths             TEXT[],
  improvement_areas     TEXT[],

  status                VARCHAR(32) DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  ),
  error_detail          TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nextrole_video_presentations_user_idx
  ON nextrole_video_presentations (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS nextrole_video_presentations_app_idx
  ON nextrole_video_presentations (job_application_id)
  WHERE job_application_id IS NOT NULL;
