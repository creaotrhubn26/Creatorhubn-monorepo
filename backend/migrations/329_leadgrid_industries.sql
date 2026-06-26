-- =====================================================================
-- 329_leadgrid_industries.sql
--
-- 3-lags bransje-kategorisering for Leadgrid.
--
-- Daniels krav: «rolle kan jobbe i ulike bransjer — vi trenger system
-- for dette». Tidligere lå bransje som fritekst i
-- crm_customers.lead_category (varchar 60) uten constraint, og det
-- fantes ingen kobling mellom et salgs-medlem og hvilke bransjer
-- vedkommende dekker.
--
-- Schema:
--   LAG 1: `industries`                       — sentral katalog
--          (NACE-toppnivå + Daniels custom verticals).
--          Hierarkisk via parent_id, scope=global|custom (org-eid).
--   LAG 2: `crm_customers.industry_id`        — FK → industries.
--          Fritekst-felter beholdes midlertidig for backfill og
--          overgangsperiode (UI kan vise begge).
--   LAG 3: `organization_member_industries`   — sales-rep × bransje
--          × expertise-level (general/specialist/expert) + en valgfri
--          is_primary-flag. Brukes til auto-routing av nye leads og
--          filtre («bare mine bransjer» på kartet).
--
-- 3 nye RBAC-keys (industries.view/manage/assign).
--
-- Designvalg:
--   - parent_id ON DELETE SET NULL  — slett av en gren skal ikke ødelegge
--     barna; de blir bare flatet ut.
--   - industries.id som UUID slik at iPad kan generere offline-IDer ved
--     bygging av custom-bransjer mens den er offline (rare flow, men
--     framtidssikret).
--   - Partial unique-index for is_primary (maks én primær per medlem
--     per org).
--   - JSONB metadata for fremtidige attributter (sesongmønster,
--     beslutningstaker-rolle, typisk avtalestørrelse osv.).
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- LAG 1: Sentral industries-tabell
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS industries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(40) UNIQUE NOT NULL,        -- 'NACE.56.10' | 'CUSTOM.WEDDING_VENUE'
  name_no         VARCHAR(200) NOT NULL,              -- 'Restaurantvirksomhet'
  name_en         VARCHAR(200),
  parent_id       UUID REFERENCES industries(id) ON DELETE SET NULL,
  icon            VARCHAR(60),                        -- SF Symbol-navn ('fork.knife') eller emoji
  color_hex       VARCHAR(7),                         -- '#9333ea' — pin-farge-override
  scope           VARCHAR(20) NOT NULL DEFAULT 'global'
                  CHECK (scope IN ('global', 'custom')),
  organization_id UUID,                               -- NULL for global; satt for org-custom
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  display_order   INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_industries_scope_org
  ON industries(scope, organization_id)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_industries_parent
  ON industries(parent_id)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_industries_code
  ON industries(code)
  WHERE is_active = TRUE;

-- Trigram for fuzzy-matching i backfill-scriptet.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_industries_name_no_trgm
  ON industries USING gin (LOWER(name_no) gin_trgm_ops)
  WHERE is_active = TRUE;

-- ─────────────────────────────────────────────────────────────────────
-- LAG 2: crm_customers.industry_id
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS industry_id UUID
    REFERENCES industries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_industry
  ON crm_customers(industry_id)
  WHERE archived_at IS NULL AND industry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_org_industry
  ON crm_customers(organization_id, industry_id)
  WHERE archived_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────
-- LAG 3: organization_member_industries (sales-rep × bransje)
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_member_industries (
  organization_id  UUID NOT NULL,
  user_id          UUID NOT NULL,
  industry_id      UUID NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
  expertise_level  VARCHAR(20) NOT NULL DEFAULT 'general'
                   CHECK (expertise_level IN ('general', 'specialist', 'expert')),
  is_primary       BOOLEAN NOT NULL DEFAULT FALSE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id, industry_id)
);

CREATE INDEX IF NOT EXISTS idx_member_industries_user
  ON organization_member_industries(user_id);

CREATE INDEX IF NOT EXISTS idx_member_industries_industry
  ON organization_member_industries(industry_id);

CREATE INDEX IF NOT EXISTS idx_member_industries_org_industry
  ON organization_member_industries(organization_id, industry_id);

-- Maks 1 primary per (org, user) — partial unique-index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_industries_one_primary
  ON organization_member_industries(organization_id, user_id)
  WHERE is_primary = TRUE;

-- ─────────────────────────────────────────────────────────────────────
-- 3 nye RBAC permissions (følger eksisterende `permissions`-tabell
-- + `role_permissions` fra migrasjon 286).
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO permissions (key, category, description) VALUES
  ('industries.view',   'Bransjer', 'Se bransje-katalogen og medlems-spesialiseringer'),
  ('industries.manage', 'Bransjer', 'Opprette/redigere custom bransjer for sin org'),
  ('industries.assign', 'Bransjer', 'Tildele bransjer/expertise-level til medlemmer')
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category,
      description = EXCLUDED.description;

-- Default rolle-bindings:
--   admin, salgssjef: alle 3
--   teamleder:       view + assign
--   salgskonsulent:  view
--   promotor:        view
INSERT INTO role_permissions (role, permission_key) VALUES
  ('admin',           'industries.view'),
  ('admin',           'industries.manage'),
  ('admin',           'industries.assign'),
  ('salgssjef',       'industries.view'),
  ('salgssjef',       'industries.manage'),
  ('salgssjef',       'industries.assign'),
  ('teamleder',       'industries.view'),
  ('teamleder',       'industries.assign'),
  ('salgskonsulent',  'industries.view'),
  ('promotor',        'industries.view')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
