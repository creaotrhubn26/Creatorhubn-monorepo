-- =====================================================================
-- 327_leadgrid_momentum_goals.sql
--
-- Sales-goal-tabell for Momentum Engine. Per org per måned: ønsket
-- revenue/deals/meetings + daglige activity-targets (kontakter,
-- oppfølginger, møter, leads-flyttet-i-pipeline).
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS leadgrid_org_sales_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  year_month CHAR(7) NOT NULL,             -- 'YYYY-MM'
  -- Resultatmål (det du ønsker)
  revenue_target NUMERIC(12,2),            -- NOK
  deals_target INTEGER,                    -- antall nye kunder
  meetings_target INTEGER,
  proposals_target INTEGER,
  -- Aktivitetsmål (det du kontrollerer) — daglig
  daily_contacts_target INTEGER DEFAULT 3,
  daily_followups_target INTEGER DEFAULT 5,
  daily_meetings_target INTEGER DEFAULT 1,
  daily_pipeline_moves_target INTEGER DEFAULT 2,
  -- Aktivitetsmål — månedlig (avledet fra daily * arbeidsdager hvis null)
  monthly_leads_needed INTEGER,            -- auto-utregnet fra historisk win-rate
  -- Metadata
  set_by_user_id VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_org_sales_goals_org_month
  ON leadgrid_org_sales_goals(organization_id, year_month DESC);

-- Snapshot av momentum-score per org per dag (for trend-visning)
CREATE TABLE IF NOT EXISTS leadgrid_momentum_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  momentum_score NUMERIC(5,2) NOT NULL,   -- 0-100
  activity_score NUMERIC(5,2),            -- delkomponent
  velocity_score NUMERIC(5,2),            -- delkomponent
  decay_score NUMERIC(5,2),               -- delkomponent
  overdue_penalty NUMERIC(5,2),           -- (negativ)
  -- Faktiske tall (for tooltip)
  contacts_today INTEGER DEFAULT 0,
  followups_today INTEGER DEFAULT 0,
  meetings_today INTEGER DEFAULT 0,
  pipeline_moves_today INTEGER DEFAULT 0,
  overdue_nbas INTEGER DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_momentum_snapshots_org_date
  ON leadgrid_momentum_snapshots(organization_id, snapshot_date DESC);

INSERT INTO permissions (key, category, description) VALUES
  ('momentum.view', 'Momentum', 'Se org-ens momentum-score og daglige mål'),
  ('momentum.set_goal', 'Momentum', 'Sett/oppdater sales-goal for org')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, permission_key) VALUES
  ('admin', 'momentum.view'), ('admin', 'momentum.set_goal'),
  ('salgssjef', 'momentum.view'), ('salgssjef', 'momentum.set_goal'),
  ('teamleder', 'momentum.view'),
  ('salgskonsulent', 'momentum.view'),
  ('promotor', 'momentum.view')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
