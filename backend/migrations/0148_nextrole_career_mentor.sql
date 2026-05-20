-- 0148 — AI Karriere-veiviser med tone-kontroll
--
-- Datadrevet karrierementer-chat. Brukeren velger tone (brutal/
-- balansert/støttende) som styrer hele tilbakemeldingen.
--
-- Tabeller:
--   nextrole_user_prefs              — global feedback_tone-innstilling
--                                       (gjenbrukes av mock interview,
--                                       CV-feedback, søknadsbrev, etc.)
--   nextrole_career_mentor_sessions  — én rad per samtale
--   nextrole_career_mentor_messages  — chat-meldinger
--
-- En sesjon bygges typisk opp i en av tre former:
--   • discovery     — bruker har ikke CV, må finne retning
--   • match         — bruker har CV, vil ha konkrete stillingsforslag
--   • skills_gap    — bruker har drømmestilling, vil ha gap-analyse
--
-- AI-anbefalinger lagres som JSONB recommended_jobs så de kan
-- presenteres som "klikkbar liste" i frontend.

CREATE TABLE IF NOT EXISTS nextrole_user_prefs (
  user_id        VARCHAR(255) PRIMARY KEY,
  feedback_tone  VARCHAR(16) DEFAULT 'balanced' CHECK (
    feedback_tone IN ('brutal', 'balanced', 'supportive')
  ),
  -- Når tonen sist ble endret — brukes til "lære" når en tone funker
  tone_changed_at TIMESTAMPTZ,
  -- Andre fremtidige preferanser kan flyte hit (notification, etc)
  prefs           JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nextrole_career_mentor_sessions (
  id              VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         VARCHAR(255) NOT NULL,
  resume_id       VARCHAR(64) REFERENCES resumes(id) ON DELETE SET NULL,

  title           VARCHAR(255),                   -- AI-genererer kort tittel
  kind            VARCHAR(32) DEFAULT 'discovery' CHECK (
    kind IN ('discovery', 'match', 'skills_gap', 'reflection')
  ),

  -- Snapshot av tonen som ble brukt — kan endres underveis
  tone_at_start   VARCHAR(16),
  tone_changes    JSONB DEFAULT '[]'::jsonb,       -- [{at, from, to}]

  -- AI-anbefalte yrker som har dukket opp i samtalen (JSONB-array)
  -- Format: [{styrk_code, label, match_score, median_nok, open_positions, why}]
  recommended_jobs JSONB DEFAULT '[]'::jsonb,

  status          VARCHAR(32) DEFAULT 'active' CHECK (
    status IN ('active', 'completed', 'abandoned')
  ),
  message_count   INT DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS career_mentor_sessions_user_idx
  ON nextrole_career_mentor_sessions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS nextrole_career_mentor_messages (
  id              BIGSERIAL PRIMARY KEY,
  session_id      VARCHAR(64) NOT NULL
                  REFERENCES nextrole_career_mentor_sessions(id) ON DELETE CASCADE,

  role            VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         TEXT NOT NULL,

  -- Hvis dette er en AI-melding: hvilken tone ble brukt
  tone_used       VARCHAR(16),

  -- Hvis AI-meldingen genererte konkrete jobb-forslag: lagres her
  jobs_in_message JSONB,

  tokens_input    INT,
  tokens_output   INT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS career_mentor_messages_session_idx
  ON nextrole_career_mentor_messages (session_id, created_at);
