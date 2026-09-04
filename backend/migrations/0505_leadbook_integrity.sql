-- Migration 0505: Leadbook tenant/GDPR integrity, bounded values and
-- retry-safe client mutations. Additive and safe for existing rows.
BEGIN;

-- Normalize legacy values before enforcing the canonical vocabulary.
UPDATE leadbook_examples SET status = 'draft'
 WHERE status NOT IN ('draft', 'published', 'archived');
UPDATE leadbook_examples SET outcome = 'ongoing'
 WHERE outcome NOT IN ('won', 'lost', 'ongoing');
UPDATE leadbook_examples SET channel = 'telephone'
 WHERE channel IN ('phone', 'telefon', 'telefonen');
UPDATE leadbook_examples SET channel = 'telephone'
 WHERE channel NOT IN ('field', 'telephone', 'email', 'video');
UPDATE leadbook_examples SET duration_sec = LEAST(86400, GREATEST(duration_sec, 0))
 WHERE duration_sec < 0 OR duration_sec > 86400;
UPDATE leadbook_examples SET pondus_score = LEAST(100, GREATEST(0, pondus_score))
 WHERE pondus_score IS NOT NULL AND (pondus_score < 0 OR pondus_score > 100);
UPDATE leadbook_examples SET deal_value_nok = GREATEST(deal_value_nok, 0)
 WHERE deal_value_nok < 0;
UPDATE leadgrid_academy_progress
   SET position_seconds = LEAST(86400, GREATEST(position_seconds, 0))
 WHERE position_seconds < 0 OR position_seconds > 86400;

-- A consent may only authorize an example in the same tenant. Clear any
-- historical orphan/cross-tenant links before validating the composite FK.
UPDATE leadbook_examples e
   SET source_consent_id = NULL
 WHERE source_consent_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM leadbook_recording_consents c
      WHERE c.id = e.source_consent_id
        AND c.organization_id = e.organization_id
   );

ALTER TABLE leadbook_examples
  ADD COLUMN IF NOT EXISTS creation_id UUID;
ALTER TABLE leadbook_example_feedback
  ADD COLUMN IF NOT EXISTS client_action_id UUID;
ALTER TABLE leadbook_feedback_replies
  ADD COLUMN IF NOT EXISTS client_action_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_examples_org_creation
  ON leadbook_examples (organization_id, creation_id)
  WHERE creation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_feedback_org_action
  ON leadbook_example_feedback (organization_id, client_action_id)
  WHERE client_action_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_reply_org_action
  ON leadbook_feedback_replies (organization_id, client_action_id)
  WHERE client_action_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lb_examples_org_status_cursor
  ON leadbook_examples (organization_id, status, created_at DESC, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_recording_consent_id_org
  ON leadbook_recording_consents (id, organization_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lb_examples_source_consent_tenant_fk'
  ) THEN
    ALTER TABLE leadbook_examples
      ADD CONSTRAINT lb_examples_source_consent_tenant_fk
      FOREIGN KEY (source_consent_id, organization_id)
      REFERENCES leadbook_recording_consents(id, organization_id)
      ON DELETE SET NULL (source_consent_id)
      NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lb_examples_status_check'
  ) THEN
    ALTER TABLE leadbook_examples
      ADD CONSTRAINT lb_examples_status_check
      CHECK (status IN ('draft', 'published', 'archived'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lb_examples_outcome_check'
  ) THEN
    ALTER TABLE leadbook_examples
      ADD CONSTRAINT lb_examples_outcome_check
      CHECK (outcome IN ('won', 'lost', 'ongoing'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lb_examples_channel_check'
  ) THEN
    ALTER TABLE leadbook_examples
      ADD CONSTRAINT lb_examples_channel_check
      CHECK (channel IN ('field', 'telephone', 'email', 'video'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lb_examples_duration_check'
  ) THEN
    ALTER TABLE leadbook_examples
      ADD CONSTRAINT lb_examples_duration_check
      CHECK (duration_sec IS NULL OR duration_sec BETWEEN 0 AND 86400);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lb_examples_score_check'
  ) THEN
    ALTER TABLE leadbook_examples
      ADD CONSTRAINT lb_examples_score_check
      CHECK (pondus_score IS NULL OR pondus_score BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lb_examples_deal_value_check'
  ) THEN
    ALTER TABLE leadbook_examples
      ADD CONSTRAINT lb_examples_deal_value_check
      CHECK (deal_value_nok IS NULL OR deal_value_nok >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lb_academy_progress_position_check'
  ) THEN
    ALTER TABLE leadgrid_academy_progress
      ADD CONSTRAINT lb_academy_progress_position_check
      CHECK (position_seconds BETWEEN 0 AND 86400);
  END IF;
END $$;

ALTER TABLE leadbook_examples
  VALIDATE CONSTRAINT lb_examples_source_consent_tenant_fk;

COMMIT;
