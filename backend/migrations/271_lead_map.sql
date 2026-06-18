-- =====================================================================
-- 271_lead_map.sql
--
-- The Role Room Lead Map (Marketing Cockpit-utvidelse).
--
-- Strategi: utvid eksisterende crm_customers (Universal CRM) i stedet for
-- å lage parallell lead-tabell. Lead Map er en VISUELL/operasjonell
-- representasjon av crm_customers-rader med geo-koordinater + status-
-- mapping for kart-pin-farger.
--
-- 3 nye tabeller:
--   1. crm_customers utvides med lat/lng/address-felter + lead-map-status
--   2. crm_visits (visit-log per kunde)
--   3. crm_lead_activities (audit-feed per kunde — pin-color-endringer,
--      AI-pitches generert, etc.)
-- =====================================================================

BEGIN;

-- ── 1. Utvid crm_customers ──────────────────────────────────────────
-- Geo + Lead Map-specific felter. Alle NULLABLE — eksisterende rader
-- forblir intakte uten geo, og vises ikke på kartet før de får
-- koordinater (manuelt eller via Google Places-import).
ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS city VARCHAR(120),
  ADD COLUMN IF NOT EXISTS country VARCHAR(2) DEFAULT 'NO',
  ADD COLUMN IF NOT EXISTS lead_category VARCHAR(60),
  -- Lead Map-specific status (utvider crm_customers.status):
  -- unvisited | visited | return | not_present | declined | interested |
  -- meeting_booked | proposal_sent | won | lost | do_not_contact
  ADD COLUMN IF NOT EXISTS lead_status VARCHAR(30) DEFAULT 'unvisited'
    CHECK (lead_status IN (
      'unvisited','visited','return','not_present','declined',
      'interested','meeting_booked','proposal_sent','won','lost','do_not_contact'
    )),
  ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS google_rating NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS ai_opportunity_score INTEGER
    CHECK (ai_opportunity_score IS NULL OR ai_opportunity_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS estimated_value NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS lead_source VARCHAR(80),
  ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS territory_id VARCHAR(255);

-- Geo-index for map-bounds-queries
CREATE INDEX IF NOT EXISTS idx_crm_customers_geo
  ON crm_customers(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_lead_status
  ON crm_customers(lead_status, owner_user_id)
  WHERE lead_status != 'do_not_contact';

CREATE INDEX IF NOT EXISTS idx_crm_customers_followup
  ON crm_customers(next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_place
  ON crm_customers(google_place_id)
  WHERE google_place_id IS NOT NULL;

-- ── 2. crm_visits ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,                              -- FK til crm_customers
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  visit_type VARCHAR(30) NOT NULL CHECK (visit_type IN (
    'physical','phone','email','online_meeting','research'
  )),
  visit_datetime TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Status-overganger
  previous_status VARCHAR(30),
  new_status VARCHAR(30),

  -- Innhold
  contact_person VARCHAR(255),
  conversation_summary TEXT,
  objection_reason TEXT,
  notes TEXT,

  -- Neste handling
  next_action TEXT,
  next_follow_up_at TIMESTAMPTZ,

  -- GPS (valgfri — for fysiske besøk)
  visit_latitude NUMERIC(9,6),
  visit_longitude NUMERIC(9,6),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_visits_customer
  ON crm_visits(customer_id, visit_datetime DESC);

CREATE INDEX IF NOT EXISTS idx_crm_visits_user
  ON crm_visits(user_id, visit_datetime DESC);

-- ── 3. crm_lead_activities (audit-feed) ─────────────────────────────
CREATE TABLE IF NOT EXISTS crm_lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,

  activity_type VARCHAR(40) NOT NULL CHECK (activity_type IN (
    'status_changed','visit_logged','note_added','pitch_generated',
    'meeting_scheduled','proposal_sent','follow_up_set',
    'lead_created','lead_imported','assigned'
  )),

  old_value TEXT,
  new_value TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_customer
  ON crm_lead_activities(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_activities_recent
  ON crm_lead_activities(created_at DESC);

COMMIT;
