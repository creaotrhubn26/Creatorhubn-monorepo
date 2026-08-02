-- 0418_role_room_education_production_members.sql
-- Utdannings-workspace: SKOLE-STYRT RBAC — hvilke studenter er i hvilken
-- produksjon, og med hvilken rolle.
--
-- 🔑 I stedet for en bred «eier-eller-hvem-som-helst-medlem»-endring på
-- casting_projects (som ville truffet alle Role Room-vertikaler), bestemmer
-- FAGLÆREREN eksplisitt hvem som er i hver produksjon + rolle. Education-scopet
-- og trygt; gjør senere prosjekt-tilgangs-tildeling presis i stedet for blank.

CREATE TABLE IF NOT EXISTS role_room_education_production_members (
  id            TEXT PRIMARY KEY,
  production_id TEXT NOT NULL REFERENCES role_room_education_productions(id) ON DELETE CASCADE,
  student_id    TEXT NOT NULL REFERENCES role_room_education_students(id) ON DELETE CASCADE,
  owner_user_id VARCHAR(255) NOT NULL,
  role          TEXT NOT NULL DEFAULT 'contributor', -- viewer | contributor | lead
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (production_id, student_id)
);

CREATE INDEX IF NOT EXISTS role_room_education_production_members_production
  ON role_room_education_production_members (production_id);
CREATE INDEX IF NOT EXISTS role_room_education_production_members_student
  ON role_room_education_production_members (student_id);
