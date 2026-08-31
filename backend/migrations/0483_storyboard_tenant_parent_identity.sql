-- Install the parent identity under the canonical schema owner before child
-- tables add composite tenant foreign keys.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS casting_storyboards_id_project_uidx
  ON casting_storyboards (id, project_id);

COMMIT;
