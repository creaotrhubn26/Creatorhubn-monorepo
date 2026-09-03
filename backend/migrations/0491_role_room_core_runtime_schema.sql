-- 0491_role_room_core_runtime_schema.sql
--
-- Canonical schema for Role Room persistence that was previously created
-- lazily by request handlers. Runtime CREATE TABLE guards remain compatible,
-- but a fresh database no longer depends on a route being called first.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(hashtext('0491_role_room_core_runtime_schema'));

CREATE TABLE IF NOT EXISTS admin_inbound_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'ukjent',
  title TEXT NOT NULL,
  summary TEXT,
  cta TEXT,
  page TEXT,
  utm JSONB,
  link TEXT,
  related_id TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE admin_inbound_alerts
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'ukjent',
  ADD COLUMN IF NOT EXISTS cta TEXT,
  ADD COLUMN IF NOT EXISTS page TEXT,
  ADD COLUMN IF NOT EXISTS utm JSONB,
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;
CREATE INDEX IF NOT EXISTS idx_admin_inbound_alerts_unread
  ON admin_inbound_alerts (created_at DESC) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS contract_google_signatures (
  id VARCHAR PRIMARY KEY,
  contract_id VARCHAR NOT NULL,
  provider VARCHAR(50) DEFAULT 'google_workspace',
  status VARCHAR(50) DEFAULT 'not_started',
  document_title VARCHAR(500),
  drive_source_file_id VARCHAR(255),
  pdf_snapshot_drive_file_id VARCHAR(255),
  signed_drive_file_id VARCHAR(255),
  audit_artifact_id VARCHAR(255),
  request_url TEXT,
  web_view_url TEXT,
  requested_by VARCHAR,
  requested_by_email VARCHAR,
  counterparty_name VARCHAR,
  counterparty_email VARCHAR,
  prepared_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  signature_hash VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_google_signatures_contract_id
  ON contract_google_signatures (contract_id);

CREATE TABLE IF NOT EXISTS legacy_compat_store (
  store_key TEXT PRIMARY KEY,
  store_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_room_onboarding_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  config JSONB NOT NULL,
  updated_by_user_id VARCHAR(255),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_room_member_profiles (
  user_id VARCHAR(255) PRIMARY KEY,
  display_name VARCHAR(255),
  bio TEXT,
  professions JSONB NOT NULL DEFAULT '[]'::jsonb,
  company_name VARCHAR(255),
  organization_number VARCHAR(16),
  business_address VARCHAR(500),
  location_city VARCHAR(120),
  location_country VARCHAR(120),
  website VARCHAR(500),
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  showreel_url VARCHAR(500),
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  languages JSONB NOT NULL DEFAULT '[]'::jsonb,
  profile_image_url VARCHAR(500),
  profile_image_focal_x SMALLINT,
  profile_image_focal_y SMALLINT,
  years_experience SMALLINT,
  earlier_projects JSONB NOT NULL DEFAULT '[]'::jsonb,
  portfolio_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  availability_status VARCHAR(32),
  work_preferences JSONB NOT NULL DEFAULT '[]'::jsonb,
  equipment JSONB NOT NULL DEFAULT '[]'::jsonb,
  certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  member_references JSONB NOT NULL DEFAULT '[]'::jsonb,
  expertise_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
  banner_image_url VARCHAR(500),
  visibility VARCHAR(32) NOT NULL DEFAULT 'connections',
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_completed_at TIMESTAMPTZ,
  onboarding_progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE role_room_member_profiles
  ADD COLUMN IF NOT EXISTS organization_number VARCHAR(16),
  ADD COLUMN IF NOT EXISTS business_address VARCHAR(500),
  ADD COLUMN IF NOT EXISTS profile_image_focal_x SMALLINT,
  ADD COLUMN IF NOT EXISTS profile_image_focal_y SMALLINT,
  ADD COLUMN IF NOT EXISTS years_experience SMALLINT,
  ADD COLUMN IF NOT EXISTS earlier_projects JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS portfolio_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS availability_status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS work_preferences JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS equipment JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS member_references JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS expertise_areas JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_rr_member_profiles_visibility
  ON role_room_member_profiles (visibility);
CREATE INDEX IF NOT EXISTS idx_rr_member_profiles_onboarding
  ON role_room_member_profiles (onboarding_completed)
  WHERE onboarding_completed = FALSE;

CREATE TABLE IF NOT EXISTS role_room_member_availability (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'available',
  note VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rr_availability_user
  ON role_room_member_availability (user_id, start_date);

CREATE TABLE IF NOT EXISTS role_room_project_tab_overrides (
  project_id VARCHAR(255) NOT NULL,
  target_type VARCHAR(16) NOT NULL CHECK (target_type IN ('role', 'user')),
  target_value VARCHAR(255) NOT NULL,
  tab_values TEXT[] NOT NULL DEFAULT '{}'::text[],
  tab_access JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by_user_id VARCHAR(255),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, target_type, target_value)
);
ALTER TABLE role_room_project_tab_overrides
  ADD COLUMN IF NOT EXISTS tab_access JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_rrptc_project_id
  ON role_room_project_tab_overrides (project_id);

CREATE TABLE IF NOT EXISTS role_room_calendar_events (
  id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_type VARCHAR(64) NOT NULL DEFAULT 'general',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  location_id VARCHAR(255),
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  candidate_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  crew_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  equipment_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  shot_list_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rr_calendar_events_project
  ON role_room_calendar_events (project_id);
CREATE INDEX IF NOT EXISTS idx_rr_calendar_events_start_time
  ON role_room_calendar_events (start_time);

CREATE TABLE IF NOT EXISTS role_room_client_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  context_area TEXT NOT NULL,
  context_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  client_email TEXT NOT NULL,
  client_name TEXT,
  marketer_user_id TEXT,
  marketer_email TEXT,
  booking_url TEXT,
  public_access_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_rr_client_requests_project
  ON role_room_client_requests (project_id);
CREATE INDEX IF NOT EXISTS idx_rr_client_requests_status
  ON role_room_client_requests (project_id, status);
CREATE INDEX IF NOT EXISTS idx_rr_client_requests_token
  ON role_room_client_requests (public_access_token);

CREATE TABLE IF NOT EXISTS role_room_client_request_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES role_room_client_requests(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  sender_label TEXT,
  body_markdown TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rr_client_request_messages_request
  ON role_room_client_request_messages (request_id, created_at);

CREATE TABLE IF NOT EXISTS role_room_story_logic (
  project_id VARCHAR(255) PRIMARY KEY REFERENCES casting_projects(id) ON DELETE CASCADE,
  story_logic JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by_user_id VARCHAR(255),
  updated_by_role VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_room_story_logic_audit_events (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  action VARCHAR(80) NOT NULL,
  actor_user_id VARCHAR(255),
  actor_role VARCHAR(80),
  previous_version INTEGER,
  next_version INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rr_story_logic_audit_project
  ON role_room_story_logic_audit_events (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS role_room_coverage_reviews (
  project_id VARCHAR(255) PRIMARY KEY REFERENCES casting_projects(id) ON DELETE CASCADE,
  take_reviews JSONB NOT NULL DEFAULT '{}'::jsonb,
  shot_line_coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by_user_id VARCHAR(255),
  updated_by_role VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_room_coverage_review_audit_events (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  action VARCHAR(80) NOT NULL,
  actor_user_id VARCHAR(255),
  actor_role VARCHAR(80),
  previous_version INTEGER,
  next_version INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rr_coverage_review_audit_project
  ON role_room_coverage_review_audit_events (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS role_room_project_notifications (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  audience VARCHAR(32) NOT NULL DEFAULT 'producer_team',
  event_type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  linked_entity_type VARCHAR(100),
  linked_entity_id VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id VARCHAR(255),
  created_by_role VARCHAR(80),
  inbox_type VARCHAR(80) NOT NULL DEFAULT 'general',
  client_name VARCHAR(255),
  client_email VARCHAR(255),
  assigned_to_user_id VARCHAR(255),
  assigned_to_label VARCHAR(255),
  due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id VARCHAR(255),
  archived_at TIMESTAMPTZ,
  archived_by_user_id VARCHAR(255),
  mention_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  mention_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE role_room_project_notifications
  ADD COLUMN IF NOT EXISTS inbox_type VARCHAR(80) NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS client_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS client_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS assigned_to_user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS assigned_to_label VARCHAR(255),
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by_user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by_user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS mention_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mention_emails JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_rr_project_notifications_project
  ON role_room_project_notifications (project_id);
CREATE INDEX IF NOT EXISTS idx_rr_project_notifications_audience
  ON role_room_project_notifications (audience);
CREATE INDEX IF NOT EXISTS idx_rr_project_notifications_updated
  ON role_room_project_notifications (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rr_project_notifications_inbox_type
  ON role_room_project_notifications (project_id, inbox_type, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rr_project_notifications_client
  ON role_room_project_notifications (project_id, client_email, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rr_project_notifications_due
  ON role_room_project_notifications (project_id, due_at)
  WHERE due_at IS NOT NULL AND resolved_at IS NULL AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rr_project_notifications_open
  ON role_room_project_notifications (project_id, updated_at DESC)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS role_room_project_notification_reads (
  notification_id UUID NOT NULL REFERENCES role_room_project_notifications(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notification_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_rr_notification_reads_user
  ON role_room_project_notification_reads (user_id, read_at DESC);

CREATE TABLE IF NOT EXISTS role_room_expenses (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  merchant_name VARCHAR(255),
  expense_date DATE,
  amount NUMERIC(12, 2),
  vat_amount NUMERIC(12, 2),
  currency VARCHAR(12) NOT NULL DEFAULT 'NOK',
  category VARCHAR(120),
  paid_by_user_id VARCHAR(255),
  paid_by_label VARCHAR(255),
  cost_owner VARCHAR(120) NOT NULL DEFAULT 'client',
  refund_status VARCHAR(80) NOT NULL DEFAULT 'not_requested',
  client_approval_status VARCHAR(80) NOT NULL DEFAULT 'pending',
  duplicate_of_expense_id UUID REFERENCES role_room_expenses(id) ON DELETE SET NULL,
  ocr_status VARCHAR(80) NOT NULL DEFAULT 'pending',
  ocr_confidence NUMERIC(5, 4),
  ocr_review_required BOOLEAN NOT NULL DEFAULT TRUE,
  amount_validation_status VARCHAR(80) NOT NULL DEFAULT 'pending',
  vat_validation_status VARCHAR(80) NOT NULL DEFAULT 'pending',
  privacy_notice_acknowledged_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id VARCHAR(255),
  created_by_role VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rr_expenses_project
  ON role_room_expenses (project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rr_expenses_refund
  ON role_room_expenses (project_id, refund_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rr_expenses_client_approval
  ON role_room_expenses (project_id, client_approval_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rr_expenses_duplicate_lookup
  ON role_room_expenses (project_id, merchant_name, expense_date, amount);

CREATE TABLE IF NOT EXISTS role_room_expense_receipt_files (
  id UUID PRIMARY KEY,
  expense_id UUID NOT NULL REFERENCES role_room_expenses(id) ON DELETE CASCADE,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  mime_type VARCHAR(160),
  file_size BIGINT,
  storage_path TEXT NOT NULL,
  sha256 VARCHAR(128),
  page_count INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by_user_id VARCHAR(255),
  uploaded_by_role VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rr_expense_receipts_expense
  ON role_room_expense_receipt_files (expense_id, created_at DESC);
DROP INDEX IF EXISTS idx_rr_expense_receipts_hash;
CREATE INDEX IF NOT EXISTS idx_rr_expense_receipts_hash
  ON role_room_expense_receipt_files (project_id, sha256)
  WHERE sha256 IS NOT NULL;

CREATE TABLE IF NOT EXISTS role_room_receipt_ocr_jobs (
  id UUID PRIMARY KEY,
  expense_id UUID NOT NULL REFERENCES role_room_expenses(id) ON DELETE CASCADE,
  receipt_file_id UUID REFERENCES role_room_expense_receipt_files(id) ON DELETE SET NULL,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  status VARCHAR(80) NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  confidence NUMERIC(5, 4),
  extracted_text TEXT,
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  engine VARCHAR(120) NOT NULL DEFAULT 'server-heuristic',
  last_error TEXT,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rr_receipt_ocr_jobs_project
  ON role_room_receipt_ocr_jobs (project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rr_receipt_ocr_jobs_status
  ON role_room_receipt_ocr_jobs (status, queued_at);

CREATE TABLE IF NOT EXISTS role_room_receipt_ocr_audit_events (
  id UUID PRIMARY KEY,
  expense_id UUID NOT NULL REFERENCES role_room_expenses(id) ON DELETE CASCADE,
  receipt_file_id UUID REFERENCES role_room_expense_receipt_files(id) ON DELETE SET NULL,
  ocr_job_id UUID REFERENCES role_room_receipt_ocr_jobs(id) ON DELETE SET NULL,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  actor_user_id VARCHAR(255),
  actor_role VARCHAR(80),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rr_receipt_ocr_audit_project
  ON role_room_receipt_ocr_audit_events (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS role_room_receipt_merchant_registry (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  merchant_name VARCHAR(255) NOT NULL,
  normalized_name VARCHAR(255) NOT NULL,
  default_category VARCHAR(120),
  organization_number VARCHAR(64),
  vat_registered BOOLEAN,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_receipt_merchants_unique
  ON role_room_receipt_merchant_registry (project_id, normalized_name);

CREATE TABLE IF NOT EXISTS role_room_push_subscriptions (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  scope VARCHAR(32) NOT NULL DEFAULT 'producer_team',
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ,
  last_error TEXT,
  disabled_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_push_subscriptions_unique_endpoint
  ON role_room_push_subscriptions (project_id, scope, endpoint);
CREATE INDEX IF NOT EXISTS idx_rr_push_subscriptions_project
  ON role_room_push_subscriptions (project_id, scope, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rr_push_subscriptions_user
  ON role_room_push_subscriptions (user_id, updated_at DESC);

-- This base table previously only existed behind a runtime CREATE TABLE.
-- Migration 299 extends it, but never created it itself; keeping the complete
-- current shape here also makes the reveal/audit foreign keys below portable.
CREATE TABLE IF NOT EXISTS role_room_access_vault_secrets (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  platform VARCHAR(32) NOT NULL,
  label VARCHAR(255),
  secret_type VARCHAR(120),
  username_encrypted TEXT,
  secret_encrypted TEXT,
  backup_code_encrypted TEXT,
  masked_reference TEXT,
  tier VARCHAR(32) NOT NULL DEFAULT 'sensitive_secret',
  risk_level VARCHAR(32) NOT NULL DEFAULT 'medium',
  reveal_policy VARCHAR(32) NOT NULL DEFAULT 'approval_required',
  status VARCHAR(32) NOT NULL DEFAULT 'not_shared',
  owner_label VARCHAR(255),
  shared_with_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id VARCHAR(255),
  created_by_role VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_revealed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  account_label VARCHAR(255) NOT NULL DEFAULT '',
  owner_side VARCHAR(16) NOT NULL DEFAULT 'producer',
  rotated_at TIMESTAMPTZ,
  reveal_ttl_seconds INTEGER NOT NULL DEFAULT 300
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_access_vault_secrets_platform_label
  ON role_room_access_vault_secrets (project_id, platform, account_label);
CREATE INDEX IF NOT EXISTS idx_rr_access_vault_secrets_project
  ON role_room_access_vault_secrets (project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS role_room_access_vault_reveal_requests (
  id UUID PRIMARY KEY,
  secret_id UUID NOT NULL REFERENCES role_room_access_vault_secrets(id) ON DELETE CASCADE,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  platform VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  request_reason TEXT,
  approval_notes TEXT,
  requested_by_user_id VARCHAR(255),
  requested_by_role VARCHAR(80),
  approved_by_user_id VARCHAR(255),
  approved_by_role VARCHAR(80),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  revealed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rr_access_vault_requests_project
  ON role_room_access_vault_reveal_requests (project_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_rr_access_vault_requests_secret
  ON role_room_access_vault_reveal_requests (secret_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS role_room_access_vault_audit_events (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  secret_id UUID REFERENCES role_room_access_vault_secrets(id) ON DELETE SET NULL,
  reveal_request_id UUID REFERENCES role_room_access_vault_reveal_requests(id) ON DELETE SET NULL,
  platform VARCHAR(32),
  action VARCHAR(64) NOT NULL,
  actor_user_id VARCHAR(255),
  actor_role VARCHAR(80),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rr_access_vault_audit_project
  ON role_room_access_vault_audit_events (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS role_room_testimonials (
  id UUID PRIMARY KEY,
  role_id VARCHAR(100) NOT NULL,
  quote_text TEXT NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  author_title VARCHAR(255),
  author_user_id VARCHAR(255),
  author_email VARCHAR(255),
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by_user_id VARCHAR(255),
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rr_testimonials_status
  ON role_room_testimonials (status);
CREATE INDEX IF NOT EXISTS idx_rr_testimonials_role
  ON role_room_testimonials (role_id);
CREATE INDEX IF NOT EXISTS idx_rr_testimonials_sort
  ON role_room_testimonials (is_featured DESC, sort_order ASC, published_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS role_room_talent_invites (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  candidate_id VARCHAR(255) NOT NULL REFERENCES casting_candidates(id) ON DELETE CASCADE,
  email VARCHAR(255),
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(40) NOT NULL DEFAULT 'sent',
  created_by_user_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_rr_talent_invites_project
  ON role_room_talent_invites (project_id);
CREATE INDEX IF NOT EXISTS idx_rr_talent_invites_candidate
  ON role_room_talent_invites (candidate_id);
CREATE INDEX IF NOT EXISTS idx_rr_talent_invites_email
  ON role_room_talent_invites (email);
CREATE INDEX IF NOT EXISTS idx_rr_talent_invites_status
  ON role_room_talent_invites (status);

CREATE TABLE IF NOT EXISTS role_room_talent_activity (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  candidate_id VARCHAR(255) NOT NULL REFERENCES casting_candidates(id) ON DELETE CASCADE,
  entry_type VARCHAR(80) NOT NULL DEFAULT 'update',
  title TEXT NOT NULL,
  body TEXT,
  visibility VARCHAR(40) NOT NULL DEFAULT 'shared',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id VARCHAR(255),
  created_by_role VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rr_talent_activity_candidate
  ON role_room_talent_activity (candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rr_talent_activity_project
  ON role_room_talent_activity (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS role_room_talent_uploads (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  candidate_id VARCHAR(255) NOT NULL REFERENCES casting_candidates(id) ON DELETE CASCADE,
  media_kind VARCHAR(40) NOT NULL DEFAULT 'video',
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type VARCHAR(255),
  size_bytes BIGINT,
  access_token_hash VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rr_talent_uploads_candidate
  ON role_room_talent_uploads (candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rr_talent_uploads_project
  ON role_room_talent_uploads (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS role_room_client_invites (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(40) NOT NULL DEFAULT 'sent',
  created_by_user_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_rr_client_invites_project
  ON role_room_client_invites (project_id);
CREATE INDEX IF NOT EXISTS idx_rr_client_invites_email
  ON role_room_client_invites (email);
CREATE INDEX IF NOT EXISTS idx_rr_client_invites_status
  ON role_room_client_invites (status);

CREATE TABLE IF NOT EXISTS role_room_oauth_pending_state (
  state_id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oauth_state_expires
  ON role_room_oauth_pending_state (expires_at);

CREATE TABLE IF NOT EXISTS role_room_oauth_pending_transfer (
  transfer_id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oauth_transfer_expires
  ON role_room_oauth_pending_transfer (expires_at);

COMMIT;
