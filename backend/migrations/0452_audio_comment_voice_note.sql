-- 0452_audio_comment_voice_note.sql
--
-- Lar produsenten legge inn et innspilt lydnotat på en tidskodet kommentar
-- (f.eks. uttale-tilbakemelding til vokalisten), i tillegg til/istedenfor
-- tekst. Lagres som URL til opplastet lydfil (samme opplastings-pipeline
-- som audio_review_versions.file_url).

ALTER TABLE audio_review_comments ADD COLUMN IF NOT EXISTS audio_note_url TEXT;
