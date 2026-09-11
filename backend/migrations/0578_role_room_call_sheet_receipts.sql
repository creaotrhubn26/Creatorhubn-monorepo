-- Durable, token-hashed delivery receipts for Role Room call sheets.
CREATE TABLE IF NOT EXISTS role_room_call_sheet_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  production_day_id VARCHAR(255), revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0), subject VARCHAR(200) NOT NULL,
  sent_by_user_id VARCHAR(255) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rr_call_sheet_deliveries_project_day ON role_room_call_sheet_deliveries(project_id, production_day_id, created_at DESC);
CREATE TABLE IF NOT EXISTS role_room_call_sheet_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), delivery_id UUID NOT NULL REFERENCES role_room_call_sheet_deliveries(id) ON DELETE CASCADE,
  recipient_name VARCHAR(255), recipient_email VARCHAR(320) NOT NULL, token_hash VARCHAR(64) NOT NULL UNIQUE,
  delivery_status VARCHAR(24) NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending','sent','failed')),
  failure_reason VARCHAR(80), provider_message_id VARCHAR(255), sent_at TIMESTAMPTZ, acknowledged_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rr_call_sheet_recipients_delivery ON role_room_call_sheet_recipients(delivery_id);
CREATE INDEX IF NOT EXISTS idx_rr_call_sheet_recipients_token ON role_room_call_sheet_recipients(token_hash);
