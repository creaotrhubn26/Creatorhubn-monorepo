-- =====================================================================
-- 264_client_scope_permissions_tos.sql
--
-- Fin-grained scope-permissions per klient-config (TikTok + andre
-- plattformer) + ToS-aksept-audit-trail for GDPR/juridisk dekning.
--
-- Klient må eksplisitt godkjenne hver handling som krever deres data:
--   - audience_upload  (e-postlister sendes til TikTok)
--   - crm_event_sync   (konverterings-data sendes til TikTok)
--   - plugin_install   (nettside/butikk bindes til TikTok Business)
--   - creator_invitation (producer inviterer creators på klientens vegne)
--
-- I tillegg signerer klient en samlet vilkårsavtale som dekker:
--   - producer-fullmakt på vegne av klient mot TikTok
--   - SHA256-hashing av PII før send
--   - 20% mgmt-fee struktur
--   - rett til å trekke samtykke når som helst
-- =====================================================================

BEGIN;

ALTER TABLE client_ads_configs
  ADD COLUMN IF NOT EXISTS scope_permissions JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS authorization_terms_version TEXT,
  ADD COLUMN IF NOT EXISTS authorization_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS authorization_accepted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS authorization_revoked_at TIMESTAMPTZ;
  -- scope_permissions = {"audience_upload": "approved", "crm_event_sync": "pending",
  --                       "plugin_install": "rejected", "creator_invitation": "approved"}

CREATE INDEX IF NOT EXISTS idx_client_ads_configs_authorization
  ON client_ads_configs(authorization_accepted_at DESC)
  WHERE authorization_revoked_at IS NULL;

-- Full audit-trail for hver ToS-aksept (kreves av GDPR Art. 7.1)
CREATE TABLE IF NOT EXISTS client_authorization_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE NOT NULL,
  client_project_id UUID NOT NULL,
  accepted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_by_name TEXT,                    -- snapshot
  accepted_by_email TEXT,                   -- snapshot
  terms_version TEXT NOT NULL,
  permissions_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  revoke_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_authz_accept_config
  ON client_authorization_acceptances(config_id, accepted_at DESC);
CREATE INDEX IF NOT EXISTS idx_authz_accept_project
  ON client_authorization_acceptances(client_project_id, accepted_at DESC);
CREATE INDEX IF NOT EXISTS idx_authz_accept_active
  ON client_authorization_acceptances(config_id)
  WHERE revoked_at IS NULL;

COMMIT;
