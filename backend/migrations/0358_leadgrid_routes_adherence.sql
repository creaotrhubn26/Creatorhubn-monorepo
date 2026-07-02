-- =====================================================================
-- mig 0358 — Leadgrid Route Adherence
--
-- Bygger backend-skjemaet for de nye MeMapPin-tap-handlingene og
-- salgssjef-orienterte route-adherence-dashboardet.
--
-- Målet: la selgere i felt bli fulgt opp mot en planlagt daglig rute —
-- posisjons-samples strømmes til backend (per 30s), backend regner
-- avvik fra planlagt rute (deviation_from_planned_m + was_on_route),
-- og salgssjefer får både live «team i nærheten»-oversikt og
-- historiske compliance-rapporter.
--
-- Tabeller som lages (3):
--   1. leadgrid_user_positions      — position-samples fra iOS-klient
--                                     (batch 30s, opptil 30 samples/req).
--                                     Grunnlag for live-tracking + adherence.
--   2. leadgrid_route_assignments   — planlagte ruter (opprettes av
--                                     salgssjef eller genereres av AI-route-
--                                     planner). stops er JSONB-array.
--   3. leadgrid_route_visits        — faktisk besøk-log per stopp,
--                                     m/ deviation_from_planned_m + was_on_route.
--
-- Konvensjoner (matcher 0349/0353/0354):
--   • organizations(id) = UUID, ON DELETE CASCADE
--   • users(id)         = VARCHAR(255) (IKKE UUID) — matcher lead_routes.user_id
--   • PK               = UUID DEFAULT gen_random_uuid()
--   • Timestamps        = TIMESTAMPTZ NOT NULL DEFAULT now()
--   • Idempotent        = IF NOT EXISTS overalt — trygg å kjøre 2 ganger.
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. leadgrid_user_positions — position-samples for adherence-beregning
-- ─────────────────────────────────────────────────────────────────────
-- Klienten sender 30-samples batches hvert 30s. `sampled_at` er den
-- KLIENT-satte timestampen (CLLocation.timestamp) — sample_at brukes til
-- idempotent dedup slik at re-tries ikke doblet-inserter.
CREATE TABLE IF NOT EXISTS leadgrid_user_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed_mps DOUBLE PRECISION,
  heading_deg DOUBLE PRECISION,
  sampled_at TIMESTAMPTZ NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'ios',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_user_positions_user_time
  ON leadgrid_user_positions (user_id, sampled_at DESC);

-- Dedup-index: samme user + samme sampled_at skal ikke lagres to ganger.
-- (Klienten kan re-tryea flush ved nettverksfeil.)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_leadgrid_user_positions_user_time
  ON leadgrid_user_positions (user_id, sampled_at);

-- ─────────────────────────────────────────────────────────────────────
-- 2. leadgrid_route_assignments — planlagt daglig rute
-- ─────────────────────────────────────────────────────────────────────
-- stops = JSONB-array:
--   [{
--     "lead_id": "<lead-uuid-eller-string>",
--     "latitude": 59.9139,
--     "longitude": 10.7522,
--     "order_index": 0,
--     "planned_arrival_time": "09:30",  -- HH:MM (klient-tolket m/ route_date)
--     "planned_duration_min": 30,
--     "notes": "..."
--   }]
-- status: 'planned' | 'active' | 'completed' | 'skipped'
CREATE TABLE IF NOT EXISTS leadgrid_route_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  route_date DATE NOT NULL,
  name TEXT NOT NULL,
  stops JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_stops INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','active','completed','skipped')),
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_route_assignments_user_date
  ON leadgrid_route_assignments (user_id, route_date DESC);

CREATE INDEX IF NOT EXISTS idx_leadgrid_route_assignments_org_date
  ON leadgrid_route_assignments (org_id, route_date DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 3. leadgrid_route_visits — faktisk besøk-log per stopp
-- ─────────────────────────────────────────────────────────────────────
-- ON DELETE CASCADE fra assignment → besøk forsvinner naturlig hvis
-- ruten slettes. stop_lead_id refererer JSON-array-elementet's lead_id
-- (ikke FK — leads i JSONB kan være generert av AI-planner uten
-- crm_customers-rad enda).
CREATE TABLE IF NOT EXISTS leadgrid_route_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES leadgrid_route_assignments(id) ON DELETE CASCADE,
  stop_lead_id VARCHAR(255) NOT NULL,
  arrived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  actual_latitude DOUBLE PRECISION,
  actual_longitude DOUBLE PRECISION,
  deviation_from_planned_m INTEGER,
  was_on_route BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_route_visits_assignment
  ON leadgrid_route_visits (assignment_id, arrived_at);

CREATE INDEX IF NOT EXISTS idx_leadgrid_route_visits_lead
  ON leadgrid_route_visits (stop_lead_id, arrived_at DESC);

COMMIT;
