-- =====================================================================
-- 0000_zz_cleanup_failed_2026_06_17.sql
--
-- Reset _migrations_applied for de mig som faktisk feilet 2026-06-17.
-- Bakgrunn:
--   - migrate.sh manglet `psql -v ON_ERROR_STOP=1` (er nå rettet i denne PR)
--   - Det betydde at SQL som feilet inne i BEGIN/COMMIT ble fortsatt
--     loggført som "applied successfully" pga psql exit-code 0
--   - Mig 285_lead_map_team feilet → 'organizations' aldri laget
--   - Cascade: alle som FK'er organizations eller permissions feilet
--   - Alle filene ble likevel INSERT'ed i _migrations_applied
--
-- Denne fila sletter de feil-applied radene så migrate.sh kjører dem
-- på nytt — nå med ON_ERROR_STOP=1 som faktisk fanger feil.
--
-- Filnavn-prefix 0000_zz: sort -V plasserer dette ETTER 0001_loose_*
-- og før alt annet, men siden migrate.sh sjekker per-fil i loop og denne
-- gir tom diff på nye kjøringer er rekkefølgen ikke kritisk — DELETE
-- påvirker bare hvilke som re-kjøres senere i samme run.
--
-- Idempotent: DELETE påvirker null rader ved andre kjøring.
-- =====================================================================

DELETE FROM _migrations_applied WHERE filename IN (
  '285_lead_map_team.sql',
  '286_lead_map_permissions.sql',
  '287_lead_map_member_locations.sql',
  '288_lead_map_lead_logos.sql',
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
