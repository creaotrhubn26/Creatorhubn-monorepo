-- 270_audio_member_easeverse_access.sql
--
-- Gi en bidragsyter (typisk vokalist) tilgang til EaseVerse for vokalopptak.
-- Når på: medlemmet får EaseVerse booth-lenke for låten (vokalopptak → takes).

ALTER TABLE audio_review_members ADD COLUMN IF NOT EXISTS easeverse_access BOOLEAN NOT NULL DEFAULT FALSE;
