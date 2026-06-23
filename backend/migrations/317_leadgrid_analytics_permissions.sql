-- =====================================================================
-- 317_leadgrid_analytics_permissions.sql
--
-- RBAC for Leadgrid Analytics Dashboard.
--
-- Tilfører fem nye permission-keys for å gate de syv analytics-endepunktene
-- (overview, channels, sources, segments, territories, velocity-history,
-- conversion-funnel). Følger samme mønster som migrate 286 (lead_map_*).
--
-- Rolle-defaults:
--   admin            → alle 5
--   salgssjef        → alle 5
--   teamleder        → overview + segments
--   salgskonsulent   → overview
--   (promotor/member/viewer får ikke analytics-tilgang som default)
-- =====================================================================

BEGIN;

INSERT INTO permissions (key, category, description) VALUES
  ('analytics.view_overview', 'Analyse', 'Se org-overview med pipeline-KPIer'),
  ('analytics.view_channels', 'Analyse', 'Se channel-performance'),
  ('analytics.view_sources',  'Analyse', 'Se source-quality'),
  ('analytics.view_segments', 'Analyse', 'Se segment/territory-performance'),
  ('analytics.view_velocity', 'Analyse', 'Se pipeline velocity time-series')
ON CONFLICT (key) DO UPDATE
  SET category    = EXCLUDED.category,
      description = EXCLUDED.description;

INSERT INTO role_permissions (role, permission_key) VALUES
  ('admin', 'analytics.view_overview'),
  ('admin', 'analytics.view_channels'),
  ('admin', 'analytics.view_sources'),
  ('admin', 'analytics.view_segments'),
  ('admin', 'analytics.view_velocity'),
  ('salgssjef', 'analytics.view_overview'),
  ('salgssjef', 'analytics.view_channels'),
  ('salgssjef', 'analytics.view_sources'),
  ('salgssjef', 'analytics.view_segments'),
  ('salgssjef', 'analytics.view_velocity'),
  ('teamleder', 'analytics.view_overview'),
  ('teamleder', 'analytics.view_channels'),
  ('teamleder', 'analytics.view_segments'),
  ('salgskonsulent', 'analytics.view_overview')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
