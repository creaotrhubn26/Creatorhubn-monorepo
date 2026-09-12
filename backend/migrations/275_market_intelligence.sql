-- 275_market_intelligence.sql
--
-- Market Intelligence Scanner (Fase 2 av MI-modulen).
--
-- Et market scan er en orkestrert kjøring som:
--   1. Tar inn en marked-query (industri, region, målgruppe, mål)
--   2. Oppdager konkurrenter (Claude → kandidat-domener)
--   3. Per konkurrent: scanner nettstedet, detekterer funnel-stadier,
--      markedsføringsteknikker, tech stack, content signals, SEO
--   4. Genererer opportunity-anbefalinger (hva produsenten kan gjøre)
--
-- Resultatet konsumeres av:
--   - Market Intelligence Overview/Detail UI (Fase 3)
--   - Marketing Cockpit (Fase 4 — Create Campaign / Content Pack)
--   - Role Room Agent (Fase 5 — kontekst-utvidelse)
--   - Læringsløkke (Fase 6 — analytics → bedre fremtidige anbefalinger)
--
-- Alle confidence-felt har 3 nivåer: 'low' | 'medium' | 'high' (matcher spec).
-- I tillegg har FunnelStage og Technique en 'detected' boolean (på/av).
-- Reliability: aldri presenter gjetninger som fakta — alltid lagre source_urls
-- og evidence_snippet hvor mulig.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. market_scans — én rad per scan-kjøring
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Workspace-isolasjon (samme mønster som lead-map)
  workspace_owner_user_id VARCHAR(255) NOT NULL,
  project_id VARCHAR(255),
  brand_kit_id UUID REFERENCES brand_kits(id) ON DELETE SET NULL,

  -- Hva ble scannet
  name VARCHAR(500) NOT NULL,
  market_query TEXT NOT NULL,
  region VARCHAR(100),
  industry VARCHAR(200),
  target_audience TEXT,
  goal TEXT,

  -- Tilstand
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','running','completed','failed')),
  confidence_summary VARCHAR(10) NOT NULL DEFAULT 'low'
    CHECK (confidence_summary IN ('low','medium','high')),

  -- Run-metadata
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  total_competitors INT NOT NULL DEFAULT 0,
  total_opportunities INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_scans_owner ON market_scans (workspace_owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_scans_project ON market_scans (project_id, created_at DESC) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_market_scans_status ON market_scans (status) WHERE status IN ('running','draft');

-- ─────────────────────────────────────────────────────────────────────
-- 2. market_scan_competitors
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_scan_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_scan_id UUID NOT NULL REFERENCES market_scans(id) ON DELETE CASCADE,

  name VARCHAR(500) NOT NULL,
  domain VARCHAR(500) NOT NULL,
  category VARCHAR(200),
  positioning TEXT,
  primary_offer TEXT,
  primary_cta TEXT,
  pricing_signal TEXT,
  social_proof_signal TEXT,

  confidence VARCHAR(10) NOT NULL DEFAULT 'low'
    CHECK (confidence IN ('low','medium','high')),

  -- Bevis: hvor fant vi dette?
  source_urls JSONB NOT NULL DEFAULT '[]'::jsonb,

  last_scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msc_market_scan ON market_scan_competitors (market_scan_id);
CREATE INDEX IF NOT EXISTS idx_msc_domain ON market_scan_competitors (domain);

-- ─────────────────────────────────────────────────────────────────────
-- 3. market_scan_funnel_stages
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_scan_funnel_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_scan_id UUID NOT NULL REFERENCES market_scans(id) ON DELETE CASCADE,
  competitor_id UUID REFERENCES market_scan_competitors(id) ON DELETE CASCADE,

  stage VARCHAR(40) NOT NULL CHECK (stage IN (
    'awareness','landing_page','lead_magnet','signup','demo_booking',
    'email_nurture','retargeting','checkout','upsell','community','referral'
  )),
  detected BOOLEAN NOT NULL DEFAULT false,
  explanation TEXT NOT NULL,
  evidence TEXT,
  confidence VARCHAR(10) NOT NULL DEFAULT 'low'
    CHECK (confidence IN ('low','medium','high')),
  recommended_action TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msfs_market_scan ON market_scan_funnel_stages (market_scan_id);
CREATE INDEX IF NOT EXISTS idx_msfs_competitor ON market_scan_funnel_stages (competitor_id) WHERE competitor_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 4. market_scan_techniques
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_scan_techniques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_scan_id UUID NOT NULL REFERENCES market_scans(id) ON DELETE CASCADE,
  competitor_id UUID REFERENCES market_scan_competitors(id) ON DELETE CASCADE,

  technique VARCHAR(80) NOT NULL,
  label VARCHAR(200) NOT NULL,
  simple_explanation TEXT NOT NULL,
  detected BOOLEAN NOT NULL DEFAULT false,
  confidence VARCHAR(10) NOT NULL DEFAULT 'low'
    CHECK (confidence IN ('low','medium','high')),
  evidence TEXT,
  why_it_matters TEXT,
  recommended_next_step TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mst_market_scan ON market_scan_techniques (market_scan_id);
CREATE INDEX IF NOT EXISTS idx_mst_competitor ON market_scan_techniques (competitor_id) WHERE competitor_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 5. market_scan_tech_stack
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_scan_tech_stack (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_scan_id UUID NOT NULL REFERENCES market_scans(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES market_scan_competitors(id) ON DELETE CASCADE,

  category VARCHAR(60) NOT NULL,
  tool_name VARCHAR(200) NOT NULL,
  confidence VARCHAR(10) NOT NULL DEFAULT 'low'
    CHECK (confidence IN ('low','medium','high')),
  evidence TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msts_market_scan ON market_scan_tech_stack (market_scan_id);
CREATE INDEX IF NOT EXISTS idx_msts_competitor ON market_scan_tech_stack (competitor_id);

-- ─────────────────────────────────────────────────────────────────────
-- 6. market_scan_content_signals
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_scan_content_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_scan_id UUID NOT NULL REFERENCES market_scans(id) ON DELETE CASCADE,
  competitor_id UUID REFERENCES market_scan_competitors(id) ON DELETE CASCADE,

  -- Strukturert content signal — JSONB siden hvert felt er valgfritt
  -- og struktureres som  { type, value, confidence, evidence }
  signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT,

  -- Overall confidence på signal-batch
  confidence VARCHAR(10) NOT NULL DEFAULT 'low'
    CHECK (confidence IN ('low','medium','high')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mscs_market_scan ON market_scan_content_signals (market_scan_id);

-- ─────────────────────────────────────────────────────────────────────
-- 7. market_scan_opportunities
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_scan_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_scan_id UUID NOT NULL REFERENCES market_scans(id) ON DELETE CASCADE,

  title VARCHAR(500) NOT NULL,
  simple_summary TEXT NOT NULL,
  why_it_matters TEXT NOT NULL,
  evidence_summary TEXT NOT NULL,
  recommended_action TEXT NOT NULL,

  impact VARCHAR(10) NOT NULL DEFAULT 'medium'
    CHECK (impact IN ('low','medium','high')),
  difficulty VARCHAR(10) NOT NULL DEFAULT 'medium'
    CHECK (difficulty IN ('easy','medium','hard')),
  confidence VARCHAR(10) NOT NULL DEFAULT 'medium'
    CHECK (confidence IN ('low','medium','high')),

  can_create_campaign BOOLEAN NOT NULL DEFAULT true,
  can_create_content_pack BOOLEAN NOT NULL DEFAULT true,
  can_create_funnel_map BOOLEAN NOT NULL DEFAULT false,

  -- Source-context for traceability — hvilke competitors/teknikker
  -- denne anbefalingen baserer seg på
  source_competitor_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_technique_ids JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mso_market_scan ON market_scan_opportunities (market_scan_id);
CREATE INDEX IF NOT EXISTS idx_mso_impact ON market_scan_opportunities (market_scan_id, impact DESC);

-- ─────────────────────────────────────────────────────────────────────
-- Triggers: updated_at
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION market_intel_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS market_scans_updated_at ON market_scans;
CREATE TRIGGER market_scans_updated_at
  BEFORE UPDATE ON market_scans
  FOR EACH ROW
  EXECUTE FUNCTION market_intel_set_updated_at();

COMMIT;
