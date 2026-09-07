-- 0535_leadgrid_map_annotation_project_scope.sql
--
-- map_annotations was created while Leadgrid still shared casting_projects.
-- Bind project annotations to Leadgrid's authoritative organization/project
-- tuple and prevent target leads from crossing that tuple.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '180s';

-- This legacy FK rejects new Leadgrid-only projects. It is restored on any
-- preflight failure because the migration is transactional.
ALTER TABLE map_annotations
  DROP CONSTRAINT IF EXISTS map_annotations_project_id_fkey;

-- Preserve legacy pin callouts that omitted project_id when their lead has a
-- valid Leadgrid project in the same organization. General org annotations
-- without a target deliberately remain project-less for safe compatibility.
UPDATE map_annotations annotation
   SET project_id = lead.project_id,
       updated_at = NOW()
  FROM crm_customers lead
  JOIN leadgrid_projects project
    ON project.id = lead.project_id
   AND project.organization_id = lead.organization_id
 WHERE annotation.project_id IS NULL
   AND annotation.target_lead_id = lead.id
   AND annotation.organization_id = lead.organization_id
   AND lead.project_id IS NOT NULL;

DO $preflight$
DECLARE
  invalid_projects BIGINT;
  invalid_targets BIGINT;
BEGIN
  SELECT COUNT(*)
    INTO invalid_projects
    FROM map_annotations annotation
   WHERE annotation.project_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
         FROM leadgrid_projects project
        WHERE project.organization_id = annotation.organization_id
          AND project.id = annotation.project_id
     );

  IF invalid_projects > 0 THEN
    RAISE EXCEPTION
      'map_annotations has % rows outside a Leadgrid organization/project tuple',
      invalid_projects;
  END IF;

  SELECT COUNT(*)
    INTO invalid_targets
    FROM map_annotations annotation
   WHERE annotation.target_lead_id IS NOT NULL
     AND (
       annotation.project_id IS NULL
       OR NOT EXISTS (
         SELECT 1
           FROM crm_customers lead
          WHERE lead.id = annotation.target_lead_id
            AND lead.organization_id = annotation.organization_id
            AND lead.project_id = annotation.project_id
       )
     );

  IF invalid_targets > 0 THEN
    RAISE EXCEPTION
      'map_annotations has % target leads outside the annotation tuple',
      invalid_targets;
  END IF;
END
$preflight$;

ALTER TABLE map_annotations
  ADD CONSTRAINT map_annotations_leadgrid_project_fkey
  FOREIGN KEY (organization_id, project_id)
  REFERENCES leadgrid_projects(organization_id, id)
  ON UPDATE CASCADE
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE map_annotations
  VALIDATE CONSTRAINT map_annotations_leadgrid_project_fkey;

ALTER TABLE map_annotations
  ADD CONSTRAINT map_annotations_target_lead_scope_check
  CHECK (target_lead_id IS NULL OR project_id IS NOT NULL)
  NOT VALID;

ALTER TABLE map_annotations
  VALIDATE CONSTRAINT map_annotations_target_lead_scope_check;

ALTER TABLE map_annotations
  ADD CONSTRAINT map_annotations_target_lead_scope_fkey
  FOREIGN KEY (target_lead_id, organization_id, project_id)
  REFERENCES crm_customers(id, organization_id, project_id)
  NOT VALID;

ALTER TABLE map_annotations
  VALIDATE CONSTRAINT map_annotations_target_lead_scope_fkey;

CREATE INDEX IF NOT EXISTS idx_map_annotations_org_project_active
  ON map_annotations (organization_id, project_id, created_at DESC)
  WHERE archived_at IS NULL;

COMMENT ON COLUMN map_annotations.project_id IS
  'Leadgrid project soft identifier, tenant-bound by map_annotations_leadgrid_project_fkey; NULL means an organization-global annotation.';

COMMIT;
