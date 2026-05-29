-- Migrasjon 183: casting_acts
--
-- Tabell for manuskript-akter (3-akts-struktur eller fritt antall).
-- En akt grupperer scener inn i den klassiske dramaturgiske strukturen
-- (setup / konfrontasjon / oppløsning), og brukes av Story Logic /
-- Story Writer for å vise hvordan scener fordeler seg over hovedbuene.
--
-- TROLL-demo og fremtidige seed-flows skriver hit direkte i stedet for
-- å lagre acts kun i compat-store-blobs.

CREATE TABLE IF NOT EXISTS casting_acts (
  id                 VARCHAR(255) PRIMARY KEY,
  project_id         VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  manuscript_id      VARCHAR(255) NOT NULL REFERENCES casting_manuscripts(id) ON DELETE CASCADE,
  act_number         INTEGER NOT NULL,
  title              VARCHAR(255) NOT NULL,
  description        TEXT,
  start_scene_number INTEGER,
  end_scene_number   INTEGER,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS casting_acts_project_id_idx
  ON casting_acts(project_id);

CREATE INDEX IF NOT EXISTS casting_acts_manuscript_id_idx
  ON casting_acts(manuscript_id);

CREATE UNIQUE INDEX IF NOT EXISTS casting_acts_manuscript_act_number_idx
  ON casting_acts(manuscript_id, act_number);
