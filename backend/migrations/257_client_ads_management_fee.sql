-- =====================================================================
-- 257_client_ads_management_fee.sql
--
-- 20% påslag på alle klient-ads-konfigurasjoner (per MedInnova-avtalen
-- + bekreftet 2026-06-08 som standard for The Role Room Agent).
--
-- Verdien er konfigurerbar per klient (kan overstyres ved forhandling),
-- men default = 20.
--
-- Brukes til:
--   - Vise "20% mgmt fee" i AgentAdsPanel når producer setter opp
--   - Vise "Inkluderer 20% mgmt fee" i klient-godkjenning
--   - Beregne fee automatisk på ClientEconomyPanel
--   - Faktura via PowerOffice (planlagt P5)
-- =====================================================================

BEGIN;

ALTER TABLE client_ads_configs
  ADD COLUMN IF NOT EXISTS management_fee_pct NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  ADD COLUMN IF NOT EXISTS management_fee_minimum_nok NUMERIC(10,2),  -- Optional minimum-fee
  ADD COLUMN IF NOT EXISTS management_fee_negotiated BOOLEAN DEFAULT FALSE;
  -- TRUE = klient har eksplisitt godkjent annet enn 20%

CREATE INDEX IF NOT EXISTS idx_client_ads_configs_fee_negotiated
  ON client_ads_configs(management_fee_negotiated)
  WHERE management_fee_negotiated = TRUE;

COMMIT;
