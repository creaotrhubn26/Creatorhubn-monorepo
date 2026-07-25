-- 0416_role_room_education_student_invites.sql
-- Utdannings-workspace: STUDENTINVITASJONER (første brikke i student-innlogging).
--
-- Faglærer klargjør studenttilgang per student — genererer et engangs-token og
-- sporer status (klargjort → aktivert → trukket tilbake). Owner-scopet.
--
-- NB: DETTE er kun faglærer-siden (invitasjonsmodell + status). Selve
-- innloggingen (claim → isolert studentsesjon) og student-flaten kommer i egen
-- skive; kjerne-tilgangsendringen (eier ELLER medlem i casting_user_roles) som
-- skal til for at studenter kan JOBBE i produksjonen, er en egen beslutning
-- fordi den treffer alle Role Room-vertikaler.

CREATE TABLE IF NOT EXISTS role_room_education_student_invites (
  id            TEXT PRIMARY KEY,
  owner_user_id VARCHAR(255) NOT NULL,
  student_id    TEXT NOT NULL REFERENCES role_room_education_students(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | revoked
  email         VARCHAR(255),
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id)
);

CREATE INDEX IF NOT EXISTS role_room_education_student_invites_owner
  ON role_room_education_student_invites (owner_user_id);
