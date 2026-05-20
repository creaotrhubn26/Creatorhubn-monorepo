-- 0135 — Versjon-historikk for CV-er
--
-- Brukeren kan eksplisitt klikke "Lagre versjon" som tar et fullt
-- snapshot av resume + alle sub-ressurser i én JSONB-kolonne.
-- Restore: en eksisterende versjon erstatter dagens innhold.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS resume_versions (
  id                VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  resume_id         VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  user_id           VARCHAR(255) NOT NULL,

  version_number    INT NOT NULL,
  label             VARCHAR(255),
  snapshot          JSONB NOT NULL,     -- full FullResume-struktur
  notes             TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS resume_versions_resume_id_idx ON resume_versions (resume_id);
CREATE INDEX IF NOT EXISTS resume_versions_created_at_idx ON resume_versions (created_at DESC);
