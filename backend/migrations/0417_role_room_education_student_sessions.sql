-- 0417_role_room_education_student_sessions.sql
-- Student-innlogging steg 2b: ISOLERT studentsesjon.
--
-- 🔑 Bevisst SEPARAT fra creatorhub_auth_sessions: et student-token er KUN
-- gyldig mot education-student-endepunktene som slår opp i denne tabellen — det
-- gir null blast-radius mot hoved-auth (en student kan ikke røre noe annet i
-- appen). Token = crypto-tilfeldig; opprettes ved claim av en faglærer-
-- invitasjon (role_room_education_student_invites).

CREATE TABLE IF NOT EXISTS role_room_education_student_sessions (
  token         TEXT PRIMARY KEY,
  student_id    TEXT NOT NULL REFERENCES role_room_education_students(id) ON DELETE CASCADE,
  owner_user_id VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 days'
);

CREATE INDEX IF NOT EXISTS role_room_education_student_sessions_student
  ON role_room_education_student_sessions (student_id);
