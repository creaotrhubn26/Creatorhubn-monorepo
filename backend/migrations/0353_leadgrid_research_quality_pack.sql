-- =====================================================================
-- mig 0353 — Leadgrid research-kvalitets-pakke
--
-- Daniels live-test (2026-06-27) avdekket 50 % feilrate + counter-race
-- + manglende kontakt-info. Denne migrasjonen legger til:
--
--   1. `leadgrid_project_discovery_config` — per-prosjekt ideal-customer-
--      profil for continuous discovery (Daglig 06:00 cron).
--   2. `leadgrid_url_research_items.retry_count` + `last_attempted_at` —
--      sporing av auto-retry på transiente feil (orchestrator_unavailable
--      + places/brreg timeouts + claude rate-limits).
--
-- Begge endringer er idempotente (IF NOT EXISTS overalt).
-- Backward-compat: eksisterende rader får retry_count=0 default + NULL
-- last_attempted_at — pre-existing code som ikke leser disse feltene
-- påvirkes ikke.
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- LAG 1: Continuous Lead Discovery config (én rad per prosjekt)
-- ─────────────────────────────────────────────────────────────────────
-- "Hver morgen kl 06:00 — finn nye leads for MedSide" workflow.
-- Brukerens valg (bransje + by + geo + count) lagres så cron-jobben
-- vet hva den skal spørre Places om uten å lese prosjekt-kontekst på
-- nytt hver runde.
--
-- project_id er VARCHAR(255) for å matche casting_projects.id-type
-- (se [[feedback_migrate_sh_quirks_and_neon_db_access]] — id er VARCHAR
-- på casting_projects mens crm_customers er UUID).

CREATE TABLE IF NOT EXISTS leadgrid_project_discovery_config (
  project_id              VARCHAR(255) PRIMARY KEY,
  industry_query          TEXT,                       -- 'fotograf', 'restaurant', 'tannlege'
  city_filter             TEXT[],                     -- ['Oslo', 'Bergen']
  geography_lat           NUMERIC(9, 6),
  geography_lng           NUMERIC(9, 6),
  geography_radius_km     INTEGER DEFAULT 10,
  count_per_run           INTEGER NOT NULL DEFAULT 10
                          CHECK (count_per_run BETWEEN 1 AND 50),
  auto_discover_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  last_run_at             TIMESTAMPTZ,
  next_run_at             TIMESTAMPTZ,
  total_discoveries       INTEGER NOT NULL DEFAULT 0,
  total_pinned            INTEGER NOT NULL DEFAULT 0,
  organization_id         UUID,
  created_by_user_id      UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cron-jobben velger rader m/ auto_discover_enabled=TRUE og next_run_at
-- <= NOW() — partial index gjør oppslaget billig selv ved 10k prosjekter.
CREATE INDEX IF NOT EXISTS idx_discovery_config_enabled_next_run
  ON leadgrid_project_discovery_config (auto_discover_enabled, next_run_at)
  WHERE auto_discover_enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_discovery_config_org
  ON leadgrid_project_discovery_config (organization_id)
  WHERE organization_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- LAG 2: Retry-tracking på url-research-items
-- ─────────────────────────────────────────────────────────────────────
-- Backend retrier nå transiente feil automatisk (max 3 forsøk m/ expo
-- backoff). retry_count + last_attempted_at gir UI-/audit-innsikt i
-- hvor mange ganger en URL ble forsøkt.

ALTER TABLE leadgrid_url_research_items
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE leadgrid_url_research_items
  ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMPTZ;

-- Quality-score som beregnes fra Places-data (rating, reviews, website,
-- phone) etter research. Persisteres på lead (crm_customers) for
-- enkel filtrering, men også sporet per item for audit.
ALTER TABLE leadgrid_url_research_items
  ADD COLUMN IF NOT EXISTS quality_score INTEGER;

COMMIT;
