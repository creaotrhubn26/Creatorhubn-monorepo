-- Editor Collaboration — kommentarer/diskusjoner inne i agent-editor
-- mellom Bjarne + teammates + klienter (via mention).
--
-- Hver kommentar er forankret til noe spesifikt (timestamp i video,
-- pick-id, social-cut, lower-third, segment) så Bjarne/teamet vet
-- nøyaktig hva som diskuteres. Status-workflow gjør det til et
-- arbeidsverktøy ikke bare chat: open → in-progress → resolved.
--
-- @mentions parses fra teksten og lagres separate så vi kan vise
-- "min innboks" + notifikasjoner.

CREATE TABLE IF NOT EXISTS role_room_editor_comments (
  id text PRIMARY KEY DEFAULT (lower(replace(gen_random_uuid()::text, '-', ''))),
  project_id text NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  -- Hvilken type ting kommentaren er knyttet til
  anchor_type text NOT NULL
    CHECK (anchor_type IN ('timestamp', 'pick', 'cut', 'lower_third',
                            'caption', 'broll', 'music', 'general')),
  -- Referanse-ID til det forankrede objektet (NULL for general)
  anchor_ref text,
  -- Sekunder inn i video for timestamp-baserte kommentarer
  timestamp_sec real,
  -- For pinning på bestemt agent (kan også være null for cross-agent
  -- diskusjon)
  agent_kind text,
  -- Tekst-innhold (inkluderer @mentions som plain text — vi parser
  -- ut til mentions-tabell)
  comment_text text NOT NULL CHECK (length(comment_text) <= 5000),
  -- Reply-tråd: parent_id null = top-level; ellers tråd under en
  -- annen kommentar
  parent_id text REFERENCES role_room_editor_comments(id) ON DELETE CASCADE,
  -- Status-workflow
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'wontfix')),
  -- Hvem som er ansvarlig (null = unassigned)
  assigned_to text,
  -- Prioritet
  priority text DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  -- Hvem som lagde kommentaren (bruker_id eller "client:<navn>" for
  -- eksterne klienter)
  author_id text,
  author_display_name text NOT NULL,
  -- Tracking
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_editor_comments_project
  ON role_room_editor_comments(project_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_editor_comments_parent
  ON role_room_editor_comments(parent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_editor_comments_anchor
  ON role_room_editor_comments(project_id, anchor_type, anchor_ref);

COMMENT ON TABLE role_room_editor_comments IS
  'Editor-kommentarer mellom Bjarne, teammates og klienter. Forankret '
  'til timestamp/pick/cut/etc. Status-workflow gjør det til '
  'arbeidsverktøy. Reply-tråder via parent_id.';
