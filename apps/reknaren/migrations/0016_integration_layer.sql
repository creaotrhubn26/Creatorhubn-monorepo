-- Åpent integrasjonslag: API-nøkler (scopet, tilbakekallbar tilgang for eksterne
-- systemer) + webhooks (utgående hendelser med signert leveranse og leveranselogg).
-- Bygger på det samme rettighetsvokabularet (access/permissions) som app-en, og
-- ALT er tenant-scopet per virksomhet.

-- API-nøkler: full nøkkel vises KUN én gang ved opprettelse; kun sha256-hashen
-- lagres. Prefikset er trygt å vise for gjenkjenning i lista.
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,            -- f.eks. "rk_live_ab12cd" (visning)
  key_hash TEXT NOT NULL,              -- sha256(hele nøkkelen)
  scopes TEXT[] NOT NULL DEFAULT '{}', -- delmengde av access/permissions
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID
);
CREATE UNIQUE INDEX api_keys_hash_idx ON api_keys (key_hash);
CREATE INDEX api_keys_org_idx ON api_keys (organization_id) WHERE revoked_at IS NULL;

-- Webhook-endepunkter: ekstern URL + delt hemmelighet (HMAC-signering) +
-- hvilke hendelser den abonnerer på.
CREATE TABLE webhook_endpoints (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  url TEXT NOT NULL,
  secret TEXT NOT NULL,                -- for HMAC-SHA256-signatur
  events TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX webhook_endpoints_org_idx ON webhook_endpoints (organization_id) WHERE active;

-- Leveranselogg: hver hendelse per endepunkt, med retry-tilstand. Append-only
-- historikk for full sporbarhet av hva som ble sendt ut.
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id),
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed')),
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_attempt_at TIMESTAMPTZ,
  response_status INT,
  response_body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX webhook_deliveries_pending_idx ON webhook_deliveries (next_attempt_at)
  WHERE status IN ('pending','failed');
CREATE INDEX webhook_deliveries_org_idx ON webhook_deliveries (organization_id, created_at DESC);
