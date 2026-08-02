-- 0429_role_room_education_student_talent_link.sql
--
-- Avgangs-pipeline: kobler en utdannings-student til en Role Room Talents-profil
-- (talent registry). Skolen kan «promotere» en avgangsstudent → en CLAIMABLE
-- talent-profil (owner_user_id NULL) som studenten senere overtar. Lenken gir
-- én identitet (ingen duplikat) + lar oss re-synke showreel og status.
--
-- Ingen endring på talents-tabellen: verifisert studie-credential lagres i
-- talents.badges (['education_verified']) + talents.metadata.education.

ALTER TABLE role_room_education_students
  ADD COLUMN IF NOT EXISTS talent_id UUID
  REFERENCES talents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS role_room_education_students_talent_idx
  ON role_room_education_students (talent_id);
