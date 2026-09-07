-- Bind all user-facing Leadbook content to an explicit Leadgrid customer
-- project. Historical rows are inferred only from an authoritative parent or
-- an organization that has exactly one project across all history. Doffin AI
-- usage deliberately remains organization-wide and may keep project_id NULL.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE leadbook_recording_consents
  ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadbook_example_feedback
  ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadbook_feedback_replies
  ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadbook_example_views
  ADD COLUMN IF NOT EXISTS project_id TEXT;
-- Added by 0549; repeat defensively for independently restored databases.
ALTER TABLE leadbook_examples
  ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadbook_ai_usage
  ADD COLUMN IF NOT EXISTS project_id TEXT;

CREATE TABLE IF NOT EXISTS leadbook_scope_reconciliation_audit (
  id BIGSERIAL PRIMARY KEY,
  entity_table TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  organization_id TEXT,
  project_id TEXT,
  field_name TEXT NOT NULL,
  previous_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_scope_reconciliation_event
  ON leadbook_scope_reconciliation_audit
     (entity_table, entity_id, field_name, previous_value, reason);

-- Never retain a missing, cross-organization, archived or media-project label.
-- NULL keeps ambiguous legacy rows auditable instead of inventing ownership.
INSERT INTO leadbook_scope_reconciliation_audit
  (entity_table, entity_id, organization_id, project_id,
   field_name, previous_value, reason)
SELECT 'leadbook_examples', target.id::text, target.organization_id,
       target.project_id, 'project_id', target.project_id,
       'project_missing_mismatched_or_ineligible'
  FROM leadbook_examples target
 WHERE target.project_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM leadgrid_projects project
      WHERE project.id = target.project_id
        AND project.organization_id::text = target.organization_id
        AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))
        AND (project.project_type IS NULL OR project.project_type NOT IN (
          'feature_film', 'documentary', 'film', 'short_film',
          'tv_series', 'commercial', 'music_video', 'casting'
        ))
   )
ON CONFLICT DO NOTHING;

UPDATE leadbook_examples target
   SET project_id = NULL
 WHERE target.project_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM leadgrid_projects project
      WHERE project.id = target.project_id
        AND project.organization_id::text = target.organization_id
        AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))
        AND (project.project_type IS NULL OR project.project_type NOT IN (
          'feature_film', 'documentary', 'film', 'short_film',
          'tv_series', 'commercial', 'music_video', 'casting'
        ))
   );

INSERT INTO leadbook_scope_reconciliation_audit
  (entity_table, entity_id, organization_id, project_id,
   field_name, previous_value, reason)
SELECT 'leadbook_recording_consents', target.id::text, target.organization_id,
       target.project_id, 'project_id', target.project_id,
       'project_missing_mismatched_or_ineligible'
  FROM leadbook_recording_consents target
 WHERE target.project_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM leadgrid_projects project
      WHERE project.id = target.project_id
        AND project.organization_id::text = target.organization_id
        AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))
        AND (project.project_type IS NULL OR project.project_type NOT IN (
          'feature_film', 'documentary', 'film', 'short_film',
          'tv_series', 'commercial', 'music_video', 'casting'
        ))
   )
ON CONFLICT DO NOTHING;

UPDATE leadbook_recording_consents target
   SET project_id = NULL
 WHERE target.project_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM leadgrid_projects project
      WHERE project.id = target.project_id
        AND project.organization_id::text = target.organization_id
        AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))
        AND (project.project_type IS NULL OR project.project_type NOT IN (
          'feature_film', 'documentary', 'film', 'short_film',
          'tv_series', 'commercial', 'music_video', 'casting'
        ))
   );

INSERT INTO leadbook_scope_reconciliation_audit
  (entity_table, entity_id, organization_id, project_id,
   field_name, previous_value, reason)
SELECT 'leadbook_ai_usage', target.id::text, target.organization_id,
       target.project_id, 'project_id', target.project_id,
       'project_missing_mismatched_or_ineligible'
  FROM leadbook_ai_usage target
 WHERE target.project_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM leadgrid_projects project
      WHERE project.id = target.project_id
        AND project.organization_id::text = target.organization_id
        AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))
        AND (project.project_type IS NULL OR project.project_type NOT IN (
          'feature_film', 'documentary', 'film', 'short_film',
          'tv_series', 'commercial', 'music_video', 'casting'
        ))
   )
