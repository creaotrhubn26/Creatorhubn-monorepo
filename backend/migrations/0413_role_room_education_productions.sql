-- 0413_role_room_education_productions.sql
-- Utdannings-workspace: STUDENTPRODUKSJONER + oppgave↔produksjon-kobling.
--
-- Kjernen i utdannings-visjonen: en studentproduksjon ER et ekte Role Room-
-- prosjekt (casting_projects), ikke en parallell greie. Denne tabellen er kun
-- en KOBLING mellom et kull og det ekte prosjektet (project_id = casting_projects.id),
-- pluss en tittel for oversikten. Studentene gjør det faktiske arbeidet
-- (story-arc, casting, call-sheet, leveranser) inne i Role Room-prosjektet.
--
-- NB: project_id er bevisst IKKE en FK til casting_projects — den tabellen bor i
-- drizzle-skjemaet (role-room-schema.ts), ikke i de nummererte SQL-migrasjonene,
-- så en cross-FK kan bryte migrasjons-rekkefølgen. Eierskap håndheves i ruten.

CREATE TABLE IF NOT EXISTS role_room_education_productions (
  id            TEXT PRIMARY KEY,
  owner_user_id VARCHAR(255) NOT NULL,
  cohort_id     TEXT REFERENCES role_room_education_cohorts(id) ON DELETE SET NULL,
  project_id    VARCHAR(255) NOT NULL, -- ekte casting_projects.id
  title         TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_education_productions_owner
  ON role_room_education_productions (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS role_room_education_productions_cohort
  ON role_room_education_productions (cohort_id);

-- En oppgave kan leveres i en konkret studentproduksjon (= ekte Role Room-arbeid).
ALTER TABLE role_room_education_assignments
  ADD COLUMN IF NOT EXISTS production_id TEXT
    REFERENCES role_room_education_productions(id) ON DELETE SET NULL;
