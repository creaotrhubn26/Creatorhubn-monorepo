-- =====================================================================
-- 0521_leadgrid_discovery_marketing_intelligence.sql
--
-- Evidence-bound marketing intelligence generated from Discovery v2.
-- Reports are immutable generation snapshots. Human reviews are append-only
-- learning events; the current review status is projected onto each insight.
-- =====================================================================

BEGIN;

INSERT INTO permissions (key, category, description) VALUES
  ('marketing.discovery_insights.view', 'Marketing',
   'Se evidensbasert markedsinnsikt fra Discovery'),
  ('marketing.discovery_insights.run', 'Marketing',
   'Generere evidensbasert markedsinnsikt fra en Discovery-kjøring'),
  ('marketing.discovery_insights.review', 'Marketing',
   'Godkjenne, avvise og korrigere markedsinnsikt')
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category,
      description = EXCLUDED.description;

-- Marketing users need the established Discovery v2 surface, but lead import
-- remains separately protected by leads.create in the decision route.
INSERT INTO role_permissions (role, permission_key) VALUES
  ('owner', 'lead_research.run'),
  ('owner', 'marketing.discovery_insights.view'),
  ('owner', 'marketing.discovery_insights.run'),
  ('owner', 'marketing.discovery_insights.review'),
  ('markedssjef', 'lead_research.run'),
  ('markedskoordinator', 'lead_research.run'),
  ('seo_spesialist', 'lead_research.run'),
  ('content_ansvarlig', 'lead_research.run'),
  ('performance_marketer', 'lead_research.run'),
  ('markedsanalytiker', 'lead_research.run'),
  ('markedssjef', 'marketing.discovery_insights.view'),
  ('markedssjef', 'marketing.discovery_insights.run'),
  ('markedssjef', 'marketing.discovery_insights.review'),
  ('markedskoordinator', 'marketing.discovery_insights.view'),
  ('markedskoordinator', 'marketing.discovery_insights.run'),
  ('markedskoordinator', 'marketing.discovery_insights.review'),
  ('seo_spesialist', 'marketing.discovery_insights.view'),
  ('seo_spesialist', 'marketing.discovery_insights.run'),
  ('seo_spesialist', 'marketing.discovery_insights.review'),
  ('content_ansvarlig', 'marketing.discovery_insights.view'),
  ('content_ansvarlig', 'marketing.discovery_insights.run'),
  ('content_ansvarlig', 'marketing.discovery_insights.review'),
  ('performance_marketer', 'marketing.discovery_insights.view'),
  ('performance_marketer', 'marketing.discovery_insights.run'),
  ('performance_marketer', 'marketing.discovery_insights.review'),
  ('markedsanalytiker', 'marketing.discovery_insights.view'),
  ('markedsanalytiker', 'marketing.discovery_insights.run'),
  ('markedsanalytiker', 'marketing.discovery_insights.review')
