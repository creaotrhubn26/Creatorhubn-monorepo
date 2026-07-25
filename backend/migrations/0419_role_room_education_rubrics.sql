-- 0419_role_room_education_rubrics.sql
-- Utdannings-workspace: RUBRIKKER (vurderingskriterier).
--
-- Løfter vurderingen fra fritekst-karakter til strukturerte kriterier knyttet
-- til læringsmålene. Fast 3-nivåskala per kriterium: 0=Ikke nådd, 1=Delvis,
-- 2=Nådd. Poengsummen informerer faglærerens karakter (som fortsatt settes
-- fritt). Owner-scopet.

CREATE TABLE IF NOT EXISTS role_room_education_rubric_criteria (
  id            TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES role_room_education_assignments(id) ON DELETE CASCADE,
  owner_user_id VARCHAR(255) NOT NULL,
  title         TEXT NOT NULL,
  learning_goal TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_education_rubric_criteria_assignment
  ON role_room_education_rubric_criteria (assignment_id, sort_order, created_at);

-- Score per (kriterium, student). level 0..2.
CREATE TABLE IF NOT EXISTS role_room_education_rubric_scores (
  id            TEXT PRIMARY KEY,
  criterion_id  TEXT NOT NULL REFERENCES role_room_education_rubric_criteria(id) ON DELETE CASCADE,
  student_id    TEXT NOT NULL REFERENCES role_room_education_students(id) ON DELETE CASCADE,
  owner_user_id VARCHAR(255) NOT NULL,
  level         INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (criterion_id, student_id)
);

CREATE INDEX IF NOT EXISTS role_room_education_rubric_scores_student
  ON role_room_education_rubric_scores (student_id);
