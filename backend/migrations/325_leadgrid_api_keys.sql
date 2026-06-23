-- ===========================================================================
-- Migration 0337 — Leadgrid Public API v1: API-keys + usage tracking
-- ===========================================================================
-- Skalering nivå 3 pakke C: Public API v1 namespace for 3.-parts-integrasjoner
-- (Salesforce, HubSpot, custom connectors).
--
-- - leadgrid_api_keys: per-org API-keys med scopes + rate-limit + revocation
-- - leadgrid_api_key_usage: per-minutt request-counter (DB-backup for
--   in-memory counter i middleware)
-- - permissions + role_permissions: api_keys.create/view/revoke
--
-- API-key format: 'lgk_live_<24 bytes base64url>' eller 'lgk_test_<...>'
-- Key_hash er SHA-256(token), prefix er 'lgk_live_' eller 'lgk_test_'
-- (9 tegn inkl. trailing underscore).
-- ===========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS leadgrid_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name VARCHAR(120) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,        -- 'lgk_live_' eller 'lgk_test_'
  key_hash TEXT NOT NULL,                  -- SHA-256-hash av token (hex)
  -- Scope = tillatte handlinger. JSON-array av strenger.
  -- Eksempel: ["leads.read","recommendations.read"] eller ["*"] for full.
  scopes JSONB NOT NULL DEFAULT '["leads.read"]'::jsonb,
  -- Rate-limit: requests pr minutt (default 60 = 1 RPS sustained)
  rate_limit_rpm INTEGER NOT NULL DEFAULT 60,
  -- Brukstracking
  last_used_at TIMESTAMPTZ,
  total_requests BIGINT DEFAULT 0,
  -- Lifecycle
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_api_keys_org_active
  ON leadgrid_api_keys(organization_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leadgrid_api_keys_prefix
  ON leadgrid_api_keys(key_prefix);

-- Lookup-index for auth-middleware: (prefix, hash) treff på hver request
CREATE INDEX IF NOT EXISTS idx_leadgrid_api_keys_lookup
  ON leadgrid_api_keys(key_prefix, key_hash)
  WHERE revoked_at IS NULL;

-- ───────────────────────────────────────────────────────────────────
-- Per-minutt rate-limit counter (DB-backup; primær teller er in-memory
-- i middleware-prosessen).
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leadgrid_api_key_usage (
  api_key_id UUID NOT NULL,
  minute_bucket TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 0,
  PRIMARY KEY (api_key_id, minute_bucket)
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_api_key_usage_cleanup
  ON leadgrid_api_key_usage(minute_bucket);

-- ───────────────────────────────────────────────────────────────────
-- Permissions: hvem kan opprette/revokere/se API-keys i en org
-- ───────────────────────────────────────────────────────────────────
INSERT INTO permissions (key, category, description) VALUES
  ('api_keys.create', 'Public API', 'Lag nye API-nøkler for org-en'),
  ('api_keys.revoke', 'Public API', 'Trekk tilbake API-nøkler'),
  ('api_keys.view', 'Public API', 'Se org-ens API-nøkler')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, permission_key) VALUES
  ('admin', 'api_keys.create'),
  ('admin', 'api_keys.revoke'),
  ('admin', 'api_keys.view'),
  ('salgssjef', 'api_keys.view')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
