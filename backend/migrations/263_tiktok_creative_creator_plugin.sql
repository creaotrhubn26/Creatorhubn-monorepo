-- =====================================================================
-- 263_tiktok_creative_creator_plugin.sql
--
-- Phase 3 av TikTok Marketing API utvidet integrasjon:
--   - Creative Management: track opplastede creatives + Smart Video
--   - TikTok Creator: cache marketplace-discovery
--   - TikTok Business Plugin: webstore-connect-status
--   - TikTok Accounts: track linked accounts per Business Center
-- =====================================================================

BEGIN;

-- Creative-assets opplastet til TikTok via /file/video/ad/upload/ + /file/image/ad/upload/
CREATE TABLE IF NOT EXISTS tiktok_creative_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  producer_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  advertiser_id TEXT NOT NULL,
  tiktok_material_id TEXT NOT NULL,           -- TikTok's material_id / video_id
  asset_type TEXT NOT NULL CHECK (asset_type IN ('video', 'image', 'smart_video')),
  file_name TEXT,
  file_size_bytes BIGINT,
  width INTEGER,
  height INTEGER,
  duration_sec NUMERIC(7,2),                  -- For video
  preview_url TEXT,                           -- TikTok-CDN URL
  -- Smart Video-spesifikke felter
  source_material_id TEXT,                    -- Original som vi genererte fra
  smart_video_task_id TEXT,                   -- Task-ID for status-polling
  smart_video_status TEXT,                    -- 'IN_PROGRESS', 'SUCCESS', 'FAILED'
  upload_status TEXT DEFAULT 'uploaded' CHECK (upload_status IN ('uploading', 'uploaded', 'failed')),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(advertiser_id, tiktok_material_id)
);

CREATE INDEX IF NOT EXISTS idx_tiktok_creative_config ON tiktok_creative_assets(config_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_creative_advertiser_type ON tiktok_creative_assets(advertiser_id, asset_type, uploaded_at DESC);

-- TikTok Creator Marketplace discovery — cached søk per query
CREATE TABLE IF NOT EXISTS tiktok_creator_discoveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  advertiser_id TEXT NOT NULL,
  -- Søke-parametre
  country TEXT,
  niche TEXT,
  min_followers INTEGER,
  max_followers INTEGER,
  -- Resultater
  creators JSONB DEFAULT '[]'::jsonb,
  -- {handle, name, follower_count, engagement_rate, location, niche, avatar_url, ...}
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tiktok_creator_disc_producer ON tiktok_creator_discoveries(producer_user_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_creator_disc_fresh ON tiktok_creator_discoveries(expires_at) WHERE expires_at > NOW();

-- TikTok Business Plugin-installasjoner per klient
CREATE TABLE IF NOT EXISTS tiktok_business_plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  producer_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  advertiser_id TEXT NOT NULL,
  plugin_type TEXT NOT NULL CHECK (plugin_type IN (
    'website', 'shopify', 'woocommerce', 'magento', 'bigcommerce', 'custom'
  )),
  plugin_name TEXT NOT NULL,
  domain TEXT,
  tiktok_plugin_id TEXT,                      -- TikToks side-id
  install_status TEXT DEFAULT 'pending' CHECK (install_status IN (
    'pending', 'connected', 'disconnected', 'failed'
  )),
  installed_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(advertiser_id, tiktok_plugin_id)
);

CREATE INDEX IF NOT EXISTS idx_tiktok_plugins_config ON tiktok_business_plugins(config_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_plugins_status ON tiktok_business_plugins(install_status);

-- TikTok-kontoer koblet til Business Center (cached fra /tiktok_account/list/)
CREATE TABLE IF NOT EXISTS tiktok_linked_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  producer_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  advertiser_id TEXT NOT NULL,
  tiktok_account_id TEXT NOT NULL,
  handle TEXT,
  display_name TEXT,
  account_role TEXT,                          -- 'BRAND', 'KLIENT_BRAND', 'SPARK_ADS_DELEGATION'
  permissions TEXT[],                         -- ['ADS', 'POSTING', 'SPARK_BOOST']
  account_status TEXT DEFAULT 'active' CHECK (account_status IN (
    'active', 'delegated', 'pending', 'revoked', 'expired'
  )),
  follower_count INTEGER,
  avatar_url TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(advertiser_id, tiktok_account_id)
);

CREATE INDEX IF NOT EXISTS idx_tiktok_linked_config ON tiktok_linked_accounts(config_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_linked_advertiser ON tiktok_linked_accounts(advertiser_id);

COMMIT;
