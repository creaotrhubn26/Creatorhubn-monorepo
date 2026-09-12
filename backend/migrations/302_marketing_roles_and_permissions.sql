-- =====================================================================
-- 302_marketing_roles_and_permissions.sql
--
-- Marketingavdeling parallelt med salgs-hierarkiet:
--
--   Markedssjef         CMO / Marketing Director — strategi + budsjett
--     ├─ Markedskoordinator  Hands-on cockpit-bruker
--     ├─ SEO-spesialist      Audit + structured data + technical SEO
--     ├─ Content-ansvarlig   Brief, brand, voice
--     ├─ Performance-marketer  Ads-pixels + paid kampanjer
--     └─ Markedsanalytiker     Data, scoring-vekter, rapportering
--
-- 12 nye permissions under 'marketing.*'-namespace. Tildelt etter
-- matrise i feat/lead-scout-marketing-roles README.
-- =====================================================================

BEGIN;

-- ─── 12 nye marketing-permissions ───────────────────────────────
INSERT INTO permissions (key, category, description) VALUES
  ('marketing.dashboard.view',    'Marketing', 'Se markedsavdelingens dashbord'),
  ('marketing.needs.view',        'Marketing', 'Se identifiserte behov per lead'),
  ('marketing.needs.edit',        'Marketing', 'Redigere/legge til/avvise behov manuelt'),
  ('marketing.scout.run',         'Marketing', 'Kjøre crawl + needs-deteksjon på lead'),
  ('marketing.scoring.view',      'Marketing', 'Se AI-scoring per lead'),
  ('marketing.scoring.weights',   'Marketing', 'Justere scoring-vekter per dimensjon'),
  ('marketing.ads_pixels.manage', 'Marketing', 'Generere ads-pixels-implementasjon for kunde'),
  ('marketing.seo.audit',         'Marketing', 'Kjøre SEO-audit (Lighthouse + structured data)'),
  ('marketing.content.brief',     'Marketing', 'Generere content-brief fra lead-needs'),
  ('marketing.reports.export',    'Marketing', 'Eksportere markedsrapporter'),
  ('marketing.budget.view',       'Marketing', 'Se kampanjebudsjett + spend'),
  ('marketing.budget.spend',      'Marketing', 'Godkjenne kampanjebudsjett')
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category,
      description = EXCLUDED.description;

-- ─── Roll-out per markedsrolle ──────────────────────────────────

-- Markedssjef (full kontroll)
INSERT INTO role_permissions (role, permission_key) VALUES
  ('markedssjef', 'marketing.dashboard.view'),
  ('markedssjef', 'marketing.needs.view'),
  ('markedssjef', 'marketing.needs.edit'),
  ('markedssjef', 'marketing.scout.run'),
  ('markedssjef', 'marketing.scoring.view'),
  ('markedssjef', 'marketing.scoring.weights'),
  ('markedssjef', 'marketing.ads_pixels.manage'),
  ('markedssjef', 'marketing.seo.audit'),
  ('markedssjef', 'marketing.content.brief'),
  ('markedssjef', 'marketing.reports.export'),
  ('markedssjef', 'marketing.budget.view'),
  ('markedssjef', 'marketing.budget.spend')
ON CONFLICT (role, permission_key) DO NOTHING;

-- Markedskoordinator (hands-on, ikke budsjett-spend)
INSERT INTO role_permissions (role, permission_key) VALUES
  ('markedskoordinator', 'marketing.dashboard.view'),
  ('markedskoordinator', 'marketing.needs.view'),
  ('markedskoordinator', 'marketing.needs.edit'),
  ('markedskoordinator', 'marketing.scout.run'),
  ('markedskoordinator', 'marketing.scoring.view'),
  ('markedskoordinator', 'marketing.seo.audit'),
  ('markedskoordinator', 'marketing.content.brief'),
  ('markedskoordinator', 'marketing.reports.export')
ON CONFLICT (role, permission_key) DO NOTHING;

-- SEO-spesialist
INSERT INTO role_permissions (role, permission_key) VALUES
  ('seo_spesialist', 'marketing.dashboard.view'),
  ('seo_spesialist', 'marketing.needs.view'),
  ('seo_spesialist', 'marketing.scout.run'),
  ('seo_spesialist', 'marketing.scoring.view'),
  ('seo_spesialist', 'marketing.seo.audit')
ON CONFLICT (role, permission_key) DO NOTHING;

-- Content-ansvarlig
INSERT INTO role_permissions (role, permission_key) VALUES
  ('content_ansvarlig', 'marketing.dashboard.view'),
  ('content_ansvarlig', 'marketing.needs.view'),
  ('content_ansvarlig', 'marketing.scoring.view'),
  ('content_ansvarlig', 'marketing.content.brief')
ON CONFLICT (role, permission_key) DO NOTHING;

-- Performance-marketer
INSERT INTO role_permissions (role, permission_key) VALUES
  ('performance_marketer', 'marketing.dashboard.view'),
  ('performance_marketer', 'marketing.needs.view'),
  ('performance_marketer', 'marketing.scout.run'),
  ('performance_marketer', 'marketing.scoring.view'),
  ('performance_marketer', 'marketing.ads_pixels.manage'),
  ('performance_marketer', 'marketing.budget.view')
ON CONFLICT (role, permission_key) DO NOTHING;

-- Markedsanalytiker
INSERT INTO role_permissions (role, permission_key) VALUES
  ('markedsanalytiker', 'marketing.dashboard.view'),
  ('markedsanalytiker', 'marketing.needs.view'),
  ('markedsanalytiker', 'marketing.scoring.view'),
  ('markedsanalytiker', 'marketing.scoring.weights'),
  ('markedsanalytiker', 'marketing.reports.export'),
  ('markedsanalytiker', 'marketing.budget.view')
ON CONFLICT (role, permission_key) DO NOTHING;

-- Salgssjef + admin får også marketing.*.view (de leder bedriften)
INSERT INTO role_permissions (role, permission_key) VALUES
  ('salgssjef', 'marketing.dashboard.view'),
  ('salgssjef', 'marketing.needs.view'),
  ('salgssjef', 'marketing.scoring.view')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
