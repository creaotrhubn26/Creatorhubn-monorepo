-- 0138 — Cover Letter Library
--
-- Hver AI-generert søknadsbrev lagres så brukeren kan:
--   • Gå tilbake og se tidligere brev
--   • Kopiere et tidligere brev til en ny søknad
--   • Eksportere bibliotek til CSV/PDF
--
-- Lenker til både resume og job_application hvor relevant.
-- Idempotent.

CREATE TABLE IF NOT EXISTS resume_cover_letters (
  id                  VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id             VARCHAR(255) NOT NULL,
  resume_id           VARCHAR(64) REFERENCES resumes(id) ON DELETE SET NULL,
  job_application_id  VARCHAR(64),

  -- Job-kontekst (kopiert inn så brevet kan vises uten å re-fetche)
  job_title           VARCHAR(255),
  company             VARCHAR(255),

  -- Selve brevet
  body                TEXT NOT NULL,
  language            VARCHAR(10) DEFAULT 'no',
  tone                VARCHAR(50) DEFAULT 'profesjonell',

  -- AI-metadata
  generated_by_ai     BOOLEAN DEFAULT TRUE,
  input_tokens        INT,
  output_tokens       INT,

  -- Bruker-redigering
  is_favorite         BOOLEAN DEFAULT FALSE,
  notes               TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS resume_cover_letters_user_id_idx ON resume_cover_letters (user_id);
CREATE INDEX IF NOT EXISTS resume_cover_letters_resume_id_idx ON resume_cover_letters (resume_id);
CREATE INDEX IF NOT EXISTS resume_cover_letters_created_at_idx ON resume_cover_letters (created_at DESC);
