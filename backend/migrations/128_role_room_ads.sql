-- Migration 128: Role Room Ads 2.0 — multi-platform ads (Meta + Google + TikTok)
-- See memory/ads_2_0_architecture.md for full design.

-- 1. Campaign-level table (one row per active campaign on any platform)
CREATE TABLE IF NOT EXISTS ads_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL,
  business_profile_id VARCHAR REFERENCES business_profiles(id) ON DELETE SET NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('meta','google','tiktok','linkedin')),
  external_campaign_id VARCHAR,
  source_post_id UUID,
  source_asset_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','ended','failed')),
  goal VARCHAR(40),
  daily_budget_nok NUMERIC(10,2),
  total_budget_nok NUMERIC(10,2),
  audience_config JSONB,
  creative_config JSONB,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_campaigns_user ON ads_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_ads_campaigns_project ON ads_campaigns(project_id);
CREATE INDEX IF NOT EXISTS idx_ads_campaigns_platform_status ON ads_campaigns(platform, status);

-- 2. Daily metrics rollup (poll target for Meta Insights / Google Ads / TikTok)
CREATE TABLE IF NOT EXISTS ads_attribution_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES ads_campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions BIGINT,
  clicks BIGINT,
  spend_nok NUMERIC(12,2),
  conversions INTEGER,
  conversion_value_nok NUMERIC(12,2),
  ctr NUMERIC(8,4),
  cpc NUMERIC(8,4),
  cpm NUMERIC(8,4),
  roas NUMERIC(8,4),
  raw_metrics JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ads_attribution_campaign_date ON ads_attribution_daily(campaign_id, date DESC);

-- 3. Management-fee usage ledger (per-day record of 15% fee against media-spend)
--    Aggregated per billing-period and pushed as Stripe Meter event.
CREATE TABLE IF NOT EXISTS ads_management_fee_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  campaign_id UUID NOT NULL REFERENCES ads_campaigns(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL,
  billing_period VARCHAR(7) NOT NULL,           -- YYYY-MM
  spend_nok NUMERIC(12,2) NOT NULL,
  management_fee_nok NUMERIC(12,2) NOT NULL,    -- 15% of spend
  vat_rate NUMERIC(5,4) NOT NULL DEFAULT 0.25,
  total_incl_vat_nok NUMERIC(12,2) NOT NULL,
  stripe_meter_event_id TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_mgmt_fee_user_period ON ads_management_fee_usage(user_id, billing_period);
CREATE INDEX IF NOT EXISTS idx_ads_mgmt_fee_campaign ON ads_management_fee_usage(campaign_id);

-- 4. Extend business_profiles with industry-category + revenue + growth-phase
--    Powers the budget recommendation formula.
ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS industry_category VARCHAR(60),
  ADD COLUMN IF NOT EXISTS monthly_revenue_estimate_nok NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS growth_phase VARCHAR(20);

COMMENT ON COLUMN business_profiles.industry_category IS
  'Controlled vocab for budget engine: restaurant, ecommerce, local_smb, b2b_saas, fashion, real_estate, automotive, beauty, fitness, professional_services, other';
COMMENT ON COLUMN business_profiles.growth_phase IS
  'launch | growth | established | maintenance';
