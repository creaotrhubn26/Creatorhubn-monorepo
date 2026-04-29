-- 0083_whatsapp_bsp_provider.sql
-- BSP-ready dobbel-modus: BYO-Meta (kunden har egen konto) vs
-- hosted-by-CreatorHub (vi er BSP-en, kundens nummer hostes under vår
-- Meta-konto). I dag default 'byo_meta'. Når CreatorHub blir godkjent
-- BSP, kan nye kunder onboardes som 'hosted_by_creatorhub' med
-- ekte per-melding-margin.

ALTER TABLE role_room_org_whatsapp_config
  ADD COLUMN IF NOT EXISTS provider VARCHAR(32) NOT NULL DEFAULT 'byo_meta',
  ADD COLUMN IF NOT EXISTS wholesale_conversation_cost_nok NUMERIC(10, 4),
  ADD COLUMN IF NOT EXISTS retail_conversation_price_nok_ex_vat NUMERIC(10, 4),
  ADD COLUMN IF NOT EXISTS bsp_onboarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bsp_meta_waba_id TEXT;

ALTER TABLE role_room_org_whatsapp_config
  ADD CONSTRAINT role_room_org_whatsapp_config_provider_check
    CHECK (provider IN ('byo_meta', 'hosted_by_creatorhub'));

CREATE INDEX IF NOT EXISTS role_room_org_whatsapp_config_provider_idx
  ON role_room_org_whatsapp_config (provider);

COMMENT ON COLUMN role_room_org_whatsapp_config.provider IS
  'byo_meta: kunden har egen Meta Business-konto, betaler Meta direkte. CreatorHub tar flat subscription-fee. hosted_by_creatorhub: kundens nummer hostes under vår BSP-konto, vi betaler Meta wholesale og fakturerer kunden retail per melding.';

COMMENT ON COLUMN role_room_org_whatsapp_config.wholesale_conversation_cost_nok IS
  'Vår wholesale-pris fra Meta per conversation (kun for hosted_by_creatorhub-mode). Brukes for margin-rapportering. NULL for byo_meta.';

COMMENT ON COLUMN role_room_org_whatsapp_config.retail_conversation_price_nok_ex_vat IS
  'Retail-pris vi fakturerer kunden per conversation (kun for hosted_by_creatorhub-mode). NULL for byo_meta som betaler Meta direkte.';

COMMENT ON COLUMN role_room_org_whatsapp_config.bsp_meta_waba_id IS
  'Vår Meta Business Account ID som kundens nummer hostes under. Kun for hosted_by_creatorhub. NULL for byo_meta som har egen WABA.';

COMMENT ON COLUMN role_room_org_whatsapp_config.bsp_onboarded_at IS
  'Tidspunkt for når kunden ble onboarded under vår BSP-konto via Embedded Signup. NULL for byo_meta.';
