-- 0333_editing_partner_type_and_fee.sql
-- Partner-type per redigeringsvendor: prototype-tester (0 % i en periode) vs.
-- vanlig kunde (partner-fee). Admin bestemmer ved godkjenning + kan endre senere.
--   partner_type:      'prototype' | 'standard' (NULL = uavklart → prototype-fase-default)
--   prototype_until:   slutt på gratis prototype-periode (NULL = ubegrenset)
--   platform_fee_bps:  plattform-gebyr i basispunkter (1500 = 15 %); brukes for
--                      'standard', og for 'prototype' ETTER at perioden er utløpt.

ALTER TABLE vendor_onboarding_profiles
  ADD COLUMN IF NOT EXISTS partner_type     text,
  ADD COLUMN IF NOT EXISTS prototype_until  timestamptz,
  ADD COLUMN IF NOT EXISTS platform_fee_bps integer;

-- Rask filtrering på type i admin-panelet.
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_partner_type
  ON vendor_onboarding_profiles (partner_type)
  WHERE vendor_type = 'editing';
