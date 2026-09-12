-- =====================================================================
-- 306_research_scout_phase.sql
--
-- Utvider research-orkestratoren (mig 0298) m/ ny 'scout_leads'-fase
-- + leads_scouted_count-counter.
--
-- Ny faseflyt:
--   pending → claude_scan → geocode_competitors → creating_leads
--          → scout_leads → done | failed
--
-- Hver opprettet lead får automatisk en scout-run (crawl + Claude
-- needs/signals/scoring) før research-økten kan markeres som ferdig.
-- =====================================================================

BEGIN;

ALTER TABLE market_scans DROP CONSTRAINT IF EXISTS market_scans_phase_check;
ALTER TABLE market_scans ADD CONSTRAINT market_scans_phase_check CHECK (phase IN (
  'pending', 'brand_kit', 'claude_scan',
  'geocode_competitors', 'creating_leads', 'scout_leads',
  'done', 'failed'
));

ALTER TABLE market_scans
  ADD COLUMN IF NOT EXISTS leads_scouted_count INT NOT NULL DEFAULT 0;

COMMIT;
