-- 0529_leadgrid_project_identity_indexes.sql
--
-- Repair historic Market Intelligence rows that predate mandatory Leadgrid
-- project context, then index the exact tenant + customer-project predicates
-- used by Discovery promotion, reporting and competitor views.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- A Leadgrid project is authoritative for its organization. Older market
-- scans could carry only project_id, or an organization selected before the
-- active project changed. Normalize only IDs that resolve in leadgrid_projects;
-- unrelated legacy Role Room scans remain untouched.
UPDATE market_scans scan
   SET organization_id = project.organization_id,
       updated_at = NOW()
  FROM leadgrid_projects project
 WHERE scan.project_id = project.id
   AND project.organization_id IS NOT NULL
   AND scan.organization_id IS DISTINCT FROM project.organization_id;

-- Scanned competitors inherit all available ownership context from their
-- parent. This also repairs rows created after the old one-time backfill.
UPDATE market_scan_competitors competitor
   SET workspace_owner_user_id = COALESCE(
         competitor.workspace_owner_user_id,
         scan.workspace_owner_user_id
       ),
       organization_id = COALESCE(scan.organization_id, competitor.organization_id),
       project_id = COALESCE(scan.project_id, competitor.project_id)
  FROM market_scans scan
 WHERE competitor.market_scan_id = scan.id
   AND (
     competitor.workspace_owner_user_id IS DISTINCT FROM COALESCE(
       competitor.workspace_owner_user_id,
       scan.workspace_owner_user_id
     )
     OR competitor.organization_id IS DISTINCT FROM COALESCE(
       scan.organization_id,
       competitor.organization_id
     )
     OR competitor.project_id IS DISTINCT FROM COALESCE(
       scan.project_id,
       competitor.project_id
     )
   );

-- The project is the final authority for both scanned and manually created
-- competitors. Rows pointing at non-Leadgrid legacy projects are untouched.
UPDATE market_scan_competitors competitor
   SET organization_id = project.organization_id
  FROM leadgrid_projects project
 WHERE competitor.project_id = project.id
   AND project.organization_id IS NOT NULL
   AND competitor.organization_id IS DISTINCT FROM project.organization_id;

CREATE INDEX IF NOT EXISTS idx_market_scans_org_project_created
  ON market_scans (organization_id, project_id, created_at DESC, id)
  WHERE organization_id IS NOT NULL
    AND project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_msc_org_project_created
  ON market_scan_competitors (organization_id, project_id, created_at DESC, id)
  WHERE organization_id IS NOT NULL
    AND project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_msc_org_project_domain
  ON market_scan_competitors (organization_id, project_id, LOWER(domain))
  WHERE organization_id IS NOT NULL
    AND project_id IS NOT NULL
    AND NULLIF(BTRIM(domain), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_msc_org_project_place
  ON market_scan_competitors (organization_id, project_id, google_place_id)
  WHERE organization_id IS NOT NULL
    AND project_id IS NOT NULL
    AND google_place_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_org_project_orgnr
  ON crm_customers (organization_id, project_id, enrichment_org_nr)
  WHERE organization_id IS NOT NULL
    AND project_id IS NOT NULL
    AND enrichment_org_nr IS NOT NULL
    AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_crm_org_project_domain
  ON crm_customers (organization_id, project_id, website_domain_normalized)
  WHERE organization_id IS NOT NULL
    AND project_id IS NOT NULL
    AND website_domain_normalized IS NOT NULL
    AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_crm_org_project_place
  ON crm_customers (organization_id, project_id, google_place_id)
  WHERE organization_id IS NOT NULL
    AND project_id IS NOT NULL
    AND google_place_id IS NOT NULL
    AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_crm_org_project_email
  ON crm_customers (organization_id, project_id, email_normalized)
  WHERE organization_id IS NOT NULL
    AND project_id IS NOT NULL
    AND email_normalized IS NOT NULL
    AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_crm_org_project_phone
  ON crm_customers (organization_id, project_id, phone_normalized)
  WHERE organization_id IS NOT NULL
    AND project_id IS NOT NULL
    AND phone_normalized IS NOT NULL
    AND archived_at IS NULL;

COMMIT;
