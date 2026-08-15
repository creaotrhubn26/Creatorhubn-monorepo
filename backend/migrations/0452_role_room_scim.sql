-- 0452_role_room_scim.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 2 (Compliance-veikartet): SCIM 2.0-provisjonering for Role Room
-- enterprise-organisasjoner. Bygger videre på organizations (mig 285 + 0451
-- SAML) — men IKKE på frontend/shared/enterprise-schema.ts sin
-- organizationRoles/userRoles ("user_roles" med organization_id-kolonne).
-- Code review (2026-08-15) avdekket at det paret aldri har vært en reell,
-- migrert tabell: `organization_roles` finnes ikke i noen SQL-migrasjon i
-- det hele tatt (kun en Drizzle-deklarasjon, aldri kjørt via drizzle-kit —
-- backend/drizzle.config.ts peker ikke engang på den filen), og den REELLE
-- `user_roles`-tabellen (migrasjon 0001) har en helt annen form: role_id er
-- en FK til `custom_roles`, ingen organization_id-kolonne finnes. Å bygge
-- videre på det aspirasjonelle paret ville feilet migrasjonen med en gang
-- (FK mot en tabell som ikke finnes) og senere feilet enhver INSERT mot
-- user_roles (kolonne som ikke finnes).
--
-- Derfor: egne, tydelig navngitte, org-scopede rolletabeller for Role Room
-- — rører verken `user_roles`/`custom_roles` (den reelle, delte tabellen)
-- eller det aldri-migrerte organizationRoles/userRoles-paret.
--
-- `users` er en delt, plattform-bred tabell (brukt av langt mer enn Role
-- Room) — vi legger derfor IKKE SCIM-spesifikke kolonner på den. En egen
-- mapping-tabell (role_room_scim_users) knytter IdP-ens externalId til vår
-- interne users.id, scoped per organisasjon.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS role_room_organization_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_role_room_organization_roles_org
  ON role_room_organization_roles (organization_id);

CREATE TABLE IF NOT EXISTS role_room_user_org_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES role_room_organization_roles(id) ON DELETE CASCADE,
  assigned_by VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_role_room_user_org_roles_org_user
  ON role_room_user_org_roles (organization_id, user_id);

-- Denne er også det generelle "er denne brukeren et aktivt medlem av denne
-- organisasjonen" — sjekket av SAML-innloggingsflyten (role-room-saml-
-- routes.ts) før en sesjon mintes for org-en, ikke bare av SCIM selv.
CREATE INDEX IF NOT EXISTS idx_role_room_user_org_roles_active
  ON role_room_user_org_roles (organization_id, user_id, is_active);

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS scim_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS scim_bearer_token_hash VARCHAR(64), -- sha256 hex, aldri klartekst
  ADD COLUMN IF NOT EXISTS scim_bearer_token_hint VARCHAR(8), -- siste 8 tegn, for identifikasjon i admin-UI
  ADD COLUMN IF NOT EXISTS scim_token_rotated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scim_default_role_id UUID REFERENCES role_room_organization_roles(id) ON DELETE SET NULL;

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
