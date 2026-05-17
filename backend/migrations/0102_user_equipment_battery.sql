-- 0102_user_equipment_battery.sql
-- Stine sin batteri-inventar per kamera-body. Brukes av batteri-kalkulator
-- på wedding-timeline-events for å estimere hvor mange shots hun kan ta
-- før batterier går tom.
--
-- battery_count = antall batterier hun eier for DETTE kameraet (default 1
-- = bare kameraets eget batteri som fulgte med).
-- has_battery_grip = om hun bruker batterigrep (dobler typisk kapasitet).

ALTER TABLE user_equipment
  ADD COLUMN IF NOT EXISTS battery_count INTEGER DEFAULT 1;

ALTER TABLE user_equipment
  ADD COLUMN IF NOT EXISTS has_battery_grip BOOLEAN DEFAULT FALSE;

ALTER TABLE user_equipment
  ADD COLUMN IF NOT EXISTS battery_model VARCHAR(64);

COMMENT ON COLUMN user_equipment.battery_count IS
  'Antall batterier brukeren eier for dette utstyret. Default 1 (kameraets eget).';
COMMENT ON COLUMN user_equipment.has_battery_grip IS
  'Bruker brukeren batterigrep på dette kameraet? Doubler ofte shot-kapasitet.';
COMMENT ON COLUMN user_equipment.battery_model IS
  'Batteri-modell (f.eks. LP-E6NH). Auto-fylt fra equipment-catalog ved opprettelse.';
