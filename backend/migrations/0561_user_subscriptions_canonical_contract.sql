-- Reconcile the legacy trial subscription shape with the canonical plan-based
-- contract used by billing and prototype-tester account provisioning.
--
-- Historical databases created user_subscriptions with profession, package_id
-- and package_tier as mandatory fields. The active application writes plan_id
-- instead, so those stale constraints prevented every canonical subscription
-- from being created. Keep the legacy columns for rollback/read compatibility,
-- but stop requiring them for new canonical rows.

ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS plan_id VARCHAR,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR,
  ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR,
  ADD COLUMN IF NOT EXISTS amount NUMERIC,
  ADD COLUMN IF NOT EXISTS currency VARCHAR DEFAULT 'NOK',
  ADD COLUMN IF NOT EXISTS payment_method_id VARCHAR,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'user_subscriptions'
       AND column_name = 'package_id'
  ) THEN
    EXECUTE $sql$
      UPDATE user_subscriptions
         SET plan_id = NULLIF(BTRIM(package_id), '')
       WHERE plan_id IS NULL
         AND NULLIF(BTRIM(package_id), '') IS NOT NULL
    $sql$;
  END IF;
END $$;

UPDATE user_subscriptions
   SET started_at = COALESCE(started_at, created_at, NOW())
 WHERE started_at IS NULL;

DO $$
DECLARE
  legacy_column TEXT;
BEGIN
  FOREACH legacy_column IN ARRAY ARRAY['profession', 'package_id', 'package_tier']
  LOOP
    IF EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'user_subscriptions'
         AND column_name = legacy_column
    ) THEN
      EXECUTE format(
        'ALTER TABLE user_subscriptions ALTER COLUMN %I DROP NOT NULL',
        legacy_column
      );
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM user_subscriptions WHERE plan_id IS NULL
  ) THEN
    ALTER TABLE user_subscriptions ALTER COLUMN plan_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_subscriptions_user_id_idx
  ON user_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS user_subscriptions_plan_id_idx
  ON user_subscriptions(plan_id);

COMMENT ON COLUMN user_subscriptions.plan_id IS
  'Canonical CreatorHub entitlement plan identifier. Legacy package_id is retained only for compatibility.';
