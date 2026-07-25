-- 0415_role_room_education_assessment.sql
-- Utdannings-workspace, opplæringslag 4 (del 1): FORMATIV VURDERING.
-- Utvider innleveringene med faglærer-tilbakemelding + (valgfri) karakter.
--
-- 🔑 Role Room er IKKE en gradebook. De fleste film/TV-utdanningssteder har
-- allerede LMS (Canvas/itslearning/Moodle) for offisielle karakterer. Denne
-- vurderingen er FORMATIV og produksjonsnær (knyttet til det ekte arbeidet i
-- Role Room-prosjektet). Karakteren er fritekst (bestått/A-F/1-6 — hva skolen
-- enn bruker) og eksporteres til skolens system (CSV) — ikke en fasit her.

ALTER TABLE role_room_education_submissions
  ADD COLUMN IF NOT EXISTS feedback    TEXT,
  ADD COLUMN IF NOT EXISTS grade       VARCHAR(32),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
