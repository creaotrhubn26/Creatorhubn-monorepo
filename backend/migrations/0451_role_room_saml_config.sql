-- 0451_role_room_saml_config.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 1 (Compliance-veikartet): SSO/SAML for Role Room enterprise-kunder.
--
-- `organizations` finnes allerede (migrasjon 285, Lead Map/Leadgrid-tenants)
-- og er allerede FK-målet for role_room_app_installs.organization_id (0450).
-- Vi gjenbruker samme tabell for Role Room-enterprise-orger i stedet for å
-- lage en parallell tenant-modell — legger kun til per-org SAML IdP-config.
--
-- Ingen ny tilgangsmodell: userRoles.organizationId (frontend/shared/
-- enterprise-schema.ts) peker allerede på organizations.id som streng.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS saml_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS saml_idp_entity_id VARCHAR(500),
  ADD COLUMN IF NOT EXISTS saml_idp_sso_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS saml_idp_certificate TEXT,
  ADD COLUMN IF NOT EXISTS saml_sp_entity_id VARCHAR(500),
  ADD COLUMN IF NOT EXISTS saml_want_assertions_signed BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_organizations_saml_enabled
  ON organizations (saml_enabled);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_saml_sp_entity_id
  ON organizations (saml_sp_entity_id)
  WHERE saml_sp_entity_id IS NOT NULL;
