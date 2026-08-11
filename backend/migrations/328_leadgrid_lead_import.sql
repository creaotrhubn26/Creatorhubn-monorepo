-- =====================================================================
-- 328_leadgrid_lead_import.sql
--
-- CSV/Excel-import + URL-basert lead-research (Leadgrid one-pager
-- seksjon 1 "DISCOVER & IMPORT LEADS").
--
-- Endringer:
--   - crm_customers.import_source   — 'csv_import' / 'url_research' /
--                                     'manual' / 'business_card' / etc.
--                                     (NB: tabellen har allerede en
--                                     generisk `source`-kolonne; vi
--                                     legger til en mer spesifikk
--                                     `import_source` for å skille
--                                     import-flyter fra discovery-flyter.)
--   - crm_customers.import_batch_id — UUID, grupperer leads importert
--                                     samtidig (én CSV-fil eller én
--                                     URL-research-batch) — gjør rollback
--                                     trivielt.
--   - crm_customers.import_raw_data — JSONB, rå parsed data (CSV-rad
--                                     før mapping eller original URL for
--                                     URL-research). For debugging.
--   - crm_customers.draft_status    — 'draft' | 'lead' | 'rejected'.
--                                     URL-research-flyten oppretter
--                                     draft-leads som markedssjef må
--                                     akseptere før de teller som ekte
--                                     leads. Alle eksisterende rader
--                                     defaulter til 'lead'.
--
--   - leadgrid_import_batches       — ny tabell, én rad per import-
--                                     batch. Sporer hvem som importerte,
--                                     hvor mange leads som ble innsatt /
--                                     hoppet over, og kildefilen.
--
--   - 3 permissions + role-binding.
--
-- Avgjørelse 2026-06-26 — vi har FJERNET den dedikerte
-- `leadgrid_import_url_rate`-tabellen. URL-research-flyten gjenbruker
-- eksisterende `runBrandScan()` + `role-room-agent-cache` som allerede
-- har rate-limiting og result-cache. En dedikert URL-rate-tabell ville
-- bare duplisert den infrastrukturen.
-- =====================================================================

BEGIN;

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS import_source VARCHAR(40),
  ADD COLUMN IF NOT EXISTS import_batch_id UUID,
  ADD COLUMN IF NOT EXISTS import_raw_data JSONB,
  ADD COLUMN IF NOT EXISTS draft_status VARCHAR(20) DEFAULT 'lead';

CREATE INDEX IF NOT EXISTS idx_crm_customers_import_batch
  ON crm_customers(import_batch_id)
  WHERE import_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_import_source
  ON crm_customers(import_source)
  WHERE import_source IS NOT NULL;

-- Vi filtrerer på (organization_id, draft_status) for å skjule drafts
-- fra hovedkartet og dashboards. Partial-index for å holde det lett.
CREATE INDEX IF NOT EXISTS idx_crm_customers_draft_status
  ON crm_customers(organization_id, draft_status)
  WHERE archived_at IS NULL AND draft_status <> 'lead';

CREATE TABLE IF NOT EXISTS leadgrid_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  owner_user_id VARCHAR(255) NOT NULL,
  import_source VARCHAR(40) NOT NULL,         -- 'csv_import' | 'url_research'
  file_name TEXT,                             -- original filnavn (CSV/XLSX) eller URL
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  skipped_duplicates INTEGER NOT NULL DEFAULT 0,
  errors_count INTEGER NOT NULL DEFAULT 0,
  errors_sample JSONB,                        -- første 10 feil for debugging
  dedupe_strategy VARCHAR(40),                -- 'email' | 'phone' | 'name+city' | 'none'
  column_mapping JSONB,                       -- for CSV: { name: 'Bedrift', email: 'E-post', ... }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_import_batches_org
  ON leadgrid_import_batches(organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leadgrid_import_batches_user
  ON leadgrid_import_batches(owner_user_id, created_at DESC);

INSERT INTO permissions (key, category, description) VALUES
  ('leads.import_csv',   'Import', 'Importere leads fra CSV/Excel-fil'),
  ('leads.import_url',   'Import', 'Research leads fra URL via Role Room Agent'),
  ('leads.import_admin', 'Import', 'Se og rulle tilbake andres import-batches')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, permission_key) VALUES
  ('admin',           'leads.import_csv'),
  ('admin',           'leads.import_url'),
  ('admin',           'leads.import_admin'),
  ('salgssjef',       'leads.import_csv'),
  ('salgssjef',       'leads.import_url'),
  ('salgssjef',       'leads.import_admin'),
  ('teamleder',       'leads.import_csv'),
  ('teamleder',       'leads.import_url'),
  ('salgskonsulent',  'leads.import_csv'),
  ('salgskonsulent',  'leads.import_url')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
