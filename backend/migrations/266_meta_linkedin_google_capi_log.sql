-- =====================================================================
-- 266_meta_linkedin_google_capi_log.sql
--
-- Wave 5.2: CAPI server-side events per klient for Meta, LinkedIn, Google.
-- Speil av tiktok_crm_event_log (migrate 262).
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS meta_capi_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  producer_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  pixel_id TEXT NOT NULL,
  event_name TEXT NOT NULL,                  -- 'Lead', 'Purchase', 'CompleteRegistration', etc
  event_time TIMESTAMPTZ NOT NULL,
  event_source TEXT,
  external_user_id TEXT,                     -- hashed email
  event_value NUMERIC(10,2),
  event_currency TEXT DEFAULT 'NOK',
  custom_properties JSONB DEFAULT '{}'::jsonb,
  delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending','delivered','failed','retrying')),
  delivered_at TIMESTAMPTZ,
  meta_response JSONB,
  attempt_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_capi_log_config ON meta_capi_event_log(config_id);
CREATE INDEX IF NOT EXISTS idx_meta_capi_log_pending ON meta_capi_event_log(delivery_status, created_at)
  WHERE delivery_status IN ('pending', 'retrying');

CREATE TABLE IF NOT EXISTS linkedin_capi_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  producer_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  conversion_urn TEXT NOT NULL,              -- urn:li:llaPartnerConversion:NNN
  event_name TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  event_source TEXT,
  external_user_id TEXT,
  event_value NUMERIC(10,2),
  event_currency TEXT DEFAULT 'NOK',
  custom_properties JSONB DEFAULT '{}'::jsonb,
  delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending','delivered','failed','retrying')),
  delivered_at TIMESTAMPTZ,
  linkedin_response JSONB,
  attempt_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_capi_log_config ON linkedin_capi_event_log(config_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_capi_log_pending ON linkedin_capi_event_log(delivery_status, created_at)
  WHERE delivery_status IN ('pending', 'retrying');

CREATE TABLE IF NOT EXISTS google_offline_conversion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  producer_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  customer_id TEXT NOT NULL,
  conversion_action_resource TEXT NOT NULL,  -- customers/X/conversionActions/Y
  event_name TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  event_source TEXT,
  external_user_id TEXT,
  gclid TEXT,                                -- Google Click ID hvis tilgjengelig
  event_value NUMERIC(10,2),
  event_currency TEXT DEFAULT 'NOK',
  enhanced_conversions BOOLEAN DEFAULT FALSE,
  custom_properties JSONB DEFAULT '{}'::jsonb,
  delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending','delivered','failed','retrying')),
  delivered_at TIMESTAMPTZ,
  google_response JSONB,
  attempt_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_google_capi_log_config ON google_offline_conversion_log(config_id);
CREATE INDEX IF NOT EXISTS idx_google_capi_log_pending ON google_offline_conversion_log(delivery_status, created_at)
  WHERE delivery_status IN ('pending', 'retrying');

COMMIT;
