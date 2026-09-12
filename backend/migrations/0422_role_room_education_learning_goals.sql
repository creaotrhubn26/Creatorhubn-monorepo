-- 0422_role_room_education_learning_goals.sql
-- Utdannings-workspace: LÆRINGSMÅL som førsteklasses enheter + kobling.
--
-- Gjør at rubrikk-kriterier kan LENKE til et konkret læringsmål, slik at både
-- faglærer og sensor kan se MÅLOPPNÅELSE per læringsmål (aggregert på tvers av
-- kriterier og studenter). Katalog per kull. Owner-scopet.

CREATE TABLE IF NOT EXISTS role_room_education_learning_goals (
  id            TEXT PRIMARY KEY,
  owner_user_id VARCHAR(255) NOT NULL,
  cohort_id     TEXT NOT NULL REFERENCES role_room_education_cohorts(id) ON DELETE CASCADE,
  code          TEXT,           -- f.eks. «LM1»
  title         TEXT NOT NULL,
  description   TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_education_learning_goals_cohort
  ON role_room_education_learning_goals (cohort_id, sort_order, created_at);

-- Rubrikk-kriterium kan lenke til et læringsmål (behold også fritekst-feltet).
ALTER TABLE role_room_education_rubric_criteria
  ADD COLUMN IF NOT EXISTS learning_goal_id TEXT
    REFERENCES role_room_education_learning_goals(id) ON DELETE SET NULL;
