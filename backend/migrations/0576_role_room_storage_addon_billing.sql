-- 0576_role_room_storage_addon_billing.sql
-- Storage is included in the main Role Room plan. Stripe bills only optional
-- storage add-ons, so a failed add-on payment must not remove base-plan access.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '180s';

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS role_room_plan_key VARCHAR(40) NOT NULL DEFAULT 'solo_free'
    REFERENCES plan_limits(plan_key) ON DELETE SET DEFAULT;

UPDATE organizations
   SET role_room_plan_key = 'enterprise'
 WHERE org_type = 'developer'
   AND role_room_plan_key = 'solo_free';

ALTER TABLE role_room_affiliate_partners
  ADD COLUMN IF NOT EXISTS storage_commission_basis_points INTEGER NOT NULL DEFAULT 500
    CHECK (storage_commission_basis_points BETWEEN 0 AND 10000);

COMMENT ON COLUMN role_room_affiliate_partners.storage_commission_basis_points IS
  'Affiliate commission for optional storage add-ons. Core plan commission remains in commission_basis_points.';

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

COMMIT;
