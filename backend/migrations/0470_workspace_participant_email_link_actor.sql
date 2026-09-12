-- Distinguish possession of a personal email link from a verified participant
-- identity in the append-only Workspace participant audit trail.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE workspace_participant_events
  DROP CONSTRAINT IF EXISTS workspace_participant_events_actor_type_check;

ALTER TABLE workspace_participant_events
  ADD CONSTRAINT workspace_participant_events_actor_type_check
    CHECK (actor_type IN ('user', 'participant', 'email_link_holder', 'system'))
    NOT VALID;

ALTER TABLE workspace_participant_events
  VALIDATE CONSTRAINT workspace_participant_events_actor_type_check;

COMMENT ON COLUMN workspace_participant_events.actor_type IS
  'Audit actor class. email_link_holder proves possession of the delivered mailbox link, not legal identity.';

COMMIT;
