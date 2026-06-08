-- =====================================================================
-- 259_client_multi_platform_ads.sql
--
-- Utvider client_ads_configs + client_ads_actions for full
-- multi-plattform parity med Google Ads-flowen:
--   - LinkedIn (Insight Tag + Conversion Rules + CAPI)
--   - Meta (Pixel + Custom Conversions + Conversions API)
--   - TikTok (Pixel + Events API)
--
-- Hver plattform har: account-ID, pixel-ID, CAPI-token (kryptert), state-flag.
-- Per-action: plattform-spesifikke conversion-ID-er etter sync.
--
-- CAPI-tokens lagres som "encrypted" tekst — vi bruker samme AES-256-GCM-
-- pattern som role_room_ads_oauth_connections.refresh_token (key fra env).
-- =====================================================================

BEGIN;

ALTER TABLE client_ads_configs
  -- LinkedIn
  ADD COLUMN IF NOT EXISTS linkedin_account_urn TEXT,        -- urn:li:sponsoredAccount:1234567890
  ADD COLUMN IF NOT EXISTS linkedin_account_name TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_insight_tag_id BIGINT,
  ADD COLUMN IF NOT EXISTS linkedin_capi_access_token TEXT,  -- encrypted
  ADD COLUMN IF NOT EXISTS linkedin_setup_completed_at TIMESTAMPTZ,

  -- Meta (Facebook/Instagram)
  ADD COLUMN IF NOT EXISTS meta_ad_account_id TEXT,          -- act_XXXXXXXXX
  ADD COLUMN IF NOT EXISTS meta_business_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_pixel_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_pixel_name TEXT,
  ADD COLUMN IF NOT EXISTS meta_capi_access_token TEXT,      -- encrypted
  ADD COLUMN IF NOT EXISTS meta_setup_completed_at TIMESTAMPTZ,

  -- TikTok
  ADD COLUMN IF NOT EXISTS tiktok_advertiser_id TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_advertiser_name TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_pixel_id TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_pixel_name TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_capi_access_token TEXT,    -- encrypted
  ADD COLUMN IF NOT EXISTS tiktok_setup_completed_at TIMESTAMPTZ,

  -- Plattform-utvalg per klient (hvilke som skal settes opp)
  ADD COLUMN IF NOT EXISTS platforms_selected TEXT[] DEFAULT ARRAY['google_ads']::TEXT[];
  -- 'google_ads' | 'linkedin' | 'meta' | 'tiktok'

CREATE INDEX IF NOT EXISTS idx_client_ads_configs_linkedin
  ON client_ads_configs(linkedin_account_urn)
  WHERE linkedin_account_urn IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_ads_configs_meta
  ON client_ads_configs(meta_pixel_id)
  WHERE meta_pixel_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_ads_configs_tiktok
  ON client_ads_configs(tiktok_pixel_id)
  WHERE tiktok_pixel_id IS NOT NULL;

-- Per-action plattform-conversion-ID-er etter sync
ALTER TABLE client_ads_actions
  ADD COLUMN IF NOT EXISTS linkedin_conversion_id BIGINT,
  ADD COLUMN IF NOT EXISTS linkedin_conversion_urn TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_synced_at TIMESTAMPTZ,

  ADD COLUMN IF NOT EXISTS meta_custom_conversion_id TEXT,   -- numeric, but kept as text for safety
  ADD COLUMN IF NOT EXISTS meta_event_name TEXT,             -- f.eks. 'Lead', 'Purchase', 'CompleteRegistration'
  ADD COLUMN IF NOT EXISTS meta_synced_at TIMESTAMPTZ,

  ADD COLUMN IF NOT EXISTS tiktok_event_id TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_event_name TEXT,           -- f.eks. 'CompletePayment', 'SubmitForm'
  ADD COLUMN IF NOT EXISTS tiktok_synced_at TIMESTAMPTZ;

-- Utvid client_ads_events for å støtte multi-platform-tracking
ALTER TABLE client_ads_events
  ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'google_ads'
    CHECK (platform IN ('google_ads','linkedin','meta','tiktok','ga4'));

COMMIT;
