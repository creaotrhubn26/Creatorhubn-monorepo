-- Role Room integrations phase 2
-- Adds integration accounts, dedicated API keys, object mappings, webhook subscriptions,
-- outbox delivery queue, and idempotency persistence for the external v1 API.

CREATE TABLE IF NOT EXISTS role_room_integration_accounts (
  id UUID PRIMARY KEY,
  slug VARCHAR(120) NOT NULL,
  name VARCHAR(255) NOT NULL,
  owner_user_id VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  allowed_scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 120,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_integration_accounts_slug_unique
  ON role_room_integration_accounts(slug);
CREATE INDEX IF NOT EXISTS idx_rr_integration_accounts_owner
  ON role_room_integration_accounts(owner_user_id);

CREATE TABLE IF NOT EXISTS role_room_integration_api_keys (
  id UUID PRIMARY KEY,
  integration_account_id UUID NOT NULL REFERENCES role_room_integration_accounts(id) ON DELETE CASCADE,
  label VARCHAR(255) NOT NULL,
  key_hash VARCHAR(128) NOT NULL,
  created_for_user_id VARCHAR(255) NOT NULL,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_integration_api_keys_hash_unique
  ON role_room_integration_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_rr_integration_api_keys_account
  ON role_room_integration_api_keys(integration_account_id);

CREATE TABLE IF NOT EXISTS role_room_integration_object_mappings (
  id UUID PRIMARY KEY,
  integration_account_id UUID NOT NULL REFERENCES role_room_integration_accounts(id) ON DELETE CASCADE,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  local_object_type VARCHAR(100) NOT NULL,
  local_object_id VARCHAR(255) NOT NULL,
  external_object_type VARCHAR(100) NOT NULL,
  external_object_id VARCHAR(255) NOT NULL,
  direction VARCHAR(20) NOT NULL DEFAULT 'bidirectional',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_integration_mappings_local_unique
  ON role_room_integration_object_mappings(
    integration_account_id,
    project_id,
    local_object_type,
    local_object_id,
    external_object_type
  );
CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_integration_mappings_external_unique
  ON role_room_integration_object_mappings(
    integration_account_id,
    project_id,
    external_object_type,
    external_object_id,
    local_object_type
  );
CREATE INDEX IF NOT EXISTS idx_rr_integration_mappings_project
  ON role_room_integration_object_mappings(project_id);

CREATE TABLE IF NOT EXISTS role_room_integration_webhooks (
  id UUID PRIMARY KEY,
  integration_account_id UUID NOT NULL REFERENCES role_room_integration_accounts(id) ON DELETE CASCADE,
  label VARCHAR(255),
  endpoint_url TEXT NOT NULL,
  signing_secret_encrypted TEXT NOT NULL,
  event_types JSONB NOT NULL DEFAULT '["*"]'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  last_delivered_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rr_integration_webhooks_account
  ON role_room_integration_webhooks(integration_account_id);

CREATE TABLE IF NOT EXISTS role_room_integration_event_outbox (
  id UUID PRIMARY KEY,
  integration_account_id UUID NOT NULL REFERENCES role_room_integration_accounts(id) ON DELETE CASCADE,
  webhook_id UUID NOT NULL REFERENCES role_room_integration_webhooks(id) ON DELETE CASCADE,
  event_type VARCHAR(120) NOT NULL,
  aggregate_type VARCHAR(120) NOT NULL,
  aggregate_id VARCHAR(255) NOT NULL,
  project_id VARCHAR(255) REFERENCES casting_projects(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  last_error TEXT,
  last_response_status INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rr_integration_outbox_pending
  ON role_room_integration_event_outbox(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_rr_integration_outbox_account
  ON role_room_integration_event_outbox(integration_account_id);

CREATE TABLE IF NOT EXISTS role_room_integration_idempotency_keys (
  id UUID PRIMARY KEY,
  scope_key VARCHAR(255) NOT NULL,
  integration_account_id UUID REFERENCES role_room_integration_accounts(id) ON DELETE CASCADE,
  request_method VARCHAR(10) NOT NULL,
  request_path TEXT NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  request_hash VARCHAR(128) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'processing',
  response_status INTEGER,
  response_body JSONB,
  resource_type VARCHAR(120),
  resource_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_integration_idempotency_unique
  ON role_room_integration_idempotency_keys(scope_key, request_method, request_path, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_rr_integration_idempotency_account
  ON role_room_integration_idempotency_keys(integration_account_id);
