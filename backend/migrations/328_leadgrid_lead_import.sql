-- =====================================================================
-- 328_leadgrid_lead_import.sql
--
-- CSV/Excel-import + URL-Research-flyt (Leadgrid one-pager seksjon 1
-- "DISCOVER & IMPORT LEADS").
--
-- To flyter som begge ender med en lead-pin på Lead Map:
--   1. CSV/Excel — bulk-import fra Pipedrive/HubSpot/regneark.
--   2. URL Research — bruker limer inn URL i iPad → Role Room Agents
--      research-stack (Brreg → website → Google Places → Claude
--      synthesis) → draft-lead opprettes → preview m/ lokasjons-
--      konfidens → commit → pin på kartet.
--
-- Endringer:
--   - crm_customers.import_source       — 'csv_import' / 'url_research' /
--                                         'manual' / 'business_card' / etc.
--   - crm_customers.import_batch_id     — UUID, grupperer leads i én
--                                         import-batch (gjør rollback
--                                         trivielt).
--   - crm_customers.import_raw_data     — JSONB, hele orchestrator-
--                                         payload (companyProfile +
--                                         competitors + synthesis) for
--                                         debugging og refresh-section.
--   - crm_customers.draft_status        — 'draft' | 'researched' | 'lead'
--                                         | 'rejected'. NULL for legacy-
--                                         rader. Filtrerer drafts ut av
--                                         Lead Map-spørringer.
--   - crm_customers.location_confidence — 'exact' | 'geocoded' |
--                                         'approximate' | 'unknown'.
--                                         Driver badge i preview-UI så
--                                         brukeren kan korrigere
--                                         by-sentroid-koordinater før
--                                         commit.
--
--   - leadgrid_import_batches  — én rad per import-batch (CSV-fil
--                                 eller én URL-Research-kjøring).
--
-- NB: URL-rate-limiting (leadgrid_import_url_rate fra tidligere utkast)
-- er FJERNET — Role Room Agent har egen ratelimit + Claude-cache som
-- dekker dette behovet.
--
--   - 3 permissions + role-binding.
-- =====================================================================

BEGIN;

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS import_source VARCHAR(40),
  ADD COLUMN IF NOT EXISTS import_batch_id UUID,
  ADD COLUMN IF NOT EXISTS import_raw_data JSONB,
  ADD COLUMN IF NOT EXISTS draft_status VARCHAR(20)
    CHECK (draft_status IS NULL OR draft_status IN (
      'draft','researched','lead','rejected'
    )),
  ADD COLUMN IF NOT EXISTS location_confidence VARCHAR(20)
    CHECK (location_confidence IS NULL OR location_confidence IN (
      'exact','geocoded','approximate','unknown'
    ));

CREATE INDEX IF NOT EXISTS idx_crm_customers_import_batch
  ON crm_customers(import_batch_id)
  WHERE import_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_import_source
  ON crm_customers(import_source)
  WHERE import_source IS NOT NULL;

-- Drafts (research_in_progress) skal ikke vises på kartet før
-- brukeren har akseptert. Lead Map-spørringer kan legge på
-- AND (draft_status IS NULL OR draft_status = 'lead').
CREATE INDEX IF NOT EXISTS idx_crm_customers_draft_status
  ON crm_customers(organization_id, draft_status)
  WHERE archived_at IS NULL AND draft_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_location_confidence
  ON crm_customers(location_confidence)
  WHERE archived_at IS NULL AND location_confidence IS NOT NULL;

CREATE TABLE IF NOT EXISTS leadgrid_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  owner_user_id VARCHAR(255) NOT NULL,
  import_source VARCHAR(40) NOT NULL,         -- 'csv_import' | 'url_research'
  file_name TEXT,                             -- original filnavn (CSV/XLSX) eller URL (research)
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
  ('leads.import_url',   'Import', 'Kjøre URL-Research og opprette leads fra orchestrator-payload'),
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
