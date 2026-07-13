-- 0387_risk_trigger_kind.sql
-- Ny trigger-type 'risk' (konkursvakten): konkurs/avvikling hos et
-- CRM-selskap er et handlingssignal — sikre krav, stopp leveranser.

ALTER TABLE trigger_events
  DROP CONSTRAINT IF EXISTS trigger_events_kind_check;

ALTER TABLE trigger_events
  ADD CONSTRAINT trigger_events_kind_check
  CHECK (kind IN ('tender','strategy_media','hire','ip_filing','risk'));
