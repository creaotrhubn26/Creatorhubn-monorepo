-- 276_marketing_workflows.sql
--
-- Marketing Workflow-orkestrering (Fase 4 av MI-modulen).
--
-- En "marketing_workflow"-rad sporer livssyklusen til ÉN konkret aksjon
-- som ble startet fra en Market Intelligence Opportunity:
--
--   opportunities_ready → campaign_draft_created → content_pack_created
--   → approval_pending → approved → scheduled → published
--   → analytics_collecting → analytics_completed → recommendations_updated
--
-- Workflow-en binder sammen:
--   - brand_scan_id   (Brand Kit som ble brukt)
--   - market_scan_id  (Scan som ga opportunity-en)
--   - opportunity_id  (Konkret anbefaling)
--   - campaign_id     (FK til marketing_post_drafts hvis Create Campaign)
--   - content_pack_ids (array av draft-IDer hvis Generate Content Pack)
--   - approval_task_id (TODO Fase 4b — bruker eksisterende
--                       role-room-material-approval mønster)
--   - analytics_result_ids (Fase 6)
--   - agent_context_id (Fase 5 — id på agent-tråden som ble sendt)
--
-- Sporbarhet: hver workflow-rad lar oss følge en anbefaling fra "Claude
-- foreslo" → "Daniel godkjente" → "publisert" → "Y leads kom".

BEGIN;

CREATE TABLE IF NOT EXISTS marketing_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Workspace-isolasjon
  workspace_owner_user_id VARCHAR(255) NOT NULL,
  project_id VARCHAR(255),

  -- Source-context
  brand_kit_id UUID REFERENCES brand_kits(id) ON DELETE SET NULL,
  market_scan_id UUID REFERENCES market_scans(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES market_scan_opportunities(id) ON DELETE SET NULL,

  -- Downstream-ressurser
  -- marketing_post_drafts.id er BIGSERIAL, så lagre som BIGINT
  campaign_draft_id BIGINT,
  content_pack_draft_ids BIGINT[] NOT NULL DEFAULT '{}'::BIGINT[],
  approval_task_id VARCHAR(255),       -- role-room-material-approval (FK valgfri)
  publishing_item_ids BIGINT[] NOT NULL DEFAULT '{}'::BIGINT[],
  analytics_result_ids BIGINT[] NOT NULL DEFAULT '{}'::BIGINT[],
  agent_thread_id VARCHAR(255),

  -- State-machine
  current_status VARCHAR(40) NOT NULL DEFAULT 'opportunities_ready'
    CHECK (current_status IN (
      'brand_scan_pending', 'brand_scan_completed',
      'market_scan_ready', 'market_scan_running', 'market_scan_completed',
      'opportunities_ready',
      'campaign_draft_created', 'content_pack_created',
      'approval_pending', 'approved', 'scheduled', 'published',
      'analytics_collecting', 'analytics_completed', 'recommendations_updated'
    )),
  next_recommended_action TEXT,

  -- Metadata
  initiating_action VARCHAR(40) NOT NULL
    CHECK (initiating_action IN (
      'create_campaign', 'create_content_pack', 'create_funnel_map', 'send_to_agent'
    )),
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mw_owner ON marketing_workflows (workspace_owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mw_opportunity ON marketing_workflows (opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mw_market_scan ON marketing_workflows (market_scan_id) WHERE market_scan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mw_status ON marketing_workflows (current_status);
CREATE INDEX IF NOT EXISTS idx_mw_campaign ON marketing_workflows (campaign_draft_id) WHERE campaign_draft_id IS NOT NULL;

-- Audit-trail per state-overgang
CREATE TABLE IF NOT EXISTS marketing_workflow_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES marketing_workflows(id) ON DELETE CASCADE,
  from_status VARCHAR(40),
  to_status VARCHAR(40) NOT NULL,
  triggered_by_user_id VARCHAR(255),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mwt_workflow ON marketing_workflow_transitions (workflow_id, created_at DESC);

DROP TRIGGER IF EXISTS marketing_workflows_updated_at ON marketing_workflows;
CREATE TRIGGER marketing_workflows_updated_at
  BEFORE UPDATE ON marketing_workflows
  FOR EACH ROW
  EXECUTE FUNCTION market_intel_set_updated_at();

COMMIT;
