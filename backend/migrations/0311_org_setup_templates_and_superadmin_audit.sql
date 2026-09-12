-- 0311_org_setup_templates_and_superadmin_audit.sql
--
-- To skjema-tillegg for Leadgrid governance:
--
-- 1) organization_setup_templates: 4 maler super-admin kan velge ved
--    opprettelse av ny org (eller en self-onboarder kan velge selv).
--    Hver mal definerer hvilke per-org roller som seedes, hvilke
--    permissions default-aktiveres, og eventuell preset_id (lead-params).
--
-- 2) superadmin_audit_log: hver gang en bruker med users.role='super_admin'
--    "låner" en annen org-kontekst (for å feilsøke, hjelpe en kunde,
--    osv.), logges hva som ble gjort. Gir oss sporbarhet for
--    privacy/GDPR.
--
-- Ingen drop. CREATE TABLE IF NOT EXISTS for begge.

------------------------------------------------------------
-- 1) organization_setup_templates
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_setup_templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key          VARCHAR(40) NOT NULL UNIQUE,
  label                 VARCHAR(200) NOT NULL,
  description           TEXT,
  -- Hvilke per-org-roller som tillates (subset av organization_members.role)
  allowed_roles         JSONB NOT NULL DEFAULT '["admin"]',
  -- Hvilke 45-key RBAC-permissions som default-aktiveres
  default_permissions   JSONB NOT NULL DEFAULT '[]',
  -- Hvilken lead-parameter-preset (mig 304) som auto-knyttes
  lead_preset_key       VARCHAR(40),
  -- Hvilken plan default-velges (free/solo/agency/enterprise)
  default_plan          VARCHAR(40) NOT NULL DEFAULT 'free',
  -- Self-onboard tillatt for denne malen?
  self_onboard_allowed  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  display_order         INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_setup_templates_active
  ON organization_setup_templates (is_active, display_order);

-- Seed de fire malene (idempotent via ON CONFLICT DO UPDATE)
INSERT INTO organization_setup_templates
  (template_key, label, description, allowed_roles, default_permissions,
   lead_preset_key, default_plan, self_onboard_allowed, display_order)
VALUES
  ('solo',
   'Solo-markedsfører',
   'Én bruker som kjører Leadgrid mot 3–10 egne kunder. Ingen team-hierarki.',
   '["admin"]'::jsonb,
   '["leads.view","leads.create","leads.edit","leads.delete","marketing.deliveries.execute","marketing.deliveries.view","reports.view","customers.create"]'::jsonb,
   NULL, 'solo', TRUE, 10),

  ('agency_small',
   'Lite byrå',
   'Admin + 2–10 salgskonsulenter. Ingen mellomledd.',
   '["admin","salgskonsulent","viewer"]'::jsonb,
   '["leads.view","leads.create","leads.edit","leads.delete","marketing.deliveries.execute","marketing.deliveries.view","reports.view","customers.create","org.invite_members"]'::jsonb,
   NULL, 'agency', FALSE, 20),

  ('sales_hierarchy',
   'Salgshierarki',
   'Salgssjef → Teamledere → Salgskonsulenter → Promotører. For salgstunge organisasjoner.',
   '["admin","salgssjef","teamleder","salgskonsulent","promotor","viewer"]'::jsonb,
   '["leads.view","leads.create","leads.edit","leads.delete","marketing.deliveries.execute","marketing.deliveries.view","reports.view","customers.create","org.invite_members","org.manage_teams","leads.assign","leads.transfer"]'::jsonb,
   NULL, 'enterprise', FALSE, 30),

  ('healthtech',
   'Helsetech-spesialist',
   'Solo-admin, preset for helsetech B2B SaaS (MedInnova/medside.no-type kunder).',
   '["admin","salgskonsulent"]'::jsonb,
   '["leads.view","leads.create","leads.edit","leads.delete","marketing.deliveries.execute","marketing.deliveries.view","reports.view","customers.create"]'::jsonb,
   'healthtech_b2b', 'solo', FALSE, 40)
ON CONFLICT (template_key) DO UPDATE
  SET label                = EXCLUDED.label,
      description          = EXCLUDED.description,
      allowed_roles        = EXCLUDED.allowed_roles,
      default_permissions  = EXCLUDED.default_permissions,
      lead_preset_key      = EXCLUDED.lead_preset_key,
      default_plan         = EXCLUDED.default_plan,
      self_onboard_allowed = EXCLUDED.self_onboard_allowed,
      display_order        = EXCLUDED.display_order,
      updated_at           = now();

------------------------------------------------------------
-- 2) superadmin_audit_log
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS superadmin_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id  VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action          VARCHAR(60) NOT NULL,
  -- 'switch_org_context' | 'create_organization' | 'impersonate_user'
  -- | 'invite_org_admin' | 'view_sensitive_data' | 'override_permission'
  target_org_id   UUID REFERENCES organizations(id) ON DELETE SET NULL,
  target_user_id  VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  -- Hvilke felter/data ble berørt — fri-JSON for fleksibilitet
  details         JSONB NOT NULL DEFAULT '{}',
  ip_address      VARCHAR(80),
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_superadmin_audit_admin_time
  ON superadmin_audit_log (super_admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_target_org_time
  ON superadmin_audit_log (target_org_id, created_at DESC)
  WHERE target_org_id IS NOT NULL;

------------------------------------------------------------
-- 3) Sessions: husk super_admin's "lånte" org-kontekst
--    organization_members eksisterer allerede — vi trenger ikke
--    duplisere det. Vi legger 'impersonated_org_id' i en separat
--    tabell slik at session-state ikke smitter på vanlige medlemmer.
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS superadmin_impersonation_session (
  super_admin_id  VARCHAR(255) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  active_org_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ
);
