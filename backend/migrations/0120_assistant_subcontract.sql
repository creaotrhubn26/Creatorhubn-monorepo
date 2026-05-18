-- 0120_assistant_subcontract.sql
-- Sub-kontrakt mellom hovedfotograf og assistent (Slice 9X.46).
-- Genereres ved invite, vises i accept-flyten, signeres elektronisk ved
-- aksept. Snapshot lagres så endringer i wedding_assistants etterpå ikke
-- endrer den signerte avtalen.

ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS subcontract_terms JSONB;
-- Snapshot ved invite: { role, compensation, deliveryDeadlineDays, ipRights,
--   confidentialityIncluded, weddingDate, coupleName, primaryName, ...}
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS subcontract_signed_at TIMESTAMPTZ;
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS subcontract_signer_name TEXT;
-- Assistens fulle navn ved signering (kan avvike fra assistant_name)
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS subcontract_signer_id_last4 TEXT;
-- Frivillig: 4 siste sifre av fødselsnummer eller D-nummer. Hjelper
-- identifikasjon hvis tvister oppstår, uten å lagre full personnumber.
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS subcontract_signer_ip TEXT;

COMMENT ON COLUMN wedding_assistants.subcontract_terms IS
  'Snapshot av kontrakts-vilkår på invite-tidspunkt. Endringer i andre kolonner senere endrer ikke det som er signert.';
COMMENT ON COLUMN wedding_assistants.subcontract_signer_id_last4 IS
  'Siste 4 sifre av fnr/D-nummer (frivillig). Lagres som klartekst — kun for tvistehåndtering.';
