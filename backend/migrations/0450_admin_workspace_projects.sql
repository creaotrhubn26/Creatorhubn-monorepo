-- 0450_admin_workspace_projects.sql
--
-- Interne initiativer i Admin Workspace. Dette er ikke kunde-, casting- eller
-- produksjonsprosjekter. Tabellen samler arbeidet admin faktisk driver frem:
-- støtte, markedsinngang, partnerløp, investorarbeid og interne leveranser.

CREATE TABLE IF NOT EXISTS admin_workspace_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  product_key VARCHAR(20),
  title VARCHAR(200) NOT NULL,
  summary TEXT,
  objective TEXT,
  category VARCHAR(30) NOT NULL DEFAULT 'internal',
  status VARCHAR(20) NOT NULL DEFAULT 'planned',
  priority VARCHAR(10) NOT NULL DEFAULT 'normal',
  progress_percent SMALLINT NOT NULL DEFAULT 0,
  start_date DATE,
  target_date DATE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR,
  CONSTRAINT admin_workspace_projects_user_unique UNIQUE (id, user_id),
  CONSTRAINT admin_workspace_projects_product_key_check
    CHECK (product_key IS NULL OR product_key IN ('role_room', 'leadgrid')),
  CONSTRAINT admin_workspace_projects_category_check
    CHECK (category IN ('funding', 'market_outreach', 'partnership', 'investor', 'go_to_market', 'internal', 'other')),
  CONSTRAINT admin_workspace_projects_status_check
    CHECK (status IN ('planned', 'active', 'blocked', 'on_hold', 'completed', 'archived')),
  CONSTRAINT admin_workspace_projects_priority_check
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT admin_workspace_projects_progress_check
    CHECK (progress_percent BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_admin_workspace_projects_user_status_target
  ON admin_workspace_projects (user_id, status, target_date, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_workspace_projects_user_product
  ON admin_workspace_projects (user_id, product_key, updated_at DESC);

-- Polymorfe koblinger lar prosjektet samle eksisterende arbeidsobjekter uten
-- å duplisere deres data. API-et verifiserer tenant-eierskap før innsetting.
CREATE TABLE IF NOT EXISTS admin_workspace_project_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  user_id VARCHAR NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id VARCHAR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_workspace_project_links_project_fk
    FOREIGN KEY (project_id, user_id)
    REFERENCES admin_workspace_projects (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_workspace_project_links_entity_type_check
    CHECK (entity_type IN ('funding_app', 'industry_target', 'investor', 'partner', 'workspace_case')),
  CONSTRAINT admin_workspace_project_links_unique
    UNIQUE (project_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_workspace_project_links_project
  ON admin_workspace_project_links (project_id, created_at);

CREATE INDEX IF NOT EXISTS idx_admin_workspace_project_links_entity
  ON admin_workspace_project_links (user_id, entity_type, entity_id);

COMMENT ON TABLE admin_workspace_projects IS
  'Adminstyrte initiativer som støttearbeid, markedsinngang, partnerløp og interne leveranser. Ikke kundens produksjonsprosjekter.';

COMMENT ON TABLE admin_workspace_project_links IS
  'Tenant-sikrede koblinger fra et adminprosjekt til eksisterende støtte-, kontakt- og saksdata.';
