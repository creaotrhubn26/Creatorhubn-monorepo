-- 0390_award_trigger_kind.sql
-- Ny trigger-type 'award' (tildelingskunngjøringer): hvem vant, hvor
-- mange bød — konkurrent-etterretning og prisreferanser.

ALTER TABLE trigger_events
  DROP CONSTRAINT IF EXISTS trigger_events_kind_check;

ALTER TABLE trigger_events
  ADD CONSTRAINT trigger_events_kind_check
  CHECK (kind IN ('tender','strategy_media','hire','ip_filing','risk','award'));
