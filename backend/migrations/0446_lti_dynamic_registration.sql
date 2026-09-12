-- 0446_lti_dynamic_registration.sql
-- LTI 1.3 Dynamic Registration: selvbetjent plattform-registrering med
-- super-admin godkjennings-gate. Eksisterende (manuelt registrerte) plattformer
-- er allerede godkjent; dynamic-registrerte starter som 'pending'.

ALTER TABLE role_room_lti_platforms
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE role_room_lti_platforms
  ADD COLUMN IF NOT EXISTS product_family TEXT;
ALTER TABLE role_room_lti_platforms
  ADD COLUMN IF NOT EXISTS registered_via TEXT;

-- Dynamic registration er plattform-initiert uten Role Room-sesjon → ingen
-- bruker-eier. Launch bruker faglærerens sesjon, ikke plattform-eier.
ALTER TABLE role_room_lti_platforms
  ALTER COLUMN owner_user_id DROP NOT NULL;
