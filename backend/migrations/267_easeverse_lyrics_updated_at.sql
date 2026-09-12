-- 267_easeverse_lyrics_updated_at.sql
--
-- Last-write-wins-tidsstempel for tekst, så Audio Showcase ⇄ EaseVerse-synken
-- er deterministisk og stabil (nyeste updatedAt vinner ved reconciliation).

ALTER TABLE easeverse_tracks ADD COLUMN IF NOT EXISTS lyrics_updated_at TIMESTAMPTZ;
UPDATE easeverse_tracks SET lyrics_updated_at = COALESCE(lyrics_updated_at, updated_at, NOW()) WHERE lyrics_updated_at IS NULL;
