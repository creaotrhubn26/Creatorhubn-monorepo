-- 0455_admin_workspace_funding_opportunities.sql
--
-- Støttefrist-radar for eksterne ordninger. Dette er ordninger admin følger,
-- ikke egne søknader; egne søknader ligger fortsatt i admin_funding_apps.

CREATE TABLE IF NOT EXISTS admin_workspace_funding_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  product_key VARCHAR(20),
  catalog_key VARCHAR(120),
  provider VARCHAR(160) NOT NULL,
  scheme_name VARCHAR(240) NOT NULL,
  description TEXT,
  deadline DATE,
  is_rolling BOOLEAN NOT NULL DEFAULT FALSE,
  deadline_note VARCHAR(500),
  status VARCHAR(24) NOT NULL DEFAULT 'watching',
  source_url TEXT NOT NULL,
  application_url TEXT,
  last_verified_at TIMESTAMPTZ,
  next_check_date DATE,
  assignee VARCHAR(160),
  fit_notes TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR,
  CONSTRAINT admin_workspace_funding_opportunities_user_unique UNIQUE (id, user_id),
  CONSTRAINT admin_workspace_funding_opportunities_product_check
    CHECK (product_key IS NULL OR product_key IN ('role_room', 'leadgrid')),
  CONSTRAINT admin_workspace_funding_opportunities_status_check
    CHECK (status IN ('watching', 'planned', 'applying', 'submitted', 'not_relevant', 'closed')),
  CONSTRAINT admin_workspace_funding_opportunities_source_url_check
    CHECK (source_url ~ '^https?://'),
  CONSTRAINT admin_workspace_funding_opportunities_application_url_check
    CHECK (application_url IS NULL OR application_url ~ '^https?://')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_workspace_funding_catalog_unique
  ON admin_workspace_funding_opportunities (user_id, catalog_key)
  WHERE catalog_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_workspace_funding_user_deadline
  ON admin_workspace_funding_opportunities (user_id, deadline)
  WHERE deadline IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_workspace_funding_user_status
  ON admin_workspace_funding_opportunities (user_id, status, next_check_date);

CREATE INDEX IF NOT EXISTS idx_admin_workspace_funding_user_product
  ON admin_workspace_funding_opportunities (user_id, product_key, updated_at DESC);

COMMENT ON TABLE admin_workspace_funding_opportunities IS
  'Eksterne støtteordninger og søknadsfrister som admin overvåker, med offisiell kilde og verifiseringstidspunkt.';

COMMENT ON COLUMN admin_workspace_funding_opportunities.last_verified_at IS
  'Tidspunkt da fristopplysningene sist ble kontrollert mot source_url.';
