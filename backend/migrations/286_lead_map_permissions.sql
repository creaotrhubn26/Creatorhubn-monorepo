-- 286_lead_map_permissions.sql
--
-- Granulær tillatelses-styring (RBAC + per-bruker overstyring).
--
-- Tre-lags resolvering for "kan bruker X gjøre Y i org Z?":
--   1. Org-rolle (organization_members.role) gir et default-sett
--      via role_permissions
--   2. user_permission_overrides kan eksplisitt tillate/nekte
--      enkelt-permissions per bruker
--   3. Admin er alltid tillatt alt (sikkerhets-floor)
--
-- Permission-keys følger format `domain.action`:
--   leads.view / leads.create / leads.update / leads.delete /
--   leads.assign / leads.export
--   visits.view / visits.create / visits.update
--   competitors.* projects.* brandkit.* marketscan.*
--   outreach.* meta_ads.* linkedin.*
--   org.view_profile / org.edit_profile
--   members.view / members.invite / members.remove / members.change_role
--   teams.* profiles.edit_own / profiles.edit_others
--   permissions.manage billing.* ai.use_claude

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- Permissions-katalog (statisk, men eksplisitt så vi kan auditere)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
  key VARCHAR(80) PRIMARY KEY,
  category VARCHAR(40) NOT NULL,
  description TEXT NOT NULL
);

INSERT INTO permissions (key, category, description) VALUES
  -- Leads
  ('leads.view',            'Leads',     'Se leads-listen og kartet'),
  ('leads.create',          'Leads',     'Opprette nye leads'),
  ('leads.update',          'Leads',     'Endre lead-informasjon og status'),
  ('leads.delete',          'Leads',     'Slette leads'),
  ('leads.assign',          'Leads',     'Tildele leads til selgere'),
  ('leads.export',          'Leads',     'Eksportere leads (CSV/PDF)'),
  -- Besøk (iPad / mobile)
  ('visits.view',           'Besøk',     'Se planlagte og gjennomførte besøk'),
  ('visits.create',         'Besøk',     'Registrere nye besøk'),
  ('visits.update',         'Besøk',     'Endre besøk-informasjon og status'),
  -- Konkurrenter
  ('competitors.view',      'Konkurrenter', 'Se konkurrent-kartet'),
  ('competitors.create',    'Konkurrenter', 'Legge til konkurrenter manuelt'),
  ('competitors.update',    'Konkurrenter', 'Endre konkurrent-info'),
  ('competitors.delete',    'Konkurrenter', 'Slette konkurrenter'),
  -- Prosjekter
  ('projects.view',         'Prosjekter','Se prosjekt-listen'),
  ('projects.create',       'Prosjekter','Opprette nye prosjekter'),
  ('projects.update',       'Prosjekter','Endre prosjekt-info'),
  ('projects.delete',       'Prosjekter','Slette prosjekter'),
  -- Brand Kit
  ('brandkit.view',         'Brand Kit', 'Se brand-kit'),
  ('brandkit.update',       'Brand Kit', 'Endre brand-kit'),
  -- Market Scan
  ('marketscan.view',       'Market Scan','Se Market Scan-resultater'),
  ('marketscan.run',        'Market Scan','Kjøre nye Market Scan-søk'),
  -- Outreach
  ('outreach.view',         'Outreach',  'Se outreach-status'),
  ('outreach.send_email',   'Outreach',  'Sende outreach-e-poster'),
  ('outreach.send_sms',     'Outreach',  'Sende outreach-SMS'),
  ('outreach.export',       'Outreach',  'Eksportere outreach-data'),
  -- Meta Ads
  ('meta_ads.view',         'Meta Ads',  'Se Meta Ads-statistikk'),
  ('meta_ads.publish',      'Meta Ads',  'Publisere nye Meta-kampanjer'),
  -- LinkedIn
  ('linkedin.view',         'LinkedIn',  'Se LinkedIn-statistikk'),
  ('linkedin.publish',      'LinkedIn',  'Publisere på LinkedIn'),
  -- Org-profil
  ('org.view_profile',      'Org',       'Se org-profil'),
  ('org.edit_profile',      'Org',       'Endre org-profil'),
  -- Medlemmer
  ('members.view',          'Medlemmer', 'Se medlems-listen'),
  ('members.invite',        'Medlemmer', 'Invitere nye medlemmer'),
  ('members.remove',        'Medlemmer', 'Fjerne medlemmer'),
  ('members.change_role',   'Medlemmer', 'Endre medlems-roller'),
  -- Teams
  ('teams.view',            'Teams',     'Se salgs-team'),
  ('teams.create',          'Teams',     'Opprette nye team'),
  ('teams.update',          'Teams',     'Endre team-info'),
  ('teams.delete',          'Teams',     'Slette team'),
  ('teams.assign_members',  'Teams',     'Tildele medlemmer til team'),
  -- Profiler
  ('profiles.edit_own',     'Profiler',  'Redigere egen profil'),
  ('profiles.edit_others',  'Profiler',  'Redigere andres profiler'),
  -- Tillatelses-styring
  ('permissions.manage',    'Sikkerhet', 'Endre tillatelser for andre brukere'),
  -- Billing
  ('billing.view',          'Billing',   'Se faktura/abonnement'),
  ('billing.manage',        'Billing',   'Endre faktura/abonnement'),
  -- AI
  ('ai.use_claude',         'AI',        'Bruke Claude-funksjoner (threat-vurdering, outreach-strategi)')
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category,
      description = EXCLUDED.description;

