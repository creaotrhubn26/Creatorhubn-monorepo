-- 0123_assistant_gdpr.sql
-- GDPR for assistent-flyten (Slice 9X.50). Samme mønster som
-- wedding_timelines (consent_at, deletion_requested_at, anonymized_at).
--
-- Personlige data vi lagrer for assistent:
--   - assistant_email, assistant_name, assistant_phone (kontakt)
--   - subcontract_signer_name, subcontract_signer_id_last4, subcontract_signer_ip (signering)
--   - brief_notes (kan inneholde personlig info)
--
-- Ved sletting: anonymiser ovenstående felter, behold ID/struktur for
-- revisjon (norsk regnskapsloven krever 5 års oppbevaring av faktura-
-- relaterte data, derfor anonymiser ikke fakturerings-grunnlag).

ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS gdpr_consent_at TIMESTAMPTZ;
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS gdpr_consent_ip TEXT;
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS gdpr_delete_requested_at TIMESTAMPTZ;
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS gdpr_anonymized_at TIMESTAMPTZ;

COMMENT ON COLUMN wedding_assistants.gdpr_consent_at IS
  'Tidspunkt assistenten samtykket til datalagring i accept-flyten.';
COMMENT ON COLUMN wedding_assistants.gdpr_anonymized_at IS
  'NULL = personlige data intakt. Satt = e-post/navn/telefon/IP er anonymisert. Struktur og fakturerings-grunnlag består.';
