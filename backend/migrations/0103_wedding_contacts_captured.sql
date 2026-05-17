-- 0103_wedding_contacts_captured.sql
-- Live VIP-checklist på wedding-day live-mode. Stine tapper "fanget" på
-- mobilen når hun har tatt bilde av en VIP, captured_at stempler tid.
-- Hindrer "jeg glemte bestemor"-feilen.

ALTER TABLE wedding_contacts
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;

ALTER TABLE wedding_contacts
  ADD COLUMN IF NOT EXISTS captured_by VARCHAR(64);

CREATE INDEX IF NOT EXISTS wedding_contacts_must_capture_idx
  ON wedding_contacts (wedding_id, is_must_capture, captured_at);

COMMENT ON COLUMN wedding_contacts.captured_at IS
  'Tidspunkt fotografen markerte denne personen som fanget på bilde. NULL = ikke fanget enda.';
COMMENT ON COLUMN wedding_contacts.captured_by IS
  'photographer_id som markerte fanget (hvis flere fotografer på samme bryllup i fremtiden).';
