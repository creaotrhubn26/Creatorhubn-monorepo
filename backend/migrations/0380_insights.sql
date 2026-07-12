-- =====================================================================
-- 0380_insights.sql
--
-- Innsiktsmotoren fase 1 (docs/integration-audit/10): innsikter som
-- førsteklasses entiteter — detektor-funn over normalized_signals/
-- geo-data, med evidens-referanser, konfidens og dedup-nøkkel.
--
-- Additiv og reversibel (DROP TABLE insights).
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS insights (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_owner_user_id  VARCHAR(255),
  detector                 VARCHAR(60) NOT NULL,
  -- Deterministisk nøkkel per funn — samme funn re-detektert = no-op
  dedupe_key               TEXT NOT NULL,
  severity                 VARCHAR(16) NOT NULL
                           CHECK (severity IN ('info','notable','important','critical')),
  confidence               REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  title                    TEXT NOT NULL,
  explanation              TEXT NOT NULL,
  -- Evidens-plikt: radene påstanden bygger på ({ref, label, value}[])
  evidence                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  topic                    TEXT,
  status                   VARCHAR(16) NOT NULL DEFAULT 'new'
                           CHECK (status IN ('new','seen','dismissed','actioned')),
  period_start             TIMESTAMPTZ,
  period_end               TIMESTAMPTZ,
  detected_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_insights_org_status
  ON insights (organization_id, status, detected_at DESC);

COMMIT;
