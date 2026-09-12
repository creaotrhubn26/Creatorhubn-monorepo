-- LTI 1.3 NRPS (Names and Role Provisioning Services): lagre context-
-- memberships-endepunktet fra launch-token slik at faglærer kan hente
-- LMS-klasse-rosteret (hver students LMS-sub) og pushe karakter per student.
-- Idempotent; backenden self-healer også dette lat via ADD COLUMN IF NOT EXISTS.
ALTER TABLE role_room_lti_launches ADD COLUMN IF NOT EXISTS nrps_url TEXT;
