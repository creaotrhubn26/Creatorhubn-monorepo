-- 268_audio_comment_section_ref.sql
--
-- La en tidskodet kommentar referere til en tekst-seksjon (f.eks. «Refreng 2»),
-- så feedback binder waveform-tidspunkt ↔ tekst-seksjon sammen.

ALTER TABLE audio_review_comments ADD COLUMN IF NOT EXISTS section_ref TEXT;
