-- 0312_plan_limits_usage_grace_drips.sql
--
-- Plan-håndhevelse for Leadgrid (Solo Free / Solo Pro / Agency / Enterprise).
--
-- 4 tabeller:
--   1) plan_limits     — definisjon av hva hver plan tillater
--   2) plan_usage      — månedlig tellere per org (auto-onboards, kunder, …)
--   3) plan_grace      — 14-dagers grace etter nedgradering / utløpt abonnement
--   4) onboarding_drip — e-post-drypp etter første aha-moment

------------------------------------------------------------
-- 1) plan_limits (seeded)
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plan_limits (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key                    VARCHAR(40) NOT NULL UNIQUE,
  display_name                VARCHAR(100) NOT NULL,
  price_monthly_nok           INT NOT NULL DEFAULT 0,
  -- Grenser
  max_active_customers        INT,                       -- NULL = ubegrenset
  max_auto_onboards_per_month INT,                       -- NULL = ubegrenset
  max_playbooks_visible       INT,                       -- NULL = alle
  max_team_members            INT,                       -- NULL = ubegrenset
  -- Feature-flags
  has_automation_rules        BOOLEAN NOT NULL DEFAULT FALSE,
  has_custom_fields           BOOLEAN NOT NULL DEFAULT FALSE,
  has_pitch_deck_studio       BOOLEAN NOT NULL DEFAULT FALSE,
  has_white_label_portal      BOOLEAN NOT NULL DEFAULT FALSE,
  has_salgshierarki           BOOLEAN NOT NULL DEFAULT FALSE,
  audit_log_retention_days    INT NOT NULL DEFAULT 7,
  -- Display
  display_order               INT NOT NULL DEFAULT 0,
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  -- Stripe
  stripe_price_id_monthly     VARCHAR(120),
  stripe_price_id_yearly      VARCHAR(120),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO plan_limits
  (plan_key, display_name, price_monthly_nok,
   max_active_customers, max_auto_onboards_per_month,
   max_playbooks_visible, max_team_members,
   has_automation_rules, has_custom_fields, has_pitch_deck_studio,
   has_white_label_portal, has_salgshierarki, audit_log_retention_days,
   display_order)
VALUES
  ('solo_free',
   'Solo (gratis)', 0,
   1, 3, 3, 1,
   FALSE, FALSE, FALSE, FALSE, FALSE, 7,
   10),

  ('solo_pro',
   'Solo Pro', 199,
   10, 30, NULL, 1,
   TRUE, TRUE, TRUE, FALSE, FALSE, 90,
   20),

  ('agency',
   'Agency', 990,
   NULL, NULL, NULL, NULL,
   TRUE, TRUE, TRUE, TRUE, TRUE, 365,
   30),

  ('enterprise',
   'Enterprise', 0,  -- på forespørsel
   NULL, NULL, NULL, NULL,
   TRUE, TRUE, TRUE, TRUE, TRUE, 730,
   40)
ON CONFLICT (plan_key) DO UPDATE
  SET display_name                = EXCLUDED.display_name,
      price_monthly_nok           = EXCLUDED.price_monthly_nok,
      max_active_customers        = EXCLUDED.max_active_customers,
      max_auto_onboards_per_month = EXCLUDED.max_auto_onboards_per_month,
      max_playbooks_visible       = EXCLUDED.max_playbooks_visible,
      max_team_members            = EXCLUDED.max_team_members,
      has_automation_rules        = EXCLUDED.has_automation_rules,
      has_custom_fields           = EXCLUDED.has_custom_fields,
      has_pitch_deck_studio       = EXCLUDED.has_pitch_deck_studio,
      has_white_label_portal      = EXCLUDED.has_white_label_portal,
      has_salgshierarki           = EXCLUDED.has_salgshierarki,
      audit_log_retention_days    = EXCLUDED.audit_log_retention_days,
      display_order               = EXCLUDED.display_order,
      updated_at                  = now();

------------------------------------------------------------
-- 2) plan_usage (månedlig per org)
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plan_usage (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Year-month-bucket. Tør ikke månedlig PARTITIONERING ennå, men dette
  -- gjør at vi kan slå opp "denne måneden".
  period_month        DATE NOT NULL,    -- 1. i mnd, f.eks. '2026-06-01'
  auto_onboards_used  INT NOT NULL DEFAULT 0,
  customers_created   INT NOT NULL DEFAULT 0,
  emails_sent         INT NOT NULL DEFAULT 0,
  claude_calls        INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_plan_usage_org_month
  ON plan_usage (organization_id, period_month DESC);

------------------------------------------------------------
-- 3) plan_grace (14-dagers vindu etter nedgradering)
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plan_grace (
  organization_id  UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  former_plan_key  VARCHAR(40) NOT NULL,
  reason           VARCHAR(60),  -- 'downgrade' | 'subscription_expired' | 'payment_failed'
  starts_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL,
  notified_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_grace_expires
  ON plan_grace (expires_at);

------------------------------------------------------------
-- 4) onboarding_drip (e-post-drypp etter aha-moment)
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onboarding_drips (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  -- Hvilken aha-trigger: 'first_auto_onboard' | 'first_focus_request' | 'first_playbook_started'
  trigger_event       VARCHAR(60) NOT NULL,
  triggered_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Sending-state per dag
  day1_sent_at        TIMESTAMPTZ,
  day3_sent_at        TIMESTAMPTZ,
  day7_sent_at        TIMESTAMPTZ,
  day14_sent_at       TIMESTAMPTZ,
  -- Konvertering — hvis bruker oppgraderer setter vi det her og stopper drip
  converted_at        TIMESTAMPTZ,
  unsubscribed_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, trigger_event)
);

CREATE INDEX IF NOT EXISTS idx_drips_pending
  ON onboarding_drips (triggered_at)
  WHERE converted_at IS NULL AND unsubscribed_at IS NULL;

------------------------------------------------------------
-- 5) organizations utvidelse — stripe + plan-state
------------------------------------------------------------
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  VARCHAR(120),
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS plan_started_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_renews_at           TIMESTAMPTZ;

-- 'plan'-feltet eksisterer allerede i organizations. Pre-mig 0311
-- brukte vi 'free'|'solo'|'agency'|'enterprise' fritt. Vi flytter til
-- de oppmerksomme plan-keys. Sett 'free' og 'solo' til 'solo_free' for
-- eksisterende orgs uten betaling.
UPDATE organizations
   SET plan = 'solo_free'
 WHERE plan IN ('free', 'solo')
   AND stripe_subscription_id IS NULL;

-- developer-orgs (Creatorhub AS) får 'enterprise' (intern)
UPDATE organizations
   SET plan = 'enterprise'
 WHERE org_type = 'developer';
