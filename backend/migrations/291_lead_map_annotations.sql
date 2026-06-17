-- 291_lead_map_annotations.sql
--
-- Kart-annotasjoner — salgssjef/teamleder tegner direkte på Lead Map
-- for å vise selgere hvor de skal fokusere, ruter de skal kjøre,
-- eller markere et område som "varm sone".
--
-- Annotasjon-typer:
--   focus_area   — polygon/sirkel-område selgeren bør prioritere
--   route        — pol-yline (rute) fra A til B
--   pin_callout  — tekst-boble festet til en lead-pin
--   freehand     — Apple Pencil-strek (PencilKit-eksport)
--
-- Geometry lagres som GeoJSON i JSONB:
--   { type: "Polygon", coordinates: [[[lng,lat],...]] }
--   { type: "LineString", coordinates: [[lng,lat],...] }
--   { type: "Point", coordinates: [lng,lat] }
--
-- Lifecycle:
--   - assigned_to_user_id: tildelt EN spesifikk selger
--     (NULL = synlig for hele org-en)
--   - target_lead_id: knyttet til et spesifikt lead
--   - expires_at: midlertidig fokus (auto-skjult etter dato)
--   - archived_at: skjult uten å slette (historikk)

BEGIN;

CREATE TABLE IF NOT EXISTS map_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE CASCADE,
  project_id VARCHAR(255) REFERENCES casting_projects(id) ON DELETE SET NULL,
  created_by_user_id VARCHAR(255) NOT NULL
    REFERENCES users(id) ON DELETE SET NULL,
  -- 'focus_area' | 'route' | 'pin_callout' | 'freehand'
  annotation_type VARCHAR(30) NOT NULL
    CHECK (annotation_type IN ('focus_area','route','pin_callout','freehand')),
  -- GeoJSON-geometry
  geometry JSONB NOT NULL,
  title VARCHAR(200),
  body TEXT,
  -- Hex-farge for rendering (default lilla)
  color VARCHAR(20) NOT NULL DEFAULT '#c084fc',
  -- Stroke-bredde (PencilKit) eller line-width (focus_area)
  stroke_width REAL NOT NULL DEFAULT 3.0,
  -- Hvilken selger skal "se" denne (NULL = hele org-en)
  assigned_to_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  -- Knytte til et spesifikt lead (pin_callout)
  target_lead_id UUID REFERENCES crm_customers(id) ON DELETE SET NULL,
  -- Auto-skjul etter dato
  expires_at TIMESTAMPTZ,
  -- Skjul uten å slette
  archived_at TIMESTAMPTZ,
  archived_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Aktive annotasjoner per org (mest brukt — render på kart).
-- NB: partial index kan IKKE ha NOW() i predicate (kun IMMUTABLE-
-- funksjoner). Vi sjekker derfor bare archived_at — query-laget må
-- også filtrere expires_at i WHERE-clausen.
CREATE INDEX IF NOT EXISTS idx_map_annotations_org_active
  ON map_annotations (organization_id, created_at DESC)
  WHERE archived_at IS NULL;

-- Per-bruker tildelte (mine fokusområder)
CREATE INDEX IF NOT EXISTS idx_map_annotations_assigned
  ON map_annotations (assigned_to_user_id, created_at DESC)
  WHERE archived_at IS NULL
    AND assigned_to_user_id IS NOT NULL;

-- Per-lead (callout-bobler ved spesifikk pin)
CREATE INDEX IF NOT EXISTS idx_map_annotations_target_lead
  ON map_annotations (target_lead_id)
  WHERE archived_at IS NULL AND target_lead_id IS NOT NULL;

-- Per-prosjekt (filter på kart)
CREATE INDEX IF NOT EXISTS idx_map_annotations_project
  ON map_annotations (project_id)
  WHERE project_id IS NOT NULL AND archived_at IS NULL;

COMMIT;
