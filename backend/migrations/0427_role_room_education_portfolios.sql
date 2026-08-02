-- 0427_role_room_education_portfolios.sql
--
-- Studentporteføljer (utdannings-workspace): showreels + eksamensmapper.
-- Én rad = ett porteføljeelement knyttet til en student (en student kan ha
-- både showreel og eksamensmappe). Owner-scopet som resten av education_*.

CREATE TABLE IF NOT EXISTS role_room_education_portfolios (
  id             TEXT PRIMARY KEY,
  student_id     TEXT NOT NULL REFERENCES role_room_education_students(id) ON DELETE CASCADE,
  owner_user_id  VARCHAR(255) NOT NULL,
  kind           TEXT NOT NULL DEFAULT 'showreel',   -- showreel | exam
  status         TEXT NOT NULL DEFAULT 'draft',       -- draft | published
  title          TEXT,
  url            TEXT,
  published_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_education_portfolios_student_idx
  ON role_room_education_portfolios (student_id);
CREATE INDEX IF NOT EXISTS role_room_education_portfolios_owner_idx
  ON role_room_education_portfolios (owner_user_id);
