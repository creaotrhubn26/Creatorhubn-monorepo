-- =====================================================================
-- 307_projects_view_all_permission.sql
--
-- Org-styrt per-prosjekt-tilgang:
--   - Med permission 'projects.view_all' → ser ALLE kundeprosjekter
--     i sin organisasjon. Default for admin/salgssjef/teamleder/
--     markedssjef/markedskoordinator.
--   - Uten permissionen → ser bare prosjekter brukeren er medlem av
--     via project_members-tabellen (mig 0285).
--
-- iPad Portfolio-tab og backend's GET /organizations/:id/portfolio
-- respekterer denne sjekken.
-- =====================================================================

BEGIN;

INSERT INTO permissions (key, category, description) VALUES
  ('projects.view_all', 'Prosjekter',
   'Se ALLE kundeprosjekter i organisasjonen (uten denne kan brukeren bare se prosjekter de er invitert til via project_members)')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role, permission_key) VALUES
  ('admin',              'projects.view_all'),
  ('salgssjef',          'projects.view_all'),
  ('teamleder',          'projects.view_all'),
  ('markedssjef',        'projects.view_all'),
  ('markedskoordinator', 'projects.view_all')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
