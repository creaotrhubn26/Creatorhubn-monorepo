-- 0386_ip_filing_trigger_kind.sql
-- Ny trigger-type 'ip_filing' (Patentstyret): fersk varemerke-aktivitet
-- hos et lead = lanserings-/rebrand-signal før det når media.

ALTER TABLE trigger_events
  DROP CONSTRAINT IF EXISTS trigger_events_kind_check;

ALTER TABLE trigger_events
  ADD CONSTRAINT trigger_events_kind_check
  CHECK (kind IN ('tender','strategy_media','hire','ip_filing'));
