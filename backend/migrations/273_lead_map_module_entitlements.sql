-- =====================================================================
-- 273_lead_map_module_entitlements.sql
--
-- Wave LM-Agent Fase 2 — Lead Map som betalt modul i Role Room Agent.
--
-- Modell: 3 tier (discover/pro/agency) — bruker velger én per
-- client_ads_configs (én klient = én tier).
--
-- Speil av role_room_agent_entitlements-mønsteret (migrasjon 0046) men
-- per config (ikke per user) siden Lead Map er en klient-vendt tjeneste
-- byrået leverer.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS lead_map_module_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Hvilken klient (config) er entitled
  config_id UUID NOT NULL,
  -- Hvem eier (produsent som administrerer) configen
  producer_user_id VARCHAR(255) NOT NULL,

  -- Tier: discover (299/mnd), pro (599/mnd), agency (1490/mnd)
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('discover', 'pro', 'agency')),

  status VARCHAR(20) NOT NULL CHECK (status IN ('trial', 'active', 'expired', 'revoked')),

  -- Hvor entitlement kommer fra
  source VARCHAR(40) NOT NULL CHECK (source IN (
    'stripe_subscription', 'trial', 'admin_grant', 'included_in_plan'
  )),

  -- Trial-perioden (kun for status='trial')
  trial_ends_at TIMESTAMPTZ,

  -- Stripe-refs
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  stripe_customer_id TEXT,

  -- Per-tier quota (NULL = ubegrenset)
  leads_per_month_limit INTEGER,
  ai_pitches_per_month_limit INTEGER,

  notes TEXT,

  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,                          -- For subscription cancel-at-period-end

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Én aktiv entitlement per config (revoked beholdes for audit)
CREATE UNIQUE INDEX IF NOT EXISTS lead_map_entitlements_active_idx
  ON lead_map_module_entitlements(config_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS lead_map_entitlements_producer_idx
  ON lead_map_module_entitlements(producer_user_id, granted_at DESC);

CREATE INDEX IF NOT EXISTS lead_map_entitlements_subscription_idx
  ON lead_map_module_entitlements(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ── Usage-counter for å håndheve quota ─────────────────────────────
CREATE TABLE IF NOT EXISTS lead_map_module_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id UUID NOT NULL REFERENCES lead_map_module_entitlements(id) ON DELETE CASCADE,
  config_id UUID NOT NULL,
  -- Periode: 'YYYY-MM' (måneds-bucket)
  billing_period CHAR(7) NOT NULL,
  leads_imported INTEGER NOT NULL DEFAULT 0,
  ai_pitches_generated INTEGER NOT NULL DEFAULT 0,
  visits_logged INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entitlement_id, billing_period)
);

CREATE INDEX IF NOT EXISTS lead_map_usage_config_idx
  ON lead_map_module_usage(config_id, billing_period DESC);

COMMIT;
