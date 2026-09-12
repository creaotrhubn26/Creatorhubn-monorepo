-- =====================================================================
-- 0348_fix_vendor_profiles_id_default.sql
--
-- KRITISK BUGFIX: vendor_onboarding_profiles.id hadde default satt til den
-- LITERALE STRENGEN 'gen_random_uuid()' (varchar) i stedet for funksjonskallet.
-- En seed-rad («Default») holdt allerede den literale verdien, så HVER nye
-- vendor-profil (bl.a. godkjenning av redigeringspartnere) fikk samme id →
-- PK-kollisjon → 500. Dette blokkerte all partner-godkjenning (f.eks. Orbit).
--
-- Setter riktig default. Allerede påført prod-DB.
-- =====================================================================

BEGIN;

ALTER TABLE vendor_onboarding_profiles
  ALTER COLUMN id SET DEFAULT (gen_random_uuid())::varchar;

COMMIT;
