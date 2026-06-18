-- =====================================================================
-- 265_meta_linkedin_google_audiences.sql
--
-- Wave 5: PII-sendere på Meta + LinkedIn + Google. Speil av
-- tiktok_custom_audiences (migrate 261) men plattform-agnostisk.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS meta_custom_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  producer_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  ad_account_id TEXT NOT NULL,                -- act_XXXXXXXXX
  meta_audience_id TEXT UNIQUE NOT NULL,
  audience_name TEXT NOT NULL,
  source_description TEXT,
  upload_count INTEGER,
  matched_count INTEGER,
  match_rate NUMERIC(5,2),
  status TEXT DEFAULT 'creating' CHECK (status IN ('creating','processing','ready','expired','failed')),
  last_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_audiences_config ON meta_custom_audiences(config_id);
CREATE INDEX IF NOT EXISTS idx_meta_audiences_account ON meta_custom_audiences(ad_account_id);

CREATE TABLE IF NOT EXISTS linkedin_matched_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  producer_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  ad_account_urn TEXT NOT NULL,
  linkedin_segment_urn TEXT UNIQUE NOT NULL,
  audience_name TEXT NOT NULL,
  source_description TEXT,
  upload_count INTEGER,
  matched_count INTEGER,
  status TEXT DEFAULT 'creating' CHECK (status IN ('creating','processing','ready','expired','failed')),
  last_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_audiences_config ON linkedin_matched_audiences(config_id);

CREATE TABLE IF NOT EXISTS google_customer_match_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  producer_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  customer_id TEXT NOT NULL,                  -- Google Ads customer-ID (10 sifre)
  user_list_resource TEXT UNIQUE NOT NULL,    -- customers/X/userLists/Y
  audience_name TEXT NOT NULL,
  source_description TEXT,
  upload_count INTEGER,
  matched_count INTEGER,
  status TEXT DEFAULT 'creating' CHECK (status IN ('creating','processing','ready','expired','failed')),
  last_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_google_audiences_config ON google_customer_match_audiences(config_id);

COMMIT;