ON CONFLICT DO NOTHING;

UPDATE leadbook_ai_usage target
   SET project_id = NULL
 WHERE target.project_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM leadgrid_projects project
      WHERE project.id = target.project_id
        AND project.organization_id::text = target.organization_id
        AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))
        AND (project.project_type IS NULL OR project.project_type NOT IN (
          'feature_film', 'documentary', 'film', 'short_film',
          'tv_series', 'commercial', 'music_video', 'casting'
        ))
   );

-- A Quality verification is authoritative provenance for its Leadbook case.
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
 WHERE example.source_verification_id = verification.id
   AND example.organization_id = verification.organization_id
   AND verification.project_id IS NOT NULL
   AND example.project_id IS DISTINCT FROM verification.project_id;

-- A recording consent can inherit from its referenced example only when every
-- reference is already known and all references agree on one project.
WITH inferred_consent_scope AS (
  SELECT consent.id,
         consent.organization_id,
         MIN(example.project_id) AS project_id
    FROM leadbook_recording_consents consent
    JOIN leadbook_examples example
      ON example.source_consent_id = consent.id
     AND example.organization_id = consent.organization_id
   GROUP BY consent.id, consent.organization_id
  HAVING COUNT(*) FILTER (WHERE example.project_id IS NULL) = 0
     AND COUNT(DISTINCT example.project_id) = 1
)
UPDATE leadbook_recording_consents consent
   SET project_id = inferred.project_id
  FROM inferred_consent_scope inferred
 WHERE consent.id = inferred.id
   AND consent.organization_id = inferred.organization_id
   AND consent.project_id IS NULL;

-- The reverse direction is equally authoritative when an already-scoped
-- consent is the only provenance available to an unscoped example.
UPDATE leadbook_examples example
   SET project_id = consent.project_id
  FROM leadbook_recording_consents consent
 WHERE example.project_id IS NULL
   AND example.source_consent_id = consent.id
   AND example.organization_id = consent.organization_id
   AND consent.project_id IS NOT NULL;

