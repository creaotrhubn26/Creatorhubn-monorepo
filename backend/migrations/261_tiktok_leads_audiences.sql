-- =====================================================================
-- 261_tiktok_leads_audiences.sql
--
-- Phase 1 av TikTok Marketing API utvidet integrasjon:
--   - Lead Management: lagre TikTok Lead Ads-leads per klient-config
--   - Audience Management: lagre custom audience-IDer + metadata
--
-- Brukes av Role Room Agent (på vegne av klient) + Marketing Cockpit
-- (The Role Room's egen ad-konto).
-- =====================================================================

BEGIN;

-- TikTok Lead Ads — leads hentet fra /page/lead/list/
CREATE TABLE IF NOT EXISTS tiktok_lead_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  -- NULL config_id = The Role Room's egen lead (Marketing Cockpit)
  producer_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  advertiser_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  form_name TEXT,
  tiktok_lead_id TEXT UNIQUE NOT NULL,        -- TikTok's own lead ID
  -- Lead-data (typisk email + telefon + tilpassede felter)
  email TEXT,
  phone TEXT,
  full_name TEXT,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  lead_created_at TIMESTAMPTZ,                -- når TikTok mottok leaden
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  -- Sync til klient-CRM (eller The Role Room's CRM)
  pushed_to_crm BOOLEAN DEFAULT FALSE,
  pushed_to_crm_at TIMESTAMPTZ,
  crm_target TEXT,                            -- 'admin_room' | 'klient_crm' | etc
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'qualified', 'contacted', 'converted', 'lost')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tiktok_lead_records_config ON tiktok_lead_records(config_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_lead_records_producer ON tiktok_lead_records(producer_user_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_lead_records_advertiser ON tiktok_lead_records(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_lead_records_status ON tiktok_lead_records(status) WHERE status != 'converted';
CREATE INDEX IF NOT EXISTS idx_tiktok_lead_records_unpushed ON tiktok_lead_records(pushed_to_crm) WHERE pushed_to_crm = FALSE;

-- TikTok Custom Audiences — opprettet via /dmp/custom_audience/create/
CREATE TABLE IF NOT EXISTS tiktok_custom_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  -- NULL config_id = The Role Room's egen audience
  producer_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  advertiser_id TEXT NOT NULL,
  tiktok_audience_id TEXT UNIQUE NOT NULL,    -- TikTok's audience_id
  audience_name TEXT NOT NULL,
  audience_type TEXT DEFAULT 'CUSTOMER_FILE' CHECK (audience_type IN (
    'CUSTOMER_FILE', 'WEBSITE_TRAFFIC', 'APP_ACTIVITY', 'ENGAGEMENT', 'LOOKALIKE'
  )),
  source_description TEXT,                    -- 'newsletter_subscribers_q2', etc
  -- Audience-størrelse (oppdateres fra TikTok-API)
  upload_count INTEGER,                       -- antall rader uploadet
  matched_count INTEGER,                      -- antall matched av TikTok
  match_rate NUMERIC(5,2),                    -- %, beregnet av TikTok
  status TEXT DEFAULT 'creating' CHECK (status IN ('creating', 'processing', 'ready', 'expired', 'failed')),
  last_refreshed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,                     -- TikTok audiences expirer etter ~180 dager uten refresh
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tiktok_audiences_config ON tiktok_custom_audiences(config_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_audiences_producer ON tiktok_custom_audiences(producer_user_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_audiences_advertiser ON tiktok_custom_audiences(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_audiences_status ON tiktok_custom_audiences(status);

-- Sync-jobber for cron — TikTok Lead Ads polles hvert 5. min for nye leads
CREATE TABLE IF NOT EXISTS tiktok_lead_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  producer_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  advertiser_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ,
  last_lead_created_at TIMESTAMPTZ,           -- For paginering / inkrementell sync
  enabled BOOLEAN DEFAULT TRUE,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(advertiser_id, form_id)
);

CREATE INDEX IF NOT EXISTS idx_tiktok_lead_sync_jobs_enabled ON tiktok_lead_sync_jobs(enabled) WHERE enabled = TRUE;

COMMIT;
