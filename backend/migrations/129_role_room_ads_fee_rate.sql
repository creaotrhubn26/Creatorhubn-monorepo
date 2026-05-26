-- Migration 129: Per-client påslag (management-fee rate) for Role Room Ads
--
-- Background: Creatorhub↔MedInnova-avtalen §4.1 fastsetter et påslag på 20 %
-- av faktisk annonsekostnad (eks. mva). Tidligere var satsen en hardkodet
-- global konstant (15 %). Vi gjør den per-klient konfigurerbar og persisterer
-- satsen som ble brukt på hver fee-ledger-rad, slik at fakturagrunnlaget
-- forblir etterprøvbart (§5.4) selv om standardsatsen endres senere.

-- 1. Per-campaign påslag. Default 0.20 = Creatorhubs standard byrå-sats.
ALTER TABLE ads_campaigns
  ADD COLUMN IF NOT EXISTS management_fee_rate NUMERIC(5,4) NOT NULL DEFAULT 0.20;

COMMENT ON COLUMN ads_campaigns.management_fee_rate IS
  'Påslag (markup) på faktisk annonsekostnad, 0–1. Default 0.20 per MedInnova-avtalen §4.1. Kan overstyres per klient/kampanje.';

-- 2. Persistér satsen på hver fee-ledger-rad (audit/underlag, §5.4).
ALTER TABLE ads_management_fee_usage
  ADD COLUMN IF NOT EXISTS management_fee_rate NUMERIC(5,4) NOT NULL DEFAULT 0.20;

COMMENT ON COLUMN ads_management_fee_usage.management_fee_rate IS
  'Satsen som faktisk ble brukt for å beregne management_fee_nok på denne raden (etterprøvbart fakturagrunnlag, §5.4).';

COMMENT ON COLUMN ads_management_fee_usage.management_fee_nok IS
  'management_fee_rate × spend_nok (default 20 % påslag, MedInnova-avtalen §4.1).';

-- 3. Idempotens for daglig insights-poll. Uten dette ville en re-kjørt sweep
--    dobbelt-bokføre påslag for samme kampanje+dag. usage_date + UNIQUE gjør
--    fee-raden idempotent per (campaign_id, usage_date), på linje med
--    ads_attribution_daily(campaign_id, date).
ALTER TABLE ads_management_fee_usage
  ADD COLUMN IF NOT EXISTS usage_date DATE;

UPDATE ads_management_fee_usage
   SET usage_date = recorded_at::date
 WHERE usage_date IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ads_mgmt_fee_campaign_day
  ON ads_management_fee_usage(campaign_id, usage_date)
  WHERE usage_date IS NOT NULL;

COMMENT ON COLUMN ads_management_fee_usage.usage_date IS
  'Dagen forbruket gjelder (idempotensnøkkel for den daglige insights-pollen).';
