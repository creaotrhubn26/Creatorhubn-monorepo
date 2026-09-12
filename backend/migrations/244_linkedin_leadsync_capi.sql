-- =====================================================================
-- 244_linkedin_leadsync_capi.sql
--
-- Mottak-infrastruktur for LinkedIn Lead Sync API + Conversions API.
-- Kobles inn så snart LinkedIn godkjenner søknadene.
--
-- Lead Sync: poll /v2/leadFormResponses → map til agency_leads-rader.
-- Conversions API: send events ved lead/trial/customer-overganger.
-- =====================================================================

BEGIN;

-- ── Lead Sync ─────────────────────────────────────────────────────
-- Per LinkedIn Lead Gen Form vi eier — track poll-state og field-mapping.
CREATE TABLE IF NOT EXISTS linkedin_lead_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- LinkedIn-identifisering
  form_urn VARCHAR(160) NOT NULL UNIQUE,         -- urn:li:leadGenForm:<id>
  form_name VARCHAR(255),
  organization_urn VARCHAR(120),                  -- hvilken org formen tilhører
  campaign_urn VARCHAR(160),                      -- valgfri Sponsored Content URN

  -- Field-mapping: LinkedIn-field → agency_leads-kolonne
  -- Eksempel: { "first_name": "contact_name_first",
  --             "last_name": "contact_name_last",
  --             "email": "email",
  --             "company": "agency_name",
  --             "roster_size_custom": "roster_size" }
  field_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Poll-state
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_polled_at TIMESTAMPTZ,
  last_response_id VARCHAR(120),                  -- høyeste respons-ID vi har sett
  last_poll_status VARCHAR(40),                   -- 'ok' | 'error' | 'partial'
  last_poll_error TEXT,
  poll_interval_seconds INT NOT NULL DEFAULT 300,

  -- Stats
  total_responses_fetched INT NOT NULL DEFAULT 0,
  total_leads_created INT NOT NULL DEFAULT 0,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_lead_forms_active
  ON linkedin_lead_forms(active, last_polled_at NULLS FIRST);

-- Audit per Lead Sync-respons vi har sett — slik at vi kan re-prosessere
-- hvis agency_leads-write feiler, og dedupe samme respons.
CREATE TABLE IF NOT EXISTS linkedin_lead_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES linkedin_lead_forms(id) ON DELETE CASCADE,

  response_id VARCHAR(160) NOT NULL,              -- LinkedIn-respons-ID
  raw_payload JSONB NOT NULL,                     -- hele response-obj fra LinkedIn

  -- Mapped to vår CRM
  agency_lead_id UUID REFERENCES agency_leads(id) ON DELETE SET NULL,
  mapped_at TIMESTAMPTZ,
  mapping_error TEXT,

  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,                       -- tidsstempel fra LinkedIn

  CONSTRAINT linkedin_lead_responses_unique UNIQUE (form_id, response_id)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_lead_responses_form
  ON linkedin_lead_responses(form_id, fetched_at DESC);

-- ── Conversions API ──────────────────────────────────────────────
-- Event-typer vi sender til LinkedIn for bidding-optimalisering.
-- LinkedIn forventer disse konkrete event-navnene.
CREATE TABLE IF NOT EXISTS linkedin_conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event-identifisering
  event_type VARCHAR(60) NOT NULL
    CHECK (event_type IN (
      'PAGE_VIEW','LEAD','SIGN_UP','PURCHASE','ADD_PAYMENT_INFO',
      'SUBSCRIBE','BOOK_APPOINTMENT','CONTACT','OTHER'
    )),
  event_name VARCHAR(120),                        -- vår interne label
  conversion_urn VARCHAR(160),                    -- LinkedIn conversion-URN

  -- Match-data (alle PII må SHA-256-hashes før send)
  user_email_hash VARCHAR(64),                    -- SHA-256 av lowercase-email
  user_phone_hash VARCHAR(64),
  user_first_name_hash VARCHAR(64),
  user_last_name_hash VARCHAR(64),
  user_country_code VARCHAR(2),
  linkedin_click_id VARCHAR(160),                  -- li_fat_id fra URL-param
  linkedin_first_party_ad_id VARCHAR(160),

  -- Verdi
  conversion_value_currency VARCHAR(10),
  conversion_value_amount NUMERIC(12, 2),

  -- Audit / dedupe
  event_id VARCHAR(120) NOT NULL UNIQUE,           -- vår klient-genererte unique ID
  occurred_at TIMESTAMPTZ NOT NULL,
  source_agency_lead_id UUID REFERENCES agency_leads(id) ON DELETE SET NULL,
  source_kind VARCHAR(60),                         -- 'agency_lead'|'stripe_subscription'|'manual'|'webinar'
  source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Status
  send_status VARCHAR(40) NOT NULL DEFAULT 'pending'
    CHECK (send_status IN ('pending','sent','failed','skipped','retrying')),
  sent_at TIMESTAMPTZ,
  send_attempts INT NOT NULL DEFAULT 0,
  last_send_error TEXT,
  last_send_at TIMESTAMPTZ,
  linkedin_response_id VARCHAR(160),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_capi_events_pending
  ON linkedin_conversion_events(send_status, created_at)
  WHERE send_status IN ('pending','retrying');

CREATE INDEX IF NOT EXISTS idx_linkedin_capi_events_source
  ON linkedin_conversion_events(source_agency_lead_id);

-- updated_at-trigger for lead-forms
DROP TRIGGER IF EXISTS trg_linkedin_lead_forms_updated_at ON linkedin_lead_forms;
CREATE TRIGGER trg_linkedin_lead_forms_updated_at
  BEFORE UPDATE ON linkedin_lead_forms
  FOR EACH ROW EXECUTE FUNCTION cockpit_b2b_set_updated_at();

COMMIT;