-- ─────────────────────────────────────────────────────────────────
-- Rolle-defaults (hvilke permissions hver rolle har som standard)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
  role VARCHAR(30) NOT NULL,
  permission_key VARCHAR(80) NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_key)
);

-- admin: alle permissions (settes via ALL_PERMISSIONS-helper i kode,
-- men vi seeder eksplisitt her også for synlighet)
INSERT INTO role_permissions (role, permission_key)
SELECT 'admin', key FROM permissions
ON CONFLICT DO NOTHING;

-- salgssjef: salgs-management, team-management, full leads/visits/outreach
INSERT INTO role_permissions (role, permission_key)
SELECT 'salgssjef', key FROM permissions
WHERE key IN (
  'leads.view','leads.create','leads.update','leads.delete','leads.assign','leads.export',
  'visits.view','visits.create','visits.update',
  'competitors.view','competitors.create','competitors.update','competitors.delete',
  'projects.view','projects.create','projects.update',
  'brandkit.view','marketscan.view','marketscan.run',
  'outreach.view','outreach.send_email','outreach.send_sms','outreach.export',
  'meta_ads.view','meta_ads.publish','linkedin.view','linkedin.publish',
  'org.view_profile','members.view','members.invite','members.change_role',
  'teams.view','teams.create','teams.update','teams.delete','teams.assign_members',
  'profiles.edit_own','profiles.edit_others','ai.use_claude'
)
ON CONFLICT DO NOTHING;

-- teamleder: team-management for eget team + leads/visits/outreach på team
INSERT INTO role_permissions (role, permission_key)
SELECT 'teamleder', key FROM permissions
WHERE key IN (
  'leads.view','leads.create','leads.update','leads.assign','leads.export',
  'visits.view','visits.create','visits.update',
  'competitors.view','competitors.create','competitors.update',
  'projects.view','brandkit.view','marketscan.view',
  'outreach.view','outreach.send_email','outreach.send_sms',
  'meta_ads.view','linkedin.view',
  'org.view_profile','members.view','teams.view','teams.assign_members',
  'profiles.edit_own','profiles.edit_others','ai.use_claude'
)
ON CONFLICT DO NOTHING;

-- salgskonsulent: leads (egne), visits (egne), outreach (egne)
INSERT INTO role_permissions (role, permission_key)
SELECT 'salgskonsulent', key FROM permissions
WHERE key IN (
  'leads.view','leads.create','leads.update','leads.export',
  'visits.view','visits.create','visits.update',
  'competitors.view','projects.view',
  'brandkit.view','marketscan.view',
  'outreach.view','outreach.send_email','outreach.send_sms',
  'meta_ads.view','linkedin.view',
  'org.view_profile','members.view','teams.view',
  'profiles.edit_own','ai.use_claude'
)
ON CONFLICT DO NOTHING;

-- promotor: kart-visning + besøk-registrering + leads create på event
INSERT INTO role_permissions (role, permission_key)
SELECT 'promotor', key FROM permissions
WHERE key IN (
  'leads.view','leads.create','leads.update',
  'visits.view','visits.create','visits.update',
  'competitors.view','projects.view','brandkit.view',
  'org.view_profile','members.view','teams.view',
  'profiles.edit_own'
)
ON CONFLICT DO NOTHING;

-- member: standard skrive-tilgang i lead-CRM
INSERT INTO role_permissions (role, permission_key)
SELECT 'member', key FROM permissions
WHERE key IN (
  'leads.view','leads.create','leads.update',
  'visits.view','visits.create',
  'competitors.view','projects.view','brandkit.view','marketscan.view',
  'outreach.view','meta_ads.view','linkedin.view',
  'org.view_profile','members.view','teams.view',
  'profiles.edit_own'
)
ON CONFLICT DO NOTHING;

-- viewer: kun lese-tilgang
INSERT INTO role_permissions (role, permission_key)
SELECT 'viewer', key FROM permissions
WHERE key IN (
  'leads.view','visits.view','competitors.view','projects.view',
  'brandkit.view','marketscan.view','outreach.view',
  'meta_ads.view','linkedin.view',
  'org.view_profile','members.view','teams.view',
  'profiles.edit_own'
)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- Per-bruker overstyringer (grant/revoke individuelle permissions)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  permission_key VARCHAR(80) NOT NULL
    REFERENCES permissions(key) ON DELETE CASCADE,
  effect VARCHAR(10) NOT NULL CHECK (effect IN ('grant', 'revoke')),
  granted_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  UNIQUE (organization_id, user_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_user_perm_overrides_user
  ON user_permission_overrides (organization_id, user_id);

-- ─────────────────────────────────────────────────────────────────
-- Audit-logg for tillatelses-endringer
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permission_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE CASCADE,
  target_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  permission_key VARCHAR(80),
  action VARCHAR(30) NOT NULL,    -- 'grant' / 'revoke' / 'reset_to_default'
  performed_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_permission_audit_org_time
  ON permission_audit_log (organization_id, performed_at DESC);

COMMIT;
