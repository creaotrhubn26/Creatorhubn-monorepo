-- 0092_photographer_integrations.sql
-- Per-tenant credentials for push-integrasjoner (PowerOffice Go først,
-- senere Tripletex/Fiken). ClientKey er per-fotograf secret som limes
-- inn fra PowerOffice GO under Innstillinger → API-klienter.
--
-- Access-tokens (20-min TTL) cacher i memory (process-level), persisteres
-- IKKE her. Vi tar ikke ansvar for tenants som roterer clientKey eksternt
-- — neste API-kall feiler da med 401 og vi setter status='invalid'.

CREATE TABLE IF NOT EXISTS photographer_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id VARCHAR(64) NOT NULL,
  provider VARCHAR(32) NOT NULL,              -- 'poweroffice' | (future: 'tripletex' | 'fiken')
  client_key TEXT NOT NULL,                   -- per-tenant secret fra eksternt system
  label TEXT,                                  -- "Stine Larsen Foto AS - Produksjon"
  status VARCHAR(32) DEFAULT 'active',         -- 'active' | 'disabled' | 'invalid'
  last_verified_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (photographer_id, provider)
);

CREATE INDEX IF NOT EXISTS photographer_integrations_photographer_idx
  ON photographer_integrations (photographer_id);
CREATE INDEX IF NOT EXISTS photographer_integrations_provider_idx
  ON photographer_integrations (provider, status);

COMMENT ON COLUMN photographer_integrations.client_key IS
  'Per-tenant API-secret. PowerOffice: ClientKey fra Innstillinger → API-klienter. Aldri returnert til frontend.';
COMMENT ON COLUMN photographer_integrations.status IS
  'active = bruk normalt. invalid = siste auth feilet, må reconnect. disabled = midlertidig av.';
