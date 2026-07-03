-- =====================================================================
-- mig 0362 — Discovery multi-query-rotasjon
--
-- Bakgrunn (Holy Crust, 2026-07-03): et prosjekt kan trenge FLERE
-- partner-ICPer (fotballklubb + dagligvare + catering + mathall), men
-- configen hadde ett enkelt industry_query-felt. Nå kan configen ha en
-- liste som continuous discovery roterer gjennom — én query per daglige
-- kjøring, round-robin via rotation_index.
--
-- Bakoverkompatibelt: industry_query beholdes som fallback når
-- industry_queries er NULL/tom. Idempotent (IF NOT EXISTS).
-- =====================================================================

BEGIN;

ALTER TABLE leadgrid_project_discovery_config
  ADD COLUMN IF NOT EXISTS industry_queries TEXT[],
  ADD COLUMN IF NOT EXISTS rotation_index INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN leadgrid_project_discovery_config.industry_queries IS
  'Rotasjonsliste av Places-queries. Når satt (ikke-tom) roterer continuous discovery round-robin gjennom lista (rotation_index), og industry_query brukes kun som fallback.';

COMMIT;
