-- Skill mellom å GI og TREKKE TILBAKE samtykke i samme spor.
-- 'granted' = klienten ga tilgang, 'revoked' = klienten trakk den tilbake
-- (GDPR-retten til å trekke samtykke). Siste rad per (prosjekt, plattform)
-- forteller gjeldende status.

ALTER TABLE role_room_client_oauth_consents
  ADD COLUMN IF NOT EXISTS action VARCHAR(16) NOT NULL DEFAULT 'granted';
