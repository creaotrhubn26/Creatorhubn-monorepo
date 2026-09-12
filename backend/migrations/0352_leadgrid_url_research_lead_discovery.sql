-- mig 0352 — Lead-discovery-meta for url-research-batches
--
-- Pakke 9 (Research-fanen). Når Daniel klikker «Finn leads for MedSide»
-- på iPad, oppretter vi en url-research-batch med kategori 'lead_discovery'
-- istedenfor 'bulk_url'. Vi trenger to nye nullable-felt på
-- leadgrid_url_research_batches:
--
--   category        — 'bulk_url' (default) | 'lead_discovery'
--   discovery_meta  — JSONB med prosjekt-id, navn, query, by, bransje, geo
--
-- Batchen+items selv gjenbruker eksisterende kolonner og processor — vi
-- legger bare TIL metadata slik at result-endpointet kan vise riktig
-- "Vi fant N leads for {Prosjektnavn}"-banner.
--
-- Idempotent.

BEGIN;

ALTER TABLE leadgrid_url_research_batches
  ADD COLUMN IF NOT EXISTS category VARCHAR(32) NOT NULL DEFAULT 'bulk_url';

ALTER TABLE leadgrid_url_research_batches
  ADD COLUMN IF NOT EXISTS discovery_meta JSONB;

-- Index gjør det billig å liste «mine lead-discovery-batches» per bruker
-- (Research-fanen kan vise siste 10 historiske kjøringer for en bruker).
CREATE INDEX IF NOT EXISTS idx_leadgrid_url_research_batches_category
  ON leadgrid_url_research_batches (category, created_by, created_at DESC);

COMMIT;
