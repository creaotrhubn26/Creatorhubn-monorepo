-- 301_role_room_messages.sql
-- Klient-samtale / Meldinger-fane i Creative Sync Workspace. Ekte meldingstråd
-- mellom produsent og klient. Aktivitets-elementer (opplastinger, godkjenninger,
-- leveranser, forespørsler) flettes inn fra role_room_project_notifications på
-- frontend — denne tabellen er de faktiske meldingene + forespørsel-statusen.

CREATE TABLE IF NOT EXISTS role_room_messages (
  id                 UUID PRIMARY KEY,
  project_id         VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  author_user_id     VARCHAR(255),
  author_role        VARCHAR(80),         -- producer | client_reviewer | ...
  author_name        VARCHAR(255),
  body               TEXT NOT NULL,
  kind               VARCHAR(32) NOT NULL DEFAULT 'message',  -- message | request | answer
  status             VARCHAR(24) NOT NULL DEFAULT 'open',     -- open | closed (for kind=request)
  reply_to_id        UUID,                                    -- svar på en melding/forespørsel
  linked_entity_type VARCHAR(100),                            -- @nevnt leveranse/post/godkjenning
  linked_entity_id   VARCHAR(255),
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rr_messages_project_created
  ON role_room_messages (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rr_messages_open_requests
  ON role_room_messages (project_id) WHERE kind = 'request' AND status = 'open';

COMMENT ON TABLE role_room_messages IS
  'Produsent↔klient meldingstråd (Meldinger-fanen). Aktivitet flettes inn fra role_room_project_notifications på frontend.';
