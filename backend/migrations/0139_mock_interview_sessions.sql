-- 0139 — AI Mock Interview-sesjoner
--
-- Brukere kan starte chat-baserte intervjutreninger basert på CV-en
-- sin og en stillingsannonse. Hver sesjon består av:
--   • interview_session (en rad per intervju)
--   • interview_messages (hver Q og hvert A med eventuelle AI-feedback)
--
-- Pro-feature — gated via NextRole entitlement.

CREATE TABLE IF NOT EXISTS interview_sessions (
  id                  VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id             VARCHAR(255) NOT NULL,
  resume_id           VARCHAR(64) REFERENCES resumes(id) ON DELETE SET NULL,
  job_application_id  VARCHAR(64),

  job_title           VARCHAR(255),
  company             VARCHAR(255),
  job_description     TEXT,

  -- Tilstand
  status              VARCHAR(32) DEFAULT 'in_progress',  -- in_progress, completed, abandoned
  current_question_idx INT DEFAULT 0,
  total_questions     INT DEFAULT 8,

  -- Aggregert AI-feedback ved fullført sesjon
  overall_score       INT,                                 -- 0-100
  overall_feedback    TEXT,
  strengths           TEXT[],
  improvement_areas   TEXT[],

  language            VARCHAR(10) DEFAULT 'no',

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT interview_sessions_status_chk CHECK (
    status IN ('in_progress','completed','abandoned')
  )
);
CREATE INDEX IF NOT EXISTS interview_sessions_user_id_idx ON interview_sessions (user_id);
CREATE INDEX IF NOT EXISTS interview_sessions_resume_id_idx ON interview_sessions (resume_id);

CREATE TABLE IF NOT EXISTS interview_messages (
  id              VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id      VARCHAR(64) NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,

  -- 'question' (AI), 'answer' (bruker), 'feedback' (AI på bruker-svar)
  role            VARCHAR(32) NOT NULL,
  category        VARCHAR(32),                              -- 'behavioral'|'technical'|'competence'|'situational'
  content         TEXT NOT NULL,

  -- Hvis dette er en feedback-melding: knytt til hvilken Q+A den feedback-er
  question_idx    INT,
  feedback_score  INT,                                      -- 0-10 for én Q

  tokens_input    INT,
  tokens_output   INT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT interview_messages_role_chk CHECK (
    role IN ('question','answer','feedback')
  )
);
CREATE INDEX IF NOT EXISTS interview_messages_session_id_idx ON interview_messages (session_id);
