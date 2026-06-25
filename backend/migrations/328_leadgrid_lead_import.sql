-- =====================================================================
-- 328_leadgrid_lead_import.sql
--
-- CSV/Excel-import + URL-basert lead-extraction (Leadgrid one-pager
-- seksjon 1 "DISCOVER & IMPORT LEADS").
--
-- Endringer:
--   - crm_customers.import_source   — 'csv_import' / 'url_extract' /
--                                     'manual' / 'business_card' / etc.
--                                     (NB: tabellen har allerede en
--                                     generisk `source`-kolonne; vi
--                                     legger til en mer spesifikk
--                                     `import_source` for å skille
--                                     import-flyter fra discovery-flyter.)
--   - crm_customers.import_batch_id — UUID, grupperer leads importert
--                                     samtidig (én CSV-fil eller én
--                                     URL-scrape-batch) — gjør rollback
--                                     trivielt.
--   - crm_customers.import_raw_data — JSONB, rå parsed data (CSV-rad
--                                     før mapping eller HTML-meta før
--                                     Claude-ekstraksjon). For debugging.
--
--   - leadgrid_import_batches       — ny tabell, én rad per import-
--                                     batch. Sporer hvem som importerte,
--                                     hvor mange leads som ble innsatt /
--                                     hoppet over, og kildefilen.
--
--   - leadgrid_import_url_rate      — én rad per bruker, per minutt.
--                                     Brukes til rate-limiting av URL-
--                                     scrape (maks 20 URLer / min).
--
--   - 3 permissions + role-binding.
-- =====================================================================

BEGIN;

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS import_source VARCHAR(40),
  ADD COLUMN IF NOT EXISTS import_batch_id UUID,
  ADD COLUMN IF NOT EXISTS import_raw_data JSONB;

CREATE INDEX IF NOT EXISTS idx_crm_customers_import_batch
  ON crm_customers(import_batch_id)
  WHERE import_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_import_source
  ON crm_customers(import_source)
  WHERE import_source IS NOT NULL;

CREATE TABLE IF NOT EXISTS leadgrid_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  owner_user_id VARCHAR(255) NOT NULL,
  import_source VARCHAR(40) NOT NULL,         -- 'csv_import' | 'url_extract'
  file_name TEXT,                             -- original filnavn (CSV/XLSX)
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

-- Rate-limit-tabell. Vi nullstiller ikke aktivt; rader > 1 time gamle
-- ignoreres av spørringen og kan ryddes av cron senere.
CREATE TABLE IF NOT EXISTS leadgrid_import_url_rate (
  user_id VARCHAR(255) NOT NULL,
  minute_bucket TIMESTAMPTZ NOT NULL,         -- date_trunc('minute', now())
  url_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, minute_bucket)
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_import_url_rate_bucket
  ON leadgrid_import_url_rate(minute_bucket);

INSERT INTO permissions (key, category, description) VALUES
  ('leads.import_csv',   'Import', 'Importere leads fra CSV/Excel-fil'),
  ('leads.import_url',   'Import', 'Ekstrahere leads fra URL/SoMe-side (Claude)'),
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