-- Count archived/deleted projects too. Their existence makes assigning old
-- content to the sole currently-active project unsafe.
WITH single_project_organizations AS (
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
   SET project_id = singleton.project_id
  FROM single_project_organizations singleton
 WHERE target.project_id IS NULL
   AND target.organization_id = singleton.organization_id;

WITH single_project_organizations AS (
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
UPDATE leadbook_recording_consents target
   SET project_id = singleton.project_id
  FROM single_project_organizations singleton
 WHERE target.project_id IS NULL
   AND target.organization_id = singleton.organization_id;

-- Backfill all known project-scoped Leadbook/meeting features. The three
-- organization-wide Doffin writers intentionally remain NULL.
WITH single_project_organizations AS (
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
UPDATE leadbook_ai_usage target
   SET project_id = singleton.project_id
  FROM single_project_organizations singleton
 WHERE target.project_id IS NULL
   AND target.organization_id = singleton.organization_id
   AND target.feature IN (
     'structure', 'strengthen', 'objection',
     'mote_brief', 'mote_etterarbeid', 'canvas_analyse'
   );

-- Re-run the safe parent propagation after singleton inference.
WITH inferred_consent_scope AS (
  SELECT consent.id,
         consent.organization_id,
         MIN(example.project_id) AS project_id
    FROM leadbook_recording_consents consent
    JOIN leadbook_examples example
      ON example.source_consent_id = consent.id
     AND example.organization_id = consent.organization_id
   GROUP BY consent.id, consent.organization_id
  HAVING COUNT(*) FILTER (WHERE example.project_id IS NULL) = 0
     AND COUNT(DISTINCT example.project_id) = 1
)
UPDATE leadbook_recording_consents consent
   SET project_id = inferred.project_id
  FROM inferred_consent_scope inferred
 WHERE consent.id = inferred.id
   AND consent.organization_id = inferred.organization_id
   AND consent.project_id IS NULL;

UPDATE leadbook_examples example
   SET project_id = consent.project_id
  FROM leadbook_recording_consents consent
 WHERE example.project_id IS NULL
   AND example.source_consent_id = consent.id
   AND example.organization_id = consent.organization_id
   AND consent.project_id IS NOT NULL;

-- A child's parent row is authoritative for both organization and project.
UPDATE leadbook_example_feedback feedback
   SET organization_id = example.organization_id,
       project_id = example.project_id
  FROM leadbook_examples example
 WHERE feedback.example_id = example.id
   AND (feedback.organization_id IS DISTINCT FROM example.organization_id
        OR feedback.project_id IS DISTINCT FROM example.project_id);

UPDATE leadbook_example_views view_row
   SET organization_id = example.organization_id,
       project_id = example.project_id
  FROM leadbook_examples example
 WHERE view_row.example_id = example.id
   AND (view_row.organization_id IS DISTINCT FROM example.organization_id
        OR view_row.project_id IS DISTINCT FROM example.project_id);

UPDATE leadbook_feedback_replies reply
   SET organization_id = feedback.organization_id,
       project_id = feedback.project_id
  FROM leadbook_example_feedback feedback
 WHERE reply.feedback_id = feedback.id
   AND (reply.organization_id IS DISTINCT FROM feedback.organization_id
        OR reply.project_id IS DISTINCT FROM feedback.project_id);

-- Remove orphan/cross-scope provenance pointers; preserve unresolved NULL/NULL
-- relationships for manual reconciliation.
INSERT INTO leadbook_scope_reconciliation_audit
  (entity_table, entity_id, organization_id, project_id,
   field_name, previous_value, reason)
SELECT 'leadbook_examples', example.id::text, example.organization_id,
       example.project_id, 'source_consent_id', example.source_consent_id::text,
       'source_missing_or_cross_project'
  FROM leadbook_examples example
 WHERE example.source_consent_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM leadbook_recording_consents consent
      WHERE consent.id = example.source_consent_id
        AND consent.organization_id = example.organization_id
        AND consent.project_id IS NOT DISTINCT FROM example.project_id
   )
ON CONFLICT DO NOTHING;

UPDATE leadbook_examples example
   SET source_consent_id = NULL
 WHERE example.source_consent_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM leadbook_recording_consents consent
      WHERE consent.id = example.source_consent_id
        AND consent.organization_id = example.organization_id
        AND consent.project_id IS NOT DISTINCT FROM example.project_id
   );

INSERT INTO leadbook_scope_reconciliation_audit
  (entity_table, entity_id, organization_id, project_id,
   field_name, previous_value, reason)
SELECT 'leadbook_examples', example.id::text, example.organization_id,
       example.project_id, 'source_verification_id',
       example.source_verification_id::text,
       'source_missing_or_cross_project'
  FROM leadbook_examples example
 WHERE example.source_verification_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM leadgrid_sales_verifications verification
      WHERE verification.id = example.source_verification_id
        AND verification.organization_id = example.organization_id
        AND verification.project_id IS NOT DISTINCT FROM example.project_id
   )
ON CONFLICT DO NOTHING;

UPDATE leadbook_examples example
   SET source_verification_id = NULL
 WHERE example.source_verification_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM leadgrid_sales_verifications verification
      WHERE verification.id = example.source_verification_id
        AND verification.organization_id = example.organization_id
        AND verification.project_id IS NOT DISTINCT FROM example.project_id
   );

-- Add project retry keys beside the legacy organization-only arbiters. The
-- old indexes must remain until every pre-project backend instance is drained.
-- UUID action ids are globally stable, so the temporary stronger uniqueness
-- does not weaken project isolation.

CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_examples_project_creation
  ON leadbook_examples (organization_id, project_id, creation_id)
  WHERE project_id IS NOT NULL AND creation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_examples_legacy_creation
  ON leadbook_examples (organization_id, creation_id)
  WHERE project_id IS NULL AND creation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_feedback_project_action
  ON leadbook_example_feedback (organization_id, project_id, client_action_id)
  WHERE project_id IS NOT NULL AND client_action_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_feedback_legacy_action
  ON leadbook_example_feedback (organization_id, client_action_id)
  WHERE project_id IS NULL AND client_action_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_reply_project_action
  ON leadbook_feedback_replies (organization_id, project_id, client_action_id)
  WHERE project_id IS NOT NULL AND client_action_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_reply_legacy_action
  ON leadbook_feedback_replies (organization_id, client_action_id)
  WHERE project_id IS NULL AND client_action_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_examples_project_source_consent
  ON leadbook_examples (organization_id, project_id, source_consent_id)
  WHERE project_id IS NOT NULL AND source_consent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_examples_legacy_source_consent
  ON leadbook_examples (source_consent_id)
  WHERE project_id IS NULL AND source_consent_id IS NOT NULL;

-- Non-partial parent identity keys are required by exact composite FKs.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_consents_scope_identity
  ON leadbook_recording_consents (id, organization_id, project_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_examples_scope_identity
  ON leadbook_examples (id, organization_id, project_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_feedback_scope_identity
  ON leadbook_example_feedback (id, organization_id, project_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_verifications_scope_identity
  ON leadgrid_sales_verifications (id, organization_id, project_id);

CREATE INDEX IF NOT EXISTS idx_lb_rec_consent_project
  ON leadbook_recording_consents
     (organization_id, project_id, consented_at DESC)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lb_examples_project_status_cursor
  ON leadbook_examples
     (organization_id, project_id, status, created_at DESC, id DESC)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lb_examples_project_delete_requested
  ON leadbook_examples
     (organization_id, project_id, delete_requested_at ASC)
  WHERE project_id IS NOT NULL
    AND delete_requested_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lb_feedback_project_example
  ON leadbook_example_feedback
     (organization_id, project_id, example_id, created_at ASC)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lb_replies_project_feedback
  ON leadbook_feedback_replies
     (organization_id, project_id, feedback_id, created_at ASC)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lb_views_project_example
  ON leadbook_example_views
     (organization_id, project_id, example_id)
  WHERE project_id IS NOT NULL;
-- 0549 already installs idx_leadbook_ai_usage_project with the same keys.

-- Keep lb_examples_source_consent_tenant_fk during the compatibility window.
-- It protects legacy NULL-project writers; the new tuple FK below adds the
-- stricter project relationship for scoped rows.

DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='leadbook_recording_consents'::regclass AND conname='lb_recording_consents_project_fkey') THEN
    ALTER TABLE leadbook_recording_consents ADD CONSTRAINT lb_recording_consents_project_fkey
      FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='leadbook_examples'::regclass AND conname='lb_examples_project_fkey') THEN
    ALTER TABLE leadbook_examples ADD CONSTRAINT lb_examples_project_fkey
      FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='leadbook_example_feedback'::regclass AND conname='lb_feedback_project_fkey') THEN
    ALTER TABLE leadbook_example_feedback ADD CONSTRAINT lb_feedback_project_fkey
      FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='leadbook_feedback_replies'::regclass AND conname='lb_replies_project_fkey') THEN
    ALTER TABLE leadbook_feedback_replies ADD CONSTRAINT lb_replies_project_fkey
      FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='leadbook_example_views'::regclass AND conname='lb_views_project_fkey') THEN
    ALTER TABLE leadbook_example_views ADD CONSTRAINT lb_views_project_fkey
      FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='leadbook_ai_usage'::regclass AND conname='lb_ai_usage_project_fkey') THEN
    ALTER TABLE leadbook_ai_usage ADD CONSTRAINT lb_ai_usage_project_fkey
      FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='leadbook_examples'::regclass AND conname='lb_examples_source_consent_scope_fkey') THEN
    ALTER TABLE leadbook_examples ADD CONSTRAINT lb_examples_source_consent_scope_fkey
      FOREIGN KEY (source_consent_id, organization_id, project_id)
      REFERENCES leadbook_recording_consents (id, organization_id, project_id)
      ON UPDATE CASCADE ON DELETE SET NULL (source_consent_id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='leadbook_examples'::regclass AND conname='lb_examples_source_verification_scope_fkey') THEN
    ALTER TABLE leadbook_examples ADD CONSTRAINT lb_examples_source_verification_scope_fkey
      FOREIGN KEY (source_verification_id, organization_id, project_id)
      REFERENCES leadgrid_sales_verifications (id, organization_id, project_id)
      ON UPDATE CASCADE ON DELETE SET NULL (source_verification_id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='leadbook_example_feedback'::regclass AND conname='lb_feedback_example_scope_fkey') THEN
    ALTER TABLE leadbook_example_feedback ADD CONSTRAINT lb_feedback_example_scope_fkey
      FOREIGN KEY (example_id, organization_id, project_id)
      REFERENCES leadbook_examples (id, organization_id, project_id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='leadbook_feedback_replies'::regclass AND conname='lb_replies_feedback_scope_fkey') THEN
    ALTER TABLE leadbook_feedback_replies ADD CONSTRAINT lb_replies_feedback_scope_fkey
      FOREIGN KEY (feedback_id, organization_id, project_id)
      REFERENCES leadbook_example_feedback (id, organization_id, project_id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='leadbook_example_views'::regclass AND conname='lb_views_example_scope_fkey') THEN
    ALTER TABLE leadbook_example_views ADD CONSTRAINT lb_views_example_scope_fkey
      FOREIGN KEY (example_id, organization_id, project_id)
      REFERENCES leadbook_examples (id, organization_id, project_id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
END
$migration$;

CREATE OR REPLACE FUNCTION enforce_leadbook_project_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Expand/compat phase: rolling-deploy instances may still write NULL.
  -- Every non-NULL project is nevertheless validated authoritatively here.
  -- A later contract migration will reject NULL for content and for all AI
  -- features except anbud_score/anbud_tilbud/anbud_oppsummer.
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM leadgrid_projects project
     WHERE project.id = NEW.project_id
       AND project.organization_id::text = NEW.organization_id
       AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))
       AND (project.project_type IS NULL OR project.project_type NOT IN (
         'feature_film', 'documentary', 'film', 'short_film',
         'tv_series', 'commercial', 'music_video', 'casting'
       ))
  ) THEN
    RAISE EXCEPTION 'Leadbook organization/project mismatch or inactive project'
      USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME = 'leadbook_examples' THEN
    IF NEW.source_consent_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM leadbook_recording_consents consent
       WHERE consent.id = NEW.source_consent_id
         AND consent.organization_id = NEW.organization_id
         AND consent.project_id = NEW.project_id
    ) THEN
      RAISE EXCEPTION 'Leadbook recording consent outside project'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.source_verification_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM leadgrid_sales_verifications verification
       WHERE verification.id = NEW.source_verification_id
         AND verification.organization_id = NEW.organization_id
         AND verification.project_id = NEW.project_id
    ) THEN
      RAISE EXCEPTION 'Leadbook quality verification outside project'
        USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'leadbook_example_feedback' THEN
    IF NOT EXISTS (
      SELECT 1 FROM leadbook_examples example
       WHERE example.id = NEW.example_id
         AND example.organization_id = NEW.organization_id
         AND example.project_id = NEW.project_id
    ) THEN
      RAISE EXCEPTION 'Leadbook feedback parent outside project'
        USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'leadbook_feedback_replies' THEN
    IF NOT EXISTS (
      SELECT 1 FROM leadbook_example_feedback feedback
       WHERE feedback.id = NEW.feedback_id
         AND feedback.organization_id = NEW.organization_id
         AND feedback.project_id = NEW.project_id
    ) THEN
      RAISE EXCEPTION 'Leadbook reply parent outside project'
        USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'leadbook_example_views' THEN
    IF NOT EXISTS (
      SELECT 1 FROM leadbook_examples example
       WHERE example.id = NEW.example_id
         AND example.organization_id = NEW.organization_id
         AND example.project_id = NEW.project_id
    ) THEN
      RAISE EXCEPTION 'Leadbook view parent outside project'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_lb_recording_consents_project_scope
  ON leadbook_recording_consents;
