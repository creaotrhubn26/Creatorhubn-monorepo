-- 0106_photographer_vehicle.sql
-- Stines registrerte bil. Lagres ÉN gang i settings (skiltnummer),
-- og caches sammen med Vegvesen-oppslag (drivstoff, modell, EV-flag)
-- slik at kjøregodtgjørelse automatisk vet riktig sats per kjøretur.
--
-- 2026-satser (Skatteetaten):
--   - Skattefri sats: 3.50 kr/km (alle biler)
--   - El-bil: 3.50 kr/km (likt — endringen fra 2022 om særskilt EV-tillegg
--     er borte i statens reisegodtgjørelse, men noen virksomheter har det)
--   - Passasjertillegg: 1.00 kr/km/passasjer

CREATE TABLE IF NOT EXISTS user_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  license_plate TEXT NOT NULL,
  make TEXT,
  model TEXT,
  year INTEGER,
  fuel_type TEXT,
  -- 'electric' | 'petrol' | 'diesel' | 'hybrid' | 'plugin_hybrid' | 'hydrogen' | 'unknown'
  is_primary BOOLEAN DEFAULT TRUE,
  vegvesen_raw JSONB,
  vegvesen_fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_vehicles_user_id
  ON user_vehicles (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_vehicles_user_plate
  ON user_vehicles (user_id, license_plate);

COMMENT ON COLUMN user_vehicles.fuel_type IS
  'Normalisert drivstoff fra Vegvesen-oppslag. Brukes til bom-sats + EV-flagg.';
COMMENT ON COLUMN user_vehicles.is_primary IS
  'Stine har én primær bil — brukes default i kjøregodtgjørelse-rapporter.';
