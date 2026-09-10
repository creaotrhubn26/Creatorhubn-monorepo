-- 0569: Organization-owned Leadgrid billing, durable Stripe events, fixed
-- storage add-ons and Super Admin-controlled invitation setup.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '180s';

ALTER TABLE plan_limits
  ADD COLUMN IF NOT EXISTS included_storage_bytes BIGINT NOT NULL
    DEFAULT 2147483648 CHECK (included_storage_bytes >= 0);

UPDATE plan_limits
   SET included_storage_bytes = CASE plan_key
     WHEN 'solo_free' THEN 2147483648       -- 2 GiB
     WHEN 'solo_pro' THEN 53687091200       -- 50 GiB
     WHEN 'agency' THEN 268435456000        -- 250 GiB
     WHEN 'enterprise' THEN 1099511627776   -- 1 TiB
     ELSE included_storage_bytes
   END;

CREATE TABLE IF NOT EXISTS leadgrid_org_billing (
  organization_id UUID PRIMARY KEY
    REFERENCES organizations(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL DEFAULT 'stripe' CHECK (provider = 'stripe'),
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (subscription_status IN (
      'inactive', 'incomplete', 'incomplete_expired', 'trialing', 'active',
      'past_due', 'canceled', 'unpaid', 'paused', 'unknown'
    )),
  plan_key TEXT,
  billing_interval TEXT CHECK (billing_interval IS NULL OR billing_interval IN ('month', 'year')),
  current_period_end TIMESTAMPTZ,
  past_due_since TIMESTAMPTZ,
  read_only_at TIMESTAMPTZ,
  grace_days SMALLINT NOT NULL DEFAULT 7 CHECK (grace_days BETWEEN 0 AND 90),
  storage_addon_quantity INTEGER NOT NULL DEFAULT 0
    CHECK (storage_addon_quantity BETWEEN 0 AND 1000),
  storage_addon_item_id TEXT,
  billing_revision INTEGER NOT NULL DEFAULT 1 CHECK (billing_revision > 0),
  pending_checkout_session_id TEXT,
  pending_checkout_url TEXT,
  pending_checkout_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_leadgrid_org_billing_customer
  ON leadgrid_org_billing (provider, provider_customer_id)
  WHERE provider_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leadgrid_org_billing_subscription
  ON leadgrid_org_billing (provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leadgrid_org_billing_storage_item
  ON leadgrid_org_billing (provider, storage_addon_item_id)
  WHERE storage_addon_item_id IS NOT NULL;

INSERT INTO leadgrid_org_billing (
  organization_id, provider_customer_id, provider_subscription_id,
  subscription_status, plan_key, current_period_end
)
SELECT id, stripe_customer_id, stripe_subscription_id,
       CASE WHEN stripe_subscription_id IS NULL THEN 'inactive' ELSE 'unknown' END,
       plan, plan_renews_at
  FROM organizations
 WHERE stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL
ON CONFLICT (organization_id) DO UPDATE SET
  provider_customer_id = COALESCE(
    leadgrid_org_billing.provider_customer_id,
    EXCLUDED.provider_customer_id
  ),
  provider_subscription_id = COALESCE(
    leadgrid_org_billing.provider_subscription_id,
    EXCLUDED.provider_subscription_id
  ),
  plan_key = COALESCE(leadgrid_org_billing.plan_key, EXCLUDED.plan_key),
  current_period_end = COALESCE(
    leadgrid_org_billing.current_period_end,
    EXCLUDED.current_period_end
  ),
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS leadgrid_stripe_events (
  stripe_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  stripe_object_id TEXT,
  stripe_created_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'processed', 'ignored', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  last_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_stripe_events_pending
  ON leadgrid_stripe_events (next_attempt_at, stripe_created_at, stripe_event_id)
  WHERE status IN ('pending', 'processing');

CREATE TABLE IF NOT EXISTS leadgrid_billing_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_billing_outbox_pending
  ON leadgrid_billing_outbox (next_attempt_at, created_at)
  WHERE status IN ('pending', 'processing');

ALTER TABLE leadgrid_org_storage_usage
  ADD COLUMN IF NOT EXISTS reserved_bytes BIGINT NOT NULL DEFAULT 0
    CHECK (reserved_bytes >= 0);

CREATE TABLE IF NOT EXISTS leadgrid_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  metric TEXT NOT NULL CHECK (metric IN ('storage_bytes_delta', 'egress_bytes')),
  quantity BIGINT NOT NULL,
  billable BOOLEAN NOT NULL DEFAULT FALSE,
  source_provider TEXT NOT NULL,
  source_object_id UUID,
  idempotency_key TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, idempotency_key),
  CONSTRAINT leadgrid_usage_event_billing_check CHECK (
    (metric = 'storage_bytes_delta' AND billable = FALSE)
    OR (metric = 'egress_bytes' AND quantity >= 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_usage_events_org_time
  ON leadgrid_usage_events (organization_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_leadgrid_usage_events_billable
  ON leadgrid_usage_events (created_at, id)
  WHERE metric = 'egress_bytes' AND billable = TRUE;

CREATE TABLE IF NOT EXISTS leadgrid_usage_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_event_id UUID NOT NULL REFERENCES leadgrid_usage_events(id) ON DELETE RESTRICT,
  billing_provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'exported', 'failed', 'skipped')),
  provider_event_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exported_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usage_event_id, billing_provider)
);

ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS leadgrid_is_prototype_tester BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS leadgrid_storage_policy TEXT NOT NULL DEFAULT 'organization';

ALTER TABLE organization_members
  DROP CONSTRAINT IF EXISTS organization_members_leadgrid_storage_policy_check;
ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_leadgrid_storage_policy_check
  CHECK (leadgrid_storage_policy IN ('organization', 'disabled'));

ALTER TABLE leadgrid_project_invitations
  ADD COLUMN IF NOT EXISTS is_prototype_tester BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS storage_policy TEXT NOT NULL DEFAULT 'organization',
  ADD COLUMN IF NOT EXISTS setup_managed_by_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE leadgrid_project_invitations
  DROP CONSTRAINT IF EXISTS leadgrid_project_invitations_storage_policy_check;
ALTER TABLE leadgrid_project_invitations
  ADD CONSTRAINT leadgrid_project_invitations_storage_policy_check
  CHECK (storage_policy IN ('organization', 'disabled'));

ALTER TABLE leadgrid_project_members
  ADD COLUMN IF NOT EXISTS is_prototype_tester BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS storage_policy TEXT NOT NULL DEFAULT 'organization';

ALTER TABLE leadgrid_project_members
  DROP CONSTRAINT IF EXISTS leadgrid_project_members_storage_policy_check;
ALTER TABLE leadgrid_project_members
  ADD CONSTRAINT leadgrid_project_members_storage_policy_check
  CHECK (storage_policy IN ('organization', 'disabled'));

CREATE OR REPLACE FUNCTION leadgrid_storage_capacity_bytes(target_org UUID)
RETURNS BIGINT
LANGUAGE SQL
STABLE
AS $function$
  SELECT COALESCE(plan.included_storage_bytes, 2147483648)
       + COALESCE(billing.storage_addon_quantity, 0)::BIGINT * 107374182400::BIGINT
    FROM organizations organization
    LEFT JOIN plan_limits plan ON plan.plan_key = organization.plan
    LEFT JOIN leadgrid_org_billing billing
      ON billing.organization_id = organization.id
   WHERE organization.id = target_org
$function$;

CREATE OR REPLACE FUNCTION leadgrid_enforce_storage_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  old_bytes BIGINT := 0;
  new_bytes BIGINT := 0;
  delta_bytes BIGINT := 0;
  current_used BIGINT := 0;
  current_reserved BIGINT := 0;
  capacity_bytes BIGINT := 0;
  member_policy TEXT;
BEGIN
  IF TG_OP <> 'INSERT'
     AND OLD.storage_provider = 'aws_s3'
     AND OLD.deleted_at IS NULL THEN
    old_bytes := OLD.size_bytes;
  END IF;

  IF NEW.storage_provider = 'aws_s3' AND NEW.deleted_at IS NULL THEN
    new_bytes := NEW.size_bytes;
  END IF;

  delta_bytes := new_bytes - old_bytes;
  IF delta_bytes <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.uploaded_by IS NOT NULL THEN
    SELECT leadgrid_storage_policy
      INTO member_policy
      FROM organization_members
     WHERE organization_id = NEW.organization_id
       AND user_id = NEW.uploaded_by
     LIMIT 1;
    IF member_policy = 'disabled' THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'leadgrid_storage_access_disabled';
    END IF;
  END IF;

  INSERT INTO leadgrid_org_storage_usage (
    organization_id, used_bytes, reserved_bytes, file_count, updated_at
  ) VALUES (NEW.organization_id, 0, 0, 0, NOW())
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT used_bytes, reserved_bytes
    INTO current_used, current_reserved
    FROM leadgrid_org_storage_usage
   WHERE organization_id = NEW.organization_id
   FOR UPDATE;

  capacity_bytes := leadgrid_storage_capacity_bytes(NEW.organization_id);
  IF capacity_bytes IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'leadgrid_storage_plan_missing';
  END IF;
  IF current_used + current_reserved + delta_bytes > capacity_bytes THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'leadgrid_storage_quota_exceeded',
      DETAIL = format(
        'used=%s reserved=%s requested=%s capacity=%s',
        current_used, current_reserved, delta_bytes, capacity_bytes
      );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_leadgrid_storage_capacity
  ON leadgrid_storage_objects;
CREATE TRIGGER trg_leadgrid_storage_capacity
  BEFORE INSERT OR UPDATE OF size_bytes, deleted_at
  ON leadgrid_storage_objects
  FOR EACH ROW EXECUTE FUNCTION leadgrid_enforce_storage_capacity();

CREATE OR REPLACE FUNCTION leadgrid_apply_storage_usage_delta()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  old_bytes BIGINT := 0;
  old_files BIGINT := 0;
  new_bytes BIGINT := 0;
  new_files BIGINT := 0;
  target_org UUID;
  target_object UUID;
BEGIN
  IF TG_OP <> 'INSERT'
     AND OLD.storage_provider = 'aws_s3'
     AND OLD.deleted_at IS NULL THEN
    old_bytes := OLD.size_bytes;
    old_files := 1;
    target_org := OLD.organization_id;
    target_object := OLD.id;
  END IF;

  IF TG_OP <> 'DELETE'
     AND NEW.storage_provider = 'aws_s3'
     AND NEW.deleted_at IS NULL THEN
    new_bytes := NEW.size_bytes;
    new_files := 1;
    target_org := NEW.organization_id;
    target_object := NEW.id;
  END IF;

  IF target_org IS NOT NULL THEN
    INSERT INTO leadgrid_org_storage_usage (
      organization_id, used_bytes, reserved_bytes, file_count, updated_at
    )
    VALUES (
      target_org,
      GREATEST(0, new_bytes - old_bytes),
      0,
      GREATEST(0, new_files - old_files),
      NOW()
    )
    ON CONFLICT (organization_id) DO UPDATE SET
      used_bytes = GREATEST(
        0,
        leadgrid_org_storage_usage.used_bytes + new_bytes - old_bytes
      ),
      file_count = GREATEST(
        0,
        leadgrid_org_storage_usage.file_count + new_files - old_files
      ),
      updated_at = NOW();

    IF new_bytes <> old_bytes THEN
      INSERT INTO leadgrid_usage_events (
        organization_id, metric, quantity, billable, source_provider,
        source_object_id, idempotency_key, metadata
      ) VALUES (
        target_org,
        'storage_bytes_delta',
        new_bytes - old_bytes,
        FALSE,
        'aws_s3',
        target_object,
        'storage:' || gen_random_uuid()::text,
        jsonb_build_object('operation', LOWER(TG_OP))
      );
    END IF;
  END IF;

  RETURN NULL;
END;
$function$;

COMMENT ON TABLE leadgrid_org_billing IS
  'Exactly one provider billing identity per Leadgrid organization; members never own subscriptions.';
COMMENT ON TABLE leadgrid_stripe_events IS
  'Durable, idempotent Stripe event journal processed asynchronously.';
COMMENT ON TABLE leadgrid_usage_events IS
  'Provider-neutral append-only usage ledger. Storage deltas are non-billable; only actual egress may be billable.';
COMMENT ON COLUMN organization_members.leadgrid_storage_policy IS
  'Super Admin-controlled Leadgrid upload policy. organization uses shared organization quota; disabled denies uploads.';

COMMIT;
