-- CreatorHub Enterprise operations: authoritative entitlements, native
-- timesheets, public booking and a canonical vendor catalogue/API.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- An early runtime prototype used this relation name with a different shape.
-- Preserve that data and its dependencies under an explicit legacy name before
-- creating the server-authoritative organization-scoped entitlement table.
DO $reconcile_enterprise_entitlements$
BEGIN
  IF to_regclass('public.creatorhub_enterprise_entitlements') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'creatorhub_enterprise_entitlements'
          AND column_name = 'organization_id'
     ) THEN
    IF to_regclass('public.creatorhub_enterprise_entitlements_legacy_0681') IS NOT NULL THEN
      RAISE EXCEPTION
        'Cannot reconcile creatorhub_enterprise_entitlements: legacy target already exists';
    END IF;

    ALTER TABLE public.creatorhub_enterprise_entitlements
      RENAME TO creatorhub_enterprise_entitlements_legacy_0681;
  END IF;
END
$reconcile_enterprise_entitlements$;

CREATE TABLE IF NOT EXISTS creatorhub_enterprise_entitlements (
  organization_id VARCHAR(255) PRIMARY KEY,
  plan_id VARCHAR(100) NOT NULL DEFAULT 'enterprise',
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'grace', 'suspended', 'cancelled')),
  valid_until TIMESTAMPTZ,
  source VARCHAR(40) NOT NULL DEFAULT 'billing'
    CHECK (source IN ('billing', 'admin', 'migration')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (BTRIM(organization_id) <> '')
);

-- Existing active Enterprise organizations retain access until billing takes
-- ownership of the entitlement row. New organizations must be provisioned by
-- billing/admin and therefore fail closed.
-- Production has historically had more than one shape of the Enterprise team
-- table. Do not let a legacy table block the authoritative schema migration;
-- only backfill memberships when all columns used by the backfill are present.
-- The application still fails closed for organizations without an entitlement.
DO $enterprise_entitlement_backfill$
BEGIN
  IF to_regclass('public.enterprise_team_members') IS NOT NULL
     AND EXISTS (
       SELECT 1
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'enterprise_team_members'
          AND column_name = 'organization_id'
     )
     AND EXISTS (
       SELECT 1
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'enterprise_team_members'
          AND column_name = 'status'
     )
     AND EXISTS (
       SELECT 1
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'enterprise_team_members'
          AND column_name = 'org_kind'
     ) THEN
    EXECUTE $backfill$
      INSERT INTO creatorhub_enterprise_entitlements
        (organization_id, plan_id, status, source)
      SELECT DISTINCT organization_id::text, 'enterprise', 'active', 'migration'
        FROM enterprise_team_members
       WHERE status = 'active'
         AND org_kind = 'enterprise'
         AND organization_id IS NOT NULL
         AND BTRIM(organization_id::text) <> ''
      ON CONFLICT (organization_id) DO NOTHING
    $backfill$;
  END IF;
END
$enterprise_entitlement_backfill$;

-- The feature-policy table also predates the canonical Enterprise model in
-- some environments. Keep any incompatible relation intact for audit/recovery
-- and create the exact contract consumed by the access service.
DO $reconcile_enterprise_feature_permissions$
BEGIN
  IF to_regclass('public.enterprise_feature_permissions') IS NOT NULL
     AND (
       SELECT COUNT(*)
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'enterprise_feature_permissions'
          AND column_name IN (
            'organization_id',
            'feature_id',
            'permission_level',
            'allowed_roles',
            'created_by'
          )
     ) < 5 THEN
    IF to_regclass('public.enterprise_feature_permissions_legacy_0681') IS NOT NULL THEN
      RAISE EXCEPTION
        'Cannot reconcile enterprise_feature_permissions: legacy target already exists';
    END IF;

    ALTER TABLE public.enterprise_feature_permissions
      RENAME TO enterprise_feature_permissions_legacy_0681;
  END IF;
END
$reconcile_enterprise_feature_permissions$;

CREATE TABLE IF NOT EXISTS enterprise_feature_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL,
  feature_id VARCHAR(255) NOT NULL,
  permission_level VARCHAR(50) NOT NULL DEFAULT 'all',
  allowed_roles TEXT[] NOT NULL DEFAULT ARRAY['admin', 'member', 'viewer']::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255),
  CONSTRAINT creatorhub_enterprise_feature_permissions_org_feature_key
    UNIQUE (organization_id, feature_id)
);
CREATE INDEX IF NOT EXISTS idx_creatorhub_enterprise_feature_permissions_feature_0681
  ON enterprise_feature_permissions(feature_id);

