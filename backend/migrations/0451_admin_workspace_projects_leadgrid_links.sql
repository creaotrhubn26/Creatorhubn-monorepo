-- 0451_admin_workspace_projects_leadgrid_links.sql
--
-- Lar interne Leadgrid-initiativer samle faktiske leads/kunder fra
-- crm_customers. Selve lead-dataene blir liggende i Leadgrid; workspace lagrer
-- bare en tenant-verifisert kobling.

ALTER TABLE admin_workspace_project_links
  DROP CONSTRAINT IF EXISTS admin_workspace_project_links_entity_type_check;

ALTER TABLE admin_workspace_project_links
  ADD CONSTRAINT admin_workspace_project_links_entity_type_check
  CHECK (entity_type IN (
    'funding_app',
    'industry_target',
    'leadgrid_lead',
    'investor',
    'partner',
    'workspace_case'
  ));

COMMENT ON TABLE admin_workspace_project_links IS
  'Tenant-sikrede koblinger fra et adminprosjekt til støtte-, kontakt-, Leadgrid-lead- og saksdata.';