CREATE TRIGGER trg_lb_recording_consents_project_scope
BEFORE INSERT OR UPDATE OF organization_id, project_id
ON leadbook_recording_consents
FOR EACH ROW EXECUTE FUNCTION enforce_leadbook_project_scope();

DROP TRIGGER IF EXISTS trg_lb_examples_project_scope
  ON leadbook_examples;
CREATE TRIGGER trg_lb_examples_project_scope
BEFORE INSERT OR UPDATE OF organization_id, project_id, source_consent_id, source_verification_id
ON leadbook_examples
FOR EACH ROW EXECUTE FUNCTION enforce_leadbook_project_scope();

DROP TRIGGER IF EXISTS trg_lb_feedback_project_scope
  ON leadbook_example_feedback;
CREATE TRIGGER trg_lb_feedback_project_scope
BEFORE INSERT OR UPDATE OF example_id, organization_id, project_id
ON leadbook_example_feedback
FOR EACH ROW EXECUTE FUNCTION enforce_leadbook_project_scope();

DROP TRIGGER IF EXISTS trg_lb_replies_project_scope
  ON leadbook_feedback_replies;
CREATE TRIGGER trg_lb_replies_project_scope
BEFORE INSERT OR UPDATE OF feedback_id, organization_id, project_id
ON leadbook_feedback_replies
FOR EACH ROW EXECUTE FUNCTION enforce_leadbook_project_scope();

