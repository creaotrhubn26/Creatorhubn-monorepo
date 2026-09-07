-- 0530_leadgrid_marketing_project_scope.sql
--
-- Binds Market Intelligence workflows, Lead Map campaigns and their generated
-- drafts to one authoritative Leadgrid workspace + customer project. Legacy
-- rows remain readable by their old surfaces, while all new Leadgrid routes
-- require both identifiers.

BEGIN;

ALTER TABLE marketing_workflows
  ADD COLUMN IF NOT EXISTS organization_id UUID;

ALTER TABLE lead_map_campaigns
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(255);

ALTER TABLE marketing_post_drafts
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS leadgrid_project_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR(255);

-- A scan is the strongest historical source of project identity.
UPDATE marketing_workflows workflow
   SET project_id = COALESCE(workflow.project_id, scan.project_id),
       organization_id = COALESCE(workflow.organization_id, scan.organization_id)
  FROM market_scans scan
 WHERE scan.id = workflow.market_scan_id
   AND (workflow.project_id IS NULL OR workflow.organization_id IS NULL);

-- Normalize organization from the canonical Leadgrid project rather than
-- trusting older denormalized owner fields.
UPDATE marketing_workflows workflow
   SET organization_id = project.organization_id
  FROM leadgrid_projects project
 WHERE project.id = workflow.project_id
   AND project.organization_id IS NOT NULL
   AND workflow.organization_id IS DISTINCT FROM project.organization_id;

UPDATE lead_map_campaigns campaign
   SET project_id = COALESCE(campaign.project_id, scan.project_id),
       organization_id = COALESCE(campaign.organization_id, scan.organization_id)
  FROM market_scans scan
 WHERE scan.id = campaign.market_scan_id
   AND (campaign.project_id IS NULL OR campaign.organization_id IS NULL);

UPDATE lead_map_campaigns campaign
   SET project_id = COALESCE(campaign.project_id, workflow.project_id),
       organization_id = COALESCE(campaign.organization_id, workflow.organization_id)
  FROM marketing_workflows workflow
 WHERE workflow.id = campaign.related_workflow_id
   AND (campaign.project_id IS NULL OR campaign.organization_id IS NULL);

UPDATE lead_map_campaigns campaign
   SET project_id = COALESCE(campaign.project_id, kit.project_id)
  FROM brand_kits kit
 WHERE kit.id = campaign.brand_kit_id
   AND campaign.project_id IS NULL;

UPDATE lead_map_campaigns campaign
   SET organization_id = project.organization_id
  FROM leadgrid_projects project
 WHERE project.id = campaign.project_id
   AND project.organization_id IS NOT NULL
   AND campaign.organization_id IS DISTINCT FROM project.organization_id;

-- A draft can be linked as either the single campaign draft or one element in
-- a content pack. DISTINCT ON resolves malformed legacy multi-links
-- deterministically to the newest workflow, without duplicating draft rows.
WITH draft_links AS (
  SELECT workflow.campaign_draft_id AS draft_id,
         workflow.organization_id,
         workflow.project_id,
         workflow.workspace_owner_user_id,
         workflow.updated_at
    FROM marketing_workflows workflow
   WHERE workflow.campaign_draft_id IS NOT NULL
     AND workflow.organization_id IS NOT NULL
     AND workflow.project_id IS NOT NULL
  UNION ALL
  SELECT unnest(workflow.content_pack_draft_ids) AS draft_id,
         workflow.organization_id,
         workflow.project_id,
         workflow.workspace_owner_user_id,
         workflow.updated_at
    FROM marketing_workflows workflow
   WHERE cardinality(workflow.content_pack_draft_ids) > 0
     AND workflow.organization_id IS NOT NULL
     AND workflow.project_id IS NOT NULL
), selected_links AS (
  SELECT DISTINCT ON (draft_id)
         draft_id, organization_id, project_id,
         workspace_owner_user_id, updated_at
    FROM draft_links
   ORDER BY draft_id, updated_at DESC
)
UPDATE marketing_post_drafts draft
   SET organization_id = selected.organization_id,
       leadgrid_project_id = selected.project_id,
       created_by_user_id = COALESCE(
         draft.created_by_user_id,
         selected.workspace_owner_user_id
       ),
       brand_key = 'leadgrid:' || selected.project_id
  FROM selected_links selected
 WHERE draft.id = selected.draft_id
   AND (
     draft.organization_id IS DISTINCT FROM selected.organization_id
     OR draft.leadgrid_project_id IS DISTINCT FROM selected.project_id
     OR draft.created_by_user_id IS NULL
     OR draft.brand_key IS DISTINCT FROM 'leadgrid:' || selected.project_id
   );

CREATE INDEX IF NOT EXISTS idx_marketing_workflows_org_project_updated
  ON marketing_workflows (organization_id, project_id, updated_at DESC)
  WHERE organization_id IS NOT NULL AND project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_workflows_org_project_opportunity
  ON marketing_workflows (organization_id, project_id, opportunity_id)
  WHERE organization_id IS NOT NULL AND project_id IS NOT NULL
    AND opportunity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_map_campaigns_org_project_updated
  ON lead_map_campaigns (organization_id, project_id, updated_at DESC)
  WHERE organization_id IS NOT NULL AND project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_drafts_org_project_status
  ON marketing_post_drafts (
    organization_id, leadgrid_project_id, status, generated_at DESC
  )
  WHERE organization_id IS NOT NULL AND leadgrid_project_id IS NOT NULL;

COMMIT;
