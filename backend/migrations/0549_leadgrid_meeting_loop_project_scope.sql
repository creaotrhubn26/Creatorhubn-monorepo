-- Scope the complete Leadgrid meeting-memory loop to a customer project.
-- Ambiguous legacy records are retained with NULL project_id, but every new
-- write is rejected unless organization and project agree.

BEGIN;

ALTER TABLE leadgrid_mote_logg
  ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadgrid_oppgaver
  ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadgrid_mote_maal
  ADD COLUMN IF NOT EXISTS project_id TEXT,
  ADD COLUMN IF NOT EXISTS lead_id UUID;
ALTER TABLE leadbook_ai_usage
  ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadbook_examples
  ADD COLUMN IF NOT EXISTS project_id TEXT;

-- A lead is the strongest possible source of project truth.
UPDATE leadgrid_mote_logg log
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
 WHERE log.project_id IS NULL
   AND log.lead_id = customer.id
   AND log.organization_id = customer.organization_id::text
   AND customer.project_id IS NOT NULL;

UPDATE leadgrid_oppgaver task
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
 WHERE task.project_id IS NULL
   AND task.lead_id = customer.id::text
   AND task.organization_id = customer.organization_id::text
   AND customer.project_id IS NOT NULL;

-- Kvalitet-created Leadbook examples can inherit the source lead project.
UPDATE leadbook_examples example
   SET project_id = customer.project_id
  FROM leadgrid_sales_verifications verification
  JOIN crm_customers customer
    ON verification.customer_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   AND customer.id::text = verification.customer_id
   AND customer.organization_id::text = verification.organization_id
  JOIN leadgrid_projects project
    ON project.id = customer.project_id
   AND project.organization_id = customer.organization_id
   AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))
   AND (project.project_type IS NULL OR project.project_type NOT IN (
     'feature_film', 'documentary', 'film', 'short_film',
     'tv_series', 'commercial', 'music_video', 'casting'
   ))
 WHERE example.project_id IS NULL
   AND example.source_verification_id = verification.id
   AND example.organization_id = verification.organization_id
   AND customer.project_id IS NOT NULL;

-- For Leadgrid-only records without a lead, infer only when the organization
-- has exactly one customer project across all history. An archived/deleted
-- project still makes a legacy row ambiguous, so it must count here.
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
UPDATE leadgrid_mote_logg target
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
UPDATE leadgrid_oppgaver target
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
UPDATE leadgrid_mote_maal target
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
UPDATE leadbook_examples target
   SET project_id = single_project.project_id
  FROM single_project
 WHERE target.project_id IS NULL
   AND target.organization_id = single_project.organization_id;

-- Keep uq_mote_logg_request while old instances still name it as their
-- organization-only ON CONFLICT arbiter.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mote_logg_project_request
  ON leadgrid_mote_logg (organization_id, project_id, request_id)
  WHERE project_id IS NOT NULL AND request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mote_logg_project_company
  ON leadgrid_mote_logg (
    organization_id, project_id, lower(selskap), created_at DESC
  )
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mote_logg_project_lead
  ON leadgrid_mote_logg (
    organization_id, project_id, lead_id, meeting_at DESC
  )
  WHERE project_id IS NOT NULL AND lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leadgrid_oppgaver_project_user
  ON leadgrid_oppgaver (
    organization_id, project_id, user_id, status, created_at DESC
  )
  WHERE project_id IS NOT NULL;

-- Keep leadgrid_mote_maal_pkey (organization_id, selskap_key) during the
-- compatibility window; old instances still use that conflict target.
CREATE UNIQUE INDEX IF NOT EXISTS uq_leadgrid_mote_maal_project_customer
  ON leadgrid_mote_maal (organization_id, project_id, selskap_key)
  WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_leadgrid_mote_maal_legacy_customer
  ON leadgrid_mote_maal (organization_id, selskap_key)
  WHERE project_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_leadbook_ai_usage_project
  ON leadbook_ai_usage (organization_id, project_id, created_at DESC)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leadbook_examples_project_status
  ON leadbook_examples (organization_id, project_id, status, created_at DESC)
  WHERE project_id IS NOT NULL;

DO $$
BEGIN
  -- Required checks are deferred until old backend instances are drained.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'leadgrid_mote_logg_project_fkey'
  ) THEN
    ALTER TABLE leadgrid_mote_logg
      ADD CONSTRAINT leadgrid_mote_logg_project_fkey
      FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'leadgrid_oppgaver_project_fkey'
  ) THEN
    ALTER TABLE leadgrid_oppgaver
      ADD CONSTRAINT leadgrid_oppgaver_project_fkey
      FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'leadgrid_mote_maal_project_fkey'
  ) THEN
    ALTER TABLE leadgrid_mote_maal
      ADD CONSTRAINT leadgrid_mote_maal_project_fkey
      FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION enforce_leadgrid_meeting_project_scope()
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
    RAISE EXCEPTION 'invalid Leadgrid meeting project scope'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.lead_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM crm_customers customer
     WHERE customer.id::text = NEW.lead_id::text
       AND customer.organization_id::text = NEW.organization_id
       AND customer.project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'invalid Leadgrid meeting lead scope'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leadgrid_mote_logg_project_scope
  ON leadgrid_mote_logg;
CREATE TRIGGER trg_leadgrid_mote_logg_project_scope
  BEFORE INSERT OR UPDATE OF organization_id, project_id, lead_id
  ON leadgrid_mote_logg
  FOR EACH ROW EXECUTE FUNCTION enforce_leadgrid_meeting_project_scope();

DROP TRIGGER IF EXISTS trg_leadgrid_oppgaver_project_scope
  ON leadgrid_oppgaver;
CREATE TRIGGER trg_leadgrid_oppgaver_project_scope
  BEFORE INSERT OR UPDATE OF organization_id, project_id, lead_id
  ON leadgrid_oppgaver
  FOR EACH ROW EXECUTE FUNCTION enforce_leadgrid_meeting_project_scope();

DROP TRIGGER IF EXISTS trg_leadgrid_mote_maal_project_scope
  ON leadgrid_mote_maal;
CREATE TRIGGER trg_leadgrid_mote_maal_project_scope
  BEFORE INSERT OR UPDATE OF organization_id, project_id, lead_id
  ON leadgrid_mote_maal
  FOR EACH ROW EXECUTE FUNCTION enforce_leadgrid_meeting_project_scope();

-- CONTRACT FOLLOW-UP after all old instances are drained: add/validate the
-- three project-required checks, make the trigger reject NULL, drop
-- uq_mote_logg_request and replace/drop the legacy mote_maal primary key.

COMMIT;