ON CONFLICT (role, permission_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS leadgrid_discovery_intelligence_reports (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id            UUID NOT NULL
                             REFERENCES organizations(id) ON DELETE CASCADE,
  project_id                 TEXT NOT NULL,
  run_id                     UUID NOT NULL,
  skill_key                  VARCHAR(120) NOT NULL
                             DEFAULT 'marketing.discovery_intelligence',
  skill_version              VARCHAR(32) NOT NULL,
  status                     VARCHAR(24) NOT NULL
                             CHECK (status IN (
                               'generating', 'ready',
                               'insufficient_evidence', 'failed'
                             )),
  executive_summary          TEXT,
  evidence_coverage          NUMERIC(5, 4) NOT NULL DEFAULT 0
                             CHECK (evidence_coverage BETWEEN 0 AND 1),
  overall_confidence         NUMERIC(5, 4) NOT NULL DEFAULT 0
                             CHECK (overall_confidence BETWEEN 0 AND 1),
  source_count               INTEGER NOT NULL DEFAULT 0
                             CHECK (source_count >= 0),
  evidence_catalog           JSONB NOT NULL DEFAULT '[]'::jsonb
                             CHECK (jsonb_typeof(evidence_catalog) = 'array'),
  conflicts                  JSONB NOT NULL DEFAULT '[]'::jsonb
                             CHECK (jsonb_typeof(conflicts) = 'array'),
  gaps                       JSONB NOT NULL DEFAULT '[]'::jsonb
                             CHECK (jsonb_typeof(gaps) = 'array'),
  provider                   VARCHAR(40),
  model                      VARCHAR(120),
  error_code                 VARCHAR(80),
  error_message              TEXT,
  requested_by               VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  generated_by               VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  idempotency_key            VARCHAR(255) NOT NULL,
  request_hash               CHAR(64) NOT NULL
                             CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT leadgrid_discovery_intelligence_reports_run_fkey
    FOREIGN KEY (organization_id, project_id, run_id)
    REFERENCES leadgrid_discovery_runs(organization_id, project_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT leadgrid_discovery_intelligence_reports_scope_id_key
    UNIQUE (organization_id, project_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_discovery_intelligence_report_idempotency
  ON leadgrid_discovery_intelligence_reports
  (organization_id, project_id, run_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_discovery_intelligence_report_latest
  ON leadgrid_discovery_intelligence_reports
  (organization_id, project_id, run_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS leadgrid_discovery_intelligence_insights (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id            UUID NOT NULL,
  project_id                 TEXT NOT NULL,
  report_id                  UUID NOT NULL,
  category                   VARCHAR(24) NOT NULL
                             CHECK (category IN (
                               'competition', 'audience', 'positioning',
                               'messaging', 'channels', 'opportunity', 'risk',
                               'experiment', 'win_loss'
                             )),
  claim_type                 VARCHAR(16) NOT NULL
                             CHECK (claim_type IN ('fact', 'inference', 'hypothesis')),
  title                      VARCHAR(180) NOT NULL,
  finding                    TEXT NOT NULL,
  relevance                  TEXT NOT NULL,
  confidence                 NUMERIC(5, 4) NOT NULL
                             CHECK (confidence BETWEEN 0 AND 1),
  evidence_coverage          NUMERIC(5, 4) NOT NULL
                             CHECK (evidence_coverage BETWEEN 0 AND 1),
  evidence_refs              TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  counter_evidence           JSONB NOT NULL DEFAULT '[]'::jsonb
                             CHECK (jsonb_typeof(counter_evidence) = 'array'),
  recommended_action         TEXT NOT NULL,
  experiment                 JSONB
                             CHECK (experiment IS NULL OR jsonb_typeof(experiment) = 'object'),
  review_status              VARCHAR(16) NOT NULL DEFAULT 'pending'
                             CHECK (review_status IN (
                               'pending', 'accepted', 'rejected', 'corrected'
                             )),
  reviewed_by                VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at                TIMESTAMPTZ,
  sort_order                 SMALLINT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT leadgrid_discovery_intelligence_insights_report_fkey
    FOREIGN KEY (organization_id, project_id, report_id)
    REFERENCES leadgrid_discovery_intelligence_reports(organization_id, project_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT leadgrid_discovery_intelligence_insights_scope_id_key
    UNIQUE (organization_id, project_id, report_id, id),
  CONSTRAINT leadgrid_discovery_intelligence_insights_evidence_check
    CHECK (cardinality(evidence_refs) BETWEEN 1 AND 8)
);

CREATE INDEX IF NOT EXISTS idx_discovery_intelligence_insights_report
  ON leadgrid_discovery_intelligence_insights
  (organization_id, project_id, report_id, sort_order, id);

CREATE TABLE IF NOT EXISTS leadgrid_discovery_intelligence_feedback (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id            UUID NOT NULL,
  project_id                 TEXT NOT NULL,
  report_id                  UUID NOT NULL,
  insight_id                 UUID NOT NULL,
  decision                   VARCHAR(16) NOT NULL
                             CHECK (decision IN ('accept', 'reject', 'correct')),
  reason_code                VARCHAR(80),
  note                       TEXT,
  correction                 JSONB NOT NULL DEFAULT '{}'::jsonb
                             CHECK (jsonb_typeof(correction) = 'object'),
  actor_user_id              VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  idempotency_key            VARCHAR(255) NOT NULL,
  request_hash               CHAR(64) NOT NULL
                             CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  occurred_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT leadgrid_discovery_intelligence_feedback_insight_fkey
    FOREIGN KEY (organization_id, project_id, report_id, insight_id)
    REFERENCES leadgrid_discovery_intelligence_insights(
      organization_id, project_id, report_id, id
    )
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_discovery_intelligence_feedback_idempotency
  ON leadgrid_discovery_intelligence_feedback
  (organization_id, project_id, report_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_discovery_intelligence_feedback_insight
  ON leadgrid_discovery_intelligence_feedback
  (organization_id, project_id, report_id, insight_id, occurred_at DESC, id DESC);

COMMIT;
