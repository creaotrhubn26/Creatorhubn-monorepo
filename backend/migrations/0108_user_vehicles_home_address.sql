-- 0108_user_vehicles_home_address.sql
-- Stine lagrer hjemme-/studio-adressen sin på bil-profilen. Brukes som
-- default start- og returpunkt i kjøregodtgjørelse-beregning, så hun
-- slipper å skrive den inn hver gang.

ALTER TABLE user_vehicles
  ADD COLUMN IF NOT EXISTS home_address TEXT;

COMMENT ON COLUMN user_vehicles.home_address IS
  'Default startadresse (hjem/studio). Auto-prepend i mileage-beregning.';
