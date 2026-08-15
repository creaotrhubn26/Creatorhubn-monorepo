-- 0452_role_room_scim.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 2 (Compliance-veikartet): SCIM 2.0-provisjonering for Role Room
-- enterprise-organisasjoner. Bygger videre på organizations (mig 285 + 0451
-- SAML) og den eksisterende userRoles/organizationRoles-RBAC-en
-- (frontend/shared/enterprise-schema.ts) — ingen ny tilgangsmodell, kun et
-- nytt inngangspunkt for å opprette/deaktivere userRoles-rader.
--
-- `users` er en delt, plattform-bred tabell (brukt av langt mer enn Role
-- Room) — vi legger derfor IKKE SCIM-spesifikke kolonner på den. En egen
-- mapping-tabell (role_room_scim_users) knytter IdP-ens externalId til vår
-- interne users.id, scoped per organisasjon.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS scim_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS scim_bearer_token_hash VARCHAR(64), -- sha256 hex, aldri klartekst
  ADD COLUMN IF NOT EXISTS scim_bearer_token_hint VARCHAR(8), -- siste 8 tegn, for identifikasjon i admin-UI
  ADD COLUMN IF NOT EXISTS scim_token_rotated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scim_default_role_id UUID REFERENCES organization_roles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_scim_bearer_token_hash
  ON organizations (scim_bearer_token_hash)
  WHERE scim_bearer_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS role_room_scim_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_id VARCHAR(255), -- IdP-ens stabile SCIM externalId for brukeren, hvis oppgitt
  scim_user_name VARCHAR(255) NOT NULL, -- SCIM userName, normalt e-post
  active BOOLEAN NOT NULL DEFAULT TRUE,
  provisioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id),
  UNIQUE (organization_id, scim_user_name)
);

CREATE INDEX IF NOT EXISTS idx_role_room_scim_users_org
  ON role_room_scim_users (organization_id);
CREATE INDEX IF NOT EXISTS idx_role_room_scim_users_external_id
  ON role_room_scim_users (organization_id, external_id);
