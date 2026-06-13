-- 272_audio_member_contributions.sql
--
-- «Hvem gjør hva»: flere bidrag per bidragsyter (Produksjon/Mixing/Mastering/
-- Idé/Låtskriving/Tekst/Gitar/Vokal …). Tydelig oversikt + mates inn i splittark.

ALTER TABLE audio_review_members ADD COLUMN IF NOT EXISTS contributions JSONB NOT NULL DEFAULT '[]'::jsonb;
