-- 0420_role_room_education_censor.sql
-- Utdannings-workspace: EKSTERN SENSOR-TILGANG.
--
-- Faglærer inviterer en ekstern sensor til et kull (tidsbegrenset lenke).
-- Sensor logger inn via ISOLERT sesjon (samme mønster som studenter → null
-- blast-radius mot hoved-auth), ser kullets arbeid + faglærers vurdering, og
-- gir sin egen uavhengige vurdering. Norsk eksamenskrav.

CREATE TABLE IF NOT EXISTS role_room_education_censor_invites (
  id            TEXT PRIMARY KEY,
  owner_user_id VARCHAR(255) NOT NULL,
  cohort_id     TEXT NOT NULL REFERENCES role_room_education_cohorts(id) ON DELETE CASCADE,
  name          TEXT,
  email         VARCHAR(255),
  token         TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | revoked
  accepted_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '45 days',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_education_censor_invites_cohort
  ON role_room_education_censor_invites (cohort_id);

-- Isolert sensor-sesjon (jf. student-sesjoner). Token KUN gyldig mot
-- censor-endepunktene.
CREATE TABLE IF NOT EXISTS role_room_education_censor_sessions (
  token         TEXT PRIMARY KEY,
  invite_id     TEXT NOT NULL REFERENCES role_room_education_censor_invites(id) ON DELETE CASCADE,
  owner_user_id VARCHAR(255) NOT NULL,
  cohort_id     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL
);

-- Sensorens egen vurdering per (student, oppgave). Separat fra faglærers.
CREATE TABLE IF NOT EXISTS role_room_education_censor_grades (
  id            TEXT PRIMARY KEY,
  invite_id     TEXT NOT NULL REFERENCES role_room_education_censor_invites(id) ON DELETE CASCADE,
  student_id    TEXT NOT NULL REFERENCES role_room_education_students(id) ON DELETE CASCADE,
  assignment_id TEXT NOT NULL REFERENCES role_room_education_assignments(id) ON DELETE CASCADE,
  owner_user_id VARCHAR(255) NOT NULL,
  grade         VARCHAR(32),
  feedback      TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (invite_id, student_id, assignment_id)
);

CREATE INDEX IF NOT EXISTS role_room_education_censor_grades_invite
  ON role_room_education_censor_grades (invite_id);
