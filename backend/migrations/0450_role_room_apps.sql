-- 0450_role_room_apps.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 2: Role Room marketplace — org-scoped app-katalog + installasjoner.
--
-- Leadgrid installeres som en TJENESTE i The Role Room (innholdsproduksjons-
-- modus). Vi bruker egne, org-scoped tabeller i stedet for CreatorHubs
-- `marketplace_app_config` (mig 0127) eller den user-scoped + NextRole-bundne
-- `marketplace_installations` (mig 0137) — å blande Leadgrid-org inn der ville
-- skapt kryss-avhengighet. (Beslutning D2, jf. tasks/leadgrid-isolering-og-
-- role-room-marketplace.md.)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS role_room_apps (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_room_app_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL REFERENCES role_room_apps(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'trial'
    CHECK (state IN ('trial', 'active', 'paused', 'cancelled')),
  installed_by VARCHAR(255),
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ,
  stripe_subscription_id VARCHAR(200),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, app_id)
);

CREATE INDEX IF NOT EXISTS idx_role_room_app_installs_org
  ON role_room_app_installs (organization_id);
CREATE INDEX IF NOT EXISTS idx_role_room_app_installs_app
  ON role_room_app_installs (app_id);

-- ── Seed: Leadgrid-katalogen ───────────────────────────────────────────
INSERT INTO role_room_apps (id, name, description, category, is_active, display_order)
VALUES (
  'leadgrid',
  'Leadgrid',
  'Finn kunder til din innholdsproduksjon — lead-discovery, kart, team og pipeline.',
  'salgsverktøy',
  TRUE,
  10
)
ON CONFLICT (id) DO NOTHING;
