-- =====================================================================
-- 0376_normalized_signals.sql
--
-- Integrasjonsanalysen steg 3 (docs/integration-audit/05 §2): det
-- normaliserte data-laget alle eksterne integrasjoner konverteres til.
-- Dashboard/AI leser herfra — aldri leverandør-spesifikke responser.
--
-- Kontrakten er backend/server/integrations/normalized-signal-schema.ts
-- (Zod) — denne tabellen speiler den, og skjemaet er sannhetskilden.
--
-- Additiv og reversibel: DROP TABLE normalized_signals; ingen
-- eksisterende tabell røres.
--
-- Nøkkelvalg:
--  * id er TEXT (adapterne lager deterministiske id-er, f.eks.
--    'gsc:<site>|<dato>|<query>|clicks') → naturlig idempotens ved
--    re-sync via ON CONFLICT DO NOTHING.
--  * source_type har CHECK mot den lukkede enum-en — «ikke-godkjent
--    scraping» kan ikke lagres (No Fake Integrations).
--  * organization_id er NOT NULL — tenant-scoping er obligatorisk
--    (samme retning som 0374 satte for market_scans).
--  * workspace_id er TEXT (bruker-id eller workspace-uuid — samme
--    fleksibilitet som resolveOrgIdForUser-mønsteret, der solo-modus
--    bruker userId som scope).
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS normalized_signals (
  id                 TEXT PRIMARY KEY,
  organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id       TEXT NOT NULL,
  project_id         TEXT,

  provider           VARCHAR(80) NOT NULL,   -- registry integrationId
  source_type        VARCHAR(32) NOT NULL
                     CHECK (source_type IN
                       ('official_api','licensed_provider','user_imported',
                        'manual_upload','public_data')),
  source_record_id   TEXT,

  subject_type       VARCHAR(32) NOT NULL
                     CHECK (subject_type IN
                       ('market','competitor','own_property','keyword',
                        'industry','region')),
  subject_id         TEXT,
  topic              TEXT NOT NULL,

  metric_type        VARCHAR(80) NOT NULL,
  metric_value       DOUBLE PRECISION NOT NULL,
  unit               VARCHAR(40) NOT NULL,

  geo_country        CHAR(2),
  geo_region         TEXT,
  geo_city           TEXT,
  geo_postal_code    TEXT,

  period_start       TIMESTAMPTZ NOT NULL,
  period_end         TIMESTAMPTZ NOT NULL,
  CHECK (period_start <= period_end),

  confidence         REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  source_quality     REAL NOT NULL CHECK (source_quality >= 0 AND source_quality <= 1),
  freshness_score    REAL NOT NULL CHECK (freshness_score >= 0 AND freshness_score <= 1),

  is_estimated       BOOLEAN NOT NULL DEFAULT FALSE,
  is_normalized      BOOLEAN NOT NULL DEFAULT TRUE,

  collected_at       TIMESTAMPTZ NOT NULL,
  source_updated_at  TIMESTAMPTZ,

  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Query-mønstrene fra widget-laget: org + topic/metric over tidsvindu
CREATE INDEX IF NOT EXISTS idx_normalized_signals_org_topic
  ON normalized_signals (organization_id, topic, period_start);

CREATE INDEX IF NOT EXISTS idx_normalized_signals_org_metric
  ON normalized_signals (organization_id, metric_type, period_start);

CREATE INDEX IF NOT EXISTS idx_normalized_signals_provider
  ON normalized_signals (provider, collected_at);

-- Dedup-nøkkel for adaptere med source_record_id (oppdragets
-- duplikatkontroll: provider + sourceRecordId + periodStart per org)
CREATE UNIQUE INDEX IF NOT EXISTS uq_normalized_signals_source_record
  ON normalized_signals (organization_id, provider, source_record_id, metric_type, period_start)
  WHERE source_record_id IS NOT NULL;

COMMIT;
