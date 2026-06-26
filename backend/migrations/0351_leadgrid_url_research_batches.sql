-- mig 0351 — Bulk URL Research-batches for Leadgrid
--
-- Selger limer inn 20+ URLer; hver kjøres gjennom samme URL-Research-pipeline
-- som mig 0328 (Brreg + website + Google Places + Claude synthesis), men nå
-- gruppert i en batch slik at UI kan vise "X av Y leads lagt til på kartet".
--
-- To tabeller:
--   leadgrid_url_research_batches  — én rad per bulk-jobb m/ progress-counters.
--   leadgrid_url_research_items    — én rad per URL i jobben m/ per-URL-status.
--
-- Atskilt fra leadgrid_import_batches (mig 0328) fordi CSV-batchen og URL-
-- batchen har ulik livssyklus + ulike per-item-felter (CSV = ferdig-importert
-- rad; URL = research-pipeline m/ has_pin + location_confidence).
--
-- Idempotent: IF NOT EXISTS overalt.

BEGIN;

-- Batch-jobber for bulk-URL-research
CREATE TABLE IF NOT EXISTS leadgrid_url_research_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  created_by      UUID NOT NULL,
  total_urls      INTEGER NOT NULL,
  completed_urls  INTEGER NOT NULL DEFAULT 0,
  failed_urls     INTEGER NOT NULL DEFAULT 0,
  pinned_leads    INTEGER NOT NULL DEFAULT 0,  -- leads med lat/lng (pin på kartet)
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'partial', 'cancelled')),
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_url_batches_org
  ON leadgrid_url_research_batches(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_url_batches_user
  ON leadgrid_url_research_batches(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_url_batches_status_active
  ON leadgrid_url_research_batches(status)
  WHERE status IN ('pending', 'running');

-- Per-URL-items i en batch
CREATE TABLE IF NOT EXISTS leadgrid_url_research_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id            UUID NOT NULL REFERENCES leadgrid_url_research_batches(id) ON DELETE CASCADE,
  url                 TEXT NOT NULL,
  order_index         INTEGER NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  draft_lead_id       UUID,
  final_lead_id       UUID,
  has_pin             BOOLEAN NOT NULL DEFAULT FALSE,  -- ble lat/lng populert?
  location_confidence VARCHAR(20),                      -- 'exact', 'geocoded', 'approximate', 'unknown'
  error_message       TEXT,
  research_result     JSONB,
  started_at          TIMESTAMPTZ,
  finished_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_url_items_batch
  ON leadgrid_url_research_items(batch_id, order_index);
CREATE INDEX IF NOT EXISTS idx_url_items_status
  ON leadgrid_url_research_items(batch_id, status);
CREATE INDEX IF NOT EXISTS idx_url_items_draft
  ON leadgrid_url_research_items(draft_lead_id)
  WHERE draft_lead_id IS NOT NULL;

COMMIT;
