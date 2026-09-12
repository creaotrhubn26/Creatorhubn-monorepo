-- 0421_role_room_education_faculty.sql
-- Utdannings-workspace: FAKULTET & ROLLER.
--
-- Registrer institusjonens ansatte (lærere/veiledere) med rolle, og hvem som
-- veileder hvilket kull. Owner-scopet (institusjonens hovedbruker). Egen
-- innlogging for staff = senere skive; dette representerer strukturen.

CREATE TABLE IF NOT EXISTS role_room_education_faculty (
  id            TEXT PRIMARY KEY,
  owner_user_id VARCHAR(255) NOT NULL,
  name          TEXT NOT NULL,
  email         VARCHAR(255),
  role          TEXT NOT NULL DEFAULT 'teacher', -- lead | teacher | supervisor | guest
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_education_faculty_owner
  ON role_room_education_faculty (owner_user_id, created_at DESC);

-- Hvem veileder hvilket kull.
CREATE TABLE IF NOT EXISTS role_room_education_faculty_cohorts (
  id            TEXT PRIMARY KEY,
  faculty_id    TEXT NOT NULL REFERENCES role_room_education_faculty(id) ON DELETE CASCADE,
  cohort_id     TEXT NOT NULL REFERENCES role_room_education_cohorts(id) ON DELETE CASCADE,
  owner_user_id VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (faculty_id, cohort_id)
);

CREATE INDEX IF NOT EXISTS role_room_education_faculty_cohorts_faculty
  ON role_room_education_faculty_cohorts (faculty_id);
