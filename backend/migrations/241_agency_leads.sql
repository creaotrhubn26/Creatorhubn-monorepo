-- =====================================================================
-- 241_agency_leads.sql
--
-- Leads-tabell for byrå-akkvisisjon. Fyll fra /for-byraer landingsside
-- og synker til Admin Room CRM som "Byrå-leads"-segment.
--
-- Bevisst egen tabell (ikke universal_customers) fordi:
--   - Felt-settet er smalere og spesifikt for byrå-konvertering
--   - Tillater oss å indeksere på segment uten å berøre eksisterende CRM
--   - Lett å aggregere som funnel (lead → demo → trial → kunde)
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS agency_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Kontakt
  agency_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),

  -- Byrå-data
  roster_size VARCHAR(60),           -- f.eks. "~120" — fri tekst
  segment VARCHAR(60) NOT NULL DEFAULT 'skuespillerbyrå'
    CHECK (segment IN ('skuespillerbyrå','modellbyrå','bookingbyrå','annet')),
  message TEXT,

  -- Funnel-status
  status VARCHAR(40) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','contacted','demo_booked','trial','customer','disqualified','archived')),

  -- Metadata
  source VARCHAR(60) NOT NULL DEFAULT 'agency_landing',
  utm_source VARCHAR(120),
  utm_medium VARCHAR(120),
  utm_campaign VARCHAR(120),
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_context JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Internal-team-noter
  assigned_to_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  internal_notes TEXT,

  -- Tidsstempler
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  contacted_at TIMESTAMPTZ,
  trial_started_at TIMESTAMPTZ,
  customer_at TIMESTAMPTZ,

  -- Unique constraint: ett byrå per e-post + segment
  -- (samme person kan komme fra ulike segments)
  CONSTRAINT agency_leads_unique_email_segment UNIQUE (email, segment)
);

CREATE INDEX IF NOT EXISTS idx_agency_leads_status
  ON agency_leads(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agency_leads_segment
  ON agency_leads(segment, status);

CREATE INDEX IF NOT EXISTS idx_agency_leads_created_at
  ON agency_leads(created_at DESC);

-- updated_at-trigger
CREATE OR REPLACE FUNCTION agency_leads_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agency_leads_set_updated_at ON agency_leads;
CREATE TRIGGER trg_agency_leads_set_updated_at
  BEFORE UPDATE ON agency_leads
  FOR EACH ROW EXECUTE FUNCTION agency_leads_set_updated_at();

-- Event-tabell for funnel-trinn (lead → demo → trial → kunde)
CREATE TABLE IF NOT EXISTS agency_lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES agency_leads(id) ON DELETE CASCADE,
  event_type VARCHAR(60) NOT NULL,   -- 'created'|'contacted'|'demo_booked'|'trial_started'|'customer'|'note'
  actor VARCHAR(255),                -- e-post på den som triggert (eller 'system')
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agency_lead_events_lead
  ON agency_lead_events(lead_id, created_at DESC);

COMMIT;
