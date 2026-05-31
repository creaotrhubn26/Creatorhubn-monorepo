-- Editor-mentions — @-tagging i kommentarer parses ut hit slik at vi
-- kan vise "min innboks" + sende notifikasjoner.

CREATE TABLE IF NOT EXISTS role_room_editor_mentions (
  id text PRIMARY KEY DEFAULT (lower(replace(gen_random_uuid()::text, '-', ''))),
  comment_id text NOT NULL REFERENCES role_room_editor_comments(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  -- Hvem som ble mentioned (bruker_id eller "client:<navn>")
  mentioned_user_id text NOT NULL,
  -- Hvem som mentioned dem (for å unngå self-notification-spam)
  mentioned_by text,
  -- Når brukeren leste mention (NULL = uread)
  seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentions_user
  ON role_room_editor_mentions(mentioned_user_id, seen_at NULLS FIRST,
                                 created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentions_project
  ON role_room_editor_mentions(project_id, mentioned_user_id);

COMMENT ON TABLE role_room_editor_mentions IS
  '@-mentions extrahert fra kommentar-tekst. Brukes for innboks-view '
  'og notifikasjoner når Bjarne/teammates blir tagget i diskusjon.';
