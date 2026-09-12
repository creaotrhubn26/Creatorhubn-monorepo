-- =====================================================================
-- 0001_zz_repair_lead_map_skjema_2026_06_18.sql
--
-- Reparer prod-skjemaet så mig 285-298 kan re-kjøres.
--
-- Bakgrunn (kjernen er beskrevet i 0000_zz_cleanup_failed_2026_06_17.sql):
-- mig 285-298 ble feil-applied 2026-06-17 pga migrate.sh manglet
-- ON_ERROR_STOP=1. Vi ryddet _migrations_applied 2026-06-17, men 2026-06-18-
-- runet avslørte 3 ekte SQL-feil:
--
--   mig 285 linje 230: project_members.user_id mangler
--   mig 286 linje 219: user_permission_overrides.organization_id mangler
--   mig 289 linje 54:  lead_assignment_log.lead_id VARCHAR vs crm_customers.id UUID
--
-- Roten er at prod har ELDRE versjoner av disse tabellene (fra eldre
-- ufullført mig-kjøringer) som mangler kolonner. CREATE TABLE
-- IF NOT EXISTS hopper over når tabellen finnes — men eksisterende
-- kolonner endres ikke. Resultat: kolonner som senere mig referer
-- mangler.
--
-- Denne fila tilpasser prod-skjemaet via ALTER TABLE ADD COLUMN
-- IF NOT EXISTS slik at mig 285-298 lykkes ved re-run.
-- =====================================================================

-- ─── project_members: legg til mangle kolonner ───────────────────
ALTER TABLE project_members
  ADD COLUMN IF NOT EXISTS user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS project_id UUID,
  ADD COLUMN IF NOT EXISTS role VARCHAR(40) DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS invited_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ DEFAULT NOW();

-- FK på user_id (idempotent via duplicate_object-catch)
DO $$
BEGIN
  ALTER TABLE project_members
    ADD CONSTRAINT project_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN others THEN NULL;
END $$;

-- ─── user_permission_overrides: legg til mangle organization_id ──
-- Tabellen finnes uten organization_id; legge til den + FK
-- (krever at organizations-tabellen finnes — se nedenfor i samme PR
-- kjøres dette etter mig 285 lykkes pga sort -V: '0001_zz' < '285_').
ALTER TABLE user_permission_overrides
  ADD COLUMN IF NOT EXISTS organization_id UUID;

-- FK kan kun legges til hvis organizations-tabellen eksisterer
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
    BEGIN
      ALTER TABLE user_permission_overrides
        ADD CONSTRAINT user_permission_overrides_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN others THEN NULL;
    END;
  END IF;
END $$;

-- ─── Slett feil-applied rader for 285-298 (igjen) ──────────────
-- Forrige runet 2026-06-18 ga 286, 287, 288, 289, 290_lead_map_*,
-- 291_lead_map_*, 292_lead_map_*, 293_pitch_deck_*, 294_pitch_deck_*,
-- 295-298 ekte SQL-feil → de var ikke applied. Men 288 lyktes faktisk.
-- For å sikkre konsistens sletter vi alle vi vil re-prøve.
DELETE FROM _migrations_applied WHERE filename IN (
  '285_lead_map_team.sql',
  '286_lead_map_permissions.sql',
  '287_lead_map_member_locations.sql',
  -- 288 lyktes faktisk (lead_logos = ALTER COLUMN på crm_customers); skip
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
-- retrigger m/ ny migrate.sh (0026) --
