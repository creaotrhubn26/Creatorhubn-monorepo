-- =====================================================================
-- 315_leadgrid_territory_circle.sql
--
-- Utvider lead_territories (mig 314) med SIRKEL-grids: senterpunkt + radius.
-- En sirkel-grid er det eneste som kan håndheves som ekte OS-bakgrunns-
-- geofence på iOS (CLCircularRegion) — polygoner sjekkes on-device.
--
-- En grid kan dermed defineres som en kombinasjon av:
--   - polygon (geometry, mig 314), og/eller
--   - administrative enheter (municipalities/postal_codes, mig 314), og/eller
--   - sirkel (center_lat/center_lng/radius_m, denne migrasjonen).
-- Matching: en lead/posisjon er "innenfor" hvis NOEN av delene matcher.
--
-- Idempotent. Rediger aldri eksisterende migrasjoner.
-- =====================================================================

BEGIN;

ALTER TABLE lead_territories
  ADD COLUMN IF NOT EXISTS center_lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS center_lng NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS radius_m INTEGER;

-- Senter + radius må følges ad (begge satt eller begge null), og radius positiv.
ALTER TABLE lead_territories
  DROP CONSTRAINT IF EXISTS lead_territories_circle_complete;
ALTER TABLE lead_territories
  ADD CONSTRAINT lead_territories_circle_complete CHECK (
    (center_lat IS NULL AND center_lng IS NULL AND radius_m IS NULL)
    OR (center_lat IS NOT NULL AND center_lng IS NOT NULL AND radius_m IS NOT NULL AND radius_m > 0)
  );

-- Oppdater definisjons-kravet fra mig 314: en grid må ha minst polygon,
-- admin-enhet ELLER sirkel.
ALTER TABLE lead_territories
  DROP CONSTRAINT IF EXISTS lead_territories_has_definition;
ALTER TABLE lead_territories
  ADD CONSTRAINT lead_territories_has_definition CHECK (
    geometry IS NOT NULL
    OR array_length(municipalities, 1) IS NOT NULL
    OR array_length(postal_codes, 1) IS NOT NULL
    OR radius_m IS NOT NULL
  );

COMMIT;
