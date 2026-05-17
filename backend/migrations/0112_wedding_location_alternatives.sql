-- 0112_wedding_location_alternatives.sql
-- Plan-B-lokasjoner for værsensitive uteseremonier (Slice 9X.37).
--
-- Konsept: brudeparet markerer en location som "værsensitiv" (utendørs
-- seremoni, strand-shoot, hageparty), og legger til én eller flere
-- alternativer (innendørs sal, lokalets bibliotek, paviljong med tak).
-- Når yr.no melder regn dagen før, kan Stine eller brudeparet
-- "Aktiver plan B" → alle timeline-events knyttet til primary flyttes
-- automatisk til alternativen, og varsel går ut.

ALTER TABLE wedding_locations
  ADD COLUMN IF NOT EXISTS alternative_for_location_id UUID;
  -- NULL for primær. UUID for alternativer som peker tilbake.
ALTER TABLE wedding_locations
  ADD COLUMN IF NOT EXISTS is_indoor BOOLEAN;
ALTER TABLE wedding_locations
  ADD COLUMN IF NOT EXISTS weather_dependent BOOLEAN DEFAULT FALSE;
  -- TRUE = utendørs/værsensitiv, krever plan B ved regn
ALTER TABLE wedding_locations
  ADD COLUMN IF NOT EXISTS activation_status TEXT DEFAULT 'standby';
  -- 'standby' = ikke i bruk (default for alle alternativer)
  -- 'active' = "denne er aktivert som faktisk brukes" (typisk plan B etter aktivering)
  -- 'used' = brukt under selve bryllupet (settes når Stine markerer dagen ferdig)
ALTER TABLE wedding_locations
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
ALTER TABLE wedding_locations
  ADD COLUMN IF NOT EXISTS activated_by TEXT;
  -- 'photographer' | 'couple' — hvem som trigget plan-B

CREATE INDEX IF NOT EXISTS idx_wedding_locations_alternative_for
  ON wedding_locations (alternative_for_location_id)
  WHERE alternative_for_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wedding_locations_wedding
  ON wedding_locations (wedding_id);

COMMENT ON COLUMN wedding_locations.weather_dependent IS
  'TRUE: utendørs seremoni/shoot. Walkthrough flagger som kritisk ved regn-risiko hvis ingen alternativ finnes.';
COMMENT ON COLUMN wedding_locations.alternative_for_location_id IS
  'Self-FK til primary location. NULL = denne er primær. UUID = denne er plan-B for spesifisert primary.';
COMMENT ON COLUMN wedding_locations.activation_status IS
  'standby = ikke i bruk. active = aktivert (typisk plan B). used = brukt på bryllupsdagen.';
