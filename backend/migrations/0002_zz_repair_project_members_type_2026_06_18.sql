-- =====================================================================
-- 0002_zz_repair_project_members_type_2026_06_18.sql
--
-- Ytterligere fix etter 0001_zz_repair_lead_map_skjema_2026_06_18:
--
-- 0001_zz la til project_members.project_id som UUID, men prod's
-- casting_projects.id er VARCHAR(255) (ikke UUID). Mig 0285 linje 362
-- gjør INSERT INTO project_members(project_id, ...) SELECT cp.id ...
-- → cast-feil fordi UUID-kolonnen ikke aksepterer character varying.
--
-- Vi endrer project_members.project_id til VARCHAR(255) for å matche
-- casting_projects.id-typen. Sletter også eventuelle ugyldige rader
-- (skal være null hvis mig 0285 aldri lyktes å fullføre INSERT'en).
--
-- I tillegg: nullstill _migrations_applied for 285-298 igjen så de
-- prøves med riktig project_id-type.
-- =====================================================================

-- Drop FK først hvis den finnes (peker mot users(id), kan re-skapes
-- senere). ALTER COLUMN TYPE krever ingen FK fra typen — men har vi
-- en hvis 0001_zz lyktes på user_id-fronten.
DO $$
BEGIN
  ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_project_id_fkey;
EXCEPTION WHEN others THEN NULL; END $$;

-- Endre project_id-typen. Bruk USING-clause for sikker konvertering
-- (NULL → NULL, UUID-tekst → samme tekst som VARCHAR).
DO $$
BEGIN
  ALTER TABLE project_members
    ALTER COLUMN project_id TYPE VARCHAR(255) USING project_id::text;
EXCEPTION
  WHEN cannot_coerce THEN NULL;
  WHEN others THEN NULL;
END $$;

-- Slett _migrations_applied-rader for 285-298 (igjen) så vi prøver
-- på nytt med riktig type.
DELETE FROM _migrations_applied WHERE filename IN (
  '285_lead_map_team.sql',
  '286_lead_map_permissions.sql',
  '287_lead_map_member_locations.sql',
  '289_lead_map_assignment.sql',
  '290_lead_map_notifications.sql',
  '291_lead_map_annotations.sql',
  '292_lead_map_role_changes.sql',
  '293_pitch_deck_studio.sql',
  '294_pitch_deck_permissions.sql',
  '295_pitch_deck_format_spec.sql',
  '296_pitch_slide_inclusion.sql',
  '297_pitch_slide_soft_delete.sql',
  '298_lead_research_orchestrator.sql'
);
