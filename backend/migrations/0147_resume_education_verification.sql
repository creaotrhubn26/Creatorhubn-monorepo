-- 0147 — Verifisering av utdanning på CV
--
-- Bruker kan vedlegge én PDF (vitnemål, karakterutskrift) og/eller
-- legge inn en offentlig verifiseringslenke (f.eks. fra utdanningens
-- egen verifiseringsside) per utdanningslinje.
--
-- Brukes til å vise "Verifisert utdanning"-badge på CV-en — gir
-- arbeidsgiver tillit til at utdanningen er ekte uten at de må be om
-- vitnemål eksplisitt.
--
-- Lagring:
--   • PDF lagres i R2 (verification_pdf_r2_key)
--   • PDF-URL er signed og refresheres on-demand (verification_pdf_url cache)
--   • verification_link_url er en offentlig lenke bruker selv gir oss
--   • verified_label er beskrivelse vist på badge ("Master fra UiO", etc)

ALTER TABLE resume_education
  ADD COLUMN IF NOT EXISTS verification_pdf_r2_key       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS verification_pdf_filename     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS verification_link_url         TEXT,
  ADD COLUMN IF NOT EXISTS verification_label            VARCHAR(255),
  ADD COLUMN IF NOT EXISTS verified_at                   TIMESTAMPTZ,
  -- GDPR-samtykke logges per opplasting/lenke-tillegg.
  -- Hvis verified_at IS NOT NULL men consent_at IS NULL = legacy data
  -- som må regodkjennes ved neste edit.
  ADD COLUMN IF NOT EXISTS verification_consent_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_consent_ip_hash  VARCHAR(64);

CREATE INDEX IF NOT EXISTS resume_education_verified_idx
  ON resume_education (resume_id)
  WHERE verified_at IS NOT NULL;
