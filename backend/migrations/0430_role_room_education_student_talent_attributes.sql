-- 0430_role_room_education_student_talent_attributes.sql
--
-- Casting-relevante attributter på en utdannings-student (spillealder, kjønn,
-- by, høyde, ferdigheter, språk, dialekter, NSF-medlemskap). Kilden er
-- redigerbar i utdannings-workspacet; ved promotering/synk projiseres de til
-- talents-tabellens søkbare kolonner (playing_age_*, skills, languages, …) så
-- den promoterte profilen faktisk dukker opp i casting-søk (agency-search).
--
-- Form: { playingAgeMin, playingAgeMax, gender, city, heightCm,
--         skills: string[], languages: string[], dialects: string[],
--         nsfMember: bool }

ALTER TABLE role_room_education_students
  ADD COLUMN IF NOT EXISTS talent_attributes JSONB NOT NULL DEFAULT '{}'::jsonb;
