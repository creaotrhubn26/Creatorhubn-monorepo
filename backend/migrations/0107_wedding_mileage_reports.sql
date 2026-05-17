-- 0107_wedding_mileage_reports.sql
-- Per-bryllup auto-generert kjøregodtgjørelse-rapport.
-- Inngangen er wedding-timeline: alle events med location → rute → km + bom.
-- Stine får en kopier-knapp som limer formatert tekst i regnskapssystemet.
--
-- Rapportene cache-lagres for revisjons-formål; ny generering oppdaterer
-- raden (én rad per bryllup per fotograf).

CREATE TABLE IF NOT EXISTS wedding_mileage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id UUID NOT NULL,
  photographer_id TEXT NOT NULL,
  vehicle_id UUID,
  destinations JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{seq, address, eventId, eventTitle, scheduledAt}]
  legs JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{from, to, distanceKm, tollKr}]
  total_km NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_toll_kr NUMERIC(10,2) NOT NULL DEFAULT 0,
  km_rate NUMERIC(10,2) NOT NULL DEFAULT 3.50,
  total_mileage_kr NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- total_km * km_rate (uten bom)
  total_payout_kr NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- total_mileage_kr + total_toll_kr
  fuel_type TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  exported_at TIMESTAMPTZ,
  -- når Stine sist kopierte til utklippstavlen
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wedding_mileage_unique
  ON wedding_mileage_reports (wedding_id, photographer_id);
CREATE INDEX IF NOT EXISTS idx_wedding_mileage_photographer
  ON wedding_mileage_reports (photographer_id, generated_at DESC);

COMMENT ON COLUMN wedding_mileage_reports.exported_at IS
  'Tidspunkt Stine sist kopierte rapporten til regnskap. NULL = ikke eksportert ennå.';