INSERT INTO enterprise_feature_permissions
  (organization_id, feature_id, permission_level, allowed_roles, created_by)
SELECT entitlement.organization_id, feature.feature_id,
       feature.permission_level, feature.allowed_roles, 'migration-0681'
  FROM creatorhub_enterprise_entitlements entitlement
 CROSS JOIN (VALUES
   ('native-timesheets-approvals', 'custom', ARRAY['admin','member']::TEXT[]),
   ('public-booking-page', 'admin_only', ARRAY['admin']::TEXT[]),
   ('vendor-product-api', 'custom', ARRAY['admin','member']::TEXT[])
 ) AS feature(feature_id, permission_level, allowed_roles)
ON CONFLICT (organization_id, feature_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS creatorhub_timesheet_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL,
  project_id VARCHAR NOT NULL,
  participant_id UUID NOT NULL,
  employee_user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','approved','rejected','locked')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  employee_note TEXT,
  reviewer_note TEXT,
  submitted_at TIMESTAMPTZ,
  submitted_by VARCHAR(255) REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by VARCHAR(255) REFERENCES users(id) ON DELETE RESTRICT,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT creatorhub_timesheet_period_scope_fk
    FOREIGN KEY (organization_id, project_id)
    REFERENCES workspace_project_enterprise_scopes (organization_id, project_id)
    ON DELETE RESTRICT,
  CONSTRAINT creatorhub_timesheet_period_participant_fk
    FOREIGN KEY (organization_id, project_id, participant_id)
    REFERENCES workspace_project_participants (organization_id, project_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT creatorhub_timesheet_period_dates CHECK (period_end >= period_start),
  CONSTRAINT creatorhub_timesheet_period_span CHECK (period_end - period_start <= 31),
  CONSTRAINT creatorhub_timesheet_period_state CHECK (
    (status = 'draft' AND submitted_at IS NULL AND reviewed_at IS NULL AND locked_at IS NULL)
    OR (status = 'submitted' AND submitted_at IS NOT NULL AND reviewed_at IS NULL AND locked_at IS NULL)
    OR (status = 'rejected' AND submitted_at IS NOT NULL AND reviewed_at IS NOT NULL AND locked_at IS NULL)
    OR (status = 'approved' AND submitted_at IS NOT NULL AND reviewed_at IS NOT NULL AND locked_at IS NULL)
    OR (status = 'locked' AND submitted_at IS NOT NULL AND reviewed_at IS NOT NULL AND locked_at IS NOT NULL)
  ),
  UNIQUE (organization_id, project_id, employee_user_id, period_start, period_end),
  UNIQUE (organization_id, project_id, id)
);

CREATE INDEX IF NOT EXISTS idx_creatorhub_timesheet_periods_employee
  ON creatorhub_timesheet_periods (organization_id, employee_user_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_creatorhub_timesheet_periods_review
  ON creatorhub_timesheet_periods (organization_id, project_id, status, submitted_at);

CREATE TABLE IF NOT EXISTS creatorhub_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL,
  organization_id VARCHAR(255) NOT NULL,
  project_id VARCHAR NOT NULL,
  employee_user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  task_id VARCHAR,
  activity VARCHAR(100) NOT NULL,
  description TEXT,
  work_date DATE NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
  break_minutes INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  billable BOOLEAN NOT NULL DEFAULT TRUE,
  source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','timer','import')),
  idempotency_key UUID NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT creatorhub_time_entries_period_fk
    FOREIGN KEY (organization_id, project_id, period_id)
    REFERENCES creatorhub_timesheet_periods (organization_id, project_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT creatorhub_time_entries_interval CHECK (
    (started_at IS NULL AND ended_at IS NULL)
    OR (started_at IS NOT NULL AND ended_at IS NOT NULL AND ended_at > started_at)
  ),
  CONSTRAINT creatorhub_time_entries_break CHECK (break_minutes < duration_minutes),
  UNIQUE (period_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_creatorhub_time_entries_period
  ON creatorhub_time_entries (period_id, work_date, created_at);
CREATE INDEX IF NOT EXISTS idx_creatorhub_time_entries_project
  ON creatorhub_time_entries (organization_id, project_id, employee_user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_creatorhub_time_entries_overlap
  ON creatorhub_time_entries (organization_id, employee_user_id, started_at, ended_at)
  WHERE started_at IS NOT NULL AND ended_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS creatorhub_timesheet_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES creatorhub_timesheet_periods(id) ON DELETE RESTRICT,
  organization_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(30) NOT NULL
    CHECK (event_type IN ('created','entry_created','entry_updated','entry_deleted','submitted','approved','rejected','locked')),
  actor_user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_creatorhub_timesheet_events_period
  ON creatorhub_timesheet_events (period_id, occurred_at);

CREATE TABLE IF NOT EXISTS creatorhub_timesheet_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL UNIQUE REFERENCES creatorhub_timesheet_periods(id) ON DELETE RESTRICT,
  organization_id VARCHAR(255) NOT NULL,
  project_id VARCHAR NOT NULL,
  participant_id UUID NOT NULL,
  compensation_id UUID NOT NULL REFERENCES workspace_participant_compensation_links(id) ON DELETE RESTRICT,
  split_sheet_id UUID NOT NULL REFERENCES split_sheets(id) ON DELETE RESTRICT,
  total_minutes INTEGER NOT NULL CHECK (total_minutes > 0),
  hourly_rate NUMERIC(14,2) NOT NULL CHECK (hourly_rate > 0),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  agreement_status VARCHAR(30) NOT NULL
    CHECK (agreement_status IN ('pending_signature','signed')),
  terms_snapshot JSONB NOT NULL CHECK (jsonb_typeof(terms_snapshot) = 'object'),
  created_by VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_creatorhub_timesheet_settlements_split
  ON creatorhub_timesheet_settlements (split_sheet_id, created_at DESC);

CREATE TABLE IF NOT EXISTS creatorhub_booking_profiles (
  organization_id VARCHAR(255) PRIMARY KEY REFERENCES creatorhub_enterprise_entitlements(organization_id) ON DELETE RESTRICT,
  owner_user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  slug VARCHAR(80) NOT NULL,
  business_name VARCHAR(160) NOT NULL,
  headline VARCHAR(240),
  description TEXT,
  profession VARCHAR(80),
  timezone VARCHAR(80) NOT NULL DEFAULT 'Europe/Oslo',
  currency CHAR(3) NOT NULL DEFAULT 'NOK' CHECK (currency ~ '^[A-Z]{3}$'),
  logo_url TEXT,
  cover_url TEXT,
  location_label VARCHAR(255),
  contact_email VARCHAR(320),
  minimum_notice_hours INTEGER NOT NULL DEFAULT 24 CHECK (minimum_notice_hours BETWEEN 0 AND 8760),
  maximum_advance_days INTEGER NOT NULL DEFAULT 180 CHECK (maximum_advance_days BETWEEN 1 AND 730),
  slot_interval_minutes INTEGER NOT NULL DEFAULT 30 CHECK (slot_interval_minutes IN (15,30,45,60)),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  CHECK (BTRIM(business_name) <> '')
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_creatorhub_booking_profiles_slug
  ON creatorhub_booking_profiles (LOWER(slug));

CREATE TABLE IF NOT EXISTS creatorhub_booking_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL REFERENCES creatorhub_booking_profiles(organization_id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 15 AND 1440),
  price_amount NUMERIC(14,2) NOT NULL CHECK (price_amount >= 0),
  deposit_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0 AND deposit_amount <= price_amount),
  buffer_before_minutes INTEGER NOT NULL DEFAULT 0 CHECK (buffer_before_minutes BETWEEN 0 AND 720),
  buffer_after_minutes INTEGER NOT NULL DEFAULT 0 CHECK (buffer_after_minutes BETWEEN 0 AND 720),
  location_mode VARCHAR(20) NOT NULL DEFAULT 'provider'
    CHECK (location_mode IN ('provider','customer','remote','flexible')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (BTRIM(name) <> ''),
  UNIQUE (organization_id, id)
);
CREATE INDEX IF NOT EXISTS idx_creatorhub_booking_services_public
  ON creatorhub_booking_services (organization_id, is_active, sort_order);

CREATE TABLE IF NOT EXISTS creatorhub_booking_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL REFERENCES creatorhub_booking_profiles(organization_id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (end_time > start_time),
  UNIQUE (organization_id, weekday, start_time, end_time)
);
CREATE INDEX IF NOT EXISTS idx_creatorhub_booking_availability_org
  ON creatorhub_booking_availability (organization_id, weekday, is_active);

CREATE TABLE IF NOT EXISTS creatorhub_booking_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL REFERENCES creatorhub_booking_profiles(organization_id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason VARCHAR(255),
  created_by VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_creatorhub_booking_blocks_range
  ON creatorhub_booking_blocks (organization_id, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS creatorhub_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference VARCHAR(30) NOT NULL UNIQUE,
  organization_id VARCHAR(255) NOT NULL REFERENCES creatorhub_booking_profiles(organization_id) ON DELETE RESTRICT,
  service_id UUID NOT NULL,
  project_id VARCHAR,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(320) NOT NULL,
  customer_phone VARCHAR(50),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','confirmed','cancelled','completed','no_show')),
  price_amount NUMERIC(14,2) NOT NULL CHECK (price_amount >= 0),
  deposit_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','refunded','failed','not_required')),
  customer_note TEXT,
  intake_answers JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(intake_answers) = 'object'),
  privacy_consent_at TIMESTAMPTZ NOT NULL,
  idempotency_key UUID NOT NULL,
  request_fingerprint CHAR(64) NOT NULL,
  source_ip_hash CHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  CONSTRAINT creatorhub_bookings_service_fk
    FOREIGN KEY (organization_id, service_id)
    REFERENCES creatorhub_booking_services (organization_id, id)
    ON DELETE RESTRICT,
  CHECK (ends_at > starts_at),
  UNIQUE (organization_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_creatorhub_bookings_calendar
  ON creatorhub_bookings (organization_id, starts_at, ends_at)
  WHERE status IN ('requested','confirmed');
CREATE INDEX IF NOT EXISTS idx_creatorhub_bookings_customer
  ON creatorhub_bookings (organization_id, LOWER(customer_email), created_at DESC);

CREATE TABLE IF NOT EXISTS creatorhub_vendor_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL REFERENCES creatorhub_enterprise_entitlements(organization_id) ON DELETE RESTRICT,
  owner_user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  slug VARCHAR(120) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  product_type VARCHAR(30) NOT NULL DEFAULT 'physical'
    CHECK (product_type IN ('physical','digital','service')),
  category VARCHAR(100) NOT NULL DEFAULT 'all',
  sku VARCHAR(100),
  version VARCHAR(40) NOT NULL DEFAULT '1.0.0',
  price_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (price_amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'NOK' CHECK (currency ~ '^[A-Z]{3}$'),
  stock_quantity INTEGER CHECK (stock_quantity IS NULL OR stock_quantity >= 0),
  track_inventory BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','inactive','archived')),
  image_urls JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(image_urls) = 'array'),
  tags JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tags) = 'array'),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,119}$'),
  CHECK (BTRIM(name) <> ''),
  CHECK (NOT track_inventory OR stock_quantity IS NOT NULL),
  UNIQUE (organization_id, slug),
  UNIQUE (organization_id, sku),
  UNIQUE (organization_id, id)
);
CREATE INDEX IF NOT EXISTS idx_creatorhub_vendor_products_public
  ON creatorhub_vendor_products (organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_creatorhub_vendor_products_category
  ON creatorhub_vendor_products (organization_id, category, status);

CREATE TABLE IF NOT EXISTS creatorhub_vendor_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL REFERENCES creatorhub_enterprise_entitlements(organization_id) ON DELETE RESTRICT,
  name VARCHAR(120) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  key_hash CHAR(64) NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['products:read']::TEXT[],
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 120 CHECK (rate_limit_per_minute BETWEEN 10 AND 5000),
  created_by VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CHECK (scopes <@ ARRAY['products:read','products:write','inventory:read','inventory:write','webhooks:manage']::TEXT[])
);
CREATE INDEX IF NOT EXISTS idx_creatorhub_vendor_api_keys_org
  ON creatorhub_vendor_api_keys (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS creatorhub_vendor_api_rate_limits (
  key_id UUID NOT NULL REFERENCES creatorhub_vendor_api_keys(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY (key_id, window_start)
);
CREATE INDEX IF NOT EXISTS idx_creatorhub_vendor_api_rate_limits_cleanup
  ON creatorhub_vendor_api_rate_limits (window_start);

CREATE TABLE IF NOT EXISTS creatorhub_vendor_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL REFERENCES creatorhub_enterprise_entitlements(organization_id) ON DELETE RESTRICT,
  url TEXT NOT NULL,
  secret_hash CHAR(64) NOT NULL,
  secret_ciphertext TEXT NOT NULL,
  events TEXT[] NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (events <@ ARRAY['product.created','product.updated','product.published','product.archived','inventory.updated']::TEXT[])
);

CREATE TABLE IF NOT EXISTS creatorhub_vendor_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  aggregate_id UUID NOT NULL,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivering','delivered','failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_creatorhub_vendor_outbox_pending
  ON creatorhub_vendor_outbox (status, available_at) WHERE status IN ('pending','failed');

COMMIT;
