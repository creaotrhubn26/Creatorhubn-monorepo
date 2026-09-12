-- =====================================================================
-- 0378_import_batches.sql
--
-- Manuell import som førsteklasses datakilde (integrasjonsplanen steg 4,
-- docs/integration-audit/05 §4): hver import er en batch-entitet med
-- lineage (hvem/når/hva/mapping), og hvert signal peker tilbake via
-- metadata.importBatchId. Sletting av batch = sletting av signalene
-- (håndteres i service-laget — signaler har ikke FK, de lever i
-- normalized_signals med provider='manual-trend-import' e.l.).
--
-- Additiv og reversibel (DROP TABLE import_batches).
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS import_batches (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_owner_user_id  VARCHAR(255) NOT NULL,
  -- Registry-id for kilden signalene tilskrives (f.eks. 'manual-trend-import')
  provider                 VARCHAR(80) NOT NULL,
  source_type              VARCHAR(32) NOT NULL DEFAULT 'manual_upload'
                           CHECK (source_type IN ('manual_upload','user_imported')),
  filename                 TEXT,
  preset                   VARCHAR(40),          -- 'google-trends-csv' | 'generic'
  column_mapping           JSONB NOT NULL DEFAULT '{}'::jsonb,
  row_count                INTEGER NOT NULL DEFAULT 0,
  inserted_count           INTEGER NOT NULL DEFAULT 0,
  skipped_duplicates       INTEGER NOT NULL DEFAULT 0,
  rejected_rows            INTEGER NOT NULL DEFAULT 0,
  status                   VARCHAR(16) NOT NULL DEFAULT 'committed'
                           CHECK (status IN ('committed','deleted')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_owner
  ON import_batches (workspace_owner_user_id, created_at DESC);

COMMIT;
