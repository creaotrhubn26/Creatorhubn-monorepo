-- 0109_photo_venues.sql
-- Foto-lokasjons-katalog (Slice 9X.34). Stine vet ikke alltid om en
-- lokasjon er åpen, om den koster penger, eller hvem hun skal kontakte
-- for tillatelse. Eksempel: Losby Gods → krever booking + fee.
--
-- Katalogen seedes med curated data for ~20 populære norske foto-spots,
-- og kan utvides via photo_venue_user_contributions (community-edits)
-- som godkjennes av admin før de merges inn.

CREATE TABLE IF NOT EXISTS photo_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  venue_type TEXT,
  -- 'castle' | 'mansion' | 'beach' | 'park' | 'urban' | 'church' |
  -- 'forest' | 'mountain' | 'lake' | 'historical' | 'other'
  address TEXT,
  city TEXT,
  postal_code TEXT,
  county TEXT,
  -- Norsk fylke: f.eks. 'Akershus', 'Oslo', 'Vestland'
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),

  -- Kontakt
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website_url TEXT,
  booking_url TEXT,

  -- Pris (NULL = ukjent)
  requires_booking BOOLEAN DEFAULT FALSE,
  requires_permit BOOLEAN DEFAULT FALSE,
  fee_kr NUMERIC(10,2),
  fee_unit TEXT,
  -- 'free' | 'per_hour' | 'per_session' | 'per_day' | 'on_request'

  -- Åpningstider (JSON: {mon: ['09:00-22:00'], tue: [...], ...})
  opening_hours JSONB,
  -- Generelle merknader
  restrictions_text TEXT,
  -- F.eks. "Ikke tillatt med drone", "Stativ ikke tillatt i hovedhus"
  photographer_notes TEXT,
  -- Indre praktiske tips fra Creatorhubn-community

  -- Verifisering
  last_verified_at TIMESTAMPTZ,
  verified_by TEXT,
  source_url TEXT,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photo_venues_city
  ON photo_venues (city) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_photo_venues_county
  ON photo_venues (county) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_photo_venues_name_trgm
  ON photo_venues USING gin (name gin_trgm_ops);
CREATE EXTENSION IF NOT EXISTS pg_trgm;

COMMENT ON COLUMN photo_venues.fee_unit IS
  'Hvordan fee_kr skal tolkes. on_request = må kontakte for prisavtale.';
COMMENT ON COLUMN photo_venues.opening_hours IS
  'JSON med ukedager (mon-sun) → array av tidsspenn "HH:MM-HH:MM".';
