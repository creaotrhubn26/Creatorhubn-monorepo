-- 0492_role_room_marketing_runtime_schema.sql
--
-- Canonical persistence for Role Room marketing, social inbox, publishing,
-- infographic and demo-studio flows. Each relation is owned by exactly this
-- migration in the new reconciliation set.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(hashtext('0492_role_room_marketing_runtime_schema'));

CREATE TABLE IF NOT EXISTS demo_studio_assets (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  host TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_demo_studio_assets_owner_host
  ON demo_studio_assets (created_by, host, created_at DESC);

CREATE TABLE IF NOT EXISTS demo_studio_projects (
  id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT,
  scene_count INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_by)
);
CREATE INDEX IF NOT EXISTS idx_demo_studio_projects_owner_updated
  ON demo_studio_projects (created_by, updated_at DESC);

CREATE TABLE IF NOT EXISTS infographic_ai_signals (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  tpl_id TEXT NOT NULL,
  liked BOOLEAN NOT NULL,
  weight REAL NOT NULL DEFAULT 1,
  desc_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ig_signals_created_at
  ON infographic_ai_signals (created_at);

CREATE TABLE IF NOT EXISTS infographic_library (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  author_name TEXT,
  name TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  preview_tpl_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ig_library_updated
  ON infographic_library (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ig_library_owner
  ON infographic_library (created_by, updated_at DESC);

CREATE TABLE IF NOT EXISTS published_guide_views (
  guide_id TEXT PRIMARY KEY,
  views BIGINT NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS role_room_instagram_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  ig_business_account_id TEXT NOT NULL,
  external_conversation_id TEXT,
  participant_igsid TEXT NOT NULL,
  participant_username TEXT,
  participant_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_snippet TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  crm_customer_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (connection_id, participant_igsid)
);
CREATE INDEX IF NOT EXISTS idx_rr_ig_convos_conn
  ON role_room_instagram_conversations (connection_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_rr_ig_convos_user
  ON role_room_instagram_conversations (user_id);

CREATE TABLE IF NOT EXISTS role_room_instagram_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES role_room_instagram_conversations(id) ON DELETE CASCADE,
  external_message_id TEXT UNIQUE,
  direction TEXT NOT NULL,
  sender_igsid TEXT,
  body TEXT,
  attachment_url TEXT,
  attachment_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT role_room_instagram_messages_direction_check
    CHECK (direction IN ('inbound', 'outbound'))
);
CREATE INDEX IF NOT EXISTS idx_rr_ig_msgs_convo
  ON role_room_instagram_messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS role_room_lead_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  connection_id UUID NOT NULL,
  lead_external_id TEXT NOT NULL,
  segment TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  ai_suggested BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT role_room_lead_segments_segment_check
    CHECK (segment IN ('varm', 'lunken', 'kald', 'tapt')),
  UNIQUE (user_id, lead_external_id)
);
ALTER TABLE role_room_lead_segments
  ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ai_suggested BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_rr_lead_segments_user
  ON role_room_lead_segments (user_id, connection_id);

CREATE TABLE IF NOT EXISTS role_room_lead_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  connection_id UUID NOT NULL,
  form_id TEXT NOT NULL,
  lead_external_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  value_kr NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT role_room_lead_outcomes_stage_check
    CHECK (stage IN ('svart', 'booket', 'kunde', 'tapt')),
  UNIQUE (user_id, lead_external_id)
);
CREATE INDEX IF NOT EXISTS idx_rr_lead_outcomes_form
  ON role_room_lead_outcomes (user_id, connection_id, form_id);

CREATE TABLE IF NOT EXISTS role_room_lead_spend (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  connection_id UUID NOT NULL,
  form_id TEXT NOT NULL,
  spend_kr NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT role_room_lead_spend_nonnegative_check CHECK (spend_kr >= 0),
  UNIQUE (user_id, connection_id, form_id)
);

CREATE TABLE IF NOT EXISTS role_room_lead_followup_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  connection_id UUID NOT NULL,
  sms_body TEXT NOT NULL DEFAULT '',
  email_subject TEXT NOT NULL DEFAULT '',
  email_body TEXT NOT NULL DEFAULT '',
  reply_to TEXT NOT NULL DEFAULT '',
  notify_phone TEXT NOT NULL DEFAULT '',
  notify_email TEXT NOT NULL DEFAULT '',
  ai_personalize BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, connection_id)
);
ALTER TABLE role_room_lead_followup_config
  ADD COLUMN IF NOT EXISTS reply_to TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ai_personalize BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS role_room_lead_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  connection_id UUID NOT NULL,
  form_id TEXT NOT NULL,
  lead_external_id TEXT NOT NULL,
  sms_sent BOOLEAN NOT NULL DEFAULT FALSE,
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, lead_external_id)
);
ALTER TABLE role_room_lead_followups
  ADD COLUMN IF NOT EXISTS whatsapp_sent BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_rr_lead_followups_connection
  ON role_room_lead_followups (user_id, connection_id, created_at DESC);

CREATE TABLE IF NOT EXISTS role_room_lead_email_domain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  connection_id UUID NOT NULL,
  domain TEXT NOT NULL,
  resend_domain_id TEXT NOT NULL,
  from_address TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, connection_id)
);

CREATE TABLE IF NOT EXISTS role_room_mention_triage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  connection_id UUID NOT NULL,
  mention_external_id TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT role_room_mention_triage_status_check
    CHECK (status IN ('svart', 'lead', 'skjult')),
  UNIQUE (user_id, mention_external_id)
);
CREATE INDEX IF NOT EXISTS idx_rr_mention_triage_conn
  ON role_room_mention_triage (user_id, connection_id);

-- Tokens are encrypted by role-room-publish-providers before persistence.
CREATE TABLE IF NOT EXISTS role_room_publish_connections (
  project_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  expires_at TIMESTAMPTZ,
  remote_name TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT role_room_publish_connections_platform_check
    CHECK (platform IN ('tiktok', 'youtube', 'pinterest')),
  PRIMARY KEY (project_id, platform)
);

CREATE TABLE IF NOT EXISTS role_room_social_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scope, user_id, key)
);
CREATE INDEX IF NOT EXISTS idx_rr_social_idempotency_created
  ON role_room_social_idempotency (created_at);

COMMIT;
