-- Install the parent identity under the casting_storyboards owner before the
-- creatorhub_migrator-owned child tables add composite tenant foreign keys.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS casting_storyboards_id_project_uidx
  ON casting_storyboards (id, project_id);

COMMIT;
