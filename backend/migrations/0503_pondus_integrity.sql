-- Migration 0503: Pondus integrity with explainable scoring, recoverable templates and exact usage.
-- sessions and server-versioned quiz scoring. Additive and backfill-safe.
BEGIN;

ALTER TABLE pondus_templates
  ADD COLUMN IF NOT EXISTS analysis_meta JSONB NOT NULL DEFAULT '{"rubric_version":"legacy","confidence":0,"evidence":{},"recommendations":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pondus_templates_org_active
  ON pondus_templates(org_id, is_published, updated_at DESC)
  WHERE archived_at IS NULL;

ALTER TABLE pondus_template_usage
  ADD COLUMN IF NOT EXISTS usage_session_id UUID,
  ADD COLUMN IF NOT EXISTS outcome_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'ipad';

UPDATE pondus_template_usage
   SET usage_session_id = id
 WHERE usage_session_id IS NULL;

ALTER TABLE pondus_template_usage
  ALTER COLUMN usage_session_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pondus_usage_session
  ON pondus_template_usage(usage_session_id);

CREATE INDEX IF NOT EXISTS idx_pondus_usage_org_template_session
  ON pondus_template_usage(organization_id, template_id, usage_session_id);

ALTER TABLE leadgrid_pondus_quiz_results
  ADD COLUMN IF NOT EXISTS scoring_version VARCHAR(80) NOT NULL DEFAULT 'legacy-client-v1';

COMMIT;
