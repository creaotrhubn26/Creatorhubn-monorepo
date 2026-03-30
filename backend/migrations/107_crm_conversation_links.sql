CREATE TABLE IF NOT EXISTS crm_conversation_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(64) NOT NULL,
  conversation_id VARCHAR(255) NOT NULL,
  customer_id VARCHAR(255),
  deal_id VARCHAR(255),
  project_id VARCHAR(255),
  confidence INTEGER NOT NULL DEFAULT 100,
  matched_by VARCHAR(64) NOT NULL DEFAULT 'manual',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_conversation_links_provider_conversation
  ON crm_conversation_links(provider, conversation_id);

CREATE INDEX IF NOT EXISTS idx_crm_conversation_links_customer
  ON crm_conversation_links(customer_id);