DROP TRIGGER IF EXISTS trg_lb_views_project_scope
  ON leadbook_example_views;
CREATE TRIGGER trg_lb_views_project_scope
BEFORE INSERT OR UPDATE OF example_id, organization_id, project_id
ON leadbook_example_views
FOR EACH ROW EXECUTE FUNCTION enforce_leadbook_project_scope();

DROP TRIGGER IF EXISTS trg_lb_ai_usage_project_scope
  ON leadbook_ai_usage;
CREATE TRIGGER trg_lb_ai_usage_project_scope
BEFORE INSERT OR UPDATE OF organization_id, project_id, feature
ON leadbook_ai_usage
FOR EACH ROW EXECUTE FUNCTION enforce_leadbook_project_scope();

-- All FKs can be validated even while ambiguous historical rows remain NULL
-- (MATCH SIMPLE skips NULL keys). Required checks are intentionally deferred
-- until all old backend instances are drained.
ALTER TABLE leadbook_recording_consents
  VALIDATE CONSTRAINT lb_recording_consents_project_fkey;
ALTER TABLE leadbook_examples
  VALIDATE CONSTRAINT lb_examples_project_fkey;
ALTER TABLE leadbook_example_feedback
  VALIDATE CONSTRAINT lb_feedback_project_fkey;
ALTER TABLE leadbook_feedback_replies
  VALIDATE CONSTRAINT lb_replies_project_fkey;
ALTER TABLE leadbook_example_views
  VALIDATE CONSTRAINT lb_views_project_fkey;
ALTER TABLE leadbook_ai_usage
  VALIDATE CONSTRAINT lb_ai_usage_project_fkey;
ALTER TABLE leadbook_examples
  VALIDATE CONSTRAINT lb_examples_source_consent_scope_fkey;
ALTER TABLE leadbook_examples
  VALIDATE CONSTRAINT lb_examples_source_verification_scope_fkey;
ALTER TABLE leadbook_example_feedback
  VALIDATE CONSTRAINT lb_feedback_example_scope_fkey;
ALTER TABLE leadbook_feedback_replies
  VALIDATE CONSTRAINT lb_replies_feedback_scope_fkey;
ALTER TABLE leadbook_example_views
  VALIDATE CONSTRAINT lb_views_example_scope_fkey;

COMMENT ON COLUMN leadbook_examples.project_id IS
  'Authoritative Leadgrid customer-project scope; required by the new backend; temporarily nullable for rolling-deploy compatibility.';
COMMENT ON COLUMN leadbook_recording_consents.project_id IS
  'Customer project whose recording consent authorized the transcript.';
COMMENT ON COLUMN leadbook_ai_usage.project_id IS
  'Leadgrid customer project for Leadbook/meeting features; temporarily nullable during rollout and permanently nullable for organization-wide Doffin usage.';

-- CONTRACT FOLLOW-UP (do not put in the sequential runner until every old
-- instance is drained): add/validate project-required checks on the five
-- content tables; make the trigger reject NULL except the three Doffin
-- features; then drop the four legacy org-only indexes/constraint.

COMMIT;
