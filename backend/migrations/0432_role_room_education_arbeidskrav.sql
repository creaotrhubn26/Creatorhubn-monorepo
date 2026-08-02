-- 0432_role_room_education_arbeidskrav.sql
--
-- Studieplan-forankring: arbeidskrav + vurderingsform på oppgaver.
--
--  is_arbeidskrav = obligatorisk arbeid som må være GODKJENT (jf. norsk
--    UH/fagskole: arbeidskrav må godkjennes før man kan gå opp til eksamen).
--  vurderingsform = hvordan oppgaven vurderes:
--    'bestatt' (bestått / ikke bestått) | 'bokstav' (A–F) | 'mappe' (mappevurdering)
--    NULL = ikke satt / fri.

ALTER TABLE role_room_education_assignments
  ADD COLUMN IF NOT EXISTS is_arbeidskrav BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE role_room_education_assignments
  ADD COLUMN IF NOT EXISTS vurderingsform TEXT;
