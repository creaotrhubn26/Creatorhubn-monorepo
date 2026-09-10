-- 0568_role_room_storage_ownership_billing.sql
-- Tenant-owned storage accounts, usage ledger and affiliate grants.
-- This migration creates the contract only. It does not charge Stripe and it
-- does not infer an organization owner for legacy user-owned files.
-- Canonical replay of the additive SQL applied out of band as
-- 0506_role_room_storage_ownership_billing.sql. The original immutable ledger
-- name is retained in legacy-applied-migrations.json because 0506 is already
-- the canonical Leadgrid identity-normalization migration.

BEGIN;

ALTER TABLE plan_limits
  ADD COLUMN IF NOT EXISTS included_storage_bytes BIGINT NOT NULL DEFAULT 0;

ALTER TABLE agency_orgs
  ADD COLUMN IF NOT EXISTS organization_id UUID UNIQUE
    REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_stripe_customer_unique
  ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
UPDATE plan_limits SET included_storage_bytes = CASE plan_key
  WHEN 'solo_free' THEN 5368709120       -- 5 GiB
  WHEN 'solo_pro' THEN 26843545600       -- 25 GiB
  WHEN 'agency' THEN 268435456000        -- 250 GiB pooled
  WHEN 'enterprise' THEN 1099511627776   -- 1 TiB pooled
  ELSE included_storage_bytes
END;

