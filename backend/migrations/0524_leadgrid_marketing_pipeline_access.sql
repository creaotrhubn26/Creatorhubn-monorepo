-- =====================================================================
-- 0524_leadgrid_marketing_pipeline_access.sql
--
-- Bridges the established marketing roles into the parts of the Leadgrid
-- pipeline they actually operate. Mutation access is intentionally limited
-- to the marketing lead and coordinator; specialists remain read-only.
-- =====================================================================

BEGIN;

-- Organization owners need an explicit floor because only `admin` receives
-- every permission implicitly in resolveEffectivePermissions().
INSERT INTO role_permissions (role, permission_key) VALUES
  ('owner', 'projects.view'),
  ('owner', 'leads.view'),
  ('owner', 'leads.create'),
  ('owner', 'leads.update'),
  ('owner', 'leads.export'),
  ('owner', 'visits.view'),
  ('owner', 'visits.create'),
  ('owner', 'visits.update'),
  ('owner', 'analytics.view_overview'),
  ('owner', 'analytics.view_channels'),
  ('owner', 'analytics.view_sources'),
  ('owner', 'analytics.view_segments'),
  ('owner', 'analytics.view_velocity')
ON CONFLICT (role, permission_key) DO NOTHING;

-- Operational marketing roles can promote reviewed Discovery candidates and
-- maintain the resulting CRM follow-up. No delete, assignment, member or
-- permission-management capabilities are granted here.
INSERT INTO role_permissions (role, permission_key) VALUES
  ('markedssjef', 'projects.view'),
  ('markedssjef', 'leads.view'),
  ('markedssjef', 'leads.create'),
  ('markedssjef', 'leads.update'),
  ('markedssjef', 'visits.view'),
  ('markedssjef', 'visits.create'),
  ('markedssjef', 'visits.update'),
  ('markedssjef', 'analytics.view_overview'),
  ('markedssjef', 'analytics.view_channels'),
  ('markedssjef', 'analytics.view_sources'),
  ('markedssjef', 'analytics.view_segments'),
  ('markedssjef', 'analytics.view_velocity'),
  ('markedskoordinator', 'projects.view'),
  ('markedskoordinator', 'leads.view'),
  ('markedskoordinator', 'leads.create'),
  ('markedskoordinator', 'leads.update'),
  ('markedskoordinator', 'visits.view'),
  ('markedskoordinator', 'visits.create'),
  ('markedskoordinator', 'visits.update'),
  ('markedskoordinator', 'analytics.view_overview'),
  ('markedskoordinator', 'analytics.view_channels'),
  ('markedskoordinator', 'analytics.view_sources'),
  ('markedskoordinator', 'analytics.view_segments')
ON CONFLICT (role, permission_key) DO NOTHING;

-- Channel and insight specialists can inspect the shared customer context and
-- outcomes, but cannot create or mutate CRM leads through their role defaults.
INSERT INTO role_permissions (role, permission_key) VALUES
  ('performance_marketer', 'projects.view'),
  ('performance_marketer', 'leads.view'),
  ('performance_marketer', 'visits.view'),
  ('performance_marketer', 'analytics.view_overview'),
  ('performance_marketer', 'analytics.view_channels'),
  ('performance_marketer', 'analytics.view_sources'),
  ('performance_marketer', 'analytics.view_segments'),
  ('markedsanalytiker', 'projects.view'),
  ('markedsanalytiker', 'leads.view'),
  ('markedsanalytiker', 'visits.view'),
  ('markedsanalytiker', 'analytics.view_overview'),
  ('markedsanalytiker', 'analytics.view_channels'),
  ('markedsanalytiker', 'analytics.view_sources'),
  ('markedsanalytiker', 'analytics.view_segments'),
  ('markedsanalytiker', 'analytics.view_velocity'),
  ('seo_spesialist', 'projects.view'),
  ('seo_spesialist', 'leads.view'),
  ('seo_spesialist', 'visits.view'),
  ('seo_spesialist', 'analytics.view_overview'),
  ('content_ansvarlig', 'projects.view'),
  ('content_ansvarlig', 'leads.view'),
  ('content_ansvarlig', 'visits.view'),
  ('content_ansvarlig', 'analytics.view_overview')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
