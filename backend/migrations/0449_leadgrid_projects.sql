-- 0449_leadgrid_projects.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 1: Isoler Leadgrid fra The Role Rooms `casting_projects`.
--
-- Leadgrid (Lead Map) er et eget produkt og skal ikke dele prosjekttabell med
-- Role Room-casting. Denne migrasjonen oppretter Leadgrids egen tabell og
-- backfiller eksisterende Leadgrid-prosjekter.
--
-- id-rommet (TEXT) bevares 1:1 fra casting_projects slik at nedstrøms
-- tekst-referanser i crm_customers.project_id / brand_kits.project_id /
-- market_scans.project_id (alle VARCHAR uten FK) fortsatt løser korrekt.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leadgrid_projects (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  project_type TEXT,
  industry TEXT,
  geo_region JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS leadgrid_projects_org_idx
  ON leadgrid_projects (organization_id);
CREATE INDEX IF NOT EXISTS leadgrid_projects_status_idx
  ON leadgrid_projects (status);
CREATE INDEX IF NOT EXISTS leadgrid_projects_type_idx
  ON leadgrid_projects (project_type);
CREATE INDEX IF NOT EXISTS leadgrid_projects_created_by_idx
  ON leadgrid_projects (created_by);

DROP TRIGGER IF EXISTS update_leadgrid_projects_updated_at ON leadgrid_projects;
CREATE TRIGGER update_leadgrid_projects_updated_at
  BEFORE UPDATE ON leadgrid_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Backfill: eksisterende Leadgrid-prosjekter ──
-- Prosjekttypene Leadgrid skriver ('b2b_sales' er fremtidig, de øvrige er i
-- produksjon). Role Room-casting (feature_film / film / documentary / null)
-- forblir i casting_projects.
INSERT INTO leadgrid_projects
  (id, organization_id, name, description, status, project_type,
   settings, metadata, created_by, created_at, updated_at)
SELECT id, organization_id, name, description, status, project_type,
       settings, metadata, created_by, created_at, updated_at
  FROM casting_projects
 WHERE project_type IN ('crm', 'kundeprosjekt', 'content_production', 'b2b_sales')
ON CONFLICT (id) DO NOTHING;
