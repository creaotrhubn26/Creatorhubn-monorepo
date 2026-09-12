-- 276_lyrics_timing.sql
--
-- Tidsstempler per sangtekst-linje (tap-to-time) for beat-synket karaoke-video.
-- Lagres som JSONB-array av sekunder, justert mot ikke-tomme tekstlinjer i
-- easeverse_tracks.lyrics. NULL = ingen timing (faller tilbake til scroll).

ALTER TABLE easeverse_tracks ADD COLUMN IF NOT EXISTS lyrics_timing JSONB;
