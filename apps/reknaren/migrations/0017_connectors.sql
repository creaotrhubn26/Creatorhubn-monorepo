-- Inngående data-connectors: rammeverk som henter transaksjoner/bilag fra
-- eksterne kilder inn i SAMME idempotente bilagsinnboks. Hver kilde er en
-- adapter bak SourceConnector-porten; ingenting bokføres automatisk — det
-- havner som bilag til menneskelig godkjenning.

-- Hvilke connectorer en virksomhet har koblet på + synk-markør (cursor).
CREATE TABLE connector_connections (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  connector_id TEXT NOT NULL,          -- f.eks. 'stripe-charges'
  config JSONB NOT NULL DEFAULT '{}',  -- ikke-hemmelige innstillinger (hemmeligheter fra env)
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disconnected')),
  cursor TEXT,                          -- siste synk-markør (unix-sekunder e.l.)
  last_sync_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, connector_id)
);
CREATE INDEX connector_connections_active_idx ON connector_connections (connector_id) WHERE status = 'active';

-- Idempotens-hovedbok: hver ekstern post importeres KUN én gang per connector.
CREATE TABLE connector_imports (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  connector_id TEXT NOT NULL,
  external_id TEXT NOT NULL,            -- kildens stabile id (f.eks. ch_…)
  document_id UUID REFERENCES source_documents(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, connector_id, external_id)
);
