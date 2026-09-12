-- Utdannings-workspace · kull + studenter (fase 2: kjerneverdi).
-- Et KULL (klasse/årskull) eies av utdanningsinstitusjonen (owner_user_id = den
-- innloggede institusjons-brukeren). Studenter tilhører ett kull. Student-
-- produksjoner (senere skive) knyttes til et kull.

CREATE TABLE IF NOT EXISTS role_room_education_cohorts (
  id              TEXT PRIMARY KEY,
  owner_user_id   VARCHAR(255) NOT NULL,           -- institusjonens bruker (eier)
  name            TEXT NOT NULL,                    -- «Film 1. år 2026»
  program         TEXT,                             -- studieprogram
  term            TEXT,                             -- «Høst 2026»
  archived        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS role_room_education_cohorts_owner_idx
  ON role_room_education_cohorts (owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS role_room_education_students (
  id              TEXT PRIMARY KEY,
  cohort_id       TEXT NOT NULL REFERENCES role_room_education_cohorts(id) ON DELETE CASCADE,
  owner_user_id   VARCHAR(255) NOT NULL,           -- denormalisert for scope-sjekk
  name            TEXT NOT NULL,
  email           VARCHAR(255),
  student_number  VARCHAR(64),
  status          TEXT NOT NULL DEFAULT 'active',   -- active | inactive
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS role_room_education_students_cohort_idx
  ON role_room_education_students (cohort_id);
