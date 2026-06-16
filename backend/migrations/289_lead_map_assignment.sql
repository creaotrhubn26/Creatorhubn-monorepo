-- 289_lead_map_assignment.sql
--
-- Lead-tildeling til salgskonsulent + kvote-tracking:
--
-- Datamodell:
--   crm_customers
--     .assigned_user_id       → hvem eier denne lead-en akkurat nå
--     .assigned_at            → når
--     .assigned_by_user_id    → hvem som tildelte
--     .last_contacted_at      → sist contact-aktivitet
--     (existerende .owner_user_id beholdes som "skaffet av")
--
--   lead_assignment_log       → audit-spor for re-tildelinger
--
--   lead_quota_targets        → månedlig kvote per (org, user, year_month)
--                               supplerer user_profiles.quota_monthly_nok
--                               m/ historikk for trend-grafer
--
-- Auto-tildeling:
--   Hvis user_profiles.territory matcher lead.city/region: roundrobin
--   blant tilgjengelige selgere i teamet.

BEGIN;

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS assigned_user_id VARCHAR(255)
    REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_by_user_id VARCHAR(255)
    REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_crm_customers_assigned
  ON crm_customers (assigned_user_id)
  WHERE assigned_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_last_contacted
  ON crm_customers (last_contacted_at DESC)
  WHERE assigned_user_id IS NOT NULL;

-- Audit-spor
CREATE TABLE IF NOT EXISTS lead_assignment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id VARCHAR(255) NOT NULL
    REFERENCES crm_customers(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  from_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  to_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  assigned_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  reason VARCHAR(40) DEFAULT 'manual',
  -- 'manual', 'auto_territory', 'auto_round_robin', 'reassign', 'release'
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_lead_assignment_log_lead
  ON lead_assignment_log (lead_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_assignment_log_to_user
  ON lead_assignment_log (to_user_id, assigned_at DESC)
  WHERE to_user_id IS NOT NULL;

-- Månedlig kvote per (org, user, måned)
CREATE TABLE IF NOT EXISTS lead_quota_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  year_month CHAR(7) NOT NULL,                  -- 'YYYY-MM'
  target_nok NUMERIC(14,2) NOT NULL DEFAULT 0,
  target_won_deals INT,
  target_meetings_booked INT,
  set_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_quota_targets_user
  ON lead_quota_targets (user_id, year_month DESC);

-- Backfill: gamle leads m/ owner_user_id som ikke har assigned_user_id
-- skal "selv-tildeles" til eier for bakoverkompatibilitet
UPDATE crm_customers
   SET assigned_user_id = owner_user_id,
       assigned_at = created_at,
       assigned_by_user_id = owner_user_id
 WHERE assigned_user_id IS NULL
   AND owner_user_id IS NOT NULL;

COMMIT;
