-- 278_lead_map_campaigns.sql
--
-- Lead Map ↔ Marketing Cockpit-integrasjon (Fase 7 av MI-modulen).
--
-- En "lead_map_campaign" = et målbart oppdrag for å konvertere et bestemt
-- segment av Lead Map-leads. F.eks. "Restauranter i Oslo, mål 100, hvorav
-- 20 til møte". Kampanjen filtrerer på (kategori, region, status) og gir
-- analytics på conversion-rate per område/kategori/koordinator.
--
-- Re-engagement: declined > N dager → automatisk re-aktivering med ny
-- follow-up-tidspunkt.

BEGIN;

CREATE TABLE IF NOT EXISTS lead_map_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Eier
  workspace_owner_user_id VARCHAR(255) NOT NULL,
  agent_config_id UUID, -- valgfri for multi-tenant (Wave LM-Agent)

  -- Identifikasjon
  name VARCHAR(500) NOT NULL,
  description TEXT,

  -- Segment-definisjon (filtrene som avgjør hvilke leads som er med)
  filter_category VARCHAR(60),
  filter_region VARCHAR(100),
  filter_city VARCHAR(100),
  filter_lead_status JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- F.eks. ["unvisited", "interested"] — kun disse statusene teller
    -- som "i pipeline".

  -- Mål
  target_total_leads INT NOT NULL DEFAULT 100,
  target_won_leads INT NOT NULL DEFAULT 5,

  -- State
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),

  -- Koblinger til MI
  market_scan_id UUID REFERENCES market_scans(id) ON DELETE SET NULL,
  brand_kit_id UUID REFERENCES brand_kits(id) ON DELETE SET NULL,
  related_workflow_id UUID REFERENCES marketing_workflows(id) ON DELETE SET NULL,

  -- Re-engagement-policy
  re_engagement_days INT NOT NULL DEFAULT 90,
    -- Declined leads får ny mulighet etter N dager
  auto_re_engagement_enabled BOOLEAN NOT NULL DEFAULT true,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lmc_owner ON lead_map_campaigns (workspace_owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lmc_status ON lead_map_campaigns (status) WHERE status IN ('active', 'paused');
CREATE INDEX IF NOT EXISTS idx_lmc_agent_config ON lead_map_campaigns (agent_config_id) WHERE agent_config_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lmc_category ON lead_map_campaigns (filter_category) WHERE filter_category IS NOT NULL;

-- Manuell tilknytning av lead til kampanje (utover filter-baserte treff)
-- Tillater forced include/exclude av enkelt-leads.
CREATE TABLE IF NOT EXISTS lead_map_campaign_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES lead_map_campaigns(id) ON DELETE CASCADE,
  customer_id VARCHAR(255) NOT NULL, -- crm_customers.id

  -- 'forced_in' = bruker har eksplisitt lagt til selv om filteret ikke
  -- matcher. 'forced_out' = bruker har ekskludert selv om filteret matcher.
  membership_type VARCHAR(15) NOT NULL DEFAULT 'matched'
    CHECK (membership_type IN ('matched', 'forced_in', 'forced_out')),

  added_by_user_id VARCHAR(255),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (campaign_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_lmcm_campaign ON lead_map_campaign_members (campaign_id);
CREATE INDEX IF NOT EXISTS idx_lmcm_customer ON lead_map_campaign_members (customer_id);

-- Audit-trail på status-overganger per lead i en kampanje
-- (separat fra crm_lead_activities som er global)
CREATE TABLE IF NOT EXISTS lead_map_campaign_lead_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES lead_map_campaigns(id) ON DELETE CASCADE,
  customer_id VARCHAR(255) NOT NULL,
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  changed_by_user_id VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lmclh_campaign ON lead_map_campaign_lead_history (campaign_id, created_at DESC);

DROP TRIGGER IF EXISTS lead_map_campaigns_updated_at ON lead_map_campaigns;
CREATE TRIGGER lead_map_campaigns_updated_at
  BEFORE UPDATE ON lead_map_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION market_intel_set_updated_at();

COMMIT;
