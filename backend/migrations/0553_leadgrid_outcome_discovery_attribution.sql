-- 0553_leadgrid_outcome_discovery_attribution.sql
--
-- Freeze server-derived first-touch Discovery attribution on immutable project
-- outcome events. Client metadata is deliberately not part of attribution.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '180s';

ALTER TABLE leadgrid_project_outcome_events
  ADD COLUMN IF NOT EXISTS discovery_candidate_id UUID,
  ADD COLUMN IF NOT EXISTS discovery_run_id UUID,
  ADD COLUMN IF NOT EXISTS discovery_profile_id UUID,
  ADD COLUMN IF NOT EXISTS discovery_attributed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leadgrid_discovery_feedback_outcome_attribution
  ON leadgrid_discovery_feedback (
    organization_id,
    project_id,
    lead_id,
    occurred_at ASC,
    created_at ASC,
    id ASC
  ) INCLUDE (candidate_id, run_id)
  WHERE event_type = 'decision'
    AND value = 'approve'
    AND lead_id IS NOT NULL
    AND run_id IS NOT NULL;

-- Backfill with the same deterministic rule used by the write path: the first
-- approving feedback row whose candidate really imported this lead and whose
-- exact run occurrence reached imported. Outcomes preceding import stay null.
WITH authoritative_first_touch AS (
  SELECT outcome.id AS outcome_id,
         attribution.candidate_id,
         attribution.run_id,
         attribution.profile_id,
         attribution.attributed_at
    FROM leadgrid_project_outcome_events outcome
    JOIN LATERAL (
      SELECT feedback.candidate_id,
             feedback.run_id,
             run.profile_id,
             feedback.occurred_at AS attributed_at
        FROM leadgrid_discovery_feedback feedback
        JOIN leadgrid_discovery_candidates candidate
          ON candidate.organization_id = feedback.organization_id
         AND candidate.project_id = feedback.project_id
         AND candidate.id = feedback.candidate_id
         AND candidate.imported_lead_id = outcome.lead_id
        JOIN leadgrid_discovery_runs run
          ON run.organization_id = feedback.organization_id
         AND run.project_id = feedback.project_id
         AND run.id = feedback.run_id
        JOIN leadgrid_discovery_run_candidates occurrence
          ON occurrence.organization_id = feedback.organization_id
         AND occurrence.project_id = feedback.project_id
         AND occurrence.run_id = feedback.run_id
         AND occurrence.candidate_id = feedback.candidate_id
         AND occurrence.disposition = 'imported'
       WHERE feedback.organization_id = outcome.organization_id
         AND feedback.project_id = outcome.project_id
         AND feedback.lead_id = outcome.lead_id
         AND feedback.event_type = 'decision'
         AND feedback.value = 'approve'
         AND feedback.run_id IS NOT NULL
         AND feedback.occurred_at <= outcome.occurred_at
       ORDER BY feedback.occurred_at ASC,
                feedback.created_at ASC,
                feedback.id ASC
       LIMIT 1
    ) attribution ON TRUE
   WHERE outcome.discovery_candidate_id IS NULL
     AND outcome.discovery_run_id IS NULL
     AND outcome.discovery_profile_id IS NULL
     AND outcome.discovery_attributed_at IS NULL
)
UPDATE leadgrid_project_outcome_events outcome
   SET discovery_candidate_id = attribution.candidate_id,
       discovery_run_id = attribution.run_id,
       discovery_profile_id = attribution.profile_id,
       discovery_attributed_at = attribution.attributed_at
  FROM authoritative_first_touch attribution
 WHERE outcome.id = attribution.outcome_id;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_project_outcome_events'::regclass
       AND conname = 'leadgrid_outcome_events_discovery_shape_check'
  ) THEN
    ALTER TABLE leadgrid_project_outcome_events
      ADD CONSTRAINT leadgrid_outcome_events_discovery_shape_check
      CHECK (
        (
          discovery_candidate_id IS NULL
          AND discovery_run_id IS NULL
          AND discovery_profile_id IS NULL
          AND discovery_attributed_at IS NULL
        )
        OR (
          discovery_candidate_id IS NOT NULL
          AND discovery_run_id IS NOT NULL
          AND discovery_attributed_at IS NOT NULL
        )
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_project_outcome_events'::regclass
       AND conname = 'leadgrid_outcome_events_discovery_candidate_scope_fkey'
  ) THEN
    ALTER TABLE leadgrid_project_outcome_events
      ADD CONSTRAINT leadgrid_outcome_events_discovery_candidate_scope_fkey
      FOREIGN KEY (organization_id, project_id, discovery_candidate_id)
      REFERENCES leadgrid_discovery_candidates(organization_id, project_id, id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_project_outcome_events'::regclass
       AND conname = 'leadgrid_outcome_events_discovery_run_scope_fkey'
  ) THEN
    ALTER TABLE leadgrid_project_outcome_events
      ADD CONSTRAINT leadgrid_outcome_events_discovery_run_scope_fkey
      FOREIGN KEY (organization_id, project_id, discovery_run_id)
      REFERENCES leadgrid_discovery_runs(organization_id, project_id, id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_project_outcome_events'::regclass
       AND conname = 'leadgrid_outcome_events_discovery_profile_scope_fkey'
  ) THEN
    ALTER TABLE leadgrid_project_outcome_events
      ADD CONSTRAINT leadgrid_outcome_events_discovery_profile_scope_fkey
      FOREIGN KEY (organization_id, project_id, discovery_profile_id)
      REFERENCES leadgrid_discovery_profiles(organization_id, project_id, id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_project_outcome_events'::regclass
       AND conname = 'leadgrid_outcome_events_discovery_occurrence_fkey'
  ) THEN
    ALTER TABLE leadgrid_project_outcome_events
      ADD CONSTRAINT leadgrid_outcome_events_discovery_occurrence_fkey
      FOREIGN KEY (discovery_run_id, discovery_candidate_id)
      REFERENCES leadgrid_discovery_run_candidates(run_id, candidate_id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
END
$constraints$;

ALTER TABLE leadgrid_project_outcome_events
  VALIDATE CONSTRAINT leadgrid_outcome_events_discovery_shape_check;
ALTER TABLE leadgrid_project_outcome_events
  VALIDATE CONSTRAINT leadgrid_outcome_events_discovery_candidate_scope_fkey;
ALTER TABLE leadgrid_project_outcome_events
  VALIDATE CONSTRAINT leadgrid_outcome_events_discovery_run_scope_fkey;
ALTER TABLE leadgrid_project_outcome_events
  VALIDATE CONSTRAINT leadgrid_outcome_events_discovery_profile_scope_fkey;
ALTER TABLE leadgrid_project_outcome_events
  VALIDATE CONSTRAINT leadgrid_outcome_events_discovery_occurrence_fkey;

CREATE INDEX IF NOT EXISTS idx_leadgrid_outcome_events_discovery_profile_cohort
  ON leadgrid_project_outcome_events (
    organization_id,
    project_id,
    discovery_profile_id,
    discovery_attributed_at,
    event_type,
    lead_id
  )
  WHERE discovery_profile_id IS NOT NULL;

COMMENT ON COLUMN leadgrid_project_outcome_events.discovery_candidate_id IS
  'Server-derived candidate from the lead first-touch Discovery import; never accepted from client metadata.';
COMMENT ON COLUMN leadgrid_project_outcome_events.discovery_run_id IS
  'Server-derived approving Discovery run for immutable first-touch attribution.';
COMMENT ON COLUMN leadgrid_project_outcome_events.discovery_profile_id IS
  'Server-derived Discovery profile. Null is valid for non-Discovery and ad-hoc imports.';
COMMENT ON COLUMN leadgrid_project_outcome_events.discovery_attributed_at IS
  'Occurred-at timestamp of the authoritative approving Discovery feedback event.';

COMMIT;
