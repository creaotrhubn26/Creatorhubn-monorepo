-- 0490_role_room_reconcile_applied_schema.sql
--
-- Reconciles Role Room tables whose original migrations are present in the
-- production ledger but whose relations are absent. The original migrations
-- must not be replayed: several historical key types no longer match the
-- canonical VARCHAR user/project identities.
--
-- Every CREATE is idempotent. The migration intentionally contains no seed or
-- billing-plan updates; it only restores persistence required by active flows.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(hashtext('0490_role_room_reconcile_applied_schema'));

-- Casting reminder usage. billing_period is written explicitly by the server;
-- the historical generated to_char(timestamptz) expression is not immutable
-- and therefore cannot be used as a PostgreSQL generated column.
CREATE TABLE IF NOT EXISTS casting_sms_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  schedule_id VARCHAR(255) REFERENCES casting_schedules(id) ON DELETE SET NULL,
  candidate_id VARCHAR(255) REFERENCES casting_candidates(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  threshold VARCHAR(8) NOT NULL,
  brand VARCHAR(32) NOT NULL,
  twilio_message_sid TEXT,
  unit_price_nok_ex_vat NUMERIC(10, 4) NOT NULL,
  vat_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.25,
  total_nok_ex_vat NUMERIC(10, 4) NOT NULL,
  total_nok_incl_vat NUMERIC(10, 4) NOT NULL,
  stripe_invoice_item_id TEXT,
  billing_period VARCHAR(7) NOT NULL,
  CONSTRAINT casting_sms_usage_billing_period_check
    CHECK (billing_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

CREATE INDEX IF NOT EXISTS casting_sms_usage_project_period_idx
  ON casting_sms_usage (project_id, billing_period);
CREATE INDEX IF NOT EXISTS casting_sms_usage_period_idx
  ON casting_sms_usage (billing_period)
  WHERE stripe_invoice_item_id IS NULL;

CREATE TABLE IF NOT EXISTS casting_whatsapp_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  schedule_id VARCHAR(255) REFERENCES casting_schedules(id) ON DELETE SET NULL,
  candidate_id VARCHAR(255) REFERENCES casting_candidates(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  threshold VARCHAR(8) NOT NULL,
  brand VARCHAR(32) NOT NULL,
  template_name TEXT,
  whatsapp_message_id TEXT,
  conversation_id TEXT,
  unit_price_nok_ex_vat NUMERIC(10, 4) NOT NULL,
  vat_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.25,
  total_nok_ex_vat NUMERIC(10, 4) NOT NULL,
  total_nok_incl_vat NUMERIC(10, 4) NOT NULL,
  stripe_invoice_item_id TEXT,
  billing_period VARCHAR(7) NOT NULL,
  CONSTRAINT casting_whatsapp_usage_billing_period_check
    CHECK (billing_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

CREATE INDEX IF NOT EXISTS casting_whatsapp_usage_project_period_idx
  ON casting_whatsapp_usage (project_id, billing_period);
CREATE INDEX IF NOT EXISTS casting_whatsapp_usage_period_idx
  ON casting_whatsapp_usage (billing_period)
  WHERE stripe_invoice_item_id IS NULL;

-- Research and marketing-plan snapshots. casting_projects.id and users.id are
-- VARCHAR in the canonical/live schema; the historical UUID declarations made
-- these CREATE statements incompatible with the relations they reference.
CREATE TABLE IF NOT EXISTS role_room_client_intake_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  label TEXT,
  snapshot JSONB NOT NULL,
  generated_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  generated_by_kind TEXT NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT role_room_client_intake_versions_kind_check
    CHECK (generated_by_kind IN ('user', 'agent')),
  CONSTRAINT role_room_client_intake_versions_number_check
    CHECK (version_number > 0),
  UNIQUE (project_id, version_number)
);

CREATE INDEX IF NOT EXISTS role_room_client_intake_versions_project_idx
  ON role_room_client_intake_versions (project_id, version_number DESC);
CREATE UNIQUE INDEX IF NOT EXISTS role_room_client_intake_versions_active_idx
  ON role_room_client_intake_versions (project_id)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS role_room_marketing_plans_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  plan_id UUID,
  version_number INTEGER NOT NULL,
  label TEXT,
  snapshot JSONB NOT NULL,
  generated_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  generated_by_kind TEXT NOT NULL DEFAULT 'agent',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT role_room_marketing_plans_versions_kind_check
    CHECK (generated_by_kind IN ('user', 'agent')),
  CONSTRAINT role_room_marketing_plans_versions_number_check
    CHECK (version_number > 0),
  UNIQUE (project_id, version_number)
);

CREATE INDEX IF NOT EXISTS role_room_marketing_plans_versions_project_idx
  ON role_room_marketing_plans_versions (project_id, version_number DESC);
CREATE UNIQUE INDEX IF NOT EXISTS role_room_marketing_plans_versions_active_idx
  ON role_room_marketing_plans_versions (project_id)
  WHERE is_active = TRUE;

-- Audience persistence. producer_user_id follows users.id (VARCHAR); config_id
-- remains UUID because client_ads_configs.id is UUID.
CREATE TABLE IF NOT EXISTS meta_custom_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  producer_user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  meta_audience_id TEXT UNIQUE NOT NULL,
  audience_name TEXT NOT NULL,
  source_description TEXT,
  upload_count INTEGER,
  matched_count INTEGER,
  match_rate NUMERIC(5, 2),
  status TEXT DEFAULT 'creating',
  last_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT meta_custom_audiences_status_check
    CHECK (status IN ('creating', 'processing', 'ready', 'expired', 'failed'))
);
CREATE INDEX IF NOT EXISTS idx_meta_audiences_config
  ON meta_custom_audiences (config_id);
CREATE INDEX IF NOT EXISTS idx_meta_audiences_account
  ON meta_custom_audiences (ad_account_id);
CREATE INDEX IF NOT EXISTS idx_meta_audiences_producer
  ON meta_custom_audiences (producer_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS linkedin_matched_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  producer_user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ad_account_urn TEXT NOT NULL,
  linkedin_segment_urn TEXT UNIQUE NOT NULL,
  audience_name TEXT NOT NULL,
  source_description TEXT,
  upload_count INTEGER,
  matched_count INTEGER,
  status TEXT DEFAULT 'creating',
  last_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT linkedin_matched_audiences_status_check
    CHECK (status IN ('creating', 'processing', 'ready', 'expired', 'failed'))
);
CREATE INDEX IF NOT EXISTS idx_linkedin_audiences_config
  ON linkedin_matched_audiences (config_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_audiences_producer
  ON linkedin_matched_audiences (producer_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS google_customer_match_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  producer_user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  user_list_resource TEXT UNIQUE NOT NULL,
  audience_name TEXT NOT NULL,
  source_description TEXT,
  upload_count INTEGER,
  matched_count INTEGER,
  status TEXT DEFAULT 'creating',
  last_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT google_customer_match_audiences_status_check
    CHECK (status IN ('creating', 'processing', 'ready', 'expired', 'failed'))
);
CREATE INDEX IF NOT EXISTS idx_google_audiences_config
  ON google_customer_match_audiences (config_id);
CREATE INDEX IF NOT EXISTS idx_google_audiences_producer
  ON google_customer_match_audiences (producer_user_id, updated_at DESC);

-- Server-side conversion logs.
CREATE TABLE IF NOT EXISTS meta_capi_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  producer_user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pixel_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  event_source TEXT,
  external_user_id TEXT,
  event_value NUMERIC(10, 2),
  event_currency TEXT DEFAULT 'NOK',
  custom_properties JSONB DEFAULT '{}'::jsonb,
  delivery_status TEXT DEFAULT 'pending',
  delivered_at TIMESTAMPTZ,
  meta_response JSONB,
  attempt_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT meta_capi_event_log_status_check
    CHECK (delivery_status IN ('pending', 'delivered', 'failed', 'retrying'))
);
CREATE INDEX IF NOT EXISTS idx_meta_capi_log_config
  ON meta_capi_event_log (config_id);
CREATE INDEX IF NOT EXISTS idx_meta_capi_log_pending
  ON meta_capi_event_log (delivery_status, created_at)
  WHERE delivery_status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_meta_capi_log_producer
  ON meta_capi_event_log (producer_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS linkedin_capi_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  producer_user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversion_urn TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  event_source TEXT,
  external_user_id TEXT,
  event_value NUMERIC(10, 2),
  event_currency TEXT DEFAULT 'NOK',
  custom_properties JSONB DEFAULT '{}'::jsonb,
  delivery_status TEXT DEFAULT 'pending',
  delivered_at TIMESTAMPTZ,
  linkedin_response JSONB,
  attempt_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT linkedin_capi_event_log_status_check
    CHECK (delivery_status IN ('pending', 'delivered', 'failed', 'retrying'))
);
CREATE INDEX IF NOT EXISTS idx_linkedin_capi_log_config
  ON linkedin_capi_event_log (config_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_capi_log_pending
  ON linkedin_capi_event_log (delivery_status, created_at)
  WHERE delivery_status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_linkedin_capi_log_producer
  ON linkedin_capi_event_log (producer_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS google_offline_conversion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  producer_user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  conversion_action_resource TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  event_source TEXT,
  external_user_id TEXT,
  gclid TEXT,
  event_value NUMERIC(10, 2),
  event_currency TEXT DEFAULT 'NOK',
  enhanced_conversions BOOLEAN DEFAULT FALSE,
  custom_properties JSONB DEFAULT '{}'::jsonb,
  delivery_status TEXT DEFAULT 'pending',
  delivered_at TIMESTAMPTZ,
  google_response JSONB,
  attempt_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT google_offline_conversion_log_status_check
    CHECK (delivery_status IN ('pending', 'delivered', 'failed', 'retrying'))
);
CREATE INDEX IF NOT EXISTS idx_google_capi_log_config
  ON google_offline_conversion_log (config_id);
CREATE INDEX IF NOT EXISTS idx_google_capi_log_pending
  ON google_offline_conversion_log (delivery_status, created_at)
  WHERE delivery_status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_google_capi_log_producer
  ON google_offline_conversion_log (producer_user_id, created_at DESC);

COMMIT;
