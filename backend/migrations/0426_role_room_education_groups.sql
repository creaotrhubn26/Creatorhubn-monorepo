-- 0426_role_room_education_groups.sql
--
-- Grupper i et kull (utdannings-workspace). En gruppe tilhører ETT kull; en
-- student kan være i én gruppe innen kullet (matcher UI-ens «Gruppe»-kolonne).
-- Owner-scopet: owner_user_id denormalisert som ellers i education_*-tabellene.
--
-- students.group_id peker til gruppen (SET NULL ved sletting av gruppen, så
-- studenten bare blir «uten gruppe» — aldri slettet).

CREATE TABLE IF NOT EXISTS role_room_education_groups (
  id             TEXT PRIMARY KEY,
  cohort_id      TEXT NOT NULL REFERENCES role_room_education_cohorts(id) ON DELETE CASCADE,
  owner_user_id  VARCHAR(255) NOT NULL,
  name           TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_education_groups_cohort_idx
  ON role_room_education_groups (cohort_id);
CREATE INDEX IF NOT EXISTS role_room_education_groups_owner_idx
  ON role_room_education_groups (owner_user_id);

-- Lat selv-heler: legg til group_id på studenter hvis den ikke finnes.
ALTER TABLE role_room_education_students
  ADD COLUMN IF NOT EXISTS group_id TEXT
  REFERENCES role_room_education_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS role_room_education_students_group_idx
  ON role_room_education_students (group_id);
