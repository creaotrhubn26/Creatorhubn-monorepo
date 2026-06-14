-- 277_marketing_workflow_analytics.sql
--
-- Læringsløkke (Fase 6 av MI-modulen).
--
-- Når en publisert post som ble generert FRA en opportunity får analytics-
-- data (impressions, engasjement, klikk, konverteringer), kobler vi
-- resultatene TILBAKE til opportunity + market_scan slik at vi kan
-- lære hvilke anbefalinger som faktisk fungerer.
--
-- Denne tabellen lagrer aggregerte performance-scores per workflow.
-- Daniel kan se "Top fungerende anbefalinger" basert på reell data.

BEGIN;

CREATE TABLE IF NOT EXISTS marketing_workflow_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workflow_id UUID NOT NULL REFERENCES marketing_workflows(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES market_scan_opportunities(id) ON DELETE SET NULL,
  market_scan_id UUID REFERENCES market_scans(id) ON DELETE SET NULL,
  brand_kit_id UUID REFERENCES brand_kits(id) ON DELETE SET NULL,

  -- Aggregat per draft (kun publiserte poster teller)
  total_drafts_published INT NOT NULL DEFAULT 0,
  total_impressions BIGINT NOT NULL DEFAULT 0,
  total_engagements BIGINT NOT NULL DEFAULT 0,
  total_clicks BIGINT NOT NULL DEFAULT 0,
  total_conversions BIGINT NOT NULL DEFAULT 0,
  total_revenue_nok NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Beregnet performance-score 0–100
  performance_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  performance_tier VARCHAR(10) NOT NULL DEFAULT 'unrated'
    CHECK (performance_tier IN ('unrated', 'low', 'medium', 'high', 'top')),

  -- Claude-generert sammendrag og læring
  insight_summary TEXT,
  what_worked TEXT,
  what_didnt_work TEXT,
  recommendation_adjustment TEXT,

  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_compute_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_mwa_workflow ON marketing_workflow_analytics (workflow_id);
CREATE INDEX IF NOT EXISTS idx_mwa_opportunity ON marketing_workflow_analytics (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_mwa_scan ON marketing_workflow_analytics (market_scan_id);
CREATE INDEX IF NOT EXISTS idx_mwa_tier_score ON marketing_workflow_analytics (performance_tier, performance_score DESC);
CREATE INDEX IF NOT EXISTS idx_mwa_next_compute ON marketing_workflow_analytics (next_compute_at) WHERE next_compute_at <= NOW();

-- For å gi opportunities en "lært-historikk" som agenten kan bruke
ALTER TABLE market_scan_opportunities
  ADD COLUMN IF NOT EXISTS learned_performance_tier VARCHAR(10)
    CHECK (learned_performance_tier IN ('unrated', 'low', 'medium', 'high', 'top'));

ALTER TABLE market_scan_opportunities
  ADD COLUMN IF NOT EXISTS times_acted_on INT NOT NULL DEFAULT 0;

ALTER TABLE market_scan_opportunities
  ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMPTZ;

COMMIT;
