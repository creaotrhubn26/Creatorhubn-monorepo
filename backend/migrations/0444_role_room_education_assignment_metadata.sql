-- 0444_role_room_education_assignment_metadata.sql
--
-- Del A punkt 141: utkast opprettet via MCP må kunne listes og ryddes bort
-- igjen. De fire prosjekt-scopede utkast-tabellene bærer allerede markøren
-- metadata->>'source' = 'mcp'; utdannings-oppgavene manglet en metadata-
-- kolonne og kunne derfor ikke skilles fra oppgaver faglæreren selv har
-- laget. Uten det skillet ville et opprydnings-verktøy risikere å slette
-- ekte utkast.

ALTER TABLE role_room_education_assignments
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN role_room_education_assignments.metadata IS
  'Fri metadata. metadata->>''source'' = ''mcp'' merker utkast opprettet av en agent.';

-- Delvis indeks: opprydnings-verktøyet spør bare etter MCP-utkast.
CREATE INDEX IF NOT EXISTS idx_rr_education_assignments_mcp_drafts
  ON role_room_education_assignments (owner_user_id, created_at DESC)
  WHERE metadata->>'source' = 'mcp';
