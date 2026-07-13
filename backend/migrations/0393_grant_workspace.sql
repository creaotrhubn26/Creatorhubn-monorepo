-- 0393_grant_workspace.sql
-- Søknads-arbeidsboken: søknaden som førsteklasses objekt med seksjons-
-- livssyklus og fremdrift — ikke flyktige API-svar.

CREATE TABLE IF NOT EXISTS grant_applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  solution        VARCHAR(20) NOT NULL CHECK (solution IN ('leadgrid','theroleroom','creatorhub')),
  program         VARCHAR(60) NOT NULL,     -- 'Oppstartstilskudd 1' ...
  title           TEXT NOT NULL,
  status          VARCHAR(16) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','submitted','archived')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grant_applications_org
  ON grant_applications (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS grant_application_sections (
  application_id  UUID NOT NULL REFERENCES grant_applications(id) ON DELETE CASCADE,
  section_key     VARCHAR(30) NOT NULL,
  draft_text      TEXT,
  user_notes      TEXT,
  status          VARCHAR(12) NOT NULL DEFAULT 'empty'
                  CHECK (status IN ('empty','drafted','review','done')),
  -- [FYLL INN: ...]-hull ekstrahert fra utkastet — søknaden er ferdig
  -- når listen er tom, ikke når teksten SER ferdig ut.
  fill_ins        JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (application_id, section_key)
);
