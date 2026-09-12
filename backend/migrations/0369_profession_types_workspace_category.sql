-- 0369: Admin-styrt workspace-kategori per profesjon.
--
-- profession_types.workspace_category (visual|music|service|vendor) avgjør
-- hvilken flate-familie profesjonen får i Team Workspace. NULL → koden
-- faller tilbake til baseline-mappet (workspaceTheme/CANONICAL_PROFESSIONS),
-- så kolonnen er trygg å rulle ut uavhengig av backend-deploy-rekkefølge.
-- Admin setter/endrer den via ProfessionTypeManager (PUT/POST
-- /api/admin/profession-types).

ALTER TABLE profession_types ADD COLUMN IF NOT EXISTS workspace_category VARCHAR(20);

-- Baseline-verdier for seed-radene (kun der admin ikke alt har satt noe).
UPDATE profession_types SET workspace_category = 'visual'
 WHERE name IN ('photographer', 'videographer', 'enterprise') AND workspace_category IS NULL;
UPDATE profession_types SET workspace_category = 'music'
 WHERE name = 'music_producer' AND workspace_category IS NULL;
UPDATE profession_types SET workspace_category = 'service'
 WHERE name = 'pet_groomer' AND workspace_category IS NULL;
UPDATE profession_types SET workspace_category = 'vendor'
 WHERE name = 'vendor' AND workspace_category IS NULL;
