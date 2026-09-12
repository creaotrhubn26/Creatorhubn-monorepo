-- 0433_role_room_education_courses.sql
--
-- Emne-lag (studieplan-forankring). Et EMNE = en studiepoenggivende enhet med
-- egen sluttvurdering (jf. emnebeskrivelse). Holder emnekode, studiepoeng,
-- semester, vurderingsform og LÆRINGSUTBYTTE strukturert etter NKR:
-- Kunnskap / Ferdigheter / Generell kompetanse. Oppgaver/arbeidskrav henger på
-- et emne (assignments.course_id) — mange oppgaver : ett emne.

CREATE TABLE IF NOT EXISTS role_room_education_courses (
  id                TEXT PRIMARY KEY,
  owner_user_id     VARCHAR(255) NOT NULL,
  cohort_id         TEXT REFERENCES role_room_education_cohorts(id) ON DELETE SET NULL,
  code              TEXT,                         -- emnekode, f.eks. MED101
  title             TEXT NOT NULL,
  credits           NUMERIC(6,1),                 -- studiepoeng (tillater 7.5/15/30)
  term              TEXT,
  vurderingsform    TEXT,                          -- bestatt | bokstav | mappe
  -- læringsutbytte: {"knowledge":[],"skills":[],"generalCompetence":[]}
  learning_outcomes JSONB NOT NULL DEFAULT '{"knowledge":[],"skills":[],"generalCompetence":[]}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_education_courses_owner_idx
  ON role_room_education_courses (owner_user_id);
CREATE INDEX IF NOT EXISTS role_room_education_courses_cohort_idx
  ON role_room_education_courses (cohort_id);

-- Oppgave → emne.
ALTER TABLE role_room_education_assignments
  ADD COLUMN IF NOT EXISTS course_id TEXT
  REFERENCES role_room_education_courses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS role_room_education_assignments_course_idx
  ON role_room_education_assignments (course_id);
