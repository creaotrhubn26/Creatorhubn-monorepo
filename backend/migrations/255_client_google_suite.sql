-- =====================================================================
-- 255_client_google_suite.sql
--
-- Utvider client_ads_configs til full Google-suite per klient:
--   - GA4 (Google Analytics 4)
--   - GSC (Google Search Console)
--   - GTM (Google Tag Manager)
--   - Google Ads (allerede dekket av 254)
--
-- Hver klient kan ha satt opp 1-N av disse tools'ene. Wizard i Agent
-- styrer setup-flow per tool.
-- =====================================================================

BEGIN;

ALTER TABLE client_ads_configs
  -- GA4 (Google Analytics 4)
  ADD COLUMN IF NOT EXISTS ga4_property_id VARCHAR(20),           -- f.eks. '123456789'
  ADD COLUMN IF NOT EXISTS ga4_measurement_id VARCHAR(20),        -- 'G-XXXXXXXXXX'
  ADD COLUMN IF NOT EXISTS ga4_data_stream_id VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ga4_setup_completed_at TIMESTAMPTZ,

  -- GSC (Google Search Console)
  ADD COLUMN IF NOT EXISTS gsc_property_url TEXT,                 -- 'sc-domain:klient.no' eller 'https://klient.no/'
  ADD COLUMN IF NOT EXISTS gsc_verification_method VARCHAR(20)    -- 'meta_tag' | 'dns_txt' | 'html_file' | 'analytics'
    CHECK (gsc_verification_method IN ('meta_tag','dns_txt','html_file','analytics','gtm') OR gsc_verification_method IS NULL),
  ADD COLUMN IF NOT EXISTS gsc_verification_token TEXT,           -- Verifikasjons-token fra Google
  ADD COLUMN IF NOT EXISTS gsc_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gsc_sitemap_submitted_at TIMESTAMPTZ,

  -- GTM (Google Tag Manager)
  ADD COLUMN IF NOT EXISTS gtm_account_id VARCHAR(20),
  ADD COLUMN IF NOT EXISTS gtm_container_id VARCHAR(20),
  ADD COLUMN IF NOT EXISTS gtm_container_public_id VARCHAR(20),   -- GTM-XXXXXXX (det som limes inn på siden)
  ADD COLUMN IF NOT EXISTS gtm_setup_completed_at TIMESTAMPTZ,

  -- Google Business Profile (kun for lokal-fysiske virksomheter)
  ADD COLUMN IF NOT EXISTS business_profile_account_id VARCHAR(40),
  ADD COLUMN IF NOT EXISTS business_profile_location_id VARCHAR(40),

  -- Setup-progresjon (hvilke tools producer har valgt å sette opp)
  ADD COLUMN IF NOT EXISTS suite_tools_selected TEXT[] DEFAULT ARRAY[]::TEXT[],
    -- Array av: 'ga4', 'gsc', 'gtm', 'google_ads', 'business_profile', 'merchant_center'
  ADD COLUMN IF NOT EXISTS suite_setup_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suite_setup_completed_at TIMESTAMPTZ;

-- Index for klienter med eksisterende GA4 (kan re-bruke vs. opprette ny)
CREATE INDEX IF NOT EXISTS idx_client_ads_configs_ga4
  ON client_ads_configs(ga4_measurement_id)
  WHERE ga4_measurement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_ads_configs_gtm
  ON client_ads_configs(gtm_container_public_id)
  WHERE gtm_container_public_id IS NOT NULL;

-- Event-typer: utvide client_ads_events for å spore non-Google-Ads events også
ALTER TABLE client_ads_events
  ADD COLUMN IF NOT EXISTS google_tool VARCHAR(20) DEFAULT 'google_ads'
    CHECK (google_tool IN ('google_ads','ga4','gsc','gtm','business_profile')),
  ADD COLUMN IF NOT EXISTS event_metadata JSONB DEFAULT '{}'::jsonb;

COMMIT;
