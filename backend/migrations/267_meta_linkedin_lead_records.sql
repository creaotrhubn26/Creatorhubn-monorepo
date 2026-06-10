-- =====================================================================
-- 267_meta_linkedin_lead_records.sql
--
-- Wave 5.3: Lead-uploadere per klient for Meta Lead Ads og LinkedIn
-- Lead Gen Forms. Speil av tiktok_lead_records (migrate 261).
-- =====================================================================

BEGIN;

-- Meta Lead Ads — leads hentet fra /{form-id}/leads
CREATE TABLE IF NOT EXISTS meta_lead_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  producer_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  ad_account_id TEXT NOT NULL,                -- act_XXXXXXXXX
  form_id TEXT NOT NULL,                      -- Meta lead-form-id
  form_name TEXT,
  page_id TEXT,                               -- Facebook Page som eier formen
  meta_lead_id TEXT UNIQUE NOT NULL,          -- Meta sin egen lead-id
  email TEXT,
  phone TEXT,
  full_name TEXT,
  custom_fields JSONB DEFAULT '{}'::jsonb,    -- Resten av lead-feltene
  campaign_id TEXT,                           -- Hvis tilgjengelig
  adset_id TEXT,
  ad_id TEXT,
  platform TEXT DEFAULT 'facebook' CHECK (platform IN ('facebook','instagram','messenger')),
  lead_created_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  pushed_to_crm BOOLEAN DEFAULT FALSE,
  pushed_to_crm_at TIMESTAMPTZ,
  crm_target TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new','qualified','contacted','converted','lost')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_lead_records_config ON meta_lead_records(config_id);
CREATE INDEX IF NOT EXISTS idx_meta_lead_records_producer ON meta_lead_records(producer_user_id);
CREATE INDEX IF NOT EXISTS idx_meta_lead_records_form ON meta_lead_records(form_id);
CREATE INDEX IF NOT EXISTS idx_meta_lead_records_status ON meta_lead_records(status) WHERE status != 'converted';
CREATE INDEX IF NOT EXISTS idx_meta_lead_records_unpushed ON meta_lead_records(pushed_to_crm) WHERE pushed_to_crm = FALSE;

CREATE TABLE IF NOT EXISTS meta_lead_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  producer_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  ad_account_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  form_name TEXT,
  page_id TEXT,
  last_synced_at TIMESTAMPTZ,
  last_lead_created_at TIMESTAMPTZ,
  enabled BOOLEAN DEFAULT TRUE,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ad_account_id, form_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_lead_sync_jobs_enabled ON meta_lead_sync_jobs(enabled) WHERE enabled = TRUE;

-- LinkedIn Lead Gen Forms — leads hentet fra /rest/leadFormResponses
CREATE TABLE IF NOT EXISTS linkedin_lead_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  producer_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  ad_account_urn TEXT NOT NULL,               -- urn:li:sponsoredAccount:NNN
  form_urn TEXT NOT NULL,                     -- urn:li:leadGenForm:NNN
  form_name TEXT,
  linkedin_lead_id TEXT UNIQUE NOT NULL,      -- LinkedIn sin egen response-id
  email TEXT,
  phone TEXT,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  job_title TEXT,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  campaign_urn TEXT,
  creative_urn TEXT,
  lead_created_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  pushed_to_crm BOOLEAN DEFAULT FALSE,
  pushed_to_crm_at TIMESTAMPTZ,
  crm_target TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new','qualified','contacted','converted','lost')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_lead_records_config ON linkedin_lead_records(config_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_lead_records_producer ON linkedin_lead_records(producer_user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_lead_records_form ON linkedin_lead_records(form_urn);
CREATE INDEX IF NOT EXISTS idx_linkedin_lead_records_status ON linkedin_lead_records(status) WHERE status != 'converted';
CREATE INDEX IF NOT EXISTS idx_linkedin_lead_records_unpushed ON linkedin_lead_records(pushed_to_crm) WHERE pushed_to_crm = FALSE;

CREATE TABLE IF NOT EXISTS linkedin_lead_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  producer_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  ad_account_urn TEXT NOT NULL,
  form_urn TEXT NOT NULL,
  form_name TEXT,
  last_synced_at TIMESTAMPTZ,
  last_lead_created_at TIMESTAMPTZ,
  enabled BOOLEAN DEFAULT TRUE,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ad_account_urn, form_urn)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_lead_sync_jobs_enabled ON linkedin_lead_sync_jobs(enabled) WHERE enabled = TRUE;

COMMIT;
