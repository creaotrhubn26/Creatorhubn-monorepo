-- 0412_role_room_education_assignments.sql
-- Utdannings-workspace, opplæringslag 2: OPPGAVELØPET.
-- Faglærer lager en oppgave (brief + læringsmål + frist) knyttet til et kull;
-- per-student innleverings-status gir det veiledede løpet brief → lever → vurdering.
-- Owner-scopet (owner_user_id = institusjons-brukeren), som kull/studenter.

CREATE TABLE IF NOT EXISTS role_room_education_assignments (
  id             TEXT PRIMARY KEY,
  owner_user_id  VARCHAR(255) NOT NULL,
  cohort_id      TEXT REFERENCES role_room_education_cohorts(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  brief          TEXT,
  learning_goals TEXT,
  due_at         TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'draft', -- draft | published | archived
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_education_assignments_owner
  ON role_room_education_assignments (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS role_room_education_assignments_cohort
  ON role_room_education_assignments (cohort_id);

-- Per-student innleverings-status for en oppgave. Faglærer-styrt (studenter har
-- ikke egne kontoer enda), men gir hele klassens progresjon per oppgave.
CREATE TABLE IF NOT EXISTS role_room_education_submissions (
  id             TEXT PRIMARY KEY,
  assignment_id  TEXT NOT NULL REFERENCES role_room_education_assignments(id) ON DELETE CASCADE,
  student_id     TEXT NOT NULL REFERENCES role_room_education_students(id) ON DELETE CASCADE,
  owner_user_id  VARCHAR(255) NOT NULL,
  status         TEXT NOT NULL DEFAULT 'not_started', -- not_started | submitted | reviewed
  note           TEXT,
  submitted_at   TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS role_room_education_submissions_assignment
  ON role_room_education_submissions (assignment_id);
