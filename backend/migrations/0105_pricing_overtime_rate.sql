-- 0105_pricing_overtime_rate.sql
-- Stines overtime-pris settes ÉN gang i prisadministrasjon og synker
-- automatisk til:
--   1. wedding_timeline.overtime_hourly_rate ved opprettelse av bryllup-prosjekt
--   2. Activate-overtime-endepunktet (hvis ikke override-rate er sendt)
--
-- Per industri-standard: typisk 1.5x base hourly_rate, men Stine setter selv.

ALTER TABLE pricing_structures
  ADD COLUMN IF NOT EXISTS overtime_hourly_rate NUMERIC(10,2);

COMMENT ON COLUMN pricing_structures.overtime_hourly_rate IS
  'Overtidspris per time (NOK). Brukes når bryllup går over kontraktstid. Settes i prisadministrasjon.';
