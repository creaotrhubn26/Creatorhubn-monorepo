-- 0087_role_room_research_cache.sql
-- Cache for forutsetnings-fetchere brukt av per-seksjon-refresh
-- (item #10 fix). Brreg, websiteInsights og businessSignals er felles
-- input til alle seksjonene (competitors / local / merch / social), så
-- vi vil ikke kjøre dem 4 ganger når brukeren oppdaterer 4 seksjoner.
--
-- 24t TTL er valgt fordi: Brreg-data endrer seg sjeldent (årsregnskap,
-- orgform), website-content kan oppdateres oftere men sjelden mer enn
-- daglig, og Google Places business-signals (åpningstider, reviews) er
-- relativt stabile over døgnsskift. Stale-while-revalidate-mønsteret
-- (returner cached + refresh i bakgrunnen) ligger i applikasjonslaget.

CREATE TABLE IF NOT EXISTS role_room_research_cache (
  project_id TEXT NOT NULL,
  cache_key TEXT NOT NULL,         -- 'brreg' | 'website' | 'business_signals' | 'brand_palette'
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (project_id, cache_key)
);

CREATE INDEX IF NOT EXISTS role_room_research_cache_expires_idx
  ON role_room_research_cache (expires_at);

COMMENT ON TABLE role_room_research_cache IS
  'Per-prosjekt cache for tunge research-fetchere som brukes som forutsetning av per-seksjon refresh-endepunktet. TTL ~24t.';
COMMENT ON COLUMN role_room_research_cache.cache_key IS
  'Identifiserer hvilken fetcher dette er en cached respons for. Stabil app-side enum.';
