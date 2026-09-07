-- Keep sales quality, its scripts, and Quality -> Leadbook handoff inside the
-- selected Leadgrid customer project. Legacy rows are inferred only from an
-- exact CRM customer or an organization with exactly one project across all
-- history. Archived/deleted projects still make a legacy row ambiguous.

BEGIN;

ALTER TABLE leadgrid_verification_templates
  ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadgrid_sales_verifications
  ADD COLUMN IF NOT EXISTS project_id TEXT;

-- A CRM customer is the authoritative source for a won sale's project.
UPDATE leadgrid_sales_verifications verification
   SET project_id = customer.project_id
  FROM crm_customers customer
  JOIN leadgrid_projects project
    ON project.id = customer.project_id
   AND project.organization_id = customer.organization_id
   AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))
   AND (project.project_type IS NULL OR project.project_type NOT IN (
     'feature_film', 'documentary', 'film', 'short_film',
     'tv_series', 'commercial', 'music_video', 'casting'
   ))
 WHERE verification.project_id IS NULL
   AND verification.customer_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   AND customer.id::text = verification.customer_id
   AND customer.organization_id::text = verification.organization_id
   AND customer.project_id IS NOT NULL;

-- Infer only unambiguous organizations; never choose an arbitrary project.
WITH single_project AS (
  SELECT organization_id::text AS organization_id, MIN(id) AS project_id
    FROM leadgrid_projects
  WHERE organization_id IS NOT NULL
  GROUP BY organization_id
  HAVING COUNT(*) = 1
     AND BOOL_AND(
       (status IS NULL OR status NOT IN ('archived', 'deleted'))
       AND (project_type IS NULL OR project_type NOT IN (
         'feature_film', 'documentary', 'film', 'short_film',
         'tv_series', 'commercial', 'music_video', 'casting'
       ))
     )
)
UPDATE leadgrid_verification_templates target
   SET project_id = single_project.project_id
  FROM single_project
 WHERE target.project_id IS NULL
   AND target.organization_id = single_project.organization_id;

WITH single_project AS (
  SELECT organization_id::text AS organization_id, MIN(id) AS project_id
    FROM leadgrid_projects
  WHERE organization_id IS NOT NULL
  GROUP BY organization_id
  HAVING COUNT(*) = 1
     AND BOOL_AND(
       (status IS NULL OR status NOT IN ('archived', 'deleted'))
       AND (project_type IS NULL OR project_type NOT IN (
         'feature_film', 'documentary', 'film', 'short_film',
         'tv_series', 'commercial', 'music_video', 'casting'
       ))
     )
)
UPDATE leadgrid_sales_verifications target
   SET project_id = single_project.project_id
  FROM single_project
 WHERE target.project_id IS NULL
   AND target.organization_id = single_project.organization_id;

-- 0549 introduced Leadbook project_id before Quality itself carried project.
UPDATE leadbook_examples example
   SET project_id = verification.project_id
  FROM leadgrid_sales_verifications verification
  JOIN leadgrid_projects project
    ON project.id = verification.project_id
   AND project.organization_id::text = verification.organization_id
   AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))
   AND (project.project_type IS NULL OR project.project_type NOT IN (
     'feature_film', 'documentary', 'film', 'short_film',
     'tv_series', 'commercial', 'music_video', 'casting'
   ))
 WHERE example.project_id IS NULL
   AND example.source_verification_id = verification.id
   AND example.organization_id = verification.organization_id
   AND verification.project_id IS NOT NULL;

-- Keep old conflict/index contracts until all pre-project instances drain.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lg_sverif_project_customer
  ON leadgrid_sales_verifications (organization_id, project_id, customer_id)
  WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lg_sverif_legacy_customer
  ON leadgrid_sales_verifications (organization_id, customer_id)
  WHERE project_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_lg_vtempl_project
  ON leadgrid_verification_templates (
    organization_id, project_id, is_active, sort_order, name
  )
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lg_sverif_project_status
  ON leadgrid_sales_verifications (
    organization_id, project_id, status, created_at DESC
  )
  WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_examples_project_source_verif
  ON leadbook_examples (organization_id, project_id, source_verification_id)
  WHERE project_id IS NOT NULL AND source_verification_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_examples_legacy_source_verif
  ON leadbook_examples (source_verification_id)
  WHERE project_id IS NULL AND source_verification_id IS NOT NULL;

DO $$
BEGIN
  -- Required checks are deferred until old backend instances are drained.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'leadgrid_verification_templates_project_fkey'
  ) THEN
    ALTER TABLE leadgrid_verification_templates
      ADD CONSTRAINT leadgrid_verification_templates_project_fkey
      FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'leadgrid_sales_verifications_project_fkey'
  ) THEN
    ALTER TABLE leadgrid_sales_verifications
      ADD CONSTRAINT leadgrid_sales_verifications_project_fkey
      FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'leadgrid_sales_verifications_template_fkey'
  ) THEN
    ALTER TABLE leadgrid_sales_verifications
      ADD CONSTRAINT leadgrid_sales_verifications_template_fkey
      FOREIGN KEY (template_id) REFERENCES leadgrid_verification_templates(id)
      ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION enforce_leadgrid_quality_project_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM leadgrid_projects project
     WHERE project.id = NEW.project_id
       AND project.organization_id::text = NEW.organization_id
       AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))
       AND (project.project_type IS NULL OR project.project_type NOT IN (
         'feature_film', 'documentary', 'film', 'short_film',
         'tv_series', 'commercial', 'music_video', 'casting'
       ))
  ) THEN
    RAISE EXCEPTION 'Leadgrid quality organization/project mismatch';
  END IF;

  IF TG_TABLE_NAME = 'leadgrid_sales_verifications' THEN
    IF NEW.template_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
        FROM leadgrid_verification_templates template
       WHERE template.id = NEW.template_id
         AND template.organization_id = NEW.organization_id
         AND template.project_id = NEW.project_id
    ) THEN
      RAISE EXCEPTION 'Leadgrid quality template outside project';
    END IF;

    IF NEW.customer_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       AND NOT EXISTS (
         SELECT 1
           FROM crm_customers customer
          WHERE customer.id::text = NEW.customer_id
            AND customer.organization_id::text = NEW.organization_id
            AND customer.project_id = NEW.project_id
            AND customer.archived_at IS NULL
       ) THEN
      RAISE EXCEPTION 'Leadgrid quality customer outside project';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leadgrid_verification_templates_project_scope
  ON leadgrid_verification_templates;
CREATE TRIGGER trg_leadgrid_verification_templates_project_scope
BEFORE INSERT OR UPDATE OF organization_id, project_id
ON leadgrid_verification_templates
FOR EACH ROW EXECUTE FUNCTION enforce_leadgrid_quality_project_scope();

DROP TRIGGER IF EXISTS trg_leadgrid_sales_verifications_project_scope
  ON leadgrid_sales_verifications;
CREATE TRIGGER trg_leadgrid_sales_verifications_project_scope
BEFORE INSERT OR UPDATE OF organization_id, project_id, customer_id, template_id
ON leadgrid_sales_verifications
FOR EACH ROW EXECUTE FUNCTION enforce_leadgrid_quality_project_scope();

-- CONTRACT FOLLOW-UP after all old instances are drained: add/validate both
-- project-required checks, make the trigger reject NULL, then drop the legacy
-- organization-only verification/source conflict indexes.

COMMIT;
