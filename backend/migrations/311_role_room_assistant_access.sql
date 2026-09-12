-- 311_role_room_assistant_access.sql
-- Assistent-scoping (vinner-konsept «Rolle-presets + granular overstyring»).
-- Produsenten inviterer assistenter (redigerer/fotograf/koordinator) til ett
-- prosjekt med BEGRENSET tilgang. Least-privilege: alt sensitivt er AV som
-- standard. Per-område-flagg i `areas` (JSONB).
--
-- Sensitive områder (economy/client_info/internal_chat) krever bevisst valg +
-- friksjon i UI, og er aldri på i en preset by default.

CREATE TABLE IF NOT EXISTS role_room_assistant_access (
  id                 UUID PRIMARY KEY,
  project_id         VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  assistant_user_id  VARCHAR(255),                      -- settes når invitasjon godtas
  assistant_email    VARCHAR(255) NOT NULL,
  assistant_name     VARCHAR(255),
  role_preset        VARCHAR(40) NOT NULL DEFAULT 'editor',   -- editor | photographer | coordinator | custom
  areas              JSONB NOT NULL DEFAULT '{}'::jsonb,       -- {deliverables,materials,plan,meetings,brief,economy,client_info,internal_chat}
  status             VARCHAR(24) NOT NULL DEFAULT 'invited',   -- invited | active | revoked
  invite_token       VARCHAR(64),
  invited_by_user_id VARCHAR(255),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at         TIMESTAMPTZ
);

-- Én rad per (prosjekt, e-post).
CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_assistant_access_project_email
  ON role_room_assistant_access (project_id, lower(assistant_email));
-- Oppslag på tilgang for en innlogget assistent (enforcement).
CREATE INDEX IF NOT EXISTS idx_rr_assistant_access_user
  ON role_room_assistant_access (assistant_user_id) WHERE status = 'active';

COMMENT ON TABLE role_room_assistant_access IS
  'Assistent-tilgang per prosjekt med least-privilege områdeflagg (areas JSONB). Sensitive områder av som standard.';