CREATE TABLE IF NOT EXISTS role_room_storage_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  agency_org_id UUID REFERENCES agency_orgs(id) ON DELETE CASCADE,
  platform_key VARCHAR(80),
  billing_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  plan_key VARCHAR(40) REFERENCES plan_limits(plan_key) ON DELETE SET NULL,
  base_quota_bytes BIGINT NOT NULL DEFAULT 0 CHECK (base_quota_bytes >= 0),
  hard_limit_bytes BIGINT CHECK (hard_limit_bytes IS NULL OR hard_limit_bytes >= 0),
  used_bytes BIGINT NOT NULL DEFAULT 0 CHECK (used_bytes >= 0),
  reserved_bytes BIGINT NOT NULL DEFAULT 0 CHECK (reserved_bytes >= 0),
  file_count INTEGER NOT NULL DEFAULT 0 CHECK (file_count >= 0),
  overage_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_subscription_id VARCHAR(255),
  stripe_subscription_status VARCHAR(40),
  stripe_base_price_id VARCHAR(255),
  stripe_storage_subscription_item_id VARCHAR(255),
  stripe_current_period_end TIMESTAMPTZ,
  stripe_cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_checkout_session_id VARCHAR(255),
  stripe_checkout_expires_at TIMESTAMPTZ,
  checkout_lock_token UUID,
  checkout_lock_until TIMESTAMPTZ,
  billing_grace_until TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'read_only', 'suspended', 'closed')),
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (num_nonnulls(user_id, organization_id, agency_org_id, platform_key) = 1),
  CHECK (organization_id IS NULL OR billing_organization_id = organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS role_room_storage_account_user_unique
  ON role_room_storage_accounts(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS role_room_storage_account_org_unique
  ON role_room_storage_accounts(organization_id) WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS role_room_storage_account_agency_unique
  ON role_room_storage_accounts(agency_org_id) WHERE agency_org_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS role_room_storage_account_platform_unique
  ON role_room_storage_accounts(platform_key) WHERE platform_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS role_room_storage_account_billing_org_idx
  ON role_room_storage_accounts(billing_organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS role_room_storage_account_subscription_unique
  ON role_room_storage_accounts(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS role_room_storage_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_account_id UUID NOT NULL
    REFERENCES role_room_storage_accounts(id) ON DELETE CASCADE,
  source_type VARCHAR(30) NOT NULL
    CHECK (source_type IN ('plan', 'affiliate', 'promotion', 'admin', 'migration')),
  source_ref VARCHAR(255) NOT NULL,
  bonus_bytes BIGINT NOT NULL CHECK (bonus_bytes > 0),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'revoked', 'expired')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (storage_account_id, source_type, source_ref),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS role_room_storage_grants_active_idx
  ON role_room_storage_grants(storage_account_id, ends_at)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS role_room_storage_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_account_id UUID NOT NULL
    REFERENCES role_room_storage_accounts(id) ON DELETE RESTRICT,
  object_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  content_type TEXT,
  checksum_sha256 CHAR(64),
  project_id VARCHAR(255) REFERENCES casting_projects(id) ON DELETE SET NULL,
  source_module VARCHAR(80),
  created_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'quarantined', 'deleted')),
  reservation_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS role_room_storage_objects_account_idx
  ON role_room_storage_objects(storage_account_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS role_room_storage_objects_project_idx
  ON role_room_storage_objects(project_id, created_at DESC)
  WHERE project_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS role_room_storage_objects_pending_idx
  ON role_room_storage_objects(reservation_expires_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS role_room_storage_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_account_id UUID NOT NULL
    REFERENCES role_room_storage_accounts(id) ON DELETE CASCADE,
  storage_object_id UUID REFERENCES role_room_storage_objects(id) ON DELETE SET NULL,
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  delta_bytes BIGINT NOT NULL,
  delta_files INTEGER NOT NULL DEFAULT 0,
  event_type VARCHAR(30) NOT NULL
    CHECK (event_type IN ('upload', 'delete', 'reconcile', 'migration', 'adjustment')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS role_room_storage_usage_events_account_idx
  ON role_room_storage_usage_events(storage_account_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS role_room_storage_daily_metrics (
  storage_account_id UUID NOT NULL
    REFERENCES role_room_storage_accounts(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  average_stored_bytes BIGINT NOT NULL DEFAULT 0 CHECK (average_stored_bytes >= 0),
  peak_stored_bytes BIGINT NOT NULL DEFAULT 0 CHECK (peak_stored_bytes >= 0),
  ingress_bytes BIGINT NOT NULL DEFAULT 0 CHECK (ingress_bytes >= 0),
  egress_bytes BIGINT NOT NULL DEFAULT 0 CHECK (egress_bytes >= 0),
  get_requests BIGINT NOT NULL DEFAULT 0 CHECK (get_requests >= 0),
  write_requests BIGINT NOT NULL DEFAULT 0 CHECK (write_requests >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (storage_account_id, usage_date)
);

CREATE INDEX IF NOT EXISTS role_room_storage_daily_metrics_date_idx
  ON role_room_storage_daily_metrics(usage_date);

CREATE OR REPLACE FUNCTION role_room_apply_storage_usage(
  p_storage_account_id UUID,
  p_storage_object_id UUID,
  p_idempotency_key VARCHAR,
  p_delta_bytes BIGINT,
  p_delta_files INTEGER,
  p_event_type VARCHAR,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO role_room_storage_usage_events (
    storage_account_id, storage_object_id, idempotency_key,
    delta_bytes, delta_files, event_type, metadata
  ) VALUES (
    p_storage_account_id, p_storage_object_id, p_idempotency_key,
    p_delta_bytes, p_delta_files, p_event_type, COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE role_room_storage_accounts
     SET used_bytes = GREATEST(0, used_bytes + p_delta_bytes),
         file_count = GREATEST(0, file_count + p_delta_files),
         version = version + 1,
         updated_at = NOW()
   WHERE id = p_storage_account_id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION role_room_reserve_storage(
  p_storage_account_id UUID,
  p_bytes BIGINT
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
  v_reserved BOOLEAN;
BEGIN
  IF p_bytes <= 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE role_room_storage_accounts account
     SET reserved_bytes = account.reserved_bytes + p_bytes,
         version = account.version + 1,
         updated_at = NOW()
   WHERE account.id = p_storage_account_id
     AND account.status = 'active'
     AND NOT (
       account.stripe_subscription_status IN ('past_due', 'unpaid', 'paused')
       AND account.billing_grace_until IS NOT NULL
       AND account.billing_grace_until <= NOW()
     )
     AND account.used_bytes + account.reserved_bytes + p_bytes <= LEAST(
       COALESCE(account.hard_limit_bytes, 9223372036854775807),
       account.base_quota_bytes + COALESCE((
         SELECT SUM(grant_row.bonus_bytes)
           FROM role_room_storage_grants grant_row
          WHERE grant_row.storage_account_id = account.id
            AND grant_row.status = 'active'
            AND grant_row.starts_at <= NOW()
            AND (grant_row.ends_at IS NULL OR grant_row.ends_at > NOW())
       ), 0)
     )
  RETURNING TRUE INTO v_reserved;

  RETURN COALESCE(v_reserved, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION role_room_release_storage_reservation(
  p_storage_account_id UUID,
  p_bytes BIGINT
) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE role_room_storage_accounts
     SET reserved_bytes = GREATEST(0, reserved_bytes - GREATEST(0, p_bytes)),
         version = version + 1,
         updated_at = NOW()
   WHERE id = p_storage_account_id;
END;
$$;

CREATE TABLE IF NOT EXISTS role_room_affiliate_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE
    REFERENCES organizations(id) ON DELETE CASCADE,
  referral_code VARCHAR(80) NOT NULL UNIQUE,
  commission_basis_points INTEGER NOT NULL DEFAULT 1500
    CHECK (commission_basis_points BETWEEN 0 AND 10000),
  commission_months INTEGER NOT NULL DEFAULT 12 CHECK (commission_months >= 0),
  referred_org_bonus_bytes BIGINT NOT NULL DEFAULT 10737418240
    CHECK (referred_org_bonus_bytes >= 0),
  referred_org_bonus_months INTEGER NOT NULL DEFAULT 3
    CHECK (referred_org_bonus_months >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'paused', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_room_affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_partner_id UUID NOT NULL
    REFERENCES role_room_affiliate_partners(id) ON DELETE RESTRICT,
  referred_organization_id UUID NOT NULL UNIQUE
    REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_checkout_session_id VARCHAR(255) UNIQUE,
  storage_grant_id UUID UNIQUE REFERENCES role_room_storage_grants(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'attributed'
    CHECK (status IN ('attributed', 'qualified', 'paying', 'cancelled', 'expired')),
  attributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  qualified_at TIMESTAMPTZ,
  commission_ends_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS role_room_affiliate_referrals_partner_idx
  ON role_room_affiliate_referrals(affiliate_partner_id, status);

CREATE TABLE IF NOT EXISTS role_room_affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_referral_id UUID NOT NULL
    REFERENCES role_room_affiliate_referrals(id) ON DELETE RESTRICT,
  stripe_invoice_id VARCHAR(255) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'nok',
  eligible_revenue_minor BIGINT NOT NULL CHECK (eligible_revenue_minor >= 0),
  commission_basis_points INTEGER NOT NULL
    CHECK (commission_basis_points BETWEEN 0 AND 10000),
  commission_amount_minor BIGINT NOT NULL CHECK (commission_amount_minor >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'accrued'
    CHECK (status IN ('accrued', 'approved', 'paid', 'reversed')),
  paid_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (affiliate_referral_id, stripe_invoice_id)
);

CREATE INDEX IF NOT EXISTS role_room_affiliate_commissions_status_idx
  ON role_room_affiliate_commissions(status, created_at);

CREATE TABLE IF NOT EXISTS role_room_stripe_webhook_events (
  stripe_event_id VARCHAR(255) PRIMARY KEY,
  event_type VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'processed', 'failed', 'ignored')),
  object_id VARCHAR(255),
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS role_room_stripe_webhook_events_status_idx
  ON role_room_stripe_webhook_events(status, received_at);

CREATE OR REPLACE VIEW role_room_storage_effective_quota AS
SELECT
  account.id AS storage_account_id,
  account.base_quota_bytes,
  COALESCE(SUM(grant_row.bonus_bytes) FILTER (
    WHERE grant_row.status = 'active'
      AND grant_row.starts_at <= NOW()
      AND (grant_row.ends_at IS NULL OR grant_row.ends_at > NOW())
  ), 0)::BIGINT AS active_bonus_bytes,
  (account.base_quota_bytes + COALESCE(SUM(grant_row.bonus_bytes) FILTER (
    WHERE grant_row.status = 'active'
      AND grant_row.starts_at <= NOW()
      AND (grant_row.ends_at IS NULL OR grant_row.ends_at > NOW())
  ), 0))::BIGINT AS effective_quota_bytes,
  account.used_bytes,
  account.reserved_bytes,
  account.file_count,
  account.hard_limit_bytes,
  account.overage_enabled,
  account.status
FROM role_room_storage_accounts account
LEFT JOIN role_room_storage_grants grant_row
  ON grant_row.storage_account_id = account.id
GROUP BY account.id;

COMMIT;
