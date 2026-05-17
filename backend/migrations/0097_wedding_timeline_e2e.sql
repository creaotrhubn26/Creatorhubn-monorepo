-- 0097_wedding_timeline_e2e.sql
-- Setter opp wedding-timeline e2e for fotograf-flyt:
-- 1. Unique-index på clientAccessCode så kode-lookup er rask
-- 2. Auto-genererings-felt: invitedAt, completedAt, lastReminderSentAt
-- 3. GDPR-tracking: gdpr_consent_at, gdpr_delete_requested_at
-- 4. Photographer arrival-tid og kulturell metadata
-- 5. Wedding-locations-tabell (manglet helt)
-- 6. wedding_inspirations-tabell for klient-uploadede inspirasjons-bilder
-- 7. wedding_contacts-tabell (forenklet alternativ til wedding_persons,
--    spesifikk for fotograf-flyt — VIPs som fotograf må kjenne til)

-- 1. Ensure access code uniqueness for fast lookup
CREATE UNIQUE INDEX IF NOT EXISTS wedding_timelines_access_code_unique
  ON wedding_timelines (client_access_code)
  WHERE client_access_code IS NOT NULL;

-- 2. Lifecycle + GDPR
ALTER TABLE wedding_timelines
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
ALTER TABLE wedding_timelines
  ADD COLUMN IF NOT EXISTS first_opened_at TIMESTAMPTZ;
ALTER TABLE wedding_timelines
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE wedding_timelines
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE wedding_timelines
  ADD COLUMN IF NOT EXISTS gdpr_consent_at TIMESTAMPTZ;
ALTER TABLE wedding_timelines
  ADD COLUMN IF NOT EXISTS gdpr_delete_requested_at TIMESTAMPTZ;
ALTER TABLE wedding_timelines
  ADD COLUMN IF NOT EXISTS photographer_arrival TIMESTAMPTZ;
ALTER TABLE wedding_timelines
  ADD COLUMN IF NOT EXISTS showcase_url VARCHAR(500);

-- 3. Wedding locations (manglet helt)
CREATE TABLE IF NOT EXISTS wedding_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id VARCHAR(64) NOT NULL,
  label VARCHAR(255) NOT NULL,         -- "Kirken", "Festlokale"
  address TEXT,
  postal_code VARCHAR(16),
  city VARCHAR(128),
  arrival_time TIMESTAMPTZ,             -- når fotograf skal være der
  departure_time TIMESTAMPTZ,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  google_maps_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS wedding_locations_wedding_idx
  ON wedding_locations (wedding_id, sort_order);

-- 4. Wedding inspirations (klient-deler bilder/lenker)
CREATE TABLE IF NOT EXISTS wedding_inspirations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id VARCHAR(64) NOT NULL,
  image_url VARCHAR(1000),
  source_url VARCHAR(1000),             -- pinterest, instagram-link
  caption TEXT,
  uploaded_by_email VARCHAR(255),       -- bruden eller brudgommen
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS wedding_inspirations_wedding_idx
  ON wedding_inspirations (wedding_id, created_at DESC);

-- 5. Wedding contacts (forenklet VIPs for fotograf-flyt)
CREATE TABLE IF NOT EXISTS wedding_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id VARCHAR(64) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  relation VARCHAR(64) NOT NULL,        -- "Mor til bruden", "Forlover", "Brudepike"
  phone VARCHAR(32),
  email VARCHAR(255),
  notes TEXT,                            -- "Skal holde tale", "I rullestol"
  is_must_capture BOOLEAN DEFAULT FALSE, -- må være med på bilder
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS wedding_contacts_wedding_idx
  ON wedding_contacts (wedding_id, is_must_capture, sort_order);

COMMENT ON TABLE wedding_locations IS 'Lokasjoner gjennom bryllupsdagen med fotografens ankomst-tid per sted.';
COMMENT ON TABLE wedding_inspirations IS 'Inspirasjons-bilder/Pinterest-lenker brudeparet deler med fotografen.';
COMMENT ON TABLE wedding_contacts IS 'VIP-kontakter fotograf bør kjenne til (foreldre, forlover, brudepiker). is_must_capture flagger personer som skal være med på bilder.';
COMMENT ON COLUMN wedding_timelines.photographer_arrival IS 'Når fotograf skal være på første lokasjon. Settes av brudeparet i timeline-form.';
COMMENT ON COLUMN wedding_timelines.gdpr_consent_at IS 'Bekreftelse på GDPR-samtykke fra brudeparet. NULL = ikke samtykket enda.';
COMMENT ON COLUMN wedding_timelines.gdpr_delete_requested_at IS 'Klient har bedt om sletting under Forbrukerkjøpsloven art. 17. Cleanup-cron tar over.';
