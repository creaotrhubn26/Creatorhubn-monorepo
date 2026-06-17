-- 299_role_room_vault_v2.sql
-- Access Vault v2: multi-secret per plattform + per-secret tilgang + eierskap
-- + rotasjon/reveal-TTL. Bygger på trust-first-designet (klienten eier nøklene).
--
-- Alt er additivt og bakoverkompatibelt: eksisterende rader får account_label=''
-- og owner_side='producer', og forblir unike per plattform.

-- ── 1. Nye kolonner på secrets ────────────────────────────────────────────
ALTER TABLE role_room_access_vault_secrets
  ADD COLUMN IF NOT EXISTS account_label VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS owner_side VARCHAR(16) NOT NULL DEFAULT 'producer',
  ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reveal_ttl_seconds INTEGER NOT NULL DEFAULT 300;

-- ── 2. Multi-secret per plattform ─────────────────────────────────────────
-- Bytt unik (project_id, platform) → (project_id, platform, account_label),
-- så et byrå kan ha flere Meta-kontoer etc. Eksisterende '' beholder unikhet.
DROP INDEX IF EXISTS idx_rr_access_vault_secrets_platform;
CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_access_vault_secrets_platform_label
  ON role_room_access_vault_secrets (project_id, platform, account_label);

-- ── 3. Per-secret tilgangstildeling (least-privilege) ─────────────────────
-- En rolle gir ikke lenger automatisk innsyn i ALT. Innsyn kan tildeles per
-- hemmelighet til en bruker/rolle, med valgfri utløp.
CREATE TABLE IF NOT EXISTS role_room_access_vault_grants (
  id UUID PRIMARY KEY,
  secret_id UUID NOT NULL REFERENCES role_room_access_vault_secrets(id) ON DELETE CASCADE,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  grantee_user_id VARCHAR(255),
  grantee_role VARCHAR(80),
  granted_by_user_id VARCHAR(255),
  granted_by_role VARCHAR(80),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_rr_access_vault_grants_secret
  ON role_room_access_vault_grants (secret_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rr_access_vault_grants_grantee
  ON role_room_access_vault_grants (project_id, grantee_user_id) WHERE revoked_at IS NULL;

COMMENT ON COLUMN role_room_access_vault_secrets.account_label IS
  'Konto-/instans-navn for multi-secret per plattform (f.eks. «Hovedkonto», «Test»). '''' = enkelt-secret (bakoverkomp.).';
COMMENT ON COLUMN role_room_access_vault_secrets.owner_side IS
  'Hvem eier credentialen: client | producer. Klient-eide legges inn av klienten selv (trust-first).';
COMMENT ON COLUMN role_room_access_vault_secrets.reveal_ttl_seconds IS
  'Hvor lenge et godkjent reveal er synlig før auto-lås (sekunder). Frontend viser nedtelling.';
