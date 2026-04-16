-- 0046_role_room_agent_entitlements.sql
-- Monetization layer for The Role Room Agent.
--
-- Model: hybrid.
--   - pro / enterprise subscription → auto-grant (active_plan source)
--   - basic subscription → can buy add-on OR start trial
--   - prototype / no subscription → can start trial, then must buy
--   - admin / owner / super_admin → bypass (checked in code, not DB)
--
-- Each user has at most ONE active entitlement row (enforced via partial
-- unique index on revoked_at IS NULL).

CREATE TABLE IF NOT EXISTS role_room_agent_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- 'trial'       : time-limited free trial
  -- 'active'      : paid / included in plan
  -- 'expired'     : trial ran out OR subscription cancelled
  -- 'revoked'     : admin revoked (support action)
  status TEXT NOT NULL CHECK (status IN ('trial', 'active', 'expired', 'revoked')),

  -- How the entitlement was obtained — drives UI labelling + audit.
  source TEXT NOT NULL CHECK (source IN (
    'plan_pro',
    'plan_enterprise',
    'addon_monthly',
    'admin_grant',
    'trial'
  )),

  -- Only meaningful for source = 'trial' / status = 'trial'.
  trial_ends_at TIMESTAMPTZ,

  -- Stripe refs when source = 'addon_monthly'. Null otherwise.
  stripe_subscription_id TEXT,
  stripe_product_id TEXT,

  -- Free-form note for admin grants / support cases.
  notes TEXT,

  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active entitlement per user (revoked rows retained for audit).
CREATE UNIQUE INDEX IF NOT EXISTS role_room_agent_entitlements_active_user_idx
  ON role_room_agent_entitlements (user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS role_room_agent_entitlements_user_granted_idx
  ON role_room_agent_entitlements (user_id, granted_at DESC);

CREATE INDEX IF NOT EXISTS role_room_agent_entitlements_status_idx
  ON role_room_agent_entitlements (status, trial_ends_at);

COMMENT ON TABLE role_room_agent_entitlements IS
  'Per-user paid access to The Role Room Agent. Admins bypass via role check; everyone else needs an active row here or an active pro/enterprise subscription.';
