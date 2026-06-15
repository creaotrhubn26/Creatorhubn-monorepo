-- 280_member_mood.sql
--
-- Mood-/readiness-innsjekk per medlem (vokalist) på delingssiden. Bruker EaseVerse
-- sine mood-valg som innhold, men selve innsjekken skjer i CreatorHub (ingen
-- mobil-app-avhengighet). Produsenten ser hvordan hver er i form før opptak.

CREATE TABLE IF NOT EXISTS audio_member_mood (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES audio_review_projects(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  mood        TEXT NOT NULL,
  note        TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, member_name)
);
