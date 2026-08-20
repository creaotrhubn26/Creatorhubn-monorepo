-- 0447: Flerdagers-turplanlegging for "Dagsrute" (2026-08-19)
--
-- "Dagsrute" (lead_routes) var kun én dag om gangen — en selger som
-- reiser flere dager i strekk (f.eks. en uke i Nord-Norge) måtte
-- re-planlegge manuelt hver morgen. lead_route_trips er en tynn
-- parent-entitet som grupperer flere eksisterende lead_routes-rader
-- (én per dag, uendret modell/logikk) under én tur.

CREATE TABLE IF NOT EXISTS lead_route_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(120) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_route_trips_user
  ON lead_route_trips (user_id, start_date DESC);

ALTER TABLE lead_routes ADD COLUMN IF NOT EXISTS trip_id UUID
  REFERENCES lead_route_trips(id) ON DELETE CASCADE;
ALTER TABLE lead_routes ADD COLUMN IF NOT EXISTS day_index INTEGER;

CREATE INDEX IF NOT EXISTS idx_lead_routes_trip
  ON lead_routes (trip_id, day_index);
