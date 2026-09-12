-- =====================================================================
-- 254_client_ads_configs.sql
--
-- Multi-tenant Google Ads conversion-tracking for The Role Room Agent.
--
-- Innholdsprodusenter setter opp Google Ads conversion-tracking for
-- klienter via Agent. Hver klient har sin egen AW-ID + N conversion-
-- actions tilpasset deres bransje (e-commerce/SaaS/restaurant/etc).
--
-- Modellen lar Agent:
--   1. Analysere klientens nettside med Claude (B1)
--   2. Foreslå conversion-actions (B1 → B4 review)
--   3. OAuth-koble klientens Google Ads-konto (B2)
--   4. Auto-opprette actions via Google Ads API (B3)
--   5. Lagre refresh-token + actions + tracking-config (her)
--   6. Distribuere tracking til klientens site (B5)
--   7. Monitorere conversions live (B6)
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- client_ads_configs — én rad per (klient-prosjekt × innholdsprodusent)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_ads_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  client_project_id UUID NOT NULL,
  content_producer_user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Klient-identifikasjon
  client_name VARCHAR(255) NOT NULL,
  client_website_url TEXT NOT NULL,

  -- Google Ads-identifikatorer
  google_ads_conversion_id VARCHAR(20),       -- AW-XXXXXXXXXX (NULL inntil OAuth fullført)
  google_ads_customer_id VARCHAR(20),         -- Klientens customer-ID (10 sifre, NULL pre-OAuth)
  google_ads_login_customer_id VARCHAR(20),   -- Manager-customer-ID (vår)
  refresh_token_encrypted TEXT,               -- AES-encrypted OAuth refresh-token
  refresh_token_expires_at TIMESTAMPTZ,       -- Når token kan refreshes
  oauth_connected_at TIMESTAMPTZ,             -- Når Daniel/producer koblet OAuth

  -- Site-discovery-metadata (B1 — Claude-analyse)
  site_analyzed_at TIMESTAMPTZ,
  site_analysis_version INTEGER DEFAULT 1,    -- Re-analyser hvis vi forbedrer prompt
  business_type VARCHAR(60),                  -- 'ecommerce' | 'saas' | 'restaurant' | 'consulting' | etc.
  business_subcategory VARCHAR(120),          -- Detaljert: 'fashion-ecommerce', 'b2b-saas', etc.
  claude_analysis JSONB DEFAULT '{}'::jsonb,  -- Full Claude-output: key_pages, CTAs, recommendations
  detected_gtag_id VARCHAR(40),               -- G-XXX hvis Claude oppdager GA4 på klientens site
  detected_gtm_id VARCHAR(40),                -- GTM-XXX hvis GTM brukes

  -- Tracking-deployment (B5)
  tracking_method VARCHAR(20) DEFAULT 'pending'
    CHECK (tracking_method IN ('pending','proxy','gtag_snippets','gtm_api','wordpress_plugin','manual')),
  tracking_proxy_token VARCHAR(64),           -- Token klientens site bruker for å fyre via vår backend (B5)
  tracking_deployed_at TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_test_mode BOOLEAN NOT NULL DEFAULT FALSE,
  setup_completed_at TIMESTAMPTZ,             -- Når alle 3 stegene (analyse + OAuth + deployment) er ferdig

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_client_project_producer
    UNIQUE (client_project_id, content_producer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_client_ads_configs_producer
  ON client_ads_configs(content_producer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_ads_configs_project
  ON client_ads_configs(client_project_id);

CREATE INDEX IF NOT EXISTS idx_client_ads_configs_aw
  ON client_ads_configs(google_ads_conversion_id)
  WHERE google_ads_conversion_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- client_ads_actions — N actions per config (ikke kun 3 — agentforeslå
-- tilpasset bransjen, fra 3 til 7+ per klient)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_ads_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES client_ads_configs(id) ON DELETE CASCADE,

  -- Action-identifikasjon
  action_name VARCHAR(100) NOT NULL,          -- 'product_purchase', 'newsletter_signup', 'demo_booked'
  display_name VARCHAR(200),                  -- "Product purchase" (norsk eller engelsk for UI)

  -- Google Ads-konfig
  google_ads_action_id BIGINT,                -- Resource-ID fra Google Ads API
  google_ads_label VARCHAR(40),               -- 20-tegns hash etter '/' i send_to
  goal_category VARCHAR(40) NOT NULL          -- Google Ads goal-kategori
    CHECK (goal_category IN (
      'purchase','add_to_cart','begin_checkout',
      'submit_lead_form','book_appointment','sign_up','subscribe',
      'request_quote','contact','page_view','outbound_click','other'
    )),

  -- Verdi-konfig
  default_value NUMERIC(10,2),                -- Default-verdi i NOK (Claude foreslår basert på bransje)
  currency VARCHAR(3) DEFAULT 'NOK',
  use_dynamic_value BOOLEAN DEFAULT FALSE,    -- True for e-commerce (cart-value etc.)

  -- Trigger-konfig (B5 — hvor/når fyrer denne)
  trigger_type VARCHAR(20) NOT NULL
    CHECK (trigger_type IN ('page_load','form_submit','click','event','outbound','manual')),
  url_pattern TEXT,                           -- Regex / glob for url-match (page_load trigger)
  trigger_config JSONB DEFAULT '{}'::jsonb,   -- Per-trigger detaljer (form-selector, click-selector etc.)

  -- Claude-suggestion metadata
  suggested_by_claude BOOLEAN DEFAULT TRUE,
  claude_reasoning TEXT,                      -- Hvorfor Claude foreslo denne action

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  google_ads_created_at TIMESTAMPTZ,          -- Når action ble opprettet i Google Ads via API
  last_fired_at TIMESTAMPTZ,                  -- Sist gang vi så denne action fyre

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_config_action_name
    UNIQUE (config_id, action_name)
);

CREATE INDEX IF NOT EXISTS idx_client_ads_actions_config
  ON client_ads_actions(config_id, is_active);

-- ─────────────────────────────────────────────────────────────────────
-- client_ads_events — logg over conversion-fires (B6 — monitoring)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_ads_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  action_id UUID REFERENCES client_ads_actions(id) ON DELETE SET NULL,
  action_name VARCHAR(100) NOT NULL,          -- Denormalisert for analytics

  -- Hendelses-data
  event_value NUMERIC(10,2),
  currency VARCHAR(3),
  user_identifier VARCHAR(120),               -- Hash av email/uid hvis tilgjengelig
  transaction_id VARCHAR(120),                -- For dedup
  page_url TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_address VARCHAR(45),

  -- Google Ads-status
  sent_to_google_ads BOOLEAN DEFAULT FALSE,
  google_ads_response JSONB,                  -- Hva Measurement Protocol returnerte
  google_ads_error TEXT,
  sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_ads_events_config_time
  ON client_ads_events(config_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_ads_events_dedup
  ON client_ads_events(config_id, transaction_id)
  WHERE transaction_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- updated_at-triggere
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_client_ads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_client_ads_configs_updated ON client_ads_configs;
CREATE TRIGGER trg_client_ads_configs_updated
  BEFORE UPDATE ON client_ads_configs
  FOR EACH ROW EXECUTE FUNCTION set_client_ads_updated_at();

DROP TRIGGER IF EXISTS trg_client_ads_actions_updated ON client_ads_actions;
CREATE TRIGGER trg_client_ads_actions_updated
  BEFORE UPDATE ON client_ads_actions
  FOR EACH ROW EXECUTE FUNCTION set_client_ads_updated_at();

COMMIT;
