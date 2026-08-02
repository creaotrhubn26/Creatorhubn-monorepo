-- =====================================================================
-- 0379_geo_discovered_brands.sql
--
-- Merkevare-discovery i GEO-proben: LLM-ekstraherte merkenavn fra
-- AI-svarene UTOVER de kjente konkurrentene — «hvem eier de åpne
-- temaene». Additiv og reversibel (DROP COLUMN discovered_brands).
-- =====================================================================

BEGIN;

ALTER TABLE geo_probe_results
  ADD COLUMN IF NOT EXISTS discovered_brands JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
