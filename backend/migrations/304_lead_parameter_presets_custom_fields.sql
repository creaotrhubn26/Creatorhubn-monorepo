-- =====================================================================
-- 304_lead_parameter_presets_custom_fields.sql
--
-- To-deler:
--
--   A) Parameter presets — pre-konfigurerte bunter av needs / signals /
--      scoring-vekter + custom fields, knyttet til en bransje. Når en
--      bruker oppretter en lead, kan hen velge en preset → systemet
--      auto-fyller hva som er relevant.
--      Eks: "Helsetech B2B SaaS" → needs_meta_pixel + needs_ga4 +
--      needs_seo_structured_data + needs_case_studies dukker opp som
--      foreslåtte fra start.
--
--   B) Custom field definitions — org-styrt schema for ekstra-felter
--      utover crm_customers' faste kolonner. Hver felt har key, label,
--      type (text/number/dropdown/boolean/date/url), options for dropdowns,
--      og en gated_permission slik at organisasjonen kontrollerer hvem
--      som ser/redigerer dem.
--      Eks: { key:'marketing_budget', label:'Har markedsbudsjett?',
--             field_type:'dropdown',
--             options:['Unknown','Low','Medium','High'],
--             gated_permission:'marketing.needs.view' }
--
-- Verdier lagres i crm_customers.custom_fields (eksisterende JSONB).
-- Mig'en lager bare DEFINITIONS-tabellen — verdiene lever videre i
-- den eksisterende kolonnen.
--
-- Nye permissions:
--   marketing.presets.view, marketing.presets.edit,
--   marketing.custom_fields.edit
-- =====================================================================

BEGIN;

-- ─── A) Parameter presets ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_parameter_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name VARCHAR(120) NOT NULL,
  description TEXT,

  -- Hva slags lead presetten matcher (fri-tekst — Claude bruker dette
  -- til å foreslå preset ved auto-klassifisering)
  industry VARCHAR(120),
  -- Kategori-tag for filtrering i UI (B2B, B2C, Local, SaaS, Event, etc.)
  category VARCHAR(40),

  -- Standard needs som preselektes
  default_needs TEXT[] DEFAULT '{}',
  -- Standard signals (positive eller negative) som forventes
  default_signals TEXT[] DEFAULT '{}',
  -- Scoring-vekter (dimension → weight) som anbefales for denne bransjen
  default_scoring_weights JSONB DEFAULT '{}'::jsonb,
  -- Standard custom field-verdier (key → value) som settes ved opprettelse
  default_custom_fields JSONB DEFAULT '{}'::jsonb,
  -- Foreslåtte tags
  default_tags TEXT[] DEFAULT '{}',
  -- Foreslått lead_source-verdi
  default_lead_source VARCHAR(80),

  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,    -- system-seeded (kan ikke slettes)

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,

  UNIQUE (organization_id, name)
);
CREATE INDEX IF NOT EXISTS idx_lead_presets_org_active
  ON lead_parameter_presets(organization_id, is_active);

-- ─── B) Custom field definitions ───────────────────────────────
CREATE TABLE IF NOT EXISTS lead_custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  field_key VARCHAR(60) NOT NULL,        -- snake_case, brukes i custom_fields JSONB
  label VARCHAR(160) NOT NULL,           -- vises i UI
  description TEXT,

  field_type VARCHAR(20) NOT NULL CHECK (field_type IN
    ('text', 'long_text', 'number', 'dropdown', 'multi_select',
     'boolean', 'date', 'datetime', 'url', 'email', 'phone', 'currency')),
  -- For dropdown/multi_select
  options JSONB DEFAULT '[]'::jsonb,     -- ["Unknown","Low","Medium","High"]

  -- Hvilken permission kreves for å SE feltet. NULL = alle som ser leaden.
  -- Eks: 'marketing.needs.view' / 'marketing.budget.view' / etc.
  gated_view_permission VARCHAR(80),
  -- Hvilken permission kreves for å REDIGERE
  gated_edit_permission VARCHAR(80),

  is_required BOOLEAN NOT NULL DEFAULT false,
  default_value JSONB,                   -- "Unknown" / null / etc.

  -- Hvilke presets denne felten er relevant for. NULL/tom = alltid vises.
  preset_ids UUID[] DEFAULT '{}',

  sort_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,

  UNIQUE (organization_id, field_key)
);
CREATE INDEX IF NOT EXISTS idx_lead_custom_fields_org_active
  ON lead_custom_field_definitions(organization_id, is_active, sort_order);

-- ─── 3 nye permissions ─────────────────────────────────────────
INSERT INTO permissions (key, category, description) VALUES
  ('marketing.presets.view',       'Marketing', 'Se parameter-presets'),
  ('marketing.presets.edit',       'Marketing', 'Endre parameter-presets (org-styrt)'),
  ('marketing.custom_fields.edit', 'Marketing', 'Endre custom field-definisjoner (org-styrt)')
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category,
      description = EXCLUDED.description;

-- Tildel til markedssjef (full kontroll)
INSERT INTO role_permissions (role, permission_key) VALUES
  ('markedssjef', 'marketing.presets.view'),
  ('markedssjef', 'marketing.presets.edit'),
  ('markedssjef', 'marketing.custom_fields.edit')
ON CONFLICT (role, permission_key) DO NOTHING;

-- Markedskoordinator: view + edit presets, ikke custom fields
INSERT INTO role_permissions (role, permission_key) VALUES
  ('markedskoordinator', 'marketing.presets.view'),
  ('markedskoordinator', 'marketing.presets.edit')
ON CONFLICT (role, permission_key) DO NOTHING;

-- Alle andre marketing-roller: bare view
INSERT INTO role_permissions (role, permission_key) VALUES
  ('seo_spesialist',        'marketing.presets.view'),
  ('content_ansvarlig',     'marketing.presets.view'),
  ('performance_marketer',  'marketing.presets.view'),
  ('markedsanalytiker',     'marketing.presets.view')
ON CONFLICT (role, permission_key) DO NOTHING;

-- Salgssjef + selgere ser også preset-listen (de oppretter leads)
INSERT INTO role_permissions (role, permission_key) VALUES
  ('salgssjef',  'marketing.presets.view'),
  ('teamleder',  'marketing.presets.view'),
  ('selger',     'marketing.presets.view'),
  ('promotor',   'marketing.presets.view')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
