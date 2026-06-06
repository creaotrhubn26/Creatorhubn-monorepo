-- =====================================================================
-- 243_linkedin_org_config.sql
--
-- Lagrer LinkedIn-org-konfigurasjon i DB (ikke env-vars) slik at:
--   - Access-token kan roteres uten Render-redeploy
--   - Refresh-token håndteres automatisk når den utløper
--   - Daniel kan koble både Creatorhub AS (Company) og The Role Room
--     (Showcase Page) — sistnevnte er vår faktiske publish-target
--   - URN-en hentes fra LinkedIn API ved OAuth-flow, ikke manuelt
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS linkedin_org_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- LinkedIn-identifisering
  organization_urn VARCHAR(120) NOT NULL,        -- urn:li:organization:<id>
  vanity_name VARCHAR(120),                       -- f.eks. "the-role-room"
  display_name VARCHAR(255),                      -- "The Role Room"
  org_type VARCHAR(40) NOT NULL DEFAULT 'company'
    CHECK (org_type IN ('company','showcase')),

  -- Parent (kun for showcase pages)
  parent_organization_urn VARCHAR(120),           -- urn:li:organization:<parent-id>
  parent_display_name VARCHAR(255),               -- "Creatorhub AS"

  -- OAuth-tokens
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,                -- når access-tokenen utløper
  refresh_expires_at TIMESTAMPTZ,                 -- når refresh-tokenen utløper (365 d)
  scopes TEXT[] NOT NULL DEFAULT '{}'::TEXT[],    -- f.eks. {'w_organization_social','r_organization_admin'}

  -- Hvem koblet
  connected_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Status
  is_default BOOLEAN NOT NULL DEFAULT FALSE,      -- Daniel velger én default per publish
  last_used_at TIMESTAMPTZ,
  last_publish_at TIMESTAMPTZ,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT linkedin_org_unique UNIQUE (organization_urn)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_org_default
  ON linkedin_org_config(is_default) WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS idx_linkedin_org_expires_at
  ON linkedin_org_config(expires_at);

-- OAuth state-tabell for å validere callback (CSRF-beskyttelse)
CREATE TABLE IF NOT EXISTS linkedin_oauth_states (
  state VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '15 minutes'
);

-- Cleanup gamle states (gjøres on-write — ingen cron nødvendig)
CREATE INDEX IF NOT EXISTS idx_linkedin_oauth_states_expires
  ON linkedin_oauth_states(expires_at);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_linkedin_org_config_set_updated_at ON linkedin_org_config;
CREATE TRIGGER trg_linkedin_org_config_set_updated_at
  BEFORE UPDATE ON linkedin_org_config
  FOR EACH ROW EXECUTE FUNCTION cockpit_b2b_set_updated_at();

COMMIT;
